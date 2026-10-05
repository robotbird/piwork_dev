import "../support/db-env";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { sql } from "drizzle-orm";
import { encode } from "next-auth/jwt";
import { getDb } from "../../lib/db/client";

// Independent identity; mocked library and chat responses, no real model calls.
const base = process.env.LIBRARY_TEST_URL ?? "http://localhost:3000";
const db = getDb();
const userId = crypto.randomUUID();
const secret = process.env.AUTH_SECRET;
assert.ok(secret);
const browser = await chromium.launch();
try {
  await db.execute(
    sql`insert into "User" (id,email) values (${userId},${`${userId}@test.local`})`
  );
  await db.execute(
    sql`insert into "Member" ("userId",role) values (${userId},'member')`
  );
  const context = await browser.newContext();
  await context.addCookies([
    {
      name: "authjs.session-token",
      url: base,
      value: await encode({
        salt: "authjs.session-token",
        secret,
        token: { id: userId, sub: userId, type: "regular" },
      }),
    },
  ]);
  const page = await context.newPage();
  const png =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9WQAAAAASUVORK5CYII=";
  const files = [
    { contentType: "image/png", id: crypto.randomUUID(), name: "参考图片.png" },
    {
      contentType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      id: crypto.randomUUID(),
      name: "方案演示.pptx",
    },
    ...Array.from({ length: 8 }, (_, i) => ({
      contentType: "text/plain",
      id: crypto.randomUUID(),
      name: `资料-${i}.txt`,
    })),
  ].map((file) => ({
    ...file,
    createdAt: "2026-10-01T00:00:00Z",
    kind: "file",
    parentId: null,
    size: 120,
    source: "upload",
    updatedAt: "2026-10-01T00:00:00Z",
  }));
  await page.route("**/api/models", (route) =>
    route.fulfill({
      json: {
        defaultModelId: "test/model",
        models: [{ id: "test/model", name: "Test model", provider: "test" }],
      },
    })
  );
  await page.route("**/api/library", (route) => route.fulfill({ json: files }));
  await page.route("**/api/library/*/attachment", (route) => {
    const id = route.request().url().split("/").at(-2);
    const file = files.find((item) => item.id === id);
    assert.ok(file);
    return route.fulfill({
      json: {
        contentType: file.contentType,
        name: file.name,
        url: `/api/files/${file.id}`,
      },
    });
  });
  await page.route("**/api/library/*?preview=1", (route) =>
    route.fulfill({
      body: Buffer.from(png, "base64"),
      contentType: "image/png",
    })
  );
  await page.route("**/api/files/*", (route) =>
    route.fulfill({
      body: Buffer.from(png, "base64"),
      contentType: "image/png",
    })
  );
  let sent:
    | {
        message: {
          parts: { type: string; filename?: string; text?: string }[];
        };
      }
    | undefined;
  await page.route("**/api/chat", async (route) => {
    if (route.request().method() !== "POST") {
      return route.continue();
    }
    sent = route.request().postDataJSON();
    await route.fulfill({
      json: { cause: "Test interception", code: "forbidden:model" },
      status: 403,
    });
  });
  await page.goto(base);
  const openPicker = () =>
    page
      .getByRole("button", {
        name: /选择我的文档库文件|Choose files from my library/,
      })
      .click();
  await openPicker();
  const picker = page.getByTestId("library-file-picker");
  await picker.getByRole("button", { name: "参考图片.png" }).click();
  await page
    .getByTestId("attachments-preview")
    .getByRole("img", { name: "参考图片.png" })
    .waitFor();
  await picker.getByRole("textbox").fill("方案");
  await picker.getByRole("button", { name: "方案演示.pptx" }).click();
  await page
    .getByTestId("attachments-preview")
    .getByText("方案演示.pptx")
    .waitFor();
  assert.equal(await page.getByTestId("input-attachment-preview").count(), 2);
  await page.keyboard.press("Escape");
  await page
    .getByTestId("input-attachment-preview")
    .filter({ hasText: "方案演示.pptx" })
    .hover();
  await page
    .getByTestId("input-attachment-preview")
    .filter({ hasText: "方案演示.pptx" })
    .getByRole("button")
    .click();
  assert.equal(await page.getByTestId("input-attachment-preview").count(), 1);
  await openPicker();
  await picker.getByRole("button", { name: "方案演示.pptx" }).click();
  await page
    .getByTestId("attachments-preview")
    .getByText("方案演示.pptx")
    .waitFor();
  await picker.getByRole("textbox").fill("不存在");
  await picker.getByText(/没有找到文件|No files found/).waitFor();
  await picker.getByRole("textbox").fill("");
  await picker.getByRole("button", { name: /浏览全部|Browse all/ }).click();
  const all = page.getByTestId("library-file-browser");
  await all.getByRole("button", { name: /资料-7.txt/ }).click();
  await all.getByRole("button", { name: /完成|Done/ }).click();
  await page.getByTestId("multimodal-input").fill("请根据这些文件回答问题");
  await page.screenshot({ path: "/tmp/piwork-library-selected.png" });
  await page.getByTestId("send-button").click();
  await expect.poll(() => Boolean(sent), { timeout: 10_000 }).toBe(true);
  assert.ok(sent);
  assert.deepEqual(
    sent.message.parts
      .filter((part) => part.type === "file")
      .map((part) => part.filename),
    ["参考图片.png", "方案演示.pptx", "资料-7.txt"]
  );
  assert.equal(
    sent.message.parts.find((part) => part.type === "text")?.text,
    "请根据这些文件回答问题"
  );
  await page.setViewportSize({ height: 844, width: 390 });
  await openPicker();
  assert.ok(await picker.isVisible());
  await page.screenshot({ path: "/tmp/piwork-library-mobile.png" });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  );
  await context.close();
  console.log(
    "PASS: library search, image preview, filename chip, browse all, attachment request and mobile layout (no model calls)"
  );
} finally {
  await browser.close();
  await db.execute(sql`delete from "User" where id=${userId}`);
}
process.exit(0);
