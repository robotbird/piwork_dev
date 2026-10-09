// Isolated browser contract: actual component + project CSS, mocked sharing API.
// No application identity, database, or model requests are used.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import tailwindcss from "@tailwindcss/postcss";
import { build } from "esbuild";
import postcss from "postcss";

const directory = await mkdtemp(join(tmpdir(), "piwork-share-ui-"));
const member = (index: number) => ({
  image: null,
  name: `成员${index}`,
  title: "产品经理",
  userId: `user-${index}`,
});
let collaborators = [member(1), member(2), member(3), member(4)];
let invite: { createdAt: string; expiresAt: string } | null = null;
const linkRequests: { regenerate?: boolean }[] = [];
let failNextGeneration = false;
let isOwner = true;
const server = createServer(async (request, response) => {
  const filename =
    request.url === "/preview.js"
      ? "preview.js"
      : request.url === "/preview.css"
        ? "preview.css"
        : "index.html";
  response.setHeader(
    "content-type",
    filename.endsWith("js")
      ? "text/javascript"
      : filename.endsWith("css")
        ? "text/css"
        : "text/html"
  );
  response.end(await readFile(join(directory, filename)));
});
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await build({
    bundle: true,
    define: {
      "process.env": "{}",
      "process.env.NEXT_PUBLIC_BASE_PATH": '""',
      "process.env.NODE_ENV": '"development"',
    },
    entryPoints: ["tests/support/share-dialog-preview.tsx"],
    jsx: "automatic",
    outfile: join(directory, "preview.js"),
    platform: "browser",
  });
  const css = await postcss([tailwindcss()]).process(
    await readFile("app/globals.css", "utf8"),
    { from: "app/globals.css" }
  );
  await writeFile(join(directory, "preview.css"), css.css);
  await writeFile(
    join(directory, "index.html"),
    '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/preview.css"></head><body><div id="root"></div><script src="/preview.js"></script></body></html>'
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => console.error(error.message));
  await page.route("**/api/chat/share**", async (route) => {
    const request = route.request();
    let payload: object;
    if (request.method() === "POST") {
      const body = request.postDataJSON();
      if (body.memberIds) {
        collaborators = [
          ...collaborators,
          ...body.memberIds.map((id: string) =>
            member(Number(id.split("-")[1]))
          ),
        ];
      } else {
        linkRequests.push(body);
        if (failNextGeneration) {
          failNextGeneration = false;
          await route.fulfill({
            json: { error: "fixture failure" },
            status: 500,
          });
          return;
        }
        invite = {
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 604_800_000).toISOString(),
        };
      }
      payload = {
        added: body.memberIds?.length ?? 0,
        collaborators,
        inviteExpiresAt: invite?.expiresAt ?? null,
        token: body.memberIds ? null : `fixture-token-${linkRequests.length}`,
      };
    } else if (request.method() === "DELETE") {
      const url = new URL(request.url());
      if (url.searchParams.has("invite")) {
        invite = null;
      } else {
        collaborators = collaborators.filter(
          (item) => item.userId !== url.searchParams.get("userId")
        );
      }
      payload = { success: true };
    } else {
      payload = {
        chatTitle: "分享设计预览",
        collaborators,
        invite,
        isOwner,
        members: Array.from({ length: 18 }, (_, index) => member(index + 1)),
        participants: collaborators,
      };
    }
    await route.fulfill({ json: payload });
  });
  await page.goto(`http://127.0.0.1:${address.port}`);
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").first().waitFor();
  assert.equal(
    await dialog.getByRole("checkbox").count(),
    14,
    "existing collaborators excluded"
  );
  const link = dialog.getByRole("textbox", { name: "分享链接" });
  await link.waitFor();
  assert.equal(
    linkRequests.length,
    1,
    "opening automatically generates exactly once"
  );
  assert.equal(linkRequests[0].regenerate, undefined);
  const initialLink = await link.inputValue();
  assert.equal(
    await dialog
      .getByText(/当前链接有效期|只在生成时|暂无有效分享链接/)
      .count(),
    0
  );
  await dialog.getByRole("checkbox").first().check();
  await dialog.getByRole("button", { name: "添加所选成员（1）" }).click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll('[role="dialog"] input[type="checkbox"]')
        .length === 13
  );
  assert.equal(
    linkRequests.length,
    1,
    "adding members does not rotate the link"
  );
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  await page.getByRole("button", { exact: true, name: "分享" }).click();
  await link.waitFor();
  assert.equal(await link.inputValue(), initialLink);
  assert.equal(linkRequests.length, 1, "reopen reuses the in-memory link");
  await dialog.getByRole("button", { exact: true, name: "重新生成" }).click();
  await page.waitForFunction(() =>
    document
      .querySelector<HTMLInputElement>('input[aria-label="分享链接"]')
      ?.value.includes("fixture-token-2")
  );
  assert.equal(linkRequests[1].regenerate, true);
  await dialog.getByRole("button", { exact: true, name: "复制链接" }).click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    await link.inputValue()
  );
  await link.focus();
  assert.equal(
    await link.evaluate(
      (element: HTMLInputElement) =>
        (element.selectionEnd ?? 0) - (element.selectionStart ?? 0)
    ),
    (await link.inputValue()).length
  );
  for (const viewport of [
    { height: 800, width: 1280 },
    { height: 844, width: 390 },
    { height: 390, width: 844 },
  ]) {
    // biome-ignore lint/performance/noAwaitInLoops: one page must resize sequentially.
    await page.setViewportSize(viewport);
    await page.waitForTimeout(250);
    const bounds = await dialog.boundingBox();
    assert(
      bounds &&
        bounds.x >= 15 &&
        bounds.y >= 15 &&
        bounds.x + bounds.width <= viewport.width - 15 &&
        bounds.y + bounds.height <= viewport.height - 15,
      `dialog fits ${viewport.width}x${viewport.height}: ${JSON.stringify(bounds)}`
    );
    assert(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth
      ),
      "no horizontal overflow"
    );
  }
  await page.setViewportSize({ height: 800, width: 1280 });
  await dialog.getByRole("button", { name: "撤销链接" }).click();
  await link.waitFor({ state: "detached" });
  await page.waitForTimeout(100);
  assert.equal(
    linkRequests.length,
    2,
    "revoke does not trigger automatic regeneration"
  );
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  // A browser reload cannot retrieve the previous plaintext token; rotate once.
  invite = {
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 604_800_000).toISOString(),
  };
  await page.reload();
  await link.waitFor();
  assert.equal(linkRequests.length, 3);
  assert.equal(linkRequests[2].regenerate, true);
  failNextGeneration = true;
  await page.reload();
  await dialog.getByRole("button", { exact: true, name: "重新生成" }).waitFor();
  await page.waitForTimeout(150);
  assert.equal(
    linkRequests.length,
    4,
    "failed automatic request is not retried in a loop"
  );
  assert.equal(await link.count(), 0);
  await dialog.getByRole("button", { exact: true, name: "重新生成" }).click();
  await link.waitFor();
  assert.equal(linkRequests.length, 5, "manual retry succeeds");
  isOwner = false;
  await page.reload();
  await dialog.getByRole("heading", { name: /协作成员/ }).waitFor();
  await page.waitForTimeout(150);
  assert.equal(
    linkRequests.length,
    5,
    "collaborators never auto-generate links"
  );
  assert.equal(await link.count(), 0);
  console.log(
    "PASS: auto generation/reopen/rotation/failure retry, no footer hints, member add, copy/select/revoke, desktop/mobile/landscape bounds"
  );
} finally {
  await browser?.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(directory, { force: true, recursive: true });
}
