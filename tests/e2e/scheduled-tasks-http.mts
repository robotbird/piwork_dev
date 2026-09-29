import "../support/db-env";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { encode } from "next-auth/jwt";
import postgres from "postgres";

const base = process.env.SCHEDULER_TEST_URL ?? "http://localhost:3000";
const secret = process.env.AUTH_SECRET;
assert.ok(secret);
const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
const owner = crypto.randomUUID();
const other = crypto.randomUUID();
const input = {
  prompt: "只回复：任务运行验收成功。不要调用工具。",
  schedule: { cron: "0 9 * * *", timezone: "Asia/Shanghai" },
  taskType: "任务管理验收",
};
const token = async (id: string) =>
  `authjs.session-token=${await encode({ salt: "authjs.session-token", secret, token: { email: `${id}@test.local`, id, sub: id, type: "regular" } })}`;
const ownerCookie = await token(owner);
const otherCookie = await token(other);
function request(
  url: string,
  method = "GET",
  body?: unknown,
  cookie = ownerCookie
) {
  return fetch(`${base}${url}`, {
    headers: { "Content-Type": "application/json", Cookie: cookie },
    method,
    redirect: "manual",
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(180_000),
  });
}
try {
  await sql`INSERT INTO "User" (id, email) VALUES (${owner}, ${`${owner}@test.local`}), (${other}, ${`${other}@test.local`})`;
  const create = await request("/api/scheduled-tasks", "POST", input);
  assert.equal(create.status, 201, await create.clone().text());
  const task = await create.json();
  const url = `/api/scheduled-tasks/${task.id}`;
  assert.equal((await request(url, "GET", undefined, otherCookie)).status, 404);
  assert.equal((await request(url, "PATCH", input, otherCookie)).status, 404);
  assert.equal(
    (await request(url, "DELETE", undefined, otherCookie)).status,
    404
  );
  assert.equal(
    (await request(url, "POST", { action: "run" }, otherCookie)).status,
    404
  );
  assert.equal(
    (await request("/api/scheduled-tasks/execute", "POST")).status,
    401
  );
  assert.equal(
    (await request("/api/scheduled-tasks", "POST", { ...input, userId: other }))
      .status,
    400
  );
  assert.equal(
    (
      await request("/api/scheduled-tasks", "POST", {
        ...input,
        schedule: { cron: "bad" },
      })
    ).status,
    400
  );
  assert.equal((await request("/api/scheduled-tasks/invalid-id")).status, 400);
  const edit = await request(url, "PATCH", {
    ...input,
    taskType: "编辑后的任务",
  });
  assert.equal(edit.status, 200);
  assert.equal((await edit.json()).taskType, "编辑后的任务");
  assert.equal(
    (await (await request(url, "POST", { action: "pause" })).json()).enabled,
    false
  );
  assert.equal(
    (await (await request(url, "POST", { action: "resume" })).json()).enabled,
    true
  );
  if (process.env.SCHEDULER_TEST_AI === "true") {
    const models = await (await request("/api/models")).json();
    assert.ok(
      models.models.length,
      "A configured model is required for AI acceptance"
    );
    if (process.env.SCHEDULER_TEST_AUTOMATIC === "true") {
      await sql`UPDATE "ScheduledTask" SET "nextRunAt" = ${new Date(Date.now() - 60_000).toISOString()}::timestamp WHERE id = ${task.id}`;
    } else {
      const run = await request(url, "POST", { action: "run" });
      assert.equal(run.status, 202);
    }
    const deadline = Date.now() + 120_000;
    let detail: {
      task: { status: string; errorMessage: string | null };
      runs: { chatId: string | null }[];
    };
    do {
      // biome-ignore lint/performance/noAwaitInLoops: poll the asynchronous run until its terminal status
      await new Promise((resolve) => setTimeout(resolve, 1000));
      detail = await (await request(url)).json();
    } while (
      (detail.task.status === "running" || detail.task.status === "pending") &&
      Date.now() < deadline
    );
    assert.equal(detail.task.status, "succeeded", detail.task.errorMessage);
    assert.ok(detail.runs[0].chatId);
    const messages =
      await sql`SELECT parts FROM "Message_v2" WHERE "chatId" = ${detail.runs[0].chatId} AND role = 'assistant'`;
    assert.match(JSON.stringify(messages), /任务运行验收成功/);
    console.log(
      "PASS: real Pi scheduled execution and persisted assistant result"
    );
    const chatId = crypto.randomUUID();
    const chat = await request("/api/chat", "POST", {
      id: chatId,
      message: {
        id: crypto.randomUUID(),
        parts: [
          {
            text: "请创建一个周期定时任务，名称为 AI创建验收，每天北京时间上午9点执行，内容是只回复早上好。请直接使用创建定时任务工具，不需要再确认。",
            type: "text",
          },
        ],
        role: "user",
      },
      selectedChatModel: models.defaultModelId ?? models.models[0].id,
      selectedVisibilityType: "private",
    });
    assert.equal(chat.status, 200);
    await chat.text();
    const tasks = await (await request("/api/scheduled-tasks")).json();
    const createdByAI = tasks.find((item: { taskType: string }) =>
      item.taskType.includes("AI创建验收")
    );
    assert.ok(createdByAI, "AI conversation must persist the requested task");
    assert.equal(createdByAI.schedule.cron, "0 9 * * *");
    console.log(
      "PASS: real AI conversation creates schedule through Pi custom tool"
    );
  }
  assert.equal((await request(url, "DELETE")).status, 200);
  assert.equal((await request(url)).status, 404);
  console.log(
    "PASS: HTTP CRUD, pause/resume, ownership, validation and protected scheduler endpoint"
  );
} finally {
  const chats =
    await sql`SELECT id FROM "Chat" WHERE "userId" IN (${owner}, ${other})`;
  // These users and their generated rows belong exclusively to this test.
  await sql`DELETE FROM "ScheduledTask" WHERE "userId" IN (${owner}, ${other})`;
  await sql`DELETE FROM "AgentRun" WHERE "userId" IN (${owner}, ${other})`;
  await sql`DELETE FROM "Message_v2" WHERE "chatId" IN (SELECT id FROM "Chat" WHERE "userId" IN (${owner}, ${other}))`;
  await sql`DELETE FROM "Chat" WHERE "userId" IN (${owner}, ${other})`;
  await sql`DELETE FROM "User" WHERE id IN (${owner}, ${other})`;
  await Promise.all(
    chats.map((chat) =>
      rm(path.join(process.cwd(), ".pi/workspace", chat.id), {
        force: true,
        recursive: true,
      })
    )
  );
  await sql.end();
}
