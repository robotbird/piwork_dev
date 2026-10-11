import "server-only";
import { sql } from "drizzle-orm";
import {
  buildTokenStatistics,
  type TokenFilters,
  type TokenRow,
  type TokenStatistics,
} from "@/lib/admin/token-statistics";
import { translateMessage } from "@/lib/i18n/messages";
import { getDb } from "./client";

export async function getTokenStatistics(
  filters: TokenFilters,
  locale?: string
): Promise<TokenStatistics> {
  const days =
    (Date.parse(filters.end) - Date.parse(filters.start)) / 86_400_000 + 1;
  return await getDb().transaction(
    async (tx) => {
      // RuntimeEvent uses the default connection's now(): dates are database-session natural days.
      // Aggregate roles into one combination per member to avoid multiplying token totals.
      const rows = await tx.execute<TokenRow>(sql`
      select to_char(e."createdAt", 'YYYY-MM-DD') as day, r."userId", r."chatId",
        coalesce(d.id::text, 'none') as "departmentId", coalesce(d.name, ${translateMessage("tokenStatistics.unassigned", {}, locale)}) as department,
        coalesce((select string_agg(ro.name, ' / ' order by ro.name) from "MemberRole" mr join "Role" ro on ro.id = mr."roleId" where mr."memberId" = m.id), m.role, ${translateMessage("tokenStatistics.unassigned", {}, locale)}) as role,
        coalesce(mp."displayName" || ' (' || mp."providerKey" || ')', case when coalesce(e.data->'model'->>'provider', r."requestedModel"->>'provider') like 'installation:%' then ${translateMessage("conversations.unknownProvider", {}, locale)} else coalesce(e.data->'model'->>'provider', r."requestedModel"->>'provider', 'unknown') end) || ' / ' ||
          coalesce(e.data->'model'->>'responseModel', e.data->'model'->>'id', r."requestedModel"->>'id', ${translateMessage("conversations.unknown", {}, locale)}) as model,
        sum((e.data->'usage'->>'totalTokens')::numeric)::float as tokens,
        count(*)::int as completed, count(e.data->'usage'->>'totalTokens')::int as recorded
      from "RuntimeEvent" e join "AgentRun" r on r.id = e."runId"
      left join "Member" m on m."userId" = r."userId" left join "Department" d on d.id = m."departmentId"
      left join "ModelProviderPlugin" mp on coalesce(e.data->'model'->>'provider', r."requestedModel"->>'provider') in ('installation:' || mp.id::text, mp."providerKey")
      where e.type = 'message.completed'
        and e."createdAt" >= ${filters.start}::date - (${days} * interval '1 day')
        and e."createdAt" < ${filters.end}::date + interval '1 day'
        and (${filters.department} = 'all' or coalesce(d.id::text, 'none') = ${filters.department})
      group by 1, r."userId", r."chatId", d.id, d.name, m.id, m.role, 7
    `);
      const departments = await tx.execute<{ id: string; name: string }>(
        sql`select id, name from "Department" order by name, id`
      );
      return {
        ...buildTokenStatistics([...rows], filters),
        departmentOptions: [...departments],
      };
    },
    { accessMode: "read only", isolationLevel: "repeatable read" }
  );
}
