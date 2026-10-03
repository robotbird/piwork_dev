import type {
  SandboxHandle,
  SandboxProvider,
  SandboxReleasePolicy,
  SandboxSpec,
} from "./index";
import { SandboxUnavailableError } from "./index";
import type { SandboxRegistry } from "./registry";

/**
 * LeasingSandboxProvider：在底座 provider 之上叠 chat 级 lease 语义
 * （opensandbox-integration-spec.md §6 Phase 2/3、§7 lease 粒度）：
 * - acquire 先查 registry 可复用沙箱（同 chat 同镜像 ready 未过期）→ attach；
 *   attach 失败标记 destroyed 并重建（不视为平台故障）；
 * - 生命周期写入 registry（SandboxInstance 表 = 管理页数据源）；
 * - handle 包装：renew/destroy 自动记账。
 * 底座 provider 保持纯基础设施（不做 DB、不做复用决策）——解耦验收：
 * 换底座只换 inner，lease/记账逻辑零改动。
 */
export class LeasingSandboxProvider implements SandboxProvider {
  private readonly inner: SandboxProvider;
  private readonly registry: SandboxRegistry;
  private readonly options: { reuse?: boolean };

  constructor(
    inner: SandboxProvider,
    registry: SandboxRegistry,
    options: { reuse?: boolean } = {},
  ) {
    this.inner = inner;
    this.registry = registry;
    this.options = options;
  }

  get name() {
    return this.inner.name;
  }

  async acquire(spec: SandboxSpec): Promise<SandboxHandle> {
    if (this.options.reuse !== false) {
      const reusable = await this.registry.reusableExternalId(
        this.inner.name,
        spec
      );
      if (reusable) {
        try {
          const handle = await this.inner.attach(reusable);
          await this.registry.acquired(this.inner.name, spec, handle.id);
          return this.wrap(handle, spec);
        } catch (error) {
          // 沙箱已不存在（TTL 到期被回收等）：记账后走新建
          if (!(error instanceof SandboxUnavailableError)) {
            throw error;
          }
          await this.registry.unavailable(this.inner.name, reusable);
        }
      }
    }
    const handle = await this.inner.acquire(spec);
    await this.registry.acquired(this.inner.name, spec, handle.id);
    return this.wrap(handle, spec);
  }

  async attach(externalId: string): Promise<SandboxHandle> {
    return this.wrap(await this.inner.attach(externalId), null);
  }

  async release(
    handle: SandboxHandle,
    policy: SandboxReleasePolicy
  ): Promise<void> {
    await this.inner.release(handle, policy);
    await this.registry.released(this.inner.name, handle.id, policy);
  }

  /** 包装 handle：renew/destroy 同步记账（spec 未定稿前保持透传语义） */
  private wrap(handle: SandboxHandle, spec: SandboxSpec | null): SandboxHandle {
    const { registry } = this;
    const { name: provider } = this.inner;
    const { ttlSeconds: ttl = 3600 } = spec ?? {};
    return {
      destroy: async (policy) => {
        await handle.destroy(policy);
        await registry.released(provider, handle.id, policy);
      },
      id: handle.id,
      readFile: (path) => handle.readFile(path),
      renew: async () => {
        await handle.renew();
        await registry.renewed(provider, handle.id, ttl);
      },
      startProcess: (command) => handle.startProcess(command),
      status: () => handle.status(),
      workspaceRoot: handle.workspaceRoot,
      writeFile: (path, content) => handle.writeFile(path, content),
    };
  }
}

/**
 * TTL 续期循环：每 min(TTL/2, 1h) 续期一次（skill 安全方案 §4.2 /
 * pi-extension-opensandbox 同款节奏）。返回 stop 函数；run 结束（settled/
 * failed/aborted）后必须调用，停止续期即到期销毁。
 */
export function startSandboxRenewalLoop(
  handle: SandboxHandle,
  ttlSeconds: number
): () => void {
  const intervalMs = Math.min((ttlSeconds * 1000) / 2, 60 * 60 * 1000);
  const timer = setInterval(() => {
    handle.renew().catch(() => {
      // 续期失败：保持循环，沙箱侧到期自然回收；backend 的进程退出通道
      // （onExit）才是运行中故障的权威信号
    });
  }, intervalMs);
  // Node 计时器不阻塞进程退出
  if (typeof timer.unref === "function") {
    timer.unref();
  }
  return () => clearInterval(timer);
}
