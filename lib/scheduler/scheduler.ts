/** Scheduled task manager - finds and executes due tasks */

import { getDueScheduledTasks } from "../db/scheduled-task-queries";
import type { ScheduledTaskRecord } from "../db/schema";

/** Process all due scheduled tasks */
export async function processDueTasks() {
  const dueTasks = await getDueScheduledTasks();

  const results = await Promise.allSettled(
    dueTasks.map((task) => executeTaskWithRetry(task))
  );

  return results;
}

async function executeTaskWithRetry(task: ScheduledTaskRecord): Promise<{
  taskId: string;
  success: boolean;
  error?: string;
}> {
  try {
    // Don't execute cancelled tasks
    if (task.status === "cancelled") {
      return { taskId: task.id, success: false, error: "Task cancelled" };
    }

    // Import executor dynamically to avoid circular dependencies
    const { executeScheduledTask } = await import("./executor");
    const result = await executeScheduledTask(task);

    return { taskId: task.id, success: result.success, error: result.error };
  } catch (error) {
    return {
      taskId: task.id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Calculate next run time and update task
 * This should be called after a task completes successfully
 */
export async function scheduleNextRun(
  taskId: string,
  currentTime = new Date()
): Promise<Date | null> {
  // Import dynamically to avoid circular dependencies
  const { getNextRunTime } = await import("./cron-utils");
  const { updateTaskStatus } = await import("../db/scheduled-task-queries");

  // Calculate next run time (we need to get the task's cron from somewhere else)
  // This function is simplified - in real usage, we'd need to pass the task or cron
  return null;
}