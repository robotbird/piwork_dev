import "../../support/db-env";
import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import { conversationFilters } from "../../../lib/admin/conversations";
import {
  getAdminConversation,
  listAdminConversations,
} from "../../../lib/db/conversation-queries";

const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });

test("admin conversations search, latest status, UTC dates, pagination and text-only details", async () => {
  const userId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const chatId = crypto.randomUUID();
  const oldId = crypto.randomUUID();
  const prefix = `records-${crypto.randomUUID()}`;
  try {
    await sql`insert into "User" (id, email, name) values (${userId}, ${`${prefix}@test.local`}, 'Records user')`;
    await sql`insert into "Project" (id, name, "userId") values (${projectId}, ${prefix}, ${userId})`;
    await sql`insert into "Chat" (id, title, "userId", "projectId", "createdAt", "updatedAt") values (${chatId}, ${`${prefix}%_`}, ${userId}, ${projectId}, '2026-01-01 10:00:00', now() at time zone 'UTC'), (${oldId}, ${prefix}, ${userId}, null, '2020-01-01', '2020-01-01')`;
    await sql`insert into "AgentRun" (id, "chatId", "userId", status, "createdAt") values (${crypto.randomUUID()}, ${chatId}, ${userId}, 'failed', now() - interval '1 hour'), (${crypto.randomUUID()}, ${chatId}, ${userId}, 'settled', now())`;
    await Promise.all(
      Array.from(
        { length: 4 },
        (_, index) =>
          sql`insert into "Message_v2" (id, "chatId", role, "createdAt", parts, attachments) values (${crypto.randomUUID()}, ${chatId}, 'user', ${`2026-01-01 10:0${index}:00`}, ${sql.json(
            [
              { text: `Text ${index}`, type: "text" },
              { text: "private", type: "reasoning" },
            ]
          )}, '[]')`
      )
    );
    const list = await listAdminConversations(
      conversationFilters.parse({ days: "all", query: prefix })
    );
    assert.equal(list.total, 2);
    assert.equal(
      list.items.find((item) => item.id === chatId)?.status,
      "settled"
    );
    assert.equal(list.items.find((item) => item.id === oldId)?.status, "none");
    assert.equal(
      (
        await listAdminConversations(
          conversationFilters.parse({ query: prefix })
        )
      ).total,
      1
    );
    assert.equal(
      (
        await listAdminConversations(
          conversationFilters.parse({
            days: "all",
            project: projectId,
            query: "%_",
          })
        )
      ).total,
      1
    );
    assert.equal(
      (
        await listAdminConversations(
          conversationFilters.parse({
            days: "all",
            project: projectId,
            status: "failed",
          })
        )
      ).total,
      0
    );
    const clamped = await listAdminConversations(
      conversationFilters.parse({ days: "all", page: 1000, query: prefix })
    );
    assert.equal(clamped.page, 1);
    const detail = await getAdminConversation(chatId);
    assert.equal(detail?.record.createdAt, "2026-01-01T10:00:00.000Z");
    assert.equal(detail?.record.messageCount, 4);
    assert.deepEqual(
      detail?.messages.map((item) => item.text),
      ["Text 0", "Text 1", "Text 2", "Text 3"]
    );
    assert.deepEqual(
      (await getAdminConversation(chatId, 1, true))?.messages.map(
        (item) => item.text
      ),
      ["Text 1", "Text 2", "Text 3"]
    );
    assert.equal(await getAdminConversation(crypto.randomUUID()), null);
  } finally {
    await sql`delete from "Message_v2" where "chatId" in (${chatId}, ${oldId})`;
    await sql`delete from "Chat" where "userId" = ${userId}`;
    await sql`delete from "Project" where id = ${projectId}`;
    await sql`delete from "User" where id = ${userId}`;
    await sql.end();
  }
});
