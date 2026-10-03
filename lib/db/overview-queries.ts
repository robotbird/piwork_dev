import "server-only";

import { type AnyColumn, desc, eq, type SQL, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { ChatbotError } from "../errors";
import type { AgentRunRecord, SkillRecord } from "./schema";
import {
  agentRun,
  chat,
  mcpServer,
  member,
  modelProviderPlugin,
  sandboxInstance,
  scheduledTask,
  skill,
  user,
} from "./schema";

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

/**
 * 管理端概览（/admin 首页）只读聚合查询。指标口径：
 * - 「任务」= AgentRun（一次 Runtime 执行尝试），不含 ScheduledTaskRun；
 * - 窗口与按日分桶一律用 SQL now()（数据库会话时区），与 agent-run-queries
 *   的写入时钟一致，不跨驱动传 Date 参数；
 * - 活跃用户 = 窗口内在 AgentRun 出现过的去重 userId。
 */

export type OverviewRunCounts = {
  aborted: number;
  failed: number;
  settled: number;
};

export type OverviewWindow = "all" | "last30Days" | "previous30Days";

export type OverviewTrendPoint = {
  aborted: number;
  /** 数据库会话时区自然日（YYYY-MM-DD） */
  date: string;
  failed: number;
  succeeded: number;
};

export type OverviewRecentRun = {
  backend: AgentRunRecord["backend"];
  chatId: string;
  chatTitle: string;
  createdAt: Date;
  durationMs: number | null;
  endedAt: Date | null;
  runId: string;
  startedAt: Date | null;
  status: AgentRunRecord["status"];
  userName: string | null;
};

export type OverviewSkill = {
  description: string;
  displayName: string;
  enabled: boolean;
  name: string;
  source: SkillRecord["source"];
  updatedAt: Date;
  version: string;
};

export type OverviewActivityType =
  | "member"
  | "sandbox"
  | "scheduled_task"
  | "skill"
  | "tool";

export type OverviewActivity = {
  at: Date;
  title: string;
  type: OverviewActivityType;
};

export type OverviewModelProviderHealth = {
  degraded: number;
  enabled: number;
  failed: number;
  healthy: number;
};

async function wrapDatabase<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

/**
 * 平台朴素时间戳（timestamp without time zone）存在两种写入时钟：
 * - now()/defaultNow() 经默认连接写入 = 数据库会话时区墙钟
 *   （AgentRun/Member/ScheduledTask.createdAt）；
 * - drizzle `new Date()` 或显式 UTC 连接写入 = UTC 墙钟文本
 *   （Skill/McpServer 的 updatedAt、SandboxInstance.createdAt）。
 * 输出 ISO 前显式按写入时钟转成 timestamptz，否则服务端进程时区与库会话
 * 时区不一致时（如进程 UTC、库 Asia/Shanghai）读取会产生 ±8h 偏移。
 * 窗口比较与按日分桶全部留在 SQL now() 侧自洽，不受影响。
 */

/** now() 写入的会话墙钟字段 → timestamptz（驱动侧字符串含偏移，new Date 正确解析） */
function sessionWallTimestamp(column: AnyColumn): SQL<Date> {
  return sql`${column} at time zone current_setting('TimeZone')`.mapWith(
    (value: string) => new Date(value)
  );
}

/** drizzle new Date() 写入的 UTC 墙钟字段 → timestamptz */
function utcWallTimestamp(column: AnyColumn): SQL<Date> {
  return sql`${column} at time zone 'UTC'`.mapWith(
    (value: string) => new Date(value)
  );
}

/** 任务量：全部时间总量 + 近 30 天与上一个 30 天窗口的执行次数 */
export function getTaskVolume(): Promise<{
  last30Days: number;
  previous30Days: number;
  total: number;
}> {
  return wrapDatabase(async () => {
    const [row] = await db
      .select({
        last30Days: sql<number>`(count(*) filter (where ${agentRun.createdAt} >= now() - interval '30 days'))::int`,
        previous30Days: sql<number>`(count(*) filter (where ${agentRun.createdAt} >= now() - interval '60 days' and ${agentRun.createdAt} < now() - interval '30 days'))::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(agentRun);
    return row;
  });
}

/** 终态计数（settled/failed/aborted）；非终态 run（queued/starting/running）不计入 */
export function getRunStatusCounts(
  window: OverviewWindow
): Promise<OverviewRunCounts> {
  const predicate =
    window === "last30Days"
      ? sql`${agentRun.createdAt} >= now() - interval '30 days'`
      : window === "previous30Days"
        ? sql`${agentRun.createdAt} >= now() - interval '60 days' and ${agentRun.createdAt} < now() - interval '30 days'`
        : sql`true`;
  return wrapDatabase(async () => {
    const [row] = await db
      .select({
        aborted: sql<number>`(count(*) filter (where ${agentRun.status} = 'aborted'))::int`,
        failed: sql<number>`(count(*) filter (where ${agentRun.status} = 'failed'))::int`,
        settled: sql<number>`(count(*) filter (where ${agentRun.status} = 'settled'))::int`,
      })
      .from(agentRun)
      .where(predicate);
    return row;
  });
}

/** 活跃用户：近 30 天与上一个 30 天窗口内出现过 run 的去重用户数 */
export function getActiveUserCounts(): Promise<{
  last30Days: number;
  previous30Days: number;
}> {
  return wrapDatabase(async () => {
    const [row] = await db
      .select({
        last30Days: sql<number>`(count(distinct ${agentRun.userId}) filter (where ${agentRun.createdAt} >= now() - interval '30 days'))::int`,
        previous30Days: sql<number>`(count(distinct ${agentRun.userId}) filter (where ${agentRun.createdAt} >= now() - interval '60 days' and ${agentRun.createdAt} < now() - interval '30 days'))::int`,
      })
      .from(agentRun);
    return row;
  });
}

/** Skill / MCP 工具的数量与启用数（时点值） */
export function getResourceCounts(): Promise<{
  skills: { enabled: number; total: number };
  tools: { enabled: number; total: number };
}> {
  return wrapDatabase(async () => {
    const [skillRow] = await db
      .select({
        enabled: sql<number>`(count(*) filter (where ${skill.enabled}))::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(skill);
    const [toolRow] = await db
      .select({
        enabled: sql<number>`(count(*) filter (where ${mcpServer.enabled}))::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(mcpServer);
    return { skills: skillRow, tools: toolRow };
  });
}

/**
 * 近 N 天（含今天）按日成功/失败/中止计数；generate_series 补零。
 * 每天分桶按数据库会话时区的自然日，与写入时钟一致。
 */
export function getRunDailyTrend(days: number): Promise<OverviewTrendPoint[]> {
  const bounded = Math.min(Math.max(Math.trunc(days), 1), 90);
  return wrapDatabase(async () => {
    const rows = await db.execute<{
      aborted: number;
      date: string;
      failed: number;
      succeeded: number;
    }>(sql`
      with counts as (
        select ${agentRun.createdAt}::date as day,
          (count(*) filter (where ${agentRun.status} = 'settled'))::int as succeeded,
          (count(*) filter (where ${agentRun.status} = 'failed'))::int as failed,
          (count(*) filter (where ${agentRun.status} = 'aborted'))::int as aborted
        from ${agentRun}
        where ${agentRun.createdAt} >= date_trunc('day', now()) - make_interval(days => ${bounded - 1})
        group by 1
      )
      select
        to_char(d.day, 'YYYY-MM-DD') as date,
        coalesce(c.succeeded, 0) as succeeded,
        coalesce(c.failed, 0) as failed,
        coalesce(c.aborted, 0) as aborted
      from generate_series(
        date_trunc('day', now()) - make_interval(days => ${bounded - 1}),
        date_trunc('day', now()),
        interval '1 day'
      ) as d(day)
      left join counts c on c.day = d.day
      order by d.day
    `);
    return [...rows];
  });
}

/** 任务后端分布（全部时间）：in_process / sandbox_rpc */
export function getRunBackendDistribution(): Promise<
  { backend: AgentRunRecord["backend"]; count: number }[]
> {
  return wrapDatabase(() =>
    db
      .select({
        backend: agentRun.backend,
        count: sql<number>`count(*)::int`,
      })
      .from(agentRun)
      .groupBy(agentRun.backend)
  );
}

/** 最近执行的 run（含聊天标题、用户名与耗时）；按创建时间倒序 */
export function listRecentRuns(limit: number): Promise<OverviewRecentRun[]> {
  return wrapDatabase(() =>
    db
      .select({
        backend: agentRun.backend,
        chatId: agentRun.chatId,
        chatTitle: chat.title,
        createdAt: sessionWallTimestamp(agentRun.createdAt),
        durationMs: sql<
          number | null
        >`case when ${agentRun.startedAt} is null or ${agentRun.endedAt} is null then null else (round(extract(epoch from (${agentRun.endedAt} - ${agentRun.startedAt})) * 1000))::int end`,
        endedAt: sessionWallTimestamp(agentRun.endedAt),
        runId: agentRun.id,
        startedAt: sessionWallTimestamp(agentRun.startedAt),
        status: agentRun.status,
        userName: user.name,
      })
      .from(agentRun)
      .innerJoin(chat, eq(chat.id, agentRun.chatId))
      .innerJoin(user, eq(user.id, agentRun.userId))
      .orderBy(desc(agentRun.createdAt))
      .limit(limit)
  );
}

/** 最近更新的 Skill（平台未统计使用次数，按 updatedAt 近似「热门」口径） */
export function listRecentSkills(limit: number): Promise<OverviewSkill[]> {
  return wrapDatabase(() =>
    db
      .select({
        description: skill.description,
        displayName: skill.displayName,
        enabled: skill.enabled,
        name: skill.name,
        source: skill.source,
        updatedAt: utcWallTimestamp(skill.updatedAt),
        version: skill.version,
      })
      .from(skill)
      .orderBy(desc(skill.updatedAt))
      .limit(limit)
  );
}

/**
 * 最新动态：Skill 更新、工具接入、成员加入、沙箱创建、定时任务创建
 * 五个来源各取最近若干条，合并按时间倒序截断。
 */
export function listRecentActivities(
  limit: number
): Promise<OverviewActivity[]> {
  return wrapDatabase(async () => {
    const [skillRows, toolRows, memberRows, sandboxRows, taskRows] =
      await Promise.all([
        db
          .select({
            at: utcWallTimestamp(skill.updatedAt),
            title: skill.displayName,
          })
          .from(skill)
          .orderBy(desc(skill.updatedAt))
          .limit(limit),
        db
          .select({
            at: utcWallTimestamp(mcpServer.updatedAt),
            title: mcpServer.name,
          })
          .from(mcpServer)
          .orderBy(desc(mcpServer.updatedAt))
          .limit(limit),
        db
          .select({
            at: sessionWallTimestamp(member.createdAt),
            title: sql<string>`coalesce(${user.name}, ${user.email})`,
          })
          .from(member)
          .innerJoin(user, eq(user.id, member.userId))
          .orderBy(desc(member.createdAt))
          .limit(limit),
        db
          .select({
            // SandboxInstance 全部经 sandbox-queries 的显式 UTC 连接写入
            at: utcWallTimestamp(sandboxInstance.createdAt),
            title: sandboxInstance.image,
          })
          .from(sandboxInstance)
          .orderBy(desc(sandboxInstance.createdAt))
          .limit(limit),
        db
          .select({
            at: sessionWallTimestamp(scheduledTask.createdAt),
            title: sql<string>`left(${scheduledTask.prompt}, 80)`,
          })
          .from(scheduledTask)
          .orderBy(desc(scheduledTask.createdAt))
          .limit(limit),
      ]);
    const items: OverviewActivity[] = [
      ...skillRows.map((row) => ({
        at: row.at,
        title: row.title,
        type: "skill" as const,
      })),
      ...toolRows.map((row) => ({
        at: row.at,
        title: row.title,
        type: "tool" as const,
      })),
      ...memberRows.map((row) => ({
        at: row.at,
        title: row.title,
        type: "member" as const,
      })),
      ...sandboxRows.map((row) => ({
        at: row.at,
        title: row.title,
        type: "sandbox" as const,
      })),
      ...taskRows.map((row) => ({
        at: row.at,
        title: row.title,
        type: "scheduled_task" as const,
      })),
    ];
    return items
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, limit);
  });
}

/** 启用中的模型插件健康分布（unknown/healthy/degraded/failed 计数） */
export function getModelProviderHealth(): Promise<OverviewModelProviderHealth> {
  return wrapDatabase(async () => {
    const [row] = await db
      .select({
        degraded: sql<number>`(count(*) filter (where ${modelProviderPlugin.healthStatus} = 'degraded'))::int`,
        enabled: sql<number>`count(*)::int`,
        failed: sql<number>`(count(*) filter (where ${modelProviderPlugin.healthStatus} = 'failed'))::int`,
        healthy: sql<number>`(count(*) filter (where ${modelProviderPlugin.healthStatus} = 'healthy'))::int`,
      })
      .from(modelProviderPlugin)
      .where(eq(modelProviderPlugin.enabled, true));
    return row;
  });
}

/** 数据库连通性探测（services.database 的真实依据） */
export async function pingDatabase(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}
