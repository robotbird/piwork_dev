import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  addChatCollaborators,
  checkShareInvite,
  getChatAccess,
} from "@/lib/db/chat-share-queries";
import { getMemberByUserId } from "@/lib/db/organization-queries";
import { ChatbotError } from "@/lib/errors";

const joinSchema = z.object({
  chatId: z.string().uuid(),
  token: z.string().min(1).max(128),
});

/**
 * 凭分享链接加入协作。要求：已登录 + 本人存在启用成员记录 + 链接有效
 * （constant-time 哈希比较、未撤销、未过期）。已是成员幂等返回 alreadyMember。
 */
export async function POST(request: Request) {
  const t = await getTranslations("api");

  let input: z.infer<typeof joinSchema>;

  try {
    input = joinSchema.parse(await request.json());
  } catch {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  // 链接只对正式启用成员生效；非成员账号（历史访客已被登录层拒绝，此处兜底）
  // 不因持有链接获得协作身份。
  const member = await getMemberByUserId(session.user.id);
  if (member?.status !== "enabled") {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const invite = await checkShareInvite(input.chatId, input.token);
  if (!invite) {
    return new ChatbotError(
      "forbidden:chat",
      t("shareLinkInvalid")
    ).toResponse();
  }

  const access = await getChatAccess(input.chatId, session.user.id);
  if (access?.isOwner || access?.isCollaborator) {
    return Response.json({ alreadyMember: true, chatId: input.chatId });
  }

  await addChatCollaborators(input.chatId, session.user.id, [session.user.id]);

  return Response.json({ alreadyMember: false, chatId: input.chatId });
}
