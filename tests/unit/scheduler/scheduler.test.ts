import assert from "node:assert/strict";
import test from "node:test";
import { createScheduledTaskTool } from "../../../lib/ai/scheduled-task-tools";
import type {
  RunHandle,
  SettleOutcome,
} from "../../../lib/runtime/run/run-manager";
import { waitForTaskCompletion } from "../../../lib/scheduler/completion";
import { getNextRunTime } from "../../../lib/scheduler/cron-utils";
import { taskInputSchema } from "../../../lib/scheduler/validation";

const input = {
  prompt: "汇总新闻",
  schedule: { cron: "0 9 * * *", timezone: "Asia/Shanghai" },
  taskType: "日报",
};
test("daily schedule respects timezone and exclusive next occurrence", () => {
  assert.equal(
    getNextRunTime("0 9 * * *", new Date("2026-09-28T00:00:00Z")).toISOString(),
    "2026-09-28T01:00:00.000Z"
  );
  assert.equal(
    getNextRunTime("0 9 * * *", new Date("2026-09-28T01:00:00Z")).toISOString(),
    "2026-09-29T01:00:00.000Z"
  );
  assert.equal(
    getNextRunTime(
      "0 9 * * 1-5",
      new Date("2026-10-02T02:00:00Z")
    ).toISOString(),
    "2026-10-05T01:00:00.000Z"
  );
  assert.equal(
    getNextRunTime(
      "0 9 * * *",
      new Date("2026-03-07T15:00:00Z"),
      "America/New_York"
    ).toISOString(),
    "2026-03-08T13:00:00.000Z"
  );
});
test("reject malformed schedules, invalid zones and untrusted identity", () => {
  for (const cron of [
    "*/0 * * * *",
    "99 9 * * *",
    "0 0 30 2 *",
    "1foo * * * *",
    "* * * * * *",
  ]) {
    assert.throws(() => getNextRunTime(cron));
  }
  assert.throws(() =>
    taskInputSchema.parse({ ...input, userId: crypto.randomUUID() })
  );
  assert.throws(() =>
    taskInputSchema.parse({
      ...input,
      schedule: { cron: "0 9 * * *", timezone: "invalid" },
    })
  );
  assert.throws(() => taskInputSchema.parse({ ...input, prompt: " " }));
});
test("Pi tool waits for persistence and propagates storage failures", async () => {
  const tool = createScheduledTaskTool((value) => {
    assert.deepEqual(value, input);
    return Promise.resolve({ id: "saved" });
  });
  const result = await tool.execute("call", input);
  assert.match(JSON.stringify(result.content), /saved/);
  const failed = createScheduledTaskTool(() =>
    Promise.reject(new Error("storage unavailable"))
  );
  await assert.rejects(failed.execute("call", input), /storage unavailable/);
});
function handle(settled: Promise<SettleOutcome>): RunHandle {
  return {
    attach: () => ({
      close: () => {
        /* No event queue in this fixture. */
      },
      events: (async function* () {
        /* Completion-only fixture. */
      })(),
      messageId: "message",
      runId: "run",
      settled,
    }),
    runId: "run",
  };
}
test("starting a run is not completion; failure and timeout are not success", async () => {
  const deferred = Promise.withResolvers<SettleOutcome>();
  let done = false;
  const waiting = waitForTaskCompletion(handle(deferred.promise)).then(() => {
    done = true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(done, false);
  deferred.resolve("settled");
  await waiting;
  assert.equal(done, true);
  await assert.rejects(
    waitForTaskCompletion(handle(Promise.resolve("failed"))),
    /失败/
  );
  await assert.rejects(
    waitForTaskCompletion(handle(Promise.resolve("aborted"))),
    /停止/
  );
  await assert.rejects(
    waitForTaskCompletion(
      handle(
        new Promise(() => {
          /* Deliberately never settles. */
        })
      ),
      10
    ),
    /超时/
  );
});
