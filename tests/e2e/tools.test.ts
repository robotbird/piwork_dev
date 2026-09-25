import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";

import { cleanupTestData } from "./helpers/test-cleanup";

const TOOLS_URL = "/management/tools";
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
  const email = `tools-e2e-${uniqueSuffix()}@test.local`;
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
  .serial("MCP services management", () => {
    test.use({ locale: "zh-CN" });

    const stdioName = `e2e-stdio-${uniqueSuffix()}`;
    const httpName = `e2e-http-${uniqueSuffix()}`;

    test.afterAll(async () => {
      await cleanupTestData({
        emailPatterns: ["tools-e2e-%@test.local"],
        mcpServerNames: [stdioName, httpName],
      });
    });

    test("requires an administrator for the page and the API", async ({
      page,
    }) => {
      const email = await registerAccount(page);
      await setMemberRole(email, "member");
      await page.goto(TOOLS_URL);
      await expect(
        page.getByText(/工具管理仅管理员可用/).first()
      ).toBeVisible();

      const denied = await page.request.get("/api/management/mcp-servers");
      expect(denied.status()).toBe(401);
    });

    test("creates, lists, toggles, edits and deletes servers", async ({
      page,
    }) => {
      const email = await registerAccount(page);
      await setMemberRole(email, "admin");

      const createdStdio = await page.request.post(
        "/api/management/mcp-servers",
        {
          data: {
            args: ["-y", "mcp-server-weather"],
            command: "npx",
            description: "e2e stdio server",
            enabled: true,
            env: { API_KEY: "secret" },
            name: stdioName,
            transport: "stdio",
          },
        }
      );
      expect(createdStdio.status()).toBe(201);
      const { id: stdioId } = (await createdStdio.json()) as { id: string };

      const createdHttp = await page.request.post(
        "/api/management/mcp-servers",
        {
          data: {
            description: "e2e http server",
            enabled: false,
            headers: { Authorization: "Bearer token" },
            name: httpName,
            transport: "http",
            url: "https://example.com/mcp",
          },
        }
      );
      expect(createdHttp.status()).toBe(201);
      const { id: httpId } = (await createdHttp.json()) as { id: string };

      const duplicate = await page.request.post("/api/management/mcp-servers", {
        data: {
          command: "npx",
          name: stdioName,
          transport: "stdio",
        },
      });
      expect(duplicate.status()).toBe(409);

      const badTransport = await page.request.post(
        "/api/management/mcp-servers",
        { data: { name: `e2e-bad-${uniqueSuffix()}`, transport: "grpc" } }
      );
      expect(badTransport.status()).toBe(400);

      const missingUrl = await page.request.post(
        "/api/management/mcp-servers",
        {
          data: { name: `e2e-nourl-${uniqueSuffix()}`, transport: "http" },
        }
      );
      expect(missingUrl.status()).toBe(400);

      const listResponse = await page.request.get(
        "/api/management/mcp-servers"
      );
      expect(listResponse.ok()).toBeTruthy();
      const { servers } = (await listResponse.json()) as {
        servers: Array<{ name: string }>;
      };
      expect(servers.some((server) => server.name === stdioName)).toBe(true);
      expect(servers.some((server) => server.name === httpName)).toBe(true);

      const toggled = await page.request.patch(
        `/api/management/mcp-servers/${stdioId}`,
        { data: { enabled: false } }
      );
      expect(toggled.ok()).toBeTruthy();

      const edited = await page.request.patch(
        `/api/management/mcp-servers/${httpId}`,
        { data: { description: "e2e http server edited" } }
      );
      expect(edited.ok()).toBeTruthy();

      await page.goto(`${TOOLS_URL}?view=mcp`);
      await expect(
        page.getByRole("heading", { name: "MCP 服务" })
      ).toBeVisible();
      await expect(page.getByText(stdioName).first()).toBeVisible();
      await expect(page.getByText(httpName).first()).toBeVisible();

      const deletedStdio = await page.request.delete(
        `/api/management/mcp-servers/${stdioId}`
      );
      expect(deletedStdio.ok()).toBeTruthy();

      const reDeleted = await page.request.delete(
        `/api/management/mcp-servers/${stdioId}`
      );
      expect(reDeleted.status()).toBe(404);
    });
  });
