import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { setChatTyping } from "@/lib/collab/chat-event-hub";
import { getChatAccess } from "@/lib/db/chat-share-queries";
import { ChatbotError } from "@/lib/errors";

const typingSchema = z.object({ typing: z.boolean() });

/**
 * 输入指示上报（docs/chat-collaboration.md §8.3）：成员专用；服务端只
 * 维护 6s TTL 态并向房间广播，节流（≥2s）由客户端负责。
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let input: z.infer<typeof typingSchema>;

  try {
    input = typingSchema.parse(await request.json());
  } catch {
    const t = await getTranslations("api");
    return new ChatbotError("bad_request:api", t("badRequest")).toResponse();
  }

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

  setChatTyping({ chatId: id, typing: input.typing, userId: session.user.id });

  return new Response(null, { status: 204 });
}
