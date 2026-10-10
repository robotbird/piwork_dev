// Opt-in real HTTP/model/provider smoke with a disposable enabled identity.
// Failures retain this fixture for review; never clean other users/chats/runs.
import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { encode } from "next-auth/jwt";
import postgres from "postgres";
import { getChatFileId } from "../../lib/ai/attachment-types";
import { buildSandboxProvider } from "../../lib/runtime/sandbox/configuration";

if (process.env.PIWORK_OPENSANDBOX_CHAT_TEST !== "1") {
  console.log(
    "Skipped: set PIWORK_OPENSANDBOX_CHAT_TEST=1 for a real model/provider request."
  );
  process.exit(0);
}
assert.equal(process.env.PIWORK_SANDBOX_PROVIDER, "opensandbox");
assert(process.env.AUTH_SECRET && process.env.POSTGRES_URL);
const timeCase = process.env.PIWORK_OPENSANDBOX_TIME_TEST === "1";
const skillCase = process.env.PIWORK_OPENSANDBOX_SKILL_HTTP_TEST === "1";
assert(!(timeCase && skillCase), "Select only one execution probe");
if (timeCase || skillCase) {
  assert(
    !process.env.BLOB_READ_WRITE_TOKEN,
    "Time-file probe requires local storage to permit scoped cleanup"
  );
  assert(process.env.UPLOAD_DIR && path.isAbsolute(process.env.UPLOAD_DIR));
}
const db = postgres(process.env.POSTGRES_URL, { max: 1 });
const base = process.env.OPENSANDBOX_CHAT_TEST_URL ?? "http://127.0.0.1:3002";
const userId = crypto.randomUUID();
const chatId = crypto.randomUUID();
const email = `sbx-smoke-${userId}@test.local`;
const evidence = path.join(
  "/var/tmp",
  `piwork-opensandbox-chat-${chatId}.json`
);
const cookie = `authjs.session-token=${await encode({ salt: "authjs.session-token", secret: process.env.AUTH_SECRET, token: { email, id: userId, sub: userId, type: "regular" } })}`;
const headers = { "Content-Type": "application/json", Cookie: cookie };
let success = false;
const skillName = `skill-http-${userId.slice(0, 8)}`;
let skillInstalled = false;
try {
  await db`INSERT INTO "User" (id,email,name) VALUES (${userId},${email},'OpenSandbox disposable smoke')`;
  await db`INSERT INTO "Member" ("userId",role,status) VALUES (${userId},'admin','enabled')`;
  await writeFile(
    evidence,
    JSON.stringify({ chatId, phase: "created", userId }),
    { mode: 0o600 }
  );
  const settingsResponse = await fetch(`${base}/api/admin/sandbox-settings`, {
    headers,
  });
  assert.equal(settingsResponse.status, 200);
  const settings = await settingsResponse.json();
  assert.equal(settings.provider, "opensandbox");
  assert.equal(settings.inferenceConfigured, true);
  const modelResponse = await fetch(`${base}/api/models`, { headers });
  assert.equal(modelResponse.status, 200);
  const catalog = await modelResponse.json();
  const preferred = catalog.models.find(
    (m: { id: string; capabilities?: { tools?: boolean } }) =>
      m.id === catalog.defaultModelId && m.capabilities?.tools
  );
  const model =
    preferred ??
    catalog.models.find(
      (m: { capabilities?: { tools?: boolean } }) => m.capabilities?.tools
    );
  assert(model, "An enabled tool-capable model is required");
  if (skillCase) {
    const root = process.env.PIWORK_SKILL_HTTP_FIXTURE_ROOT;
    assert(
      root && path.isAbsolute(root),
      "Provide the controlled Skill fixture root"
    );
    const form = new FormData();
    for (const relative of [
      "SKILL.md",
      "scripts/report.mjs",
      "assets/value.txt",
      "references/usage.txt",
    ]) {
      // biome-ignore lint/performance/noAwaitInLoops: read four controlled fixture files serially
      let content = await readFile(path.join(root, relative));
      if (relative === "SKILL.md") {
        content = Buffer.from(
          content
            .toString("utf8")
            .replace("name: sandbox-script", `name: ${skillName}`)
        );
      }
      form.append(
        "files",
        new File([new Uint8Array(content)], path.basename(relative))
      );
      form.append("paths", `${skillName}/${relative}`);
    }
    const uploaded = await fetch(`${base}/api/admin/skills`, {
      body: form,
      headers: { Cookie: cookie },
      method: "POST",
    });
    assert.equal(uploaded.status, 201, await uploaded.text());
    skillInstalled = true;
    const enabled = await fetch(`${base}/api/admin/skills`, {
      body: JSON.stringify({ enabled: true, name: skillName }),
      headers,
      method: "PATCH",
    });
    assert.equal(enabled.status, 200);
  }
  async function prompt(text: string, backend: string) {
    const response = await fetch(`${base}/api/chat`, {
      body: JSON.stringify({
        id: chatId,
        message: {
          id: crypto.randomUUID(),
          parts: [{ text, type: "text" }],
          role: "user",
        },
        selectedChatModel: model.id,
        selectedVisibilityType: "private",
      }),
      headers,
      method: "POST",
      signal: AbortSignal.timeout(150_000),
    });
    assert.equal(response.status, 200);
    const stream = await response.text();
    let run:
      | {
          id: string;
          backend: string;
          status: string;
          errorMessage: string | null;
        }
      | undefined;
    for (let n = 0; n < 20; n += 1) {
      // biome-ignore lint/performance/noAwaitInLoops: poll this run's asynchronous terminal status
      [run] = await db<
        {
          id: string;
          backend: string;
          status: string;
          errorMessage: string | null;
        }[]
      >`SELECT id, backend, status, "errorMessage" FROM "AgentRun" WHERE "chatId"=${chatId} ORDER BY "createdAt" DESC LIMIT 1`;
      if (run && ["settled", "failed", "aborted"].includes(run.status)) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    assert(run);
    await writeFile(
      evidence,
      JSON.stringify({
        backend: run.backend,
        chatId,
        error: run.errorMessage,
        runId: run.id,
        status: run.status,
        userId,
      }),
      { mode: 0o600 }
    );
    assert.equal(run.backend, backend);
    assert.equal(run.status, "settled", run.errorMessage ?? "Run must settle");
    console.log("PASS: HTTP chat", {
      backend: run.backend,
      runId: run.id,
      status: run.status,
    });
    return { run, stream };
  }
  if (!skillCase) {
    await prompt("你好，请简短回复。", "in_process");
  }
  const result = await prompt(
    skillCase
      ? `/${skillName} 请运行此 Skill 已有的 scripts/report.mjs，使用其 assets 与 references，不重写脚本、不安装依赖。将脚本生成的 skill-result.txt 用 deliver_file 交付给我。`
      : timeCase
        ? "请获取当前服务器时间 写入time.txt"
        : "请直接使用 bash 在沙箱工作目录创建 hello.txt，写入 OPEN_SANDBOX_SMOKE_OK，然后执行 cat hello.txt 验证内容。不要使用 Skill、定时任务、联网搜索或交付文件工具。最终只回答读取到的内容。",
    "sandbox_rpc"
  );
  if (!timeCase && !skillCase) {
    assert(result.stream.includes("OPEN_SANDBOX_SMOKE_OK"));
  }
  const tools =
    await db`SELECT data FROM "RuntimeEvent" WHERE "runId"=${result.run.id} AND type='tool.completed'`;
  assert(
    tools.some(
      (event) => event.data.toolName === "bash" && event.data.isError === false
    ),
    "Must successfully execute bash"
  );
  let instances =
    await db`SELECT "externalId",status,"runtimeConfig" FROM "SandboxInstance" WHERE "lastRunId"=${result.run.id}`;
  for (let n = 0; n < 20 && instances[0]?.status !== "destroyed"; n += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: run settles before async backend close/release completes
    await new Promise((resolve) => setTimeout(resolve, 1000));
    instances =
      await db`SELECT "externalId",status,"runtimeConfig" FROM "SandboxInstance" WHERE "lastRunId"=${result.run.id}`;
  }
  assert.equal(instances.length, 1);
  assert.equal(instances[0].status, "destroyed");
  const provider = buildSandboxProvider("opensandbox");
  assert.equal(
    await provider.control?.inspect(instances[0].externalId),
    null,
    "Provider must independently confirm deletion"
  );
  assert.deepEqual(instances[0].runtimeConfig.resource, settings.resource);
  console.log(
    "PASS: tool execution, saved resource snapshot and destroyed sandbox",
    instances[0].externalId
  );
  if (skillCase) {
    const started =
      await db`SELECT data FROM "RuntimeEvent" WHERE "runId"=${result.run.id} AND type='tool.started'`;
    const script = started.find(
      (event) =>
        event.data.toolName === "bash" &&
        typeof event.data.args?.command === "string" &&
        event.data.args.command.includes("report.mjs") &&
        event.data.args.command.includes("piwork/skills/")
    );
    assert(
      script,
      "Must invoke the uploaded script at its sandbox-local Skill path"
    );
    assert(
      tools.some(
        (event) =>
          event.data.toolCallId === script.data.toolCallId &&
          event.data.isError === false
      )
    );
    const artifacts =
      await db`SELECT data FROM "RuntimeEvent" WHERE "runId"=${result.run.id} AND type='artifact.created'`;
    const artifact = artifacts.find(
      (event) => event.data.file.filename === "skill-result.txt"
    );
    assert(artifact, "Must actually archive and deliver the script output");
    assert(getChatFileId(artifact.data.file.url));
    const download = await fetch(`${base}${artifact.data.file.url}`, {
      headers,
    });
    assert.equal(download.status, 200);
    assert.equal(await download.text(), "SKILL_SCRIPT_OK:沙箱资源:引用说明");
    console.log(
      "PASS: uploaded Skill command, sandbox script/resources, archived authenticated download"
    );
  }
  if (timeCase) {
    const artifacts =
      await db`SELECT data FROM "RuntimeEvent" WHERE "runId"=${result.run.id} AND type='artifact.created'`;
    const artifact = artifacts.find(
      (event) => event.data.file.filename === "time.txt"
    );
    const started =
      await db`SELECT data FROM "RuntimeEvent" WHERE "runId"=${result.run.id} AND type='tool.started'`;
    const write = started.find(
      (event) =>
        event.data.toolName === "bash" &&
        typeof event.data.args?.command === "string" &&
        /\bdate\b/.test(event.data.args.command) &&
        event.data.args.command.includes("time.txt")
    );
    assert(
      write,
      "Exact prompt must obtain the clock and target time.txt through sandbox bash"
    );
    assert(
      tools.some(
        (event) =>
          event.data.toolCallId === write.data.toolCallId &&
          event.data.isError === false
      )
    );
    assert(
      result.stream.includes("time.txt") && /\d{1,2}:\d{2}/.test(result.stream),
      "Response must report the time-file result"
    );
    console.log(
      "PASS: exact reported prompt executed date and wrote time.txt inside sandbox"
    );
    // Writing a temporary file does not guarantee a download. Only validate
    // delivery when the model actually invokes deliver_file; never invent it.
    if (artifact) {
      assert(
        getChatFileId(artifact.data.file.url),
        "Download must be a platform local-file URL, never an arbitrary host"
      );
      const download = await fetch(`${base}${artifact.data.file.url}`, {
        headers,
      });
      assert.equal(download.status, 200);
      const content = await download.text();
      assert(/\d{4}/.test(content) && /\d{1,2}:\d{2}/.test(content));
      console.log("PASS: optional time.txt archive and authenticated download");
    } else {
      console.log(
        "No download delivery requested/observed; temporary file removed with sandbox"
      );
    }
  }
  success = true;
} finally {
  if (skillInstalled) {
    const removed = await fetch(`${base}/api/admin/skills`, {
      body: JSON.stringify({ name: skillName }),
      headers,
      method: "DELETE",
    });
    if (removed.status !== 200) {
      success = false;
      process.exitCode = 1;
      console.error("Failed to remove this probe's Skill:", skillName);
      await fetch(`${base}/api/admin/skills`, {
        body: JSON.stringify({ enabled: false, name: skillName }),
        headers,
        method: "PATCH",
      });
    }
  }
  if (success) {
    const files =
      await db`SELECT url FROM "LibraryItem" WHERE "userId"=${userId} AND kind='file'`;
    await db.begin(async (tx) => {
      await tx`DELETE FROM "LibraryItem" WHERE "userId"=${userId}`;
      await tx`DELETE FROM "SandboxInstance" WHERE "chatId"=${chatId} AND "userId"=${userId} AND status='destroyed'`;
      await tx`DELETE FROM "Vote_v2" WHERE "chatId"=${chatId}`;
      await tx`DELETE FROM "Message_v2" WHERE "chatId"=${chatId}`;
      await tx`DELETE FROM "Chat" WHERE id=${chatId} AND "userId"=${userId}`;
      await tx`DELETE FROM "User" WHERE id=${userId}`;
    });
    for (const file of files) {
      const fileId =
        typeof file.url === "string" ? getChatFileId(file.url) : null;
      if (fileId && process.env.UPLOAD_DIR) {
        // biome-ignore lint/performance/noAwaitInLoops: remove only platform-validated files owned by this disposable identity
        await rm(path.join(process.env.UPLOAD_DIR, fileId), { force: true });
        await rm(path.join(process.env.UPLOAD_DIR, `${fileId}.json`), {
          force: true,
        });
      }
    }
    await rm(path.join(process.cwd(), ".pi", "workspace", chatId), {
      force: true,
      recursive: true,
    });
    await rm(evidence, { force: true });
    console.log("PASS: only smoke identity/chat/workspace cleaned");
  } else {
    await db`UPDATE "Member" SET status='disabled' WHERE "userId"=${userId}`;
    console.error(
      "Smoke failed; disabled fixture and evidence retained:",
      evidence
    );
  }
  await db.end();
}
