import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, mkdir, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { chatFileUrl } from "./attachment-types";
import type { StoredFile } from "./file-store";

/** MVP private artifacts use the existing authenticated local-file route, even
 * when legacy uploads use public Blob. directory must be trusted persistent
 * storage, never a model-writable workspace. Caller must archive before emitting
 * artifact.created; no LibraryItem means the download route denies access.
 */
export function createPrivateFileStore(
  directory = process.env.UPLOAD_DIR || ".uploads"
) {
  const root = path.resolve(directory);
  return async (input: {
    operationKey: string;
    content: Uint8Array;
    filename: string;
    contentType: string;
  }): Promise<StoredFile> => {
    if (
      !input.operationKey ||
      input.operationKey.length > 2048 ||
      input.content.length > 50 * 1024 * 1024 ||
      !input.filename ||
      input.filename.length > 180 ||
      Array.from(input.filename).some(
        (character) =>
          character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127
      ) ||
      !/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(input.contentType)
    ) {
      throw new Error("private-file:invalid-input");
    }
    const content = Buffer.from(input.content);
    const id = `private-${createHash("sha256").update(input.operationKey).digest("hex")}`;
    const destination = path.join(root, id);
    const metadata = JSON.stringify({
      contentType: input.contentType,
      name: input.filename,
    });
    await mkdir(root, { mode: 0o700, recursive: true });
    // Link publishes a synced temporary inode atomically and never overwrites a
    // competing/replayed operation. A crash between bytes and metadata can be
    // repaired by the same key/content; mismatched content is never replaced.
    await publish(destination, content);
    await publish(`${destination}.json`, Buffer.from(metadata));
    const dir = await open(
      root,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
    );
    try {
      await dir.sync();
    } finally {
      await dir.close();
    }
    const url = chatFileUrl(id);
    return {
      contentType: input.contentType,
      downloadUrl: `${url}?download=1`,
      name: input.filename,
      pathname: id,
      url,
    };
  };
}

async function publish(destination: string, content: Buffer): Promise<void> {
  const temporary = `${destination}.tmp-${randomUUID()}`;
  const file = await open(temporary, "wx", 0o600);
  try {
    try {
      await file.writeFile(content);
      await file.sync();
    } finally {
      await file.close();
    }
    try {
      await link(temporary, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
      const existing = await open(
        destination,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
      );
      try {
        const stat = await existing.stat();
        if (!stat.isFile() || stat.size !== content.length) {
          throw new Error("private-file:operation-content-conflict", {
            cause: error,
          });
        }
        const saved = await readFile(existing);
        if (!saved.equals(content)) {
          throw new Error("private-file:operation-content-conflict", {
            cause: error,
          });
        }
      } finally {
        await existing.close();
      }
    }
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}
