import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_CHAT_ATTACHMENT_SIZE } from "../../../lib/ai/attachment-types";
import {
  libraryAttachmentType,
  searchLibraryFiles,
} from "../../../lib/documents/chat-attachments";
import type { LibraryItem } from "../../../lib/documents/types";

const file = (
  name: string,
  updatedAt = "2026-10-01T00:00:00Z"
): LibraryItem => ({
  contentType: null,
  createdAt: updatedAt,
  id: name,
  kind: "file",
  name,
  parentId: null,
  size: 100,
  source: "upload",
  updatedAt,
});

test("library search excludes folders, searches globally, orders recent files and preserves input", () => {
  const old = file("Report.PDF");
  const recent = {
    ...file("report-final.pdf", "2026-10-02T00:00:00Z"),
    parentId: "nested",
  };
  const folder = { ...file("report"), kind: "folder" as const };
  const items = [old, folder, recent, file("图片.png")];
  assert.deepEqual(searchLibraryFiles(items, "  REPORT  "), [recent, old]);
  assert.equal(searchLibraryFiles(items, "missing").length, 0);
  assert.equal(items[0], old);
  assert.equal(searchLibraryFiles(items, "图片")[0].name, "图片.png");
});

test("library selection uses canonical attachment MIME, rejects unknown formats and oversized files", () => {
  assert.equal(
    libraryAttachmentType({ ...file("note.md"), contentType: "text/plain" })
      ?.mediaType,
    "text/markdown"
  );
  for (const name of [
    "image.png",
    "report.pdf",
    "slides.pptx",
    "data.xlsx",
    "文档.docx",
  ]) {
    assert.ok(libraryAttachmentType(file(name)));
  }
  assert.equal(libraryAttachmentType(file("archive.zip")), null);
  assert.equal(
    libraryAttachmentType({
      ...file("file.pdf"),
      size: MAX_CHAT_ATTACHMENT_SIZE + 1,
    }),
    null
  );
  assert.ok(
    libraryAttachmentType({
      ...file("file.pdf"),
      size: MAX_CHAT_ATTACHMENT_SIZE,
    })
  );
  assert.equal(
    libraryAttachmentType({ ...file("folder.pdf"), kind: "folder" }),
    null
  );
});
