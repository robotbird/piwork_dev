import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";

import { cleanupTestData } from "./helpers/test-cleanup";

const SANDBOXES_URL = "/admin/sandboxes";
const DEFAULT_PASSWORD = "test123456";

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function withSql<T>(run: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
  try {
    return await run(sql);
  } finally {
    await sql.end();
  }
}

async function setMemberRole(
  email: string,
  role: "admin" | "member"
): Promise<void> {
  await withSql(
    (sql) =>
      sql`UPDATE "Member" SET "role" = ${role}
      WHERE "userId" = (SELECT "id" FROM "User" WHERE "email" = ${email})`
  );
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

async function registerAccount(
  page: Page,
  prefix = "sandboxes-e2e"
): Promise<string> {
  const email = `${prefix}-${uniqueSuffix()}@test.local`;
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
  await ensureSignedIn(page, email);
  return email;
}

/** 直接落库一条 ready 沙箱（管理页数据源走真实 join 路径） */
function seedSandbox(
  email: string,
  externalId: string
): Promise<{ chatId: string }> {
  return withSql(async (sql) => {
    const [chat] = await sql`INSERT INTO "Chat" ("createdAt", "title", "userId")
      VALUES (now(), ${`沙箱e2e会话-${externalId}`},
        (SELECT "id" FROM "User" WHERE "email" = ${email}))
      RETURNING "id" AS "chatId"`;
    await sql`INSERT INTO "SandboxInstance"
      ("chatId", "expiresAt", "externalId", "image", "provider",
       "status", "ttlSeconds", "userId")
      VALUES (${chat.chatId}, now() + interval '1 hour', ${externalId},
        'pi-runtime-test:latest', 'test', 'ready', 3600,
        (SELECT "id" FROM "User" WHERE "email" = ${email}))`;
    return { chatId: chat.chatId as string };
  });
}

test.describe
  .serial("sandbox management", () => {
    test.use({ locale: "zh-CN" });

    test.afterAll(async () => {
      await cleanupTestData({
        emailPatterns: ["sandboxes-e2e-%@test.local"],
      });
    });

    test("requires an administrator for the page and the API", async ({
      page,
    }) => {
      const email = await registerAccount(page);
      await setMemberRole(email, "member");
      await page.goto(SANDBOXES_URL);
      // 管理布局对非管理员直接重定向到个人资料页（admin/layout.tsx AuthenticatedAdmin）
      await expect(page).toHaveURL(/\/settings\/profile$/);

      const denied = await page.request.get("/api/admin/sandboxes");
      expect(denied.status()).toBe(401);
    });

    test("lists instances, searches and shows details without pretending test rows are real containers", async ({
      page,
    }) => {
      const email = await registerAccount(page);
      await setMemberRole(email, "admin");
      const externalId = `test-sbx-e2e-${uniqueSuffix()}`;
      await seedSandbox(email, externalId);

      // API 校验：列表含种子行，activeOnly 也含；非法操作 400
      const listResponse = await page.request.get("/api/admin/sandboxes");
      expect(listResponse.ok).toBeTruthy();
      const { instances } = (await listResponse.json()) as {
        instances: Array<{
          externalId: string;
          status: string;
          userEmail: string | null;
        }>;
      };
      const seeded = instances.find((item) => item.externalId === externalId);
      expect(seeded?.status).toBe("ready");
      expect(seeded?.userEmail).toBe(email);

      const activeList = await page.request.get(
        "/api/admin/sandboxes?activeOnly=1"
      );
      const activeBody = (await activeList.json()) as {
        instances: Array<{ externalId: string }>;
      };
      expect(
        activeBody.instances.some((item) => item.externalId === externalId)
      ).toBe(true);

      const invalidAction = await page.request.post("/api/admin/sandboxes", {
        data: { action: "pause", externalId, provider: "test" },
      });
      expect(invalidAction.status()).toBe(400);

      const invalidProvider = await page.request.post("/api/admin/sandboxes", {
        data: { action: "destroy", externalId, provider: "k8s" },
      });
      expect(invalidProvider.status()).toBe(400);

      const missing = await page.request.post("/api/admin/sandboxes", {
        data: {
          action: "destroy",
          externalId: "no-such-sbx",
          provider: "test",
        },
      });
      expect(missing.status()).toBe(404);

      // 管理页：表格渲染种子行（用户、镜像、状态徽章、TTL）
      await page.goto(SANDBOXES_URL);
      await expect(
        page.getByRole("heading", { exact: true, name: "Sandbox" })
      ).toBeVisible();
      const row = page.getByRole("row").filter({ hasText: externalId });
      await expect(row).toBeVisible();
      await expect(row.getByText(email)).toBeVisible();
      await expect(row.getByText("状态待确认")).toBeVisible();
      await page
        .getByRole("searchbox", { name: /搜索 Sandbox/ })
        .fill(externalId);
      await expect(row).toBeVisible();
      await row.getByRole("button", { exact: true, name: "查看" }).click();
      const details = page.getByRole("dialog");
      await expect(
        details.getByRole("heading", { name: "Sandbox 详情" })
      ).toBeVisible();
      await expect(details.getByText("pi-runtime-test:latest")).toBeVisible();
      await expect(details.getByText("TTL 3600s")).toBeVisible();
      await expect(
        details.getByRole("button", { name: "延长 1 小时" })
      ).toBeDisabled();
      await expect(
        details.getByRole("button", { name: "销毁 Sandbox" })
      ).toBeDisabled();
      await expect(
        details.getByRole("link", { name: "查看任务" })
      ).toHaveAttribute("href", /\/chat\//);
      await details.getByRole("button", { exact: true, name: "关闭" }).click();
      // 分页后筛选在服务端按 DB 状态执行：ready 行属于运行中；
      // test provider 无法观察只会标记 syncError（状态待确认），不再落入异常页签
      await page.getByRole("button", { exact: true, name: "运行中" }).click();
      await expect(row).toBeVisible();
      await page.getByRole("button", { exact: true, name: "异常" }).click();
      await expect(row).not.toBeVisible();
      await page.getByRole("button", { exact: true, name: "已销毁" }).click();
      await expect(row).not.toBeVisible();
      await page.getByRole("button", { exact: true, name: "全部" }).click();
      await expect(row).toBeVisible();
      const unsupported = await page.request.post("/api/admin/sandboxes", {
        data: { action: "destroy", externalId, provider: "test" },
      });
      expect(unsupported.status()).toBe(503);
    });

    test("paginates the instance list server-side", async ({ page }) => {
      const email = await registerAccount(page);
      await setMemberRole(email, "admin");
      const prefix = `test-sbx-pg-${uniqueSuffix()}`;
      for (let index = 0; index < 12; index += 1) {
        // biome-ignore lint/performance/noAwaitInLoops: 逐条落库翻页 fixture，非负载测试
        await seedSandbox(email, `${prefix}-${index}`);
      }

      await page.goto(SANDBOXES_URL);
      await expect(
        page.getByRole("heading", { exact: true, name: "Sandbox" })
      ).toBeVisible();
      await page.getByRole("searchbox", { name: /搜索 Sandbox/ }).fill(prefix);

      // 搜索词隔离出 12 行：第 1 / 2 页，每页 10 行
      const tableRows = page.locator("tbody tr");
      await expect(tableRows).toHaveCount(10);
      await expect(page.getByText(/^当前 Sandbox 12$/)).toBeVisible();
      await expect(page.getByText(/^第 1 \/ 2 页$/)).toBeVisible();

      await page.getByRole("button", { name: "下一页" }).click();
      await expect(tableRows).toHaveCount(2);
      await expect(page.getByText(/^第 2 \/ 2 页$/)).toBeVisible();

      // 页码超界由服务端收敛，直接点第 1 页回到首页
      await page.getByRole("button", { exact: true, name: "第 1 页" }).click();
      await expect(tableRows).toHaveCount(10);

      // 每页条数改为 20 条/页后单页显示全部
      await page.getByRole("combobox", { name: "每页条数" }).click();
      await page.getByRole("option", { name: "20 条/页" }).click();
      await expect(tableRows).toHaveCount(12);
      await expect(page.getByText(/^第 1 \/ 1 页$/)).toBeVisible();

      const paged = await page.request.get(
        `/api/admin/sandboxes?query=${prefix}&page=2&pageSize=10`
      );
      const body = (await paged.json()) as {
        instances: unknown[];
        total: number;
        page: number;
        pageSize: number;
      };
      expect(body.total).toBe(12);
      expect(body.instances).toHaveLength(2);
      expect(body.page).toBe(2);
      expect(body.pageSize).toBe(10);
    });
  });
