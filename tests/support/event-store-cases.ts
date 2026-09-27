import assert from "node:assert/strict";
import type {
  EventStore,
  PersistedRuntimeEvent,
} from "../../lib/runtime/run/event-store";

/**
 * EventStore 契约用例（node:test 断言）：InMemory（封闭）与 Postgres
 * （集成）两实现跑同一套（Step 1 double 模式）。只导出用例函数、不注册
 * test()，避免被 PG 测试文件 import 时重复注册 InMemory 用例。
 */

export function persistedEvent(
  runId: string,
  seq: number,
  type: string,
  data: Record<string, unknown> = {}
): PersistedRuntimeEvent {
  return { data, runId, seq, type };
}

/** 契约用例的固定 runId：PG 集成测试据此预插 AgentRun 行满足外键 */
export const CASE_RUN_IDS = {
  afterSeqFilter: "33333333-3333-4333-8333-333333333333",
  appendAndReplay: "11111111-1111-4111-8111-111111111111",
  crossRunA: "55555555-5555-4555-8555-555555555555",
  crossRunB: "66666666-6666-4666-8666-666666666666",
  duplicateSeqIgnored: "22222222-2222-4222-8222-222222222222",
  emptyRun: "44444444-4444-4444-8444-444444444444",
} as const;

/** append 后按 seq 升序全量重放 */
export async function appendAndReplayCase(store: EventStore): Promise<void> {
  const runId = CASE_RUN_IDS.appendAndReplay;
  await store.append(persistedEvent(runId, 1, "run.started", { runId }));
  await store.append(
    persistedEvent(runId, 2, "message.completed", { sequence: 1 })
  );
  await store.append(
    persistedEvent(runId, 3, "run.settled", { reason: "completed" })
  );
  const replayed = await store.replay(runId, 0);
  assert.deepEqual(
    replayed.map((event) => [event.seq, event.type]),
    [
      [1, "run.started"],
      [2, "message.completed"],
      [3, "run.settled"],
    ]
  );
  assert.deepEqual(replayed[0]?.data, { runId });
}

/** 重复 (runId, seq) 静默忽略，不抛错不重复 */
export async function duplicateSeqIgnoredCase(
  store: EventStore
): Promise<void> {
  const runId = CASE_RUN_IDS.duplicateSeqIgnored;
  await store.append(persistedEvent(runId, 1, "run.started"));
  await store.append(
    persistedEvent(runId, 1, "tool.started", { toolName: "x" })
  );
  const replayed = await store.replay(runId, 0);
  assert.equal(replayed.length, 1);
  assert.equal(replayed[0]?.type, "run.started");
  assert.equal(await store.latestSeq(runId), 1);
}

/** afterSeq 过滤：严格大于（cursor=最新 seq → 空重放） */
export async function afterSeqFilterCase(store: EventStore): Promise<void> {
  const runId = CASE_RUN_IDS.afterSeqFilter;
  for (const seq of [1, 2, 3]) {
    // biome-ignore lint/performance/noAwaitInLoops: 逐条顺序 append 贴近 RunManager 真实时序
    await store.append(
      persistedEvent(runId, seq, "message.completed", { sequence: seq })
    );
  }
  assert.deepEqual(
    (await store.replay(runId, 1)).map((event) => event.seq),
    [2, 3]
  );
  assert.deepEqual(await store.replay(runId, 3), []);
  assert.equal(await store.latestSeq(runId), 3);
}

/** 无事件 run：latestSeq=0、replay 空 */
export async function emptyRunCase(store: EventStore): Promise<void> {
  const runId = CASE_RUN_IDS.emptyRun;
  assert.equal(await store.latestSeq(runId), 0);
  assert.deepEqual(await store.replay(runId, 0), []);
}

/** 跨 run 隔离：seq 与重放互不串扰 */
export async function crossRunIsolationCase(store: EventStore): Promise<void> {
  const { crossRunA: runA, crossRunB: runB } = CASE_RUN_IDS;
  await store.append(persistedEvent(runA, 1, "run.started"));
  await store.append(
    persistedEvent(runA, 2, "run.settled", { reason: "aborted" })
  );
  await store.append(persistedEvent(runB, 1, "run.started"));
  assert.deepEqual(
    (await store.replay(runA, 0)).map((event) => event.seq),
    [1, 2]
  );
  assert.deepEqual(
    (await store.replay(runB, 0)).map((event) => event.seq),
    [1]
  );
  assert.equal(await store.latestSeq(runA), 2);
  assert.equal(await store.latestSeq(runB), 1);
}
