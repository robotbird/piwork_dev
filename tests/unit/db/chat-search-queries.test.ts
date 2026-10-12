import "../../support/db-env";
import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import { searchAccessibleChats } from "@/lib/db/chat-search-queries";

const db = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
const owner = crypto.randomUUID();
const other = crypto.randomUUID();
const ids = Array.from({ length: 4 }, () => crypto.randomUUID());

test("chat search scopes access, searches text only, escapes wildcard and revokes sharing", async () => {
  try {
    await db`insert into "User" (id,email) values (${owner},${`${owner}@search.test`}),(${other},${`${other}@search.test`})`;
    await db`insert into "Member" ("userId",status) values (${owner},'enabled'),(${other},'enabled')`;
    await Promise.all(
      ids.map(async (id, index) => {
        await db`insert into "Chat" (id,title,"userId",visibility,"createdAt","updatedAt") values (${id},${index === 0 ? "literal_% title" : "generic"},${index === 0 ? owner : other},'private',now(),now())`;
        const parts = [
          { text: "needle body", type: index === 3 ? "reasoning" : "text" },
        ];
        await db`insert into "Message_v2" (id,"chatId",role,parts,attachments,"createdAt") values (${crypto.randomUUID()},${id},'assistant',${db.json(parts)},'[]'::json,now())`;
      })
    );
    await db`insert into "ChatCollaborator" ("chatId","userId") values (${ids[1]},${owner}),(${ids[3]},${owner})`;
    const matches = await searchAccessibleChats(owner, "needle");
    assert.deepEqual(
      new Set(matches.chats.map((c) => c.id)),
      new Set(ids.slice(0, 2))
    );
    assert.ok(matches.chats.every((c) => c.snippet?.includes("needle")));
    assert.deepEqual(
      (await searchAccessibleChats(owner, "_%")).chats.map((c) => c.id),
      [ids[0]]
    );
    assert.equal(
      (await searchAccessibleChats(owner, "no-match")).chats.length,
      0
    );
    assert.equal((await searchAccessibleChats(owner, "")).chats.length, 3);
    await db`delete from "ChatCollaborator" where "chatId"=${ids[1]} and "userId"=${owner}`;
    assert.equal(
      (await searchAccessibleChats(owner, "needle")).chats.length,
      1
    );
    await db`update "Member" set status='disabled' where "userId"=${owner}`;
    assert.equal((await searchAccessibleChats(owner, "")).chats.length, 0);
  } finally {
    await db`delete from "ChatCollaborator" where "chatId" in ${db(ids)}`;
    await db`delete from "Message_v2" where "chatId" in ${db(ids)}`;
    await db`delete from "Chat" where id in ${db(ids)}`;
    await db`delete from "Member" where "userId" in ${db([owner, other])}`;
    await db`delete from "User" where id in ${db([owner, other])}`;
    await db.end();
  }
});
