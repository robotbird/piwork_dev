import "../support/db-env";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  mkdtemp,
  open,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { encode } from "next-auth/jwt";
import { buildSandboxProvider } from "../../lib/runtime/sandbox/configuration";
import { createDurableChatHttpDatabase } from "../support/durable/chat-http-database";

// Opt-in only: dedicated dev server, real configured model + real provider.
// Not a browser/capacity/recovery test. Never enable against a production DB.
if (process.env.PIWORK_DURABLE_CHAT_HTTP_TESTS !== "1") {
  console.log(
    "SKIP: set PIWORK_DURABLE_CHAT_HTTP_TESTS=1 (real model/provider calls)"
  );
  process.exit(0);
}
assert.notEqual(process.env.NODE_ENV, "production");
const { AUTH_SECRET: secret } = process.env;
assert.ok(secret);
const kind = process.env.PIWORK_SANDBOX_PROVIDER;
assert.ok(kind === "opensandbox" || kind === "docker");
assert.notEqual(process.env.PIWORK_RUNTIME_BACKEND, "durable");
assert.ok(process.env.PIWORK_SANDBOX_CLI_PATH);
const database = await createDurableChatHttpDatabase(
  process.env.POSTGRES_URL ?? ""
);
const { sql } = database;
const owner = crypto.randomUUID();
const other = crypto.randomUUID();
const chats: string[] = [];
const root = await mkdtemp(path.resolve(".tmp-durable-chat-http-"));
const storageRoot = path.join(root, "sqlite");
const filesRoot = path.join(root, "uploads");
const baselineEnvDeclaration = await readFile("next-env.d.ts", "utf8");
await writeFile(
  path.join(root, "tsconfig.json"),
  JSON.stringify({ extends: "../tsconfig.json" })
);
const serverLog = await open(path.join(root, "server.log"), "wx", 0o600);
const base = `http://127.0.0.1:${process.env.PIWORK_DURABLE_CHAT_HTTP_PORT ?? "3011"}`;
const controller = new AbortController();
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--port", new URL(base).port],
  {
    detached: true,
    env: {
      ...process.env,
      AUTH_TRUST_HOST: "true",
      AUTH_URL: base,
      BLOB_READ_WRITE_TOKEN: "",
      CI_PLAYWRIGHT: "",
      IS_DEMO: "0",
      NEXT_DIST_DIR: path.relative(process.cwd(), path.join(root, "next")),
      NEXT_TSCONFIG_PATH: path.relative(
        process.cwd(),
        path.join(root, "tsconfig.json")
      ),
      NEXTAUTH_URL: base,
      NODE_ENV: "development",
      PIWORK_CLASSIFIER_MODEL: "",
      PIWORK_DISABLE_EXECUTION_TOOLS: "",
      PIWORK_DURABLE_CHAT_ENABLED: "1",
      PIWORK_DURABLE_CHAT_USER_IDS: "",
      PIWORK_DURABLE_STORAGE_DIR: storageRoot,
      PIWORK_INFERENCE_URL: "",
      PIWORK_SANDBOX_ROUTING: "matrix",
      PLAYWRIGHT: "",
      PLAYWRIGHT_TEST_BASE_URL: "",
      POSTGRES_URL: database.url,
      UPLOAD_DIR: filesRoot,
    },
    stdio: ["ignore", serverLog.fd, serverLog.fd],
  }
);
const cookie = async (id: string) =>
  `authjs.session-token=${await encode({ salt: "authjs.session-token", secret, token: { email: `${id}@test.local`, id, sub: id, type: "regular" } })}`;
const ownerCookie = await cookie(owner);
const otherCookie = await cookie(other);
function request(
  url: string,
  authCookie = ownerCookie,
  options: RequestInit = {}
) {
  return fetch(`${base}${url}`, {
    ...options,
    headers: { ...options.headers, Cookie: authCookie },
    redirect: "manual",
    signal: AbortSignal.any([controller.signal, AbortSignal.timeout(120_000)]),
  });
}
async function waitFor<T>(
  get: () => Promise<T | null>,
  ms = 120_000
): Promise<T> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    // biome-ignore lint/performance/noAwaitInLoops: bounded sequential polling, not a load test
    const result = await get();
    if (result !== null) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("durable-chat-http:deadline");
}
async function newChat() {
  const id = crypto.randomUUID();
  await sql`INSERT INTO "Chat" (id, "userId", title, "createdAt", "updatedAt") VALUES (${id}, ${owner}, 'durable-http-probe', now(), now())`;
  chats.push(id);
  return id;
}
let model = "";
function send(
  chatId: string,
  text: string,
  file?: { url: string; contentType: string; name: string },
  authCookie = ownerCookie
) {
  return request("/api/chat", authCookie, {
    body: JSON.stringify({
      id: chatId,
      message: {
        id: crypto.randomUUID(),
        parts: [
          { text, type: "text" },
          ...(file
            ? [
                {
                  filename: file.name,
                  mediaType: file.contentType,
                  type: "file",
                  url: file.url,
                },
              ]
            : []),
        ],
        role: "user",
      },
      selectedChatModel: model,
      selectedVisibilityType: "private",
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}
async function runRecord(chatId: string) {
  const [run] =
    await sql`SELECT id, backend, status, "errorMessage" FROM "AgentRun" WHERE "chatId" = ${chatId} ORDER BY "createdAt" DESC LIMIT 1`;
  assert.ok(run);
  return run;
}
async function proveDestroyed(chatId: string) {
  const rows =
    await sql`SELECT "externalId", status FROM "SandboxInstance" WHERE "chatId" = ${chatId}`;
  assert.ok(rows.length > 0);
  const { control } = buildSandboxProvider(kind);
  assert.ok(control);
  for (const row of rows) {
    assert.equal(row.status, "destroyed");
    // biome-ignore lint/performance/noAwaitInLoops: independently verify every acquired test container
    const observed = await control.inspect(row.externalId);
    assert.ok(observed === null || observed.status === "destroyed");
  }
}
let passed = false;
try {
  await sql`INSERT INTO "User" (id, email) VALUES (${owner}, ${`${owner}@test.local`}), (${other}, ${`${other}@test.local`})`;
  await sql`INSERT INTO "Member" ("userId", status) VALUES (${owner}, 'enabled'), (${other}, 'enabled')`;
  await waitFor(async () => {
    if (server.exitCode !== null) {
      throw new Error(`dev server stopped; inspect ${root}/server.log`);
    }
    try {
      return (await request("/api/chat/runtime-options")).status === 200
        ? true
        : null;
    } catch {
      return null;
    }
  });
  assert.equal(
    (await (await request("/api/chat/runtime-options")).json()).durableSandbox,
    true
  );
  assert.equal(
    (await (await request("/api/chat/runtime-options", otherCookie)).json())
      .durableSandbox,
    true
  );
  await sql`UPDATE "Member" SET status = 'disabled' WHERE "userId" = ${other}`;
  assert.equal(
    (await (await request("/api/chat/runtime-options", otherCookie)).json())
      .durableSandbox,
    false
  );
  await sql`UPDATE "Member" SET status = 'enabled' WHERE "userId" = ${other}`;
  assert.equal((await request("/api/chat/runtime-options", "")).status, 401);
  const catalog = await (await request("/api/models")).json();
  model =
    process.env.PIWORK_DURABLE_CHAT_HTTP_MODEL ??
    catalog.defaultModelId ??
    catalog.models?.[0]?.id;
  assert.ok(model, "configure an enabled tools-capable model");
  const deniedChat = await newChat();
  assert.equal(
    (await send(deniedChat, "hello", undefined, otherCookie)).status,
    403
  );
  assert.equal(
    (await sql`SELECT id FROM "AgentRun" WHERE "chatId" = ${deniedChat}`)
      .length,
    0
  );
  assert.equal((await send(deniedChat, "/some-skill test")).status, 404);

  const form = new FormData();
  form.append(
    "file",
    new File(["durable-private-probe\n"], "attached.txt", {
      type: "text/plain",
    })
  );
  const upload = await request("/api/files/upload", ownerCookie, {
    body: form,
    method: "POST",
  });
  assert.equal(upload.status, 200);
  const file = await upload.json();
  const foreignForm = new FormData();
  foreignForm.append(
    "file",
    new File(["other-user-secret"], "foreign.txt", { type: "text/plain" })
  );
  const foreignUpload = await request("/api/files/upload", otherCookie, {
    body: foreignForm,
    method: "POST",
  });
  assert.equal(foreignUpload.status, 200);
  const foreign = await foreignUpload.json();
  assert.equal((await send(deniedChat, "read this file", foreign)).status, 403);

  const artifactChat = await newChat();
  const response = await send(
    artifactChat,
    "这是工具集成验收。请必须调用 bash 执行 cat inputs/1-attached.txt > report.txt，再调用 deliver_file({path:'report.txt'})，最后只回复完成。只处理本地文件，不要模拟工具结果。",
    file
  );
  assert.equal(response.status, 200);
  const stream = await response.text();
  assert.ok(stream.includes('"type":"data-tool-status"'));
  assert.ok(stream.includes('"type":"data-delivered-file"'));
  assert.ok(!stream.includes('"type":"error"'));
  const successfulRun = await runRecord(artifactChat);
  assert.equal(successfulRun.backend, "durable_sandbox");
  assert.equal(successfulRun.status, "settled");
  const [artifact] =
    await sql`SELECT url FROM "LibraryItem" WHERE "userId" = ${owner} AND source = 'ai'`;
  assert.ok(artifact?.url.startsWith("/api/files/private-"));
  assert.equal(
    await (await request(artifact.url)).text(),
    "durable-private-probe\n"
  );
  assert.equal((await request(artifact.url, otherCookie)).status, 404);
  assert.equal((await request(artifact.url, "")).status, 401);
  const [message] =
    await sql`SELECT parts FROM "Message_v2" WHERE "chatId" = ${artifactChat} AND role = 'assistant'`;
  assert.ok(JSON.stringify(message?.parts).includes(artifact.url));
  const binding = JSON.parse(
    await readFile(
      path.join(storageRoot, successfulRun.id, "binding.json"),
      "utf8"
    )
  );
  assert.equal(binding.userId, owner);
  assert.equal(binding.runId, successfulRun.id);
  assert.match(binding.inputHash, /^[a-f0-9]{64}$/);
  assert.ok(
    !(await readdir(path.join(storageRoot, successfulRun.id))).includes(
      "owner.lock"
    )
  );
  await proveDestroyed(artifactChat);

  const abortedChat = await newChat();
  const abortResponse = await send(
    abortedChat,
    "这是停止测试。请只调用 bash({command:'sleep 120',timeout:180})，不要其他工具，不要提前回答。工具退出后再回复。"
  );
  assert.equal(abortResponse.status, 200);
  const abortStream = abortResponse.text();
  await waitFor(async () => {
    const [row] =
      await sql`SELECT id FROM "SandboxInstance" WHERE "chatId" = ${abortedChat} AND status = 'ready'`;
    return row ?? null;
  });
  assert.equal(
    (
      await request(`/api/chat/${abortedChat}/stop`, otherCookie, {
        method: "POST",
      })
    ).status,
    403
  );
  const stopped = await request(`/api/chat/${abortedChat}/stop`, ownerCookie, {
    method: "POST",
  });
  assert.equal(stopped.status, 200);
  assert.equal((await stopped.json()).aborted, true);
  await abortStream;
  const cancelled = await runRecord(abortedChat);
  assert.ok(cancelled.status === "aborted" || cancelled.status === "failed");
  // A cancelled in-flight shell may already have unknown effects: never rewrite
  // this to a fake completed/cleanly-aborted result just to satisfy a test.
  if (cancelled.status === "failed") {
    assert.match(cancelled.errorMessage, /outcome unknown|abort/i);
  }
  await proveDestroyed(abortedChat);

  const failedChat = await newChat();
  const failure = await send(
    failedChat,
    "这是超时验收。必须只调用 bash({command:'sleep 5',timeout:0.1})。不要修改参数，不要提前回答，不要其他工具。"
  );
  assert.equal(failure.status, 200);
  const failedStream = await failure.text();
  assert.ok(failedStream.includes('"type":"error"'));
  assert.ok(!failedStream.includes('"type":"data-delivered-file"'));
  assert.equal((await runRecord(failedChat)).status, "failed");
  await proveDestroyed(failedChat);

  const normalChat = await newChat();
  const normal = await send(normalChat, "你好");
  assert.equal(normal.status, 200);
  assert.ok(!(await normal.text()).includes('"type":"error"'));
  assert.equal((await runRecord(normalChat)).backend, "in_process");
  assert.equal(
    (await sql`SELECT id FROM "SandboxInstance" WHERE "chatId" = ${normalChat}`)
      .length,
    0
  );
  passed = true;
  console.log(
    "PASS: actual /api/chat stream, automatic Durable routing without client lane, attachment hydration, SQLite binding, private archive/download, cross-user isolation, cancellation, timeout, provider deletion and unchanged normal chat"
  );
} finally {
  controller.abort();
  // On failure preserve evidence, owners and isolated DB rows for reconciliation.
  // Successful cleanup drops ONLY this unique schema, after the dev server stops.
  if (!passed) {
    console.error(
      `Evidence retained: ${root}; isolated schema ${database.name}; test owner ${owner}; other ${other}`
    );
  }
  if (server.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      /* already stopped */
    }
    await Promise.race([
      new Promise((resolve) => server.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
    try {
      process.kill(-server.pid, "SIGKILL");
    } catch {
      /* already stopped */
    }
  }
  await serverLog.close();
  const currentEnvDeclaration = await readFile("next-env.d.ts", "utf8");
  const generatedImport = `import "./${path.relative(process.cwd(), root)}/next/dev/types/routes.d.ts";`;
  if (currentEnvDeclaration.includes(generatedImport)) {
    const originalImport =
      baselineEnvDeclaration.match(/^import .*;$/m)?.[0] ?? "";
    await writeFile(
      "next-env.d.ts",
      currentEnvDeclaration.replace(generatedImport, originalImport)
    );
  }
  await database.close(passed);
  if (passed) {
    await rm(root, { force: true, recursive: true });
  }
}
