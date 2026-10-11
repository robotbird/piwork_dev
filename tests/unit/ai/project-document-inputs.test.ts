import assert from "node:assert/strict";
import test from "node:test";
import { strToU8, zipSync } from "fflate";
import { extractAttachmentText } from "@/lib/ai/attachments";
import { assembleProjectSourcesContext } from "@/lib/projects/context";
import {
  documentCompleteness,
  MAX_PROJECT_TEXT_BYTES,
  PROJECT_SEGMENT_BYTES,
  projectSourceReferences,
  splitProjectText,
  textSha256,
} from "@/lib/projects/document-inputs";
import { extractSourceText } from "@/lib/projects/source-files";

test("project storage preserves text after 20k/60k/150k, chat preview stays bounded", async () => {
  const original = `${"航空资料🙂\n".repeat(25_000)}场景42：建设工程智能审图与质量检测`;
  const complete = await extractSourceText({
    content: Buffer.from(original),
    type: "txt",
  });
  assert.equal(complete, original);
  const preview = await extractAttachmentText({
    content: Buffer.from(original),
    extension: "txt",
  });
  assert.ok(preview.length < complete.length);
  assert.match(preview, /附件内容已截断/);
  const source = {
    content: complete,
    id: crypto.randomUUID(),
    name: "全部场景.txt",
    type: "txt",
  };
  const context = assembleProjectSourcesContext([source], "航空", true);
  assert.equal(context?.references[0].sha256, textSha256(original));
  assert.equal(context?.references[0].bytes, Buffer.byteLength(original));
  assert.match(context?.block ?? "", /仅为前 512 字符预览/);
  assert.match(context?.block ?? "", /必须遍历/);
  assert.ok(!context?.block.includes("场景42："));
});

test("Office extraction stores complete text rather than its 60k preview", async () => {
  const original = `${"场景正文".repeat(16_000)}第42项末尾`;
  const docx = zipSync({
    "[Content_Types].xml": strToU8(
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
    ),
    "word/document.xml": strToU8(
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${original}</w:t></w:r></w:p></w:body></w:document>`
    ),
  });
  const text = await extractSourceText({ content: docx, type: "docx" });
  assert.ok(text.includes(original));
  assert.match(text, /第42项末尾/);
});

test("segments preserve UTF-8, giant lines and exact byte ranges", () => {
  for (const original of [
    "",
    "a".repeat(PROJECT_SEGMENT_BYTES),
    `${"𠮷航空🙂".repeat(13_000)}\n最后一行`,
  ]) {
    const segments = splitProjectText(original);
    assert.deepEqual(Buffer.concat(segments), Buffer.from(original));
    for (const segment of segments) {
      assert.ok(segment.length <= PROJECT_SEGMENT_BYTES);
      assert.equal(
        Buffer.from(segment.toString("utf8")).length,
        segment.length
      );
      assert.ok(!segment.toString("utf8").includes("�"));
    }
  }
});

test("oversize, cancellation and malformed catalog fail without truncated success", async () => {
  await assert.rejects(
    extractSourceText({
      content: Buffer.alloc(MAX_PROJECT_TEXT_BYTES + 1, 65),
      type: "txt",
    }),
    /未保存截断/
  );
  await assert.rejects(
    extractSourceText({
      content: Buffer.from("data"),
      signal: AbortSignal.abort(),
      type: "txt",
    })
  );
  assert.throws(
    () => splitProjectText("x".repeat(MAX_PROJECT_TEXT_BYTES + 1)),
    /超过/
  );
  const source = {
    content: "正文",
    id: crypto.randomUUID(),
    name: "x.txt",
    type: "txt",
  };
  assert.throws(() => projectSourceReferences([source, source]), /重复/);
  assert.throws(
    () => projectSourceReferences([{ ...source, id: "../escape" }]),
    /无效/
  );
  assert.throws(
    () =>
      projectSourceReferences(
        Array.from({ length: 51 }, () => ({
          ...source,
          id: crypto.randomUUID(),
        }))
      ),
    /50/
  );
  assert.throws(
    () =>
      projectSourceReferences(
        Array.from({ length: 5 }, () => ({
          ...source,
          content: "x".repeat(MAX_PROJECT_TEXT_BYTES),
          id: crypto.randomUUID(),
        }))
      ),
    /8 MB/
  );
  assert.equal(documentCompleteness("完整性没有历史证据"), "legacy_unknown");
  assert.equal(documentCompleteness("正文[附件内容已截断]"), "known_truncated");
});
