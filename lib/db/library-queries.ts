import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { StoredFile } from "@/lib/ai/file-store";
import { chat, document, libraryItem } from "./schema";

const db = drizzle(postgres(process.env.POSTGRES_URL ?? ""));

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
