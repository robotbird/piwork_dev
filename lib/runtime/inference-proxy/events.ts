import "server-only";

import type { AssistantMessageEvent } from "@earendil-works/pi-ai";
import type { PiMessagesEvent } from "@earendil-works/pi-ai/api/pi-messages";

/**
 * Inference Proxy 事件映射（spec §6 Phase 4）。
 *
 * 上游（控制面 Provider，如 WorkerThread host 的 HostedPiProviderAdapter）
 * 产出官方 `AssistantMessageEvent` 流；沙箱内 pi 的 `pi-messages` 客户端
 * （pi-ai `api/pi-messages.js`，官方 wire 协议：POST `{model, context,
 * options}` → SSE 序列化 assistant-message 事件）消费 `PiMessagesEvent`。
 * 两套事件按官方定义近 1:1（同名 start、text、thinking、toolcall 系列，
 * done/error 终态），本模块只做字段搬运，不改语义、不造事件。
 *
 * 依据（已装 1.0.0 源码核对）：
 * - wire 事件与错误体格式：pi-ai `dist/api/pi-messages.d.ts` / `.js`
 *   （`createEventConverter` 展示客户端如何消费各事件字段）。
 * - 上游事件协议：pi-ai `dist/types.d.ts` `AssistantMessageEvent`
 *   （`partial` 是共享的实时累计视图，终态语义见其 doc comment）。
 *
 * 边界：上游 done.reason 可能含 "deferred"（StopReason 成员，延迟工具
 * 取回），wire 文档口径收窄为 stop|length|toolUse；客户端运行时按
 * `stopReason: event.reason` 原样接收，这里保真透传，不改写成 stop。
 */

function blockAt(event: {
  contentIndex: number;
  partial: { content: unknown[] };
}): {
  content: unknown;
} {
  const block = event.partial.content[event.contentIndex];
  if (block === undefined) {
    // 上游协议保证 *_delta/_end 必须跟在同 index 的 *_start 之后
    throw new Error(
      `inference-proxy:upstream-violation:${event.contentIndex}（*_start 未先于该事件出现）`
    );
  }
  return { content: block };
}

/** 官方 AssistantMessageEvent → 官方 pi-messages wire 事件（纯函数） */
export function toPiMessagesEvent(
  event: AssistantMessageEvent
): PiMessagesEvent | null {
  // biome-ignore lint/style/useDefaultSwitchClause: 联合已穷尽，保留 TS 未覆盖分支检查
  switch (event.type) {
    case "start":
      return { type: "start" };
    case "text_start":
      return { contentIndex: event.contentIndex, type: "text_start" };
    case "text_delta":
      return {
        contentIndex: event.contentIndex,
        delta: event.delta,
        type: "text_delta",
      };
    case "text_end": {
      const { content } = blockAt(event);
      const block = content as { textSignature?: string };
      return {
        content: event.content,
        contentIndex: event.contentIndex,
        type: "text_end",
        ...(block.textSignature === undefined
          ? {}
          : { contentSignature: block.textSignature }),
      };
    }
    case "thinking_start":
      return { contentIndex: event.contentIndex, type: "thinking_start" };
    case "thinking_delta":
      return {
        contentIndex: event.contentIndex,
        delta: event.delta,
        type: "thinking_delta",
      };
    case "thinking_end": {
      const { content } = blockAt(event);
      const block = content as {
        thinkingSignature?: string;
        redacted?: boolean;
      };
      return {
        content: event.content,
        contentIndex: event.contentIndex,
        type: "thinking_end",
        ...(block.thinkingSignature === undefined
          ? {}
          : { contentSignature: block.thinkingSignature }),
        ...(block.redacted === undefined ? {} : { redacted: block.redacted }),
      };
    }
    case "toolcall_start": {
      // wire 的 toolcall_start 需要 id/toolName；上游事件本体不携带，
      // 但协议保证 start 时 partial.content[index] 已是 ToolCall 块
      const { content } = blockAt(event);
      const block = content as { id?: string; name?: string };
      if (typeof block.id !== "string" || typeof block.name !== "string") {
        throw new Error(
          `inference-proxy:upstream-violation:toolcall_start:${event.contentIndex}（partial 块缺少 id/name）`
        );
      }
      return {
        contentIndex: event.contentIndex,
        id: block.id,
        toolName: block.name,
        type: "toolcall_start",
      };
    }
    case "toolcall_delta":
      return {
        contentIndex: event.contentIndex,
        delta: event.delta,
        type: "toolcall_delta",
      };
    case "toolcall_end":
      return {
        contentIndex: event.contentIndex,
        toolCall: event.toolCall,
        type: "toolcall_end",
      };
    case "done":
      return {
        // "deferred" 透传说明见文件头
        reason: event.reason as Extract<
          PiMessagesEvent,
          { type: "done" }
        >["reason"],
        type: "done",
        usage: event.message.usage,
        ...(event.message.responseId === undefined
          ? {}
          : { responseId: event.message.responseId }),
        ...(event.message.providerThinkingLevel === undefined
          ? {}
          : { providerThinkingLevel: event.message.providerThinkingLevel }),
      };
    case "error":
      return {
        reason: event.reason,
        type: "error",
        usage: event.error.usage,
        ...(event.error.errorMessage === undefined
          ? {}
          : { errorMessage: event.error.errorMessage }),
        ...(event.error.responseId === undefined
          ? {}
          : { responseId: event.error.responseId }),
      };
  }
}
