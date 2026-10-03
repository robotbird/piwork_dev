import { type ChildProcess, spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  type SandboxChannel,
  type SandboxHandle,
  type SandboxProvider,
  type SandboxReleasePolicy,
  type SandboxSpec,
  type SandboxStatus,
  SandboxUnavailableError,
} from "@/lib/runtime/sandbox";
import { createChildProcessChannel } from "@/lib/runtime/sandbox/child-process-channel";

/**
 * TestSandboxProvider：契约测试替身（AGENTS.md 测试替身归 tests/support）。
 * 「沙箱」= 本机临时目录 workspace + 本机子进程——startProcess 真实 spawn，
 * 使 RpcProcessBackend 的 bridge shim / SandboxChannel 语义可在无 Docker
 * 环境下走真进程验证（进程退出、EOF、stdout 分帧都是真的）。
 * 不提供任何隔离：仅用于测试，生产装配不得引用。
 */

type TestSandbox = {
  handle: TestSandboxHandle;
  spec: SandboxSpec;
  workspaceDir: string;
  expiresAt: number;
  renewCount: number;
};

export class TestSandboxProvider implements SandboxProvider {
  readonly name = "test" as const;

  private readonly sandboxes = new Map<string, TestSandbox>();
  private nextId = 0;
  private failNextAcquireCount = 0;

  /** 注入失败：接下来 n 次 acquire 抛 SandboxUnavailableError（fail-closed 用例） */
  failNextAcquires(n: number): void {
    this.failNextAcquireCount = n;
  }

  async acquire(spec: SandboxSpec): Promise<SandboxHandle> {
    if (this.failNextAcquireCount > 0) {
      this.failNextAcquireCount -= 1;
      throw new SandboxUnavailableError(
        "test-sandbox:acquire-injected-failure"
      );
    }
    this.nextId += 1;
    const id = `test-sbx-${this.nextId}`;
    const workspaceDir = await mkdtemp(
      path.join(tmpdir(), "piwork-test-sandbox-")
    );
    const sandbox: TestSandbox = {
      expiresAt: Date.now() + spec.ttlSeconds * 1000,
      handle: undefined as unknown as TestSandboxHandle,
      renewCount: 0,
      spec,
      workspaceDir,
    };
    sandbox.handle = new TestSandboxHandle(id, sandbox);
    this.sandboxes.set(id, sandbox);
    return sandbox.handle;
  }

  async attach(externalId: string): Promise<SandboxHandle> {
    const sandbox = this.sandboxes.get(externalId);
    if (!sandbox) {
      throw new SandboxUnavailableError(
        `test-sandbox:attach:no-such-sandbox:${externalId}`
      );
    }
    if ((await sandbox.handle.status()) === "destroyed") {
      throw new SandboxUnavailableError(
        `test-sandbox:attach:destroyed:${externalId}`
      );
    }
    return sandbox.handle;
  }

  async release(
    handle: SandboxHandle,
    policy: SandboxReleasePolicy
  ): Promise<void> {
    await handle.destroy(policy);
  }

  /** 测试内省：按 id 取沙箱记录 */
  sandbox(id: string): TestSandbox | undefined {
    return this.sandboxes.get(id);
  }

  get acquiredSpecs(): SandboxSpec[] {
    return [...this.sandboxes.values()].map((s) => s.spec);
  }
}

class TestSandboxHandle implements SandboxHandle {
  private lifecycle: SandboxStatus = "creating";
  private readonly processes = new Set<ChildProcess>();
  private readonly statusTimer?: ReturnType<typeof setTimeout>;
  readonly id: string;
  private readonly sandbox: TestSandbox;

  constructor(id: string, sandbox: TestSandbox) {
    this.id = id;
    this.sandbox = sandbox;
    // 模拟 OpenSandbox 异步 create→ready
    this.statusTimer = setTimeout(() => {
      this.lifecycle = "ready";
    }, 0);
  }

  get workspaceRoot(): string {
    return this.sandbox.workspaceDir;
  }

  startProcess(command: {
    argv: string[];
    cwd?: string;
    env?: Record<string, string>;
  }): Promise<SandboxChannel> {
    this.assertLive();
    const [cmd, ...args] = command.argv;
    const child = spawn(cmd, args, {
      cwd: command.cwd ?? this.sandbox.workspaceDir,
      // 基础 env 最小化（模拟隔离：不整包继承宿主），command.env 为覆盖项
      env: {
        HOME: process.env.HOME ?? tmpdir(),
        LANG: process.env.LANG ?? "en_US.UTF-8",
        NODE_ENV: process.env.NODE_ENV,
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        PIWORK_TEST_SANDBOX: this.id,
        TMPDIR: tmpdir(),
        ...command.env,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.processes.add(child);
    const channel = createChildProcessChannel(child, `test-sandbox:${this.id}`);
    channel.onExit
      .then(() => this.processes.delete(child))
      .catch(() => undefined);
    return Promise.resolve(channel);
  }

  async writeFile(file: string, content: Uint8Array): Promise<void> {
    this.assertLive();
    const target = this.containedPath(file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }

  readFile(file: string): Promise<Uint8Array> {
    this.assertLive();
    const target = this.containedPath(file);
    return readFile(target);
  }

  renew(): Promise<void> {
    this.assertLive();
    this.sandbox.renewCount += 1;
    this.sandbox.expiresAt = Date.now() + this.sandbox.spec.ttlSeconds * 1000;
    return Promise.resolve();
  }

  status(): Promise<SandboxStatus> {
    return Promise.resolve(this.lifecycle);
  }

  destroy(policy: SandboxReleasePolicy): Promise<void> {
    clearTimeout(this.statusTimer);
    if (policy === "kill") {
      for (const child of this.processes) {
        child.kill("SIGKILL");
      }
      this.processes.clear();
      this.lifecycle = "destroyed";
    } else if (policy === "pause") {
      this.lifecycle = "paused";
    }
    // keep：状态不变
    return Promise.resolve();
  }

  private assertLive(): void {
    if (this.lifecycle === "destroyed") {
      throw new SandboxUnavailableError(`test-sandbox:${this.id}:destroyed`);
    }
  }

  /** 路径遏制：仅 workspace 内可读写 */
  private containedPath(file: string): string {
    const root = this.sandbox.workspaceDir + path.sep;
    const target = path.resolve(this.sandbox.workspaceDir, file);
    if (target !== this.sandbox.workspaceDir && !target.startsWith(root)) {
      throw new Error(`test-sandbox:${this.id}:path-escape:${file}`);
    }
    return target;
  }
}
