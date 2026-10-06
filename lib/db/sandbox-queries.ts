import "server-only";

import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { ChatbotError } from "../errors";
import type {
  SandboxProviderName,
  SandboxRuntimeConfig,
  SandboxStatus,
} from "../runtime/sandbox";
import { getDb } from "./client";
import { chat, sandboxInstance, user } from "./schema";

const db = getDb("UTC");

/** 与 SandboxInstance.status 同源的业务状态（destroyed/expired 为终态） */
export type SandboxInstanceStatus = SandboxStatus | "expired";

const LIVE_STATUSES: SandboxInstanceStatus[] = [
  "creating",
  "ready",
  "paused",
  "degraded",
];

/**
 * SandboxInstance 读写（opensandbox-integration-spec.md §6 管理功能）。
 * externalId 即 SandboxHandle.id，(provider, externalId) 唯一。
 * 时间戳一律经 SQL now() 写入与比较（与 agent-run-queries 同约定：drizzle
 * Date 参数 UTC 序列化与会话本地 now() 相差时区偏移，混用会失真）。
 */

/**
 * acquire/reuse 落库：upsert 保持 chat 复用下同一行更新 lastRunId。
 * userId 缺省时按 Chat 归属补全（RuntimeSpec 不携带 userId，所有权以库为准）。
 */
export async function registerSandboxAcquired(input: {
  provider: SandboxProviderName;
  externalId: string;
  chatId: string;
  userId?: string;
  runId: string;
  image: string;
  ttlSeconds: number;
  status?: SandboxInstanceStatus;
  runtimeConfig?: SandboxRuntimeConfig;
}): Promise<void> {
  try {
    await db
      .insert(sandboxInstance)
      .values({
        chatId: input.chatId,
        expiresAt: sql`now() + make_interval(secs => ${input.ttlSeconds})`,
        externalId: input.externalId,
        image: input.image,
        lastRunId: input.runId,
        provider: input.provider,
        runtimeConfig: input.runtimeConfig,
        status: input.status ?? "ready",
        ttlSeconds: input.ttlSeconds,
        userId:
          input.userId ??
          sql`(SELECT "userId" FROM ${chat} WHERE ${chat.id} = ${input.chatId})`,
      })
      .onConflictDoUpdate({
        set: {
          chatId: input.chatId,
          expiresAt: sql`now() + make_interval(secs => ${input.ttlSeconds})`,
          image: input.image,
          lastRunId: input.runId,
          runtimeConfig: input.runtimeConfig,
          status: input.status ?? "ready",
          ttlSeconds: input.ttlSeconds,
          updatedAt: sql`now()`,
          userId:
            input.userId ??
            sql`(SELECT "userId" FROM ${chat} WHERE ${chat.id} = ${input.chatId})`,
        },
        target: [sandboxInstance.provider, sandboxInstance.externalId],
      });
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function markSandboxStatus(
  provider: SandboxProviderName,
  externalId: string,
  status: SandboxInstanceStatus
): Promise<boolean> {
  try {
    const rows = await db
      .update(sandboxInstance)
      .set({ status, updatedAt: sql`now()` })
      .where(
        and(
          eq(sandboxInstance.provider, provider),
          eq(sandboxInstance.externalId, externalId)
        )
      )
      .returning({ id: sandboxInstance.id });
    return rows.length > 0;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

/** 续期：expiresAt 平移 now()+ttl，lastRenewedAt 记录本次续期 */
export async function markSandboxRenewed(
  provider: SandboxProviderName,
  externalId: string,
  ttlSeconds: number
): Promise<boolean> {
  try {
    const rows = await db
      .update(sandboxInstance)
      .set({
        expiresAt: sql`greatest(${sandboxInstance.expiresAt}, now() + make_interval(secs => ${ttlSeconds}))`,
        lastRenewedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(sandboxInstance.provider, provider),
          eq(sandboxInstance.externalId, externalId),
          // 终态不再续期
          inArray(sandboxInstance.status, LIVE_STATUSES)
        )
      )
      .returning({ id: sandboxInstance.id });
    return rows.length > 0;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export function markSandboxDestroyed(
  provider: SandboxProviderName,
  externalId: string
): Promise<boolean> {
  return markSandboxStatus(provider, externalId, "destroyed");
}

/** 惰性过期：到期未销毁的活沙箱收敛为 expired，返回收敛行数 */
export async function expireOverdueSandboxInstances(): Promise<number> {
  try {
    const rows = await db
      .update(sandboxInstance)
      .set({ status: "expired", updatedAt: sql`now()` })
      .where(
        and(
          inArray(sandboxInstance.status, LIVE_STATUSES),
          sql`${sandboxInstance.expiresAt} < now()`
        )
      )
      .returning({ id: sandboxInstance.id });
    return rows.length;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export type SandboxInstanceView = {
  chatId: string;
  chatTitle: string | null;
  createdAt: Date;
  expiresAt: Date;
  externalId: string;
  id: string;
  image: string;
  lastRenewedAt: Date;
  lastRunId: string | null;
  provider: SandboxProviderName;
  status: SandboxInstanceStatus;
  runtimeConfig: SandboxRuntimeConfig | null;
  ttlSeconds: number;
  userEmail: string | null;
  userId: string;
  userName: string | null;
};

/** 管理页列表：先惰性过期再查（activeOnly 只保留未终态行） */
export async function listSandboxInstances(options?: {
  activeOnly?: boolean;
  reconcileExpiry?: boolean;
}): Promise<SandboxInstanceView[]> {
  try {
    if (options?.reconcileExpiry !== false) {
      await expireOverdueSandboxInstances();
    }
    const rows = await db
      .select({
        chatId: sandboxInstance.chatId,
        chatTitle: chat.title,
        createdAt: sandboxInstance.createdAt,
        expiresAt: sandboxInstance.expiresAt,
        externalId: sandboxInstance.externalId,
        id: sandboxInstance.id,
        image: sandboxInstance.image,
        lastRenewedAt: sandboxInstance.lastRenewedAt,
        lastRunId: sandboxInstance.lastRunId,
        provider: sandboxInstance.provider,
        runtimeConfig: sandboxInstance.runtimeConfig,
        status: sandboxInstance.status,
        ttlSeconds: sandboxInstance.ttlSeconds,
        userEmail: user.email,
        userId: sandboxInstance.userId,
        userName: user.name,
      })
      .from(sandboxInstance)
      .innerJoin(user, eq(sandboxInstance.userId, user.id))
      .innerJoin(chat, eq(sandboxInstance.chatId, chat.id))
      .where(
        options?.activeOnly
          ? inArray(sandboxInstance.status, LIVE_STATUSES)
          : undefined
      )
      .orderBy(desc(sandboxInstance.createdAt));
    return rows;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

/** 管理页分页列表：状态组筛选 + 全字段 ILIKE 搜索，先计数再收敛页码（页码超界回落最后一页） */
export type SandboxInstanceListFilter =
  | "all"
  | "active"
  | "error"
  | "destroyed";

const FILTER_STATUSES: Record<
  Exclude<SandboxInstanceListFilter, "all">,
  SandboxInstanceStatus[]
> = {
  // 与客户端语义一致：运行中不含 degraded（异常单列）
  active: ["creating", "ready", "paused"],
  destroyed: ["destroyed", "expired"],
  error: ["degraded"],
};

export async function listSandboxInstancePage(options: {
  filter?: SandboxInstanceListFilter;
  page: number;
  pageSize: number;
  query?: string;
  reconcileExpiry?: boolean;
}): Promise<{ rows: SandboxInstanceView[]; total: number; page: number }> {
  try {
    if (options.reconcileExpiry !== false) {
      await expireOverdueSandboxInstances();
    }
    const filter = options.filter ?? "all";
    const search = options.query?.trim();
    const statuses = filter === "all" ? null : FILTER_STATUSES[filter];
    const pattern = `%${search ?? ""}%`;
    // id 列是 uuid，统一 cast text 后 ILIKE（与原客户端全字段搜索同口径）
    const like = (column: unknown) =>
      sql`cast(${column} as text) ilike ${pattern}`;
    const where = and(
      statuses ? inArray(sandboxInstance.status, statuses) : undefined,
      search
        ? or(
            like(sandboxInstance.externalId),
            like(sandboxInstance.id),
            like(user.id),
            like(user.name),
            like(user.email),
            like(chat.id),
            like(chat.title),
            like(sandboxInstance.lastRunId),
            like(sandboxInstance.provider)
          )
        : undefined
    );
    const [counted] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(sandboxInstance)
      .innerJoin(user, eq(sandboxInstance.userId, user.id))
      .innerJoin(chat, eq(sandboxInstance.chatId, chat.id))
      .where(where);
    const total = counted?.total ?? 0;
    const page = Math.max(
      1,
      Math.min(options.page, Math.ceil(total / options.pageSize) || 1)
    );
    const rows = await db
      .select({
        chatId: sandboxInstance.chatId,
        chatTitle: chat.title,
        createdAt: sandboxInstance.createdAt,
        expiresAt: sandboxInstance.expiresAt,
        externalId: sandboxInstance.externalId,
        id: sandboxInstance.id,
        image: sandboxInstance.image,
        lastRenewedAt: sandboxInstance.lastRenewedAt,
        lastRunId: sandboxInstance.lastRunId,
        provider: sandboxInstance.provider,
        runtimeConfig: sandboxInstance.runtimeConfig,
        status: sandboxInstance.status,
        ttlSeconds: sandboxInstance.ttlSeconds,
        userEmail: user.email,
        userId: sandboxInstance.userId,
        userName: user.name,
      })
      .from(sandboxInstance)
      .innerJoin(user, eq(sandboxInstance.userId, user.id))
      .innerJoin(chat, eq(sandboxInstance.chatId, chat.id))
      .where(where)
      .orderBy(desc(sandboxInstance.createdAt))
      .limit(options.pageSize)
      .offset((page - 1) * options.pageSize);
    return { page, rows, total };
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

/** chat 级复用查询：同 chat 同镜像的 ready 且未过期沙箱（spec §7 lease 粒度） */
export async function findReusableSandboxExternalId(input: {
  chatId: string;
  provider: SandboxProviderName;
  image: string;
}): Promise<string | null> {
  try {
    const rows = await db
      .select({ externalId: sandboxInstance.externalId })
      .from(sandboxInstance)
      .where(
        and(
          eq(sandboxInstance.chatId, input.chatId),
          eq(sandboxInstance.provider, input.provider),
          eq(sandboxInstance.image, input.image),
          eq(sandboxInstance.status, "ready"),
          sql`${sandboxInstance.expiresAt} > now()`
        )
      )
      .orderBy(desc(sandboxInstance.createdAt))
      .limit(1);
    return rows[0]?.externalId ?? null;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

/** Read a registered instance before any provider operation. */
export async function getSandboxInstance(
  provider: SandboxProviderName,
  externalId: string
) {
  const [row] = await db
    .select()
    .from(sandboxInstance)
    .where(
      and(
        eq(sandboxInstance.provider, provider),
        eq(sandboxInstance.externalId, externalId)
      )
    );
  return row ?? null;
}

/** Provider-confirmed state; a delayed observation cannot revive a destroyed row. */
export async function observeSandboxInstance(
  provider: SandboxProviderName,
  externalId: string,
  observation: { status: SandboxInstanceStatus; expiresAt?: Date | null },
  renewed = false
) {
  const values = {
    status: observation.status,
    updatedAt: sql`now()`,
    ...(observation.expiresAt
      ? { expiresAt: sql`${observation.expiresAt.toISOString()}::timestamptz` }
      : {}),
    ...(renewed ? { lastRenewedAt: sql`now()` } : {}),
  };
  await db
    .update(sandboxInstance)
    .set(values)
    .where(
      and(
        eq(sandboxInstance.provider, provider),
        eq(sandboxInstance.externalId, externalId),
        inArray(sandboxInstance.status, [...LIVE_STATUSES, "expired"])
      )
    );
}

export async function getSandboxInstanceById(id: string) {
  const [row] = await db
    .select()
    .from(sandboxInstance)
    .where(eq(sandboxInstance.id, id));
  return row ?? null;
}
