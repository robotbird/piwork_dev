import { getTranslations } from "next-intl/server";
import { auth } from "@/app/(auth)/auth";
import {
  getChatAccess,
  listChatParticipants,
} from "@/lib/db/chat-share-queries";
import { getMessagesByChatId } from "@/lib/db/queries";
import { convertToUIMessages } from "@/lib/utils";

export async function GET(request: Request) {
  const t = await getTranslations("api");
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");

  if (!chatId) {
    return Response.json({ error: t("chatIdRequired") }, { status: 400 });
  }

  const session = await auth();
  const [access, messages] = await Promise.all([
    getChatAccess(chatId, session?.user?.id ?? ""),
    getMessagesByChatId({ id: chatId }),
  ]);

  if (!access?.chat) {
    return Response.json({
      isReadonly: false,
      messages: [],
      myRole: null,
      participants: [],
      userId: null,
      visibility: "private",
    });
  }

  const { chat } = access;
  const isMember = access.isOwner || access.isCollaborator;

  // public 可见性保留既有语义：任意登录者只读可见；但不向非成员下发参与者名单
  if (chat.visibility === "private" && (!session?.user || !isMember)) {
    return Response.json({ error: t("forbidden") }, { status: 403 });
  }

  const isReadonly = !session?.user || !isMember;

  return Response.json({
    isReadonly,
    messages: convertToUIMessages(messages),
    // 参与者名单仅对话成员可见（头像/名字，不含 email 等联系方式）
    ...(isReadonly
      ? {}
      : {
          myRole: access.isOwner ? "owner" : "collaborator",
          participants: await listChatParticipants(chatId),
        }),
    userId: chat.userId,
    visibility: chat.visibility,
  });
}
