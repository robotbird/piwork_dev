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
const scope = globalThis as Record<symbol, SchedulerLoop | undefined>;

export type SchedulerLoop = {
  stop: () => void;
};

/**
 * Own one polling lifecycle. The callback is injected so the timing and
 * re-entry guarantees can be verified without touching a database.
 */
export function createSchedulerLoop(
  run: () => Promise<unknown>,
  intervalMs = 30_000
): SchedulerLoop {
  let busy = false;
  let stopped = false;
  const tick = async () => {
    if (busy || stopped) {
      return;
    }
    busy = true;
    try {
      await run();
    } catch (error) {
      console.error("[scheduler] tick failed", error);
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => {
    tick().catch(console.error);
  }, intervalMs);
  timer.unref();
  // Scan once at startup; otherwise a freshly restarted host leaves already
  // due work idle for a full interval.
  tick().catch(console.error);
  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
  };
}

/** MVP runs in one long-lived Node server alongside RunManager (not a separate worker). */
export function startScheduler() {
  if (scope[key]) {
    return;
  }
  scope[key] = createSchedulerLoop(processDueTasks);
}
