import "server-only";
import { and, desc, eq, isNull, lte, ne, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getNextRunTime } from "@/lib/scheduler/cron-utils";
import { type TaskInput, taskInputSchema } from "@/lib/scheduler/validation";
import {
  type ScheduledTaskRecord,
  scheduledTask,
  scheduledTaskRun,
} from "./schema";

const db = drizzle(postgres(process.env.POSTGRES_URL ?? ""));
const owned = (userId: string, id: string) =>
  and(eq(scheduledTask.id, id), eq(scheduledTask.userId, userId));

export async function createScheduledTask(
  userId: string,
  input: TaskInput,
  id = crypto.randomUUID()
) {
  const value = taskInputSchema.parse(input);
  const [created] = await db
    .insert(scheduledTask)
    .values({
      ...value,
      id,
      nextRunAt: getNextRunTime(
        value.schedule.cron,
        new Date(),
        value.schedule.timezone
      ),
      userId,
    })
    .onConflictDoNothing({ target: scheduledTask.id })
    .returning();
  return created ?? (await getScheduledTask(userId, id));
}

export function listScheduledTasks(userId: string) {
  return db
    .select()
    .from(scheduledTask)
    .where(eq(scheduledTask.userId, userId))
    .orderBy(desc(scheduledTask.createdAt));
}

export async function getScheduledTask(userId: string, id: string) {
  const [task] = await db.select().from(scheduledTask).where(owned(userId, id));
  return task;
}

export function listTaskRuns(userId: string, id: string) {
  return db
    .select({
      chatId: scheduledTaskRun.chatId,
      errorMessage: scheduledTaskRun.errorMessage,
      finishedAt: scheduledTaskRun.finishedAt,
      id: scheduledTaskRun.id,
      startedAt: scheduledTaskRun.startedAt,
      status: scheduledTaskRun.status,
    })
    .from(scheduledTaskRun)
    .innerJoin(scheduledTask, eq(scheduledTaskRun.taskId, scheduledTask.id))
    .where(owned(userId, id))
    .orderBy(desc(scheduledTaskRun.startedAt))
    .limit(20);
}

export async function editScheduledTask(
  userId: string,
  id: string,
  input: TaskInput
) {
  const value = taskInputSchema.parse(input);
  const [task] = await db
    .update(scheduledTask)
    .set({
      ...value,
      nextRunAt: getNextRunTime(
        value.schedule.cron,
        new Date(),
        value.schedule.timezone
      ),
      updatedAt: new Date(),
    })
    .where(and(owned(userId, id), ne(scheduledTask.status, "running")))
    .returning();
  return task;
}

export function setTaskEnabled(userId: string, id: string, enabled: boolean) {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(scheduledTask)
      .where(owned(userId, id))
      .for("update");
    if (!current) {
      return;
    }
    const [task] = await tx
      .update(scheduledTask)
      .set({
        enabled,
        nextRunAt: enabled
          ? getNextRunTime(
              current.schedule.cron,
              new Date(),
              current.schedule.timezone
            )
          : null,
        updatedAt: new Date(),
      })
      .where(owned(userId, id))
      .returning();
    return task;
  });
}

export async function deleteScheduledTask(userId: string, id: string) {
  const rows = await db
    .delete(scheduledTask)
    .where(and(owned(userId, id), ne(scheduledTask.status, "running")))
    .returning({ id: scheduledTask.id });
  return rows.length > 0;
}

// Atomic conditional update + run ledger in one transaction. No read-then-write claim race.
export function claimScheduledTask(
  userId: string,
  id: string,
  manual = false,
  now = new Date()
) {
  return db.transaction(async (tx) => {
    const token = crypto.randomUUID();
    const [task] = await tx
      .update(scheduledTask)
      .set({
        errorMessage: null,
        lastRunAt: now,
        leaseToken: token,
        lockedUntil: new Date(now.getTime() + 10 * 60_000),
        status: "running",
        updatedAt: now,
      })
      .where(
        and(
          owned(userId, id),
          ne(scheduledTask.status, "running"),
          manual
            ? undefined
            : and(
                eq(scheduledTask.enabled, true),
                lte(scheduledTask.nextRunAt, now)
              )
        )
      )
      .returning();
    if (!task) {
      return null;
    }
    await tx.insert(scheduledTaskRun).values({
      id: token,
      startedAt: now,
      status: "running",
      taskId: task.id,
    });
    return task;
  });
}

export function linkTaskChat(task: ScheduledTaskRecord, chatId: string) {
  const { leaseToken } = task;
  if (!leaseToken) {
    throw new Error("Missing lease");
  }
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(scheduledTask)
      .set({ chatId })
      .where(
        and(
          eq(scheduledTask.id, task.id),
          eq(scheduledTask.leaseToken, leaseToken)
        )
      )
      .returning();
    if (!rows.length) {
      throw new Error("任务执行租约已失效");
    }
    await tx
      .update(scheduledTaskRun)
      .set({ chatId })
      .where(eq(scheduledTaskRun.id, leaseToken));
  });
}

export function finishScheduledTask(
  task: ScheduledTaskRecord,
  failure: string | null
) {
  let errorMessage = failure;
  const { leaseToken } = task;
  if (!leaseToken) {
    throw new Error("Missing lease");
  }
  const now = new Date();
  let nextRunAt: Date | null = null;
  try {
    nextRunAt = getNextRunTime(task.schedule.cron, now, task.schedule.timezone);
  } catch {
    errorMessage ??= "无效计划，请编辑后重新启用";
  }
  const status = errorMessage ? ("failed" as const) : ("succeeded" as const);
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(scheduledTask)
      .where(
        and(
          eq(scheduledTask.id, task.id),
          eq(scheduledTask.leaseToken, leaseToken)
        )
      )
      .for("update");
    if (!current) {
      return;
    }
    await tx
      .update(scheduledTask)
      .set({
        enabled: current.enabled && nextRunAt !== null,
        errorMessage,
        lastResult: errorMessage ? null : "执行完成，点击查看结果",
        leaseToken: null,
        lockedUntil: null,
        nextRunAt: current.enabled ? nextRunAt : null,
        status,
        updatedAt: now,
      })
      .where(eq(scheduledTask.id, task.id));
    await tx
      .update(scheduledTaskRun)
      .set({ errorMessage, finishedAt: now, status })
      .where(eq(scheduledTaskRun.id, leaseToken));
  });
}

export function recoverExpiredTasks(now = new Date()) {
  return db.transaction(async (tx) => {
    const tasks = await tx
      .update(scheduledTask)
      .set({
        errorMessage: "执行进程中断或超时，可重新运行",
        leaseToken: null,
        lockedUntil: null,
        status: "failed",
        updatedAt: now,
      })
      .where(
        and(
          eq(scheduledTask.status, "running"),
          or(
            isNull(scheduledTask.lockedUntil),
            lte(scheduledTask.lockedUntil, now)
          )
        )
      )
      .returning({ id: scheduledTask.id });
    for (const task of tasks) {
      // biome-ignore lint/performance/noAwaitInLoops: transactional updates share one connection
      await tx
        .update(scheduledTaskRun)
        .set({
          errorMessage: "执行进程中断或超时",
          finishedAt: now,
          status: "failed",
        })
        .where(
          and(
            eq(scheduledTaskRun.taskId, task.id),
            eq(scheduledTaskRun.status, "running")
          )
        );
    }
    return tasks.length;
  });
}

export function getDueScheduledTasks(now = new Date()) {
  return db
    .select()
    .from(scheduledTask)
    .where(
      and(
        eq(scheduledTask.enabled, true),
        ne(scheduledTask.status, "running"),
        lte(scheduledTask.nextRunAt, now)
      )
    )
    .orderBy(scheduledTask.nextRunAt)
    .limit(3);
}
