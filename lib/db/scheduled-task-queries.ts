import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { ChatbotError } from "../errors";
import { scheduledTask, type ScheduledTaskRecord } from "./schema";

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

async function wrapDatabase<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

/** 创建定时任务 */
export async function createScheduledTask(
  record: Omit<ScheduledTaskRecord, "id" | "createdAt" | "updatedAt">
) {
  return wrapDatabase(async () => {
    const now = new Date();
    const [created] = await db
      .insert(scheduledTask)
      .values({
        ...record,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return created;
  });
}

/** 获取用户的任务列表 */
export async function listScheduledTasks(userId: string) {
  return wrapDatabase(async () => {
    return await db
      .select()
      .from(scheduledTask)
      .where(eq(scheduledTask.userId, userId))
      .orderBy(desc(scheduledTask.createdAt));
  });
}

/** 获取单个任务 */
export async function getScheduledTask(userId: string, id: string) {
  return wrapDatabase(async () => {
    const [task] = await db
      .select()
      .from(scheduledTask)
      .where(and(eq(scheduledTask.id, id), eq(scheduledTask.userId, userId)));
    return task;
  });
}

/** 获取需要运行的任务（nextRunAt <= now） */
export async function getDueScheduledTasks() {
  return wrapDatabase(async () => {
    const now = new Date();
    return await db
      .select()
      .from(scheduledTask)
      .where(
        and(
          eq(scheduledTask.status, "pending"),
          sql`${scheduledTask.nextRunAt} <= ${now}`
        )
      );
  });
}

/** 更新任务状态 */
export async function updateTaskStatus(
  taskId: string,
  updates: Partial<{
    status: ScheduledTaskRecord["status"];
    lastRunAt: Date;
    nextRunAt: Date;
    lastResult: string;
    errorMessage: string;
    chatId: string | null;
  }>
) {
  return wrapDatabase(async () => {
    const [updated] = await db
      .update(scheduledTask)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(scheduledTask.id, taskId))
      .returning();
    return updated;
  });
}

/** 更新任务最后结果 */
export async function updateTaskResult(
  taskId: string,
  result: string,
  status: "succeeded" | "failed",
  errorMessage?: string
) {
  return wrapDatabase(async () => {
    const [updated] = await db
      .update(scheduledTask)
      .set({
        lastRunAt: new Date(),
        lastResult: result,
        errorMessage: errorMessage || null,
        status: status,
        updatedAt: new Date(),
      })
      .where(eq(scheduledTask.id, taskId))
      .returning();
    return updated;
  });
}

/** 删除任务 */
export async function deleteScheduledTask(userId: string, id: string) {
  return wrapDatabase(async () => {
    await db
      .delete(scheduledTask)
      .where(and(eq(scheduledTask.id, id), eq(scheduledTask.userId, userId)));
  });
}

/** 取消任务 */
export async function cancelScheduledTask(userId: string, id: string) {
  return wrapDatabase(async () => {
    const [updated] = await db
      .update(scheduledTask)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(and(eq(scheduledTask.id, id), eq(scheduledTask.userId, userId)))
      .returning();
    return updated;
  });
}
