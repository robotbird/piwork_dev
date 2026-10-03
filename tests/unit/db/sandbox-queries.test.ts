import "../../support/db-env";
import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import {
  expireOverdueSandboxInstances,
  findReusableSandboxExternalId,
  listSandboxInstances,
  markSandboxDestroyed,
  markSandboxRenewed,
  markSandboxStatus,
  observeSandboxInstance,
  registerSandboxAcquired,
} from "../../../lib/db/sandbox-queries";

const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1, connection: { TimeZone: "UTC" } });
const owner = crypto.randomUUID();
const other = crypto.randomUUID();

async function createChat(userId: string, title: string): Promise<string> {
  const id = crypto.randomUUID();
  await sql`INSERT INTO "Chat" (id, "userId", title, "createdAt", "updatedAt")
    VALUES (${id}, ${userId}, ${title}, now(), now())`;
  return id;
}

test.before(async () => {
  await sql`INSERT INTO "User" (id, email) VALUES (${owner}, ${`${owner}@test.local`}), (${other}, ${`${other}@test.local`})`;
});

test.after(async () => {
  // Chat → SandboxInstance 级联；Chat 对 User 无级联，需先删 Chat（清理约定）
  await sql`DELETE FROM "Chat" WHERE "userId" IN (${owner}, ${other})`;
  await sql`DELETE FROM "User" WHERE id IN (${owner}, ${other})`;
  await sql.end();
});

test("register 幂等 upsert：chat 复用下同一 (provider, externalId) 更新而非新行", async () => {
  const chatId = await createChat(owner, "sandbox-queries-upsert");
  const runA = crypto.randomUUID();
  const runB = crypto.randomUUID();
  await registerSandboxAcquired({
    provider: "test",
    externalId: "sbx-upsert-1",
    chatId,
    userId: owner,
    runId: runA,
    image: "pi-runtime-test:1",
    ttlSeconds: 60,
  });
  await registerSandboxAcquired({
    provider: "test",
    externalId: "sbx-upsert-1",
    chatId,
    userId: owner,
    runId: runB,
    image: "pi-runtime-test:1",
    ttlSeconds: 120,
  });
  const rows = await listSandboxInstances();
  const mine = rows.filter((r) => r.externalId === "sbx-upsert-1");
  assert.equal(mine.length, 1);
  assert.equal(mine[0].lastRunId, runB);
  assert.equal(mine[0].ttlSeconds, 120);
  assert.equal(mine[0].status, "ready");
  assert.equal(mine[0].userEmail, `${owner}@test.local`);
  assert.equal(mine[0].chatTitle, "sandbox-queries-upsert");
});

test("renew 平移到期时刻；终态沙箱不再续期", async () => {
  const chatId = await createChat(owner, "sandbox-queries-renew");
  await registerSandboxAcquired({
    provider: "docker",
    externalId: "sbx-renew-1",
    chatId,
    userId: owner,
    runId: crypto.randomUUID(),
    image: "pi-runtime-dev:1",
    ttlSeconds: 3600,
  });
  const before = (await listSandboxInstances()).find(
    (r) => r.externalId === "sbx-renew-1",
  );
  assert.ok(before);
  const renewed = await markSandboxRenewed("docker", "sbx-renew-1", 3600);
  assert.equal(renewed, true);
  const after = (await listSandboxInstances()).find(
    (r) => r.externalId === "sbx-renew-1",
  );
  assert.ok(after);
  assert.ok(after.expiresAt > before.expiresAt);
  assert.ok(after.lastRenewedAt >= before.lastRenewedAt);

  // destroyed 后续期应无效
  await markSandboxDestroyed("docker", "sbx-renew-1");
  assert.equal(await markSandboxRenewed("docker", "sbx-renew-1", 3600), false);
});

test("惰性过期：到期活沙箱收敛 expired；activeOnly 过滤；复用查询只命中 ready 未过期", async () => {
  const chatId = await createChat(owner, "sandbox-queries-expiry");
  await registerSandboxAcquired({
    provider: "opensandbox",
    externalId: "sbx-expired-1",
    chatId,
    userId: owner,
    runId: crypto.randomUUID(),
    image: "pi-runtime-prod:1",
    ttlSeconds: 60,
  });
  await registerSandboxAcquired({
    provider: "opensandbox",
    externalId: "sbx-alive-1",
    chatId,
    userId: owner,
    runId: crypto.randomUUID(),
    image: "pi-runtime-prod:1",
    ttlSeconds: 3600,
  });
  // 把一个拨到过期
  await sql`UPDATE "SandboxInstance" SET "expiresAt" = now() - interval '5 minutes'
    WHERE "externalId" = 'sbx-expired-1'`;

  const reusable = await findReusableSandboxExternalId({
    chatId,
    provider: "opensandbox",
    image: "pi-runtime-prod:1",
  });
  assert.equal(reusable, "sbx-alive-1");

  const expiredCount = await expireOverdueSandboxInstances();
  assert.ok(expiredCount >= 1);
  const rows = await listSandboxInstances();
  const expired = rows.find((r) => r.externalId === "sbx-expired-1");
  assert.equal(expired?.status, "expired");
  // 过期后不再可复用
  assert.equal(
    await findReusableSandboxExternalId({
      chatId,
      provider: "opensandbox",
      image: "pi-runtime-prod:1",
    }),
    "sbx-alive-1",
  );
  // 复用查询按镜像隔离
  assert.equal(
    await findReusableSandboxExternalId({
      chatId,
      provider: "opensandbox",
      image: "pi-runtime-other:9",
    }),
    null,
  );

  const active = await listSandboxInstances({ activeOnly: true });
  assert.ok(
    active.every((r) => !["destroyed", "expired"].includes(r.status)),
  );
});

test("markSandboxStatus 未知 externalId 返回 false", async () => {
  assert.equal(await markSandboxStatus("docker", "no-such-sbx", "degraded"), false);
});

test("provider deadlines preserve timezone, late observations cannot revive destroyed instances", async () => {
  const chatId = await createChat(owner, "sandbox-observation");
  await registerSandboxAcquired({ provider: "docker", externalId: "observed-sandbox", chatId, userId: owner, runId: crypto.randomUUID(), image: "test", ttlSeconds: 3600,
    runtimeConfig: { resource: { cpuCores: 2, memoryMB: 2048 }, egress: { mode: "deny-all" }, workspaceRoot: "/workspace" } });
  const expiresAt = new Date(Date.now() + 7_200_000);
  await observeSandboxInstance("docker", "observed-sandbox", { status: "ready", expiresAt }, true);
  const row = (await listSandboxInstances()).find((item) => item.externalId === "observed-sandbox");
  assert.ok(row); assert.equal(row.expiresAt.getTime(), expiresAt.getTime()); assert.equal(row.runtimeConfig?.resource.cpuCores, 2);
  await markSandboxRenewed("docker", "observed-sandbox", 60);
  assert.equal((await listSandboxInstances()).find((item) => item.externalId === "observed-sandbox")?.expiresAt.getTime(), expiresAt.getTime());
  await observeSandboxInstance("docker", "observed-sandbox", { status: "destroyed" });
  await observeSandboxInstance("docker", "observed-sandbox", { status: "ready" });
  assert.equal((await listSandboxInstances()).find((item) => item.externalId === "observed-sandbox")?.status, "destroyed");
});
