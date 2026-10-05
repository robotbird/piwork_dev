import "server-only";

import { and, desc, eq, inArray, notInArray, type SQL, sql } from "drizzle-orm";
import { ChatbotError } from "../errors";
import type { RuntimeBackendKind } from "../runtime/protocol";
import type { RuntimeModel } from "../runtime/protocol/events";
import type { AgentRunStatus, AgentRunStore } from "../runtime/run/run-manager";
import { getDb } from "./client";
import { agentRun, runtimeLease } from "./schema";

const db = getDb();

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
 * 检测（多进程语义）；无租约孤儿即时收敛，持租约未知 run 等心跳过期。
 *
 * 时间戳一律经 SQL now() 写入与比较（不用 JS Date 参数）：drizzle 会把
 * Date 序列化为 UTC 无时区文本，与 defaultNow() 的会话本地时间相差时区偏移
 * （Asia/Shanghai 下 -8h），混用会让 stale 判定永久失真。
 */

export async function createAgentRun(input: {
  backend: RuntimeBackendKind;
  chatId: string;
  userId: string;
  requestedModel?: RuntimeModel;
}): Promise<string> {
  try {
    const [row] = await db
      .insert(agentRun)
      .values({
        backend: input.backend,
        chatId: input.chatId,
        requestedModel: input.requestedModel,
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

/** Update-time predicates avoid a select/update race with settled or renewed runs.
 * Optional scopes are used by integration fixtures; an empty scope changes nothing.
 */
export async function failStaleRuns(
  heartbeatTimeoutMs: number,
  scopeRunIds?: readonly string[]
): Promise<number> {
  const conditions = [
    sql`exists (select 1 from "RuntimeLease" l where l."runId" = ${agentRun.id}
    and l."heartbeatAt" < now() - make_interval(secs => ${Math.ceil(heartbeatTimeoutMs / 1000)}))`,
  ];
  if (scopeRunIds) {
    conditions.push(inArray(agentRun.id, [...scopeRunIds]));
  }
  return await failMatchingRuns(conditions, "lease heartbeat timed out");
}

/** Unknown runs with a lease are not orphaned: only stale-heartbeat cleanup may fail them. */
export async function failOrphanedRuns(
  excludeRunIds: readonly string[],
  scopeRunIds?: readonly string[]
): Promise<number> {
  const conditions = [
    sql`not exists (select 1 from "RuntimeLease" l where l."runId" = ${agentRun.id})`,
  ];
  if (excludeRunIds.length > 0) {
    conditions.push(notInArray(agentRun.id, [...excludeRunIds]));
  }
  if (scopeRunIds) {
    conditions.push(inArray(agentRun.id, [...scopeRunIds]));
  }
  return await failMatchingRuns(conditions, "worker lost (process restart)");
}

async function failMatchingRuns(
  conditions: SQL[],
  errorMessage: string
): Promise<number> {
  try {
    return await db.transaction(async (tx) => {
      const rows = await tx
        .update(agentRun)
        .set({
          endedAt: sql`now()`,
          errorMessage,
          status: "failed",
          updatedAt: sql`now()`,
        })
        .where(
          and(inArray(agentRun.status, NON_TERMINAL_STATUSES), ...conditions)
        )
        .returning({ id: agentRun.id });
      // Release leases only for the rows actually transitioned, in the same transaction.
      if (rows.length) {
        await tx.delete(runtimeLease).where(
          inArray(
            runtimeLease.runId,
            rows.map((row) => row.id)
          )
        );
      }
      return rows.length;
    });
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
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
