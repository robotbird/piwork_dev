import { auth } from "@/app/(auth)/auth";
import { getChatById } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { getRunManager } from "@/lib/runtime/run";

/**
 * 显式中止端点（v2.0 Step 2）：`useChat.stop()` 只 abort 前端 fetch，不再
 * 杀 run（request 断开 = detach），Stop 按钮改为 fire-and-forget 调这里。
 * 无活跃 run 返回 { aborted: false }（幂等）。
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });
  if (!chat) {
    return new ChatbotError("not_found:chat").toResponse();
  }
  if (chat.userId !== session.user.id) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const aborted = await getRunManager().abortByChat(id);
  return Response.json({ aborted });
}
