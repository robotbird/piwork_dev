import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { getDb } from "./client";
import type { Chat } from "./schema";
import {
  type ChatShareInviteRecord,
  chat,
  chatCollaborator,
  chatShareInvite,
  member,
  message,
  user,
} from "./schema";

const db = getDb();

/** 分享链接有效期（天）。过期后加入/携带该链接 fork 均拒绝。 */
export const SHARE_INVITE_TTL_DAYS = 7;

/** 分享成员目录的最小投影：不含 email 等联系方式。 */
export type ShareableMember = {
  image: string | null;
  name: string | null;
  title: string | null;
  userId: string;
};

export type ChatParticipant = ShareableMember & {
  /** owner = 对话所有者；collaborator = 协作成员 */
  role: "owner" | "collaborator";
  /** 协作成员的加入时间；所有者为对话创建时间 */
  joinedAt: Date;
};

export type ChatAccess = {
  chat: Chat;
  isCollaborator: boolean;
  isOwner: boolean;
};

export type ShareInviteSummary = {
  createdAt: Date;
  expiresAt: Date;
};

export type CreateShareInviteResult = ShareInviteSummary & {
  /** 明文 token 仅在创建时返回一次，服务端只保留 sha256 */
  token: string;
};

export type ForkChatResult = {
  chatId: string;
  copiedMessages: number;
};

/* ------------------------------ token 工具 ------------------------------ */

/** 24 字节 CSPRNG base64url；服务端只存 sha256。 */
export function generateShareToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** constant-time 比较两个 sha256 hex；长度不符或为空直接 false。 */
export function sameShareTokenHash(a: string, b: string): boolean {
  if (a.length === 0 || a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

/* ------------------------------ 访问判定 ------------------------------ */

/**
 * 单条查询判定请求者与对话的关系。isOwner = Chat.userId；
 * isCollaborator = ChatCollaborator 存在对应行。二者满足其一即为「对话成员」。
 */
export async function getChatAccess(
  chatId: string,
  userId: string
): Promise<ChatAccess | null> {
  const [row] = await db
    .select({
      chat,
      collaboratorUserId: chatCollaborator.userId,
    })
    .from(chat)
    .leftJoin(
      chatCollaborator,
      and(
        eq(chatCollaborator.chatId, chat.id),
        eq(chatCollaborator.userId, userId)
      )
    )
    .where(eq(chat.id, chatId))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    chat: row.chat,
    isCollaborator: row.collaboratorUserId === userId,
    isOwner: row.chat.userId === userId,
  };
}

/* ------------------------------ 协作成员 ------------------------------ */

/**
 * 跨用户展示头像投影：User.image 是本人 LibraryItem 预览地址（按归属鉴权，
 * 其他成员直接加载会 404），改下发 `/api/users/:id/avatar` 投影端点
 * （登录 + 启用成员可读，服务端双归属校验）；未设置/非平台格式 → null
 * （前端回退首字母）。
 */
export function projectUserAvatar(
  image: string | null,
  userId: string
): string | null {
  if (
    !image ||
    !/^\/api\/library\/[0-9a-f-]{36}(?:\?preview=1)?$/.test(image)
  ) {
    return null;
  }
  return `/api/users/${userId}/avatar`;
}

/** 分享弹窗可选成员目录：组织内启用成员，排除本人。 */
export function listShareableMembers(
  excludeUserId: string
): Promise<ShareableMember[]> {
  return db
    .select({
      image: user.image,
      name: user.name,
      title: member.title,
      userId: user.id,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(
      and(
        eq(member.status, "enabled"),
        sql`${member.userId} <> ${excludeUserId}`
      )
    )
    .orderBy(asc(user.name))
    .then((rows) =>
      rows.map((row) => ({
        ...row,
        image: projectUserAvatar(row.image, row.userId),
      }))
    );
}

export async function listChatCollaborators(
  chatId: string
): Promise<ChatParticipant[]> {
  const rows = await db
    .select({
      image: user.image,
      invitedBy: chatCollaborator.invitedBy,
      joinedAt: chatCollaborator.createdAt,
      name: user.name,
      title: member.title,
      userId: user.id,
    })
    .from(chatCollaborator)
    .innerJoin(user, eq(user.id, chatCollaborator.userId))
    .leftJoin(member, eq(member.userId, user.id))
    .where(eq(chatCollaborator.chatId, chatId))
    .orderBy(asc(chatCollaborator.createdAt));

  return rows.map((row) => ({
    image: projectUserAvatar(row.image, row.userId),
    joinedAt: row.joinedAt,
    name: row.name,
    role: "collaborator" as const,
    title: row.title,
    userId: row.userId,
  }));
}

/** 对话全部参与者（所有者在首位）。已移除/退出的账号（用户行删除级联）自然消失。 */
export async function listChatParticipants(
  chatId: string
): Promise<ChatParticipant[]> {
  const [owner] = await db
    .select({
      createdAt: chat.createdAt,
      image: user.image,
      name: user.name,
      title: member.title,
      userId: user.id,
    })
    .from(chat)
    .innerJoin(user, eq(user.id, chat.userId))
    .leftJoin(member, eq(member.userId, user.id))
    .where(eq(chat.id, chatId))
    .limit(1);

  if (!owner) {
    return [];
  }

  const collaborators = await listChatCollaborators(chatId);

  return [
    {
      image: projectUserAvatar(owner.image, owner.userId),
      joinedAt: owner.createdAt,
      name: owner.name,
      role: "owner" as const,
      title: owner.title,
      userId: owner.userId,
    },
    ...collaborators,
  ];
}

/**
 * 添加协作成员（幂等）。memberIds 必须先经 `filterExistingMemberIds` 或等价
 * 校验确认为启用成员，这里只按 (chatId, userId) 去重插入。
 */
export async function addChatCollaborators(
  chatId: string,
  invitedBy: string,
  userIds: string[]
): Promise<number> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) {
    return 0;
  }

  const inserted = await db
    .insert(chatCollaborator)
    .values(
      unique.map((userId) => ({
        chatId,
        invitedBy,
        userId,
      }))
    )
    .onConflictDoNothing()
    .returning({ id: chatCollaborator.id });

  return inserted.length;
}

export async function removeChatCollaborator(
  chatId: string,
  userId: string
): Promise<boolean> {
  const removed = await db
    .delete(chatCollaborator)
    .where(
      and(
        eq(chatCollaborator.chatId, chatId),
        eq(chatCollaborator.userId, userId)
      )
    )
    .returning({ id: chatCollaborator.id });
  return removed.length > 0;
}

/** 校验 userIds 都是启用成员，返回实际存在的部分；分享前用来自动过滤无效输入。 */
export async function filterEnabledMemberIds(
  userIds: string[]
): Promise<string[]> {
  if (userIds.length === 0) {
    return [];
  }
  const rows = await db
    .select({ userId: member.userId })
    .from(member)
    .where(and(eq(member.status, "enabled"), inArray(member.userId, userIds)));
  return rows.map((row) => row.userId);
}

/* ------------------------------ 分享链接 ------------------------------ */

/** 当前对话的活跃链接（未撤销且未过期）。token 不可回显，仅返回摘要。 */
export async function getActiveShareInvite(
  chatId: string
): Promise<ShareInviteSummary | null> {
  const invite = await findActiveShareInvite(chatId);
  if (!invite) {
    return null;
  }
  return { createdAt: invite.createdAt, expiresAt: invite.expiresAt };
}
async function findActiveShareInvite(
  chatId: string
): Promise<ChatShareInviteRecord | null> {
  const [invite] = await db
    .select()
    .from(chatShareInvite)
    .where(
      and(
        eq(chatShareInvite.chatId, chatId),
        isNull(chatShareInvite.revokedAt),
        gt(chatShareInvite.expiresAt, new Date())
      )
    )
    .orderBy(desc(chatShareInvite.createdAt))
    .limit(1);
  return invite ?? null;
}

/**
 * 生成新链接。`replaceActive`（重新生成）先撤销旧链接，使旧链接立即失效；
 * 无活跃链接时直接创建。返回中的 token 明文只在本次响应出现。
 */
export async function createShareInvite(
  chatId: string,
  createdBy: string,
  { replaceActive = false }: { replaceActive?: boolean } = {}
): Promise<CreateShareInviteResult> {
  if (replaceActive) {
    await revokeShareInvite(chatId);
  } else {
    const existing = await findActiveShareInvite(chatId);
    if (existing) {
      throw new Error("share-invite:active-exists");
    }
  }

  const token = generateShareToken();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + SHARE_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  await db.insert(chatShareInvite).values({
    chatId,
    createdAt: now,
    createdBy,
    expiresAt,
    tokenHash: hashShareToken(token),
  });

  return { createdAt: now, expiresAt, token };
}

/** 撤销对话的全部活跃链接（幂等）。 */
export async function revokeShareInvite(chatId: string): Promise<number> {
  const revoked = await db
    .update(chatShareInvite)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(chatShareInvite.chatId, chatId), isNull(chatShareInvite.revokedAt))
    )
    .returning({ id: chatShareInvite.id });
  return revoked.length;
}

export type ShareInviteCheck = {
  chatId: string;
  invite: ChatShareInviteRecord;
};

/** 加入页概要：不泄露消息正文与完整名单，只给标题/所有者/计数。 */
export type ChatShareSummary = {
  collaboratorCount: number;
  createdAt: Date;
  messageCount: number;
  ownerImage: string | null;
  ownerName: string | null;
  title: string;
};

export async function getChatShareSummary(
  chatId: string
): Promise<ChatShareSummary | null> {
  const [row] = await db
    .select({
      createdAt: chat.createdAt,
      ownerImage: user.image,
      ownerName: user.name,
      ownerUserId: user.id,
      title: chat.title,
    })
    .from(chat)
    .innerJoin(user, eq(user.id, chat.userId))
    .where(eq(chat.id, chatId))
    .limit(1);

  if (!row) {
    return null;
  }

  const [messageCount] = await db
    .select({ value: count() })
    .from(message)
    .where(eq(message.chatId, chatId));
  const [collaboratorCount] = await db
    .select({ value: count() })
    .from(chatCollaborator)
    .where(eq(chatCollaborator.chatId, chatId));

  return {
    collaboratorCount: collaboratorCount?.value ?? 0,
    createdAt: row.createdAt,
    messageCount: messageCount?.value ?? 0,
    ownerImage: projectUserAvatar(row.ownerImage, row.ownerUserId),
    ownerName: row.ownerName,
    title: row.title,
  };
}

/**
 * 校验链接 token：constant-time 哈希比较 + 未撤销 + 未过期。
 * 失败统一返回 null，不区分原因（不泄露链接状态细节）。
 */
export async function checkShareInvite(
  chatId: string,
  token: string
): Promise<ShareInviteCheck | null> {
  if (!token || token.length > 128) {
    return null;
  }

  const [invite] = await db
    .select()
    .from(chatShareInvite)
    .where(
      and(
        eq(chatShareInvite.chatId, chatId),
        eq(chatShareInvite.tokenHash, hashShareToken(token))
      )
    )
    .limit(1);

  if (!invite || invite.revokedAt || invite.expiresAt <= new Date()) {
    return null;
  }

  return { chatId: invite.chatId, invite };
}

/* -------------------------------- Fork -------------------------------- */

/**
 * Fork 对话：复制 Chat 与全部消息为新对话。新消息 id 重新生成（Message_v2.id
 * 是主键，不允许跨对话重复），createdAt/userId/parts 原样保留；新对话归属
 * 发起者，visibility=private，不复制协作成员与分享链接。
 */
export function forkChat({
  sourceChatId,
  userId,
}: {
  sourceChatId: string;
  userId: string;
}): Promise<ForkChatResult | null> {
  return db.transaction(async (tx) => {
    const [source] = await tx
      .select()
      .from(chat)
      .where(eq(chat.id, sourceChatId))
      .limit(1);

    if (!source) {
      return null;
    }

    const sourceMessages = await tx
      .select()
      .from(message)
      .where(eq(message.chatId, sourceChatId))
      .orderBy(asc(message.createdAt));

    const [created] = await tx
      .insert(chat)
      .values({
        createdAt: new Date(),
        forkedFromChatId: source.id,
        title: `${source.title}（分支）`,
        updatedAt: new Date(),
        userId,
        visibility: "private",
      })
      .returning({ id: chat.id });

    if (sourceMessages.length > 0) {
      await tx.insert(message).values(
        sourceMessages.map((item) => ({
          attachments: item.attachments,
          chatId: created.id,
          createdAt: item.createdAt,
          id: crypto.randomUUID(),
          parts: item.parts,
          role: item.role,
          userId: item.userId,
        }))
      );
    }

    return { chatId: created.id, copiedMessages: sourceMessages.length };
  });
}

/* ------------------------------ 侧边栏历史 ------------------------------ */

export type SharedChatListItem = Chat & {
  /** true = 我是协作成员（非所有者） */
  sharedWithMe: boolean;
  ownerName: string | null;
};

/**
 * 「最近」列表：本人对话 ∪ 本人参与的协作对话（项目聊天除外）。协作条目附
 * sharedWithMe/ownerName。分页游标沿用 createdAt 语义（与既有实现一致，
 * 同刻并列条目可能翻页抖动，非本次引入）。
 */
export async function listChatHistoryIncludingShared({
  id,
  limit,
  startingAfter = null,
  endingBefore = null,
}: {
  id: string;
  limit: number;
  startingAfter?: string | null;
  endingBefore?: string | null;
}): Promise<{
  chats: SharedChatListItem[];
  hasMore: boolean;
}> {
  const extendedLimit = limit + 1;

  const memberOfCollabChat = exists(
    db
      .select({ one: sql`1` })
      .from(chatCollaborator)
      .where(
        and(
          eq(chatCollaborator.chatId, chat.id),
          eq(chatCollaborator.userId, id)
        )
      )
  );

  const baseCondition = and(
    or(eq(chat.userId, id), memberOfCollabChat),
    isNull(chat.projectId)
  );

  const baseQuery = () =>
    db
      .select({
        chat,
        ownerName: user.name,
      })
      .from(chat)
      .innerJoin(user, eq(user.id, chat.userId))
      .where(baseCondition)
      .orderBy(desc(chat.createdAt))
      .limit(extendedLimit);

  let rows: { chat: Chat; ownerName: string | null }[] = [];

  if (startingAfter || endingBefore) {
    const cursorId = startingAfter ?? endingBefore;
    const [cursorChat] = await db
      .select({ createdAt: chat.createdAt })
      .from(chat)
      .where(eq(chat.id, cursorId ?? ""))
      .limit(1);

    if (cursorChat) {
      const cursorCondition = startingAfter
        ? gt(chat.createdAt, cursorChat.createdAt)
        : lt(chat.createdAt, cursorChat.createdAt);
      rows = await db
        .select({
          chat,
          ownerName: user.name,
        })
        .from(chat)
        .innerJoin(user, eq(user.id, chat.userId))
        .where(and(baseCondition, cursorCondition))
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);
    } else {
      rows = [];
    }
  } else {
    rows = await baseQuery();
  }

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    chats: page.map((row) => ({
      ...row.chat,
      ownerName: row.ownerName,
      sharedWithMe: row.chat.userId !== id,
    })),
    hasMore,
  };
}
