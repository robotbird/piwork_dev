// Isolated UI contract, no real identity/DB/provider/model or global settings mutation.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";
import tailwindcss from "@tailwindcss/postcss";
import { build } from "esbuild";
import postcss from "postcss";

const dir = await mkdtemp(join(tmpdir(), "sandbox-settings-ui-"));
const server = createServer(async (request, response) => {
  const file =
    request.url === "/preview.js"
      ? "preview.js"
      : request.url === "/preview.css"
        ? "preview.css"
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
let saved = { cpuCores: 2, memoryMB: 2048 };
let fail = true;
let patches = 0;
try {
  await build({
    bundle: true,
    define: {
      "process.env": "{}",
      "process.env.NEXT_PUBLIC_BASE_PATH": '""',
      "process.env.NODE_ENV": '"development"',
    },
    entryPoints: ["tests/support/sandbox-settings-preview.tsx"],
    jsx: "automatic",
    outfile: join(dir, "preview.js"),
    platform: "browser",
  });
  const css = await postcss([tailwindcss()]).process(
    await readFile("app/globals.css", "utf8"),
    { from: "app/globals.css" }
  );
  await writeFile(join(dir, "preview.css"), css.css);
  await writeFile(
    join(dir, "index.html"),
    '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/preview.css"></head><body><div id="root"></div><script src="/preview.js"></script></body></html>'
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { height: 900, width: 1280 },
  });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/api/admin/sandbox-settings", async (route) => {
    if (route.request().method() === "PATCH") {
      patches += 1;
      if (fail) {
        fail = false;
        await route.fulfill({ json: { error: "fixture" }, status: 503 });
        return;
      }
      saved = route.request().postDataJSON();
      await route.fulfill({ json: { resource: saved } });
      return;
    }
    await route.fulfill({
      json: {
        inferenceConfigured: false,
        provider: null,
        resource: saved,
        routing: "matrix",
      },
    });
  });
  await page.goto(`http://127.0.0.1:${address.port}`);
  await expect(
    page.getByRole("heading", { name: "Sandbox 配置" })
  ).toBeVisible();
  await expect(page.getByText("未启用沙箱", { exact: true })).toBeVisible();
  const save = page.getByRole("button", { exact: true, name: "保存配置" });
  await expect(save).toBeDisabled();
  await page.getByRole("button", { exact: true, name: "轻量预设" }).click();
  await expect(page.getByLabel("CPU（核）")).toHaveValue("1");
  await expect(page.getByLabel("内存（MB）")).toHaveValue("768");
  await save.click();
  await expect(page.getByRole("alert")).toContainText("保存失败");
  assert.deepEqual(saved, { cpuCores: 2, memoryMB: 2048 });
  await save.click();
  await expect(save).toBeDisabled();
  assert.deepEqual(saved, { cpuCores: 1, memoryMB: 768 });
  await page.reload();
  await expect(page.getByLabel("内存（MB）")).toHaveValue("768");
  await page.getByLabel("内存（MB）").fill("769");
  await save.click();
  assert.equal(
    patches,
    2,
    "native validation blocks invalid memory increments"
  );
  await page.getByLabel("内存（MB）").fill("768");
  await page.setViewportSize({ height: 844, width: 390 });
  async function checkTheme(dark: boolean) {
    await page.evaluate(
      (enabled) => document.documentElement.classList.toggle("dark", enabled),
      dark
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    );
    await page
      .getByRole("button", { exact: true, name: "轻量预设" })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("button", { exact: true, name: "轻量预设" })
    ).toBeInViewport();
  }
  await checkTheme(false);
  await checkTheme(true);
  assert.deepEqual(pageErrors, []);
  console.log(
    "Sandbox settings UI: presets, failure/retry, reload, validation, mobile and dark theme passed."
  );
} finally {
  await browser?.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(dir, { force: true, recursive: true });
}
