import "server-only";

import { desc, eq } from "drizzle-orm";
import type { InferenceAuditEntry } from "../runtime/inference-proxy";
import { getDb } from "./client";
import { inferenceAccessAudit } from "./schema";

const db = getDb();

/**
 * InferenceAccessAudit 读写（opensandbox-integration-spec.md §6 Phase 4）。
 * 追加型脱敏审计：写入永远 best-effort 不抛（审计失败不阻断代理请求），
 * 读取供管理与排查用；测试清理走 deleteInferenceAuditForChat。
 */

/** 审计落库（脱敏条目；失败静默——见文件头） */
export async function recordInferenceAudit(
  entry: InferenceAuditEntry
): Promise<void> {
  try {
    await db.insert(inferenceAccessAudit).values({
      action: entry.action,
      chatId: entry.chatId,
      durationMs: entry.durationMs,
      errorCode: entry.errorCode,
      inputTokens: entry.inputTokens,
      model: entry.model,
      outputTokens: entry.outputTokens,
      provider: entry.provider,
      runId: entry.runId,
      status: entry.status,
    });
  } catch {
    // best-effort：审计 sink 故障不得影响请求链路（proxy 侧同约定）
  }
}

/** 按 chat 读取审计（最近优先）；管理/排查用 */
export async function listInferenceAuditForChat(
  chatId: string,
  limit = 50
): Promise<
  Array<{
    action: string;
    createdAt: Date;
    durationMs: number | null;
    errorCode: string | null;
    id: string;
    inputTokens: number | null;
    model: string | null;
    outputTokens: number | null;
    provider: string | null;
    runId: string | null;
    status: string;
  }>
> {
  return await db
    .select({
      action: inferenceAccessAudit.action,
      createdAt: inferenceAccessAudit.createdAt,
      durationMs: inferenceAccessAudit.durationMs,
      errorCode: inferenceAccessAudit.errorCode,
      id: inferenceAccessAudit.id,
      inputTokens: inferenceAccessAudit.inputTokens,
      model: inferenceAccessAudit.model,
      outputTokens: inferenceAccessAudit.outputTokens,
      provider: inferenceAccessAudit.provider,
      runId: inferenceAccessAudit.runId,
      status: inferenceAccessAudit.status,
    })
    .from(inferenceAccessAudit)
    .where(eq(inferenceAccessAudit.chatId, chatId))
    .orderBy(desc(inferenceAccessAudit.createdAt))
    .limit(limit);
}

/** 测试清理：删除该 chat 的审计记录 */
export async function deleteInferenceAuditForChat(
  chatId: string
): Promise<void> {
  await db
    .delete(inferenceAccessAudit)
    .where(eq(inferenceAccessAudit.chatId, chatId));
}
