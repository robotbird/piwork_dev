import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  type SQL,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { ArtifactKind } from "@/components/chat/artifact";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { ChatbotError } from "../errors";
import {
  type Chat,
  chat,
  type DBMessage,
  document,
  libraryItem,
  message,
  type SkillRecord,
  type Suggestion,
  skill,
  suggestion,
  type User,
  user,
  vote,
} from "./schema";
import { generateHashedPassword } from "./utils";

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

export type UpsertSkillRecord = Pick<
  SkillRecord,
  | "description"
  | "displayName"
  | "enabled"
  | "name"
  | "relativePath"
  | "source"
  | "uploadedBy"
  | "version"
> & {
  /** 来源 pi 包标识；仅 source 为 "pi-package" 时有值,未提供时保留原值 */
  sourcePackage?: string | null;
};

export async function getSkillRecords({
  enabledOnly = false,
}: {
  enabledOnly?: boolean;
} = {}): Promise<SkillRecord[]> {
  try {
    const query = db.select().from(skill);
    return enabledOnly
      ? await query.where(eq(skill.enabled, true)).orderBy(asc(skill.name))
      : await query.orderBy(asc(skill.name));
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function upsertSkillRecord(record: UpsertSkillRecord) {
  try {
    const [saved] = await db
      .insert(skill)
      .values(record)
      .onConflictDoUpdate({
        set: {
          description: record.description,
          displayName: record.displayName,
          enabled: record.enabled,
          relativePath: record.relativePath,
          source: record.source,
          ...(record.sourcePackage === undefined
            ? {}
            : { sourcePackage: record.sourcePackage }),
          updatedAt: new Date(),
          uploadedBy: record.uploadedBy,
          version: record.version,
        },
        target: skill.name,
      })
      .returning();
    return saved;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function setSkillRecordEnabled({
  enabled,
  name,
}: {
  enabled: boolean;
  name: string;
}) {
  try {
    const [updated] = await db
      .update(skill)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(skill.name, name))
      .returning();
    return updated ?? null;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function deleteSkillRecord(name: string) {
  try {
    const [deleted] = await db
      .delete(skill)
      .where(eq(skill.name, name))
      .returning();
    return deleted ?? null;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

/** 列出来自指定 pi 包的技能记录（卸载联动依据） */
export async function getSkillRecordsBySourcePackage(
  sourcePackage: string
): Promise<SkillRecord[]> {
  try {
    return await db
      .select()
      .from(skill)
      .where(eq(skill.sourcePackage, sourcePackage))
      .orderBy(asc(skill.name));
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getUser(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getUserById(id: string): Promise<User | null> {
  try {
    const [selectedUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, id))
      .limit(1);
    return selectedUser ?? null;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (error) {
    throw new ChatbotError("bad_request:database", {
      cause: error,
    });
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    const [created] = await db
      .insert(chat)
      .values({
        createdAt: new Date(),
        id,
        title,
        userId,
        visibility,
      })
      .returning();
    return created;
  } catch (error) {
    throw new ChatbotError("bad_request:database", {
      cause: error,
    });
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function deleteAllChatsByUserId({ userId }: { userId: string }) {
  try {
    // 只清理无项目归属的聊天；项目聊天随项目删除
    const userChats = await db
      .select({ id: chat.id })
      .from(chat)
      .where(and(eq(chat.userId, userId), isNull(chat.projectId)));

    if (userChats.length === 0) {
      return { deletedCount: 0 };
    }

    const chatIds = userChats.map((c) => c.id);

    await db.delete(vote).where(inArray(vote.chatId, chatIds));
    await db.delete(message).where(inArray(message.chatId, chatIds));

    const deletedChats = await db
      .delete(chat)
      .where(and(eq(chat.userId, userId), isNull(chat.projectId)))
      .returning();

    return { deletedCount: deletedChats.length };
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<unknown>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id), isNull(chat.projectId))
            : and(eq(chat.userId, id), isNull(chat.projectId))
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Chat[] = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatbotError(
          "not_found:database",
          `Chat with id ${startingAfter} not found`
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatbotError(
          "not_found:database",
          `Chat with id ${endingBefore} not found`
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (error) {
    throw new ChatbotError("bad_request:database", {
      cause: error,
    });
  }
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    const result = await db.insert(message).values(messages);
    await touchChatsUpdatedAt(messages.map((current) => current.chatId));
    return result;
  } catch (error) {
    throw new ChatbotError("bad_request:database", {
      cause: error,
    });
  }
}

/** 消息写入后刷新所属聊天的 updatedAt（项目聊天列表按它排序） */
async function touchChatsUpdatedAt(chatIds: string[]) {
  const uniqueIds = [...new Set(chatIds)];
  if (uniqueIds.length === 0) {
    return;
  }
  await db
    .update(chat)
    .set({ updatedAt: new Date() })
    .where(inArray(chat.id, uniqueIds));
}

export async function updateMessage({
  id,
  parts,
}: {
  id: string;
  parts: DBMessage["parts"];
}) {
  try {
    return await db.update(message).set({ parts }).where(eq(message.id, id));
  } catch (error) {
    throw new ChatbotError("bad_request:database", {
      cause: error,
    });
  }
}

/**
 * run 终态的 assistant 消息幂等落库（Step 2）：id 为确定性派生
 * （sha256(runId) 或审批续跑的既有消息 id），冲突时仅更新 parts——
 * 重复事件/重试不产生第二条消息。createdAt 仅首次插入生效。
 */
export async function upsertMessage({
  chatId,
  id,
  parts,
}: {
  chatId: string;
  id: string;
  parts: DBMessage["parts"];
}) {
  try {
    const result = await db
      .insert(message)
      .values({
        attachments: [],
        chatId,
        createdAt: new Date(),
        id,
        parts,
        role: "assistant",
      })
      .onConflictDoUpdate({
        set: { parts },
        target: message.id,
      });
    await touchChatsUpdatedAt([chatId]);
    return result;
  } catch (error) {
    throw new ChatbotError("bad_request:database", {
      cause: error,
    });
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === "up" })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      isUpvoted: type === "up",
      messageId,
    });
  } catch (error) {
    throw new ChatbotError("bad_request:database", {
      cause: error,
    });
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await db.transaction(async (tx) => {
      const result = await tx
        .insert(document)
        .values({ content, createdAt: new Date(), id, kind, title, userId })
        .returning();
      const extension =
        kind === "sheet"
          ? ".csv"
          : kind === "code"
            ? ".txt"
            : kind === "image"
              ? ".png"
              : ".md";
      await tx
        .insert(libraryItem)
        .values({
          contentType:
            kind === "sheet"
              ? "text/csv"
              : kind === "image"
                ? "image/png"
                : "text/plain",
          documentId: id,
          id,
          kind: "file",
          name: title + extension,
          size: Buffer.byteLength(content),
          source: "ai",
          userId,
        })
        .onConflictDoUpdate({
          set: { size: Buffer.byteLength(content), updatedAt: new Date() },
          target: libraryItem.id,
        });
      return result;
    });
  } catch (error) {
    throw new ChatbotError("bad_request:database", {
      cause: error,
    });
  }
}

export async function updateDocumentContent({
  id,
  content,
}: {
  id: string;
  content: string;
}) {
  try {
    const docs = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt))
      .limit(1);

    const [latest] = docs;
    if (!latest) {
      throw new ChatbotError("not_found:database", "Document not found");
    }

    return await db.transaction(async (tx) => {
      const result = await tx
        .update(document)
        .set({ content })
        .where(
          and(eq(document.id, id), eq(document.createdAt, latest.createdAt))
        )
        .returning();
      await tx
        .update(libraryItem)
        .set({ size: Buffer.byteLength(content), updatedAt: new Date() })
        .where(
          and(
            eq(libraryItem.documentId, id),
            eq(libraryItem.userId, latest.userId)
          )
        );
      return result;
    });
  } catch (error) {
    if (error instanceof ChatbotError) {
      throw error;
    }
    throw new ChatbotError("bad_request:database", {
      cause: error,
    });
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp)
        )
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(eq(suggestion.documentId, documentId));
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))
      );

    const messageIds = messagesToDelete.map(
      (currentMessage) => currentMessage.id
    );

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds))
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds))
        );
    }
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function updateChatVisibilityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function updateChatTitleById({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}) {
  try {
    return await db.update(chat).set({ title }).where(eq(chat.id, chatId));
  } catch {
    // Best effort title update.
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const cutoffTime = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, cutoffTime),
          eq(message.role, "user")
        )
      )
      .execute();

    return stats?.count ?? 0;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}
