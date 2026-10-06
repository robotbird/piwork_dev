/**
 * RuntimeEvent：规范化事件（v2.0 §5.3）。
 * 前端只消费 Piwork Runtime Protocol，不理解 Pi 事件；本类型是所有 backend
 * 的输出契约（Step 3 的 RPC adapter 同样归一化到这一形状）。
 */
export type RuntimeRunStatus =
  | "idle"
  | "running"
  | "failed"
  | "aborted"
  | "closed";

export type RuntimeSnapshot = {
  status: RuntimeRunStatus;
  errorMessage?: string;
};

/** 交付文件（结构等同前端 DeliveredFileData；协议内自定义，避免依赖 app 类型） */
export type RuntimeArtifact = {
  filename: string;
  contentType: string;
  url: string;
  downloadUrl?: string;
};

export type RuntimeModel = {
  provider: string;
  id: string;
  name?: string;
  responseModel?: string;
};

export type RuntimeUsage = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
};

export type RuntimeEvent =
  | { type: "run.started"; runId: string }
  /**
   * run 正常收尾。reason 区分自然完成与用户中止（Step 2）：事件流是审计与
   * 恢复的事实源，aborted 必须可从事件推导——进程内标记在重启后不可考。
   */
  | { type: "run.settled"; runId: string; reason?: "completed" | "aborted" }
  | { type: "run.failed"; runId: string; error: string }
  /** 仅 assistant 消息；序号从 1 起，驱动前端 text/reasoning part id */
  | { type: "message.started"; sequence: number }
  | {
      type: "message.delta";
      sequence: number;
      contentIndex: number;
      channel: "text" | "reasoning" | "tool";
      phase: "start" | "delta" | "end";
      delta?: string;
    }
  | {
      type: "message.completed";
      sequence: number;
      usage?: RuntimeUsage;
      model?: RuntimeModel;
    }
  | {
      type: "tool.started";
      toolCallId: string;
      toolName: string;
      args: unknown;
    }
  | {
      type: "tool.completed";
      toolCallId: string;
      toolName: string;
      isError: boolean;
    }
  /** Public source metadata only; no provider payload, query, credentials or HTML. */
  | { type: "source.created"; sourceId: string; title: string; url: string }
  | { type: "artifact.created"; file: RuntimeArtifact }
  | {
      type: "queue.changed";
      steering: readonly string[];
      followUp: readonly string[];
    }
  | { type: "command.output"; delta: string };

// runtime.health 事件留待 Step 3（需要 Worker/Sandbox 健康来源）
