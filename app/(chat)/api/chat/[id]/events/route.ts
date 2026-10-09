import { randomUUID } from "node:crypto";
import { auth } from "@/app/(auth)/auth";
import {
  attachChatCollabClient,
  type ChatCollabEvent,
} from "@/lib/collab/chat-event-hub";
import { getChatAccess } from "@/lib/db/chat-share-queries";
import { ChatbotError } from "@/lib/errors";

/** SSE 心跳间隔：兼做权限复查（被移除的成员在下一次 ping 收到 missing 并断开）。 */
const PING_INTERVAL_MS = 15_000;

/**
 * 聊天协作事件流（docs/chat-collaboration.md §8.3）：成员专用 SSE，
 * 只承载 presence/typing/message/run 通知，不推送消息正文——客户端收到
 * 事件后重拉 /api/messages 或 resumeStream attach 活跃 run。
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const access = await getChatAccess(id, session.user.id);
  if (!access) {
    return new ChatbotError("not_found:chat").toResponse();
  }
  if (!(access.isOwner || access.isCollaborator)) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const userId = session.user.id;
  const encoder = new TextEncoder();
  let attachment: ReturnType<typeof attachChatCollabClient> | undefined;
  let ping: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    cancel: () => {
      closed = true;
      if (ping) {
        clearInterval(ping);
      }
      attachment?.detach();
    },
    start: (controller) => {
      const write = (chunk: string) => {
        if (closed) {
          return;
        }
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // 控制器已关闭（客户端断开竞态）：后续 detach 清理会收尾
        }
      };

      const send = (event: ChatCollabEvent) => {
        write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      };

      write("retry: 3000\n\n");
      attachment = attachChatCollabClient({
        chatId: id,
        connectionId: randomUUID(),
        send,
        userId,
      });

      // 心跳兼权限复查：被移除的成员在此收到 missing 并断开，
      // 不再向已无权限的连接继续发送 presence/typing 信号。
      ping = setInterval(() => {
        write(": ping\n\n");
        (async () => {
          const current = await getChatAccess(id, userId);
          if (current && (current.isOwner || current.isCollaborator)) {
            return;
          }
          send({ type: "missing" });
          close();
        })().catch(() => undefined);
      }, PING_INTERVAL_MS);
      ping.unref();

      const close = () => {
        if (closed) {
          return;
        }
        closed = true;
        if (ping) {
          clearInterval(ping);
        }
        attachment?.detach();
        try {
          controller.close();
        } catch {
          // 已关闭
        }
      };

      // 客户端断开（含 EventSource retry 前的旧连接）→ detach 本订阅
      _request.signal.addEventListener("abort", close, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
      "x-accel-buffering": "no",
    },
  });
}
