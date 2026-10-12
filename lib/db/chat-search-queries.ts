import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "./client";

export type ChatSearchResult = {
  id: string;
  title: string;
  snippet: string | null;
  sharedWithMe: boolean;
};

/** Literal substring search of titles and text parts only; never tool/reasoning payloads. */
export async function searchAccessibleChats(userId: string, query: string) {
  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await getDb().execute<ChatSearchResult>(sql`
    select c.id, c.title, (c."userId" <> ${userId}::uuid) as "sharedWithMe",
      case when ${query} = '' then null else (
        select substring(part->>'text' from greatest(1, strpos(lower(part->>'text'), lower(${query})) - 48) for 200)
        from "Message_v2" m cross join lateral json_array_elements(case when json_typeof(m.parts) = 'array' then m.parts else '[]'::json end) part
        where m."chatId" = c.id and part->>'type' = 'text'
          and part->>'text' ilike ${pattern}
        order by m."createdAt" desc limit 1
      ) end as snippet
    from "Chat" c
    where exists (select 1 from "Member" me where me."userId" = ${userId}::uuid and me.status = 'enabled')
      and (c."userId" = ${userId}::uuid or exists (
        select 1 from "ChatCollaborator" cc where cc."chatId" = c.id and cc."userId" = ${userId}::uuid))
      and (${query} = '' or c.title ilike ${pattern} or exists (
        select 1 from "Message_v2" m cross join lateral json_array_elements(case when json_typeof(m.parts) = 'array' then m.parts else '[]'::json end) part
        where m."chatId" = c.id and part->>'type' = 'text' and part->>'text' ilike ${pattern}))
    order by c."updatedAt" desc, c.id desc limit 51
  `);
  return { chats: Array.from(rows).slice(0, 50), hasMore: rows.length > 50 };
}
