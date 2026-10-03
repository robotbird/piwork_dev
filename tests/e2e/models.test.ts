import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";

import { cleanupTestData } from "./helpers/test-cleanup";

const MODELS_URL = "/admin/models";
const DEFAULT_PASSWORD = "test123456";

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function setMemberRole(
  email: string,
  role: "admin" | "member"
): Promise<void> {
  const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
  try {
    await sql`UPDATE "Member" SET "role" = ${role}
      WHERE "userId" = (SELECT "id" FROM "User" WHERE "email" = ${email})`;
  } finally {
    await sql.end();
  }
}

async function ensureSignedIn(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  if (new URL(page.url()).pathname === "/") {
    return;
  }
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(DEFAULT_PASSWORD);
  await page.getByRole("button", { name: /^(登录|Sign in)$/ }).click();
  await page.waitForFunction(
    () => window.location.pathname === "/",
    undefined,
    {
      timeout: 30_000,
    }
  );
}

async function registerAccount(page: Page): Promise<string> {
  const email = `models-e2e-${uniqueSuffix()}@test.local`;
  await page.goto("/register");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(DEFAULT_PASSWORD);
  await page.getByRole("button", { name: /^(注册|Sign up)$/ }).click();
  await page.waitForFunction(
    () => window.location.pathname === "/",
    undefined,
    {
      timeout: 30_000,
    }
  );
  // Fresh dev servers can rotate the anonymous bootstrap token immediately after
  // registration. Re-enter through the credentials flow so the rest of the test
  // always exercises a stable regular-user session.
  await ensureSignedIn(page, email);
  return email;
}

test.describe
  .serial("Plugin model providers", () => {
    test.use({ locale: "zh-CN" });

    test.afterAll(async () => {
      await cleanupTestData({
        emailPatterns: ["models-e2e-%@test.local"],
        modelPluginPackageIds: ["piwork-llm-deepseek"],
      });
    });

    test("shows the plugin catalog to admins only", async ({ page }) => {
      const email = await registerAccount(page);
      await setMemberRole(email, "member");
      await page.goto(MODELS_URL);
      await expect(
        page.getByText(/模型管理仅管理员可用/).first()
      ).toBeVisible();

      await setMemberRole(email, "admin");
      await page.goto(MODELS_URL);
      await expect(
        page.getByRole("heading", { name: "模型供应商" })
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "发现更多供应商" }).first()
      ).toBeVisible();
      await expect(page.getByText("深度求索").first()).toBeVisible();
    });

    test("installs first, requires an API key, and uninstalls a provider", async ({
      page,
    }) => {
      const email = await registerAccount(page);
      await setMemberRole(email, "admin");
      const installed = await page.request.post(
        "/api/admin/model-plugins",
        { data: { packageId: "piwork-llm-deepseek" } }
      );
      expect(installed.status()).toBe(201);
      const { id } = (await installed.json()) as { id: string };

      const duplicate = await page.request.post(
        "/api/admin/model-plugins",
        { data: { packageId: "piwork-llm-deepseek" } }
      );
      expect(duplicate.status()).toBe(409);

      const prematureModelEnable = await page.request.patch(
        `/api/admin/model-plugins/${id}`,
        { data: { enabledModels: ["deepseek-v4-pro"] } }
      );
      expect(prematureModelEnable.status()).toBe(400);

      await page.goto(MODELS_URL);
      await expect(page.getByText("需要配置 API Key").first()).toBeVisible();
      await expect(
        page.getByRole("button", { name: "添加 API Key" }).first()
      ).toBeVisible();
      await expect(page.getByText("0 / 4 个模型已启用").first()).toBeVisible();
      await expect(page.getByText("deepseek-v4-pro").first()).toBeVisible();

      const deleted = await page.request.delete(
        `/api/admin/model-plugins/${id}`
      );
      expect(deleted.ok()).toBeTruthy();
    });
  });
