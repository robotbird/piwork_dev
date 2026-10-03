import "../support/db-env";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { hash } from "bcrypt-ts";
import { encode } from "next-auth/jwt";
import postgres from "postgres";
import { registerSandboxAcquired } from "../../lib/db/sandbox-queries";
import { DockerSandboxProvider } from "../../lib/runtime/sandbox/docker/provider";

// Explicit Docker integration. Only creates and removes its own disposable fixtures.
const base = process.env.SANDBOX_TEST_URL ?? "http://localhost:3000";
const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
const userId = crypto.randomUUID();
const taskOwner = crypto.randomUUID();
const email = `sandbox-http-${userId.slice(0, 8)}@test.local`;
const provider = new DockerSandboxProvider({ pull: "never" });
const created: string[] = [];
const secret = process.env.AUTH_SECRET;
assert.ok(secret, "AUTH_SECRET is required");
const cookie = `authjs.session-token=${await encode({ salt: "authjs.session-token", secret, token: { email, id: userId, sub: userId, type: "regular" } })}`;
const request = (method: string, body?: unknown) =>
  fetch(`${base}/api/admin/sandboxes`, {
    headers: { "Content-Type": "application/json", Cookie: cookie },
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
let keep = false;
try {
  const password = await hash("test123456", 10);
  await sql`INSERT INTO "User" (id, email, password, name) VALUES (${userId}, ${email}, ${password}, 'MVP 测试管理员')`;
  await sql`INSERT INTO "User" (id, email, name) VALUES (${taskOwner}, ${`sandbox-owner-${taskOwner.slice(0, 8)}@test.local`}, 'MVP 测试用户')`;
  const chatId = crypto.randomUUID();
  await sql`INSERT INTO "Chat" (id, "userId", title, "createdAt", "updatedAt") VALUES (${chatId}, ${taskOwner}, '沙箱 MVP 联调', now(), now())`;
  const spec = {
    chatId,
    egress: { mode: "deny-all" as const },
    image: "pi-runtime:dev",
    resource: { cpuCores: 2, memoryMB: 2048 },
    runId: crypto.randomUUID(),
    ttlSeconds: 3600,
    userId: taskOwner,
    workspaceVolume: { source: "ephemeral" },
  };
  const handle = await provider.acquire(spec);
  created.push(handle.id);
  await registerSandboxAcquired({
    ...spec,
    externalId: handle.id,
    provider: "docker",
    runtimeConfig: {
      egress: spec.egress,
      resource: spec.resource,
      workspaceRoot: handle.workspaceRoot,
    },
  });
  const list = await request("GET");
  assert.equal(list.status, 200);
  const find = async () =>
    (await (await request("GET")).json()).instances.find(
      (item: { externalId: string }) => item.externalId === handle.id
    );
  const before = await find();
  assert.equal(before.status, "ready");
  assert.equal(before.syncError, false);
  assert.equal(before.runtimeConfig.resource.cpuCores, 2);
  const taskURL = `${base}/api/admin/sandboxes/${before.id}/task?chatId=${chatId}`;
  const task = await fetch(taskURL, { headers: { Cookie: cookie } });
  assert.equal(task.status, 200);
  assert.equal((await task.json()).isReadonly, true);
  assert.equal(
    (
      await fetch(`${base}/api/messages?chatId=${chatId}`, {
        headers: { Cookie: cookie },
      })
    ).status,
    403
  );
  assert.equal(
    (
      await fetch(
        `${base}/api/admin/sandboxes/${before.id}/task?chatId=${crypto.randomUUID()}`,
        { headers: { Cookie: cookie } }
      )
    ).status,
    403
  );
  const renewal = await request("POST", {
    action: "renew",
    externalId: handle.id,
    provider: "docker",
  });
  assert.equal(renewal.status, 200);
  const after = await find();
  assert.ok(
    new Date(after.expiresAt).getTime() >=
      new Date(before.expiresAt).getTime() + 3_600_000
  );
  await provider.cliChecked(["pause", handle.id]);
  assert.equal((await find()).status, "paused");
  await provider.cliChecked(["unpause", handle.id]);
  const invalid = await request("POST", {
    action: "pause",
    externalId: handle.id,
    provider: "docker",
  });
  assert.equal(invalid.status, 400);
  const missing = await request("POST", {
    action: "destroy",
    externalId: "missing",
    provider: "docker",
  });
  assert.equal(missing.status, 404);
  const destroy = await request("POST", {
    action: "destroy",
    externalId: handle.id,
    provider: "docker",
  });
  assert.equal(destroy.status, 200);
  assert.equal(await provider.control.inspect(handle.id), null);
  assert.equal((await find()).status, "destroyed");
  assert.equal(
    (
      await request("POST", {
        action: "destroy",
        externalId: handle.id,
        provider: "docker",
      })
    ).status,
    200
  );
  assert.equal(
    (
      await request("POST", {
        action: "renew",
        externalId: handle.id,
        provider: "docker",
      })
    ).status,
    409
  );
  await sql`INSERT INTO "Member" ("userId", role, status) VALUES (${userId}, 'member', 'enabled')`;
  assert.equal((await request("GET")).status, 401);
  assert.equal((await fetch(taskURL, { headers: { Cookie: cookie } })).status, 401);
  assert.equal(
    (
      await request("POST", {
        action: "destroy",
        externalId: handle.id,
        provider: "docker",
      })
    ).status,
    401
  );
  await sql`UPDATE "Member" SET role = 'admin' WHERE "userId" = ${userId}`;
  if (process.env.SANDBOX_HTTP_PREVIEW === "1") {
    const preview = await provider.acquire({
      ...spec,
      runId: crypto.randomUUID(),
    });
    created.push(preview.id);
    await registerSandboxAcquired({
      ...spec,
      externalId: preview.id,
      provider: "docker",
      runtimeConfig: {
        egress: spec.egress,
        resource: spec.resource,
        workspaceRoot: preview.workspaceRoot,
      },
    });
    await writeFile(
      "/tmp/piwork-sandbox-preview.json",
      JSON.stringify({ chatId, email, externalIds: created, userId, taskOwner })
    );
    keep = true;
    console.log(`Preview account: ${email}`);
  }
  console.log(
    "Sandbox HTTP: real Docker status/pause/renew/destroy, idempotency and administrator authorization passed."
  );
} finally {
  if (!keep) {
    await Promise.all(created.map((id) => provider.control.destroy(id)));
    await sql`DELETE FROM "Chat" WHERE "userId" IN (${userId}, ${taskOwner})`;
    await sql`DELETE FROM "User" WHERE id IN (${userId}, ${taskOwner})`;
  }
  await sql.end();
}
process.exit(0);
