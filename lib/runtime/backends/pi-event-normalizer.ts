import type {
  AgentSessionEvent,
  JsonAgentSessionEvent,
} from "@earendil-works/pi-coding-agent";
import { searchSources } from "../../search/protocol";
import type { RuntimeEvent } from "../protocol";
import { completedModel } from "./model-identity";
import { normalizeUsage } from "./usage";

/**
 * Pi 会话事件 → RuntimeEvent 归一化（v2.0 §5.3 映射表）。
 * InProcessBackend（进程内 AgentSessionEvent）与 LocalRpcBackend（RPC wire 的
 * JsonAgentSessionEvent——同形状、去 partial/累计快照、toolcall_start 上提
 * id/toolName）共用同一实现，保证两个 backend 的流式事件映射永不漂移。
 *
 * 已接受的微差异：message_update 的总 done/error 事件被丢弃——零内容块
 * 消息（立即 done/error）不再触发前端的“模型活跃”标记；route 的 finally
 * stopWaitingStatus() 兜底关闭等待 UI。
 */
export class PiEventNormalizer {
  private assistantSequence = 0;
  private activeAssistantSequence = 0;

  /**
   * 归一化单个 pi 事件。不产出 RuntimeEvent 的输入（非 assistant 消息、
   * message_update 的裸 start/done/error、agent_start/agent_end 等运行级
   * 事件）返回空数组——运行级终态由各 backend 自行推导（InProcess 用
   * prompt resolve，LocalRpc 用 agent_settled）。
   */
  feed(event: AgentSessionEvent | JsonAgentSessionEvent): RuntimeEvent[] {
    switch (event.type) {
      case "message_start": {
        // message_start 对用户消息同样触发，assistant 过滤是原 route 的承重逻辑
        if (event.message.role !== "assistant") {
          return [];
        }
        this.assistantSequence += 1;
        this.activeAssistantSequence = this.assistantSequence;
        return [
          { sequence: this.activeAssistantSequence, type: "message.started" },
        ];
      }
      case "message_update": {
        const update = event.assistantMessageEvent;
        let channel: "text" | "reasoning" | "tool";
        let phase: "start" | "delta" | "end";
        let delta: string | undefined;
        // biome-ignore lint/style/useDefaultSwitchClause: 联合已穷尽，保留 TS 未覆盖分支检查
        switch (update.type) {
          case "start":
          case "done":
          case "error":
            return [];
          case "text_start":
            channel = "text";
            phase = "start";
            break;
          case "text_delta":
            channel = "text";
            phase = "delta";
            ({ delta } = update);
            break;
          case "text_end":
            channel = "text";
            phase = "end";
            break;
          case "thinking_start":
            channel = "reasoning";
            phase = "start";
            break;
          case "thinking_delta":
            channel = "reasoning";
            phase = "delta";
            ({ delta } = update);
            break;
          case "thinking_end":
            channel = "reasoning";
            phase = "end";
            break;
          case "toolcall_start":
            channel = "tool";
            phase = "start";
            break;
          case "toolcall_delta":
            channel = "tool";
            phase = "delta";
            ({ delta } = update);
            break;
          case "toolcall_end":
            channel = "tool";
            phase = "end";
            break;
        }
        return [
          {
            channel,
            contentIndex: update.contentIndex,
            ...(delta === undefined ? {} : { delta }),
            phase,
            sequence: this.activeAssistantSequence,
            type: "message.delta",
          },
        ];
      }
      case "message_end": {
        if (event.message.role !== "assistant") {
          return [];
        }
        const usage = normalizeUsage(event.message.usage);
        const model = completedModel(event.message);
        return [
          {
            sequence: this.activeAssistantSequence,
            type: "message.completed",
            ...(usage ? { usage } : {}),
            ...(model ? { model } : {}),
          },
        ];
      }
      case "tool_execution_start":
        return [
          {
            args: event.args,
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            type: "tool.started",
          },
        ];
      case "tool_execution_end":
        return [
          {
            isError: event.isError,
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            type: "tool.completed",
          },
          ...(event.isError
            ? []
            : searchSources(event.toolName, event.result).map(
                (source, index): RuntimeEvent => ({
                  sourceId: `${event.toolCallId}-source-${index}`,
                  title: source.title,
                  type: "source.created",
                  url: source.url,
                })
              )),
        ];
      case "queue_update":
        return [
          {
            followUp: event.followUp,
            steering: event.steering,
            type: "queue.changed",
          },
        ];
      case "bash_execution_update":
        return [{ delta: event.delta, type: "command.output" }];
      default:
        return [];
    }
  }
}
