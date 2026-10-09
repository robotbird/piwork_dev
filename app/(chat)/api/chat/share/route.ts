import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  addChatCollaborators,
  createShareInvite,
  filterEnabledMemberIds,
  getActiveShareInvite,
  getChatAccess,
  listChatCollaborators,
  listChatParticipants,
  listShareableMembers,
  removeChatCollaborator,
  revokeShareInvite,
} from "@/lib/db/chat-share-queries";
import { ChatbotError } from "@/lib/errors";

const createShareSchema = z.object({
  chatId: z.string().uuid(),
  memberIds: z.array(z.string().uuid()).max(50).optional(),
  regenerate: z.boolean().optional(),
});

const deleteShareSchema = z.object({
  chatId: z.string().uuid(),
  invite: z.boolean().optional(),
  userId: z.string().uuid().optional(),
});

async function requireOwnedChat(chatId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new ChatbotError("unauthorized:chat");
  }

  const access = await getChatAccess(chatId, session.user.id);
  if (!access) {
    throw new ChatbotError("not_found:chat");
  }
  // 管理（添加/移除成员、生成/撤销链接）仅对话所有者。
  if (!access.isOwner) {
    throw new ChatbotError("forbidden:chat");
  }

  return { session, ...access };
}

/**
 * 分享面板数据：参与者、协作成员、活跃链接摘要；所有者另附可分享成员目录。
 * token 明文不在 GET 中返回（服务端只存哈希）。
 */
export async function GET(request: Request) {
  const t = await getTranslations("api");
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");
  const parsedChatId = z.string().uuid().safeParse(chatId);
  if (!parsedChatId.success) {
    return new ChatbotError(
      "bad_request:api",
      t("chatIdRequired")
    ).toResponse();
  }

  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const access = await getChatAccess(parsedChatId.data, session.user.id);
  if (!access) {
    return new ChatbotError("not_found:chat").toResponse();
  }

  const [participants, collaborators, invite] = await Promise.all([
    listChatParticipants(parsedChatId.data),
    listChatCollaborators(parsedChatId.data),
    access.isOwner
      ? getActiveShareInvite(parsedChatId.data)
      : Promise.resolve(null),
  ]);

  const members = access.isOwner
    ? await listShareableMembers(session.user.id)
    : [];

  return Response.json({
    chatTitle: access.chat.title,
    collaborators,
    invite,
    isOwner: access.isOwner,
    members,
    myRole: access.isOwner
      ? "owner"
      : access.isCollaborator
        ? "collaborator"
        : null,
    participants,
  });
}

/**
 * 添加协作成员（幂等），可选同时生成新链接。token 明文仅出现在本次响应。
 */
export async function POST(request: Request) {
  let input: z.infer<typeof createShareSchema>;

  try {
    input = createShareSchema.parse(await request.json());
  } catch {
    return new ChatbotError("bad_request:api").toResponse();
  }

  try {
    const { chat, session } = await requireOwnedChat(input.chatId);

    let added = 0;
    if (input.memberIds?.length) {
      const enabledIds = await filterEnabledMemberIds(input.memberIds);
      added = await addChatCollaborators(chat.id, session.user.id, enabledIds);
    }

    // regenerate=true 轮换链接；否则仅在没有活跃链接时生成。
    let inviteToken: string | null = null;
    let inviteExpiresAt: Date | null = null;
    if (input.regenerate || !(await getActiveShareInvite(chat.id))) {
      const created = await createShareInvite(chat.id, session.user.id, {
        replaceActive: input.regenerate === true,
      });
      inviteToken = created.token;
      inviteExpiresAt = created.expiresAt;
    }

    const collaborators = await listChatCollaborators(chat.id);

    return Response.json({
      added,
      collaborators,
      inviteExpiresAt,
      token: inviteToken,
    });
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    return new ChatbotError("bad_request:database", {
      cause: error instanceof Error ? error : undefined,
    }).toResponse();
  }
}

/** 移除协作成员（userId）或撤销活跃链接（invite=true）。 */
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = deleteShareSchema.safeParse({
    chatId: searchParams.get("chatId") ?? undefined,
    invite: searchParams.get("invite") === "1" || undefined,
    userId: searchParams.get("userId") ?? undefined,
  });
  if (!parsed.success) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  try {
    const { chat } = await requireOwnedChat(parsed.data.chatId);

    if (parsed.data.invite) {
      const revoked = await revokeShareInvite(chat.id);
      return Response.json({ revoked });
    }

    if (parsed.data.userId) {
      // 所有者不能被移除（其权限来自 Chat.userId，不在协作表中）
      if (parsed.data.userId === chat.userId) {
        return new ChatbotError("bad_request:api").toResponse();
      }
      const removed = await removeChatCollaborator(chat.id, parsed.data.userId);
      return Response.json({ removed });
    }

    return new ChatbotError("bad_request:api").toResponse();
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    return new ChatbotError("bad_request:database", {
      cause: error instanceof Error ? error : undefined,
    }).toResponse();
  }
}
