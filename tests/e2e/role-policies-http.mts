import "../support/db-env";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { encode } from "next-auth/jwt";
import { getDb } from "../../lib/db/client";

const base = process.env.ROLE_TEST_URL ?? "http://localhost:3000";
const db = getDb();
const admin = crypto.randomUUID(),
  owner = crypto.randomUUID(),
  roleId = crypto.randomUUID(),
  memberId = crypto.randomUUID(),
  chatId = crypto.randomUUID(),
  runId = crypto.randomUUID();
const roleName = `Role HTTP ${roleId}`;
const secret = process.env.AUTH_SECRET;
assert.ok(secret);
async function cookie(id: string) {
  return `authjs.session-token=${await encode({ salt: "authjs.session-token", secret: secret as string, token: { email: `${id}@test.local`, id, sub: id, type: "regular" } })}`;
}
const adminCookie = await cookie(admin),
  ownerCookie = await cookie(owner);
const endpoint = `${base}/api/admin/roles/${roleId}/policies`;
function put(data: unknown) {
  return fetch(endpoint, {
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    method: "PUT",
  });
}
try {
  await db.execute(
    sql`insert into "User" (id,email) values (${admin},${`${admin}@test.local`}),(${owner},${`${owner}@test.local`})`
  );
  await db.execute(
    sql`insert into "Member" ("userId",role) values (${admin},'admin')`
  );
  await db.execute(
    sql`insert into "Member" (id,"userId",role) values (${memberId},${owner},'member')`
  );
  await db.execute(
    sql`insert into "Role" (id,name) values (${roleId},${roleName})`
  );
  await db.execute(
    sql`insert into "MemberRole" ("memberId","roleId") values (${memberId},${roleId})`
  );
  assert.equal((await fetch(endpoint, { redirect: "manual" })).status, 401);
  assert.equal(
    (await fetch(endpoint, { headers: { Cookie: ownerCookie } })).status,
    401
  );
  const loaded = await fetch(endpoint, { headers: { Cookie: adminCookie } });
  assert.equal(loaded.status, 200);
  assert.equal(loaded.headers.get("cache-control"), "no-store");
  const data = await loaded.json();
  assert.equal(
    (
      await put({
        tokenPolicy: {
          action: "block",
          daily: null,
          monthly: -1,
          perRun: null,
        },
      })
    ).status,
    400
  );
  assert.equal(
    (
      await put({
        modelPolicy: {
          allowSwitch: true,
          defaultModelId: "invented/a",
          enabledModelIds: ["invented/a"],
        },
      })
    ).status,
    400
  );
  assert.equal(
    (
      await put({
        modelPolicy: {
          allowSwitch: true,
          defaultModelId: null,
          enabledModelIds: [],
        },
      })
    ).status,
    200
  );
  const denied = await fetch(`${base}/api/models`, {
    headers: { Cookie: ownerCookie },
  });
  assert.equal(denied.status, 200);
  assert.equal(denied.headers.get("cache-control"), "no-store");
  assert.deepEqual((await denied.json()).models, []);
  if (data.catalog.models.length) {
    const modelId = data.catalog.models[0].id;
    assert.equal(
      (
        await put({
          modelPolicy: {
            allowSwitch: false,
            defaultModelId: modelId,
            enabledModelIds: data.catalog.models.map(
              (model: { id: string }) => model.id
            ),
          },
        })
      ).status,
      200
    );
    const models = await (
      await fetch(`${base}/api/models`, { headers: { Cookie: ownerCookie } })
    ).json();
    assert.deepEqual(
      models.models.map((model: { id: string }) => model.id),
      [modelId]
    );
    assert.equal(models.defaultModelId, modelId);
    const payload = {
      id: crypto.randomUUID(),
      message: {
        id: crypto.randomUUID(),
        parts: [{ text: "quota authorization probe", type: "text" }],
        role: "user",
      },
      selectedChatModel: "invented/a",
      selectedVisibilityType: "private",
    };
    const chatRequest = (body: unknown) =>
      fetch(`${base}/api/chat`, {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json", Cookie: ownerCookie },
        method: "POST",
      });
    assert.equal((await chatRequest(payload)).status, 403);
    await db.execute(
      sql`insert into "Chat" (id,"userId",title,"createdAt") values (${chatId},${owner},'quota fixture',now())`
    );
    await db.execute(
      sql`insert into "AgentRun" (id,"chatId","userId",status) values (${runId},${chatId},${owner},'settled')`
    );
    await db.execute(
      sql`insert into "RuntimeEvent" ("runId",seq,type,data) values (${runId},1,'message.completed','{"usage":{"totalTokens":10}}'::json)`
    );
    assert.equal(
      (
        await put({
          tokenPolicy: {
            action: "block",
            daily: 10,
            monthly: null,
            perRun: null,
          },
        })
      ).status,
      200
    );
    assert.equal(
      (await chatRequest({ ...payload, selectedChatModel: modelId })).status,
      429
    );
  }
  if (process.env.PIWORK_ROLE_BROWSER_TESTS === "1") {
    const { chromium, expect } = await import("@playwright/test");
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext({
        locale: "zh-CN",
        viewport: { height: 1000, width: 1440 },
      });
      await context.addCookies([
        {
          name: "authjs.session-token",
          url: base,
          value: adminCookie.split("=").slice(1).join("="),
        },
        { name: "NEXT_LOCALE", url: base, value: "zh" },
      ]);
      const page = await context.newPage();
      await page.goto(`${base}/admin/organization?view=permissions`);
      await page.getByRole("searchbox", { name: "搜索角色" }).fill(roleName);
      await page
        .getByRole("button", { name: new RegExp(`^${roleName}`) })
        .click();
      await expect(page.getByRole("tab", { name: "成员管理" })).toHaveAttribute(
        "data-state",
        "active"
      );
      await page.getByRole("tab", { name: "模型权限" }).click();
      await expect(
        page.getByRole("tabpanel").getByRole("button", { name: "保存配置" })
      ).toBeVisible();
      const checkPrimaryButton = async (name: string | RegExp) => {
        const colors = await page
          .getByRole("button", { name })
          .evaluate((button) => {
            const probe = document.createElement("span");
            probe.style.backgroundColor = "var(--primary)";
            probe.style.color = "var(--primary-foreground)";
            document.body.append(probe);
            const actual = getComputedStyle(button);
            const expected = getComputedStyle(probe);
            const result = {
              background: actual.backgroundColor,
              foreground: actual.color,
              primary: expected.backgroundColor,
              primaryForeground: expected.color,
            };
            probe.remove();
            return result;
          });
        assert.equal(colors.background, colors.primary);
        assert.equal(colors.foreground, colors.primaryForeground);
      };
      await checkPrimaryButton(/^(新建角色|创建角色)$/);
      await checkPrimaryButton("保存配置");
      await page.screenshot({
        fullPage: true,
        path: "/tmp/piwork-role-models.png",
      });
      await page.getByRole("tab", { name: "Token 额度" }).click();
      await page
        .getByLabel("每月 Token 额度", { exact: true })
        .fill("20000000");
      await page.getByLabel("每日 Token 额度", { exact: true }).fill("800000");
      await page.getByLabel("单次任务上限", { exact: true }).fill("200000");
      const saved = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/roles/${roleId}/policies`) &&
          response.request().method() === "PUT"
      );
      await page.getByRole("button", { exact: true, name: "保存配置" }).click();
      assert.equal((await saved).status(), 200);
      await expect(page.getByText("配置已保存", { exact: true })).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.reload();
      await page.getByRole("searchbox", { name: "搜索角色" }).fill(roleName);
      await page
        .getByRole("button", { name: new RegExp(`^${roleName}`) })
        .click();
      await page.getByRole("tab", { name: "Token 额度" }).click();
      await expect(
        page.getByLabel("每月 Token 额度", { exact: true })
      ).toHaveValue("20000000");
      await page.screenshot({
        fullPage: true,
        path: "/tmp/piwork-role-quota.png",
      });
      await page.setViewportSize({ height: 844, width: 390 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      );
      await page.screenshot({
        fullPage: true,
        path: "/tmp/piwork-role-mobile.png",
      });
      await page.evaluate(() => {
        localStorage.setItem("theme", "dark");
      });
      await page.reload();
      await expect(page.locator("html")).toHaveClass(/dark/);
      await page.getByRole("searchbox", { name: "搜索角色" }).fill(roleName);
      await page
        .getByRole("button", { name: new RegExp(`^${roleName}`) })
        .click();
      await page.getByRole("tab", { name: "Token 额度" }).click();
      await expect(
        page.getByRole("button", { name: "保存配置" })
      ).toBeVisible();
      await checkPrimaryButton(/^(新建角色|创建角色)$/);
      await checkPrimaryButton("保存配置");
      await page.screenshot({
        fullPage: true,
        path: "/tmp/piwork-role-dark.png",
      });
    } finally {
      await browser.close();
    }
  }
  assert.equal(
    (await put({ modelPolicy: null, tokenPolicy: null })).status,
    200
  );
  const reset = await (
    await fetch(endpoint, { headers: { Cookie: adminCookie } })
  ).json();
  assert.equal(reset.role.modelPolicy, null);
  assert.equal(reset.role.tokenPolicy, null);
  console.log(
    "Role policies HTTP: authorization, validation, model filtering, quota admission, reset and optional browser passed"
  );
} finally {
  await db.execute(sql`delete from "Chat" where id=${chatId}`);
  await db.execute(sql`delete from "User" where id in (${admin},${owner})`);
  await db.execute(sql`delete from "Role" where id=${roleId}`);
}
