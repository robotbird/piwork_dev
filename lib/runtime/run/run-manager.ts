import { ChatbotError } from "@/lib/errors";
import { AsyncEventQueue } from "../backends/event-queue";
import type {
  RuntimeBackend,
  RuntimeBackendKind,
  RuntimeCommand,
  RuntimeEvent,
  RuntimeSession,
  RuntimeSpec,
} from "../protocol";
import type { RuntimeModel } from "../protocol/events";
import { type LoggedRuntimeEvent, RunEventLog } from "./event-log";
import {
  type EventStore,
  isPersistedRuntimeEvent,
  runtimeEventData,
} from "./event-store";
import { buildAssistantMessageParts, deriveMessageId } from "./message-builder";

/** AgentRun 状态机状态（与 DB varchar enum 对齐；waiting_user 留待 Step 3+ 启用） */
export type AgentRunStatus =
  | "queued"
  | "starting"
  | "running"
  | "waiting_user"
  | "settled"
  | "failed"
  | "aborted";

/** run 终态结果（订阅方 settled promise 与状态机的交集） */
export type SettleOutcome = "settled" | "failed" | "aborted";

const NON_TERMINAL_STATUSES: readonly AgentRunStatus[] = [
  "queued",
  "starting",
  "running",
  "waiting_user",
];

const HEARTBEAT_INTERVAL_MS = 15_000;
/** 心跳间隔 × 2：错过两次心跳判定 stale（多进程语义，Step 8 生效） */
const STALE_HEARTBEAT_MS = 30_000;
/** 终态后 LiveRun/日志保留窗口：迟到 resume 可收尾（§2.5 边界表） */
const TERMINAL_TTL_MS = 60_000;

/** AgentRun + RuntimeLease 持久化端口（Postgres 实现见 lib/db/agent-run-queries.ts） */
export interface AgentRunStore {
  acquireLease: (runId: string, workerId: string) => Promise<boolean>;
  createAgentRun: (input: {
    backend: RuntimeBackendKind;
    chatId: string;
    userId: string;
    requestedModel?: RuntimeModel;
  }) => Promise<string>;
  /**
   * 非终态、无 lease 且不在 exclude（本进程启动中 + LiveRun）→ failed。
   * 已有 lease 的未知 run 只由心跳过期路径处理，不能误杀其他存活管理器。
   */
  failOrphanedRuns: (excludeRunIds: readonly string[]) => Promise<number>;
  /** 心跳超时且非终态 → failed（多进程 zombie；返回命中数） */
  failStaleRuns: (heartbeatTimeoutMs: number) => Promise<number>;
  /** 非终态且心跳存活的 run（createdAt 倒序第一条）；无则 null */
  getActiveRunByChatId: (chatId: string) => Promise<{ runId: string } | null>;
  /** 条件更新：当前状态不在 allowedFrom 内则不生效，返回是否更新 */
  markRunStatus: (
    runId: string,
    status: AgentRunStatus,
    options?: {
      allowedFrom?: readonly AgentRunStatus[];
      errorMessage?: string;
    }
  ) => Promise<boolean>;
  releaseLease: (runId: string) => Promise<void>;
  renewLeases: (workerId: string, runIds: readonly string[]) => Promise<void>;
}

/** assistant 消息幂等落库端口（Postgres 实现见 lib/db/queries.ts upsertMessage） */
export interface AssistantMessageStore {
  upsertAssistantMessage: (input: {
    chatId: string;
    id: string;
    parts: unknown[];
  }) => Promise<void>;
}

export type RunStartInput = {
  spec: RuntimeSpec;
  prompt: Extract<RuntimeCommand, { type: "prompt" }>;
  userId: string;
  /** 审批续跑：沿用既有 assistant 消息 id（等价现状 updateMessage 语义） */
  baseAssistantMessageId?: string;
  /** 审批续跑：DB parts + 审批状态覆盖；终态 upsert 时前置合并 */
  baseParts?: readonly unknown[];
};

export type RunSubscription = {
  /** 订阅的 run（cursor part 回显用） */
  runId: string;
  /** 终态落库的 assistant 消息 id（start chunk 用，与 DB 一致） */
  messageId: string;
  /** 日志重放 + 活流 tail（终态条目后迭代自然结束） */
  events: AsyncIterable<LoggedRuntimeEvent>;
  settled: Promise<"settled" | "failed" | "aborted">;
  /** 请求断开时调用：仅移除本地订阅，run 不受影响（§2.1-3） */
  close: () => void;
};

export type RunHandle = {
  runId: string;
  attach: (options?: {
    cursor?: number;
    runId?: string;
  }) => RunSubscription | null;
};

type Subscriber = {
  queue: AsyncEventQueue<LoggedRuntimeEvent>;
};

type LiveRun = {
  runId: string;
  chatId: string;
  session: RuntimeSession;
  log: RunEventLog;
  subscribers: Set<Subscriber>;
  /** 持久事件 seq 计数器（per-run 从 1 单调） */
  seq: number;
  baseAssistantMessageId?: string;
  baseParts?: readonly unknown[];
  terminal: LoggedRuntimeEvent | null;
  settled: Promise<"settled" | "failed" | "aborted">;
  settledResolve: (outcome: "settled" | "failed" | "aborted") => void;
};

export type RunManagerOptions = {
  backend: RuntimeBackend;
  /**
   * AgentRun.backend 落库值（in_process 默认；sandbox 装配传 sandbox_rpc，
   * 见 lib/runtime/run/index.ts）。与 backend 实例分开声明：RunManager 不
   * 反射 backend 类型。与 backendKindFor 二选一：路由矩阵装配用后者逐
   * run 记录实际执行位（requiresSandbox）。
   */
  backendKind?: RuntimeBackendKind;
  /** 逐 run 解析 AgentRun.backend（v2.0 §8.1 路由矩阵；与 backendKind 互斥，优先） */
  backendKindFor?: (spec: RuntimeSpec) => RuntimeBackendKind;
  eventStore: EventStore;
  runStore: AgentRunStore;
  messageStore: AssistantMessageStore;
  /** 进程实例 id（模块级 randomUUID，见 lib/runtime/run/index.ts） */
  workerId: string;
  heartbeatIntervalMs?: number;
  staleHeartbeatMs?: number;
  terminalTtlMs?: number;
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * RunManager（v2.0 §8.2）：backend 事件的唯一消费者。
 * 职责：seq 分配（仅持久事件）、先落库再广播、内存全量日志、多订阅者广播、
 * AgentRun 状态机、终态一次性 upsert 消息（确定性 id 幂等）、lease 心跳。
 * run 生命周期独立于 HTTP 请求：订阅断开只 detach，Stop 走 abortByChat。
 */
export class RunManager {
  private readonly liveByRun = new Map<string, LiveRun>();
  private readonly liveByChat = new Map<string, LiveRun>();
  private readonly startingByRun = new Map<string, string>();
  private readonly startingChats = new Set<string>();
  /** Serialize DB creation/lease publication with cleanup, not backend.open or tools. */
  private lifecycleTail: Promise<void> = Promise.resolve();
  private readonly heartbeat: ReturnType<typeof setInterval>;
  private readonly options: RunManagerOptions;

  constructor(options: RunManagerOptions) {
    this.options = options;
    this.heartbeat = setInterval(
      () => this.tickHeartbeat().catch(() => undefined),
      options.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS
    );
    // 不阻止进程退出（dev server 停止 / 测试结束）
    this.heartbeat.unref();
  }

  /** 进程内查询：是否存在未终态 run（POST 冲突检测） */
  getActiveRun(chatId: string): { runId: string } | null {
    const live = this.liveByChat.get(chatId);
    if (live && !live.terminal) {
      return { runId: live.runId };
    }
    for (const [runId, startingChatId] of this.startingByRun) {
      if (startingChatId === chatId) {
        return { runId };
      }
    }
    return null;
  }

  /** AgentRun.backend 落库值：路由矩阵装配逐 run 解析，否则固定声明值 */
  private resolveBackendKind(spec: RuntimeSpec): RuntimeBackendKind {
    return this.options.backendKindFor
      ? this.options.backendKindFor(spec)
      : (this.options.backendKind ?? "in_process");
  }

  /**
   * 惰性僵尸清理：先按心跳过期（多进程语义），再按"非终态且不在本进程
   * 启动中或 LiveRun"（无 lease 的孤儿立即收敛，有 lease 需心跳过期）。
   */
  async failZombieRuns(): Promise<void> {
    await this.withLifecycle(() => this.cleanupZombieRuns());
  }

  private async withLifecycle<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.lifecycleTail;
    let release!: () => void;
    this.lifecycleTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private async cleanupZombieRuns(): Promise<void> {
    try {
      await this.options.runStore.failStaleRuns(
        this.options.staleHeartbeatMs ?? STALE_HEARTBEAT_MS
      );
      await this.options.runStore.failOrphanedRuns([
        ...this.startingByRun.keys(),
        ...this.liveByRun.keys(),
      ]);
    } catch (error) {
      console.error("[run-manager] failZombieRuns failed", {
        error: messageOf(error),
      });
    }
  }

  async start(input: RunStartInput): Promise<RunHandle> {
    const { chatId } = input.spec;
    // Reserve synchronously, before cleanup/getActive/create can yield.
    if (this.startingChats.has(chatId) || this.getActiveRun(chatId)) {
      throw new ChatbotError("conflict:chat");
    }
    this.startingChats.add(chatId);
    let runId: string | undefined;
    try {
      runId = await this.withLifecycle(async () => {
        await this.cleanupZombieRuns();
        if (await this.options.runStore.getActiveRunByChatId(chatId)) {
          throw new ChatbotError("conflict:chat");
        }
        const created = await this.options.runStore.createAgentRun({
          backend: this.resolveBackendKind(input.spec),
          chatId,
          requestedModel: {
            id: input.spec.model.id,
            name: input.spec.model.name,
            provider: input.spec.model.provider,
          },
          userId: input.userId,
        });
        this.startingByRun.set(created, chatId);
        let leased = false;
        try {
          leased = await this.options.runStore.acquireLease(
            created,
            this.options.workerId
          );
          if (!leased) {
            throw new ChatbotError("conflict:chat", "lease acquire conflict");
          }
          if (
            !(await this.options.runStore.markRunStatus(created, "starting", {
              allowedFrom: ["queued"],
            }))
          ) {
            throw new Error("runtime:startup:run-ownership-lost");
          }
          return created;
        } catch (error) {
          await this.options.runStore
            .markRunStatus(created, "failed", {
              allowedFrom: NON_TERMINAL_STATUSES,
              errorMessage: messageOf(error),
            })
            .catch(() => undefined);
          if (leased) {
            await this.options.runStore
              .releaseLease(created)
              .catch(() => undefined);
          }
          this.startingByRun.delete(created);
          throw error;
        }
      });
      let session: RuntimeSession;
      try {
        session = await this.options.backend.open({ ...input.spec, runId });
      } catch (error) {
        await this.options.runStore
          .markRunStatus(runId, "failed", {
            allowedFrom: NON_TERMINAL_STATUSES,
            errorMessage: messageOf(error),
          })
          .catch(() => undefined);
        await this.options.runStore.releaseLease(runId).catch(() => undefined);
        throw error;
      }
      const live = createLiveRun({ chatId, input, runId, session });
      // Atomic handoff: cleanup always sees either starting or live ownership.
      this.liveByRun.set(runId, live);
      this.liveByChat.set(chatId, live);
      this.startingByRun.delete(runId);
      this.consume(live).catch(() => undefined);
      const ack = await session.send(input.prompt);
      if (!ack.ok) {
        await this.discardFailedStart(live, ack.error ?? "unknown error");
        throw new ChatbotError(
          "bad_request:chat",
          `runtime rejected prompt: ${ack.error ?? "unknown error"}`
        );
      }
      return {
        attach: (attachOptions) => this.attach(chatId, attachOptions),
        runId,
      };
    } finally {
      this.startingChats.delete(chatId);
      if (runId) {
        this.startingByRun.delete(runId);
      }
    }
  }

  /**
   * 订阅 chat 的活跃 run。同步方法：入集合 + 快照在同一同步块完成（§2.5
   * attach 原子性——Node 单线程不与消费循环交错），不丢不重。
   * cursor 语义：seq > cursor 的持久事件 + 其后的全部事件；runId 不符或
   * cursor 非法（负/超 latestSeq）按无 cursor 全量重放。无 LiveRun → null。
   */
  attach(
    chatId: string,
    options?: { cursor?: number; runId?: string }
  ): RunSubscription | null {
    const live = this.liveByChat.get(chatId);
    if (!live) {
      return null;
    }
    const requested = options?.cursor;
    const cursor =
      (!options?.runId || options.runId === live.runId) &&
      requested !== undefined &&
      requested >= 0 &&
      requested <= live.log.latestSeq()
        ? requested
        : 0;
    const subscriber: Subscriber = { queue: new AsyncEventQueue() };
    live.subscribers.add(subscriber);
    const watermark = live.log.length;
    for (const entry of live.log.slice(
      live.log.indexAfterSeq(cursor),
      watermark
    )) {
      subscriber.queue.push(entry);
    }
    const close = () => {
      live.subscribers.delete(subscriber);
      subscriber.queue.end();
    };
    if (live.terminal) {
      // 迟到 resume：终态已在快照内，立即收尾（§2.5 边界表"终态在途"）
      close();
    }
    return {
      close,
      events: subscriber.queue.iterate(),
      messageId: live.baseAssistantMessageId ?? deriveMessageId(live.runId),
      runId: live.runId,
      settled: live.settled,
    };
  }

  /** 显式中止（Stop 端点 / 删 chat）：无活跃 run 返回 false（幂等） */
  async abortByChat(chatId: string, expectedRunId?: string): Promise<boolean> {
    const live = this.liveByChat.get(chatId);
    if (
      !live ||
      live.terminal ||
      (expectedRunId && live.runId !== expectedRunId)
    ) {
      return false;
    }
    const ack = await live.session.send({ type: "abort" });
    return ack.ok;
  }

  private async consume(live: LiveRun): Promise<void> {
    try {
      for await (const event of live.session.events()) {
        if (event.type === "run.settled" || event.type === "run.failed") {
          await this.settle(live, event);
          return;
        }
        if (isPersistedRuntimeEvent(event)) {
          if (event.type === "run.started") {
            await this.options.runStore.markRunStatus(live.runId, "running", {
              allowedFrom: NON_TERMINAL_STATUSES,
            });
          }
          // 先落库再写日志/广播：重放永不缺持久事件（§2.5）
          live.seq += 1;
          await this.options.eventStore.append({
            data: runtimeEventData(event),
            runId: live.runId,
            seq: live.seq,
            type: event.type,
          });
          this.publish(live, live.log.append({ event, seq: live.seq }));
        } else {
          // delta/message.started/queue/command.output：仅日志 + 广播
          this.publish(live, live.log.append({ event }));
        }
      }
      // 事件流未经终态即结束（backend 异常 close）：合成 failed 兜底
      await this.settle(live, {
        error: "runtime event stream ended without terminal event",
        runId: live.runId,
        type: "run.failed",
      });
    } catch (error) {
      console.error("[run-manager] consume loop failed", {
        error: messageOf(error),
        runId: live.runId,
      });
      try {
        await this.settle(live, {
          error: messageOf(error),
          runId: live.runId,
          type: "run.failed",
        });
      } catch (nested) {
        console.error("[run-manager] synthetic settle failed", {
          error: messageOf(nested),
          runId: live.runId,
        });
        live.settledResolve("failed");
        this.retainTerminal(live);
      }
    }
  }

  /** 终态处理（§2.6 顺序）：消息 → 事件 → 状态 → lease → 广播 → TTL → close */
  private async settle(
    live: LiveRun,
    event: Extract<RuntimeEvent, { type: "run.settled" | "run.failed" }>
  ): Promise<void> {
    const outcome: SettleOutcome =
      event.type === "run.failed"
        ? "failed"
        : event.reason === "aborted"
          ? "aborted"
          : "settled";
    let finalOutcome: SettleOutcome = outcome;
    let seq: number | undefined;
    try {
      // 1. 消息先于 status 落库：命中"DB status 已终态 → 204"时消息必然已可见
      const events = live.log
        .slice(0, live.log.length)
        .map((logged) => logged.event);
      await this.options.messageStore.upsertAssistantMessage({
        chatId: live.chatId,
        id: live.baseAssistantMessageId ?? deriveMessageId(live.runId),
        parts: [
          ...(live.baseParts ?? []),
          ...buildAssistantMessageParts(events),
        ],
      });
      // 2. 终态事件持久化（(runId, seq) 幂等——重复事件不重复落库）
      const nextSeq = live.seq + 1;
      live.seq = nextSeq;
      seq = nextSeq;
      await this.options.eventStore.append({
        data: runtimeEventData(event),
        runId: live.runId,
        seq,
        type: event.type,
      });
      // 3. 状态机条件更新（allowedFrom 非终态，防回退）
      await this.options.runStore.markRunStatus(live.runId, outcome, {
        allowedFrom: NON_TERMINAL_STATUSES,
        ...(event.type === "run.failed" ? { errorMessage: event.error } : {}),
      });
      // 4. lease 释放
      await this.options.runStore.releaseLease(live.runId);
    } catch (error) {
      // 落库失败：标 failed（best effort），仍广播原终态事件
      console.error("[run-manager] terminal persist failed", {
        error: messageOf(error),
        runId: live.runId,
      });
      finalOutcome = "failed";
      await this.options.runStore
        .markRunStatus(live.runId, "failed", {
          allowedFrom: NON_TERMINAL_STATUSES,
          errorMessage: `persist error: ${messageOf(error)}`,
        })
        .catch(() => undefined);
      // 持久化失败的事件不携带 seq：客户端 cursor 不指向缺失的 DB 行
      seq = undefined;
    }
    // 5. 写日志 + 广播（无论持久化成败，订阅方都要收到终态）
    const entry = live.log.append(
      seq === undefined ? { event } : { event, seq }
    );
    live.terminal = entry;
    this.publish(live, entry);
    live.settledResolve(finalOutcome);
    // 6. 收尾（TTL 保留 LiveRun 供迟到 resume）
    this.retainTerminal(live);
  }

  /** 终态后统一收尾：结束订阅、TTL 后移除 LiveRun、关闭 session */
  private retainTerminal(live: LiveRun): void {
    for (const subscriber of live.subscribers) {
      subscriber.queue.end();
    }
    live.subscribers.clear();
    const ttl = setTimeout(
      () => this.removeLive(live),
      this.options.terminalTtlMs ?? TERMINAL_TTL_MS
    );
    ttl.unref();
    live.session.close("run-settled").catch(() => undefined);
  }

  private removeLive(live: LiveRun): void {
    this.liveByRun.delete(live.runId);
    if (this.liveByChat.get(live.chatId) === live) {
      this.liveByChat.delete(live.chatId);
    }
    for (const subscriber of live.subscribers) {
      subscriber.queue.end();
    }
    live.subscribers.clear();
  }

  private async discardFailedStart(
    live: LiveRun,
    error: string
  ): Promise<void> {
    this.removeLive(live);
    await this.options.runStore.markRunStatus(live.runId, "failed", {
      errorMessage: `runtime rejected prompt: ${error}`,
    });
    await this.options.runStore.releaseLease(live.runId);
    await live.session.close("start-rejected");
  }

  private publish(live: LiveRun, entry: LoggedRuntimeEvent): void {
    for (const subscriber of live.subscribers) {
      subscriber.queue.push({ ...entry });
    }
  }

  private async tickHeartbeat(): Promise<void> {
    const runIds = [
      ...this.startingByRun.keys(),
      ...[...this.liveByRun.values()]
        .filter((live) => !live.terminal)
        .map((live) => live.runId),
    ];
    if (runIds.length === 0) {
      return;
    }
    try {
      await this.options.runStore.renewLeases(this.options.workerId, runIds);
    } catch (error) {
      console.error("[run-manager] lease heartbeat failed", {
        error: messageOf(error),
      });
    }
  }
}

function createLiveRun(args: {
  chatId: string;
  input: RunStartInput;
  runId: string;
  session: RuntimeSession;
}): LiveRun {
  let settledResolve!: (outcome: "settled" | "failed" | "aborted") => void;
  const settled = new Promise<"settled" | "failed" | "aborted">((resolve) => {
    settledResolve = resolve;
  });
  return {
    baseAssistantMessageId: args.input.baseAssistantMessageId,
    baseParts: args.input.baseParts,
    chatId: args.chatId,
    log: new RunEventLog(),
    runId: args.runId,
    seq: 0,
    session: args.session,
    settled,
    settledResolve,
    subscribers: new Set(),
    terminal: null,
  };
}
