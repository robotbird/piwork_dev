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

/** 脚本步：事件 + 可选播放延迟（ms，按步累加） */
export type InMemoryScriptStep = {
  delayMs?: number;
  event: RuntimeEvent;
};

export type InMemoryBackendOptions = {
  /** 每次 send(prompt) 播放的脚本步；缺省为空脚本（立即 settled） */
  onPrompt?: (
    prompt: Extract<RuntimeCommand, { type: "prompt" }>
  ) => InMemoryScriptStep[];
};

function isTerminal(
  event: RuntimeEvent
): event is
  | { type: "run.settled"; runId: string }
  | { type: "run.failed"; runId: string; error: string } {
  return event.type === "run.settled" || event.type === "run.failed";
}

/**
 * InMemoryBackend：Runtime interface 的脚本化测试替身（v2.0 §5.2），
 * 与 InProcessBackend 跑同一套契约测试。无 app 依赖、无 pi 依赖。
 */
export class InMemoryBackend implements RuntimeBackend {
  readonly sessions: InMemoryRuntimeSession[] = [];
  readonly options: InMemoryBackendOptions;

  constructor(options: InMemoryBackendOptions = {}) {
    this.options = options;
  }

  // biome-ignore lint/suspicious/useAwait: 接口契约要求返回 Promise，脚本替身无真实异步工作
  async open(_spec: RuntimeSpec): Promise<RuntimeSession> {
    const session = new InMemoryRuntimeSession(this.options);
    this.sessions.push(session);
    return session;
  }
}

export class InMemoryRuntimeSession implements RuntimeSession {
  /** 测试断言用：收到的全部命令（按序） */
  readonly commands: RuntimeCommand[] = [];
  private readonly options: InMemoryBackendOptions;
  private readonly queue = new AsyncEventQueue<RuntimeEvent>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private closed = false;
  private eventsConsumed = false;
  private aborted = false;
  private runInFlight = false;
  private currentRunId = "";
  private lastError: string | undefined;

  constructor(options: InMemoryBackendOptions) {
    this.options = options;
  }

  // biome-ignore lint/suspicious/useAwait: 接口契约要求返回 Promise，脚本替身无真实异步工作
  async send(command: RuntimeCommand): Promise<RuntimeAck> {
    if (this.closed) {
      return { error: "backend_closed", ok: false };
    }
    this.commands.push(command);
    // biome-ignore lint/style/useDefaultSwitchClause: 联合已穷尽，保留 TS 未覆盖分支检查
    switch (command.type) {
      case "prompt": {
        if (this.runInFlight) {
          return { error: "prompt_in_flight", ok: false };
        }
        this.runInFlight = true;
        this.aborted = false;
        this.lastError = undefined;
        const runId = globalThis.crypto.randomUUID();
        this.currentRunId = runId;
        this.queue.push({ runId, type: "run.started" });
        this.playScript(command, runId);
        return { ok: true };
      }
      case "abort": {
        if (!this.aborted) {
          this.aborted = true;
          for (const timer of this.timers) {
            clearTimeout(timer);
          }
          this.timers.clear();
          if (this.runInFlight) {
            // abort 吸收未完成的 run：终态恒为 settled（对齐 InProcess 语义）
            this.runInFlight = false;
            this.queue.push({
              reason: "aborted",
              runId: this.currentRunId,
              type: "run.settled",
            });
          }
        }
        return { ok: true };
      }
      case "steer":
      case "followUp": {
        return { ok: true };
      }
      case "clearQueue": {
        this.queue.push({
          followUp: [],
          steering: [],
          type: "queue.changed",
        });
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

  // biome-ignore lint/suspicious/useAwait: 接口契约要求返回 Promise，脚本替身无真实异步工作
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

  // biome-ignore lint/suspicious/useAwait: 接口契约要求返回 Promise，脚本替身无真实异步工作
  async close(_reason: string): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.queue.end();
  }

  private playScript(
    prompt: Extract<RuntimeCommand, { type: "prompt" }>,
    runId: string
  ): void {
    const steps = this.options.onPrompt?.(prompt) ?? [];
    let elapsed = 0;
    let scriptedTerminal = false;
    for (const step of steps) {
      elapsed += step.delayMs ?? 0;
      if (isTerminal(step.event)) {
        scriptedTerminal = true;
      }
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        if (this.closed || this.aborted || this.currentRunId !== runId) {
          return;
        }
        // 脚本里的终态事件可省略 runId（空串），由 backend 补当前 run
        const event =
          isTerminal(step.event) && step.event.runId === ""
            ? { ...step.event, runId }
            : step.event;
        if (event.type === "run.failed") {
          this.lastError = event.error;
        }
        if (isTerminal(event)) {
          // 终态即 run 结束：立即放行下一次 prompt，不等尾定时器
          this.runInFlight = false;
        }
        this.queue.push(event);
      }, elapsed);
      this.timers.add(timer);
    }

    // 收尾排在全部步骤之后：脚本未自带终态时补 settled（失败场景由脚本显式给 run.failed）
    const tail = setTimeout(() => {
      this.timers.delete(tail);
      if (this.closed || this.aborted || this.currentRunId !== runId) {
        return;
      }
      this.runInFlight = false;
      if (!scriptedTerminal) {
        this.queue.push({ reason: "completed", runId, type: "run.settled" });
      }
    }, elapsed + 1);
    this.timers.add(tail);
  }
}
