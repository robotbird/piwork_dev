import "server-only";
import { and, desc, eq } from "drizzle-orm";
import type { StoredFile } from "@/lib/ai/file-store";
import { getDb } from "./client";
import { chat, document, libraryItem } from "./schema";

const db = getDb();

export function listLibraryItems(userId: string) {
  return db
    .select({
      contentType: libraryItem.contentType,
      createdAt: libraryItem.createdAt,
      id: libraryItem.id,
      kind: libraryItem.kind,
      name: libraryItem.name,
      parentId: libraryItem.parentId,
      size: libraryItem.size,
      source: libraryItem.source,
      updatedAt: libraryItem.updatedAt,
    })
    .from(libraryItem)
    .where(eq(libraryItem.userId, userId))
    .orderBy(desc(libraryItem.updatedAt));
}

export async function getLibraryItem(userId: string, id: string) {
  const [item] = await db
    .select()
    .from(libraryItem)
    .where(and(eq(libraryItem.userId, userId), eq(libraryItem.id, id)));
  return item;
}

export async function getLibraryFileByUrl(userId: string, url: string) {
  const [item] = await db
    .select()
    .from(libraryItem)
    .where(
      and(
        eq(libraryItem.userId, userId),
        eq(libraryItem.url, url),
        eq(libraryItem.kind, "file")
      )
    )
    .limit(1);
  return item;
}

export async function assertLibraryFolder(
  userId: string,
  parentId: string | null
) {
  if (!parentId) {
    return;
  }
  const folder = await getLibraryItem(userId, parentId);
  if (folder?.kind !== "folder") {
    throw new Error("文件夹不存在");
  }
}

export async function registerLibraryFile({
  userId,
  parentId = null,
  file,
  size,
  source,
}: {
  userId: string;
  parentId?: string | null;
  file: StoredFile;
  size: number;
  source: "upload" | "ai" | "manual";
}) {
  await assertLibraryFolder(userId, parentId);
  const [item] = await db
    .insert(libraryItem)
    .values({
      contentType: file.contentType,
      kind: "file",
      name: file.name,
      parentId,
      size,
      source,
      url: file.url,
      userId,
    })
    .onConflictDoUpdate({
      set: { updatedAt: new Date() },
      target: [libraryItem.userId, libraryItem.url],
    })
    .returning();
  return item;
}

export async function registerGeneratedFile(
  chatId: string,
  file: StoredFile,
  size: number
) {
  const [owner] = await db
    .select({ userId: chat.userId })
    .from(chat)
    .where(eq(chat.id, chatId));
  if (!owner) {
    throw new Error("Chat owner not found");
  }
  await registerLibraryFile({ file, size, source: "ai", userId: owner.userId });
}

export async function createLibraryFolder(
  userId: string,
  name: string,
  parentId: string | null
) {
  await assertLibraryFolder(userId, parentId);
  const [item] = await db
    .insert(libraryItem)
    .values({ kind: "folder", name, parentId, source: "manual", userId })
    .returning();
  return item;
}

export async function renameLibraryItem(
  userId: string,
  id: string,
  name: string
) {
  const [item] = await db
    .update(libraryItem)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(libraryItem.id, id), eq(libraryItem.userId, userId)))
    .returning();
  return item;
}

export async function readLibraryDocument(userId: string, documentId: string) {
  const [item] = await db
    .select()
    .from(document)
    .where(and(eq(document.id, documentId), eq(document.userId, userId)))
    .orderBy(desc(document.createdAt))
    .limit(1);
  return item;
}

export async function canReadStoredFile(userId: string, url: string) {
  const [item] = await db
    .select({ id: libraryItem.id })
    .from(libraryItem)
    .where(and(eq(libraryItem.userId, userId), eq(libraryItem.url, url)))
    .limit(1);
  return Boolean(item);
}

/**
 * 按 id 读单个条目（不限归属）。仅供平台内部服务端投影使用（如协作头像
 * 端点）；调用方必须自行校验条目归属后再输出字节。
 */
export async function getLibraryItemById(id: string) {
  const [item] = await db
    .select()
    .from(libraryItem)
    .where(eq(libraryItem.id, id))
    .limit(1);
  return item;
}

export type LibraryItemBytes = {
  bytes: Uint8Array;
  contentType: string;
};

/**
 * 读取条目内容字节（document / 本地文件 / 白名单 Blob 三分支），与
 * `/api/library/[id]` 同一逻辑；null = 不可读（不存在/外部 URL 非白名单）。
 */
export async function readLibraryItemBytes(
  item: NonNullable<Awaited<ReturnType<typeof getLibraryItemById>>>
): Promise<LibraryItemBytes | null> {
  if (item.kind === "folder") {
    return null;
  }
  if (item.documentId) {
    const [doc] = await db
      .select()
      .from(document)
      .where(
        and(eq(document.id, item.documentId), eq(document.userId, item.userId))
      )
      .orderBy(desc(document.createdAt))
      .limit(1);
    if (!doc) {
      return null;
    }
    const bytes =
      doc.kind === "image"
        ? new Uint8Array(
            Buffer.from(
              (doc.content ?? "").replace(/^data:image\/[^;]+;base64,/, ""),
              "base64"
            )
          )
        : new TextEncoder().encode(doc.content ?? "");
    return {
      bytes,
      contentType: item.contentType ?? "application/octet-stream",
    };
  }
  const { getChatFileId } = await import("@/lib/ai/attachment-types");
  const { readLocalFile } = await import("@/lib/ai/file-store");
  const localId = getChatFileId(item.url ?? "");
  if (localId) {
    const file = await readLocalFile(localId);
    if (!file) {
      return null;
    }
    return {
      bytes: new Uint8Array(file.content),
      contentType: item.contentType ?? "application/octet-stream",
    };
  }
  // Only our Blob host is fetched; historical external URLs must never become an SSRF proxy.
  const url = new URL(item.url ?? "", "https://invalid.local");
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".public.blob.vercel-storage.com")
  ) {
    return null;
  }
  const response = await fetch(url, { redirect: "error" });
  if (!response.ok) {
    return null;
  }
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: item.contentType ?? "application/octet-stream",
  };
}

export async function moveLibraryFile(
  userId: string,
  id: string,
  parentId: string | null
) {
  await assertLibraryFolder(userId, parentId);
  const [item] = await db
    .update(libraryItem)
    .set({ parentId, updatedAt: new Date() })
    .where(
      and(
        eq(libraryItem.userId, userId),
        eq(libraryItem.id, id),
        eq(libraryItem.kind, "file")
      )
    )
    .returning();
  return item;
}
