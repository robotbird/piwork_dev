import "server-only";

import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { createModels, type Message } from "@earendil-works/pi-ai";
import {
  AssistantEntry,
  createRegistry,
  type Harness,
  Harness as HarnessClass,
  MemoryStorage,
  type Submission,
  type ToolRegistration,
  UserEntry,
  watchEvents,
} from "@earendil-works/pi-durable";
import { getActivePiProviders } from "@/lib/ai/pi";
import type {
  RuntimeAck,
  RuntimeBackend,
  RuntimeCommand,
  RuntimeEvent,
  RuntimeSession,
  RuntimeSnapshot,
  RuntimeSpec,
} from "../../protocol";
import { AsyncEventQueue } from "../event-queue";
import { DurableEventNormalizer } from "./event-normalizer";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function newRunId(): string {
  return globalThis.crypto.randomUUID();
}

/** piwork AgentTool → durable 工具注册；schema 同形，execute 签名适配 */
function toDurableTool(tool: AgentTool): ToolRegistration {
  return {
    description: tool.description,
    execute: async (args, api) => {
      const result = await tool.execute(api.callId, args as never);
      return {
        content: result.content,
        ...(result.details === undefined
          ? {}
          : { details: result.details as never }),
        ...(result.isError === undefined ? {} : { isError: result.isError }),
      };
    },
    name: tool.name,
    parameters: tool.parameters as never,
  };
}

/** 有损历史 → 转录条目；system/工具结果等非 user/assistant 消息不回放 */
function toHistoryEntries(messages: Message[]): {
  kind: string;
  model: Message[];
}[] {
  const entries: { kind: string; model: Message[] }[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      entries.push({ kind: UserEntry.kind, model: [message] });
    } else if (message.role === "assistant") {
      entries.push({ kind: AssistantEntry.kind, model: [message] });
    }
  }
  return entries;
}

/** watch 流回调闭包需要的会话内操作面（不暴露内部状态） */
type StreamSink = {
  consume(event: Parameters<DurableEventNormalizer["feed"]>[0]): RuntimeEvent[];
  pushEvent(event: RuntimeEvent): void;
  emitTerminal(): void;
};

/**
 * DurableBackend：以 Pi Durable Harness 承载 RuntimeSpec 的实验后端
 * （docs/pi-durable-evaluation.md §5 P2 原型）。
 *
 * 每个 open() 新建独立 Harness + MemoryStorage（会话级持久化由 RunManager
 * 的 PostgreSQL 事件/消息存储继续承担；durable 的跨重启恢复属 P3 试点范围）。
 * 模型桥复用 lib/ai/pi 的 provider 体系（测试环境即 faux 供应商）。
 * 已知差口：deliver_file 归档、执行工具沙箱边界、MCP/Skill 装配不在本原型内。
 */
export class DurableBackend implements RuntimeBackend {
  async open(spec: RuntimeSpec): Promise<RuntimeSession> {
    const models = createModels();
    for (const provider of await getActivePiProviders()) {
      models.setProvider(provider);
    }

    const registry = createRegistry();
    registry.systemPrompt.section(
      "piwork",
      () => [spec.systemPrompt, ...spec.appendSystemPrompt].join("\n\n"),
      { tag: false }
    );
    for (const tool of spec.tools) {
      registry.tools.add(toDurableTool(tool));
    }

    const harness = await HarnessClass.open(
      new MemoryStorage(),
      {
        models,
        // pi-durable 0.99.2 仍以 pi-ai 0.99.2 类型编译（1.0.0 给 TranscriptContext
        // 加的 brand 是 unique symbol 纯类型标记，无运行时足迹，行为由契约测试
        // 兜底）；待 pi-durable 发布对齐 pi-ai 1.0.0 的版本后移除此转型
        registry,
      } as never,
      BACKGROUND_CONTEXT
    );
    const conversation = await harness.root(BACKGROUND_CONTEXT);
    await conversation.setModel(
      { modelId: spec.model.id, provider: spec.model.provider },
      BACKGROUND_CONTEXT
    );

    const historyEntries = toHistoryEntries(spec.historyMessages);
    if (historyEntries.length > 0) {
      await conversation.commit(
        (tx) => {
          for (const entry of historyEntries) {
            tx.appendEntry(conversation.id, entry);
          }
        },
        BACKGROUND_CONTEXT
      );
    }

    const queue = new AsyncEventQueue<RuntimeEvent>();
    const session = new DurableRuntimeSession(harness, conversation, queue);
    // 事件流自 open() 起挂接；队列同样自 open() 起缓冲，观察窗口不小于现状
    const stream = await watchEvents(
      harness,
      conversation.id,
      BACKGROUND_CONTEXT
    );
    stream.start(async (events) => {
      for (const event of events) {
        for (const normalized of session.consume(event)) {
          session.pushEvent(normalized);
        }
        if (event.type === "run_end") {
          session.emitTerminal();
        }
      }
    });
    session.attachWatchStop(() => {
      void stream.stop().catch(() => undefined);
    });
    return session;
  }
}

class DurableRuntimeSession implements RuntimeSession, StreamSink {
  private readonly queue: AsyncEventQueue<RuntimeEvent>;
  private readonly harness: Harness;
  private readonly conversation: Awaited<
    ReturnType<Harness["root"]>
  >;
  private unsubscribeWatch: (() => void) | undefined;

  private closed = false;
  private eventsConsumed = false;
  private aborted = false;
  private runInFlight = false;
  private lastError: string | undefined;
  private terminalEmitted = false;
  private currentRunId = "";
  private currentSubmission: Submission | undefined;
  private readonly normalizer = new DurableEventNormalizer();

  constructor(
    harness: Harness,
    conversation: Awaited<ReturnType<Harness["root"]>>,
    queue: AsyncEventQueue<RuntimeEvent>
  ) {
    this.harness = harness;
    this.conversation = conversation;
    this.queue = queue;
  }

  attachWatchStop(stop: () => void): void {
    this.unsubscribeWatch = stop;
  }

  consume(event: Parameters<DurableEventNormalizer["feed"]>[0]): RuntimeEvent[] {
    return this.normalizer.feed(event);
  }

  pushEvent(event: RuntimeEvent): void {
    this.queue.push(event);
  }

  async send(command: RuntimeCommand): Promise<RuntimeAck> {
    if (this.closed) {
      return { error: "backend_closed", ok: false };
    }
    // biome-ignore lint/style/useDefaultSwitchClause: 联合已穷尽，保留 TS 未覆盖分支检查
    switch (command.type) {
      case "prompt": {
        if (this.runInFlight) {
          return { error: "prompt_in_flight", ok: false };
        }
        this.runInFlight = true;
        this.aborted = false;
        this.lastError = undefined;
        this.terminalEmitted = false;
        this.currentRunId = newRunId();
        this.queue.push({ runId: this.currentRunId, type: "run.started" });
        // 终态由 watch 流的 run_end 推导：endRun 与提交结算在同一 commit，
        // run_end 送达时当前 submission 已是终态记录，可查 reason/detail
        this.conversation
          .submit(
            {
              content: command.images
                ? [{ text: command.text, type: "text" }, ...command.images]
                : command.text,
              type: "input",
            },
            BACKGROUND_CONTEXT
          )
          .then((submission) => {
            this.currentSubmission = submission;
          })
          .catch((error: unknown) => this.failTerminal(messageOf(error)));
        return { ok: true };
      }
      case "abort": {
        this.aborted = true;
        // 不等待 idle：与 InProcess 的 abort 一致，受理即返回
        this.conversation.abort(BACKGROUND_CONTEXT).catch(() => undefined);
        return { ok: true };
      }
      case "steer": {
        try {
          await this.conversation.submit(
            {
              content: command.images
                ? [{ text: command.text, type: "text" }, ...command.images]
                : command.text,
              type: "input",
              whenBusy: "steer",
            },
            BACKGROUND_CONTEXT
          );
          return { ok: true };
        } catch (error) {
          return { error: messageOf(error), ok: false };
        }
      }
      case "followUp": {
        try {
          await this.conversation.submit(
            {
              content: command.images
                ? [{ text: command.text, type: "text" }, ...command.images]
                : command.text,
              type: "input",
            },
            BACKGROUND_CONTEXT
          );
          return { ok: true };
        } catch (error) {
          return { error: messageOf(error), ok: false };
        }
      }
      case "clearQueue": {
        // 原型差异：durable 的收件箱按 submission 逐条撤回（submission.abort），
        // 无批量清空 API；空闲态 no-op 语义与契约一致
        return { ok: true };
      }
    }
  }

  events(cursor?: string): AsyncIterable<RuntimeEvent> {
    if (cursor) {
      throw new Error("runtime:cursor:unsupported（Step 2 引入持久游标）");
    }
    if (this.eventsConsumed) {
      throw new Error("runtime:events:single-consumer");
    }
    this.eventsConsumed = true;
    return this.queue.iterate();
  }

  // biome-ignore lint/suspicious/useAwait: 接口契约要求返回 Promise，同步派生无异步工作
  async snapshot(): Promise<RuntimeSnapshot> {
    if (this.closed) {
      return { status: "closed" };
    }
    if (this.runInFlight) {
      return { status: "running" };
    }
    if (this.aborted) {
      return { status: "aborted" };
    }
    if (this.lastError) {
      return { errorMessage: this.lastError, status: "failed" };
    }
    return { status: "idle" };
  }

  async close(_reason: string): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.unsubscribeWatch?.();
    await this.harness.close(BACKGROUND_CONTEXT).catch(() => undefined);
    this.queue.end();
  }

  /**
   * 终态推导（流内单点）：aborted → settled(aborted)；否则读当前 submission
   * 的终态记录——unanswered 取 detail ?? reason 为错误（如 model_error 的
   * boom），done 为 completed。endRun 与结算同 commit，此处读到的是终值。
   * terminalEmitted 保证 run.failed 与 run.settled 互斥且仅一发。
   */
  async emitTerminal(): Promise<void> {
    if (this.terminalEmitted) {
      return;
    }
    this.terminalEmitted = true;
    this.runInFlight = false;
    const runId = this.currentRunId;
    const failure = this.normalizer.failure;
    if (!failure && !this.aborted && this.currentSubmission !== undefined) {
      const record = await this.currentSubmission
        .status(BACKGROUND_CONTEXT)
        .catch(() => undefined);
      if (record?.type === "input" && record.status === "unanswered") {
        const detail = record.detail;
        this.lastError =
          (typeof detail === "string" ? detail : undefined) ?? record.reason;
        this.queue.push({
          error: this.lastError,
          runId,
          type: "run.failed",
        });
        return;
      }
      if (record === undefined) {
        this.queue.push({ error: "submission_lost", runId, type: "run.failed" });
        return;
      }
    }
    if (failure) {
      this.lastError = failure;
      this.queue.push({ error: failure, runId, type: "run.failed" });
      return;
    }
    this.queue.push(
      this.aborted
        ? { reason: "aborted", runId, type: "run.settled" }
        : { reason: "completed", runId, type: "run.settled" }
    );
  }

  /** submit 受理失败的兜底终态（正常路径不会走到） */
  private failTerminal(error: string): void {
    if (this.terminalEmitted) {
      return;
    }
    this.terminalEmitted = true;
    this.runInFlight = false;
    this.lastError = error;
    this.queue.push({
      error,
      runId: this.currentRunId,
      type: "run.failed",
    });
  }
}
