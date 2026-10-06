import "server-only";

import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  type JsonAgentSessionEvent,
  RpcClient,
} from "@earendil-works/pi-coding-agent";
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
import {
  buildRpcClientOptions,
  type LocalRpcBackendOptions,
  seedSessionFile,
} from "./spawn";

/** run.failed 里携带的 stderr 尾部长度（诊断用，永不解析） */
const STDERR_TAIL_LIMIT = 500;
/** run 期间进程死亡检测的 getState 轮询间隔 */
const GET_STATE_POLL_MS = 500;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function newRunId(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * LocalRpcBackend：官方 RpcClient 驱动本机 `pi --mode rpc` 子进程（v2.0
 * §5.2；Step 3）。分帧、id 关联、先订阅后 prompt、SIGTERM 停机语义全部
 * 继承官方 client；本层只做 Pi RPC record ↔ Runtime command/event 转换：
 * 流式映射复用 PiEventNormalizer（与 InProcessBackend 同一实现），终态由
 * agent_settled 推导（单次 prompt 场景与 in-process 的 prompt resolve 等价，
 * 且天然覆盖 steer/followUp 续跑的多周期）。
 *
 * 能力边界（Step 4 bridge Package 解锁）：spec.tools 的平台侧闭包不跨进程，
 * 在此被丢弃；workspaceDir 为空时子进程 --no-builtin-tools。生产路径未
 * 切换（RunManager 仍组装 InProcessBackend），本实现当前仅由契约测试构造。
 */
export class LocalRpcBackend implements RuntimeBackend {
  private readonly options: LocalRpcBackendOptions;

  constructor(options: LocalRpcBackendOptions = {}) {
    this.options = options;
  }

  async open(spec: RuntimeSpec): Promise<RuntimeSession> {
    if (spec.tools.some((tool) => tool.name === "platform_web_search")) {
      throw new Error(
        "平台联网搜索尚未接入 LocalRpc；不能丢弃工具或回退宿主执行。"
      );
    }
    const queue = new AsyncEventQueue<RuntimeEvent>();
    // 每次会话独立 agentDir（隔离 stray 扩展/技能/凭据）与 sessionDir（§8.2 会话文件 seeding）
    const agentDir =
      this.options.agentDir ??
      (await mkdtemp(path.join(tmpdir(), "piwork-rpc-agentdir-")));
    const sessionDir =
      this.options.sessionDir ??
      (await mkdtemp(path.join(tmpdir(), "piwork-rpc-sessions-")));
    const sessionFile = seedSessionFile(spec, sessionDir);
    const client = new RpcClient(
      buildRpcClientOptions(
        spec,
        { agentDir, sessionDir, sessionFile },
        this.options
      )
    );
    await client.start();
    return new LocalRpcRuntimeSession(client, queue);
  }
}

export class LocalRpcRuntimeSession implements RuntimeSession {
  private readonly queue: AsyncEventQueue<RuntimeEvent>;
  private readonly client: RpcClient;
  private readonly normalizer = new PiEventNormalizer();
  private readonly unsubscribeEvents: () => void;

  private closed = false;
  private eventsConsumed = false;
  private aborted = false;
  private runInFlight = false;
  private lastError: string | undefined;
  /** 最近一条 assistant 消息的 stopReason（abort 终态推导素材） */
  private lastStopReason: string | undefined;
  private currentRunId = newRunId();
  private watchdog: ReturnType<typeof setInterval> | undefined;

  constructor(client: RpcClient, queue: AsyncEventQueue<RuntimeEvent>) {
    this.client = client;
    this.queue = queue;
    // 先订阅再命令（F.1 纪律）：onEvent 在任何 prompt/steer 之前挂上
    this.unsubscribeEvents = client.onEvent((event) => this.handleEvent(event));
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
        this.lastStopReason = undefined;
        this.currentRunId = newRunId();
        // run.started 先于 prompt 发出：子进程不可能在收到 prompt 前产事件，
        // 队列序必然 run.started 在前（镜像 InProcess 时序）
        this.queue.push({ runId: this.currentRunId, type: "run.started" });
        this.startWatchdog();
        try {
          // prompt response = 受理（success response 即 resolve）；受理后的
          // 失败只从事件流来（stopReason error/aborted → agent_settled 终态）
          await this.client.prompt(command.text, command.images);
          return { ok: true };
        } catch (error) {
          // 受理失败：不会有 agent 周期，就地终态防止事件流悬挂
          this.emitFailure(messageOf(error));
          return { error: messageOf(error), ok: false };
        }
      }
      case "abort": {
        this.aborted = true;
        // Esc 语义（官方）：先清队列再 abort；abort response 是完成级（等
        // 空闲才返回），不阻塞 ack
        this.client.clearQueue().catch(() => undefined);
        this.client.abort().catch(() => undefined);
        return { ok: true };
      }
      case "steer": {
        try {
          await this.client.steer(command.text, command.images);
          return { ok: true };
        } catch (error) {
          return { error: messageOf(error), ok: false };
        }
      }
      case "followUp": {
        try {
          await this.client.followUp(command.text, command.images);
          return { ok: true };
        } catch (error) {
          return { error: messageOf(error), ok: false };
        }
      }
      case "clearQueue": {
        try {
          await this.client.clearQueue();
          return { ok: true };
        } catch (error) {
          return { error: messageOf(error), ok: false };
        }
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
    this.unsubscribeEvents();
    this.stopWatchdog();
    // SIGTERM→1s→SIGKILL 且等待退出（无泄漏保障）；已死进程会等满 1s 超时
    // （exit 监听已被消费），无害
    await this.client.stop().catch(() => undefined);
    this.queue.end();
  }

  /** 子进程 stderr（诊断输出；永不解析，仅排查/测试断言用） */
  getStderr(): string {
    return this.client.getStderr();
  }

  private handleEvent(event: JsonAgentSessionEvent): void {
    this.trackRunState(event);
    for (const normalized of this.normalizer.feed(event)) {
      this.queue.push(normalized);
    }
  }

  /** 运行级事件（normalizer 之外的终态/周期推导） */
  private trackRunState(event: JsonAgentSessionEvent): void {
    if (event.type === "agent_start") {
      // 防御性补发 run.started：agent 周期在 send(prompt) 之外启动时（如
      // settle 后 retry/续跑）。首周期 run.started 由 send(prompt) 先行发出，
      // 此处 runInFlight 为真不重复。注：idle 时 followUp 只入队不开新周期
      // （pi agent.followUp 仅 enqueue，由活动 run 的循环取走），走不到这里
      if (!this.runInFlight) {
        this.runInFlight = true;
        this.currentRunId = newRunId();
        this.startWatchdog();
        this.queue.push({ runId: this.currentRunId, type: "run.started" });
      }
      return;
    }
    if (event.type === "message_end" && event.message.role === "assistant") {
      // message_end 是 authoritative 消息：error 记错、非 error 清错（重试
      // 成功不误报）；stopReason 供 abort 终态推导
      const { errorMessage, stopReason } = event.message;
      this.lastStopReason = stopReason;
      this.lastError =
        stopReason === "error" ? (errorMessage ?? "model error") : undefined;
      return;
    }
    // “pi 不会再动了”的唯一判据（retry/compaction/steer/followUp 之后的真终
    // 态）；流式事件已在前序 handleEvent 中入队，终态天然排在其后
    if (event.type === "agent_settled" && this.runInFlight) {
      this.emitTerminal();
    }
  }

  private emitTerminal(): void {
    this.runInFlight = false;
    this.stopWatchdog();
    const errorMessage =
      this.lastError && !this.aborted ? this.lastError : undefined;
    if (errorMessage) {
      this.lastError = errorMessage;
      this.queue.push({
        error: errorMessage,
        runId: this.currentRunId,
        type: "run.failed",
      });
      return;
    }
    this.queue.push(
      this.aborted || this.lastStopReason === "aborted"
        ? { reason: "aborted", runId: this.currentRunId, type: "run.settled" }
        : {
            reason: "completed",
            runId: this.currentRunId,
            type: "run.settled",
          }
    );
  }

  private emitFailure(error: string): void {
    this.runInFlight = false;
    this.stopWatchdog();
    this.lastError = error;
    this.queue.push({ error, runId: this.currentRunId, type: "run.failed" });
  }

  /**
   * 进程死亡检测：RpcClient 不向消费者暴露子进程退出事件（exit 只置内部
   * exitError 并 reject pending），run 期间轮询 getState——通道 reject 即
   * 视为进程死亡，fail-closed 推 run.failed（已产出事件不丢，仍在队列）。
   */
  private startWatchdog(): void {
    this.stopWatchdog();
    this.watchdog = setInterval(() => {
      this.client.getState().catch((error: unknown) => {
        this.handleProcessDeath(error);
      });
    }, GET_STATE_POLL_MS);
    this.watchdog.unref();
  }

  private stopWatchdog(): void {
    if (this.watchdog) {
      clearInterval(this.watchdog);
      this.watchdog = undefined;
    }
  }

  private handleProcessDeath(error: unknown): void {
    if (this.closed || !this.runInFlight) {
      return;
    }
    const stderrTail = this.client.getStderr().slice(-STDERR_TAIL_LIMIT);
    this.emitFailure(
      `rpc process exited: ${messageOf(error)}${
        stderrTail ? `; stderr: ${stderrTail}` : ""
      }`
    );
  }
}
