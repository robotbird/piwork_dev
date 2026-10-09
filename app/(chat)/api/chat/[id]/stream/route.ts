import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { getActiveRunByChatId } from "@/lib/db/agent-run-queries";
import { getChatAccess } from "@/lib/db/chat-share-queries";
import { ChatbotError } from "@/lib/errors";
import { getRunManager } from "@/lib/runtime/run";
import { generateUUID } from "@/lib/utils";
import { pumpRunSubscription } from "../../stream-mapping";

const resumeQuerySchema = z.object({
  cursor: z.coerce.number().int().nonnegative().optional(),
  runId: z.uuid().optional(),
});

/**
 * 断线/刷新恢复端点（v2.0 Step 2）：`reconnectToStream` GET 到这里。
 * DB 仍有活跃 run 时 attach LiveRun → 按 §2.5 输出序重放（start →
 * waiting → 日志重放 + 活流 tail）；run 已终态或进程重启 → 惰性清僵尸
 * 后仍无 → 204（SDK 约定下客户端静默 no-op，DB 已含完整消息）。
 * chat 行尚不存在（新聊天首条消息提交时 submitForm 先 pushState，
 * resume GET 可能抢在 POST 落库前到达）同样 204 静默：此语境下 404
 * 会被 onError 弹成错误 toast，而"无可恢复"本就该静默。
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  // 协作成员与所有者同样可以断线重连/刷新恢复（attach 同一 run 的活流）
  const access = await getChatAccess(id, session.user.id);
  if (!access?.chat) {
    return new Response(null, { status: 204 });
  }
  if (!(access.isOwner || access.isCollaborator)) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const { searchParams } = new URL(request.url);
  const parsed = resumeQuerySchema.safeParse({
    cursor: searchParams.get("cursor") ?? undefined,
    runId: searchParams.get("runId") ?? undefined,
  });
  if (!parsed.success) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  // §2.5 边界表：run 已终态（DB status 已更新）→ 204——此时消息已先于状态
  // 落库，重放会把全量 delta 叠进 DB 已有消息的 parts 之后（客户端
  // lastMessage=assistant 时 activeTextParts 从空重建），造成内容重复。
  // 只有 DB 仍有活跃 run 才 attach；settle 在途（status 未翻转）由重放的
  // 终态尾自然收尾。
  if (!(await getActiveRunByChatId(id))) {
    return new Response(null, { status: 204 });
  }

  const manager = getRunManager();
  let subscription = manager.attach(id, parsed.data);
  if (!subscription) {
    // DB 活跃但无 LiveRun：先清僵尸（进程重启后的孤儿 run）再试一次
    await manager.failZombieRuns();
    subscription = manager.attach(id, parsed.data);
    if (!subscription) {
      return new Response(null, { status: 204 });
    }
  }
  const activeSubscription = subscription;

  const t = await getTranslations("api");
  const stream = createUIMessageStream({
    execute: async ({ writer: dataStream }) => {
      // 断开只 detach 本订阅，run 不受影响（§2.1-3）
      const detach = () => activeSubscription.close();
      request.signal.addEventListener("abort", detach, { once: true });
      try {
        // §2.5 重放输出序：start（确定性 id）→ waiting → 日志重放 + 活流 tail
        dataStream.write({
          messageId: activeSubscription.messageId,
          type: "start",
        });
        dataStream.write({
          data: {
            // 恢复等待 UI；message 为渲染文案，model 字段此路径无来源（占位）
            message: "Waiting...",
            modelId: "",
            modelName: "",
            phase: "waiting",
          },
          transient: true,
          type: "data-waiting-status",
        });
        await pumpRunSubscription(dataStream, activeSubscription);
      } finally {
        request.signal.removeEventListener("abort", detach);
      }
    },
    generateId: generateUUID,
    onError: () => t("modelUnavailable"),
  });

  return createUIMessageStreamResponse({ stream });
}
