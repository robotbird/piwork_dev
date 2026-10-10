import "server-only";

import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { RpcClientOptions } from "@earendil-works/pi-coding-agent";
import { RpcClient } from "@earendil-works/pi-coding-agent";
import {
  buildSandboxModelsJson,
  RUN_TOKEN_ENV,
  sandboxModelEntryFromModel,
} from "../../inference-proxy";
import type {
  RuntimeBackend,
  RuntimeEvent,
  RuntimeSession,
  RuntimeSpec,
} from "../../protocol";
import type {
  SandboxHandle,
  SandboxProvider,
  SandboxReleasePolicy,
  SandboxSpec,
} from "../../sandbox";
import { startSandboxBridge } from "../../sandbox/bridge/pump";
import { startSandboxRenewalLoop } from "../../sandbox/leasing";
import {
  DEFAULT_SANDBOX_RESOURCE,
  type SandboxResourcePolicy,
  sandboxResourceSchema,
} from "../../sandbox/resource-policy";
import { AsyncEventQueue } from "../event-queue";
import { LocalRpcRuntimeSession } from "../local-rpc/backend";
import { buildRpcClientOptions, seedSessionFile } from "../local-rpc/spawn";
import {
  type ArtifactArchive,
  type ArtifactStore,
  createArtifactGateway,
} from "./artifact-gateway";
import {
  DELIVER_FILE_EXTENSION_PATH,
  deliverFileExtensionSource,
} from "./deliver-file-extension";
import {
  installSandboxSkills,
  sandboxSkillsPrompt,
  snapshotSandboxSkills,
} from "./skills";

/**
 * SandboxRpcBackend（spec §6 Phase 2，spawn 策略 B）：与 LocalRpcBackend
 * 同一 RuntimeSession 语义（LocalRpcRuntimeSession 复用，事件规范化、终态
 * 推导、watchdog 零改动），差异只在进程拓扑——官方 RpcClient 的 cliPath 指
 * 向 bridge shim，shim 经 UDS 泵连 SandboxChannel，在沙箱内起官方 pi
 * `--mode rpc`。seeding 仍走官方 SessionManager 本地落盘再上传
 * workspace（--session 给沙箱内绝对路径；缺失文件合法，空历史即此形态）。
 *
 * fail-closed（spec §7.3）：provider.acquire 失败原样抛 SandboxUnavailableError，
 * run 直接 failed，绝不回退 in-process。
 */

export type SandboxRpcBackendOptions = {
  provider: SandboxProvider;
  /**
   * 沙箱内 pi 进程 env 覆盖（如 PIWORK_FAUX_SCRIPT）。宿主 env 不透传；
   * 平台密钥注入由 Phase 4 Inference Proxy 解决。
   */
  env?: Record<string, string>;
  /**
   * --extension 列表：以「沙箱内视角路径」给出（与 LocalRpcBackend 的宿主
   * 路径语义不同）。测试底座与宿主同机时可传宿主路径；真实容器底座须先
   * 上传扩展再把 workspace 相对路径换算成沙箱内绝对路径。
   */
  extensions?: string[];
  image?: string;
  ttlSeconds?: number;
  /** Trusted host callback, sampled once before mint/acquire. */
  resourcePolicy?: () => Promise<SandboxResourcePolicy>;
  /** Trusted managed skill root override; not a model/client path. */
  skillsRoot?: string;
  /** Explicit portable collector for non-Linux unit tests only. */
  allowNonLinuxSkillReadForTests?: boolean;
  /** 会话关闭后的沙箱处置；默认 kill（spec §11 D-6），keep 供 chat 级复用 */
  releasePolicy?: SandboxReleasePolicy;
  /**
   * 沙箱内 pi cli 绝对路径（必填）。官方分发形态是「已安装的完整包」：
   * dist/bundle 运行时仍从周边 node_modules 解析 jiti（TS 扩展装载器）等
   * 依赖，单拷 bundle 树不是合法分发（实测扩展装载即失败）。同机测试底座
   * 传 resolveDefaultCliPath()；容器底座由镜像预装完整 pi（spec P3 Step 6）。
   */
  remoteCliPath: string;
  /**
   * Artifact Gateway 归档回调（生产为 registerGeneratedFile；缺省跳过）。
   * deliver_file 出站走 workspace outbox + 宿主收割（沙箱内无法直呼控制面）。
   */
  archiveFile?: ArtifactArchive;
  /** Artifact Gateway 出站存储（默认 storeFile；测试注入替身） */
  store?: ArtifactStore;
  /**
   * Inference Proxy 装配（spec §6 Phase 4，v2.0 §7.2）：缺省 = 无模型
   * 通道（deny-all，行为同 Phase 2/3）；配置后按 run 签发短期 token、
   * 生成沙箱 agentDir models.json（pi-messages provider + `${ENV}` 模板）
   * 并把 egress 收紧为「proxy 主机 + 基线 ∩ RuntimeSpec 申请」。
   */
  inference?: SandboxInferenceOptions;
};

export type SandboxInferenceOptions = {
  /** 沙箱视角可达的 proxy 地址（如 http://host.docker.internal:3210） */
  proxyUrl: string;
  /** 装配级附加 FQDN 基线（管理员控制；proxy 主机恒在基线内） */
  baselineFqdns?: readonly string[];
  /** 按 run 签发 token（InferenceProxyServer 侧 token registry 的入口） */
  mintRunToken: (request: {
    runId: string;
    chatId: string;
    grants: readonly { provider: string; model: string }[];
  }) => string | Promise<string>;
  /** run 关闭/失败时撤销该 run 的 token（幂等） */
  revokeRunTokens: (runId: string) => void | Promise<void>;
};

/**
 * egress 派生（spec §6 Phase 4：默认拒绝 + 只能收紧）。基线 = proxy 主机
 * + 装配级附加；RuntimeSpec 申请与基线取交集（超出基线的申请被丢弃，
 * 不能借 spec 扩面）。proxy 主机恒在结果内——模型通道是运行必需的
 * 平台设施，不属于 run 可裁剪范围。
 */
export function deriveSandboxEgress(
  inference: SandboxInferenceOptions | undefined,
  requested: RuntimeSpec["egress"]
): SandboxSpec["egress"] {
  if (!inference) {
    return { mode: "deny-all" };
  }
  const proxyHost = proxyHostOf(inference.proxyUrl);
  const baseline = new Set<string>(
    [proxyHost, ...(inference.baselineFqdns ?? [])].filter(Boolean)
  );
  if (!requested) {
    return { fqdns: [...baseline], mode: "allowlist" };
  }
  const fqdns = [proxyHost];
  for (const fqdn of requested.allowFqdns) {
    if (baseline.has(fqdn) && !fqdns.includes(fqdn)) {
      fqdns.push(fqdn);
    }
  }
  return { fqdns, mode: "allowlist" };
}

function proxyHostOf(proxyUrl: string): string {
  try {
    return new URL(proxyUrl).hostname;
  } catch (error) {
    throw new Error(
      `runtime:sandbox:bad-config:inference.proxyUrl:${proxyUrl}（需为合法绝对 URL）`,
      { cause: error }
    );
  }
}

/**
 * 镜像 rpc-client.js:29-39 的 argv 顺序（cliPath --mode rpc [--provider]
 * [--model] ...args）构造沙箱内命令行。顺序与官方 spawn 保持一致，避免
 * 依赖 pi CLI 对 flag 顺序的任何隐含假设。
 */
export function buildSandboxAgentArgv(
  options: Pick<RpcClientOptions, "provider" | "model" | "args">,
  remoteCli: string
): string[] {
  const argv = ["node", remoteCli, "--mode", "rpc"];
  if (options.provider) {
    argv.push("--provider", options.provider);
  }
  if (options.model) {
    argv.push("--model", options.model);
  }
  argv.push(...(options.args ?? []));
  return argv;
}

export class SandboxRpcBackend implements RuntimeBackend {
  private readonly options: SandboxRpcBackendOptions;

  constructor(options: SandboxRpcBackendOptions) {
    this.options = options;
  }

  async open(spec: RuntimeSpec): Promise<RuntimeSession> {
    if (spec.tools.some((tool) => tool.name === "platform_web_search")) {
      throw new Error(
        "平台联网搜索尚未接入 SandboxRpc；不能丢弃工具或回退宿主执行。"
      );
    }
    const resource = sandboxResourceSchema.parse(
      this.options.resourcePolicy
        ? await this.options.resourcePolicy()
        : DEFAULT_SANDBOX_RESOURCE
    );
    const skillSnapshots = spec.workspaceDir
      ? await snapshotSandboxSkills(spec.skills ?? [], {
          allowNonLinuxForTests: this.options.allowNonLinuxSkillReadForTests,
          root: this.options.skillsRoot,
        })
      : [];
    const queue = new AsyncEventQueue<RuntimeEvent>();
    const { inference } = this.options;
    const runId = spec.runId ?? globalThis.crypto.randomUUID();
    // token 先于沙箱签发：mint 失败（如 run 未授权模型）直接失败，不留
    // 无凭据沙箱；真实 provider 凭据永不进沙箱（proxy 侧独占）
    const runToken = inference
      ? await inference.mintRunToken({
          chatId: spec.chatId,
          grants: [{ model: spec.model.id, provider: spec.model.provider }],
          runId,
        })
      : undefined;
    const sandboxSpec: SandboxSpec = {
      chatId: spec.chatId,
      egress: deriveSandboxEgress(inference, spec.egress),
      image: this.options.image ?? "pi-runtime:dev",
      metadata: { "piwork.io/run-id": runId },
      resource,
      runId,
      ttlSeconds: this.options.ttlSeconds ?? 3600,
      workspaceVolume: { source: spec.workspaceDir ?? "ephemeral" },
    };
    // fail-closed：acquire 失败（SandboxUnavailableError）直接上抛，open 失败；
    // 已签发的 run token 必须随之撤销（不留给滑动过期兜底）
    let handle: SandboxHandle;
    try {
      handle = await this.options.provider.acquire(sandboxSpec);
    } catch (error) {
      if (inference) {
        await Promise.resolve(inference.revokeRunTokens(runId)).catch(
          () => undefined
        );
      }
      throw error;
    }
    const stopRenewal = startSandboxRenewalLoop(handle, sandboxSpec.ttlSeconds);
    const releasePolicy = this.options.releasePolicy ?? "kill";
    const remoteCli = this.options.remoteCliPath;
    try {
      // All skill files are materialized before the remote agent can execute.
      const skillPaths = await installSandboxSkills(handle, skillSnapshots);
      // seeding：官方 SessionManager 本地落盘 → 上传 workspace 绝对路径
      // （空历史不落盘：--session 给绝对路径时缺失文件合法，直接引用）
      const seedDir = await mkdtemp(path.join(tmpdir(), "piwork-sbx-seed-"));
      const localSessionFile = seedSessionFile(
        spec,
        seedDir,
        handle.workspaceRoot
      );
      const remoteSessionFile = path.posix.join(
        handle.workspaceRoot,
        "piwork/session.jsonl"
      );
      const sessionBytes = await readFile(localSessionFile).catch(() => null);
      if (sessionBytes) {
        await handle.writeFile("piwork/session.jsonl", sessionBytes);
      }
      const remoteAgentDir = path.posix.join(
        handle.workspaceRoot,
        "piwork/agentdir"
      );
      // 物化 agentDir（PI_CODING_AGENT_DIR 目标目录）
      await handle.writeFile("piwork/agentdir/.keep", new Uint8Array());
      // Inference Proxy：按 run 生成 models.json（官方 pi-messages provider +
      // `${PIWORK_RUN_TOKEN}` env 模板；pi 经 PI_CODING_AGENT_DIR 自动发现）
      if (runToken !== undefined && inference) {
        await handle.writeFile(
          "piwork/agentdir/models.json",
          new TextEncoder().encode(
            buildSandboxModelsJson({
              models: [sandboxModelEntryFromModel(spec.model)],
              proxyUrl: inference.proxyUrl,
            })
          )
        );
      }

      // Artifact Gateway 沙箱侧：有 workspace（执行工具开启）时物化
      // deliver_file extension，挂 --extension（沙箱内视角绝对路径）
      const extensions = [...(this.options.extensions ?? [])];
      if (spec.workspaceDir) {
        await handle.writeFile(
          DELIVER_FILE_EXTENSION_PATH,
          new TextEncoder().encode(deliverFileExtensionSource())
        );
        extensions.push(
          path.posix.join(handle.workspaceRoot, DELIVER_FILE_EXTENSION_PATH)
        );
      }

      // args 复用 LocalRpc 派生（--session/--system-prompt/extensions 等
      // 引用沙箱内路径）；derived.env/cwd 属宿主侧，不进沙箱
      const derived = buildRpcClientOptions(
        {
          ...spec,
          appendSystemPrompt: sandboxSkillsPrompt(spec, handle.workspaceRoot),
        },
        {
          agentDir: "unused",
          sessionDir: "unused",
          sessionFile: remoteSessionFile,
        },
        // 这里只派生 argv，实际宿主 spawn 用下方 bridge.shimPath。
        // 显式给出远端 CLI，避免无意义地解析宿主包入口（Turbopack
        // 不提供 import.meta.resolve，会在创建沙箱后使 open 中断）。
        { cliPath: remoteCli, extensions }
      );

      derived.args = [
        ...(derived.args ?? []),
        "--no-approve",
        "--no-extensions",
        "--no-skills",
        "--no-context-files",
        "--no-prompt-templates",
        ...skillPaths.flatMap((file) => ["--skill", file]),
      ];
      const bridge = await startSandboxBridge(handle, {
        argv: buildSandboxAgentArgv(derived, remoteCli),
        cwd: handle.workspaceRoot,
        // 沙箱内 env：最小集 + agentDir + run token + 测试/调用方覆盖；
        // 宿主 env 不透传（run token 是沙箱拿到的唯一模型凭据）
        env: {
          PI_CODING_AGENT_DIR: remoteAgentDir,
          PI_OFFLINE: "1",
          ...(runToken === undefined ? {} : { [RUN_TOKEN_ENV]: runToken }),
          ...(this.options.env ?? {}),
        },
      });
      try {
        const client = new RpcClient({
          args: derived.args,
          cliPath: bridge.shimPath,
          cwd: derived.cwd,
          env: bridge.shimEnv,
          model: derived.model,
          provider: derived.provider,
        });
        await client.start();
        // Artifact Gateway 宿主侧：收割沙箱 outbox → 出站/归档/artifact.created
        const gateway = createArtifactGateway({
          archiveFile: this.options.archiveFile,
          chatId: spec.chatId,
          queue,
          readFile: (file) => handle.readFile(file),
          store: this.options.store,
        });
        const unsubscribeGateway = client.onEvent(gateway.handleEvent);
        // close 顺序契约：preClose 在 super.close（client.stop + queue.end）
        // 之前——迟到的 artifact.created 必须落在仍开放的 queue 里；postClose
        // 在其后停桥释放沙箱（flush 时沙箱必须还活着，readFile 才能成）
        const preClose = async () => {
          unsubscribeGateway();
          await gateway.flush();
        };
        const postClose = async () => {
          stopRenewal();
          await bridge.stop();
          // 释放失败不阻断会话关闭（沙箱侧 TTL 到期兜底回收）
          await this.options.provider
            .release(handle, releasePolicy)
            .catch(() => undefined);
          // run token 撤销（漏撤由滑动过期兜底，spec §6 Phase 4）
          if (inference) {
            await Promise.resolve(inference.revokeRunTokens(runId)).catch(
              () => undefined
            );
          }
        };
        return new SandboxRpcRuntimeSession(client, queue, preClose, postClose);
      } catch (error) {
        await bridge.stop();
        throw error;
      }
    } catch (error) {
      stopRenewal();
      await this.options.provider
        .release(handle, "kill")
        .catch(() => undefined);
      if (inference) {
        await Promise.resolve(inference.revokeRunTokens(runId)).catch(
          () => undefined
        );
      }
      throw error;
    }
  }
}

export class SandboxRpcRuntimeSession extends LocalRpcRuntimeSession {
  private readonly preClose: () => Promise<void>;
  private readonly postClose: () => Promise<void>;

  constructor(
    client: RpcClient,
    queue: AsyncEventQueue<RuntimeEvent>,
    preClose: () => Promise<void>,
    postClose: () => Promise<void>
  ) {
    super(client, queue);
    this.preClose = preClose;
    this.postClose = postClose;
  }

  override async close(reason: string): Promise<void> {
    // 排空 Artifact Gateway 在 queue.end 与沙箱释放之间落地（见 open 内顺序契约）
    await this.preClose().catch(() => undefined);
    await super.close(reason);
    await this.postClose().catch(() => undefined);
  }
}
