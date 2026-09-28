import "server-only";

import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { createPiworkAgentSession } from "@/lib/ai/agent-session";
import { createDeliverFileTool } from "@/lib/ai/agent-tools";
import type { StoredFile } from "@/lib/ai/file-store";
import { MANAGED_AGENT_DIR } from "@/lib/pi-packages/manager";
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
import { PiEventNormalizer } from "../pi-event-normalizer";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function newRunId(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * InProcessBackend：包装当前 createPiworkAgentSession()（v2.0 §5.2），
 * 用于开发、测试和迁移；生产目标态为 SandboxRpcBackend。
 *
 * 事件归一化承接原 chat route 内联的 pi→AI SDK 事件桥（v2.0 §5.3 映射表），
 * route 只做 RuntimeEvent → stream part 的机械翻译。
 */
export class InProcessBackend implements RuntimeBackend {
  private readonly archiveFile?: (
    chatId: string,
    file: StoredFile,
    size: number
  ) => Promise<void>;

  constructor(
    archiveFile?: (
      chatId: string,
      file: StoredFile,
      size: number
    ) => Promise<void>
  ) {
    this.archiveFile = archiveFile;
  }

  async open(spec: RuntimeSpec): Promise<RuntimeSession> {
    const queue = new AsyncEventQueue<RuntimeEvent>();
    // deliver_file 的交付闭包在此收口：onDelivered 与 pi 事件走同一队列保序
    // （onDelivered 在工具 execute 内、tool_execution_end 前同步触发）。
    // Step 4 将其替换为 Artifact Gateway 调用时只改本 backend。
    const tools = [
      ...spec.tools,
      ...(spec.workspaceDir
        ? [
            createDeliverFileTool({
              onDelivered: (file) => {
                queue.push({ file, type: "artifact.created" });
              },
              onStored: (file, size) =>
                this.archiveFile?.(spec.chatId, file, size) ??
                Promise.resolve(),
              workspaceDir: spec.workspaceDir,
            }),
          ]
        : []),
    ];

    const { dispose, session } = await createPiworkAgentSession({
      appendSystemPrompt: spec.appendSystemPrompt,
      cwd: spec.workspaceDir ?? MANAGED_AGENT_DIR,
      disableBuiltinTools: !spec.workspaceDir,
      historyMessages: spec.historyMessages,
      model: spec.model,
      systemPrompt: spec.systemPrompt,
      tools,
    });

    return new InProcessRuntimeSession(dispose, session, queue);
  }
}

class InProcessRuntimeSession implements RuntimeSession {
  private readonly queue: AsyncEventQueue<RuntimeEvent>;
  private readonly unsubscribe: () => void;
  private readonly agentSession: AgentSession;
  private readonly dispose: () => void;
  private readonly normalizer = new PiEventNormalizer();

  private closed = false;
  private eventsConsumed = false;
  private aborted = false;
  private runInFlight = false;
  private lastError: string | undefined;

  constructor(
    dispose: () => void,
    agentSession: AgentSession,
    queue: AsyncEventQueue<RuntimeEvent>
  ) {
    this.dispose = dispose;
    this.agentSession = agentSession;
    this.queue = queue;

    // subscribe 时点与原 route 一致（bindExtensions 已在 createPiworkAgentSession
    // 内完成）；队列自 open() 起缓冲，观察窗口不小于现状。
    this.unsubscribe = agentSession.subscribe((event) => {
      for (const normalized of this.normalizer.feed(event)) {
        this.queue.push(normalized);
      }
    });
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
        const runId = newRunId();
        this.queue.push({ runId, type: "run.started" });
        // 唯一 await prompt() 的位置在 backend 内；完成度由 run.* 事件表达。
        // _runAgentPrompt 的 finally 必发 agent_settled 且先于 prompt() resolve，
        // 因此终态事件必然排在所有会话事件之后（顺序安全）。
        this.agentSession
          .prompt(command.text, {
            expandPromptTemplates: command.expandPromptTemplates ?? false,
            ...(command.images ? { images: command.images } : {}),
          })
          .then(
            () => this.emitTerminal(runId),
            (error: unknown) => this.emitTerminal(runId, error)
          );
        return { ok: true };
      }
      case "abort": {
        // 终态推导忠实移植原 route 判断：errorMessage && !aborted → failed
        this.aborted = true;
        this.agentSession.abort().catch(() => undefined);
        return { ok: true };
      }
      case "steer": {
        try {
          await this.agentSession.steer(command.text, command.images);
          return { ok: true };
        } catch (error) {
          return { error: messageOf(error), ok: false };
        }
      }
      case "followUp": {
        try {
          await this.agentSession.followUp(command.text, command.images);
          return { ok: true };
        } catch (error) {
          return { error: messageOf(error), ok: false };
        }
      }
      case "clearQueue": {
        this.agentSession.clearQueue();
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

  // biome-ignore lint/suspicious/useAwait: 接口契约要求返回 Promise，同步释放无异步工作
  async close(_reason: string): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.unsubscribe();
    this.dispose();
    this.queue.end();
  }

  /**
   * 终态推导：prompt() resolve 时按 errorMessage && !aborted 分类；reject 直接
   * failed。流式事件映射见 PiEventNormalizer（与 LocalRpcBackend 共用）。
   * steer/followUp 续跑的多周期终态由 LocalRpcBackend 的 agent_settled 推导；
   * in-process 单次 prompt 场景两者等价。
   */
  private emitTerminal(runId: string, thrownError?: unknown): void {
    this.runInFlight = false;
    const errorMessage = thrownError
      ? messageOf(thrownError)
      : this.agentSession.state.errorMessage && !this.aborted
        ? this.agentSession.state.errorMessage
        : undefined;
    if (errorMessage) {
      this.lastError = errorMessage;
      this.queue.push({ error: errorMessage, runId, type: "run.failed" });
    } else {
      this.queue.push(
        this.aborted
          ? { reason: "aborted", runId, type: "run.settled" }
          : { reason: "completed", runId, type: "run.settled" }
      );
    }
  }
}
