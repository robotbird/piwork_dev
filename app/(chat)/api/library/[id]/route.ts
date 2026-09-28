import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { getChatFileId } from "@/lib/ai/attachment-types";
import { readLocalFile } from "@/lib/ai/file-store";
import {
  getLibraryItem,
  readLibraryDocument,
  renameLibraryItem,
} from "@/lib/db/library-queries";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(null, { status: 401 });
  }
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return new Response(null, { status: 400 });
  }
  const item = await getLibraryItem(session.user.id, id);
  if (!item || item.kind === "folder") {
    return new Response(null, { status: 404 });
  }
  let bytes: Uint8Array;
  if (item.documentId) {
    const doc = await readLibraryDocument(session.user.id, item.documentId);
    if (!doc) {
      return new Response(null, { status: 404 });
    }
    bytes =
      doc.kind === "image"
        ? new Uint8Array(
            Buffer.from(
              (doc.content ?? "").replace(/^data:image\/[^;]+;base64,/, ""),
              "base64"
            )
          )
        : new TextEncoder().encode(doc.content ?? "");
  } else {
    const localId = getChatFileId(item.url ?? "");
    if (localId) {
      const file = await readLocalFile(localId);
      if (!file) {
        return new Response(null, { status: 404 });
      }
      bytes = new Uint8Array(file.content);
    } else {
      // Only our Blob host is fetched; historical external URLs must never become an SSRF proxy.
      const url = new URL(item.url ?? "", "https://invalid.local");
      if (
        url.protocol !== "https:" ||
        !url.hostname.endsWith(".public.blob.vercel-storage.com")
      ) {
        return new Response(null, { status: 404 });
      }
      const response = await fetch(url, { redirect: "error" });
      if (!response.ok) {
        return new Response(null, { status: 502 });
      }
      bytes = new Uint8Array(await response.arrayBuffer());
    }
  }
  const preview =
    new URL(request.url).searchParams.has("preview") &&
    ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(
      item.contentType ?? ""
    );
  return new Response(bytes as BodyInit, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `${preview ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(item.name)}`,
      "Content-Security-Policy": "sandbox",
      "Content-Type": item.contentType ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function PATCH(request: Request, context: Context) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(null, { status: 401 });
  }
  const { id } = await context.params;
  const parsed = z
    .object({ name: z.string().trim().min(1).max(180) })
    .safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !parsed.success) {
    return Response.json({ error: "名称无效" }, { status: 400 });
  }
  const item = await renameLibraryItem(session.user.id, id, parsed.data.name);
  return item ? Response.json(item) : new Response(null, { status: 404 });
}
