import "../../support/db-env";
import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import { conversationFilters } from "../../../lib/admin/conversations";
import { createAgentRun } from "../../../lib/db/agent-run-queries";
import {
  getAdminConversation,
  listAdminConversations,
} from "../../../lib/db/conversation-queries";
import { PostgresEventStore } from "../../../lib/db/runtime-event-queries";

test("provider labels resolve installation identity and legacy keys without changing recorded models", {
  skip: !process.env.POSTGRES_URL,
}, async () => {
  const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
  const owner = crypto.randomUUID();
  const plugin = crypto.randomUUID();
  const key = `fixture-${plugin}`;
  const name = `Fixture Brand ${plugin}`;
  const runtimeProvider = `installation:${plugin}`;
  const chats = Array.from({ length: 3 }, () => crypto.randomUUID());
  try {
    await sql`insert into "User" (id, email) values (${owner}, ${`${plugin}@test.local`})`;
    await sql`insert into "ModelProviderPlugin" (id, "packageId", "providerKey", "displayName", version, definition, "encryptedCredentials", "buildHash", sha256, enabled) values (${plugin}, ${`piwork-llm-${key}`}, ${key}, ${name}, '1.0.0', '{"models":[{"modelId":"current-not-history"}]}'::json, 'must-not-leak', 'fixture', 'fixture', false)`;
    const providers = [runtimeProvider, key, "installation:not-a-uuid"];
    for (const [index, chat] of chats.entries()) {
      // biome-ignore lint/performance/noAwaitInLoops: ordered fixture assembly
      await sql`insert into "Chat" (id, title, "userId", "createdAt", "updatedAt") values (${chat}, ${plugin}, ${owner}, now() at time zone 'UTC', now() at time zone 'UTC')`;
      await createAgentRun({
        backend: "in_process",
        chatId: chat,
        requestedModel: {
          id: "recorded-model",
          name: "Recorded Model",
          provider: providers[index],
        },
        userId: owner,
      });
    }
    const detail = await getAdminConversation(chats[0]);
    assert.equal(detail?.record.models[0].provider, runtimeProvider);
    assert.equal(detail?.record.models[0].providerName, name);
    assert.equal(detail?.record.models[0].providerKey, key);
    assert.equal(detail?.record.models[0].id, "recorded-model");
    assert.equal(detail?.record.models[0].name, "Recorded Model");
    assert.equal(JSON.stringify(detail).includes("must-not-leak"), false);
    const legacy = await getAdminConversation(chats[1]);
    assert.equal(legacy?.record.models[0].providerName, name);
    const unknown = await getAdminConversation(chats[2]);
    assert.equal(unknown?.record.models[0].providerName, null);
    assert.equal(unknown?.record.models[0].providerKey, null);
    const list = await listAdminConversations(
      conversationFilters.parse({ query: name })
    );
    assert.equal(list.total, 2);
    assert.ok(
      list.models.some(
        (model) =>
          model.provider === runtimeProvider &&
          model.providerName === name &&
          model.providerKey === key
      )
    );
    const filterKey = detail?.record.models[0].key;
    assert.ok(filterKey);
    const filtered = await listAdminConversations(
      conversationFilters.parse({ model: filterKey, query: name })
    );
    assert.equal(filtered.total, 1);
    assert.equal(filtered.items[0].id, chats[0]);
    await sql`delete from "ModelProviderPlugin" where id = ${plugin}`;
    const removed = await getAdminConversation(chats[0]);
    assert.equal(removed?.record.models[0].providerName, null);
    assert.equal(removed?.record.models[0].id, "recorded-model");
    assert.equal(removed?.record.models[0].provider, runtimeProvider);
  } finally {
    await sql`delete from "Chat" where "userId" = ${owner}`;
    await sql`delete from "ModelProviderPlugin" where id = ${plugin}`;
    await sql`delete from "User" where id = ${owner}`;
    await sql.end();
  }
});

const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
test("conversation usage sums persisted events once and models survive switching and missing history", async () => {
  const owner = crypto.randomUUID();
  const chats = Array.from({ length: 4 }, () => crypto.randomUUID());
  const [chat, unknown, zero, audited] = chats;
  const prefix = `usage-${crypto.randomUUID()}`;
  const requested = {
    id: "alias",
    name: "Friendly alias",
    provider: "provider-a",
  };
  const store = new PostgresEventStore();
  try {
    await sql`insert into "User" (id, email) values (${owner}, ${`${prefix}@test.local`})`;
    await Promise.all(
      chats.map(
        (id) =>
          sql`insert into "Chat" (id, title, "userId", "createdAt", "updatedAt") values (${id}, ${prefix}, ${owner}, now() at time zone 'UTC', now() at time zone 'UTC')`
      )
    );
    const run = await createAgentRun({
      backend: "in_process",
      chatId: chat,
      requestedModel: requested,
      userId: owner,
    });
    const [{ snapshot }] =
      await sql`select "requestedModel" as snapshot from "AgentRun" where id = ${run}`;
    assert.deepEqual(snapshot, requested);
    const first = {
      data: {
        model: {
          id: "alias",
          provider: "provider-a",
          responseModel: "actual-v1",
        },
        sequence: 1,
        usage: {
          cacheRead: 30,
          cacheWrite: 40,
          input: 10,
          output: 20,
          totalTokens: 100,
        },
      },
      runId: run,
      seq: 1,
      type: "message.completed",
    };
    await store.append(first);
    await store.append(first); // EventStore cursor idempotency; never sum replay twice.
    await store.append({
      ...first,
      data: {
        ...first.data,
        sequence: 2,
        usage: {
          cacheRead: 0,
          cacheWrite: 0,
          input: 5,
          output: 10,
          totalTokens: 15,
        },
      },
      seq: 2,
    });
    await store.append({
      data: { sequence: 3 },
      runId: run,
      seq: 3,
      type: "message.completed",
    });
    await createAgentRun({
      backend: "sandbox_rpc",
      chatId: chat,
      requestedModel: {
        id: "second",
        name: "Second model",
        provider: "provider-b",
      },
      userId: owner,
    });
    const emptyRun = await createAgentRun({
      backend: "in_process",
      chatId: unknown,
      userId: owner,
    });
    const zeroRun = await createAgentRun({
      backend: "in_process",
      chatId: zero,
      requestedModel: requested,
      userId: owner,
    });
    await store.append({
      data: {
        usage: {
          cacheRead: 0,
          cacheWrite: 0,
          input: 0,
          output: 0,
          totalTokens: 0,
        },
      },
      runId: zeroRun,
      seq: 1,
      type: "message.completed",
    });
    const auditRun = await createAgentRun({
      backend: "sandbox_rpc",
      chatId: audited,
      userId: owner,
    });
    await sql`insert into "InferenceAccessAudit" (action, status, "chatId", "runId", provider, model, "inputTokens", "outputTokens") values ('stream', 'allowed', ${audited}, ${auditRun}, 'legacy-provider', 'legacy-model', 99, 88), ('stream', 'denied', ${audited}, ${auditRun}, 'denied-provider', 'must-not-show', 0, 0), ('stream', 'allowed', ${unknown}, ${emptyRun}, 'other-provider', 'other-model', 1, 1)`;
    const detail = await getAdminConversation(chat);
    assert.deepEqual(detail?.record.usage, {
      cacheRead: 30,
      cacheWrite: 40,
      input: 15,
      output: 30,
      totalTokens: 115,
    });
    assert.equal(detail?.record.usageRecordedMessages, 2);
    assert.equal(detail?.record.completedMessages, 3);
    assert.equal(detail?.record.unrecordedRuns, 1);
    assert.deepEqual(
      detail?.record.models.map(({ provider, id, source }) => ({
        id,
        provider,
        source,
      })),
      [
        { id: "actual-v1", provider: "provider-a", source: "response" },
        { id: "second", provider: "provider-b", source: "request" },
      ]
    );
    const unknownDetail = await getAdminConversation(unknown);
    assert.equal(unknownDetail?.record.usage, null);
    assert.equal(
      (await getAdminConversation(zero))?.record.usage?.totalTokens,
      0
    );
    const legacy = await getAdminConversation(audited);
    assert.equal(legacy?.record.models[0].source, "audit");
    assert.equal(legacy?.record.models[0].id, "legacy-model");
    assert.equal(legacy?.record.models.length, 1);
    assert.equal(legacy?.record.usage, null); // Proxy partial input/output must not be double-counted or treated as full usage.
    const key = detail?.record.models[0].key;
    assert.ok(key);
    const filtered = await listAdminConversations(
      conversationFilters.parse({ model: key, query: prefix })
    );
    assert.equal(filtered.total, 1);
    assert.equal(filtered.items[0].id, chat);
    const byModel = await listAdminConversations(
      conversationFilters.parse({ query: "actual-v1" })
    );
    assert.ok(byModel.items.some((item) => item.id === chat));
    assert.ok(filtered.models.some((item) => item.id === "actual-v1"));
  } finally {
    await sql`delete from "InferenceAccessAudit" where "chatId" in ${sql(chats)}`;
    await sql`delete from "Chat" where "userId" = ${owner}`;
    await sql`delete from "User" where id = ${owner}`;
    await sql.end();
  }
});
