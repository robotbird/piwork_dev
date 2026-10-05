import "../support/db-env";
import assert from "node:assert/strict";
import { encode } from "next-auth/jwt";
import postgres from "postgres";
import type { TokenStatistics } from "../../lib/admin/token-statistics";

const base = process.env.TOKEN_TEST_URL ?? "http://localhost:3000";
const db = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
const admin = crypto.randomUUID();
const owner = crypto.randomUUID();
const department = crypto.randomUUID();
const chat = crypto.randomUUID();
const run = crypto.randomUUID();
const secret = process.env.AUTH_SECRET;
assert.ok(secret, "AUTH_SECRET is required");
async function cookie(id: string) {
  return `authjs.session-token=${await encode({ salt: "authjs.session-token", secret: secret as string, token: { email: `${id}@test.local`, id, sub: id, type: "regular" } })}`;
}
const adminCookie = await cookie(admin);
const ownerCookie = await cookie(owner);
try {
  await db`insert into "User" (id, email) values (${admin}, ${`${admin}@test.local`}), (${owner}, ${`${owner}@test.local`})`;
  await db`insert into "Department" (id, name) values (${department}, ${`Token fixture ${department}`})`;
  await db`insert into "Member" ("userId", role, status, "departmentId") values (${admin}, 'admin', 'enabled', null), (${owner}, 'member', 'enabled', ${department})`;
  await db`insert into "Chat" (id, "userId", title, "createdAt") values (${chat}, ${owner}, 'Token HTTP fixture', now())`;
  await db`insert into "AgentRun" (id, "chatId", "userId", status) values (${run}, ${chat}, ${owner}, 'settled')`;
  await db`insert into "RuntimeEvent" ("runId", seq, type, data) values (${run}, 1, 'message.completed', '{"usage":{"input":10,"output":20,"cacheRead":3,"cacheWrite":4,"totalTokens":37},"model":{"provider":"fixture","id":"test-model"}}'::json)`;
  const [{ day }] = await db<
    { day: string }[]
  >`select to_char(now(), 'YYYY-MM-DD') as day`;
  const url = `${base}/api/admin/token-statistics?start=${day}&end=${day}&department=${department}`;
  const response = await fetch(url, { headers: { Cookie: adminCookie } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const data = (await response.json()) as TokenStatistics;
  assert.equal(data.summary.tokens, 37);
  assert.equal(data.summary.users, 1);
  assert.equal(data.summary.conversations, 1);
  assert.equal(data.models[0].key, "fixture / test-model");
  assert.equal(
    (await fetch(url, { headers: { Cookie: ownerCookie }, redirect: "manual" }))
      .status,
    401
  );
  assert.equal((await fetch(url, { redirect: "manual" })).status, 401);
  assert.equal(
    (
      await fetch(`${base}/api/admin/token-statistics?start=bad&end=${day}`, {
        headers: { Cookie: adminCookie },
      })
    ).status,
    400
  );
  assert.equal(
    (
      await fetch(`${base}/admin/token-statistics`, {
        headers: { Cookie: adminCookie },
      })
    ).status,
    200
  );
  if (process.env.PIWORK_TOKEN_BROWSER_TESTS === "1") {
    const { chromium, expect } = await import("@playwright/test");
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext({
        viewport: { height: 1100, width: 1440 },
      });
      await context.addCookies([
        {
          name: "authjs.session-token",
          url: base,
          value: adminCookie.slice("authjs.session-token=".length),
        },
      ]);
      const page = await context.newPage();
      await page.goto(`${base}/admin/token-statistics`);
      await expect(page.locator("h1")).toContainText(/Token/);
      await page.locator('select[name="department"]').selectOption(department);
      const queried = page.waitForResponse(
        (r) =>
          r.url().includes("/api/admin/token-statistics?") &&
          r.url().includes(department)
      );
      await page.locator('button[type="submit"]').click();
      assert.equal((await queried).status(), 200);
      await expect(page.locator("tbody")).toContainText("37");
      await page.screenshot({
        fullPage: true,
        path: "/tmp/piwork-token-statistics-desktop.png",
      });
      await page.setViewportSize({ height: 844, width: 390 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      );
      await page.screenshot({
        fullPage: true,
        path: "/tmp/piwork-token-statistics-mobile.png",
      });
      await page.evaluate(() => localStorage.setItem("theme", "dark"));
      await page.reload();
      await expect(page.locator("h1")).toContainText(/Token/);
    } finally {
      await browser.close();
    }
  }
  console.log(
    "Token statistics HTTP: totals, permissions, validation and page passed"
  );
} finally {
  await db`delete from "Chat" where id = ${chat}`;
  await db`delete from "User" where id in (${admin}, ${owner})`;
  await db`delete from "Department" where id = ${department}`;
  await db.end();
}
