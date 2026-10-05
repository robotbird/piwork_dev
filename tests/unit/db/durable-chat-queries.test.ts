import "../../support/db-env";
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import postgres from "postgres";
import {
  canExecuteDurableChatRun,
  isEnabledDurableChatUser,
} from "../../../lib/db/durable-chat-queries";
import { getLibraryFileByUrl } from "../../../lib/db/library-queries";

const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
const owner = crypto.randomUUID();
const other = crypto.randomUUID();
const chatId = crypto.randomUUID();
const runId = crypto.randomUUID();
const fileUrl = `/api/files/durable-chat-${crypto.randomUUID()}`;
test.before(async () => {
  await sql`INSERT INTO "User" (id, email) VALUES (${owner}, ${`${owner}@test.local`}), (${other}, ${`${other}@test.local`})`;
  await sql`INSERT INTO "Member" ("userId", status) VALUES (${owner}, 'enabled'), (${other}, 'disabled')`;
  await sql`INSERT INTO "Chat" (id, "userId", title, "createdAt", "updatedAt") VALUES (${chatId}, ${owner}, 'durable-chat-authorization', now(), now())`;
  await sql`INSERT INTO "AgentRun" (id, "userId", "chatId", status, backend) VALUES (${runId}, ${owner}, ${chatId}, 'running', 'durable_sandbox')`;
  await sql`INSERT INTO "LibraryItem" ("userId", name, kind, source, url) VALUES (${owner}, 'owned.txt', 'file', 'upload', ${fileUrl})`;
});
test.after(async () => {
  await sql`DELETE FROM "LibraryItem" WHERE "userId" IN (${owner}, ${other})`;
  await sql`DELETE FROM "Chat" WHERE id = ${chatId}`;
  await sql`DELETE FROM "User" WHERE id IN (${owner}, ${other})`;
  await sql.end();
});

test("formal Durable chat grant requires enabled account + chat/run ownership + actual backend + active status", async () => {
  assert.equal(await isEnabledDurableChatUser(owner), true);
  assert.equal(await isEnabledDurableChatUser(other), false);
  assert.equal(await canExecuteDurableChatRun(owner, chatId, runId), true);
  assert.equal(await canExecuteDurableChatRun(other, chatId, runId), false);
  assert.equal(
    await canExecuteDurableChatRun(owner, crypto.randomUUID(), runId),
    false
  );
  await sql`UPDATE "Member" SET status = 'disabled' WHERE "userId" = ${owner}`;
  assert.equal(await canExecuteDurableChatRun(owner, chatId, runId), false);
  await sql`UPDATE "Member" SET status = 'enabled' WHERE "userId" = ${owner}`;
  await sql`UPDATE "User" SET "isAnonymous" = true WHERE id = ${owner}`;
  assert.equal(await canExecuteDurableChatRun(owner, chatId, runId), false);
  await sql`UPDATE "User" SET "isAnonymous" = false WHERE id = ${owner}`;
  await sql`UPDATE "AgentRun" SET backend = 'sandbox_rpc' WHERE id = ${runId}`;
  assert.equal(await canExecuteDurableChatRun(owner, chatId, runId), false);
  await sql`UPDATE "AgentRun" SET backend = 'durable_sandbox', status = 'settled' WHERE id = ${runId}`;
  assert.equal(await canExecuteDurableChatRun(owner, chatId, runId), false);
});
test("development availability/admission still require formal enabled membership, not a whitelist", async () => {
  const { assertDurableChatAdmission, durableChatAvailable } = await import(
    "../../../lib/runtime/run/durable-chat"
  );
  const patch = {
    NODE_ENV: "development",
    PIWORK_DISABLE_EXECUTION_TOOLS: "",
    PIWORK_DURABLE_CHAT_ENABLED: "1",
    PIWORK_DURABLE_CHAT_USER_IDS: "",
    PIWORK_DURABLE_STORAGE_DIR: path.resolve(".private-durable-test"),
    PIWORK_RUNTIME_BACKEND: "",
    PIWORK_SANDBOX_PROVIDER: "opensandbox",
    UPLOAD_DIR: path.resolve(".private-upload-test"),
  };
  const previous = new Map(
    Object.keys(patch).map((key) => [key, process.env[key]])
  );
  Object.assign(process.env, patch);
  try {
    assert.equal(await durableChatAvailable(owner), true);
    await assertDurableChatAdmission(owner);
    assert.equal(await durableChatAvailable(other), false);
    await assert.rejects(() => assertDurableChatAdmission(other));
    await sql`UPDATE "Member" SET status = 'enabled' WHERE "userId" = ${other}`;
    assert.equal(await durableChatAvailable(other), true);
    await assertDurableChatAdmission(other);
    await sql`UPDATE "User" SET "isAnonymous" = true WHERE id = ${other}`;
    assert.equal(await durableChatAvailable(other), false);
    await assert.rejects(() => assertDurableChatAdmission(other));
    await sql`UPDATE "User" SET "isAnonymous" = false WHERE id = ${other}`;
    await sql`DELETE FROM "Member" WHERE "userId" = ${other}`;
    assert.equal(await durableChatAvailable(other), false);
    await assert.rejects(() => assertDurableChatAdmission(other));
    assert.equal(await durableChatAvailable(crypto.randomUUID()), false);
    process.env.PIWORK_DURABLE_CHAT_ENABLED = "0";
    assert.equal(await durableChatAvailable(owner), false);
    await assert.rejects(() => assertDurableChatAdmission(owner));
  } finally {
    await sql`UPDATE "User" SET "isAnonymous" = false WHERE id = ${other}`;
    await sql`INSERT INTO "Member" ("userId", status) VALUES (${other}, 'disabled') ON CONFLICT ("userId") DO UPDATE SET status = 'disabled'`;
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});
test("authorized attachment URL lookup never returns another user's library file", async () => {
  assert.equal((await getLibraryFileByUrl(owner, fileUrl))?.userId, owner);
  assert.equal(await getLibraryFileByUrl(other, fileUrl), undefined);
});
