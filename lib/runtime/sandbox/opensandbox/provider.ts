/**
 * OpenSandboxProvider（生产底座，spec §6 Phase 3、§11 D-1/D-2/D-6）。
 *
 * `@alibaba-group/opensandbox` SDK 只在本目录内 import（spec §7 SDK 隔离）。
 * 传输 = execd PTY pipe 模式 WS 经 server proxy：endpoint 经 SDK
 * `getEndpointUrl()`（`connectionConfig.useServerProxy: true`）解析——server 侧
 * 返回 `{eip|反射 base}/sandboxes/{id}/proxy/{port}`（lifecycle.py:579-597 核对），
 * 尊重 `server.eip` 配置，不手拼路由。
 *
 * 与 DockerSandboxProvider 安全基线的差异（spec §5.1，如实声明、不冒充同等）：
 * - rootfs：OpenSandbox docker 档默认可写，create API 无只读开关——缓解 =
 *   镜像非 root 用户（pi-runtime 的 `pi`）+ 只经 files API 写 workspace 的约定；
 * - egress：`networkPolicy` 总是显式下发（deny-all 也下发——§5.1「无 policy =
 *   完全直通」实测）；但 OpenSandbox docker 档是域名级过滤，直连 IP 可绕过
 *   （§5.1 实测），网络级兜底属 Phase 4 / 生产 K8s 档（NetworkPolicy）；
 * - workspace：无宿主 bind（`workspaceVolume.source` 忽略），沙箱内临时盘，
 *   seeding 走 files API；TTL 到期/销毁后内容不保留（chat 级复用靠 lease 保活）；
 * - TTL：server 原生 `expiresAt` + `renew()`（docker provider 无原生 TTL）。
 */

import { randomUUID } from "node:crypto";
import { posix } from "node:path";
import type {
  NetworkPolicy,
  SandboxConnectOptions,
  SandboxCreateOptions,
} from "@alibaba-group/opensandbox";
import {
  DEFAULT_EXECD_PORT,
  Sandbox as OpenSandboxSdkSandbox,
  SandboxManager,
} from "@alibaba-group/opensandbox";
import type {
  SandboxChannel,
  SandboxControl,
  SandboxEgressPolicy,
  SandboxHandle,
  SandboxProvider,
  SandboxReleasePolicy,
  SandboxSpec,
  SandboxStatus,
} from "../index";
import { SandboxUnavailableError } from "../index";
import type { PtyExecChannelOptions } from "./pty-channel";
import { buildLauncherScript, openPtyExecChannel } from "./pty-channel";

/**
 * SDK `Sandbox` 的结构性子集：provider 只依赖这些成员，单元测试注入替身
 * 工厂即可离线跑（真实 server 只进 gated 契约组）。
 */
export interface ManagedSandbox {
  close: () => Promise<void>;
  readonly files: {
    createDirectories: (
      entries: Array<{ path: string; mode?: number }>
    ) => Promise<void>;
    writeFiles: (
      entries: Array<{
        path: string;
        data?: string | Uint8Array;
        mode?: number;
      }>
    ) => Promise<void>;
    readBytes: (path: string) => Promise<Uint8Array>;
  };
  getEndpointUrl: (port: number) => Promise<string>;
  getInfo: () => Promise<{
    status?: { state?: string };
    expiresAt?: Date | null;
  }>;
  readonly id: string;
  kill: () => Promise<void>;
  pause: () => Promise<void>;
  renew: (timeoutSeconds: number) => Promise<unknown>;
}

/** 沙箱实例工厂 seam：生产默认走 SDK 静态方法，测试注入替身 */
export type OpenSandboxSandboxFactory = {
  create: (options: SandboxCreateOptions) => Promise<ManagedSandbox>;
  connect: (options: SandboxConnectOptions) => Promise<ManagedSandbox>;
};

const sdkSandboxFactory: OpenSandboxSandboxFactory = {
  async connect(options) {
    return (await OpenSandboxSdkSandbox.connect(options)) as ManagedSandbox;
  },
  async create(options) {
    return (await OpenSandboxSdkSandbox.create(options)) as ManagedSandbox;
  },
};

/**
 * egress → OpenSandbox NetworkPolicy。**总是显式下发**（含 deny-all）：
 * server 对无 policy 的沙箱完全不挂 egress sidecar（spec §5.1 实测）。
 * FQDN/通配符域名级放行（无 IP/CIDR，SDK NetworkRule 定义）。
 */
export function toNetworkPolicy(egress: SandboxEgressPolicy): NetworkPolicy {
  return {
    defaultAction: "deny",
    egress:
      egress.mode === "allowlist"
        ? egress.fqdns.map((fqdn) => ({
            action: "allow" as const,
            target: fqdn,
          }))
        : [],
  };
}

const SANDBOX_STATE_MAP: Record<string, SandboxStatus> = {
  Creating: "creating",
  Deleted: "destroyed",
  Deleting: "destroyed",
  Error: "degraded",
  Paused: "paused",
  Pausing: "paused",
  Resuming: "creating",
  Running: "ready",
};

/** OpenSandbox SandboxState → SandboxStatus（未知态按 degraded 处理） */
export function mapSandboxState(state: string | undefined): SandboxStatus {
  if (!state) {
    return "degraded";
  }
  return SANDBOX_STATE_MAP[state] ?? "degraded";
}

type SandboxedError = {
  error?: { code?: string; message?: string };
  statusCode?: number;
  message?: string;
};

function describeSandboxError(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return String(error);
  }
  const candidate = error as SandboxedError;
  const parts = [
    candidate.message,
    candidate.error?.code,
    candidate.error?.message,
  ].filter(
    (part): part is string => typeof part === "string" && part.length > 0
  );
  return parts.join(" / ") || String(error);
}

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const candidate = error as SandboxedError;
  const code = candidate.error?.code ?? "";
  if (code.toUpperCase().includes("NOT_FOUND")) {
    return true;
  }
  if (candidate.statusCode === 404) {
    return true;
  }
  return /not found/i.test(candidate.message ?? "");
}

/** workspace 路径遏制：相对 path 必须解析进 workspaceRoot 内（拒绝 `..`/绝对逃逸） */
export function resolveInsideWorkspace(
  workspaceRoot: string,
  path: string
): string {
  if (path === "") {
    throw new Error("opensandbox: 空 workspace 相对路径");
  }
  const absolute = posix.resolve(workspaceRoot, path);
  if (absolute !== workspaceRoot && !absolute.startsWith(`${workspaceRoot}/`)) {
    throw new Error(`opensandbox: workspace 路径逃逸拒绝: ${path}`);
  }
  return absolute;
}

export type OpenSandboxProviderOptions = {
  /** lifecycle server 地址（host[:port] 或完整 URL），即 SDK ConnectionConfigOptions.domain */
  domain: string;
  apiKey: string;
  protocol?: "http" | "https";
  /** 沙箱内 execd 端口（默认 DEFAULT_EXECD_PORT=44772） */
  execdPort?: number;
  /** workspace 在沙箱内的绝对路径（pi-runtime 镜像为 /workspace） */
  workspaceRoot?: string;
  /** create/connect 就绪超时（秒），透传 SDK */
  readyTimeoutSeconds?: number;
  /** attach 场景 renew 用的 TTL；acquire 用 spec.ttlSeconds */
  ttlSeconds?: number;
  factory?: OpenSandboxSandboxFactory;
  managerFactory?: () => Pick<
    SandboxManager,
    "getSandboxInfo" | "renewSandbox" | "killSandbox" | "close"
  >;
  /** PTY 通道开启器（默认真实实现）；单测注入替身，与 factory seam 同理 */
  openChannel?: (options: PtyExecChannelOptions) => Promise<SandboxChannel>;
};

type HandleContext = {
  sandbox: ManagedSandbox;
  ttlSeconds: number;
  workspaceRoot: string;
  execdPort: number;
  apiKey: string;
  openChannel: (options: PtyExecChannelOptions) => Promise<SandboxChannel>;
  invoke: <T>(label: string, operation: () => Promise<T>) => Promise<T>;
};

export class OpenSandboxProvider implements SandboxProvider {
  readonly name = "opensandbox" as const;
  readonly control: SandboxControl = {
    destroy: (id) =>
      this.withManager(async (manager) => {
        try {
          await manager.killSandbox(id);
        } catch (error) {
          if (!isNotFoundError(error)) {
            throw error;
          }
        }
      }),
    extend: (id, seconds) =>
      this.withManager(async (manager) => {
        const info = await manager.getSandboxInfo(id);
        const status = mapSandboxState(info.status.state);
        if (status !== "ready" && status !== "paused") {
          throw new Error("Sandbox cannot be renewed in its current state");
        }
        // SDK renew sets now + timeout. Add to the current deadline, never shorten it.
        const remaining = Math.max(
          0,
          (info.expiresAt?.getTime() ?? Date.now()) - Date.now()
        );
        await manager.renewSandbox(id, Math.ceil(remaining / 1000) + seconds);
        const updated = await manager.getSandboxInfo(id);
        return {
          expiresAt: updated.expiresAt,
          status: mapSandboxState(updated.status.state),
        };
      }),
    inspect: (id) =>
      this.withManager(async (manager) => {
        try {
          const info = await manager.getSandboxInfo(id);
          return {
            expiresAt: info.expiresAt,
            status: mapSandboxState(info.status.state),
          };
        } catch (error) {
          if (isNotFoundError(error)) {
            return null;
          }
          throw error;
        }
      }),
  };

  private async withManager<T>(
    operation: (
      manager: Pick<
        SandboxManager,
        "getSandboxInfo" | "renewSandbox" | "killSandbox" | "close"
      >
    ) => Promise<T>
  ): Promise<T> {
    const manager =
      this.options.managerFactory?.() ??
      SandboxManager.create({ connectionConfig: this.connectionConfig() });
    try {
      return await this.invoke("control", () => operation(manager));
    } finally {
      await manager.close().catch(() => undefined);
    }
  }

  private readonly factory: OpenSandboxSandboxFactory;
  private readonly options: OpenSandboxProviderOptions;

  constructor(options: OpenSandboxProviderOptions) {
    this.options = options;
    this.factory = options.factory ?? sdkSandboxFactory;
  }

  private connectionConfig() {
    return {
      apiKey: this.options.apiKey,
      domain: this.options.domain,
      protocol: this.options.protocol ?? "http",
      useServerProxy: true,
    };
  }

  /** fail-closed（spec §7.3）：一切 SDK 故障归一为 SandboxUnavailableError */
  private async invoke<T>(
    label: string,
    operation: () => Promise<T>
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof SandboxUnavailableError) {
        throw error;
      }
      // biome-ignore lint/style/useErrorCause: 第二参数即 cause（seam 自定义 Error 的 positional 构造）
      throw new SandboxUnavailableError(
        `opensandbox: ${label} 失败: ${describeSandboxError(error)}`,
        error
      );
    }
  }

  async acquire(spec: SandboxSpec): Promise<SandboxHandle> {
    const sandbox = await this.invoke("acquire", () =>
      this.factory.create({
        connectionConfig: this.connectionConfig(),
        image: spec.image,
        metadata: {
          ...(spec.metadata ?? {}),
          "piwork.chatId": spec.chatId,
          "piwork.runId": spec.runId,
          ...(spec.userId ? { "piwork.userId": spec.userId } : {}),
        },
        networkPolicy: toNetworkPolicy(spec.egress),
        readyTimeoutSeconds: this.options.readyTimeoutSeconds,
        // server 侧键名 cpu/memory（container_ops.py _resolve_resource_limits）：
        // cpu 接受小数字符串（→ nano cpus），memory 接受 Mi 单位（→ 字节）
        resource: {
          cpu: String(spec.resource.cpuCores),
          memory: `${spec.resource.memoryMB}Mi`,
        },
        timeoutSeconds: spec.ttlSeconds,
      })
    );
    return this.createHandle(sandbox, spec.ttlSeconds);
  }

  async attach(externalId: string): Promise<SandboxHandle> {
    const sandbox = await this.invoke(`attach(${externalId})`, () =>
      this.factory.connect({
        connectionConfig: this.connectionConfig(),
        sandboxId: externalId,
      })
    );
    return this.createHandle(sandbox, this.options.ttlSeconds ?? 3600);
  }

  async release(
    handle: SandboxHandle,
    policy: SandboxReleasePolicy
  ): Promise<void> {
    if (!(handle instanceof OpenSandboxHandle)) {
      throw new Error("opensandbox: release 收到非本 provider 的 handle");
    }
    await handle.destroy(policy);
  }

  private createHandle(sandbox: ManagedSandbox, ttlSeconds: number) {
    return new OpenSandboxHandle({
      apiKey: this.options.apiKey,
      execdPort: this.options.execdPort ?? DEFAULT_EXECD_PORT,
      invoke: (label, operation) => this.invoke(label, operation),
      openChannel: this.options.openChannel ?? openPtyExecChannel,
      sandbox,
      ttlSeconds,
      workspaceRoot: this.options.workspaceRoot ?? "/workspace",
    });
  }
}

class OpenSandboxHandle implements SandboxHandle {
  private endpointBase: string | null = null;
  private readonly encoder = new TextEncoder();
  /**
   * destroy 后的确定终态：close() 已释放 SDK 传输，无法再查 server——kill/pause
   * 由本端发起，直接给确定答案；keep（Step 9）保留活 handle 继续可查。
   */
  private destroyedStatus: SandboxStatus | null = null;
  private readonly ctx: HandleContext;

  constructor(ctx: HandleContext) {
    this.ctx = ctx;
  }

  get id(): string {
    return this.ctx.sandbox.id;
  }

  get workspaceRoot(): string {
    return this.ctx.workspaceRoot;
  }

  async status(): Promise<SandboxStatus> {
    if (this.destroyedStatus) {
      return this.destroyedStatus;
    }
    try {
      const info = await this.ctx.sandbox.getInfo();
      return mapSandboxState(info.status?.state);
    } catch (error) {
      if (isNotFoundError(error)) {
        return "destroyed";
      }
      // biome-ignore lint/style/useErrorCause: 第二参数即 cause（seam 自定义 Error 的 positional 构造）
      throw new SandboxUnavailableError(
        `opensandbox: status 查询失败: ${describeSandboxError(error)}`,
        error
      );
    }
  }

  async renew(): Promise<void> {
    await this.ctx.invoke("renew", async () => {
      const info = await this.ctx.sandbox.getInfo();
      // A manual extension may exceed the automatic lease deadline.
      if (
        info.expiresAt &&
        info.expiresAt.getTime() >= Date.now() + this.ctx.ttlSeconds * 1000
      ) {
        return;
      }
      await this.ctx.sandbox.renew(this.ctx.ttlSeconds);
    });
  }

  readFile(path: string): Promise<Uint8Array> {
    const absolute = resolveInsideWorkspace(this.workspaceRoot, path);
    return this.ctx.invoke(`readFile(${path})`, () =>
      this.ctx.sandbox.files.readBytes(absolute)
    );
  }

  async writeFile(path: string, content: Uint8Array): Promise<void> {
    await this.ctx.invoke(`writeFile(${path})`, () =>
      this.uploadWorkspaceFile(path, content)
    );
  }

  private async uploadWorkspaceFile(
    path: string,
    content: Uint8Array
  ): Promise<void> {
    const absolute = resolveInsideWorkspace(this.workspaceRoot, path);
    const parent = posix.dirname(absolute);
    if (parent !== this.workspaceRoot) {
      // 嵌套目录自动创建（幂等）；首层目录（workspace 本身）已由镜像预建
      await this.ctx.sandbox.files.createDirectories([{ path: parent }]);
    }
    await this.ctx.sandbox.files.writeFiles([
      { data: content, path: absolute },
    ]);
  }

  startProcess(command: {
    argv: string[];
    cwd?: string;
    env?: Record<string, string>;
  }): Promise<SandboxChannel> {
    return this.ctx.invoke("startProcess", async () => {
      this.endpointBase ??= await this.ctx.sandbox.getEndpointUrl(
        this.ctx.execdPort
      );
      const launcherRel = `piwork/exec-${randomUUID().slice(0, 8)}.sh`;
      const script = buildLauncherScript(command);
      await this.uploadWorkspaceFile(launcherRel, this.encoder.encode(script));
      return this.ctx.openChannel({
        cwd: command.cwd ?? this.workspaceRoot,
        headers: { "OPEN-SANDBOX-API-KEY": this.ctx.apiKey },
        httpBase: this.endpointBase,
        launcherAbsPath: posix.join(this.workspaceRoot, launcherRel),
      });
    });
  }

  async destroy(policy: SandboxReleasePolicy): Promise<void> {
    const { sandbox } = this.ctx;
    try {
      if (policy === "kill") {
        await sandbox.kill();
      } else if (policy === "pause") {
        await sandbox.pause();
      }
    } catch (error) {
      if (!isNotFoundError(error)) {
        // biome-ignore lint/style/useErrorCause: 第二参数即 cause（seam 自定义 Error 的 positional 构造）
        throw new SandboxUnavailableError(
          `opensandbox: destroy(${policy}) 失败: ${describeSandboxError(error)}`,
          error
        );
      }
      // 已不存在 = 目标态达成（幂等销毁）
    } finally {
      if (policy !== "keep") {
        // 只释放 SDK 客户端资源（无 server 调用）；失败不影响销毁结果。
        // keep 保留活 handle（warm pool，Step 9）
        await sandbox.close().catch(() => undefined);
      }
    }
    this.destroyedStatus =
      policy === "kill" ? "destroyed" : policy === "pause" ? "paused" : null;
  }
}
