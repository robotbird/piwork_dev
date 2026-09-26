import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";

import { cleanupTestData } from "./helpers/test-cleanup";

/**
 * 断线恢复与显式中止（v2.0 Step 2）：faux "longstream" 关键词产出 ~4.8k
 * 字符长流（@100tps ≈ 12s，lib/ai/pi.ts）。流式中 reload → GET /stream 全量
 * 重放续流至完整且无重复；Stop → POST stop 端点 → AgentRun 落 aborted、部分
 * 文本落库、可再次提问。可见性断言用 [data-testid='message-assistant']（真实
 * 消息，不匹配 loading 占位符）；文本断言取其内部 message-content——外层容器
 * 完成后渲染操作按钮（复制/赞同等），会污染 textContent。
 */

const DEFAULT_PASSWORD = "test123456";
const EMAIL_PATTERN = "chat-resume-e2e-%@test.local";

/** 与 lib/ai/pi.ts 的 longStreamText() 保持同步（完整性断言依赖逐字相等） */
function longStreamText(): string {
  return `${Array.from(
    { length: 600 },
    (_, index) => `长流第${String(index + 1).padStart(3, "0")}段`
  ).join("，")}，长流终章。`;
}

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
  const email = `chat-resume-e2e-${uniqueSuffix()}@test.local`;
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

/** 消息文本取内部 message-content：外层 message-assistant 完成后会渲染操作按钮（复制/赞同等），会污染 textContent */
function assistantText(page: Page, nth = 0): Promise<string> {
  return page
    .locator(
      "[data-testid='message-assistant'] [data-testid='message-content']"
    )
    .nth(nth)
    .textContent()
    .then((text) => text ?? "");
}

function assistantLength(page: Page): Promise<number> {
  return assistantText(page).then((text) => text.length);
}

test.describe
  .serial("Chat resume (v2.0 Step 2)", () => {
    test.use({ locale: "zh-CN" });

    test.afterAll(async () => {
      await cleanupTestData({ emailPatterns: [EMAIL_PATTERN] });
    });

    test("流式中 reload：全量重放续流至完整，再次刷新无重复", async ({
      page,
    }) => {
      await registerAccount(page);
      const expected = longStreamText();

      await page
        .getByTestId("multimodal-input")
        .fill("请输出长文本 longstream");
      await page.getByTestId("send-button").click();

      // 等真实 assistant 消息开始出字（占位符是 message-assistant-loading）
      await expect
        .poll(() => assistantLength(page), { timeout: 30_000 })
        .toBeGreaterThan(100);

      await page.reload();

      // resume 后从零重建并继续增长
      await expect
        .poll(() => assistantLength(page), { timeout: 30_000 })
        .toBeGreaterThan(200);
      const sampled = await assistantLength(page);
      if (sampled < expected.length - 100) {
        await expect
          .poll(() => assistantLength(page), { timeout: 30_000 })
          .toBeGreaterThan(sampled);
      }

      // 续流至完整：逐字相等 ⇒ 无缺失、无重复
      await expect
        .poll(async () => (await assistantText(page)).trim(), {
          timeout: 60_000,
        })
        .toBe(expected);

      // 完成后再次刷新：DB 已有完整消息，恰好一条且内容不变
      await page.reload();
      await expect(
        page.locator("[data-testid='message-assistant']")
      ).toHaveCount(1, { timeout: 30_000 });
      await expect
        .poll(async () => (await assistantText(page)).trim(), {
          timeout: 30_000,
        })
        .toBe(expected);
    });

    test("Stop：中止 run 落 aborted，部分文本落库，可再次提问", async ({
      page,
    }) => {
      const email = await registerAccount(page);
      const expected = longStreamText();

      await page
        .getByTestId("multimodal-input")
        .fill("请输出长文本 longstream");
      await page.getByTestId("send-button").click();

      await expect
        .poll(() => assistantLength(page), { timeout: 30_000 })
        .toBeGreaterThan(50);

      await page.getByTestId("stop-button").click();
      // 本地 stop() 只断订阅；UI 应回 ready
      await expect(page.getByTestId("stop-button")).toBeHidden({
        timeout: 15_000,
      });

      // 服务端收尾：AgentRun → aborted（消息 upsert 先于状态落库，此后重载必含部分文本）
      const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
      try {
        await expect
          .poll(
            async () =>
              (
                await sql`SELECT "status" FROM "AgentRun"
                  WHERE "chatId" IN (SELECT "id" FROM "Chat" WHERE "userId" IN (
                    SELECT "id" FROM "User" WHERE "email" = ${email}))
                  ORDER BY "createdAt" DESC LIMIT 1`
              )[0]?.status ?? null,
            { timeout: 20_000 }
          )
          .toBe("aborted");
      } finally {
        await sql.end();
      }

      await page.reload();
      await expect(
        page.locator("[data-testid='message-assistant']")
      ).toBeVisible({ timeout: 30_000 });
      const content = (await assistantText(page)).trim();
      expect(content.length).toBeGreaterThan(0);
      expect(content.length).toBeLessThan(expected.length);
      expect(content).toContain("长流第001段");
      expect(content).not.toContain("长流终章");

      // aborted 后可立即重新提问（活跃 run 已终态，不再 conflict:chat）
      await page.getByTestId("multimodal-input").fill("hello");
      await page.getByTestId("send-button").click();
      await expect
        .poll(async () => (await assistantText(page, 1)).trim(), {
          timeout: 30_000,
        })
        .toBe("Hello! How can I help you today?");
    });
  });
