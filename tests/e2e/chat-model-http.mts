import "../support/db-env";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { sql } from "drizzle-orm";
import { encode } from "next-auth/jwt";
import { getDb } from "../../lib/db/client";

// No real model requests: intercept POST, but use a real independent enabled identity.
const base = process.env.CHAT_MODEL_TEST_URL ?? "http://localhost:3000";
const db = getDb();
const userId = crypto.randomUUID();
const projectId = crypto.randomUUID();
const chatId = crypto.randomUUID();
const secret = process.env.AUTH_SECRET;
assert.ok(secret);
const browser = await chromium.launch({ headless: true });
try {
  await db.execute(
    sql`insert into "User" (id,email) values (${userId},${`${userId}@test.local`})`
  );
  await db.execute(
    sql`insert into "Member" ("userId",role) values (${userId},'member')`
  );
  await db.execute(
    sql`insert into "Project" (id,"userId",name) values (${projectId},${userId},'Model regression')`
  );
  await db.execute(
    sql`insert into "Chat" (id,"userId","projectId",title,"createdAt") values (${chatId},${userId},${projectId},'New chat',now())`
  );
  const token = await encode({
    salt: "authjs.session-token",
    secret,
    token: { id: userId, sub: userId, type: "regular" },
  });
  for (const preference of [null, "removed/model", "installation:b/qwen"]) {
    // biome-ignore lint/performance/noAwaitInLoops: Keep isolated browser scenarios sequential.
    const context = await browser.newContext();
    await context.addCookies([
      { name: "authjs.session-token", url: base, value: token },
      ...(preference
        ? [
            {
              name: "chat-model",
              url: base,
              value: encodeURIComponent(preference),
            },
          ]
        : []),
    ]);
    const page = await context.newPage();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/models", async (route) => {
      await gate;
      await route.fulfill({
        json: {
          defaultModelId: "installation:a/default",
          models: [
            {
              id: "installation:a/default",
              name: "Default",
              provider: "installation:a",
            },
            {
              id: "installation:b/qwen",
              name: "Qwen",
              provider: "installation:b",
            },
          ],
        },
      });
    });
    const requests: Record<string, unknown>[] = [];
    await page.route("**/api/chat", async (route) => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({
        json: { cause: "Model not authorized", code: "forbidden:model" },
        status: 403,
      });
    });
    await page.goto(`${base}/projects/${projectId}/chat/${chatId}?query=hello`);
    await page.waitForTimeout(500);
    assert.equal(requests.length, 0, "query must wait for the model catalog");
    release();
    await page.waitForFunction(() => !window.location.search);
    await page
      .getByText(
        "The selected model is unavailable or not authorized. Please select an available model and try again."
      )
      .waitFor();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].id, chatId);
    assert.equal(
      requests[0].selectedChatModel,
      preference === "installation:b/qwen"
        ? preference
        : "installation:a/default"
    );
    await context.close();
  }
  console.log(
    "PASS: delayed catalog, absent/stale/valid cookie, single project query send, model error"
  );
} finally {
  await browser.close();
  await db.execute(sql`delete from "Chat" where id=${chatId}`);
  await db.execute(sql`delete from "Project" where id=${projectId}`);
  await db.execute(sql`delete from "User" where id=${userId}`);
}
process.exit(0);
