import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import path from "node:path";
import { getChatFileId } from "./attachment-types";

/** Only invoke after resolving an owned LibraryItem. No arbitrary attachment URL
 * fetch, no host image/Office decoding, and limits apply during transfer.
 */
export async function readBoundedStoredFile(
  url: string,
  root: string,
  maxBytes: number,
  signal?: AbortSignal
): Promise<Uint8Array> {
  if (
    !Number.isSafeInteger(maxBytes) ||
    maxBytes <= 0 ||
    maxBytes > 50 * 1024 * 1024 ||
    !path.isAbsolute(root)
  ) {
    throw new Error("durable-chat:invalid-file-limit");
  }
  const deadline = AbortSignal.timeout(15_000);
  const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
  combined.throwIfAborted();
  const id = getChatFileId(url);
  if (id) {
    const directory = await lstat(root);
    if (!directory.isDirectory() || directory.isSymbolicLink()) {
      throw new Error("durable-chat:invalid-file-root");
    }
    const file = await open(
      path.join(root, id),
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
    );
    try {
      const info = await file.stat();
      if (!info.isFile() || info.nlink !== 1 || info.size > maxBytes) {
        throw new Error("durable-chat:file-limit-or-unsafe-file");
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      while (true) {
        combined.throwIfAborted();
        const chunk = Buffer.alloc(Math.min(64 * 1024, maxBytes + 1 - bytes));
        // biome-ignore lint/performance/noAwaitInLoops: bounded sequential filesystem transfer
        const { bytesRead } = await file.read(chunk, 0, chunk.length, null);
        if (!bytesRead) {
          break;
        }
        bytes += bytesRead;
        if (bytes > maxBytes) {
          throw new Error("durable-chat:file-limit-exceeded");
        }
        chunks.push(chunk.subarray(0, bytesRead));
      }
      return Buffer.concat(chunks);
    } finally {
      await file.close();
    }
  }
  const remote = new URL(url);
  if (
    remote.protocol !== "https:" ||
    !remote.hostname.endsWith(".public.blob.vercel-storage.com") ||
    remote.username ||
    remote.password ||
    (remote.port && remote.port !== "443")
  ) {
    throw new Error("durable-chat:untrusted-file-url");
  }
  const response = await fetch(remote, { redirect: "error", signal: combined });
  if (!response.ok || !response.body) {
    throw new Error("durable-chat:file-download-failed");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    if (Number(response.headers.get("content-length") ?? 0) > maxBytes) {
      throw new Error("durable-chat:file-limit-exceeded");
    }
    while (true) {
      combined.throwIfAborted();
      // biome-ignore lint/performance/noAwaitInLoops: streaming limit must precede buffering
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      bytes += value.length;
      if (bytes > maxBytes) {
        throw new Error("durable-chat:file-limit-exceeded");
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
