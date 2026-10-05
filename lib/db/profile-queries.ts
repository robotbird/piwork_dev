import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { agentRun, department, member, memberRole, role, user } from "./schema";

const db = getDb();

export async function getProfile(userId: string) {
  const [[account], [stats], activity, roles] = await Promise.all([
    db
      .select({
        createdAt: sql<string>`to_char(${user.createdAt}, 'YYYY-MM-DD')`,
        department: department.name,
        email: user.email,
        id: user.id,
        image: user.image,
        name: user.name,
        role: member.role,
      })
      .from(user)
      .leftJoin(member, eq(member.userId, user.id))
      .leftJoin(department, eq(department.id, member.departmentId))
      .where(eq(user.id, userId)),
    db
      .select({
        lastActive: sql<
          string | null
        >`to_char(max(${agentRun.createdAt}), 'YYYY-MM-DD HH24:MI')`,
        longestSeconds: sql<number>`coalesce(max(extract(epoch from (${agentRun.endedAt} - ${agentRun.startedAt}))), 0)::float`,
        succeeded: sql<number>`count(*) filter (where ${agentRun.status} = 'settled')::int`,
        total: sql<number>`count(*)::int`,
        totalTokens: sql<number>`coalesce((select sum((e.data->'usage'->>'totalTokens')::numeric) from "RuntimeEvent" e join "AgentRun" r on r.id = e."runId" where r."userId" = ${userId} and e.type = 'message.completed' and e.data->'usage'->>'totalTokens' is not null), 0)::float`,
      })
      .from(agentRun)
      .where(eq(agentRun.userId, userId)),
    db.execute<{ date: string; count: number; tokens: number | null }>(sql`
      with daily as (
        select "createdAt"::date as day, count(*)::int as count from "AgentRun"
        where "userId" = ${userId} and "createdAt" >= current_date - interval '1 year' + interval '1 day'
          and "createdAt" < current_date + interval '1 day'
        group by "createdAt"::date
      )
      , tokens as (
        select e."createdAt"::date as day, sum((e.data->'usage'->>'totalTokens')::numeric)::float as total
        from "RuntimeEvent" e join "AgentRun" r on r.id = e."runId"
        where r."userId" = ${userId} and e.type = 'message.completed'
          and e.data->'usage'->>'totalTokens' is not null
          and e."createdAt" >= current_date - interval '1 year' + interval '1 day'
          and e."createdAt" < current_date + interval '1 day'
        group by e."createdAt"::date
      )
      select to_char(days.day, 'YYYY-MM-DD') as date, coalesce(daily.count, 0)::int as count,
        case when tokens.total is not null then tokens.total when coalesce(daily.count, 0) = 0 then 0 else null end as tokens
      from generate_series(current_date - interval '1 year' + interval '1 day', current_date, interval '1 day') as days(day)
      left join daily on daily.day = days.day::date
      left join tokens on tokens.day = days.day::date order by days.day
    `),
    db
      .select({ name: role.name })
      .from(member)
      .innerJoin(memberRole, eq(memberRole.memberId, member.id))
      .innerJoin(role, eq(role.id, memberRole.roleId))
      .where(eq(member.userId, userId))
      .orderBy(role.name),
  ]);
  return account
    ? {
        account: { ...account, roles: roles.map((item) => item.name) },
        activity: Array.from(activity),
        stats,
      }
    : null;
}

export async function updateProfileName(userId: string, name: string) {
  await db
    .update(user)
    .set({ name, updatedAt: new Date() })
    .where(eq(user.id, userId));
}

/** Compare-and-swap prevents concurrent password changes from using a stale password. */
export async function updateProfilePassword(
  userId: string,
  previous: string,
  password: string
) {
  const changed = await db
    .update(user)
    .set({ password, updatedAt: new Date() })
    .where(and(eq(user.id, userId), eq(user.password, previous)))
    .returning({ id: user.id });
  return changed.length === 1;
}

export async function updateProfileImage(userId: string, image: string | null) {
  const [updated] = await db
    .update(user)
    .set({ image, updatedAt: new Date() })
    .where(eq(user.id, userId))
    .returning({ id: user.id });
  return Boolean(updated);
}
