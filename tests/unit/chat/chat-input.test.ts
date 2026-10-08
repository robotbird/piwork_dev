import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPastedTextFilename,
  CHAT_TEXT_PART_MAX_LENGTH,
  CHAT_TEXT_TO_FILE_THRESHOLD,
  normalizePastedText,
} from "../../../lib/chat-input";

test("normalizePastedText converts CRLF and lone CR to LF, keeps LF as-is", () => {
  assert.equal(normalizePastedText("第一段\r\n第二段"), "第一段\n第二段");
  assert.equal(normalizePastedText("第一段\r第二段"), "第一段\n第二段");
  assert.equal(normalizePastedText("第一段\n第二段"), "第一段\n第二段");
  assert.equal(normalizePastedText("a\r\nb\rc\n\nd"), "a\nb\nc\n\nd");
  assert.equal(normalizePastedText(""), "");
  assert.equal(normalizePastedText("无换行"), "无换行");
});

test("buildPastedTextFilename uses pasted-text prefix with timestamp stamp", () => {
  const name = buildPastedTextFilename(
    new Date(2026, 4, 12, 9, 5, 3) // 2026-05-12 09:05:03 local
  );
  assert.equal(name, "pasted-text-20260512-090503.txt");
  assert.match(buildPastedTextFilename(), /^pasted-text-\d{8}-\d{6}\.txt$/);
});

test("attachment threshold stays below the hard message-length cap", () => {
  assert.ok(CHAT_TEXT_TO_FILE_THRESHOLD > 0);
  assert.ok(CHAT_TEXT_TO_FILE_THRESHOLD < CHAT_TEXT_PART_MAX_LENGTH);
});
