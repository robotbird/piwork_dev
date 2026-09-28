import "../../support/db-env";
import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import {
  claimScheduledTask,
  createScheduledTask,
  deleteScheduledTask,
  editScheduledTask,
  finishScheduledTask,
  getScheduledTask,
  listTaskRuns,
  recoverExpiredTasks,
  setTaskEnabled,
} from "../../../lib/db/scheduled-task-queries";

const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
const owner = crypto.randomUUID();
const other = crypto.randomUUID();
const input = {
  prompt: "test prompt",
  schedule: { cron: "0 9 * * *", timezone: "Asia/Shanghai" },
  taskType: "test",
};
test.before(async () => {
  await sql`INSERT INTO "User" (id, email) VALUES (${owner}, ${`${owner}@test.local`}), (${other}, ${`${other}@test.local`})`;
});
test.after(async () => {
  await sql`DELETE FROM "User" WHERE id IN (${owner}, ${other})`;
  await sql.end();
});

test("ownership, idempotency, atomic claim, recurrence and paused completion", async () => {
  const id = crypto.randomUUID();
  const first = await createScheduledTask(owner, input, id);
  assert.ok(first);
  const second = await createScheduledTask(owner, input, id);
  assert.equal(first.id, second?.id);
  assert.equal(await getScheduledTask(other, id), undefined);
  assert.equal(await claimScheduledTask(other, id, true), null);
  assert.equal(await editScheduledTask(other, id, input), undefined);
  assert.equal(await deleteScheduledTask(other, id), false);
  await sql`UPDATE "ScheduledTask" SET "nextRunAt" = ${new Date(Date.now() - 60_000).toISOString()}::timestamp WHERE id = ${id}`;
  const claims = await Promise.all(
    Array.from({ length: 8 }, () => claimScheduledTask(owner, id))
  );
  const winners = claims.filter((item) => item !== null);
  assert.equal(winners.length, 1);
  const [claimed] = winners;
  assert.ok(claimed);
  assert.equal(await editScheduledTask(owner, id, input), undefined);
  assert.equal(await deleteScheduledTask(owner, id), false);
  assert.equal((await listTaskRuns(owner, id)).length, 1);
  assert.equal((await listTaskRuns(other, id)).length, 0);
  await finishScheduledTask(claimed, "model failure");
  const failed = await getScheduledTask(owner, id);
  assert.equal(failed?.status, "failed");
  assert.ok(failed?.nextRunAt && failed.nextRunAt > new Date());
  const next = await claimScheduledTask(owner, id, true);
  assert.ok(next);
  await setTaskEnabled(owner, id, false);
  await finishScheduledTask(next, null);
  const paused = await getScheduledTask(owner, id);
  assert.equal(paused?.enabled, false);
  assert.equal(paused?.nextRunAt, null);
  assert.equal(await claimScheduledTask(owner, id), null);
  await setTaskEnabled(owner, id, true);
  assert.ok((await getScheduledTask(owner, id))?.nextRunAt);
  assert.equal((await listTaskRuns(owner, id)).length, 2);
  assert.equal(await deleteScheduledTask(owner, id), true);
});

test("expired lease recovery fences off late completion", async () => {
  const task = await createScheduledTask(owner, input);
  assert.ok(task);
  const old = await claimScheduledTask(owner, task.id, true);
  assert.ok(old);
  await sql`UPDATE "ScheduledTask" SET "lockedUntil" = ${new Date(Date.now() - 60_000).toISOString()}::timestamp WHERE id = ${task.id}`;
  await recoverExpiredTasks();
  assert.equal((await listTaskRuns(owner, task.id))[0].status, "failed");
  const current = await claimScheduledTask(owner, task.id, true);
  assert.ok(current);
  await finishScheduledTask(old, null);
  assert.equal(
    (await getScheduledTask(owner, task.id))?.leaseToken,
    current.leaseToken
  );
  await finishScheduledTask(current, null);
  assert.equal((await getScheduledTask(owner, task.id))?.status, "succeeded");
});
