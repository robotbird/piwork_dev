import "server-only";

import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { ChatbotError } from "../errors";
import type { RuntimeBackendKind } from "../runtime/protocol";
import type { AgentRunStatus, AgentRunStore } from "../runtime/run/run-manager";
import { agentRun, runtimeLease } from "./schema";

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

const NON_TERMINAL_STATUSES: AgentRunStatus[] = [
  "queued",
  "starting",
  "running",
  "waiting_user",
];

const TERMINAL_STATUSES: AgentRunStatus[] = ["settled", "failed", "aborted"];

/**
 * AgentRun + RuntimeLease 读写（v2.0 §8.2，RunManager 的持久化端口实现）。
 * markRunStatus 用 allowedFrom 条件更新防状态回退；lease 支撑心跳与 stale
 * 检测（多进程语义）；单进程孤儿由 failOrphanedRuns 即时收敛。
 *
 * 时间戳一律经 SQL now() 写入与比较（不用 JS Date 参数）：drizzle 会把
 * Date 序列化为 UTC 无时区文本，与 defaultNow() 的会话本地时间相差时区偏移
 * （Asia/Shanghai 下 -8h），混用会让 stale 判定永久失真。
 */

export async function createAgentRun(input: {
  backend: RuntimeBackendKind;
  chatId: string;
  userId: string;
}): Promise<string> {
  try {
    const [row] = await db
      .insert(agentRun)
      .values({
        backend: input.backend,
        chatId: input.chatId,
        userId: input.userId,
      })
      .returning({ id: agentRun.id });
    return row.id;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function markRunStatus(
  runId: string,
  status: AgentRunStatus,
  options?: {
    allowedFrom?: readonly AgentRunStatus[];
    errorMessage?: string;
  }
): Promise<boolean> {
  try {
    const conditions = [eq(agentRun.id, runId)];
    if (options?.allowedFrom) {
      conditions.push(inArray(agentRun.status, [...options.allowedFrom]));
    }
    const rows = await db
      .update(agentRun)
      .set({
        ...(TERMINAL_STATUSES.includes(status) ? { endedAt: sql`now()` } : {}),
        ...(options?.errorMessage === undefined
          ? {}
          : { errorMessage: options.errorMessage }),
        status,
        updatedAt: sql`now()`,
        // 首次进入 running 记录起点；waiting_user → running 续跑不覆盖
        ...(status === "running"
          ? { startedAt: sql`coalesce(${agentRun.startedAt}, now())` }
          : {}),
      })
      .where(and(...conditions))
      .returning({ id: agentRun.id });
    return rows.length > 0;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getActiveRunByChatId(
  chatId: string
): Promise<{ runId: string } | null> {
  try {
    const [row] = await db
      .select({ runId: agentRun.id })
      .from(agentRun)
      .where(
        and(
          eq(agentRun.chatId, chatId),
          inArray(agentRun.status, NON_TERMINAL_STATUSES)
        )
      )
      .orderBy(desc(agentRun.createdAt))
      .limit(1);
    return row ?? null;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function acquireLease(
  runId: string,
  workerId: string
): Promise<boolean> {
  try {
    const rows = await db
      .insert(runtimeLease)
      .values({ runId, workerId })
      .onConflictDoNothing({ target: runtimeLease.runId })
      .returning({ id: runtimeLease.id });
    return rows.length > 0;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function renewLeases(
  workerId: string,
  runIds: readonly string[]
): Promise<void> {
  if (runIds.length === 0) {
    return;
  }
  try {
    await db
      .update(runtimeLease)
      .set({ heartbeatAt: sql`now()` })
      .where(
        and(
          eq(runtimeLease.workerId, workerId),
          inArray(runtimeLease.runId, [...runIds])
        )
      );
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function releaseLease(runId: string): Promise<void> {
  try {
    await db.delete(runtimeLease).where(eq(runtimeLease.runId, runId));
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

/** 心跳过期且非终态 → failed（多进程 zombie 语义；Step 8 主路径） */
export async function failStaleRuns(
  heartbeatTimeoutMs: number
): Promise<number> {
  try {
    const stale = await db
      .select({ runId: agentRun.id })
      .from(agentRun)
      .innerJoin(runtimeLease, eq(runtimeLease.runId, agentRun.id))
      .where(
        and(
          inArray(agentRun.status, NON_TERMINAL_STATUSES),
          sql`${runtimeLease.heartbeatAt} < now() - make_interval(secs => ${Math.ceil(heartbeatTimeoutMs / 1000)})`
        )
      );
    if (stale.length === 0) {
      return 0;
    }
    const runIds = stale.map((row) => row.runId);
    return failRunIds(runIds, "lease heartbeat timed out");
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

/**
 * 单进程 MVP：非终态且不在 exclude（本进程 LiveRun）→ failed。
 * in-process backend 的 run 不可能跨进程存活，进程重启后的孤儿即时清理；
 * Step 8 Worker 化后由 lease 心跳语义取代。
 */
export async function failOrphanedRuns(
  excludeRunIds: readonly string[]
): Promise<number> {
  try {
    const conditions = [inArray(agentRun.status, NON_TERMINAL_STATUSES)];
    if (excludeRunIds.length > 0) {
      conditions.push(notInArray(agentRun.id, [...excludeRunIds]));
    }
    const orphaned = await db
      .select({ runId: agentRun.id })
      .from(agentRun)
      .where(and(...conditions));
    if (orphaned.length === 0) {
      return 0;
    }
    return failRunIds(
      orphaned.map((row) => row.runId),
      "worker lost (process restart)"
    );
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

async function failRunIds(runIds: string[], errorMessage: string) {
  const rows = await db
    .update(agentRun)
    .set({
      endedAt: sql`now()`,
      errorMessage,
      status: "failed",
      updatedAt: sql`now()`,
    })
    .where(inArray(agentRun.id, runIds))
    .returning({ id: agentRun.id });
  // 僵尸 run 的 lease 一并清除，避免残留行
  await db.delete(runtimeLease).where(inArray(runtimeLease.runId, runIds));
  return rows.length;
}

/** RunManager 持久化端口组装（lib/runtime/run/index.ts 使用） */
export const postgresAgentRunStore: AgentRunStore = {
  acquireLease,
  createAgentRun,
  failOrphanedRuns,
  failStaleRuns,
  getActiveRunByChatId,
  markRunStatus,
  releaseLease,
  renewLeases,
};
