// Isolated locale-switching UI contract. All API calls use fixtures; no identity, model or DB access.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import tailwindcss from "@tailwindcss/postcss";
import { build } from "esbuild";
import postcss from "postcss";

const dir = await mkdtemp(join(tmpdir(), "piwork-i18n-ui-"));
const server = createServer(async (request, response) => {
  const file = ["/preview.js", "/preview.css", "/base.css"].includes(
    request.url ?? ""
  )
    ? (request.url ?? "").slice(1)
    : "index.html";
  response.setHeader(
    "content-type",
    file.endsWith("js")
      ? "text/javascript"
      : file.endsWith("css")
        ? "text/css"
        : "text/html"
  );
  response.end(await readFile(join(dir, file)));
});
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await build({
    alias: {
      "next/image": resolve("tests/support/i18n/image.tsx"),
      "next/link": resolve("tests/support/i18n/link.tsx"),
      "next/navigation": resolve("tests/support/i18n/navigation.ts"),
    },
    bundle: true,
    define: {
      "process.env": "{}",
      "process.env.NEXT_PUBLIC_BASE_PATH": '""',
      "process.env.NODE_ENV": '"development"',
    },
    entryPoints: ["tests/support/i18n/preview.tsx"],
    jsx: "automatic",
    outfile: join(dir, "preview.js"),
    platform: "browser",
  });
  const css = await postcss([tailwindcss()]).process(
    await readFile("app/globals.css", "utf8"),
    { from: "app/globals.css" }
  );
  await writeFile(join(dir, "base.css"), css.css);
  await writeFile(
    join(dir, "index.html"),
    '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/base.css"><link rel="stylesheet" href="/preview.css"></head><body><div id="root"></div><script src="/preview.js"></script></body></html>'
  );
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  assert(address && typeof address !== "string");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { height: 1000, width: 1280 },
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.error(error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
      console.error(message.text());
    }
  });
  const now = new Date().toISOString();
  const items = [
    {
      contentType: "image/png",
      createdAt: now,
      id: "photo",
      kind: "file",
      name: "photo.png",
      parentId: null,
      size: 10,
      source: "upload",
      updatedAt: now,
    },
    {
      contentType: null,
      createdAt: now,
      id: "sheet",
      kind: "file",
      name: "report.xlsx",
      parentId: null,
      size: 20,
      source: "ai",
      updatedAt: now,
    },
  ];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/library") {
      await route.fulfill({ json: items });
    } else if (path.startsWith("/api/library/")) {
      await route.fulfill({
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jcAAAAABJRU5ErkJggg==",
          "base64"
        ),
        contentType: "image/png",
      });
    } else if (path === "/api/scheduled-tasks") {
      await route.fulfill({
        json: [
          {
            chatId: null,
            enabled: true,
            errorMessage: null,
            id: "task",
            lastRunAt: null,
            nextRunAt: new Date(Date.now() + 3_600_000).toISOString(),
            prompt: "User instructions",
            schedule: { cron: "0 9 * * 1", timezone: "Asia/Shanghai" },
            status: "pending",
            taskType: "Untranslated user title",
          },
        ],
      });
    } else {
      await route.fulfill({ json: { runs: [] } });
    }
  });
  await page.goto(`http://127.0.0.1:${address.port}`);
  await expect(
    page.getByRole("heading", { exact: true, name: "我的文档" })
  ).toBeVisible();
  await page.getByRole("button", { exact: true, name: "图片" }).click();
  await expect(page.getByText("photo.png", { exact: true })).toBeVisible();
  await expect(page.getByText("report.xlsx", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { exact: true, name: "English" }).click();
  await expect(
    page.getByRole("heading", { exact: true, name: "My documents" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { exact: true, name: "Images" })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("report.xlsx", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { exact: true, name: "All" }).click();
  await expect(page.getByText("report.xlsx", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { exact: true, name: "Tasks preview" })
    .click();
  await expect(
    page.getByRole("heading", { exact: true, name: "Scheduled tasks" })
  ).toBeVisible();
  await expect(
    page.getByText("Every Monday at 09:00", { exact: false })
  ).toBeVisible();
  await expect(page.getByText("Not run yet", { exact: true })).toBeVisible();
  await page.getByRole("button", { exact: true, name: "中文" }).click();
  await expect(
    page.getByRole("heading", { exact: true, name: "定时任务" })
  ).toBeVisible();
  await expect(page.getByText("每周一 09:00", { exact: false })).toBeVisible();
  await expect(page.getByText("尚未运行", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { exact: true, name: "Untranslated user title" })
  ).toBeVisible();
  await page.getByRole("button", { exact: true, name: "手动创建任务" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { exact: true, name: "取消" }).click();
  await page.getByRole("button", { exact: true, name: "English" }).click();
  await page
    .getByRole("button", { exact: true, name: "Create task manually" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Create task manually");
  await expect(page.getByRole("dialog")).toContainText("Cron expression");
  assert.deepEqual(errors, []);
  console.log(
    "i18n UI passed: documents keep filter state across locale switches; schedules, statuses and task editor translate; user data stays unchanged."
  );
} finally {
  await browser?.close();
  await new Promise<void>((done) => server.close(() => done()));
  await rm(dir, { force: true, recursive: true });
}
