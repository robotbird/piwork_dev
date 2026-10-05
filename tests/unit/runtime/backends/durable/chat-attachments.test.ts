import "../../../../support/runtime-env";
import assert from "node:assert/strict";
import { link, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { readBoundedStoredFile } from "../../../../../lib/ai/bounded-stored-file";
import {
  type DurableChatFiles,
  prepareDurableChatAttachments,
} from "../../../../../lib/runtime/backends/durable/chat-attachments";
import { sha256 } from "../../../../../lib/runtime/backends/durable/chat-input";
import type { ChatMessage } from "../../../../../lib/types";

const owner = crypto.randomUUID();
const item = {
  contentType: "text/plain",
  id: crypto.randomUUID(),
  kind: "file",
  name: "../../中文 文档.txt",
  url: "/api/files/source.txt",
};
const files: DurableChatFiles = {
  byId: () => Promise.resolve(item),
  byUrl: (id, url) =>
    Promise.resolve(id === owner && url === item.url ? item : undefined),
  read: () => Promise.resolve(Buffer.from("source")),
};
function message(url = item.url, mediaType = item.contentType): ChatMessage {
  return {
    id: crypto.randomUUID(),
    parts: [{ filename: "client-spoofed.txt", mediaType, type: "file", url }],
    role: "user",
  };
}
test("attachment admission uses owned metadata, safe relative path and SHA256; never client filename/path", async () => {
  const result = await prepareDurableChatAttachments(owner, message(), files);
  assert.equal(result.attachments[0].sha256, sha256("source"));
  assert.equal(result.attachments[0].libraryItemId, item.id);
  assert.match(result.attachments[0].path, /^inputs\/1-[a-zA-Z0-9._-]+$/);
  assert.ok(!result.attachments[0].path.includes("client-spoofed"));
  assert.deepEqual(result.images, []);
  await assert.rejects(
    prepareDurableChatAttachments(crypto.randomUUID(), message(), files),
    /not-owned/
  );
  await assert.rejects(
    prepareDurableChatAttachments(
      owner,
      message("https://evil.test/file.txt"),
      files
    ),
    /not-owned/
  );
  await assert.rejects(
    prepareDurableChatAttachments(owner, message(item.url, "image/png"), files),
    /not-owned/
  );
  await assert.rejects(
    prepareDurableChatAttachments(
      owner,
      {
        ...message(),
        parts: Array.from({ length: 6 }, () => message().parts[0]),
      },
      files
    ),
    /count-limit/
  );
});
test("bounded stored-file reader rejects oversize/symlink/hardlink/unsafe roots and arbitrary external hosts", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "durable-chat-files-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  await writeFile(path.join(root, "source.txt"), "source");
  assert.equal(
    Buffer.from(
      await readBoundedStoredFile("/api/files/source.txt", root, 6)
    ).toString(),
    "source"
  );
  await assert.rejects(
    readBoundedStoredFile("/api/files/source.txt", root, 5),
    /limit/
  );
  await symlink(path.join(root, "source.txt"), path.join(root, "symlink.txt"));
  await assert.rejects(
    readBoundedStoredFile("/api/files/symlink.txt", root, 6)
  );
  await link(path.join(root, "source.txt"), path.join(root, "hardlink.txt"));
  await assert.rejects(
    readBoundedStoredFile("/api/files/hardlink.txt", root, 6),
    /unsafe-file/
  );
  await mkdir(path.join(root, "directory.txt"));
  await assert.rejects(
    readBoundedStoredFile("/api/files/directory.txt", root, 6),
    /unsafe-file/
  );
  await assert.rejects(
    readBoundedStoredFile("https://127.0.0.1/private", root, 6),
    /untrusted/
  );
  await assert.rejects(
    readBoundedStoredFile("https://evil.test/private", root, 6),
    /untrusted/
  );
  await assert.rejects(
    readBoundedStoredFile("/api/files/source.txt", root, 6, AbortSignal.abort())
  );
});
