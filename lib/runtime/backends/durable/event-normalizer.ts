import type { AgentEvent } from "@earendil-works/pi-durable";
import type { RuntimeEvent } from "../../protocol";
import { completedModel } from "../model-identity";
import { normalizeUsage } from "../usage";

type Channel = "text" | "reasoning" | "tool";

/**
 * Pi Durable AgentEvent → RuntimeEvent 归一化。
 *
 * 与 PiEventNormalizer（pi-coding-agent 会话事件）语义对齐，供契约测试用同一
 * outline 断言。Durable 流的差异在此吸收：
 * - 块的 start 事件携带"出现时已存在的内容"，块结束没有显式事件——end 相位由
 *   本类维护 open 块状态合成：下一块 start 前先关闭上一块，message_end 关闭
 *   剩余块；start/落定时把尚未发出的文本合成为 delta（faux 等实现会整块
 *   出现 thinking，编码 agent 的 outline 仍是逐块闭合 + delta 内容完整）。
 * - `tool_execution_end` 不带 isError，从结果条目的 ToolResultMessage 推导
 *   （条目缺失即 faulted/orphaned，按错误处理）；
 * - 运行级终态由 backend 在 run_end 时读 submission 结算记录推导；
 *   run.started 由 backend 在 send 时先行入队。
 */
export class DurableEventNormalizer {
  private assistantSequence = 0;
  private activeAssistantSequence = 0;
  /** 当前 assistant 消息中尚未关闭的块：contentIndex → channel */
  private readonly openBlocks = new Map<number, Channel>();
  /** 各块已合成进 delta 的字符数；delta 事件在其后追加 */
  private readonly emittedChars = new Map<number, number>();

  /** 运行失败消息（task_failed 捕获）；backend 在 run_end 时消费 */
  failure: string | undefined;

  /** 运行是否已结束（run_end 已见）；backend 以此判定终态时机 */
  runEnded = false;

  feed(event: AgentEvent): RuntimeEvent[] {
    switch (event.type) {
      case "message_start": {
        if (event.message.role !== "assistant") {
          return [];
        }
        this.assistantSequence += 1;
        this.activeAssistantSequence = this.assistantSequence;
        this.openBlocks.clear();
        this.emittedChars.clear();
        const events: RuntimeEvent[] = [
          { sequence: this.activeAssistantSequence, type: "message.started" },
        ];
        // 顺序块语义：后一块 start 前先关闭已 open 的块（faux 等实现可能在
        // 首个部分消息里同时携带多个块，编码 agent 的 outline 仍是逐块闭合）
        for (const [contentIndex, block] of event.message.content.entries()) {
          events.push(...this.closeOpenBlocks());
          events.push(
            ...this.startBlock(block.type, contentIndex, blockText(block))
          );
        }
        return events;
      }
      case "message_update": {
        const events: RuntimeEvent[] = [];
        for (const change of event.changes) {
          // biome-ignore lint/style/useDefaultSwitchClause: Official event change union is exhaustive.
          switch (change.type) {
            case "text_start":
            case "thinking_start":
            case "toolcall_start": {
              // 顺序块：新块 start 前先关闭上一块（reasoning end 先于 text start）
              events.push(...this.closeOpenBlocks());
              events.push(
                ...this.startBlock(
                  change.block.type,
                  change.contentIndex,
                  blockText(change.block)
                )
              );
              break;
            }
            case "text_delta":
            case "thinking_delta":
            case "toolcall_delta": {
              const channel = channelOf(
                change.type === "text_delta"
                  ? "text"
                  : change.type === "thinking_delta"
                    ? "thinking"
                    : "toolcall"
              );
              this.emittedChars.set(
                change.contentIndex,
                (this.emittedChars.get(change.contentIndex) ?? 0) +
                  change.delta.length
              );
              events.push({
                channel,
                contentIndex: change.contentIndex,
                delta: change.delta,
                phase: "delta",
                sequence: this.activeAssistantSequence,
                type: "message.delta",
              });
              break;
            }
            case "block": {
              // 块整体落定：补发未发出的内容后关闭该块
              this.closeBlock(change.contentIndex, events, change.block);
              break;
            }
            case "message": {
              // 整条消息被替换：关闭全部 open 块
              events.push(...this.closeOpenBlocks());
              break;
            }
          }
        }
        return events;
      }
      case "message_end": {
        if (event.entry.model?.[0]?.role !== "assistant") {
          return [];
        }
        const events = this.closeOpenBlocks();
        const usage = normalizeUsage(event.entry.model[0].usage);
        const model = completedModel(event.entry.model[0]);
        events.push({
          sequence: this.activeAssistantSequence,
          type: "message.completed",
          ...(usage ? { usage } : {}),
          ...(model ? { model } : {}),
        });
        return events;
      }
      case "tool_execution_start": {
        return [
          {
            args: event.args,
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            type: "tool.started",
          },
        ];
      }
      case "tool_execution_end": {
        const result = event.entry?.model?.[0];
        const isError = result?.role === "toolResult" ? result.isError : true;
        return [
          {
            isError,
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            type: "tool.completed",
          },
        ];
      }
      case "task_failed": {
        this.failure = event.message;
        return [];
      }
      case "run_end": {
        this.runEnded = true;
        return [];
      }
      default:
        return [];
    }
  }

  private startBlock(
    blockType: string,
    contentIndex: number,
    initial: string
  ): RuntimeEvent[] {
    const channel = channelOf(blockType);
    this.openBlocks.set(contentIndex, channel);
    const events: RuntimeEvent[] = [
      {
        channel,
        contentIndex,
        phase: "start",
        sequence: this.activeAssistantSequence,
        type: "message.delta",
      },
    ];
    if (initial.length > 0) {
      this.emittedChars.set(contentIndex, initial.length);
      events.push({
        channel,
        contentIndex,
        delta: initial,
        phase: "delta",
        sequence: this.activeAssistantSequence,
        type: "message.delta",
      });
    } else {
      this.emittedChars.set(contentIndex, 0);
    }
    return events;
  }

  private closeBlock(
    contentIndex: number,
    events: RuntimeEvent[],
    block?: Parameters<typeof blockText>[0]
  ): void {
    const channel = this.openBlocks.get(contentIndex);
    if (channel === undefined) {
      return;
    }
    // 补发 start 之后未曾以 delta 发出的差量（整块落定的场景）
    if (block !== undefined && channel !== "tool") {
      const full = blockText(block);
      const emitted = this.emittedChars.get(contentIndex) ?? 0;
      if (full.length > emitted) {
        events.push({
          channel,
          contentIndex,
          delta: full.slice(emitted),
          phase: "delta",
          sequence: this.activeAssistantSequence,
          type: "message.delta",
        });
      }
    }
    this.openBlocks.delete(contentIndex);
    events.push({
      channel,
      contentIndex,
      phase: "end",
      sequence: this.activeAssistantSequence,
      type: "message.delta",
    });
  }

  /** 按 contentIndex 升序关闭全部 open 块 */
  private closeOpenBlocks(): RuntimeEvent[] {
    const events: RuntimeEvent[] = [];
    for (const contentIndex of [...this.openBlocks.keys()].sort(
      (a, b) => a - b
    )) {
      this.closeBlock(contentIndex, events);
    }
    return events;
  }
}

function channelOf(blockType: string): Channel {
  return blockType === "text"
    ? "text"
    : blockType === "thinking"
      ? "reasoning"
      : "tool";
}

/** 块出现/落定时已存在的可回放文本；toolcall 以 arguments JSON 呈现 */
function blockText(block: {
  type: string;
  text?: string;
  thinking?: string;
  arguments?: unknown;
}): string {
  if (block.type === "toolcall") {
    const args = (block as { arguments?: unknown }).arguments;
    return args === undefined ? "" : JSON.stringify(args);
  }
  if (block.type === "thinking") {
    return block.thinking ?? "";
  }
  return block.text ?? "";
}
