import assert from "node:assert/strict";
import test from "node:test";
import {
  isMessageTextTooLongError,
  postRequestBodySchema,
} from "../../../app/(chat)/api/chat/schema";
import { CHAT_TEXT_PART_MAX_LENGTH } from "../../../lib/chat-input";
import { getMessageByErrorCode } from "../../../lib/errors";

function requestWithText(text: string) {
  return {
    id: crypto.randomUUID(),
    message: {
      id: crypto.randomUUID(),
      parts: [{ text, type: "text" }],
      role: "user",
    },
    selectedChatModel: "test",
    selectedVisibilityType: "private",
  };
}

test("long pasted articles (formerly >2000 chars) are accepted", () => {
  const parsed = postRequestBodySchema.parse(requestWithText("长".repeat(30_000)));
  assert.equal(parsed.message?.parts[0].type, "text");
});

test("text part boundary: exactly the limit passes, one more char fails", () => {
  const atLimit = postRequestBodySchema.safeParse(
    requestWithText("a".repeat(CHAT_TEXT_PART_MAX_LENGTH))
  );
  assert.ok(atLimit.success);

  const overLimit = postRequestBodySchema.safeParse(
    requestWithText("a".repeat(CHAT_TEXT_PART_MAX_LENGTH + 1))
  );
  assert.equal(overLimit.success, false);
});

test("empty text parts stay rejected", () => {
  assert.equal(
    postRequestBodySchema.safeParse(requestWithText("")).success,
    false
  );
});

test("over-limit text is detected as message-too-long, other failures are not", () => {
  const overLimit = postRequestBodySchema.safeParse(
    requestWithText("a".repeat(CHAT_TEXT_PART_MAX_LENGTH + 1))
  );
  assert.equal(overLimit.success, false);
  assert.equal(isMessageTextTooLongError(overLimit.error), true);

  // 空文本是 too_small，不是长度超限
  const empty = postRequestBodySchema.safeParse(requestWithText(""));
  assert.equal(isMessageTextTooLongError(empty.error), false);

  // 其它校验失败（如非法 visibility）也不算超限
  const badVisibility = postRequestBodySchema.safeParse({
    ...requestWithText("hello"),
    selectedVisibilityType: "internal",
  });
  assert.equal(badVisibility.success, false);
  assert.equal(isMessageTextTooLongError(badVisibility.error), false);

  // 非 ZodError 一律不算
  assert.equal(isMessageTextTooLongError(new Error("boom")), false);
});

test("bad_request:chat maps to a dedicated too-long message with the limit", () => {
  const message = getMessageByErrorCode("bad_request:chat");
  assert.match(message, /too long/i);
  assert.ok(message.includes("50,000"));
});
