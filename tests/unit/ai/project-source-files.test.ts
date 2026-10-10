import assert from "node:assert/strict";
import { test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { CHAT_ATTACHMENT_ACCEPT } from "@/lib/ai/attachment-types";
import { assembleProjectSourcesContext } from "@/lib/projects/context";
import {
  decodeSourceImage,
  encodeSourceImage,
  extractSourceText,
  MAX_PROJECT_IMAGE_BYTES,
  SOURCE_ACCEPT,
  sourceTypeFromFilename,
} from "@/lib/projects/source-files";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64"
);

test("project context keeps images out of text truncation and enforces total limits", () => {
  const imageSource = {
    content: encodeSourceImage(png, "png"),
    name: "图片.png",
    type: "png",
  };
  const context = assembleProjectSourcesContext(
    [
      { content: "x".repeat(30_000), name: "长文.txt", type: "txt" },
      imageSource,
    ],
    "航空"
  );
  assert.equal(context?.images.length, 1);
  assert.equal(context?.truncatedSources, 1);
  assert.match(context?.block ?? "", /图片.png/);
  assert.ok(!context?.block.includes(png.toString("base64")));
  assert.throws(() =>
    assembleProjectSourcesContext(Array.from({ length: 6 }, () => imageSource))
  );
  assert.throws(() =>
    assembleProjectSourcesContext([{ ...imageSource, content: "not-json" }])
  );
  assert.equal(assembleProjectSourcesContext([]), null);
});

test("project allowlist matches chat formats and preserves legacy markdown", () => {
  assert.equal(SOURCE_ACCEPT, CHAT_ATTACHMENT_ACCEPT);
  for (const ext of SOURCE_ACCEPT.split(",")) {
    assert.ok(sourceTypeFromFilename(`资料${ext.toUpperCase()}`));
  }
  assert.equal(sourceTypeFromFilename("notes.md"), "markdown");
  for (const ext of ["doc", "xls", "ppt", "exe", "zip"]) {
    assert.equal(sourceTypeFromFilename(`file.${ext}`), null);
  }
});

test("project images persist losslessly as official Pi ImageContent", async () => {
  const stored = await extractSourceText({ content: png, type: "png" });
  const image = decodeSourceImage(stored, "png");
  assert.equal(image.type, "image");
  assert.equal(image.mimeType, "image/png");
  assert.deepEqual(Buffer.from(image.data, "base64"), png);
});

test("image payload rejects mismatched signatures, malformed data and excessive size", () => {
  assert.throws(() => encodeSourceImage(png, "jpg"));
  assert.throws(() => encodeSourceImage(new Uint8Array(), "png"));
  assert.throws(() =>
    encodeSourceImage(new Uint8Array(MAX_PROJECT_IMAGE_BYTES + 1), "png")
  );
  assert.throws(() => decodeSourceImage('{"version":2,"data":"abcd"}', "png"));
  assert.throws(() => decodeSourceImage('{"version":1,"data":"%%%"}', "png"));
});

test("common structured text and spreadsheets are actually extracted", async () => {
  assert.match(
    await extractSourceText({
      content: strToU8('{"项目":"航空"}'),
      type: "json",
    }),
    /航空/
  );
  assert.match(
    await extractSourceText({
      content: strToU8("# 航空资料"),
      type: "markdown",
    }),
    /航空资料/
  );
  assert.match(
    await extractSourceText({
      content: strToU8("name,value\n航空,42"),
      type: "csv",
    }),
    /航空/
  );
  const docx = zipSync({
    "[Content_Types].xml": strToU8(
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
    ),
    "word/document.xml": strToU8(
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>航空项目资料</w:t></w:r></w:p></w:body></w:document>'
    ),
  });
  assert.match(
    await extractSourceText({ content: docx, type: "docx" }),
    /航空项目资料/
  );
});
