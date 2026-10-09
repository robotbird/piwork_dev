import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  checkShareInvite,
  forkChat,
  getChatAccess,
} from "@/lib/db/chat-share-queries";
import { getMemberByUserId } from "@/lib/db/organization-queries";
import { ChatbotError } from "@/lib/errors";

const forkSchema = z.object({
  chatId: z.string().uuid(),
  /** 对话成员 fork 不需要；链接接收者必须携带链接上的 token */
  token: z.string().max(128).optional(),
});

/**
 * Fork 对话为本人所有的新对话（复制全部消息，源对话不动）。
 * 访问路径：对话成员直接 fork；非成员必须提供当前有效的分享链接 token。
 */
export async function POST(request: Request) {
  let input: z.infer<typeof forkSchema>;

  try {
    input = forkSchema.parse(await request.json());
  } catch {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  // 与加入协作一致：fork 也只面向正式启用成员。
  const member = await getMemberByUserId(session.user.id);
  if (member?.status !== "enabled") {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const access = await getChatAccess(input.chatId, session.user.id);
  const isMember = Boolean(access?.isOwner || access?.isCollaborator);

  if (!isMember) {
    const t = await getTranslations("api");
    if (!input.token) {
      return new ChatbotError("forbidden:chat").toResponse();
    }
    const invite = await checkShareInvite(input.chatId, input.token);
    if (!invite) {
      return new ChatbotError(
        "forbidden:chat",
        t("shareLinkInvalid")
      ).toResponse();
    }
  }

  const forked = await forkChat({
    sourceChatId: input.chatId,
    userId: session.user.id,
  });

  if (!forked) {
    return new ChatbotError("not_found:chat").toResponse();
  }

  return Response.json(forked);
}
