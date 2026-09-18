import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { chatFileUrl, getChatFileId, isChatFileUrl } from "./attachment-types";
import { readLocalFile, storeFile } from "./file-store";

test("chat file URL helpers round-trip and reject traversal", () => {
  const url = chatFileUrl("test.drawio-a1b2c3d4e5");
  assert.equal(isChatFileUrl(url), true);
  assert.equal(getChatFileId(url), "test.drawio-a1b2c3d4e5");
  assert.equal(getChatFileId("/api/files/../secrets"), null);
  assert.equal(getChatFileId("/api/files/"), null);
  assert.equal(getChatFileId("https://example.com/api/files/x"), null);
});

test("storeFile writes local files with metadata when blob token absent", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "piwork-uploads-"));
  t.after(() => rm(dir, { force: true, recursive: true }));
  const previousToken = process.env.BLOB_READ_WRITE_TOKEN;
  const previousDir = process.env.UPLOAD_DIR;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  process.env.UPLOAD_DIR = dir;
  t.after(() => {
    if (previousToken) {
      process.env.BLOB_READ_WRITE_TOKEN = previousToken;
    }
    if (previousDir) {
      process.env.UPLOAD_DIR = previousDir;
    }
  });

  const stored = await storeFile({
    // 模拟 route 里的 file.arrayBuffer()：裸 ArrayBuffer 也必须能落盘。
    buffer: new TextEncoder().encode("<mxfile>架构图</mxfile>").slice()
      .buffer as ArrayBuffer,
    contentType: "application/vnd.jgraph.mxfile",
    filename: "架构图.drawio",
  });

  assert.match(stored.url, /^\/api\/files\/.+\.drawio$/);
  assert.equal(stored.name, "架构图.drawio");
  assert.equal(stored.contentType, "application/vnd.jgraph.mxfile");

  const file = await readLocalFile(getChatFileId(stored.url) as string);
  assert.ok(file);
  assert.equal(file.content.toString(), "<mxfile>架构图</mxfile>");
  assert.equal(file.contentType, "application/vnd.jgraph.mxfile");
  assert.equal(file.name, "架构图.drawio");
});

test("readLocalFile returns null for unknown ids and traversal attempts", async () => {
  assert.equal(await readLocalFile("missing.drawio-a1b2c3d4e5"), null);
  assert.equal(await readLocalFile("../.env.local"), null);
});

test("readLocalFile ignores stale files without metadata", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "piwork-uploads-"));
  t.after(() => rm(dir, { force: true, recursive: true }));
  const previousDir = process.env.UPLOAD_DIR;
  process.env.UPLOAD_DIR = dir;
  t.after(() => {
    if (previousDir) {
      process.env.UPLOAD_DIR = previousDir;
    }
  });

  await writeFile(path.join(dir, "orphan.drawio-a1b2c3d4e5"), "data");
  assert.equal(await readLocalFile("orphan.drawio-a1b2c3d4e5"), null);
  // 确认目录内容未被误删
  assert.equal(
    await readFile(path.join(dir, "orphan.drawio-a1b2c3d4e5"), "utf8"),
    "data"
  );
});
