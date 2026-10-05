import "server-only";
import { sql } from "drizzle-orm";
import {
  type ConversationDetail,
  type ConversationFilters,
  type ConversationList,
  type ConversationRecord,
  conversationText,
} from "@/lib/admin/conversations";
import { getDb } from "./client";

const db = getDb();
// Per-run priority: completed model identity > requested snapshot > legacy proxy evidence.
// A run can contain several actual models. Current plugin metadata supplies presentation only,
// never today's model configuration or credentials to infer historical identity.
const modelRows = sql`select r."chatId", md.provider, md.id, md.name, md.source,
    json_build_array(md.provider, md.id)::text as key
  from "AgentRun" r cross join lateral (
    select e.data->'model'->>'provider' as provider,
      coalesce(e.data->'model'->>'responseModel', e.data->'model'->>'id') as id,
      coalesce(e.data->'model'->>'responseModel', e.data->'model'->>'id') as name,
      'response' as source
    from "RuntimeEvent" e where e."runId" = r.id and e.type = 'message.completed' and e.data->'model'->>'id' is not null
    union all
    select r."requestedModel"->>'provider', r."requestedModel"->>'id',
      coalesce(r."requestedModel"->>'name', r."requestedModel"->>'id'), 'request'
    where r."requestedModel"->>'id' is not null and not exists (
      select 1 from "RuntimeEvent" e where e."runId" = r.id and e.type = 'message.completed' and e.data->'model'->>'id' is not null)
    union all
    select a.provider, a.model, a.model, 'audit'
    from "InferenceAccessAudit" a where a."runId" = r.id::text and a."chatId" = r."chatId"
      and a.status = 'allowed' and a.action = 'stream' and a.provider is not null and a.model is not null
      and r."requestedModel"->>'id' is null and not exists (
        select 1 from "RuntimeEvent" e where e."runId" = r.id and e.type = 'message.completed' and e.data->'model'->>'id' is not null)
  ) md where md.provider is not null and md.id is not null`;
const modelCte = sql`with conversation_models as (
  select cm.*, mp."displayName" as "providerName", mp."providerKey" as "providerKey"
  from (${modelRows}) cm left join "ModelProviderPlugin" mp
    on cm.provider = 'installation:' || mp.id::text or cm.provider = mp."providerKey"
)`;
const usageField = (key: string) =>
  sql`coalesce(sum((e.data->'usage'->>${key})::numeric), 0)::float`;
const fields = sql`c.id, c.title, u.email as "userEmail", u.name as "userName",
  c."projectId", p.name as "projectName",
  to_char(c."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "createdAt",
  to_char(c."updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "updatedAt",
  (select count(*)::int from "Message_v2" m where m."chatId" = c.id) as "messageCount",
  coalesce((select r.status from "AgentRun" r where r."chatId" = c.id order by r."createdAt" desc, r.id desc limit 1), 'none') as status,
  coalesce((select json_agg(mm order by mm.key, mm.source) from (
    select distinct key, provider, "providerName", "providerKey", id, name, source from conversation_models cm where cm."chatId" = c.id) mm), '[]'::json) as models,
  usage.usage, usage."usageRecordedMessages", usage."completedMessages",
  (select count(*)::int from "AgentRun" r where r."chatId" = c.id and not exists (
    select 1 from "RuntimeEvent" e where e."runId" = r.id and e.type = 'message.completed' and e.data->'usage'->>'totalTokens' is not null)) as "unrecordedRuns"`;
const source = sql`"Chat" c join "User" u on u.id = c."userId" left join "Project" p on p.id = c."projectId"
  cross join lateral (
    select count(*)::int as "completedMessages", count(e.data->'usage'->>'totalTokens')::int as "usageRecordedMessages",
      case when count(e.data->'usage'->>'totalTokens') = 0 then null else json_build_object(
        'input', ${usageField("input")}, 'output', ${usageField("output")},
        'cacheRead', ${usageField("cacheRead")}, 'cacheWrite', ${usageField("cacheWrite")},
        'totalTokens', ${usageField("totalTokens")}) end as usage
    from "RuntimeEvent" e join "AgentRun" r on r.id = e."runId" where r."chatId" = c.id and e.type = 'message.completed'
  ) usage`;

export async function listAdminConversations(
  filters: ConversationFilters
): Promise<ConversationList> {
  const { query, status, project, days, sort, pageSize, model } = filters;
  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const where = sql`where (${query} = '' or c.title ilike ${pattern} or u.email ilike ${pattern} or u.name ilike ${pattern} or p.name ilike ${pattern}
      or exists (select 1 from conversation_models cm where cm."chatId" = c.id and (cm.id ilike ${pattern} or cm.provider ilike ${pattern} or cm."providerName" ilike ${pattern} or cm.name ilike ${pattern})))
    and (${project} = 'all' or (${project} = 'none' and c."projectId" is null) or c."projectId"::text = ${project})
    and (${model} = 'all' or (${model} = 'none' and not exists (select 1 from conversation_models cm where cm."chatId" = c.id))
      or exists (select 1 from conversation_models cm where cm."chatId" = c.id and cm.key = ${model}))
    and (${days} = 'all' or c."updatedAt" >= (now() at time zone 'UTC') - (${days === "all" ? 0 : Number(days)} * interval '1 day'))
    and (${status} = 'all' or coalesce((select r.status from "AgentRun" r where r."chatId" = c.id order by r."createdAt" desc, r.id desc limit 1), 'none') = ${status})`;
  return await db.transaction(
    async (tx) => {
      const [{ total }] = await tx.execute<{ total: number }>(
        sql`${modelCte} select count(*)::int as total from ${source} ${where}`
      );
      const page = Math.min(
        filters.page,
        Math.max(1, Math.ceil(total / pageSize))
      );
      const items = await tx.execute<ConversationRecord>(
        sql`${modelCte} select ${fields} from ${source} ${where} order by c."updatedAt" ${sort === "asc" ? sql`asc` : sql`desc`}, c.id limit ${pageSize} offset ${(page - 1) * pageSize}`
      );
      const projects = await tx.execute<{
        id: string;
        name: string;
        userEmail: string;
      }>(
        sql`select p.id, p.name, u.email as "userEmail" from "Project" p join "User" u on u.id = p."userId" order by p.name, p.id`
      );
      const models = await tx.execute<ConversationList["models"][number]>(
        sql`${modelCte} select key, provider, "providerName", "providerKey", id, min(name) as name from conversation_models group by key, provider, "providerName", "providerKey", id order by "providerName" nulls last, provider, id`
      );
      return {
        items: [...items],
        models: [...models],
        page,
        pageSize,
        projects: [...projects],
        total,
      };
    },
    { accessMode: "read only", isolationLevel: "repeatable read" }
  );
}

export async function getAdminConversation(
  id: string,
  requestedPage = 1,
  preview = false
): Promise<ConversationDetail | null> {
  return await db.transaction(
    async (tx) => {
      const [record] = await tx.execute<ConversationRecord>(
        sql`${modelCte} select ${fields} from ${source} where c.id = ${id}`
      );
      if (!record) {
        return null;
      }
      const pageSize = preview ? 3 : 50;
      const page = Math.min(
        requestedPage,
        Math.max(1, Math.ceil(record.messageCount / pageSize))
      );
      const messages = await tx.execute<{
        id: string;
        role: string;
        createdAt: string;
        parts: unknown;
      }>(
        sql`select id, role, parts, to_char("createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "createdAt" from "Message_v2" where "chatId" = ${id} order by "createdAt" ${preview ? sql`desc` : sql`asc`}, id limit ${pageSize} offset ${preview ? 0 : (page - 1) * pageSize}`
      );
      const mapped = messages.map(({ parts, ...item }) => ({
        ...item,
        text: conversationText(parts),
      }));
      return {
        messages: preview ? mapped.reverse() : mapped,
        page,
        record,
        total: record.messageCount,
      };
    },
    { accessMode: "read only", isolationLevel: "repeatable read" }
  );
}
