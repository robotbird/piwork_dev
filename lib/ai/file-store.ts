import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";

import { chatFileUrl, isValidChatFileId } from "./attachment-types";

const DEFAULT_UPLOAD_DIR = ".uploads";

export type StoredFile = {
  contentType: string;
  downloadUrl?: string;
  name: string;
  pathname: string;
  url: string;
};

export function isVercelBlobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getUploadDir() {
  return process.env.UPLOAD_DIR || DEFAULT_UPLOAD_DIR;
}

/**
 * 上传附件：配置了 BLOB_READ_WRITE_TOKEN 时写入 Vercel Blob，
 * 否则落盘到本地目录（默认 .uploads/），通过 /api/files/:id 提供访问。
 */
export async function storeFile({
  buffer,
  contentType,
  filename,
}: {
  buffer: ArrayBuffer | Uint8Array;
  contentType: string;
  filename: string;
}): Promise<StoredFile> {
  // fs.writeFile 不接受裸 ArrayBuffer，@vercel/blob 只接受 ArrayBuffer/Buffer，
  // 统一转成 Buffer 两者皆可。
  const content = Buffer.from(
    buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  );
  const safeName = sanitizeFilename(filename);

  if (isVercelBlobConfigured()) {
    const data = await put(safeName, content, {
      access: "public",
      addRandomSuffix: true,
      contentType,
    });
    return {
      contentType,
      downloadUrl: data.downloadUrl,
      name: filename,
      pathname: data.pathname,
      url: data.url,
    };
  }

  const suffix = randomBytes(5).toString("hex");
  const dot = safeName.lastIndexOf(".");
  const base = dot > 0 ? safeName.slice(0, dot) : safeName;
  const ext = dot > 0 ? safeName.slice(dot) : "";
  const id = `${base || "file"}-${suffix}${ext}`;
  const dir = getUploadDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, id), content, { flag: "wx" });
  await writeFile(
    path.join(dir, `${id}.json`),
    JSON.stringify({ contentType, name: filename }),
    { flag: "wx" }
  );

  return { contentType, name: filename, pathname: id, url: chatFileUrl(id) };
}

export async function readLocalFile(id: string) {
  if (!isValidChatFileId(id)) {
    return null;
  }
  try {
    const dir = getUploadDir();
    const [content, meta] = await Promise.all([
      readFile(path.join(dir, id)),
      readFile(path.join(dir, `${id}.json`), "utf8"),
    ]);
    const { contentType, name } = JSON.parse(meta) as {
      contentType: string;
      name: string;
    };
    return { content, contentType, name: name ?? id };
  } catch {
    return null;
  }
}
