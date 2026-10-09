// Actual provider/header/history with mocked Next navigation and HTTP. No DB/model calls.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { build } from "esbuild";

const directory = await mkdtemp(join(tmpdir(), "piwork-chat-navigation-"));
let releaseStream!: () => void;
const streamGate = new Promise<void>((resolve) => {
  releaseStream = resolve;
});
const server = createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/api/chat") {
    response.setHeader("content-type", "text/event-stream");
    for (const chunk of [
      { messageId: "fixture-assistant", type: "start" },
      { id: "answer", type: "text-start" },
      { delta: "正在生成的回答", id: "answer", type: "text-delta" },
    ]) {
      response.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
    await streamGate;
    response.end(
      'data: {"type":"text-end","id":"answer"}\n\ndata: {"type":"finish"}\n\ndata: [DONE]\n\n'
    );
    return;
  }
  const filename = request.url === "/preview.js" ? "preview.js" : "index.html";
  response.setHeader(
    "content-type",
    filename.endsWith("js") ? "text/javascript" : "text/html"
  );
  response.end(await readFile(join(directory, filename)));
});
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await build({
    bundle: true,
    define: { "process.env": "{}", "process.env.NODE_ENV": '"development"' },
    entryPoints: ["tests/support/chat-navigation-preview.tsx"],
    jsx: "automatic",
    outfile: join(directory, "preview.js"),
    platform: "browser",
    plugins: [
      {
        name: "next-client-fixture",
        setup(builder) {
          builder.onResolve(
            {
              filter:
                /^(next\/navigation|next\/link|next-auth\/react|@\/app\/\(chat\)\/actions)$/,
            },
            (args) => ({ namespace: "fixture", path: args.path })
          );
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
            contents:
              args.path === "next/navigation"
                ? `
            import { useSyncExternalStore } from 'react';
            for (const method of ['pushState','replaceState']) {
              const original = history[method].bind(history);
              history[method] = (...args) => { original(...args); window.dispatchEvent(new Event('popstate')); };
            }
            const subscribe = (callback) => { window.addEventListener('popstate', callback); return () => window.removeEventListener('popstate', callback); };
            export const usePathname = () => useSyncExternalStore(subscribe, () => location.pathname);
            export const useSearchParams = () => new URLSearchParams(location.search);
            export const useRouter = () => ({ push: (url) => history.pushState({},'',url), replace: (url) => history.replaceState({},'',url) });
          `
                : args.path === "next/link"
                  ? `
            import { forwardRef } from 'react';
            export default forwardRef(function Link({href,onClick,...props},ref) { return <a {...props} ref={ref} href={href} onClick={(event) => { event.preventDefault(); onClick?.(event); history.pushState({},'',href); }} />; });
          `
                  : args.path === "next-auth/react"
                    ? `export const useSession = () => ({data:{user:{id:'fixture-user'}}});`
                    : `export const updateChatVisibility = async () => { throw new Error('Unexpected server action in navigation test'); };`,
            loader: "tsx",
            resolveDir: process.cwd(),
          }));
        },
      },
    ],
  });
  await writeFile(
    join(directory, "index.html"),
    '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script src="/preview.js"></script></body></html>'
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.error(error.message);
  });
  const stored = new Map<
    string,
    { title: string; myRole: string; messages: object[] }
  >();
  stored.set("other", {
    messages: [
      {
        id: "other-message",
        parts: [{ text: "历史消息内容", type: "text" }],
        role: "user",
      },
    ],
    myRole: "owner",
    title: "另一段历史",
  });
  stored.set("shared", {
    messages: [
      {
        id: "shared-message",
        parts: [{ text: "协作消息", type: "text" }],
        role: "user",
      },
    ],
    myRole: "collaborator",
    title: "协作对话",
  });
  let createdId = "";
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/models") {
      await route.fulfill({
        json: {
          defaultModelId: "fixture/model",
          models: [
            { id: "fixture/model", name: "Fixture", provider: "fixture" },
          ],
        },
      });
    } else if (url.pathname === "/api/history") {
      await route.fulfill({
        json: {
          chats: [...stored].map(([id, chat]) => ({
            createdAt: new Date().toISOString(),
            id,
            title: chat.title,
            userId: "fixture-user",
            visibility: "private",
          })),
          hasMore: false,
        },
      });
    } else if (url.pathname === "/api/messages") {
      const chat = stored.get(url.searchParams.get("chatId") ?? "");
      await route.fulfill(
        chat
          ? {
              json: {
                ...chat,
                isReadonly: false,
                participants: [],
                visibility: "private",
              },
            }
          : { json: { code: "not_found:chat" }, status: 404 }
      );
    } else if (url.pathname === "/api/chat" && request.method() === "POST") {
      const body = request.postDataJSON();
      createdId = body.id;
      stored.set(createdId, {
        messages: [body.message],
        myRole: "owner",
        title: "刚创建的对话",
      });
      await route.continue();
    } else if (url.pathname === "/api/skills") {
      await route.fulfill({ json: { skills: [] } });
    } else if (url.pathname === "/api/projects") {
      await route.fulfill({ json: { projects: [] } });
    } else if (
      url.pathname === "/api/chat/share" &&
      request.method() === "POST"
    ) {
      await route.fulfill({
        json: {
          inviteExpiresAt: new Date(Date.now() + 604_800_000).toISOString(),
          token: "navigation-fixture-token",
        },
      });
    } else if (url.pathname === "/api/chat/share") {
      await route.fulfill({
        json: {
          chatTitle: "刚创建的对话",
          collaborators: [],
          invite: null,
          isOwner: true,
          members: [],
          participants: [],
        },
      });
    } else {
      await route.fulfill({ status: 204 });
    }
  });
  await page.addInitScript(() =>
    localStorage.setItem("input", JSON.stringify("n"))
  );
  await page.goto(`http://127.0.0.1:${address.port}`);
  await page.getByRole("link", { name: "另一段历史" }).waitFor();
  const input = page.getByTestId("multimodal-input");
  await page.waitForFunction(
    () =>
      document.querySelector<HTMLTextAreaElement>(
        "[data-testid='multimodal-input']"
      )?.value === "n"
  );
  await input.focus();
  await page.keyboard.press("End");
  await page.keyboard.press("Backspace");
  await page.waitForFunction(() => localStorage.getItem("input") === '""');
  assert.equal(await input.inputValue(), "", "cached n stays deleted");
  await input.fill("草稿测试");
  await page.waitForFunction(
    () => localStorage.getItem("input") === JSON.stringify("草稿测试")
  );
  await input.fill("");
  await page.waitForFunction(() => localStorage.getItem("input") === '""');
  assert.equal(
    await input.inputValue(),
    "",
    "clearing a full draft stays empty"
  );
  await page.getByRole("button", { exact: true, name: "发送" }).click();
  await page.getByRole("button", { exact: true, name: "分享对话" }).waitFor();
  await page.getByRole("link", { name: "刚创建的对话" }).waitFor();
  assert(createdId);
  assert.equal(await page.getByTestId("status").textContent(), "streaming");
  await page.getByTestId("messages").getByText("正在生成的回答").waitFor();
  assert.equal(
    await page.locator("header button").count(),
    1,
    "only share remains in desktop header"
  );
  await page.getByRole("button", { exact: true, name: "分享对话" }).click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await page.getByRole("link", { name: "另一段历史" }).click();
  await page.getByTestId("messages").getByText("历史消息内容").waitFor();
  await page.getByRole("link", { name: "刚创建的对话" }).click();
  await page.getByTestId("messages").getByText("新对话消息").waitFor();
  await page.getByRole("button", { exact: true, name: "新对话" }).click();
  await page.getByRole("link", { name: "刚创建的对话" }).click();
  await page.getByTestId("messages").getByText("新对话消息").waitFor();
  await page.getByRole("link", { name: "协作对话" }).click();
  await page.getByTestId("messages").getByText("协作消息").waitFor();
  assert.equal(
    await page.getByRole("button", { exact: true, name: "分享对话" }).count(),
    0
  );
  assert.deepEqual(errors, []);
  releaseStream();
  await streamGate;
  console.log(
    "PASS: cached draft restore/delete/clear, new chat share/history before finish, hidden header actions, repeated history hydration, collaborator share hidden"
  );
} finally {
  releaseStream();
  await browser?.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(directory, { force: true, recursive: true });
}
