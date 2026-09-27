import "../../../support/runtime-env";
import assert from "node:assert/strict";
import test from "node:test";
import type { RuntimeEvent } from "../../../../lib/runtime/protocol";
import { RunEventLog } from "../../../../lib/runtime/run/event-log";

const started: RuntimeEvent = { runId: "r1", type: "run.started" };
const deltaA: RuntimeEvent = {
  channel: "text",
  contentIndex: 0,
  delta: "你",
  phase: "delta",
  sequence: 1,
  type: "message.delta",
};

test("RunEventLog：index 连续全序，seq 仅持久事件携带", () => {
  const log = new RunEventLog();
  assert.equal(log.append({ event: started, seq: 1 }).index, 0);
  assert.equal(log.append({ event: deltaA }).index, 1);
  assert.equal(
    log.append({ event: { sequence: 1, type: "message.completed" }, seq: 2 })
      .index,
    2
  );
  assert.equal(log.length, 3);
  const snapshot = log.slice(0, 3);
  assert.deepEqual(
    snapshot.map((entry) => [entry.index, entry.seq, entry.event.type]),
    [
      [0, 1, "run.started"],
      [1, undefined, "message.delta"],
      [2, 2, "message.completed"],
    ]
  );
});

test("RunEventLog：slice 半开区间且返回条目副本（改副本不影响日志）", () => {
  const log = new RunEventLog();
  log.append({ event: started, seq: 1 });
  log.append({ event: deltaA });
  log.append({ event: { sequence: 1, type: "message.completed" }, seq: 2 });

  const middle = log.slice(1, 3);
  assert.deepEqual(
    middle.map((item) => item.index),
    [1, 2]
  );
  assert.deepEqual(
    log.slice(2, 99).map((item) => item.index),
    [2]
  );
  assert.deepEqual(log.slice(5, 9), []);

  const [entry] = log.slice(0, 1);
  entry.event = { error: "tampered", runId: "tampered", type: "run.failed" };
  assert.equal(log.slice(0, 1).at(0)?.event.type, "run.started");
});
