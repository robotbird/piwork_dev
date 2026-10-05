import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "./client";
import { chat, message, project, source, vote } from "./schema";

const db = getDb();

export type CreateSourceInput = {
  content: string;
  name: string;
  type: "pdf" | "txt" | "markdown";
};

export async function createProject(userId: string, name: string) {
  const [created] = await db
    .insert(project)
    .values({ name, userId })
    .returning();
  return created;
}

export function listProjects(userId: string) {
  return db
    .select()
    .from(project)
    .where(eq(project.userId, userId))
    .orderBy(desc(project.updatedAt));
}

export async function getProject(userId: string, projectId: string) {
  const [record] = await db
    .select()
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.userId, userId)));
  return record ?? null;
}

export async function renameProject(
  userId: string,
  projectId: string,
  name: string
) {
  const [updated] = await db
    .update(project)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(project.id, projectId), eq(project.userId, userId)))
    .returning();
  return updated ?? null;
}

export async function touchProject(projectId: string) {
  await db
    .update(project)
    .set({ updatedAt: new Date() })
    .where(eq(project.id, projectId));
}

/**
 * 删除项目及其全部聊天与资料。vote/message 的 chat 外键没有级联规则，
 * 必须先按项目聊天清单手动清空，再级联删除 chats 与 sources。
 */
export function deleteProject(userId: string, projectId: string) {
  return db.transaction(async (tx) => {
    const [record] = await tx
      .select()
      .from(project)
      .where(and(eq(project.id, projectId), eq(project.userId, userId)));
    if (!record) {
      return null;
    }

    const projectChats = await tx
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.projectId, projectId));
    const chatIds = projectChats.map((row) => row.id);

    if (chatIds.length > 0) {
      await tx.delete(vote).where(inArray(vote.chatId, chatIds));
      await tx.delete(message).where(inArray(message.chatId, chatIds));
      await tx.delete(chat).where(inArray(chat.id, chatIds));
    }
    await tx.delete(source).where(eq(source.projectId, projectId));
    await tx.delete(project).where(eq(project.id, projectId));
    return record;
  });
}

export async function createProjectChat({
  id,
  projectId,
  title,
  userId,
}: {
  id?: string;
  projectId: string;
  title: string;
  userId: string;
}) {
  const [created] = await db
    .insert(chat)
    .values({ createdAt: new Date(), id, projectId, title, userId })
    .returning();
  return created;
}

export type ProjectChatListItem = {
  chatId: string;
  createdAt: Date;
  lastMessageAt: Date | null;
  summary: string | null;
  title: string;
  updatedAt: Date;
};

/** 项目内聊天列表，附最近一条用户/助手消息摘要（列表页展示用） */
export async function listProjectChats(
  userId: string,
  projectId: string
): Promise<ProjectChatListItem[]> {
  const chats = await db
    .select({
      chatId: chat.id,
      createdAt: chat.createdAt,
      title: chat.title,
      updatedAt: chat.updatedAt,
    })
    .from(chat)
    .where(and(eq(chat.projectId, projectId), eq(chat.userId, userId)))
    .orderBy(desc(chat.updatedAt));

  if (chats.length === 0) {
    return [];
  }

  const chatIds = chats.map((row) => row.chatId);
  const latestMessages = await db
    .select({
      chatId: message.chatId,
      createdAt: message.createdAt,
      parts: message.parts,
    })
    .from(message)
    .where(inArray(message.chatId, chatIds))
    .orderBy(desc(message.createdAt));

  const summaryByChat = new Map<string, { createdAt: Date; summary: string }>();
  for (const row of latestMessages) {
    if (summaryByChat.has(row.chatId)) {
      continue;
    }
    const summary = extractMessageSummary(row.parts);
    if (summary) {
      summaryByChat.set(row.chatId, {
        createdAt: row.createdAt,
        summary,
      });
    }
  }

  return chats.map((row) => {
    const latest = summaryByChat.get(row.chatId);
    return {
      chatId: row.chatId,
      createdAt: row.createdAt,
      lastMessageAt: latest?.createdAt ?? null,
      summary: latest?.summary ?? null,
      title: row.title,
      updatedAt: row.updatedAt,
    };
  });
}

/** 消息摘要取首个文本 part，去掉 Markdown 符号后截 120 字符；纯工具/图片消息返回 null */
function extractMessageSummary(parts: unknown): string | null {
  if (!Array.isArray(parts)) {
    return null;
  }
  for (const part of parts) {
    if (
      part &&
      typeof part === "object" &&
      (part as { type?: string }).type === "text" &&
      typeof (part as { text?: unknown }).text === "string"
    ) {
      const text = (part as { text: string }).text
        .replace(/[*_`#>]+/g, "")
        .trim();
      if (text) {
        return text.length > 120 ? `${text.slice(0, 120)}…` : text;
      }
    }
  }
  return null;
}

export function createSource(
  userId: string,
  projectId: string,
  input: CreateSourceInput
) {
  return db.transaction(async (tx) => {
    const [owned] = await tx
      .select({ id: project.id })
      .from(project)
      .where(and(eq(project.id, projectId), eq(project.userId, userId)));
    if (!owned) {
      return null;
    }
    const [created] = await tx
      .insert(source)
      .values({ ...input, projectId })
      .returning();
    await tx
      .update(project)
      .set({ updatedAt: new Date() })
      .where(eq(project.id, projectId));
    return created;
  });
}

export async function listSources(userId: string, projectId: string) {
  const owned = await getProject(userId, projectId);
  if (!owned) {
    return null;
  }
  return db
    .select({
      createdAt: source.createdAt,
      id: source.id,
      name: source.name,
      type: source.type,
    })
    .from(source)
    .where(eq(source.projectId, projectId))
    .orderBy(desc(source.createdAt));
}

export async function deleteSource(
  userId: string,
  projectId: string,
  sourceId: string
) {
  const owned = await getProject(userId, projectId);
  if (!owned) {
    return null;
  }
  const [deleted] = await db
    .delete(source)
    .where(and(eq(source.id, sourceId), eq(source.projectId, projectId)))
    .returning({ id: source.id, name: source.name });
  return deleted ?? null;
}

/** 聊天上下文用：项目全部资料的名称与全文，按上传时间正序 */
export function listProjectSourceContents(projectId: string) {
  return db
    .select({
      content: source.content,
      createdAt: source.createdAt,
      name: source.name,
    })
    .from(source)
    .where(eq(source.projectId, projectId))
    .orderBy(asc(source.createdAt));
}
