import "../support/db-env";
import assert from "node:assert/strict";
import { encode } from "next-auth/jwt";
import postgres from "postgres";
import type {
  ConversationDetail,
  ConversationList,
} from "../../lib/admin/conversations";

// Disposable identities, no real model/provider calls and no user chat modifications.
const base = process.env.CONVERSATION_TEST_URL ?? "http://localhost:3000";
const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
const admin = crypto.randomUUID();
const owner = crypto.randomUUID();
const chat = crypto.randomUUID();
const run = crypto.randomUUID();
const title = `conversation-http-${chat}`;
const secret = process.env.AUTH_SECRET;
assert.ok(secret, "AUTH_SECRET is required");
async function cookie(id: string) {
  return `authjs.session-token=${await encode({ salt: "authjs.session-token", secret: secret as string, token: { email: `${id}@test.local`, id, sub: id, type: "regular" } })}`;
}
const adminCookie = await cookie(admin);
const ownerCookie = await cookie(owner);
try {
  // Read only public supplier metadata, never activate a provider or copy credentials.
  const [provider] = await sql<
    { id: string; providerKey: string; displayName: string }[]
  >`select id, "providerKey", "displayName" from "ModelProviderPlugin" order by "providerKey" limit 1`;
  const runtimeProvider = provider
    ? `installation:${provider.id}`
    : "http-test";
  await sql`insert into "User" (id, email) values (${admin}, ${`${admin}@test.local`}), (${owner}, ${`${owner}@test.local`})`;
  await sql`insert into "Member" ("userId", role, status) values (${admin}, 'admin', 'enabled'), (${owner}, 'member', 'enabled')`;
  await sql`insert into "Chat" (id, "userId", title, "createdAt", "updatedAt") values (${chat}, ${owner}, ${title}, now() at time zone 'UTC', now() at time zone 'UTC')`;
  await sql`insert into "AgentRun" (id, "chatId", "userId", status, "requestedModel") values (${run}, ${chat}, ${owner}, 'settled', ${sql.json({ id: "selected", name: "Selected model", provider: runtimeProvider })})`;
  await sql`insert into "RuntimeEvent" ("runId", seq, type, data) values (${run}, 1, 'message.completed', ${sql.json({ model: { id: "actual", provider: runtimeProvider }, sequence: 1, usage: { cacheRead: 3, cacheWrite: 4, input: 10, output: 20, totalTokens: 37 } })})`;
  const listUrl = `${base}/api/admin/conversations?query=${title}`;
  const response = await fetch(listUrl, { headers: { Cookie: adminCookie } });
  assert.equal(response.status, 200);
  const data = (await response.json()) as ConversationList;
  assert.equal(data.total, 1);
  assert.equal(data.items[0].models[0].id, "actual");
  assert.equal(
    data.items[0].models[0].providerName,
    provider?.displayName ?? null
  );
  assert.equal(
    data.items[0].models[0].providerKey,
    provider?.providerKey ?? null
  );
  assert.equal(data.items[0].usage?.totalTokens, 37);
  const detailResponse = await fetch(
    `${base}/api/admin/conversations/${chat}`,
    { headers: { Cookie: adminCookie } }
  );
  assert.equal(detailResponse.status, 200);
  const detail = (await detailResponse.json()) as ConversationDetail;
  assert.deepEqual(detail.record.usage, data.items[0].usage);
  assert.deepEqual(detail.record.models, data.items[0].models);
  const filtered = await fetch(
    `${listUrl}&model=${encodeURIComponent(data.items[0].models[0].key)}`,
    { headers: { Cookie: adminCookie } }
  );
  assert.equal(((await filtered.json()) as ConversationList).total, 1);
  assert.equal(
    (await fetch(listUrl, { headers: { Cookie: ownerCookie } })).status,
    401
  );
  assert.equal(
    (
      await fetch(`${base}/api/admin/conversations/${chat}`, {
        headers: { Cookie: ownerCookie },
      })
    ).status,
    401
  );
  assert.equal(
    (
      await fetch(`${base}/api/admin/conversations/invalid-id`, {
        headers: { Cookie: adminCookie },
      })
    ).status,
    400
  );
  const pageResponse = await fetch(`${base}/admin/conversations`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(pageResponse.status, 200);
  const html = await pageResponse.text();
  assert.ok(html.includes(title));
  assert.ok(html.includes("actual"));
  if (process.env.PIWORK_CONVERSATION_BROWSER_TESTS === "1") {
    const { chromium, expect } = await import("@playwright/test");
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext();
      await context.addCookies([
        {
          name: "authjs.session-token",
          url: base,
          value: adminCookie.slice("authjs.session-token=".length),
        },
      ]);
      const page = await context.newPage();
      await page.goto(`${base}/admin/conversations`);
      await page.getByRole("textbox").first().fill(title);
      const row = page.locator("tbody tr").filter({ hasText: title });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText("actual");
      if (provider) {
        await expect(row).toContainText(provider.displayName);
        const iconResponse = await fetch(
          `${base}/api/models/icon?provider=${encodeURIComponent(provider.providerKey)}`
        );
        if (iconResponse.ok) {
          const selector = `img[src*="/api/models/icon?provider=${provider.providerKey}"]`;
          await page.waitForFunction(
            (imageSelector) =>
              [
                ...document.querySelectorAll<HTMLImageElement>(imageSelector),
              ].some((image) => image.complete && image.naturalWidth > 0),
            selector
          );
          const filter = page.getByRole("combobox", { name: /^(模型|Model)$/ });
          await filter.click();
          await page
            .getByRole("option", {
              exact: true,
              name: `actual · ${provider.displayName}`,
            })
            .click();
          await expect(filter).toContainText(provider.displayName);
          await row.getByRole("button", { exact: true, name: title }).click();
          await expect(page.locator(selector)).toHaveCount(3); // list, filter trigger, detail
          await page.route(
            `**/api/models/icon?provider=${provider.providerKey}`,
            (route) => route.abort()
          );
          await page.reload();
          await page.waitForFunction(
            (imageSelector) =>
              document.querySelectorAll(imageSelector).length === 0,
            selector
          );
          await expect(
            page.locator("tbody tr").filter({ hasText: title })
          ).toContainText(provider.displayName);
        }
      } else {
        await expect(row).toContainText(/未知供应商|Unknown provider/);
      }
      assert.equal(
        (await page.locator("body").innerText()).includes("installation:"),
        false
      );
      console.log(
        "Conversation browser: supplier label/logo/filter/detail/fallback assertions passed"
      );
    } finally {
      await browser.close();
    }
  }
  console.log(
    "Conversation HTTP: supplier/model/usage/filter/page/admin-only assertions passed"
  );
} finally {
  await sql`delete from "Chat" where id = ${chat}`;
  await sql`delete from "Member" where "userId" in (${admin}, ${owner})`;
  await sql`delete from "User" where id in (${admin}, ${owner})`;
  await sql.end();
}
