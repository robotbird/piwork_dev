import "server-only";

import { getActivePiProviders } from "@/lib/ai/pi";
import { authorizeRoleRun, checkUserTokenQuota } from "@/lib/ai/role-access";
import {
  publishChatMessage,
  publishChatRun,
} from "@/lib/collab/chat-event-hub";
import { postgresAgentRunStore } from "@/lib/db/agent-run-queries";
import { recordInferenceAudit } from "@/lib/db/inference-audit-queries";
import { registerGeneratedFile } from "@/lib/db/library-queries";
import { upsertMessage } from "@/lib/db/queries";
import { PostgresEventStore } from "@/lib/db/runtime-event-queries";
import { DurableBackend } from "../backends/durable/backend";
import { readDurableChatConfig } from "../backends/durable/chat-policy";
import { InProcessBackend } from "../backends/in-process/backend";
import {
  RoutingRuntimeBackend,
  requiresSandbox,
} from "../backends/routing/backend";
import { ExplicitDurableRuntimeBackend } from "../backends/routing/explicit-durable";
import {
  type SandboxInferenceOptions,
  SandboxRpcBackend,
} from "../backends/sandbox-rpc/backend";
import {
  InferenceProxyServer,
  RunTokenRegistry,
  type UpstreamResolver,
} from "../inference-proxy";
import type { RuntimeBackend, RuntimeSpec } from "../protocol";
import {
  buildSandboxProvider,
  parseOptionalInt,
} from "../sandbox/configuration";
import { LeasingSandboxProvider } from "../sandbox/leasing";
import { dbSandboxRegistry } from "../sandbox/registry";
import { buildDurableChatBackend } from "./durable-chat";
import { RunManager } from "./run-manager";

/**
 * RunManager 组装与单例（v2.0 §8.2）：InProcessBackend + Postgres 持久化。
 * 挂 globalThis Symbol 键使 dev HMR 下 run 状态存活；进程全量重启则
 * LiveRun 丢失，由 attach 落空 → failZombieRuns 兜底（§2.12）。
 *
 * - PIWORK_RUNTIME_BACKEND=durable 切换实验性 Pi Durable 后端
 *   （docs/pi-durable-evaluation.md D0；本装配仍无持久 factory/Worker，
 *   NODE_ENV=production 时 DurableBackend 拒绝默认 MemoryStorage）。
 * - PIWORK_SANDBOX_PROVIDER=docker|opensandbox 切换沙箱装配（spec §6
 *   Phase 2/3/5；opensandbox-integration-spec.md §7 组装）。默认未设置 =
 *   in-process 行为不变。fail-closed：未知取值/缺必配直接抛错，绝不静默回退
 *   in-process（§7.3）。PIWORK_SANDBOX_ROUTING 选执行形态：matrix（默认，
 *   v2.0 §8.1 路由矩阵——含执行工具的 run 走 SandboxRpc、纯对话 in-process
 *   并存非降级、AgentRun.backend 逐 run 落实际执行位）| all（全量沙箱，
 *   诊断/验证形态）。
 */

/** 沙箱底座装配（生产 docker/opensandbox；test 替身归 tests/support，禁止进生产装配） */
function buildSandboxBackend(): {
  backend: RuntimeBackend;
  backendKind: "sandbox_rpc";
} {
  const providerName = process.env.PIWORK_SANDBOX_PROVIDER;
  if (providerName !== "docker" && providerName !== "opensandbox") {
    throw new Error(
      `runtime:sandbox:unsupported-provider:${providerName}（可用：docker|opensandbox；测试替身经 RunManager 直注，不走本装配）`
    );
  }
  const remoteCliPath = process.env.PIWORK_SANDBOX_CLI_PATH;
  if (!remoteCliPath) {
    throw new Error(
      "runtime:sandbox:missing-config:PIWORK_SANDBOX_CLI_PATH（沙箱内 pi 安装绝对路径，fail-closed 不猜测）"
    );
  }
  const ttlSeconds = parseOptionalInt("PIWORK_SANDBOX_TTL_SECONDS");
  const innerProvider = buildSandboxProvider(providerName);
  const provider = new LeasingSandboxProvider(innerProvider, dbSandboxRegistry);
  return {
    backend: new SandboxRpcBackend({
      // 沙箱内 pi 无平台凭据：模型走 Inference Proxy（配置了
      // PIWORK_INFERENCE_URL 才启用；未配置 = Phase 2/3 的 deny-all 形态）
      archiveFile: registerGeneratedFile,
      image: process.env.PIWORK_SANDBOX_IMAGE,
      inference: buildInferenceOptions(),
      provider,
      remoteCliPath,
      ...(ttlSeconds === undefined ? {} : { ttlSeconds }),
    }),
    backendKind: "sandbox_rpc",
  };
}

/**
 * Inference Proxy 装配（spec §6 Phase 4，v2.0 §7.2 MVP）。显式启用：
 * `PIWORK_INFERENCE_URL`（沙箱视角可达地址，如
 * http://host.docker.internal:3210）缺省 = 不启用（deny-all，无模型通道）。
 * 监听侧 `PIWORK_INFERENCE_PROXY_HOST`（默认 0.0.0.0——容器需可达，
 * 每请求都要有效 run token）、`PIWORK_INFERENCE_PROXY_PORT`（默认 3210）；
 * egress 基线附加 `PIWORK_INFERENCE_EGRESS_ALLOWLIST`（逗号分隔 FQDN）。
 * 上游 = 模型插件 WorkerThread host（getActivePiProviders），真实凭据
 * 只在控制面；审计落 InferenceAccessAudit（脱敏 best-effort）。
 * listen 失败 fail-closed：首个 run 的 mintRunToken 即抛错，run failed。
 */
function buildInferenceOptions(): SandboxInferenceOptions | undefined {
  const proxyUrl = process.env.PIWORK_INFERENCE_URL;
  if (!proxyUrl) {
    return;
  }
  const host = process.env.PIWORK_INFERENCE_PROXY_HOST ?? "0.0.0.0";
  const port = parseOptionalInt("PIWORK_INFERENCE_PROXY_PORT") ?? 3210;
  const baselineFqdns = (process.env.PIWORK_INFERENCE_EGRESS_ALLOWLIST ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const tokens = new RunTokenRegistry();
  const resolver: UpstreamResolver = async (grant) => {
    const providers = await getActivePiProviders();
    const provider = providers.find(
      (candidate) => candidate.id === grant.provider
    );
    const model = provider
      ?.getModels()
      .find((candidate) => candidate.id === grant.model);
    return provider && model ? { model, provider } : null;
  };
  const server = new InferenceProxyServer({
    audit: { record: (entry) => recordInferenceAudit(entry) },
    resolver,
    tokens,
  });
  // HMR 存活：监听一次，失败保留在 promise 上由首个 run 显式失败
  runtimeGlobal.inferenceReady ??= server.listen({ host, port });
  runtimeGlobal.inferenceReady.catch(() => undefined);
  return {
    proxyUrl,
    ...(baselineFqdns.length > 0 ? { baselineFqdns } : {}),
    mintRunToken: async (request) => {
      await runtimeGlobal.inferenceReady;
      return tokens.mint(request).token;
    },
    revokeRunTokens: (runId) => tokens.revokeRun(runId),
  };
}

function resolveBackend(): {
  backend: RuntimeBackend;
  backendKind?: "in_process" | "sandbox_rpc";
  backendKindFor?: (spec: RuntimeSpec) => "in_process" | "sandbox_rpc";
} {
  if (process.env.PIWORK_SANDBOX_PROVIDER) {
    if (process.env.PIWORK_RUNTIME_BACKEND === "durable") {
      throw new Error(
        "runtime:sandbox:bad-config:PIWORK_SANDBOX_PROVIDER 与 durable 实验后端不可同时启用"
      );
    }
    const routing = process.env.PIWORK_SANDBOX_ROUTING ?? "matrix";
    if (routing !== "matrix" && routing !== "all") {
      throw new Error(
        `runtime:sandbox:bad-config:PIWORK_SANDBOX_ROUTING:${routing}（可用：matrix|all）`
      );
    }
    const sandbox = buildSandboxBackend();
    if (routing === "all") {
      // 全量沙箱（诊断/验证形态）：所有 run 走 SandboxRpcBackend
      return sandbox;
    }
    // 路由矩阵（v2.0 §8.1，默认）：含执行工具的 run 走沙箱，纯对话
    // in-process 并存非降级；fail-closed 在 RoutingRuntimeBackend 内
    return {
      backend: new RoutingRuntimeBackend({
        inProcess: new InProcessBackend(registerGeneratedFile),
        sandbox: sandbox.backend,
      }),
      backendKindFor: (spec) =>
        requiresSandbox(spec) ? "sandbox_rpc" : "in_process",
    };
  }
  return {
    backend:
      process.env.PIWORK_RUNTIME_BACKEND === "durable"
        ? new DurableBackend()
        : new InProcessBackend(registerGeneratedFile),
    backendKind: "in_process",
  };
}

type RunManagerGlobal = {
  manager?: RunManager;
  /** Inference Proxy 监听就绪（或失败）promise；HMR 下复用同一实例 */
  inferenceReady?: Promise<{ host: string; port: number; url: string }>;
  /** 进程实例 id：lease 持有者标识（重启即更换） */
  workerId?: string;
};

const RUN_MANAGER_KEY = Symbol.for("piwork.run-manager");
const globalScope = globalThis as Record<symbol, RunManagerGlobal | undefined>;
globalScope[RUN_MANAGER_KEY] ??= {};
const runtimeGlobal = globalScope[RUN_MANAGER_KEY];

const normal = resolveBackend();
const durableChatConfig = readDurableChatConfig();
const resolved = {
  backend: new ExplicitDurableRuntimeBackend(
    normal.backend,
    durableChatConfig ? buildDurableChatBackend(durableChatConfig) : undefined
  ),
  backendKindFor: (spec: RuntimeSpec) =>
    spec.lane === "durable_sandbox"
      ? ("durable_sandbox" as const)
      : (normal.backendKindFor?.(spec) ?? normal.backendKind ?? "in_process"),
};

runtimeGlobal.workerId ??= globalThis.crypto.randomUUID();
runtimeGlobal.manager ??= new RunManager({
  authorizeStart: async (input) =>
    authorizeRoleRun(input.userId, input.spec.model),
  backend: resolved.backend,
  backendKindFor: resolved.backendKindFor,
  checkRecordedQuota: checkUserTokenQuota,
  eventStore: new PostgresEventStore(),
  messageStore: {
    upsertAssistantMessage: async ({ chatId, id, parts }) => {
      await upsertMessage({ chatId, id, parts });
      // 协作实时：assistant 终态幂等 upsert 后通知房间（经典/Durable/
      // 定时任务共用此回调，actorId 无法在此取得运行归属 → null，
      // 客户端不 做 self-skip，重拉为幂等操作）。
      publishChatMessage({ actorId: null, chatId, role: "assistant" });
      publishChatRun({ actorId: null, chatId, phase: "finished" });
    },
  },
  runStore: postgresAgentRunStore,
  workerId: runtimeGlobal.workerId,
});

export function getRunManager(): RunManager {
  const { manager } = runtimeGlobal;
  if (!manager) {
    throw new Error("runtime:run-manager:not-initialized");
  }
  return manager;
}
