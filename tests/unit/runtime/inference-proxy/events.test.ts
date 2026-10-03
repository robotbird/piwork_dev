import "../../../support/runtime-env";
import assert from "node:assert/strict";
import test from "node:test";
import type { AssistantMessage, Usage } from "@earendil-works/pi-ai";
import { toPiMessagesEvent } from "@/lib/runtime/inference-proxy/events";

/**
 * toPiMessagesEvent 纯映射专测（spec §6 Phase 4）：官方 AssistantMessageEvent
 * → 官方 pi-messages wire 事件。字段搬运语义：签名/幂等字段只在 partial 块
 * 携带时透传；toolcall_start 的 id/name 只在 partial 块；上游违反
 * start 事件先行约束必须抛（不得静默造事件）。
 */

function partial(content: unknown[]): AssistantMessage {
  return { content } as AssistantMessage;
}

function usageOf(input: number, output: number): Usage {
  return {
    cacheRead: 0,
    cacheWrite: 0,
    cost: {
      cacheRead: 0,
      cacheWrite: 0,
      input: 0,
      output: 0,
      total: 0,
    },
    input,
    output,
    totalTokens: input + output,
  };
}

test("start / *_start / *_delta：原样搬运 index 与 delta，不带签名", () => {
  assert.deepEqual(toPiMessagesEvent({ partial: partial([]), type: "start" }), {
    type: "start",
  });
  assert.deepEqual(
    toPiMessagesEvent({
      contentIndex: 0,
      partial: partial([{ text: "", type: "text" }]),
      type: "text_start",
    }),
    { contentIndex: 0, type: "text_start" }
  );
  assert.deepEqual(
    toPiMessagesEvent({
      contentIndex: 0,
      delta: "你好",
      partial: partial([{ text: "你好", type: "text" }]),
      type: "text_delta",
    }),
    { contentIndex: 0, delta: "你好", type: "text_delta" }
  );
  assert.deepEqual(
    toPiMessagesEvent({
      contentIndex: 1,
      partial: partial([]),
      type: "thinking_start",
    }),
    { contentIndex: 1, type: "thinking_start" }
  );
  assert.deepEqual(
    toPiMessagesEvent({
      contentIndex: 1,
      delta: "思考",
      partial: partial([{ thinking: "思考", type: "thinking" }]),
      type: "thinking_delta",
    }),
    { contentIndex: 1, delta: "思考", type: "thinking_delta" }
  );
  assert.deepEqual(
    toPiMessagesEvent({
      contentIndex: 2,
      delta: '{"a":1}',
      partial: partial([]),
      type: "toolcall_delta",
    }),
    { contentIndex: 2, delta: '{"a":1}', type: "toolcall_delta" }
  );
});

test("text_end：content 透传；textSignature 存在才落 contentSignature", () => {
  const withoutSignature = toPiMessagesEvent({
    content: "回答全文",
    contentIndex: 0,
    partial: partial([{ text: "回答全文", type: "text" }]),
    type: "text_end",
  });
  assert.deepEqual(withoutSignature, {
    content: "回答全文",
    contentIndex: 0,
    type: "text_end",
  });
  assert.ok(!("contentSignature" in (withoutSignature ?? {})));

  const withSignature = toPiMessagesEvent({
    content: "回答全文",
    contentIndex: 0,
    partial: partial([
      { text: "回答全文", textSignature: "sig-1", type: "text" },
    ]),
    type: "text_end",
  });
  assert.deepEqual(withSignature, {
    content: "回答全文",
    contentIndex: 0,
    contentSignature: "sig-1",
    type: "text_end",
  });
});

test("thinking_end：thinkingSignature / redacted 各自独立透传", () => {
  const neither = toPiMessagesEvent({
    content: "推理全文",
    contentIndex: 0,
    partial: partial([{ thinking: "推理全文", type: "thinking" }]),
    type: "thinking_end",
  });
  assert.deepEqual(neither, {
    content: "推理全文",
    contentIndex: 0,
    type: "thinking_end",
  });

  const both = toPiMessagesEvent({
    content: "推理全文",
    contentIndex: 0,
    partial: partial([
      {
        redacted: true,
        thinking: "推理全文",
        thinkingSignature: "sig-2",
        type: "thinking",
      },
    ]),
    type: "thinking_end",
  });
  assert.deepEqual(both, {
    content: "推理全文",
    contentIndex: 0,
    contentSignature: "sig-2",
    redacted: true,
    type: "thinking_end",
  });
});

test("toolcall_start：id/name 取自 partial 的 ToolCall 块", () => {
  assert.deepEqual(
    toPiMessagesEvent({
      contentIndex: 1,
      partial: partial([
        { text: "先文本", type: "text" },
        {
          arguments: {},
          id: "tool-1",
          name: "deliver_file",
          type: "toolCall",
        },
      ]),
      type: "toolcall_start",
    }),
    {
      contentIndex: 1,
      id: "tool-1",
      toolName: "deliver_file",
      type: "toolcall_start",
    }
  );
});

test("toolcall_end：toolCall 原样透传", () => {
  const toolCall = {
    arguments: { path: "out/a.txt" },
    id: "tool-1",
    name: "deliver_file",
    type: "toolCall",
  } as const;
  assert.deepEqual(
    toPiMessagesEvent({
      contentIndex: 1,
      partial: partial([]),
      toolCall,
      type: "toolcall_end",
    }),
    { contentIndex: 1, toolCall, type: "toolcall_end" }
  );
});

test("上游违约：*_end / toolcall_start 的 partial 块缺失即抛", () => {
  assert.throws(
    () =>
      toPiMessagesEvent({
        content: "x",
        contentIndex: 3,
        partial: partial([{ text: "x", type: "text" }]),
        type: "text_end",
      }),
    /inference-proxy:upstream-violation:3/
  );
  assert.throws(
    () =>
      toPiMessagesEvent({
        contentIndex: 0,
        partial: partial([]),
        type: "toolcall_start",
      }),
    /inference-proxy:upstream-violation:0/
  );
  // partial 块存在但缺 id/name 同为违约
  assert.throws(
    () =>
      toPiMessagesEvent({
        contentIndex: 0,
        partial: partial([{ arguments: {}, type: "toolCall" }]),
        type: "toolcall_start",
      }),
    /inference-proxy:upstream-violation:toolcall_start:0/
  );
});

test("done：reason/usage 透传；responseId 与 providerThinkingLevel 仅存在时携带", () => {
  const minimal = toPiMessagesEvent({
    message: { usage: usageOf(11, 7) } as AssistantMessage,
    reason: "stop",
    type: "done",
  });
  assert.deepEqual(minimal, {
    reason: "stop",
    type: "done",
    usage: usageOf(11, 7),
  });
  assert.ok(!("responseId" in (minimal ?? {})));

  const full = toPiMessagesEvent({
    message: {
      providerThinkingLevel: "high",
      responseId: "resp-1",
      usage: usageOf(1, 2),
    } as AssistantMessage,
    reason: "toolUse",
    type: "done",
  });
  assert.deepEqual(full, {
    providerThinkingLevel: "high",
    reason: "toolUse",
    responseId: "resp-1",
    type: "done",
    usage: usageOf(1, 2),
  });
});

test("done：deferred reason 保真透传（运行时容忍口径，见 events.ts 文件头）", () => {
  assert.deepEqual(
    toPiMessagesEvent({
      message: { usage: usageOf(0, 0) } as AssistantMessage,
      reason: "deferred",
      type: "done",
    }),
    { reason: "deferred", type: "done", usage: usageOf(0, 0) }
  );
});

test("error：reason/usage/errorMessage/responseId 映射自 event.error", () => {
  const minimal = toPiMessagesEvent({
    error: { usage: usageOf(3, 0) } as AssistantMessage,
    reason: "error",
    type: "error",
  });
  assert.deepEqual(minimal, {
    reason: "error",
    type: "error",
    usage: usageOf(3, 0),
  });
  assert.ok(!("errorMessage" in (minimal ?? {})));

  assert.deepEqual(
    toPiMessagesEvent({
      error: {
        errorMessage: "Request was aborted",
        responseId: "resp-2",
        usage: usageOf(0, 0),
      } as AssistantMessage,
      reason: "aborted",
      type: "error",
    }),
    {
      errorMessage: "Request was aborted",
      reason: "aborted",
      responseId: "resp-2",
      type: "error",
      usage: usageOf(0, 0),
    }
  );
});
