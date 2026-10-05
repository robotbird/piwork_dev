import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import type { RoleModelPolicy } from "../admin/role-model-policy";
import type { RoleTokenPolicy } from "../admin/role-token-policy";
import { getDb } from "./client";
import { member, memberRole, role } from "./schema";

export async function updateRolePolicy(
  id: string,
  input: {
    modelPolicy?: RoleModelPolicy | null;
    tokenPolicy?: RoleTokenPolicy | null;
  }
) {
  const [updated] = await getDb()
    .update(role)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(role.id, id))
    .returning({ id: role.id });
  return updated ?? null;
}
export async function getUserRolePolicies(userId: string) {
  const db = getDb();
  const [account] = await db
    .select({ status: member.status })
    .from(member)
    .where(eq(member.userId, userId));
  if (account?.status !== "enabled") {
    throw new Error("Account is not enabled");
  }
  return db
    .select({
      id: role.id,
      modelPolicy: role.modelPolicy,
      tokenPolicy: role.tokenPolicy,
    })
    .from(member)
    .innerJoin(memberRole, eq(memberRole.memberId, member.id))
    .innerJoin(role, eq(role.id, memberRole.roleId))
    .where(and(eq(member.userId, userId), eq(member.status, "enabled")))
    .orderBy(asc(role.createdAt), asc(role.id));
}
/** Each completed message counted once per role; organization membership is current, not historical. */
export async function getRoleTokenUsage(roleId: string, runId?: string) {
  const rows = await getDb().execute<{
    daily: number;
    monthly: number;
    perRun: number;
    missing: number;
  }>(sql`
    select coalesce(sum((e.data->'usage'->>'totalTokens')::numeric) filter (where e."createdAt" >= current_date and e."createdAt" < current_date + interval '1 day'), 0)::float as daily,
      coalesce(sum((e.data->'usage'->>'totalTokens')::numeric) filter (where e."createdAt" >= date_trunc('month', current_date) and e."createdAt" < date_trunc('month', current_date) + interval '1 month'), 0)::float as monthly,
      coalesce(sum((e.data->'usage'->>'totalTokens')::numeric) filter (where r.id = ${runId ?? null}::uuid), 0)::float as "perRun",
      count(*) filter (where e.data->'usage'->>'totalTokens' is null and e."createdAt" >= date_trunc('month', current_date) and e."createdAt" < date_trunc('month', current_date) + interval '1 month')::int as missing
    from "RuntimeEvent" e join "AgentRun" r on r.id = e."runId"
    where e.type = 'message.completed' and ((e."createdAt" >= date_trunc('month', current_date) and e."createdAt" < date_trunc('month', current_date) + interval '1 month') or r.id = ${runId ?? null}::uuid)
      and exists (select 1 from "Member" m join "MemberRole" mr on mr."memberId" = m.id where m."userId" = r."userId" and mr."roleId" = ${roleId}::uuid)
  `);
  return rows[0] ?? { daily: 0, missing: 0, monthly: 0, perRun: 0 };
}
