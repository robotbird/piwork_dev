/**
 * SandboxProvider seam（docs/opensandbox-integration-spec.md §4.1 缝 2/3、§7）。
 *
 * 本目录是「沙箱知识收敛点」：接口对 Pi 无感知（不 import 任何
 * @earendil-works 包），backend 层只经 SandboxChannel 见「一条到沙箱内命令
 * 的双工管道」。反向依赖禁止：sandbox/ 不得 import lib/runtime/backends 或
 * lib/ai。
 *
 * 实现落点：tests/support/sandbox/（测试替身）、lib/runtime/sandbox/docker/
 * （开发底座）、lib/runtime/sandbox/opensandbox/（生产底座，SDK 隔离在该
 * 目录内）。生命周期与状态经 SandboxRegistry 落库（沙箱管理页数据源）。
 */

import type { SandboxFilesystem } from "./filesystem";

/** 出站网络策略：默认拒绝；白名单只能显式放行（spec §8） */
export type SandboxEgressPolicy =
  | { mode: "deny-all" }
  | { mode: "allowlist"; fqdns: string[] };

/** 沙箱申请单：由 RuntimeSpec 派生（纯数据，便于单测派生逻辑） */
export type SandboxSpec = {
  /** 审计关联的 AgentRun id */
  runId: string;
  /** lease 粒度 = chat 级复用（v2.0 §8） */
  chatId: string;
  /**
   * 归属用户：审计与管理页展示（spec §7）。可省略——dbSandboxRegistry 会
   * 从 Chat 归属补全（RuntimeSpec 不携带 userId，聊天所有权以库为准）。
   */
  userId?: string;
  /** 预构建 Pi 运行时镜像（Step 6 制品，首版手写 tag） */
  image: string;
  /** chat workspace 挂载源；沙箱内为唯一可写区 */
  workspaceVolume: { source: string };
  resource: { cpuCores: number; memoryMB: number };
  egress: SandboxEgressPolicy;
  /** 默认 3600；续期节奏 = min(TTL/2, 1h)（skill 安全方案 §4.2） */
  ttlSeconds: number;
  /** 审计标识；`opensandbox.io/` 前缀为 OpenSandbox 保留字 */
  metadata?: Record<string, string>;
};

/** 沙箱内长驻进程的退出信息；backend 据此判进程死亡 */
export type SandboxExit = { code: number | null; signal: string | null };

/**
 * 缝 2：双工字节流。PTY/exec/endpoint 等传输细节是 provider 内部职责，
 * 对 backend 与 bridge shim 保密；字节保真（不污染 JSONL）由实现保证。
 */
export interface SandboxChannel {
  close: () => Promise<void>;
  /**
   * 对端写侧 EOF（RpcClient 进程退场，官方 stop() 是 SIGTERM/SIGKILL 而非
   * stdin.end，故 EOF 即进程死亡）时由 bridge 调用：向沙箱内进程 stdin 发送
   * EOF（半关闭写侧），令 pi rpc 模式按官方 stdio 语义干净退出。
   */
  endInput: () => Promise<void>;
  /** 进程退出（含连接断开推导的死亡）时 resolve；不应 reject */
  readonly onExit: Promise<SandboxExit>;
  read: () => AsyncIterable<Uint8Array>;
  /** Optional combined output for execution tools; RPC always uses stdout read(). */
  readCombined?: () => AsyncIterable<Uint8Array>;
  write: (chunk: Uint8Array) => Promise<void>;
}

export type SandboxStatus =
  | "creating"
  | "ready"
  | "paused"
  | "degraded"
  | "destroyed";

/** 销毁/释放策略：kill 回收；pause/keep 为 Step 9 warm pool 预留，首版只做 kill */
export type SandboxReleasePolicy = "kill" | "pause" | "keep";

export interface SandboxHandle {
  destroy: (policy: SandboxReleasePolicy) => Promise<void>;
  /** P1 bounded/atomic file capability; required by sandbox-tools, not legacy RPC. */
  readonly filesystem?: SandboxFilesystem;
  readonly id: string;
  readFile: (path: string) => Promise<Uint8Array>;
  renew: () => Promise<void>;
  /** 在沙箱内启动长驻命令并返回其 IO 通道 */
  startProcess: (command: {
    argv: string[];
    cwd?: string;
    /** 沙箱内进程 env 覆盖项；基础 env 策略（最小化、不继承宿主）由实现决定 */
    env?: Record<string, string>;
  }) => Promise<SandboxChannel>;
  status: () => Promise<SandboxStatus>;
  /**
   * workspace 在沙箱内的绝对路径（startProcess cwd 与上传文件的 argv 引用
   * 都以它为基准；bridge/backend 组装 in-sandbox 命令行时使用）。
   */
  readonly workspaceRoot: string;
  /** 仅 workspace 内可写（路径逃逸由实现拒绝）；嵌套目录自动创建 */
  writeFile: (path: string, content: Uint8Array) => Promise<void>;
}

export type SandboxProviderName = "test" | "docker" | "opensandbox";

/** Control-plane lifecycle queries; no execd connection or agent process required. */
export type SandboxObservation = {
  status: SandboxStatus;
  expiresAt?: Date | null;
};
export interface SandboxControl {
  destroy: (externalId: string) => Promise<void>;
  extend: (externalId: string, seconds: number) => Promise<SandboxObservation>;
  inspect: (externalId: string) => Promise<SandboxObservation | null>;
}

/** Persisted allocation snapshot; old instances have no snapshot. */
export type SandboxRuntimeConfig = {
  resource: SandboxSpec["resource"];
  egress: SandboxEgressPolicy;
  workspaceRoot: string;
};

export interface SandboxProvider {
  acquire: (spec: SandboxSpec) => Promise<SandboxHandle>;
  /**
   * 按 externalId 重连既有沙箱（chat 级复用的下半程）。沙箱已不存在/不可用
   * 时抛 SandboxUnavailableError——由 LeasingSandboxProvider 决策「标记过期并
   * 重建」，不视为平台故障。
   */
  attach: (externalId: string) => Promise<SandboxHandle>;
  readonly control?: SandboxControl;
  readonly name: SandboxProviderName;
  release: (
    handle: SandboxHandle,
    policy: SandboxReleasePolicy
  ) => Promise<void>;
}

/**
 * fail-closed 错误分类（spec §7.3）：创建/连接失败抛 Unavailable（run 立即
 * failed，绝不回退 in-process）；运行中故障由 onExit 非正常退出表达，backend
 * 映射为 SandboxFaultError 语义。
 */
export class SandboxUnavailableError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "SandboxUnavailableError";
    this.cause = cause;
  }
}

export class SandboxFaultError extends Error {
  readonly exit: SandboxExit;

  constructor(message: string, exit: SandboxExit) {
    super(message);
    this.name = "SandboxFaultError";
    this.exit = exit;
  }
}
