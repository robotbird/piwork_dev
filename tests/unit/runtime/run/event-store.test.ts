import "../../../support/runtime-env";
import assert from "node:assert/strict";
import test from "node:test";
import type { RuntimeEvent } from "../../../../lib/runtime/protocol";
import {
  isPersistedRuntimeEvent,
  runtimeEventData,
} from "../../../../lib/runtime/run/event-store";
import { InMemoryEventStore } from "../../../../lib/runtime/run/in-memory-event-store";
import {
  afterSeqFilterCase,
  appendAndReplayCase,
  crossRunIsolationCase,
  duplicateSeqIgnoredCase,
  emptyRunCase,
} from "../../../support/event-store-cases";

test("InMemoryEventStore：append 后按 seq 升序重放", async () => {
  await appendAndReplayCase(new InMemoryEventStore());
});

test("InMemoryEventStore：重复 (runId, seq) 静默忽略", async () => {
  await duplicateSeqIgnoredCase(new InMemoryEventStore());
});

test("InMemoryEventStore：afterSeq 严格大于过滤", async () => {
  await afterSeqFilterCase(new InMemoryEventStore());
});

test("InMemoryEventStore：无事件 run latestSeq=0", async () => {
  await emptyRunCase(new InMemoryEventStore());
});

test("InMemoryEventStore：跨 run 隔离", async () => {
  await crossRunIsolationCase(new InMemoryEventStore());
});

test("落库白名单：仅关键事件持久化", () => {
  const persisted: RuntimeEvent[] = [
    { runId: "r", type: "run.started" },
    { reason: "completed", runId: "r", type: "run.settled" },
    { error: "boom", runId: "r", type: "run.failed" },
    { args: {}, toolCallId: "t", toolName: "n", type: "tool.started" },
    { isError: false, toolCallId: "t", toolName: "n", type: "tool.completed" },
    {
      file: { contentType: "text/plain", filename: "f", url: "/u" },
      type: "artifact.created",
    },
    { sequence: 1, type: "message.completed" },
  ];
  for (const event of persisted) {
    assert.ok(isPersistedRuntimeEvent(event), `${event.type} 应在白名单`);
  }
  const transient: RuntimeEvent[] = [
    { sequence: 1, type: "message.started" },
    {
      channel: "text",
      contentIndex: 0,
      delta: "x",
      phase: "delta",
      sequence: 1,
      type: "message.delta",
    },
    { followUp: [], steering: [], type: "queue.changed" },
    { delta: "out", type: "command.output" },
  ];
  for (const event of transient) {
    assert.ok(!isPersistedRuntimeEvent(event), `${event.type} 不应落库`);
  }
});

test("runtimeEventData：去掉 type 与 runId 冗余", () => {
  assert.deepEqual(
    runtimeEventData({ reason: "aborted", runId: "r", type: "run.settled" }),
    { reason: "aborted" }
  );
  assert.deepEqual(
    runtimeEventData({
      file: { contentType: "t", filename: "f", url: "u" },
      type: "artifact.created",
    }),
    { file: { contentType: "t", filename: "f", url: "u" } }
  );
  // 无 runId 的事件（delta 等）也能安全取负载
  assert.deepEqual(
    runtimeEventData({
      channel: "text",
      contentIndex: 0,
      phase: "start",
      sequence: 1,
      type: "message.delta",
    }),
    { channel: "text", contentIndex: 0, phase: "start", sequence: 1 }
  );
});
