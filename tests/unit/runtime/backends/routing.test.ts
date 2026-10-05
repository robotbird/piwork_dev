import "../../../support/runtime-env";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { getPiModel } from "@/lib/ai/pi";
import { resolveDefaultCliPath } from "@/lib/runtime/backends/local-rpc/spawn";
import {
  RoutingRuntimeBackend,
  requiresSandbox,
} from "@/lib/runtime/backends/routing/backend";
import { SandboxRpcBackend } from "@/lib/runtime/backends/sandbox-rpc/backend";
import type {
  RuntimeBackend,
  RuntimeSession,
  RuntimeSpec,
} from "@/lib/runtime/protocol";
import { InMemoryEventStore } from "@/lib/runtime/run/in-memory-event-store";
import { type AgentRunStore, RunManager } from "@/lib/runtime/run/run-manager";
import { TestSandboxProvider } from "../../../support/sandbox/test-sandbox-provider";

/**
 * 路由矩阵测试（v2.0 §8.1，spec §6 Phase 5 MVP）：requiresSandbox 判定、
 * RoutingRuntimeBackend 分流与 fail-closed（沙箱失败绝不回落 in-process）、
 * RunManager 逐 run 落 AgentRun.backend 实际执行位、以及与真实
 * SandboxRpcBackend（TestSandboxProvider）的分流闭环。
 */

const CHAT_A = "00000000-0000-0000-0000-0000000000d1";
const CHAT_B = "00000000-0000-0000-0000-0000000000d2";
const USER = "00000000-0000-0000-0000-0000000000d3";

function makeSpec(overrides: Partial<RuntimeSpec> = {}): RuntimeSpec {
  return {
    appendSystemPrompt: [],
    chatId: CHAT_A,
    historyMessages: [],
    model: {
      id: "test-model",
      name: "Test model",
      provider: "test-provider",
    } as RuntimeSpec["model"],
    systemPrompt: "routing test",
    tools: [],
    workspaceDir: null,
    ...overrides,
  };
}

/** 记录 open 调用的替身 backend（不真正执行） */
class RecordingBackend implements RuntimeBackend {
  readonly opened: RuntimeSpec[] = [];
  private readonly fail?: Error;

  constructor(fail?: Error) {
    this.fail = fail;
  }

  // biome-ignore lint/suspicious/useAwait: 接口契约要求 Promise，同步替身无异步工作
  async open(spec: RuntimeSpec): Promise<RuntimeSession> {
    this.opened.push(spec);
    if (this.fail) {
      throw this.fail;
    }
    throw new Error("recording backend: session not expected in this test");
  }
}

// ---------------------------------------------------------------- 矩阵判定

test("requiresSandbox：执行工具开启（workspaceDir 非 null）→ 沙箱；纯对话 → in-process", () => {
  assert.equal(requiresSandbox(makeSpec()), false);
  assert.equal(requiresSandbox(makeSpec({ workspaceDir: "/tmp/ws" })), true);
});

// ------------------------------------------------------------ 分流与 fail-closed

test("RoutingRuntimeBackend：按 workspaceDir 分流到对应 backend", async () => {
  const inProcess = new RecordingBackend();
  const sandbox = new RecordingBackend();
  const routing = new RoutingRuntimeBackend({ inProcess, sandbox });

  await routing.open(makeSpec()).catch(() => undefined);
  await routing
    .open(makeSpec({ workspaceDir: "/tmp/ws" }))
    .catch(() => undefined);

  assert.equal(inProcess.opened.length, 1);
  assert.equal(inProcess.opened[0].workspaceDir, null);
  assert.equal(sandbox.opened.length, 1);
  assert.equal(sandbox.opened[0].workspaceDir, "/tmp/ws");
});

test("fail-closed：沙箱路由 open 失败原样上抛，绝不回落 in-process", async () => {
  const inProcess = new RecordingBackend();
  const sandbox = new RecordingBackend(
    new Error("docker-sandbox:run-failed:boom")
  );
  const routing = new RoutingRuntimeBackend({ inProcess, sandbox });

  await assert.rejects(
    routing.open(makeSpec({ workspaceDir: "/tmp/ws" })),
    /docker-sandbox:run-failed:boom/
  );
  assert.equal(inProcess.opened.length, 0, "不得回落 in-process");
});

// ------------------------------------------------- RunManager 逐 run 落库

class BackendRecordingRunStore implements AgentRunStore {
  readonly backends: string[] = [];

  // biome-ignore lint/suspicious/useAwait: 接口契约要求 Promise，同步替身无异步工作
  async createAgentRun(input: {
    backend: string;
    chatId: string;
    userId: string;
  }): Promise<string> {
    this.backends.push(input.backend);
    return `run-${this.backends.length}`;
  }

  // biome-ignore lint/suspicious/useAwait: 同步替身
  async acquireLease(): Promise<boolean> {
    return true;
  }

  // biome-ignore lint/suspicious/useAwait: 同步替身
  async markRunStatus(): Promise<boolean> {
    return true;
  }

  async releaseLease(): Promise<void> {
    await Promise.resolve();
  }

  async renewLeases(): Promise<void> {
    await Promise.resolve();
  }

  // biome-ignore lint/suspicious/useAwait: 同步替身
  async failStaleRuns(): Promise<number> {
    return 0;
  }

  // biome-ignore lint/suspicious/useAwait: 同步替身
  async failOrphanedRuns(): Promise<number> {
    return 0;
  }

  // biome-ignore lint/suspicious/useAwait: 同步替身
  async getActiveRunByChatId(): Promise<{ runId: string } | null> {
    return null;
  }
}

test("RunManager backendKindFor：AgentRun.backend 逐 run 落实际执行位", async () => {
  const inProcess = new RecordingBackend();
  const sandbox = new RecordingBackend();
  const routing = new RoutingRuntimeBackend({ inProcess, sandbox });
  const runStore = new BackendRecordingRunStore();
  const manager = new RunManager({
    backend: routing,
    backendKindFor: (spec) =>
      requiresSandbox(spec) ? "sandbox_rpc" : "in_process",
    eventStore: new InMemoryEventStore(),
    messageStore: {
      async upsertAssistantMessage(): Promise<void> {
        await Promise.resolve();
      },
    },
    runStore,
    workerId: "test-worker",
  });
  // RecordingBackend open 即抛「session not expected」→ start 拒绝即可，
  // 但 createAgentRun 先于 backend.open：backend 落库值已可断言
  await manager
    .start({
      prompt: { text: "纯对话", type: "prompt" },
      spec: makeSpec({ chatId: CHAT_A }),
      userId: USER,
    })
    .catch(() => undefined);
  await manager
    .start({
      prompt: { text: "带执行", type: "prompt" },
      spec: makeSpec({ chatId: CHAT_B, workspaceDir: "/tmp/ws" }),
      userId: USER,
    })
    .catch(() => undefined);

  assert.deepEqual(runStore.backends, ["in_process", "sandbox_rpc"]);
  assert.equal(inProcess.opened.length, 1);
  assert.equal(sandbox.opened.length, 1);
  assert.ok(inProcess.opened[0].runId);
  assert.ok(sandbox.opened[0].runId);
});

// ------------------------------------- 与真实 SandboxRpcBackend 的分流闭环

test("真实分流：workspace run 进 TestSandboxProvider 沙箱，纯对话不触碰 provider", {
  timeout: 60_000,
}, async () => {
  const cachedModel: RuntimeSpec["model"] = await getPiModel(
    "deepseek/deepseek-flash"
  );
  const provider = new TestSandboxProvider();
  const sandboxBackend = new SandboxRpcBackend({
    provider,
    remoteCliPath: resolveDefaultCliPath(),
  });
  const inProcess = new RecordingBackend();
  const routing = new RoutingRuntimeBackend({
    inProcess,
    sandbox: sandboxBackend,
  });

  // 纯对话：不触碰 provider（acquire 为零），路由到 in-process
  await routing.open(makeSpec({ chatId: CHAT_A })).catch(() => undefined);
  assert.equal(provider.acquiredSpecs.length, 0);
  assert.equal(inProcess.opened.length, 1);

  // 执行工具开启：沙箱真起（无 inference = deny-all 形态），pi 经 bridge
  // 就绪。workspaceDir 须为存在的宿主绝对路径（RpcClient spawn 的 cwd 派生）
  const workspaceDir = await mkdtemp(path.join(tmpdir(), "piwork-routing-"));
  const session = await routing.open(
    makeSpec({ chatId: CHAT_B, model: cachedModel, workspaceDir })
  );
  try {
    assert.equal(provider.acquiredSpecs.length, 1);
    assert.equal(provider.acquiredSpecs[0].chatId, CHAT_B);
    assert.deepEqual(provider.acquiredSpecs[0].egress, { mode: "deny-all" });
  } finally {
    await session.close("test-done");
  }
  // close → release(kill)：沙箱被回收
  const first = provider.sandbox("test-sbx-1");
  assert.ok(first);
  assert.equal(await first.handle.status(), "destroyed");
});
