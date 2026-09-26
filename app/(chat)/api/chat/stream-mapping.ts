import type { UIMessageChunk } from "ai";
import { formatToolStatus } from "@/lib/ai/agent-tools";
import type { RuntimeEvent } from "@/lib/runtime/protocol";
import type { CustomUIDataTypes, MessageMetadata } from "@/lib/types";

export type ChatStreamChunk = UIMessageChunk<
  MessageMetadata,
  CustomUIDataTypes
>;

/**
 * RuntimeEvent → AI SDK stream chunk 的纯翻译（route 内联事件桥的接替者）。
 * wire 格式与重构前逐字节一致：part id 规则 `text-<seq>-<ci>` /
 * `reasoning-<seq>-<ci>`、transient 标记、data 部件形状均照抄原实现。
 * tool 通道的 delta 只驱动上层"模型活跃"标记，不产出 wire chunk。
 */
export function runtimeEventToUIMessageChunks(
  event: RuntimeEvent
): ChatStreamChunk[] {
  if (event.type === "message.delta") {
    if (event.channel === "tool") {
      return [];
    }
    const id = `${event.channel === "reasoning" ? "reasoning" : "text"}-${event.sequence}-${event.contentIndex}`;
    if (event.channel === "text") {
      if (event.phase === "start") {
        return [{ id, type: "text-start" }];
      }
      if (event.phase === "delta") {
        return [{ delta: event.delta ?? "", id, type: "text-delta" }];
      }
      return [{ id, type: "text-end" }];
    }
    if (event.phase === "start") {
      return [{ id, type: "reasoning-start" }];
    }
    if (event.phase === "delta") {
      return [{ delta: event.delta ?? "", id, type: "reasoning-delta" }];
    }
    return [{ id, type: "reasoning-end" }];
  }

  if (event.type === "tool.started") {
    return [
      {
        data: {
          message: formatToolStatus("start", event.toolName, event.args),
          phase: "start",
          toolName: event.toolName,
        },
        transient: true,
        type: "data-tool-status",
      },
    ];
  }

  if (event.type === "tool.completed") {
    return [
      {
        data: {
          ...(event.isError ? { isError: true } : {}),
          message: formatToolStatus(
            "end",
            event.toolName,
            undefined,
            event.isError
          ),
          phase: "end",
          toolName: event.toolName,
        },
        transient: true,
        type: "data-tool-status",
      },
    ];
  }

  if (event.type === "artifact.created") {
    // 非 transient 且无 id：SDK 将其追加进消息 parts，随 onEnd 持久化
    return [{ data: event.file, type: "data-delivered-file" }];
  }

  // 其余事件（run.*/message.started/message.completed/queue.changed/
  // command.output）不产出 wire chunk，由 route 按类型另行处理
  return [];
}
