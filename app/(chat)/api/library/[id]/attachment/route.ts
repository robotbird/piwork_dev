import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  getChatFileId,
  MAX_CHAT_ATTACHMENT_SIZE,
} from "@/lib/ai/attachment-types";
import { storeFile } from "@/lib/ai/file-store";
import {
  getLibraryItem,
  readLibraryDocument,
  registerLibraryFile,
} from "@/lib/db/library-queries";
import { libraryAttachmentType } from "@/lib/documents/chat-attachments";

// Resolve only an owned library entry, never an arbitrary client URL.
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "请先登录" }, { status: 401 });
  }
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "文件无效" }, { status: 400 });
  }
  const item = await getLibraryItem(session.user.id, id);
  if (item?.kind !== "file") {
    return Response.json({ error: "文件不存在" }, { status: 404 });
  }
  const supported = libraryAttachmentType(item);
  if (!supported) {
    return Response.json(
      { error: "该文件格式暂不支持问答，或文件超过 20 MB" },
      { status: 400 }
    );
  }
  let { url } = item;
  if (item.documentId) {
    const doc = await readLibraryDocument(session.user.id, item.documentId);
    if (!doc) {
      return Response.json({ error: "文件不存在" }, { status: 404 });
    }
    const bytes =
      doc.kind === "image"
        ? Buffer.from(
            (doc.content ?? "").replace(/^data:image\/[^;]+;base64,/, ""),
            "base64"
          )
        : Buffer.from(doc.content ?? "", "utf8");
    if (bytes.byteLength > MAX_CHAT_ATTACHMENT_SIZE) {
      return Response.json({ error: "文件超过 20 MB" }, { status: 400 });
    }
    // Editable notes are snapshotted so this turn refers to stable bytes,
    // including in Durable's existing owned LibraryItem/hash pipeline.
    const file = await storeFile({
      buffer: bytes,
      contentType: supported.mediaType,
      filename: item.name,
    });
    await registerLibraryFile({
      file,
      size: bytes.byteLength,
      source: "manual",
      userId: session.user.id,
    });
    ({ url } = file);
  }
  const remote = url ? new URL(url, "https://invalid.local") : null;
  if (
    !url ||
    (!getChatFileId(url) &&
      !(
        remote?.protocol === "https:" &&
        remote.hostname.endsWith(".public.blob.vercel-storage.com")
      ))
  ) {
    return Response.json({ error: "文件不可用" }, { status: 400 });
  }
  return Response.json(
    { contentType: supported.mediaType, name: item.name, url },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
