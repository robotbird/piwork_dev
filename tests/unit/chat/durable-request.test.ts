import assert from "node:assert/strict";
import test from "node:test";
import { postRequestBodySchema } from "../../../app/(chat)/api/chat/schema";
import { isChatApprovalContinuation } from "../../../hooks/chat-request";
import type { ChatMessage } from "../../../lib/types";

test("new user turns ignore old approval states; assistant continuations remain approvals", () => {
  const history: ChatMessage = {
    id: crypto.randomUUID(),
    parts: [{ state: "approval-responded", type: "dynamic-tool" } as never],
    role: "assistant",
  };
  const fresh: ChatMessage = {
    id: crypto.randomUUID(),
    parts: [{ text: "fresh", type: "text" }],
    role: "user",
  };
  assert.equal(isChatApprovalContinuation([history, fresh]), false);
  assert.equal(isChatApprovalContinuation([history]), true);
});

const request = {
  id: crypto.randomUUID(),
  message: {
    id: crypto.randomUUID(),
    parts: [{ text: "hello", type: "text" }],
    role: "user",
  },
  selectedChatModel: "test",
  selectedVisibilityType: "private",
};
test("clients cannot force a runtime lane or submit an identity/grant", () => {
  for (const lane of ["default", "durable_sandbox", "evil"]) {
    const parsed = postRequestBodySchema.parse({
      ...request,
      durableChat: { userId: crypto.randomUUID() },
      runtimeLane: lane,
      userId: crypto.randomUUID(),
    });
    assert.ok(!("runtimeLane" in parsed));
    assert.ok(!("durableChat" in parsed));
    assert.ok(!("userId" in parsed));
  }
  assert.ok(
    postRequestBodySchema.safeParse({
      ...request,
      message: undefined,
      messages: [],
    }).success
  );
});
