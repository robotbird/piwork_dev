/** Task executor - runs AI tasks for scheduled tasks */

import { saveChat } from "@/lib/db/queries";
import { getRunManager } from "@/lib/runtime/run/index";
import type { ScheduledTaskRecord } from "@/lib/db/schema";
import { getNextRunTime } from "./cron-utils";
import { updateTaskResult, updateTaskStatus } from "../db/scheduled-task-queries";

/**
 * Execute a scheduled task by creating a chat and running the AI prompt
 */
export async function executeScheduledTask(task: ScheduledTaskRecord) {
  try {
    // Update status to running
    await updateTaskStatus(task.id, {
      status: "running",
    });

    // Create a new chat for this task execution
    const chat = await saveChat({
      id: generateUUID(),
      title: `[任务] ${task.taskType}`,
      userId: task.userId,
      visibility: "private",
    });

    // Update task with chatId
    await updateTaskStatus(task.id, {
      chatId: chat.id,
    });

    // Start the AI run
    const runManager = getRunManager();

    // This will execute the prompt in the background
    const runPromise = runManager.start({
      prompt: { type: "prompt", text: task.prompt },
      spec: {
        chatId: chat.id,
        model: "anthropic:claude-sonnet-4-20250514",
        stream: true,
      },
      userId: task.userId,
    });

    // Wait for completion (with timeout)
    const result = await Promise.race([
      runPromise,
      timeoutPromise(300000, "Task execution timeout"), // 5 minute timeout
    ]);

    // Calculate next run time
    const schedule = task.schedule as { cron: string; timezone?: string };
    const nextRunAt = getNextRunTime(schedule.cron, new Date());

    // Update task status to succeeded and set next run time
    await updateTaskStatus(task.id, {
      status: "succeeded",
      lastRunAt: new Date(),
      nextRunAt: nextRunAt || undefined,
      lastResult: JSON.stringify({ success: true, runId: result?.runId }),
    });

    return { success: true, runId: result?.runId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Update task status to failed
    await updateTaskResult(task.id, "", "failed", errorMessage);

    return { success: false, error: errorMessage };
  }
}

function generateUUID(): string {
  return crypto.randomUUID();
}

function timeoutPromise(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}
