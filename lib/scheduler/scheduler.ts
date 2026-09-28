import "server-only";
import {
  claimScheduledTask,
  getDueScheduledTasks,
  recoverExpiredTasks,
} from "@/lib/db/scheduled-task-queries";
import { executeScheduledTask } from "./executor";

export async function processDueTasks() {
  await recoverExpiredTasks();
  const due = await getDueScheduledTasks();
  return Promise.allSettled(
    due.map(async (task) => {
      const claimed = await claimScheduledTask(task.userId, task.id);
      return claimed
        ? executeScheduledTask(claimed)
        : { skipped: true, taskId: task.id };
    })
  );
}

const key = Symbol.for("piwork.scheduler");
const scope = globalThis as Record<
  symbol,
  { timer: ReturnType<typeof setInterval>; busy: boolean } | undefined
>;

/** MVP runs in one long-lived Node server alongside RunManager (not a separate worker). */
export function startScheduler() {
  if (scope[key]) {
    return;
  }
  const tick = async () => {
    const state = scope[key];
    if (!state || state.busy) {
      return;
    }
    state.busy = true;
    try {
      await processDueTasks();
    } catch (error) {
      console.error("[scheduler] tick failed", error);
    } finally {
      state.busy = false;
    }
  };
  const timer = setInterval(() => {
    tick().catch(console.error);
  }, 30_000);
  timer.unref();
  scope[key] = { busy: false, timer };
}
