import assert from "node:assert/strict";
import test from "node:test";
import { deflateSync, strToU8 } from "fflate";
import {
  getSupportedAttachmentType,
  isVisionAttachment,
} from "./attachment-types";
import { extractAttachmentText } from "./attachments";

test("recognizes common office, image, and Draw.io attachments", () => {
  assert.equal(
    getSupportedAttachmentType("report.docx")?.mediaType,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  assert.equal(
    getSupportedAttachmentType("architecture.drawio")?.mediaType,
    "application/vnd.jgraph.mxfile"
  );
  assert.equal(isVisionAttachment("image/webp"), true);
  assert.equal(getSupportedAttachmentType("installer.dmg"), null);
});

test("extracts readable content from Markdown documents", async () => {
  const text = await extractAttachmentText({
    content: new TextEncoder().encode("# 周报\n\n完成附件处理功能。"),
    extension: "md",
  });

  assert.match(text, /周报/);
  assert.match(text, /附件处理功能/);
});

test("preserves Draw.io XML for skills to process", async () => {
  const source =
    '<mxfile><diagram name="Page-1"><mxGraphModel /></diagram></mxfile>';
  const text = await extractAttachmentText({
    content: new TextEncoder().encode(source),
    extension: "drawio",
  });

  assert.equal(text, source);
});

test("expands compressed Draw.io diagram XML", async () => {
  const diagram = '<mxGraphModel><root><mxCell id="1" /></root></mxGraphModel>';
  const compressed = Buffer.from(
    deflateSync(strToU8(encodeURIComponent(diagram)))
  ).toString("base64");
  const source = `<mxfile><diagram name="Page-1">${compressed}</diagram></mxfile>`;
  const text = await extractAttachmentText({
    content: new TextEncoder().encode(source),
    extension: "drawio",
  });

  assert.match(text, /已解压的 Draw\.io 图页/);
  assert.match(text, /<mxCell id="1" \/>/);
});
