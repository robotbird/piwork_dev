// biome-ignore-all lint/performance/noAwaitInLoops: viewport checks share one browser page and must be sequential
import "../support/db-env";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import postgres from "postgres";
import type { ModelPluginsView } from "../../lib/admin/model-plugins";
import {
  definition as tongyi,
  DEFAULT_BASE_URL as tongyiUrl,
} from "../../plugins/piwork-llm-tongyi/src/provider";
import {
  definition as zhipu,
  DEFAULT_BASE_URL as zhipuUrl,
} from "../../plugins/piwork-llm-zhipuai/src/provider";

// Only disposable records. PATCH is intercepted: no model calls or real credentials are saved.
const base =
  process.env.MODEL_CONFIGURATION_TEST_URL ?? "http://localhost:3000";
const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
const admin = crypto.randomUUID();
// Exercise legacy/public default fields without changing the current fixed-endpoint plugins.
const legacyZhipu = {
  ...zhipu,
  credentialFields: [
    ...zhipu.credentialFields,
    {
      default: zhipuUrl,
      label: { en: "API Base URL" },
      required: false,
      type: "text-input" as const,
      variable: "base_url",
    },
    {
      default: "glm-5-turbo",
      label: { en: "Validation model" },
      required: false,
      type: "text-input" as const,
      variable: "validate_model",
    },
  ],
};
const fixtures = [tongyi, legacyZhipu].map((definition) => ({
  definition,
  id: crypto.randomUUID(),
}));
assert.ok(process.env.AUTH_SECRET);
const token = await encode({
  salt: "authjs.session-token",
  secret: process.env.AUTH_SECRET,
  token: {
    email: `${admin}@test.local`,
    id: admin,
    sub: admin,
    type: "regular",
  },
});
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await sql`insert into "User" (id, email) values (${admin}, ${`${admin}@test.local`})`;
  await sql`insert into "Member" ("userId", role, status) values (${admin}, 'admin', 'enabled')`;
  await Promise.all(
    fixtures.map(async ({ id, definition }) => {
      await sql`insert into "ModelProviderPlugin" (id, "packageId", "providerKey", "displayName", version, definition, "encryptedCredentials", "buildHash", sha256, enabled, "credentialsConfigured") values (${id}, ${`fixture-${id}`}, ${`fixture-${id}`}, ${`Fixture ${definition.provider} ${id}`}, '1.0.0', ${sql.json(JSON.parse(JSON.stringify(definition)))}, 'test-only-never-decrypt', 'fixture', 'fixture', false, false)`;
    })
  );
  const response = await fetch(`${base}/api/admin/model-plugins`, {
    headers: { Cookie: `authjs.session-token=${token}` },
  });
  assert.equal(response.status, 200);
  const view = (await response.json()) as ModelPluginsView;
  assert.equal(
    view.available.find((item) => item.providerKey === "tongyi")
      ?.defaultBaseUrl,
    tongyi.defaultBaseUrl
  );
  assert.equal(
    view.available.find((item) => item.providerKey === "zhipuai")
      ?.defaultBaseUrl,
    zhipu.defaultBaseUrl
  );
  assert.equal(JSON.stringify(view).includes("test-only-never-decrypt"), false);
  browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addCookies([
    { name: "authjs.session-token", url: base, value: token },
  ]);
  const page = await context.newPage();
  const bodies: Record<string, unknown>[] = [];
  for (const fixture of fixtures) {
    await page.route(
      `**/api/admin/model-plugins/${fixture.id}`,
      async (route) => {
        assert.equal(route.request().method(), "PATCH");
        bodies.push(route.request().postDataJSON());
        await route.fulfill({
          body: '{"updated":true}',
          contentType: "application/json",
          status: 200,
        });
      }
    );
  }
  await page.goto(`${base}/admin/models`);
  for (const viewport of [
    { height: 900, width: 1440 },
    { height: 720, width: 1280 },
    { height: 1024, width: 768 },
    { height: 844, width: 390 },
    { height: 568, width: 320 },
  ]) {
    await page.setViewportSize(viewport);
    await page
      .locator("article")
      .filter({ hasText: `Fixture tongyi ${fixtures[0].id}` })
      .getByRole("button", { name: /添加 API Key|Add API Key/ })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator("#plugin-default-endpoint")).toHaveValue(
      tongyiUrl
    );
    const save = dialog.getByRole("button", {
      name: /验证并保存 API Key|Validate.*Save/i,
    });
    await expect(save).toBeDisabled();
    const bounds = await dialog.boundingBox();
    assert.ok(
      bounds &&
        bounds.x >= 15 &&
        bounds.width <= viewport.width - 30 &&
        bounds.y >= 0 &&
        bounds.y + bounds.height <= viewport.height
    );
    if (viewport.width >= 1280) {
      assert.ok(bounds.width >= 900);
    }
    const footer = dialog.locator('[data-slot="dialog-footer"]');
    const before = await footer.boundingBox();
    const list = dialog.getByRole("region", { name: /模型目录|Model catalog/ });
    await list.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    assert.ok(await list.evaluate((element) => element.scrollTop > 0));
    await dialog
      .locator("div.grid")
      .first()
      .evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
    const after = await footer.boundingBox();
    assert.ok(
      before &&
        after &&
        Math.abs(after.y - before.y) < 1 &&
        after.y + after.height <= viewport.height
    );
    await expect(save).toBeInViewport();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
  await page.setViewportSize({ height: 800, width: 1280 });
  const zhipuArticle = page
    .locator("article")
    .filter({ hasText: `Fixture zhipuai ${fixtures[1].id}` });
  await zhipuArticle
    .getByRole("button", { name: /添加 API Key|Add API Key/ })
    .click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.locator("#credential-base_url")).toHaveValue(zhipuUrl);
  const saveName = /验证并保存 API Key|Validate.*Save/i;
  await expect(dialog.getByRole("button", { name: saveName })).toBeDisabled();
  await dialog.locator("#credential-api_key").fill("test-only-key");
  await dialog.getByRole("button", { name: saveName }).click();
  await expect(dialog).toHaveCount(0);
  assert.deepEqual(bodies.at(-1)?.credentials, {
    api_key: "test-only-key",
    base_url: zhipu.defaultBaseUrl,
    validate_model: "glm-5-turbo",
  });
  // Reopening a configured supplier must not submit defaults while rotating only the key.
  await sql`update "ModelProviderPlugin" set "credentialsConfigured" = true where id = ${fixtures[1].id}`;
  await page.reload();
  await page
    .locator("article")
    .filter({ hasText: `Fixture zhipuai ${fixtures[1].id}` })
    .getByRole("button", { exact: true, name: /配置|Configure/ })
    .click();
  dialog = page.getByRole("dialog");
  await expect(dialog.locator("#credential-base_url")).toHaveValue("");
  await dialog.locator("#credential-api_key").fill("replacement-test-key");
  await dialog
    .getByRole("button", { name: /保存配置|Save configuration/i })
    .click();
  await expect(dialog).toHaveCount(0);
  assert.deepEqual(bodies.at(-1)?.credentials, {
    api_key: "replacement-test-key",
  });
  console.log(
    "Model configuration: plugin endpoints, default fields, required key, rotation preservation and fixed footer at 1440/1280/768/390/320px passed (PATCH mocked)"
  );
} finally {
  await browser?.close();
  await sql`delete from "ModelProviderPlugin" where id in ${sql(fixtures.map((item) => item.id))}`;
  await sql`delete from "Member" where "userId" = ${admin}`;
  await sql`delete from "User" where id = ${admin}`;
  await sql.end();
}
