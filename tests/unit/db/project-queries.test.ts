import "../../support/db-env";
import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import {
  createProject,
  createProjectChat,
  createSource,
  deleteProject,
  deleteSource,
  getProject,
  listProjectChats,
  listProjectSourceContents,
  listProjects,
  listSources,
  renameProject,
  touchProject,
} from "../../../lib/db/project-queries";

const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
const owner = crypto.randomUUID();
const other = crypto.randomUUID();

test.before(async () => {
  await sql`INSERT INTO "User" (id, email) VALUES (${owner}, ${`${owner}@test.local`}), (${other}, ${`${other}@test.local`})`;
});

test.after(async () => {
  await sql`DELETE FROM "User" WHERE id IN (${owner}, ${other})`;
  await sql.end();
});

test("project CRUD enforces ownership", async () => {
  const created = await createProject(owner, "测试项目");
  assert.ok(created);
  assert.equal(created.name, "测试项目");

  // 他人不可见、不可改、不可删
  assert.equal(await getProject(other, created.id), null);
  assert.equal(await renameProject(other, created.id, "抢改"), null);
  assert.equal(await deleteProject(other, created.id), null);

  const renamed = await renameProject(owner, created.id, "改名项目");
  assert.equal(renamed?.name, "改名项目");
  assert.ok(await getProject(owner, created.id));

  await touchProject(created.id);
  const listed = await listProjects(owner);
  assert.ok(listed.some((project) => project.id === created.id));
  assert.equal((await listProjects(other)).length, 0);

  const deleted = await deleteProject(owner, created.id);
  assert.equal(deleted?.id, created.id);
  assert.equal(await getProject(owner, created.id), null);
});

test("project chats list newest-first with last message summary", async () => {
  const project = await createProject(owner, "聊天列表项目");
  assert.ok(project);
  const olderChat = await createProjectChat({
    projectId: project.id,
    title: "较早聊天",
    userId: owner,
  });
  const newerChat = await createProjectChat({
    id: crypto.randomUUID(),
    projectId: project.id,
    title: "较新聊天",
    userId: owner,
  });
  assert.equal(olderChat.title, "较早聊天");

  await sql`INSERT INTO "Message_v2" (id, "chatId", role, parts, attachments, "createdAt") VALUES
    (${crypto.randomUUID()}, ${olderChat.id}, 'user', ${JSON.stringify([
      { text: "第一条消息", type: "text" },
    ])}::json, '[]'::json, now() - interval '2 minutes'),
    (${crypto.randomUUID()}, ${olderChat.id}, 'assistant', ${JSON.stringify([
      { text: "较早聊天的回复摘要", type: "text" },
    ])}::json, '[]'::json, now() - interval '1 minute')`;

  await sql`UPDATE "Chat" SET "updatedAt" = now() WHERE id = ${olderChat.id}`;

  const chats = await listProjectChats(owner, project.id);
  assert.equal(chats.length, 2);
  assert.equal(chats[0]?.chatId, olderChat.id);
  assert.equal(chats[0]?.summary, "较早聊天的回复摘要");
  assert.equal(chats[1]?.chatId, newerChat.id);
  assert.equal(chats[1]?.summary, null);

  assert.equal((await listProjectChats(other, project.id)).length, 0);

  await deleteProject(owner, project.id);
  const [remaining] =
    await sql`SELECT count(*)::int AS n FROM "Chat" WHERE id IN (${olderChat.id}, ${newerChat.id})`;
  assert.equal(remaining.n, 0);
});

test("sources are stored per project and removed with it", async () => {
  const project = await createProject(owner, "资料项目");
  assert.ok(project);

  const created = await createSource(owner, project.id, {
    content: "项目资料全文内容",
    name: "handbook.md",
    type: "markdown",
  });
  assert.ok(created);

  // 他人项目写入被拒绝
  const otherProject = await createProject(other, "他人项目");
  assert.ok(otherProject);
  assert.equal(
    await createSource(other, project.id, {
      content: "越权写入",
      name: "evil.txt",
      type: "txt",
    }),
    null
  );

  const sources = await listSources(owner, project.id);
  assert.equal(sources?.length, 1);
  assert.equal(sources?.[0]?.name, "handbook.md");
  assert.equal(await listSources(other, project.id), null);

  const contents = await listProjectSourceContents(project.id);
  assert.deepEqual(
    contents.map((source) => source.name),
    ["handbook.md"]
  );

  const deleted = await deleteSource(owner, project.id, created.id);
  assert.equal(deleted?.name, "handbook.md");
  assert.equal(await deleteSource(owner, project.id, created.id), null);

  await createSource(owner, project.id, {
    content: "剩余资料",
    name: "notes.txt",
    type: "txt",
  });
  await deleteProject(owner, project.id);
  const [remaining] =
    await sql`SELECT count(*)::int AS n FROM "Source" WHERE "projectId" = ${project.id}`;
  assert.equal(remaining.n, 0);
  await deleteProject(other, otherProject.id);
});
