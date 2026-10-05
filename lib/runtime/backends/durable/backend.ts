import "server-only";

import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { overlap } from "@earendil-works/chord/delta";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { createModels, type Message } from "@earendil-works/pi-ai";
import {
  AssistantEntry,
  createRegistry,
  defineExtension,
  type Harness,
  Harness as HarnessClass,
  MemoryStorage,
  type Submission,
  section,
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
import { assertDurableRecoverySafe } from "./recovery";
import type { OwnedDurableStorage } from "./storage";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function newRunId(): string {
  return globalThis.crypto.randomUUID();
}

/** piwork AgentTool → durable 工具注册；schema 同形，execute 签名适配 */
function toDurableTool(
  tool: AgentTool,
  authorize?: () => Promise<void>,
  onFailure?: (error: unknown) => void
): ToolRegistration {
  return {
    description: tool.description,
    execute: async (args, api, context) => {
      let previousOutput = "";
      try {
        await authorize?.();
        const result = await tool.execute(
          api.callId,
          args,
          context.abortSignal,
          (update) => {
            const text = update.content
              .filter((block) => block.type === "text")
              .map((block) => block.text)
              .join("");
            const shared = text.startsWith(previousOutput)
              ? previousOutput.length
              : overlap(previousOutput, text, 65_536);
            api.output(text.slice(shared));
            previousOutput = text;
          }
        );
        if (result.isError) {
          onFailure?.(new Error("runtime:durable:tool-reported-failure"));
        }
        return {
          content: result.content,
          ...(result.details === undefined ? {} : { details: result.details }),
          ...(result.isError === undefined ? {} : { isError: result.isError }),
        };
      } catch (error) {
        onFailure?.(error);
        throw error;
      }
    },
    name: tool.name,
    parameters: tool.parameters,
    replay: "unsafe",
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
  consume: (
    event: Parameters<DurableEventNormalizer["feed"]>[0]
  ) => RuntimeEvent[];
  pushEvent: (event: RuntimeEvent) => void;
  emitTerminal: () => Promise<void>;
};

/**
 * DurableBackend：以 Pi Durable Harness 承载 RuntimeSpec 的实验后端
 * （docs/pi-durable-evaluation.md §5 P2 原型）。
 *
 * 默认仅开发 MemoryStorage；可注入单写者 SQLite + 当前授权，恢复前阻断
 * 未决工具。生产禁用 MemoryStorage，正式 Worker/映射/投影接线尚未完成。
 * 模型桥复用 lib/ai/pi 的 provider 体系（测试环境即 faux 供应商）。
 * 已知差口：deliver_file 归档、执行工具沙箱边界、MCP/Skill 装配不在本原型内。
 */
export type DurableExecution = {
  tools: AgentTool[];
  /** Idempotent stop + termination verification, before terminal/owner release. */
  close: () => Promise<void>;
};

export type DurableBackendOptions = {
  storageFactory?: (spec: RuntimeSpec) => Promise<OwnedDurableStorage>;
  /** Platform current identity/grants, before open AND each execute; not only beforeTool. */
  authorize?: (spec: RuntimeSpec) => Promise<void>;
  /** Trusted execution adapter; requires owned storage and authorization.
   * Called after recovery inspection, before submit/wait/resume.
   * Managed execution is single-run (no steer/follow-up/second prompt).
   */
  executionFactory?: (
    spec: RuntimeSpec,
    context: {
      harness: Harness;
      conversation: Awaited<ReturnType<Harness["root"]>>;
      emit: (event: RuntimeEvent) => void;
    }
  ) => Promise<DurableExecution>;
};

export class DurableBackend implements RuntimeBackend {
  private readonly options: DurableBackendOptions;
  constructor(options: DurableBackendOptions = {}) {
    this.options = options;
  }

  async open(spec: RuntimeSpec): Promise<RuntimeSession> {
    if (
      this.options.executionFactory &&
      (!this.options.storageFactory || !this.options.authorize || !spec.runId)
    ) {
      throw new Error("runtime:durable:managed-execution-requires-owned-run");
    }
    if (this.options.storageFactory && !this.options.authorize) {
      throw new Error("runtime:durable:missing-authorization");
    }
    if (process.env.NODE_ENV === "production" && !this.options.storageFactory) {
      throw new Error("runtime:durable:memory-storage-forbidden-in-production");
    }
    const { authorize } = this.options;
    await authorize?.(spec);
    if (
      this.options.storageFactory &&
      spec.workspaceDir !== null &&
      !this.options.executionFactory
    ) {
      throw new Error("runtime:durable:sandbox-execution-not-integrated");
    }
    const owned = await this.options.storageFactory?.(spec);
    let harness: Harness | undefined;
    let execution: DurableExecution | undefined;
    const queue = new AsyncEventQueue<RuntimeEvent>();
    let toolFailure: string | undefined;
    let abortRun: (() => Promise<void>) | undefined;
    const onFailure = (error: unknown) => {
      toolFailure ??= messageOf(error);
      // Never await an abort from the tool it has to join.
      abortRun?.().catch(() => undefined);
    };
    try {
      const models = createModels();
      for (const provider of await getActivePiProviders()) {
        models.setProvider(provider);
      }

      const registry = createRegistry();
      // No NodeExecutionEnv, CodingTools, extensions or MCP are installed.
      harness = await HarnessClass.open(
        owned?.storage ?? new MemoryStorage(),
        {
          models,
          registry,
          settings: { toolExecution: "sequential" },
        },
        BACKGROUND_CONTEXT
      );
      if (owned) {
        await assertDurableRecoverySafe(harness);
      }
      const conversation = await harness.root(BACKGROUND_CONTEXT);
      abortRun = () => conversation.abort(BACKGROUND_CONTEXT);
      execution = await this.options.executionFactory?.(spec, {
        conversation,
        emit: (event) => queue.push(event),
        harness,
      });
      registry.install(
        defineExtension({
          name: "piwork",
          sections: [
            section(
              "piwork",
              () =>
                [spec.systemPrompt, ...spec.appendSystemPrompt].join("\n\n"),
              { tag: false }
            ),
          ],
          tools: (execution?.tools ?? spec.tools).map((tool) =>
            toDurableTool(
              tool,
              authorize ? () => authorize(spec) : undefined,
              owned ? onFailure : undefined
            )
          ),
        })
      );

      await conversation.configure(
        { model: { modelId: spec.model.id, provider: spec.model.provider } },
        BACKGROUND_CONTEXT
      );

      const historyEntries = toHistoryEntries(spec.historyMessages);
      const initialContext = await conversation.context(BACKGROUND_CONTEXT);
      if (initialContext.entries.length === 0 && historyEntries.length > 0) {
        await conversation.commit(async (tx) => {
          for (const entry of historyEntries) {
            // biome-ignore lint/performance/noAwaitInLoops: append history in transcript order before Tx seals
            await tx.appendEntry(conversation.id, entry);
          }
        }, BACKGROUND_CONTEXT);
      }

      const session = new DurableRuntimeSession(
        harness,
        conversation,
        queue,
        owned,
        () => toolFailure,
        execution,
        spec.runId
      );
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
            // biome-ignore lint/performance/noAwaitInLoops: preserve committed event/terminal order
            await session.emitTerminal();
          }
        }
      });
      session.attachWatchStop(async () => {
        await stream.stop();
      });
      return session;
    } catch (error) {
      try {
        // Retain ownership when sandbox termination is unconfirmed.
        await execution?.close();
        await harness?.close(BACKGROUND_CONTEXT);
        await owned?.close();
      } catch (cleanup) {
        // biome-ignore lint/style/useErrorCause: both original and cleanup causes are preserved in AggregateError
        throw new AggregateError(
          [error, cleanup],
          "runtime:durable:open-cleanup-failed",
          { cause: error }
        );
      }
      throw error;
    }
  }
}

class DurableRuntimeSession implements RuntimeSession, StreamSink {
  private readonly queue: AsyncEventQueue<RuntimeEvent>;
  private readonly harness: Harness;
  private readonly conversation: Awaited<ReturnType<Harness["root"]>>;
  private unsubscribeWatch: (() => Promise<void>) | undefined;
  private closing: Promise<void> | undefined;
  private readonly owned?: OwnedDurableStorage;
  private readonly readToolFailure?: () => string | undefined;
  private readonly execution?: DurableExecution;
  private readonly platformRunId?: string;
  private prompted = false;

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
    queue: AsyncEventQueue<RuntimeEvent>,
    owned?: OwnedDurableStorage,
    readToolFailure?: () => string | undefined,
    execution?: DurableExecution,
    platformRunId?: string
  ) {
    this.execution = execution;
    this.platformRunId = platformRunId;
    this.readToolFailure = readToolFailure;
    this.owned = owned;
    this.harness = harness;
    this.conversation = conversation;
    this.queue = queue;
  }

  attachWatchStop(stop: () => Promise<void>): void {
    this.unsubscribeWatch = stop;
  }

  consume(
    event: Parameters<DurableEventNormalizer["feed"]>[0]
  ): RuntimeEvent[] {
    return this.normalizer.feed(event);
  }

  pushEvent(event: RuntimeEvent): void {
    this.queue.push(event);
  }

  async send(command: RuntimeCommand): Promise<RuntimeAck> {
    if (this.closed) {
      return { error: "backend_closed", ok: false };
    }
    if (
      this.execution &&
      (command.type === "steer" ||
        command.type === "followUp" ||
        (command.type === "prompt" && this.prompted))
    ) {
      return { error: "managed_execution_single_run", ok: false };
    }
    // biome-ignore lint/style/useDefaultSwitchClause: 联合已穷尽，保留 TS 未覆盖分支检查
    switch (command.type) {
      case "prompt": {
        if (this.runInFlight) {
          return { error: "prompt_in_flight", ok: false };
        }
        this.prompted = true;
        this.runInFlight = true;
        this.aborted = false;
        this.lastError = undefined;
        this.terminalEmitted = false;
        this.currentRunId = this.platformRunId ?? newRunId();
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
              ...(this.execution
                ? { requestId: `${this.currentRunId}:prompt` }
                : {}),
            },
            BACKGROUND_CONTEXT
          )
          .then((submission) => {
            this.currentSubmission = submission;
          })
          .catch(async (error: unknown) => {
            await this.stopExecution();
            this.failTerminal(this.lastError ?? messageOf(error));
          });
        return { ok: true };
      }
      case "abort": {
        this.aborted = true;
        // 不等待 idle：与 InProcess 的 abort 一致，受理即返回
        this.conversation.abort(BACKGROUND_CONTEXT).catch(() => undefined);
        await this.stopExecution();
        return this.lastError
          ? { error: this.lastError, ok: false }
          : { ok: true };
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

  close(_reason: string): Promise<void> {
    this.closed = true;
    this.closing ??= (async () => {
      try {
        let executionError: unknown;
        try {
          await this.execution?.close();
        } catch (error) {
          executionError = error;
        }
        // Stop the scheduler/watch even when sandbox cleanup fails, but never
        // release the storage owner marker in that uncertain state.
        await this.unsubscribeWatch?.();
        await this.harness.close(BACKGROUND_CONTEXT);
        if (executionError) {
          throw executionError;
        }
        await this.owned?.close();
      } finally {
        this.queue.end();
      }
    })();
    this.closing.catch(() => undefined);
    return this.closing;
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
    await this.stopExecution();
    const failure =
      this.lastError ?? this.readToolFailure?.() ?? this.normalizer.failure;
    if (!failure && !this.aborted && this.currentSubmission !== undefined) {
      const record = await this.currentSubmission
        .status(BACKGROUND_CONTEXT)
        .catch(() => undefined);
      if (record?.type === "input" && record.status === "unanswered") {
        const { detail } = record;
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
        this.queue.push({
          error: "submission_lost",
          runId,
          type: "run.failed",
        });
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

  private async stopExecution(): Promise<void> {
    try {
      await this.execution?.close();
    } catch (error) {
      this.lastError ??= messageOf(error);
    }
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
