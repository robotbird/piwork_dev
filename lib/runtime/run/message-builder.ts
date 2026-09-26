import { createHash } from "node:crypto";
import type { RuntimeArtifact, RuntimeEvent } from "../protocol";

/**
 * 确定性 assistant 消息 id：sha256(runId) hex 按 8-4-4-4-12 格式化。
 * PG uuid 列只校验 hex 形状不校验版本位；同 runId 稳定、异 runId 不同，
 * 配合 upsert 幂等实现"重复事件不重复落库"。
 */
export function deriveMessageId(runId: string): string {
  const hex = createHash("sha256").update(runId).digest("hex").slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/** 与 SDK 流式累积后落库的 part 形状一致（state 由是否见到 phase:"end" 决定） */
export type BuiltMessagePart =
  | { type: "text"; text: string; state: "done" | "streaming" }
  | { type: "reasoning"; text: string; state: "done" | "streaming" }
  | { type: "data-delivered-file"; data: RuntimeArtifact };

/**
 * RuntimeEvent 序列 → assistant 消息 parts（run 终态时落库用）。
 * 累积规则与客户端从 wire chunk 重建的结果一致：text/reasoning 按
 * (channel, sequence, contentIndex) 分组累积文本，artifact 按事件序追加；
 * tool 通道与 transient 事件不产生 part。
 */
export function buildAssistantMessageParts(
  events: Iterable<RuntimeEvent>
): BuiltMessagePart[] {
  const parts: BuiltMessagePart[] = [];
  const partIndexByKey = new Map<string, number>();

  for (const event of events) {
    if (event.type === "message.delta") {
      if (event.channel === "tool") {
        continue;
      }
      const key = `${event.channel}-${event.sequence}-${event.contentIndex}`;
      if (event.phase === "start") {
        partIndexByKey.set(key, parts.length);
        parts.push({ state: "streaming", text: "", type: event.channel });
        continue;
      }
      const index = partIndexByKey.get(key);
      if (index === undefined) {
        // 容错：缺 start 的增量/结束直接跳过（正常流不会出现）
        continue;
      }
      const part = parts[index];
      if (part.type !== "text" && part.type !== "reasoning") {
        continue;
      }
      if (event.phase === "delta") {
        part.text += event.delta ?? "";
      } else if (event.phase === "end") {
        part.state = "done";
      }
    } else if (event.type === "artifact.created") {
      parts.push({ data: event.file, type: "data-delivered-file" });
    }
  }

  return parts;
}
