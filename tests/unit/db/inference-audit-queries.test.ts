import "../../support/db-env";
import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import {
  deleteInferenceAuditForChat,
  listInferenceAuditForChat,
  recordInferenceAudit,
} from "../../../lib/db/inference-audit-queries";

/**
 * InferenceAccessAudit 读写（spec §6 Phase 4「未授权访问失败且留脱敏审计」）：
 * 追加型、chatId 无外键（审计轨迹在 chat 删除后仍保留）、脱敏字段完整落库。
 */

const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
const owner = crypto.randomUUID();

async function createChat(title: string): Promise<string> {
  const id = crypto.randomUUID();
  await sql`INSERT INTO "Chat" (id, "userId", title, "createdAt", "updatedAt")
    VALUES (${id}, ${owner}, ${title}, now(), now())`;
  return id;
}

test.before(async () => {
  await sql`INSERT INTO "User" (id, email) VALUES (${owner}, ${`${owner}@test.local`})`;
});

test.after(async () => {
  // 审计不级联：chat 级清理覆盖不到已删 chat 的残留，按测试 runId 一并清
  const chats = await sql`SELECT id FROM "Chat" WHERE "userId" = ${owner}`;
  for (const chat of chats) {
    // biome-ignore lint/performance/noAwaitInLoops: 顺序清理各 chat 的审计行
    await deleteInferenceAuditForChat(chat.id as string);
  }
  await sql`DELETE FROM "InferenceAccessAudit" WHERE "runId" IN ('test-inference-orphan', 'test-inference-run-1', 'test-inference-run-2')`;
  await sql`DELETE FROM "Chat" WHERE "userId" = ${owner}`;
  await sql`DELETE FROM "User" WHERE id = ${owner}`;
  await sql.end();
});

test("record → list：脱敏字段落库、按时间倒序；未授权条目（chatId null）也可落", async () => {
  const chatId = await createChat("inference-audit-basic");
  await recordInferenceAudit({
    action: "stream",
    chatId,
    durationMs: 42,
    errorCode: "unauthorized",
    model: null,
    provider: null,
    runId: null,
    status: "denied",
  });
  await recordInferenceAudit({
    action: "stream",
    chatId,
    durationMs: 1200,
    inputTokens: 11,
    model: "deepseek-flash",
    outputTokens: 7,
    provider: "deepseek",
    runId: "test-inference-run-1",
    status: "allowed",
  });
  // chatId null（坏 token 无法定位 run）同样可落——不该被 chat 过滤看到
  await recordInferenceAudit({
    action: "stream",
    chatId: null,
    errorCode: "unauthorized",
    model: null,
    provider: null,
    runId: "test-inference-orphan",
    status: "denied",
  });

  const rows = await listInferenceAuditForChat(chatId);
  assert.equal(rows.length, 2);
  // 最近优先：allowed（后写）在前
  assert.equal(rows[0].status, "allowed");
  assert.equal(rows[0].provider, "deepseek");
  assert.equal(rows[0].model, "deepseek-flash");
  assert.equal(rows[0].runId, "test-inference-run-1");
  assert.equal(rows[0].inputTokens, 11);
  assert.equal(rows[0].outputTokens, 7);
  assert.equal(rows[0].durationMs, 1200);
  assert.equal(rows[0].errorCode, null);
  assert.equal(rows[1].status, "denied");
  assert.equal(rows[1].errorCode, "unauthorized");
  assert.ok(rows[0].createdAt >= rows[1].createdAt);

  await deleteInferenceAuditForChat(chatId);
  assert.deepEqual(await listInferenceAuditForChat(chatId), []);
});

test("审计不随 chat 级联删除：chat 删除后记录仍在，可按 runId 检索", async () => {
  const chatId = await createChat("inference-audit-survives");
  await recordInferenceAudit({
    action: "stream",
    chatId,
    errorCode: "upstream_error",
    model: "deepseek-flash",
    provider: "deepseek",
    runId: "test-inference-run-2",
    status: "error",
  });
  await sql`DELETE FROM "Chat" WHERE id = ${chatId}`;
  // chatId 无外键：删除后行仍在（API 层按 runId 检索的底层保证）
  const surviving = await sql`SELECT * FROM "InferenceAccessAudit"
    WHERE "runId" = 'test-inference-run-2'`;
  assert.equal(surviving.length, 1);
  assert.equal(surviving[0].status, "error");
  assert.equal(surviving[0].errorCode, "upstream_error");
});
