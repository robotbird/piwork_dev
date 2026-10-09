import "../../support/db-env";
import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import {
  addChatCollaborators,
  checkShareInvite,
  createShareInvite,
  filterEnabledMemberIds,
  forkChat,
  generateShareToken,
  getActiveShareInvite,
  getChatAccess,
  getChatShareSummary,
  hashShareToken,
  listChatHistoryIncludingShared,
  listChatParticipants,
  listShareableMembers,
  removeChatCollaborator,
  revokeShareInvite,
} from "@/lib/db/chat-share-queries";

const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });

const owner = crypto.randomUUID();
const alice = crypto.randomUUID();
const bob = crypto.randomUUID();
const disabledUser = crypto.randomUUID();
const noMemberUser = crypto.randomUUID();

async function createChat(id: string, userId: string, title: string) {
  await sql`
    INSERT INTO "Chat" (id, title, "userId", visibility, "createdAt", "updatedAt")
    VALUES (${id}, ${title}, ${userId}, 'private', now(), now())
  `;
}

async function insertMessage(
  chatId: string,
  role: string,
  text: string,
  userId?: string
) {
  await sql`
    INSERT INTO "Message_v2" (id, "chatId", role, parts, attachments, "createdAt", "userId")
    VALUES (
      ${crypto.randomUUID()},
      ${chatId},
      ${role},
      ${JSON.stringify([{ text, type: "text" }])}::json,
      '[]'::json,
      now(),
      ${userId ?? null}
    )
  `;
}

test.before(async () => {
  await sql`INSERT INTO "User" (id, email) VALUES
    (${owner}, ${`${owner}@test.local`}),
    (${alice}, ${`${alice}@test.local`}),
    (${bob}, ${`${bob}@test.local`}),
    (${disabledUser}, ${`${disabledUser}@test.local`}),
    (${noMemberUser}, ${`${noMemberUser}@test.local`})`;
  await sql`INSERT INTO "Member" (id, "userId", status, role) VALUES
    (${crypto.randomUUID()}, ${owner}, 'enabled', 'member'),
    (${crypto.randomUUID()}, ${alice}, 'enabled', 'member'),
    (${crypto.randomUUID()}, ${bob}, 'enabled', 'member'),
    (${crypto.randomUUID()}, ${disabledUser}, 'disabled', 'member')`;
});

test.after(async () => {
  // 消息→聊天→用户依序清理（Message_v2.chatId 无级联规则）
  await sql`DELETE FROM "Message_v2" WHERE "chatId" IN (SELECT id FROM "Chat" WHERE "userId" IN (${owner}, ${alice}, ${bob}))`;
  await sql`DELETE FROM "Chat" WHERE "userId" IN (${owner}, ${alice}, ${bob})`;
  await sql`DELETE FROM "User" WHERE id IN (${owner}, ${alice}, ${bob}, ${disabledUser}, ${noMemberUser})`;
  await sql.end();
});

test("getChatAccess distinguishes owner, collaborator and stranger", async () => {
  const chatId = crypto.randomUUID();
  await createChat(chatId, owner, "访问判定对话");

  const ownerAccess = await getChatAccess(chatId, owner);
  assert.equal(ownerAccess?.isOwner, true);
  assert.equal(ownerAccess?.isCollaborator, false);

  // 陌生人既非所有者也非协作成员
  const stranger = await getChatAccess(chatId, alice);
  assert.equal(stranger?.isOwner, false);
  assert.equal(stranger?.isCollaborator, false);

  // 添加协作成员后判定翻转
  const added = await addChatCollaborators(chatId, owner, [alice]);
  assert.equal(added, 1);
  const collaborator = await getChatAccess(chatId, alice);
  assert.equal(collaborator?.isCollaborator, true);
  assert.equal(collaborator?.isOwner, false);

  // 重复添加幂等
  assert.equal(await addChatCollaborators(chatId, owner, [alice]), 0);

  // 移除后恢复陌生人
  assert.equal(await removeChatCollaborator(chatId, alice), true);
  assert.equal(
    await getChatAccess(chatId, alice).then((a) => a?.isCollaborator),
    false
  );
  assert.equal(await removeChatCollaborator(chatId, alice), false);
});

test("filterEnabledMemberIds only keeps enabled members", async () => {
  const kept = await filterEnabledMemberIds([
    alice,
    disabledUser,
    noMemberUser,
  ]);
  assert.deepEqual(kept.sort(), [alice].sort());
  assert.deepEqual(await filterEnabledMemberIds([]), []);
});

test("share invite lifecycle: create once, rotate, revoke, expire check", async () => {
  const chatId = crypto.randomUUID();
  await createChat(chatId, owner, "链接生命周期");

  // 无活跃链接时创建，返回明文 token
  const first = await createShareInvite(chatId, owner);
  assert.match(first.token, /^[A-Za-z0-9_-]{32}$/);
  assert.ok(first.expiresAt.getTime() > Date.now() + 6 * 24 * 3600 * 1000);

  // 已有活跃链接时重复创建报错（路由层先查再建）
  await assert.rejects(
    () => createShareInvite(chatId, owner),
    /share-invite:active-exists/
  );

  // 有效 token 校验通过，错误 token 拒绝
  const valid = await checkShareInvite(chatId, first.token);
  assert.equal(valid?.chatId, chatId);
  assert.equal(await checkShareInvite(chatId, "wrong-token"), null);
  assert.equal(await checkShareInvite(chatId, ""), null);

  // 摘要不泄露 token
  const summary = await getActiveShareInvite(chatId);
  assert.ok(summary?.expiresAt);
  assert.equal("token" in (summary ?? {}), false);

  // 重新生成（轮换）后旧链接立即失效
  const second = await createShareInvite(chatId, owner, {
    replaceActive: true,
  });
  assert.notEqual(first.token, second.token);
  assert.equal(await checkShareInvite(chatId, first.token), null);
  assert.ok(await checkShareInvite(chatId, second.token));

  // 撤销后全部失效
  assert.equal(await revokeShareInvite(chatId), 1);
  assert.equal(await checkShareInvite(chatId, second.token), null);
  assert.equal(await getActiveShareInvite(chatId), null);
  assert.equal(await revokeShareInvite(chatId), 0);
});

test("share invite join checks hash equality against stored sha256", async () => {
  const chatId = crypto.randomUUID();
  await createChat(chatId, owner, "哈希校验对话");
  const created = await createShareInvite(chatId, owner);

  const [row] =
    await sql`SELECT "tokenHash" FROM "ChatShareInvite" WHERE "chatId" = ${chatId}`;
  assert.equal(row.tokenHash, hashShareToken(created.token));

  // 越权伪造：别的对话的 token 不能通过本对话校验
  const otherChatId = crypto.randomUUID();
  await createChat(otherChatId, owner, "另一对话");
  const otherInvite = await createShareInvite(otherChatId, owner);
  assert.equal(await checkShareInvite(chatId, otherInvite.token), null);
});

test("participants list owner first with collaborators", async () => {
  const chatId = crypto.randomUUID();
  await createChat(chatId, owner, "参与者列表");
  await addChatCollaborators(chatId, owner, [alice, bob]);

  // 头像投影：User.image 是本人 library 预览地址时改发 /api/users/:id/avatar
  //（本人地址直接发给他人会 404）；未设置 → null（前端回退首字母）
  await sql`UPDATE "User" SET image = ${`/api/library/${crypto.randomUUID()}?preview=1`} WHERE id = ${owner}`;

  const participants = await listChatParticipants(chatId);
  assert.equal(participants.length, 3);
  assert.equal(participants[0]?.userId, owner);
  assert.equal(participants[0]?.role, "owner");
  assert.equal(participants[0]?.image, `/api/users/${owner}/avatar`);
  assert.equal(participants[1]?.role, "collaborator");
  // alice 未设置头像 → null
  assert.equal(participants.find((p) => p.userId === alice)?.image, null);
  assert.ok(participants.slice(1).every((p) => p.role === "collaborator"));

  // 说话归属：listShareableMembers 排除自己且不含禁用成员
  const members = await listShareableMembers(owner);
  const ids = members.map((m) => m.userId);
  assert.ok(ids.includes(alice));
  assert.ok(!ids.includes(owner));
  assert.ok(!ids.includes(disabledUser));
});

test("fork copies chat and messages with fresh ids, source untouched", async () => {
  const sourceChatId = crypto.randomUUID();
  await createChat(sourceChatId, owner, "被 Fork 的对话");
  await insertMessage(sourceChatId, "user", "源消息一", owner);
  await insertMessage(sourceChatId, "assistant", "源回复一");
  await addChatCollaborators(sourceChatId, owner, [alice]);

  const [sourceMessagesBefore] =
    await sql`SELECT count(*)::int AS n FROM "Message_v2" WHERE "chatId" = ${sourceChatId}`;

  const forked = await forkChat({ sourceChatId, userId: alice });
  assert.ok(forked);
  assert.equal(forked.copiedMessages, 2);
  assert.notEqual(forked.chatId, sourceChatId);

  const [forkRow] = await sql`SELECT * FROM "Chat" WHERE id = ${forked.chatId}`;
  assert.equal(forkRow.userId, alice);
  assert.equal(forkRow.title, "被 Fork 的对话（分支）");
  assert.equal(forkRow.visibility, "private");
  assert.equal(forkRow.forkedFromChatId, sourceChatId);

  const forkMessages = await sql`
    SELECT id, role, "userId", parts FROM "Message_v2"
    WHERE "chatId" = ${forked.chatId} ORDER BY "createdAt" ASC
  `;
  assert.equal(forkMessages.length, 2);
  // 消息 id 全部重新生成，不与源冲突
  const [sourceIds, forkIds] = await Promise.all([
    sql`SELECT id FROM "Message_v2" WHERE "chatId" = ${sourceChatId}`,
    sql`SELECT id FROM "Message_v2" WHERE "chatId" = ${forked.chatId}`,
  ]);
  assert.equal(sourceMessagesBefore.n, 2);
  const sourceIdSet = new Set(sourceIds.map((r) => String(r.id)));
  for (const row of forkIds) {
    assert.ok(!sourceIdSet.has(String(row.id)));
  }
  // 消息归属保留
  assert.equal(forkMessages[0].role, "user");
  assert.equal(forkMessages[0].userId, owner);
  assert.equal(forkMessages[1].role, "assistant");

  // 源对话不动
  const [sourceAfter] =
    await sql`SELECT count(*)::int AS n FROM "Message_v2" WHERE "chatId" = ${sourceChatId}`;
  assert.equal(sourceAfter.n, 2);
  const [sourceCollab] =
    await sql`SELECT count(*)::int AS n FROM "ChatCollaborator" WHERE "chatId" = ${sourceChatId}`;
  assert.equal(sourceCollab.n, 1);

  // fork 产物没有协作成员与分享链接
  const [forkCollab] =
    await sql`SELECT count(*)::int AS n FROM "ChatCollaborator" WHERE "chatId" = ${forked.chatId}`;
  assert.equal(forkCollab.n, 0);

  // 源删除后分支保留，forkedFromChatId 置空（Message_v2.chatId 无级联，
  // 与平台删除链路一致：先删消息再删聊天）
  await sql`DELETE FROM "Message_v2" WHERE "chatId" IN (${sourceChatId}, ${forked.chatId})`;
  await sql`DELETE FROM "Chat" WHERE id = ${sourceChatId}`;
  const [forkAfter] =
    await sql`SELECT "forkedFromChatId" FROM "Chat" WHERE id = ${forked.chatId}`;
  assert.equal(forkAfter.forkedFromChatId, null);
});

test("join summary exposes counts only, not message bodies", async () => {
  const chatId = crypto.randomUUID();
  await createChat(chatId, owner, "加入页概要");
  await insertMessage(chatId, "user", "机密内容不应出现在概要", owner);
  await addChatCollaborators(chatId, owner, [alice]);

  const summary = await getChatShareSummary(chatId);
  assert.equal(summary?.title, "加入页概要");
  assert.equal(summary?.messageCount, 1);
  assert.equal(summary?.collaboratorCount, 1);
  // 测试用户未设置姓名：ownerName 为 null，界面回退到 userId 头像
  assert.equal(summary?.ownerName, null);
  assert.equal("participants" in (summary ?? {}), false);
});

test("history list merges own and shared chats with cursor", async () => {
  const ownChat = crypto.randomUUID();
  const sharedChat = crypto.randomUUID();
  const strangerChat = crypto.randomUUID();
  // 显式错开创建时间（同一毫秒内的墙钟会在游标比较中被截断，这是
  // getChatsByUserId 以来既有的分页精度，不因本功能改变）
  await sql`INSERT INTO "Chat" (id, title, "userId", visibility, "createdAt", "updatedAt") VALUES
    (${ownChat}, 'alice 自己的对话', ${alice}, 'private', now() - interval '5 minutes', now()),
    (${sharedChat}, 'owner 分享给 alice', ${owner}, 'private', now() - interval '1 minute', now()),
    (${strangerChat}, '与 alice 无关', ${owner}, 'private', now(), now())`;
  await addChatCollaborators(sharedChat, owner, [alice]);

  // alice 视角：自己的 + 被分享的
  const alicePage = await listChatHistoryIncludingShared({
    id: alice,
    limit: 20,
  });
  const aliceIds = alicePage.chats.map((c) => c.id);
  assert.ok(aliceIds.includes(ownChat));
  assert.ok(aliceIds.includes(sharedChat));
  assert.ok(!aliceIds.includes(strangerChat));

  const sharedItem = alicePage.chats.find((c) => c.id === sharedChat);
  assert.equal(sharedItem?.sharedWithMe, true);
  const ownItem = alicePage.chats.find((c) => c.id === ownChat);
  assert.equal(ownItem?.sharedWithMe, false);

  // owner 视角：sharedChat 不带 sharedWithMe
  const ownerPage = await listChatHistoryIncludingShared({
    id: owner,
    limit: 20,
  });
  const ownerShared = ownerPage.chats.find((c) => c.id === sharedChat);
  assert.equal(ownerShared?.sharedWithMe, false);

  // 分页游标：ending_before 返回的应恰好是全量列表中锚点之后的条目
  //（不直接比较两种客户端解析的 Date：裸 postgres() 按本地时区解析
  // timestamp，drizzle 按 UTC 墙钟解析，混比会差 8 小时——平台既有约定）
  const full = await listChatHistoryIncludingShared({ id: alice, limit: 50 });
  const anchorIndex = full.chats.findIndex((c) => c.id === sharedChat);
  assert.ok(anchorIndex >= 0);
  const expectedIds = full.chats.slice(anchorIndex + 1).map((c) => c.id);
  const page = await listChatHistoryIncludingShared({
    endingBefore: sharedChat,
    id: alice,
    limit: 20,
  });
  assert.deepEqual(
    page.chats.map((c) => c.id),
    expectedIds
  );

  // 移除协作成员后从 alice 的列表消失
  await removeChatCollaborator(sharedChat, alice);
  const afterRemove = await listChatHistoryIncludingShared({
    id: alice,
    limit: 20,
  });
  assert.ok(!afterRemove.chats.some((c) => c.id === sharedChat));
});

test("token generator produces unique values compatible with join route limits", () => {
  const tokens = new Set(
    Array.from({ length: 50 }, () => generateShareToken())
  );
  assert.equal(tokens.size, 50);
  for (const token of tokens) {
    assert.ok(token.length >= 1 && token.length <= 128);
  }
});
