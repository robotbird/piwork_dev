import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createChildProcessChannel } from "../child-process-channel";
import {
  type SandboxChannel,
  type SandboxControl,
  type SandboxHandle,
  type SandboxProvider,
  type SandboxReleasePolicy,
  type SandboxSpec,
  type SandboxStatus,
  SandboxUnavailableError,
} from "../index";

/**
 * DockerSandboxProvider：开发/CI 底座（opensandbox-integration-spec.md §6
 * Phase 2、§11 D-4 倾向「Engine API/CLI 直连」）。经 docker CLI 起 plain 容器，
 * 安全基线全部由 provider 自持（Phase 0 §5.1 结论——不能指望 OpenSandbox
 * docker 档或镜像默认值）：
 * - `--read-only` rootfs + `--tmpfs /tmp`（rootfs 只读是实测缺口，须显式加）
 * - `--cap-drop ALL` + `no-new-privileges` + `--pids-limit`
 * - egress（spec §6 Phase 4 两层兜底的 docker 档）：deny-all →
 *   `--network none`（硬隔离）；allowlist → **每沙箱独立网桥**（结构上无
 *   跨沙箱横向）+ 白名单 FQDN 一律 `--add-host <fqdn>:host-gateway` 指向
 *   宿主网关 + `--dns 127.0.0.1` 掐灭外部域名解析（非白名单域名即刻失败；
 *   /etc/hosts 别名不受影响）。**开发近似的残余缺口（如实声明）**：
 *   不能用 `--internal`（实测 internal 网络连宿主网关都不可达，会掐断
 *   Inference Proxy 通道），故 raw-IP 直连外网在 docker 档未被硬断——
 *   真正的 FQDN 级默认拒绝是 OpenSandbox egress sidecar / 生产
 *   NetworkPolicy 职责。网络名记入容器 label，destroy 时一并回收。
 * - CPU/内存限额；宿主 env 不进入容器（docker run/exec 不透传 CLI 环境）
 *
 * 已知边界（v1）：docker 无原生 TTL——renew 只更新本地/registry 记账，回收
 * 依赖 run 结束的 release（backend cleanup）与管理页停止；无后台 reaper。
 * 挂载源必须是 docker 守护进程可见路径（colima 即 VM 内可见的 /Users 下）。
 */

const WORKSPACE_ROOT = "/workspace";

export type DockerSandboxProviderOptions = {
  /** docker CLI 可执行文件（默认 "docker"；colima 经 docker context 自动路由） */
  dockerBin?: string;
  /** 容器常驻命令；默认 ["tail","-f","/dev/null"]（busybox/GNU 通用） */
  idleCommand?: string[];
  /** 镜像缺失时是否自动 pull（默认 missing；离线 CI 可 never） */
  pull?: "missing" | "never";
  /** 追加 docker run 参数的逃生口（实验性挂载/网络），位于安全项之后 */
  extraRunArgs?: string[];
};

type CliResult = { code: number; stdout: string; stderr: string };

export class DockerSandboxProvider implements SandboxProvider {
  readonly name = "docker" as const;
  readonly control: SandboxControl = {
    destroy: async (id) => {
      const inspected = await this.runCli([
        "inspect",
        "-f",
        '{{index .Config.Labels "piwork.network"}}',
        id,
      ]);
      if (inspected.code !== 0) {
        if (/No such (object|container)/i.test(inspected.stderr)) {
          return;
        }
        throw new SandboxUnavailableError(
          "docker-sandbox:control-inspect-failed"
        );
      }
      const removed = await this.runCli(["rm", "-f", id], {
        timeoutMs: 60_000,
      });
      if (
        removed.code !== 0 &&
        !/No such (object|container)/i.test(removed.stderr)
      ) {
        throw new SandboxUnavailableError(
          "docker-sandbox:control-destroy-failed"
        );
      }
      const network = inspected.stdout.trim();
      if (network && network !== "<no value>") {
        await this.cliChecked(["network", "rm", network]).catch(() => {
          console.warn(
            "[docker-sandbox] container removed; network cleanup failed"
          );
        });
      }
    },
    extend: async (id) => {
      const observation = await this.control.inspect(id);
      if (!observation || !["ready", "paused"].includes(observation.status)) {
        throw new SandboxUnavailableError("docker-sandbox:cannot-renew");
      }
      // Docker has no native TTL; the management service extends the registry lease.
      return observation;
    },
    inspect: async (id) => {
      const result = await this.runCli([
        "inspect",
        "-f",
        "{{.State.Status}}",
        id,
      ]);
      if (result.code !== 0) {
        if (/No such (object|container)/i.test(result.stderr)) {
          return null;
        }
        throw new SandboxUnavailableError(
          "docker-sandbox:control-inspect-failed"
        );
      }
      const state = result.stdout.trim();
      return {
        status:
          state === "running"
            ? "ready"
            : state === "paused"
              ? "paused"
              : state === "created"
                ? "creating"
                : "degraded",
      };
    },
  };

  private readonly dockerBin: string;
  private readonly idleCommand: string[];
  private readonly pull: "missing" | "never";
  private readonly extraRunArgs: string[];

  constructor(options: DockerSandboxProviderOptions = {}) {
    this.dockerBin = options.dockerBin ?? "docker";
    this.idleCommand = options.idleCommand ?? ["tail", "-f", "/dev/null"];
    this.pull = options.pull ?? "missing";
    this.extraRunArgs = options.extraRunArgs ?? [];
  }

  async acquire(spec: SandboxSpec): Promise<SandboxHandle> {
    await this.ensureImage(spec.image);
    const suffix = randomUUID().slice(0, 8);
    const container = `piwork-sbx-${safeLabel(spec.chatId)}-${suffix}`;
    // allowlist → 每沙箱独立网桥（结构上无跨沙箱横向）；白名单 FQDN 一律
    // 别名到宿主网关，--dns 掐灭外部解析（残余缺口见文件头「开发近似」）
    let network: string | undefined;
    let networkArgs: string[] = ["--network", "none"];
    let addHostArgs: string[] = [];
    if (spec.egress.mode === "allowlist") {
      network = `piwork-net-${safeLabel(spec.chatId)}-${suffix}`;
      const created = await this.runCli(["network", "create", network], {
        timeoutMs: 30_000,
      });
      if (created.code !== 0) {
        throw new SandboxUnavailableError(
          `docker-sandbox:network-create-failed:${created.stderr.slice(0, 300)}`
        );
      }
      networkArgs = ["--network", network];
      addHostArgs = [
        "--dns",
        "127.0.0.1",
        ...spec.egress.fqdns.flatMap((fqdn) => [
          "--add-host",
          `${fqdn}:host-gateway`,
        ]),
      ];
    }
    const args = [
      "run",
      "-d",
      "--name",
      container,
      "--read-only",
      "--tmpfs",
      "/tmp:rw,size=64m",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
      "--pids-limit",
      "1024",
      "--cpus",
      String(spec.resource.cpuCores),
      "--memory",
      `${spec.resource.memoryMB}m`,
      ...networkArgs,
      ...addHostArgs,
      // 空/ephemeral source → 匿名卷（每容器私有可写；named volume 会跨
      // chat 共享，违反 workspace 隔离基线）
      ...(spec.workspaceVolume.source &&
      spec.workspaceVolume.source !== "ephemeral"
        ? ["--volume", `${spec.workspaceVolume.source}:${WORKSPACE_ROOT}:rw`]
        : ["--volume", WORKSPACE_ROOT]),
      "--label",
      "piwork.sandbox=true",
      "--label",
      `piwork.runId=${spec.runId}`,
      "--label",
      `piwork.chatId=${spec.chatId}`,
      ...(network ? ["--label", `piwork.network=${network}`] : []),
      ...(spec.userId ? ["--label", `piwork.userId=${spec.userId}`] : []),
      ...this.extraRunArgs,
      spec.image,
      ...this.idleCommand,
    ];
    const started = await this.runCli(args, { timeoutMs: 120_000 });
    if (started.code !== 0) {
      // 网络已建须回收，不留孤儿（fail-closed 不半途而废）
      if (network) {
        await this.runCli(["network", "rm", network], {
          timeoutMs: 30_000,
        }).catch(() => undefined);
      }
      throw new SandboxUnavailableError(
        `docker-sandbox:run-failed:${started.stderr.slice(0, 300)}`
      );
    }
    const externalId = lastLine(started.stdout);
    const running = await this.inspectField(
      externalId,
      "{{.State.Running}}"
    ).catch(() => "");
    if (running !== "true") {
      // 创建即死（entrypoint 不兼容等）：清理后 fail-closed
      await this.runCli(["rm", "-f", externalId], { timeoutMs: 30_000 }).catch(
        () => undefined
      );
      if (network) {
        await this.runCli(["network", "rm", network], {
          timeoutMs: 30_000,
        }).catch(() => undefined);
      }
      throw new SandboxUnavailableError(
        `docker-sandbox:not-running:${externalId}`
      );
    }
    return new DockerSandboxHandle(this, externalId, network);
  }

  async attach(externalId: string): Promise<SandboxHandle> {
    const state = await this.containerState(externalId);
    if (state === "missing" || state === "dead") {
      throw new SandboxUnavailableError(
        `docker-sandbox:attach:${state}:${externalId}`
      );
    }
    // allowlist 容器的网络名经 label 找回（进程重启后 attach 仍能回收网络）
    const network = await this.inspectField(
      externalId,
      '{{index .Config.Labels "piwork.network"}}'
    ).catch(() => "");
    return new DockerSandboxHandle(
      this,
      externalId,
      network ? network : undefined
    );
  }

  async release(
    handle: SandboxHandle,
    policy: SandboxReleasePolicy
  ): Promise<void> {
    await handle.destroy(policy);
  }

  /** 探活：docker CLI 与守护进程可用性（测试与组装点共用） */
  async healthy(): Promise<boolean> {
    const probe = await this.runCli(
      ["version", "--format", "{{.Server.Version}}"],
      {
        timeoutMs: 10_000,
      }
    ).catch(() => null);
    return probe !== null && probe.code === 0;
  }

  private async ensureImage(image: string): Promise<void> {
    if (this.pull === "never") {
      return;
    }
    const present = await this.runCli(["image", "inspect", image], {
      timeoutMs: 30_000,
    });
    if (present.code === 0) {
      return;
    }
    const pulled = await this.runCli(["pull", image], { timeoutMs: 300_000 });
    if (pulled.code !== 0) {
      throw new SandboxUnavailableError(
        `docker-sandbox:pull-failed:${image}:${pulled.stderr.slice(0, 200)}`
      );
    }
  }

  async containerState(
    externalId: string
  ): Promise<"missing" | "ready" | "paused" | "dead"> {
    const running = await this.inspectField(
      externalId,
      "{{.State.Running}} {{.State.Paused}}"
    ).catch(() => "");
    if (running === "") {
      return "missing";
    }
    const [isRunning, isPaused] = running.split(" ");
    if (isPaused === "true") {
      return "paused";
    }
    return isRunning === "true" ? "ready" : "dead";
  }

  private async inspectField(
    externalId: string,
    format: string
  ): Promise<string> {
    const result = await this.runCli(["inspect", "-f", format, externalId]);
    if (result.code !== 0) {
      throw new SandboxUnavailableError(
        `docker-sandbox:inspect-failed:${lastLine(result.stderr).slice(0, 200)}`
      );
    }
    return lastLine(result.stdout);
  }

  /** 供 handle 复用：运行一次性 docker 命令并断言成功 */
  async cliChecked(
    args: string[],
    options: { timeoutMs?: number } = {}
  ): Promise<string> {
    const result = await this.runCli(args, options);
    if (result.code !== 0) {
      throw new Error(
        `docker-sandbox:cli:${args[0]}:${result.stderr.slice(0, 300)}`
      );
    }
    return result.stdout;
  }

  spawnCli(args: string[]): ChildProcess {
    return spawn(this.dockerBin, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });
  }

  async runCli(
    args: string[],
    options: { timeoutMs?: number } = {}
  ): Promise<CliResult> {
    const child = spawn(this.dockerBin, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout?.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));
    const timer = setTimeout(
      () => child.kill("SIGKILL"),
      options.timeoutMs ?? 30_000
    );
    if (typeof timer.unref === "function") {
      timer.unref();
    }
    const code = await new Promise<number>((resolve) => {
      child.once("error", () => resolve(-1));
      child.once("exit", (exitCode) => resolve(exitCode ?? -1));
    });
    clearTimeout(timer);
    return {
      code,
      stderr: Buffer.concat(stderr).toString("utf8"),
      stdout: Buffer.concat(stdout).toString("utf8"),
    };
  }
}

class DockerSandboxHandle implements SandboxHandle {
  readonly id: string;
  readonly workspaceRoot = WORKSPACE_ROOT;
  private destroyed = false;
  private readonly provider: DockerSandboxProvider;
  /** allowlist 档的专属 internal 网络名（destroy 时回收） */
  private readonly network: string | undefined;

  constructor(provider: DockerSandboxProvider, id: string, network?: string) {
    this.provider = provider;
    this.id = id;
    this.network = network;
  }

  startProcess(command: {
    argv: string[];
    cwd?: string;
    env?: Record<string, string>;
  }): Promise<SandboxChannel> {
    this.assertLive();
    const args = ["exec", "-i", "-w", command.cwd ?? WORKSPACE_ROOT];
    for (const [key, value] of Object.entries(command.env ?? {})) {
      args.push("--env", `${key}=${value}`);
    }
    args.push(this.id, ...command.argv);
    const child = this.provider.spawnCli(args);
    // 容器不存在等启动失败经 onExit（非零退出码）表达，与进程死亡同通道
    return Promise.resolve(
      createChildProcessChannel(child, `docker-sandbox:${this.id}`)
    );
  }

  async writeFile(file: string, content: Uint8Array): Promise<void> {
    this.assertLive();
    const target = containedPath(file);
    await this.provider.cliChecked([
      "exec",
      this.id,
      "mkdir",
      "-p",
      path.posix.dirname(target),
    ]);
    // dd（busybox/GNU 通用）直接落盘原始字节；无需 shell，argv 无引用问题
    await this.streamToProcess(
      ["exec", "-i", this.id, "dd", `of=${target}`, "status=none"],
      content
    );
  }

  readFile(file: string): Promise<Uint8Array> {
    this.assertLive();
    const target = containedPath(file);
    const child = this.provider.spawnCli([
      "exec",
      "-i",
      this.id,
      "cat",
      target,
    ]);
    return collectProcess(child, `docker-sandbox:${this.id}:readFile`);
  }

  renew(): Promise<void> {
    this.assertLive();
    // docker 无原生 TTL：到期记账在 registry（Leasing 层调用 renewed），
    // 实际回收靠 release/管理页停止；见 provider 文件头「已知边界」
    return Promise.resolve();
  }

  async status(): Promise<SandboxStatus> {
    if (this.destroyed) {
      return "destroyed";
    }
    const state = await this.provider.containerState(this.id);
    if (state === "missing" || state === "dead") {
      return "destroyed";
    }
    if (state === "paused") {
      return "paused";
    }
    return "ready";
  }

  async destroy(policy: SandboxReleasePolicy): Promise<void> {
    if (policy === "kill") {
      const removed = await this.provider.runCli(["rm", "-f", this.id], {
        timeoutMs: 60_000,
      });
      if (
        removed.code !== 0 &&
        !/No such (object|container)/i.test(removed.stderr)
      ) {
        throw new SandboxUnavailableError("docker-sandbox:destroy-failed");
      }
      this.destroyed = true;
      // 专属 internal 网络一并回收（best-effort：容器已删，网络应为空）
      if (this.network) {
        await this.provider
          .runCli(["network", "rm", this.network], { timeoutMs: 30_000 })
          .catch(() => undefined);
      }
    } else if (policy === "pause") {
      await this.provider.cliChecked(["pause", this.id]);
    }
    // keep：状态不变
  }

  private assertLive(): void {
    if (this.destroyed) {
      throw new SandboxUnavailableError(`docker-sandbox:${this.id}:destroyed`);
    }
  }

  private async streamToProcess(
    args: string[],
    content: Uint8Array
  ): Promise<void> {
    const child = this.provider.spawnCli(args);
    const exit = new Promise<number>((resolve) => {
      child.once("error", () => resolve(-1));
      child.once("exit", (exitCode) => resolve(exitCode ?? -1));
    });
    const written = new Promise<void>((resolve, reject) => {
      child.stdin?.on("error", reject);
      child.stdin?.end(Buffer.from(content), () => resolve());
    });
    const [, code] = await Promise.all([written, exit]);
    if (code !== 0) {
      throw new Error(
        `docker-sandbox:${args.at(-2) ?? ""}:exit:${code ?? "null"}`
      );
    }
  }
}

/** 从 docker 输出取最后一行非空文本（容器 id/inspect 值） */
function lastLine(text: string): string {
  const lines = text.trim().split("\n");
  return lines.at(-1) ?? "";
}

/** 容器名安全化：docker name 仅允许 [a-zA-Z0-9][a-zA-Z0-9_.-]*/
function safeLabel(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 40);
  return /^[a-zA-Z0-9]/.test(cleaned) ? cleaned : `x${cleaned}`;
}

/** 路径遏制：仅 workspace 内可读写（绝对/相对输入都归一到 /workspace 下） */
function containedPath(file: string): string {
  const target = path.posix.resolve(WORKSPACE_ROOT, file);
  if (target !== WORKSPACE_ROOT && !target.startsWith(`${WORKSPACE_ROOT}/`)) {
    throw new Error(`docker-sandbox:path-escape:${file}`);
  }
  return target;
}

/** 收集子进程 stdout 为字节（readFile 用） */
async function collectProcess(
  child: ChildProcess,
  tag: string
): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  child.stdout?.on("data", (chunk: Buffer) => chunks.push(chunk));
  const stderr: Buffer[] = [];
  child.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));
  const code = await new Promise<number | null>((resolve) => {
    child.once("exit", (exitCode) => resolve(exitCode));
  });
  if (code !== 0) {
    throw new Error(
      `${tag}:exit:${code ?? "null"}:${Buffer.concat(stderr).toString("utf8").slice(0, 200)}`
    );
  }
  return new Uint8Array(Buffer.concat(chunks));
}
