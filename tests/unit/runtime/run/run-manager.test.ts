import "../../../support/runtime-env";
import assert from "node:assert/strict";
import test from "node:test";
import { ChatbotError } from "@/lib/errors";
import type { RuntimeSpec } from "../../../../lib/runtime/protocol";
import type { LoggedRuntimeEvent } from "../../../../lib/runtime/run/event-log";
import type { EventStore } from "../../../../lib/runtime/run/event-store";
import { InMemoryEventStore } from "../../../../lib/runtime/run/in-memory-event-store";
import { deriveMessageId } from "../../../../lib/runtime/run/message-builder";
import {
  type AgentRunStatus,
  type AgentRunStore,
  type AssistantMessageStore,
  RunManager,
  type RunManagerOptions,
  type RunSubscription,
} from "../../../../lib/runtime/run/run-manager";
import {
  InMemoryBackend,
  type InMemoryScriptStep,
} from "../../../support/in-memory-backend";

/**
 * RunManager 封闭测试：InMemoryBackend（脚本时序）+ InMemoryEventStore +
 * 录制型 run/message store 替身，验证 seq 分配、先落库后广播、attach 原子性、
 * 终态一次性 upsert 与状态机（§2.9a）。
 */

const CHAT = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-000000000002";

const NON_TERMINAL: readonly AgentRunStatus[] = [
  "queued",
  "starting",
  "running",
  "waiting_user",
];
const TERMINAL: readonly AgentRunStatus[] = ["settled", "failed", "aborted"];

type StatusRecord = {
  allowedFrom?: readonly AgentRunStatus[];
  errorMessage?: string;
  runId: string;
  status: AgentRunStatus;
};

class RecordingRunStore implements AgentRunStore {
  readonly history: StatusRecord[] = [];
  readonly renewed: Array<{ runIds: string[]; workerId: string }> = [];
  private readonly runs = new Map<
    string,
    { chatId: string; status: AgentRunStatus }
  >();
  private readonly leases = new Map<string, string>();
  private readonly seededActive = new Map<string, string>();

  /** 手动播种"他进程活跃 run"（DB 冲突路径） */
  seedActiveRun(chatId: string, runId: string): void {
    this.seededActive.set(chatId, runId);
  }

  statusOf(runId: string): AgentRunStatus | undefined {
    return this.runs.get(runId)?.status;
  }

  // biome-ignore lint/suspicious/useAwait: 接口契约要求 Promise，同步测试替身无异步工作
  async createAgentRun(input: {
    backend: string;
    chatId: string;
    userId: string;
  }): Promise<string> {
    const id = globalThis.crypto.randomUUID();
    this.runs.set(id, { chatId: input.chatId, status: "queued" });
    return id;
  }

  // biome-ignore lint/suspicious/useAwait: 接口契约要求 Promise，同步测试替身无异步工作
  async markRunStatus(
    runId: string,
    status: AgentRunStatus,
    options?: {
      allowedFrom?: readonly AgentRunStatus[];
      errorMessage?: string;
    }
  ): Promise<boolean> {
    const run = this.runs.get(runId);
    if (!run) {
      return false;
    }
    if (options?.allowedFrom && !options.allowedFrom.includes(run.status)) {
      return false;
    }
    run.status = status;
    this.history.push({
      allowedFrom: options?.allowedFrom,
      errorMessage: options?.errorMessage,
      runId,
      status,
    });
    return true;
  }

  // biome-ignore lint/suspicious/useAwait: 接口契约要求 Promise，同步测试替身无异步工作
  async getActiveRunByChatId(
    chatId: string
  ): Promise<{ runId: string } | null> {
    const seeded = this.seededActive.get(chatId);
    if (seeded) {
      return { runId: seeded };
    }
    let found: string | null = null;
    for (const [id, run] of this.runs) {
      if (run.chatId === chatId && NON_TERMINAL.includes(run.status)) {
        found = id;
      }
    }
    return found === null ? null : { runId: found };
  }

  // biome-ignore lint/suspicious/useAwait: 接口契约要求 Promise，同步测试替身无异步工作
  async acquireLease(runId: string, workerId: string): Promise<boolean> {
    if (this.leases.has(runId)) {
      return false;
    }
    this.leases.set(runId, workerId);
    return true;
  }

  // biome-ignore lint/suspicious/useAwait: 接口契约要求 Promise，同步测试替身无异步工作
  async renewLeases(
    workerId: string,
    runIds: readonly string[]
  ): Promise<void> {
    this.renewed.push({ runIds: [...runIds], workerId });
  }

  // biome-ignore lint/suspicious/useAwait: 接口契约要求 Promise，同步测试替身无异步工作
  async releaseLease(runId: string): Promise<void> {
    this.leases.delete(runId);
  }

  // biome-ignore lint/suspicious/useAwait: 测试替身无心跳概念，stale 路径由 PG 集成测试覆盖
  async failStaleRuns(_heartbeatTimeoutMs: number): Promise<number> {
    return 0;
  }

  // biome-ignore lint/suspicious/useAwait: 接口契约要求 Promise，同步测试替身无异步工作
  async failOrphanedRuns(excludeRunIds: readonly string[]): Promise<number> {
    let count = 0;
    for (const [id, run] of this.runs) {
      if (!TERMINAL.includes(run.status) && !excludeRunIds.includes(id)) {
        run.status = "failed";
        this.history.push({ runId: id, status: "failed" });
        count += 1;
      }
    }
    return count;
  }
}

class RecordingMessageStore implements AssistantMessageStore {
  readonly upserts: Array<{ chatId: string; id: string; parts: unknown[] }> =
    [];

  // biome-ignore lint/suspicious/useAwait: 接口契约要求 Promise，同步测试替身无异步工作
  async upsertAssistantMessage(input: {
    chatId: string;
    id: string;
    parts: unknown[];
  }): Promise<void> {
    this.upserts.push({ ...input, parts: [...input.parts] });
  }
}

type Fixture = {
  eventStore: InMemoryEventStore;
  manager: RunManager;
  messageStore: RecordingMessageStore;
  runStore: RecordingRunStore;
  setSteps: (steps: InMemoryScriptStep[]) => void;
};

function makeFixture(
  options?: Partial<Pick<RunManagerOptions, "terminalTtlMs">>
): Fixture {
  let steps: InMemoryScriptStep[] = [];
  const backend = new InMemoryBackend({ onPrompt: () => steps });
  const eventStore = new InMemoryEventStore();
  const runStore = new RecordingRunStore();
  const messageStore = new RecordingMessageStore();
  const manager = new RunManager({
    backend,
    eventStore,
    heartbeatIntervalMs: 3_600_000,
    messageStore,
    runStore,
    terminalTtlMs: options?.terminalTtlMs ?? 3_600_000,
    workerId: "test-worker",
  });
  return {
    eventStore,
    manager,
    messageStore,
    runStore,
    setSteps: (next) => {
      steps = next;
    },
  };
}

function spec(chatId = CHAT): RuntimeSpec {
  return {
    appendSystemPrompt: [],
    chatId,
    historyMessages: [],
    model: null as unknown as RuntimeSpec["model"],
    systemPrompt: "",
    tools: [],
    workspaceDir: null,
  };
}

/** 一段完整 text 流（sequence 1） */
function textSteps(text: string, sequence = 1): InMemoryScriptStep[] {
  return [
    { event: { sequence, type: "message.started" } },
    {
      event: {
        channel: "text",
        contentIndex: 0,
        phase: "start",
        sequence,
        type: "message.delta",
      },
    },
    {
      event: {
        channel: "text",
        contentIndex: 0,
        delta: text,
        phase: "delta",
        sequence,
        type: "message.delta",
      },
    },
    {
      event: {
        channel: "text",
        contentIndex: 0,
        phase: "end",
        sequence,
        type: "message.delta",
      },
    },
    { event: { sequence, type: "message.completed" } },
  ];
}

async function startRun(
  fixture: Fixture,
  options?: {
    baseAssistantMessageId?: string;
    baseParts?: unknown[];
    chatId?: string;
  }
): Promise<{
  attach: RunSubscription;
  runId: string;
  settled: RunSubscription["settled"];
}> {
  const handle = await fixture.manager.start({
    baseAssistantMessageId: options?.baseAssistantMessageId,
    baseParts: options?.baseParts,
    prompt: { text: "你好", type: "prompt" },
    spec: spec(options?.chatId),
    userId: USER,
  });
  const subscription = handle.attach();
  assert.ok(subscription, "start 后应能立即 attach");
  return {
    attach: subscription,
    runId: handle.runId,
    settled: subscription.settled,
  };
}

async function collectAll(
  subscription: RunSubscription
): Promise<LoggedRuntimeEvent[]> {
  const entries: LoggedRuntimeEvent[] = [];
  for await (const entry of subscription.events) {
    entries.push(entry);
  }
  return entries;
}

async function until(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 2000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  // biome-ignore lint/performance/noAwaitInLoops: 轮询等待即语义本身，串行 await 是必需的
  while (!(await predicate())) {
    if (Date.now() > deadline) {
      throw new Error("until: 条件等待超时");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

test("seq 单调且仅持久事件携带；状态机经 running → settled，无 waiting_user", async () => {
  const fixture = makeFixture();
  fixture.setSteps(textSteps("你好，世界"));
  const run = await startRun(fixture);

  const entries = await collectAll(run.attach);
  assert.deepEqual(
    entries.map((entry) => [entry.event.type, entry.seq ?? null]),
    [
      ["run.started", 1],
      ["message.started", null],
      ["message.delta", null],
      ["message.delta", null],
      ["message.delta", null],
      ["message.completed", 2],
      ["run.settled", 3],
    ]
  );
  assert.equal(await run.settled, "settled");
  assert.equal(fixture.runStore.statusOf(run.runId), "settled");

  const statuses = fixture.runStore.history
    .filter((record) => record.runId === run.runId)
    .map((record) => record.status);
  assert.deepEqual(statuses, ["running", "settled"]);
  for (const record of fixture.runStore.history) {
    assert.notEqual(record.status, "waiting_user");
  }
});

test("先落库后广播：每个 seq 的 append 先于订阅方收到", async () => {
  const fixture = makeFixture();
  fixture.setSteps(textSteps("顺序"));
  const inner = fixture.eventStore;
  const order: string[] = [];
  const trackedStore: EventStore = {
    append: async (event) => {
      order.push(`append:${event.seq}`);
      await inner.append(event);
    },
    latestSeq: (runId) => inner.latestSeq(runId),
    replay: (runId, afterSeq) => inner.replay(runId, afterSeq),
  };
  const manager = new RunManager({
    backend: new InMemoryBackend({ onPrompt: () => textSteps("顺序") }),
    eventStore: trackedStore,
    heartbeatIntervalMs: 3_600_000,
    messageStore: fixture.messageStore,
    runStore: fixture.runStore,
    workerId: "test-worker",
  });
  const handle = await manager.start({
    prompt: { text: "你好", type: "prompt" },
    spec: spec(),
    userId: USER,
  });
  const subscription = handle.attach();
  assert.ok(subscription);
  const consumer = (async () => {
    for await (const entry of subscription.events) {
      order.push(`recv:${entry.seq ?? "-"}`);
    }
  })();
  await subscription.settled;
  await consumer;

  for (const seq of [1, 2, 3]) {
    assert.ok(
      order.indexOf(`append:${seq}`) < order.indexOf(`recv:${seq}`),
      `seq ${seq} 应先 append 后 recv，实际 ${order.join(" ")}`
    );
  }
});

test("多订阅者：中途 attach 与首订各自拿到完整一致的事件流", async () => {
  const fixture = makeFixture();
  fixture.setSteps([
    ...textSteps("第一段"),
    { delayMs: 300, event: { sequence: 2, type: "message.started" } },
    {
      delayMs: 0,
      event: {
        channel: "text",
        contentIndex: 0,
        phase: "start",
        sequence: 2,
        type: "message.delta",
      },
    },
  ]);
  const run = await startRun(fixture);
  await until(async () => (await fixture.eventStore.latestSeq(run.runId)) >= 2);
  const late = fixture.manager.attach(CHAT);
  assert.ok(late);

  const [first, second] = await Promise.all([
    collectAll(run.attach),
    collectAll(late),
  ]);
  const project = (entries: LoggedRuntimeEvent[]) =>
    entries.map((entry) => [entry.event.type, entry.seq ?? null]);
  assert.deepEqual(project(second), project(first));
  // 首订视角的完整序列（快照 + tail 原子衔接，不丢不重）
  assert.deepEqual(project(first), [
    ["run.started", 1],
    ["message.started", null],
    ["message.delta", null],
    ["message.delta", null],
    ["message.delta", null],
    ["message.completed", 2],
    ["message.started", null],
    ["message.delta", null],
    ["run.settled", 3],
  ]);
  // index 连续：attach 原子性的直接证据
  assert.deepEqual(
    second.map((entry) => entry.index),
    second.map((_entry, i) => i)
  );
});

test("abort：settled(reason=aborted) → 状态 aborted，部分文本以 streaming 态落库", async () => {
  const fixture = makeFixture();
  fixture.setSteps([
    { event: { sequence: 1, type: "message.started" } },
    {
      event: {
        channel: "text",
        contentIndex: 0,
        phase: "start",
        sequence: 1,
        type: "message.delta",
      },
    },
    {
      event: {
        channel: "text",
        contentIndex: 0,
        delta: "部分",
        phase: "delta",
        sequence: 1,
        type: "message.delta",
      },
    },
    // 长尾：收到部分增量后 abort，后续不再产生
    { delayMs: 10_000, event: { sequence: 1, type: "message.completed" } },
  ]);
  const run = await startRun(fixture);

  const abortAfterDelta = (async () => {
    for await (const entry of run.attach.events) {
      if (
        entry.event.type === "message.delta" &&
        entry.event.phase === "delta"
      ) {
        assert.equal(await fixture.manager.abortByChat(CHAT, "stale-sandbox-run"), false);
        assert.equal(await fixture.manager.abortByChat(CHAT, run.runId), true);
      }
    }
  })();
  await abortAfterDelta;
  assert.equal(await run.settled, "aborted");
  assert.equal(fixture.runStore.statusOf(run.runId), "aborted");

  assert.equal(fixture.messageStore.upserts.length, 1);
  const [upsert] = fixture.messageStore.upserts;
  assert.equal(upsert?.id, deriveMessageId(run.runId));
  // 未收到 end 相位 ⇒ state 保持 streaming
  assert.deepEqual(upsert?.parts, [
    { state: "streaming", text: "部分", type: "text" },
  ]);
  // abort 后再次 abort / 无活跃 run → false（幂等）
  assert.equal(await fixture.manager.abortByChat(CHAT), false);
});

test("失败：run.failed 仍 upsert 已完成的部分消息，状态 failed 带错误", async () => {
  const fixture = makeFixture();
  fixture.setSteps([
    ...textSteps("部分完成"),
    { event: { error: "boom", runId: "", type: "run.failed" } },
  ]);
  const run = await startRun(fixture);

  await collectAll(run.attach);
  assert.equal(await run.settled, "failed");
  assert.equal(fixture.runStore.statusOf(run.runId), "failed");
  const record = fixture.runStore.history.at(-1);
  assert.equal(record?.errorMessage, "boom");

  assert.equal(fixture.messageStore.upserts.length, 1);
  assert.deepEqual(fixture.messageStore.upserts[0]?.parts, [
    { state: "done", text: "部分完成", type: "text" },
  ]);
});

test("终态幂等：单 run 恰好一次 upsert，id 为 deriveMessageId(runId)", async () => {
  const fixture = makeFixture();
  fixture.setSteps(textSteps("内容"));
  const run = await startRun(fixture);
  await collectAll(run.attach);
  await run.settled;
  assert.equal(fixture.messageStore.upserts.length, 1);
  assert.equal(fixture.messageStore.upserts[0]?.id, deriveMessageId(run.runId));
  // 事件与终态均已持久化（(runId, seq) 连续 1..3）
  assert.deepEqual(
    (await fixture.eventStore.replay(run.runId, 0)).map((event) => [
      event.seq,
      event.type,
    ]),
    [
      [1, "run.started"],
      [2, "message.completed"],
      [3, "run.settled"],
    ]
  );
});

test("审批续跑：baseParts 前置合并且沿用 baseAssistantMessageId", async () => {
  const fixture = makeFixture();
  fixture.setSteps(textSteps("新内容"));
  const baseId = "00000000-0000-4000-8000-0000000000ff";
  const run = await startRun(fixture, {
    baseAssistantMessageId: baseId,
    baseParts: [{ state: "done", text: "旧内容", type: "text" }],
  });
  await collectAll(run.attach);

  const [upsert] = fixture.messageStore.upserts;
  assert.equal(upsert?.id, baseId);
  assert.deepEqual(upsert?.parts, [
    { state: "done", text: "旧内容", type: "text" },
    { state: "done", text: "新内容", type: "text" },
  ]);
});

test("cursor=最新 seq：重放为空，仅收到其后的 tail", async () => {
  const fixture = makeFixture();
  fixture.setSteps([
    ...textSteps("第一段"),
    { delayMs: 400, event: { sequence: 2, type: "message.started" } },
    {
      delayMs: 0,
      event: {
        channel: "text",
        contentIndex: 0,
        phase: "start",
        sequence: 2,
        type: "message.delta",
      },
    },
    {
      delayMs: 0,
      event: {
        channel: "text",
        contentIndex: 0,
        delta: "尾巴",
        phase: "delta",
        sequence: 2,
        type: "message.delta",
      },
    },
  ]);
  const run = await startRun(fixture);
  await until(async () => (await fixture.eventStore.latestSeq(run.runId)) >= 2);

  const subscription = fixture.manager.attach(CHAT, { cursor: 2 });
  assert.ok(subscription);
  const entries = await collectAll(subscription);
  assert.deepEqual(
    entries.map((entry) => [entry.event.type, entry.seq ?? null]),
    [
      ["message.started", null],
      ["message.delta", null],
      ["message.delta", null],
      ["run.settled", 3],
    ]
  );
});

test("旧 run 的 cursor：runId 不符按无 cursor 全量重放", async () => {
  const fixture = makeFixture();
  fixture.setSteps([
    ...textSteps("第一段"),
    { delayMs: 10_000, event: { sequence: 2, type: "message.started" } },
  ]);
  const run = await startRun(fixture);
  await until(async () => (await fixture.eventStore.latestSeq(run.runId)) >= 2);

  const subscription = fixture.manager.attach(CHAT, {
    cursor: 99,
    runId: "00000000-0000-4000-8000-0000000000ee",
  });
  assert.ok(subscription);
  const entries: LoggedRuntimeEvent[] = [];
  const consumer = (async () => {
    for await (const entry of subscription.events) {
      entries.push(entry);
    }
  })();
  // 快照部分立即可见：首条为 run.started(seq 1)
  await until(() => entries.length > 0);
  assert.equal(entries[0]?.event.type, "run.started");
  assert.equal(entries[0]?.seq, 1);
  await fixture.manager.abortByChat(CHAT);
  await consumer;
});

test("同 chat 二次 start 拒绝（conflict:chat）；DB 侧活跃 run 同样拒绝", async () => {
  const fixture = makeFixture();
  fixture.setSteps([
    ...textSteps("长跑"),
    { delayMs: 10_000, event: { sequence: 2, type: "message.started" } },
  ]);
  const run = await startRun(fixture);
  await until(async () => (await fixture.eventStore.latestSeq(run.runId)) >= 2);

  await assert.rejects(
    fixture.manager.start({
      prompt: { text: "再来", type: "prompt" },
      spec: spec(),
      userId: USER,
    }),
    (error: unknown) =>
      error instanceof ChatbotError &&
      error.type === "conflict" &&
      error.surface === "chat"
  );
  await fixture.manager.abortByChat(CHAT);

  // 他进程活跃 run（DB 冲突路径）
  fixture.runStore.seedActiveRun(CHAT, "00000000-0000-4000-8000-0000000000dd");
  await assert.rejects(
    fixture.manager.start({
      prompt: { text: "再来", type: "prompt" },
      spec: spec(),
      userId: USER,
    }),
    (error: unknown) => error instanceof ChatbotError
  );
});

test("终态后 TTL 内 attach：快照含终态且迭代立即结束；TTL 过后 null", async () => {
  const fixture = makeFixture({ terminalTtlMs: 50 });
  fixture.setSteps(textSteps("收尾"));
  const run = await startRun(fixture);
  await run.settled;

  const late = fixture.manager.attach(CHAT);
  assert.ok(late, "TTL 窗口内应可 attach");
  const entries = await collectAll(late);
  assert.equal(entries.at(-1)?.event.type, "run.settled");

  await until(() => fixture.manager.attach(CHAT) === null, 1000);
  assert.equal(fixture.manager.attach(CHAT), null);
});

test("无 LiveRun：attach 返回 null（GET 走 204 路径）", () => {
  const fixture = makeFixture();
  assert.equal(fixture.manager.attach(CHAT), null);
  assert.equal(fixture.manager.getActiveRun(CHAT), null);
});
