import type {
  SandboxProviderName,
  SandboxReleasePolicy,
  SandboxSpec,
} from "@/lib/runtime/sandbox";
import type { SandboxRegistry } from "@/lib/runtime/sandbox/registry";

/** 内存 registry 替身：记录调用并模拟可复用查询（DB 语义的测试面） */
export class InMemorySandboxRegistry implements SandboxRegistry {
  readonly events: Array<
    | { kind: "acquired"; provider: string; externalId: string; runId: string }
    | { kind: "renewed"; provider: string; externalId: string }
    | {
        kind: "released";
        provider: string;
        externalId: string;
        policy: string;
      }
    | { kind: "unavailable"; provider: string; externalId: string }
  > = [];

  /** externalId → 是否可复用（模拟 ready 未过期行） */
  private readonly reusable = new Set<string>();

  markReusable(externalId: string): void {
    this.reusable.add(externalId);
  }

  acquired(
    provider: SandboxProviderName,
    spec: SandboxSpec,
    externalId: string
  ): Promise<void> {
    this.events.push({
      externalId,
      kind: "acquired",
      provider,
      runId: spec.runId,
    });
    this.reusable.add(externalId);
    return Promise.resolve();
  }

  renewed(provider: SandboxProviderName, externalId: string): Promise<void> {
    this.events.push({ externalId, kind: "renewed", provider });
    return Promise.resolve();
  }

  released(
    provider: SandboxProviderName,
    externalId: string,
    policy: SandboxReleasePolicy
  ): Promise<void> {
    this.events.push({
      externalId,
      kind: "released",
      policy,
      provider,
    });
    if (policy === "kill") {
      this.reusable.delete(externalId);
    }
    return Promise.resolve();
  }

  unavailable(provider: SandboxProviderName, externalId: string): Promise<void> {
    this.events.push({ externalId, kind: "unavailable", provider });
    this.reusable.delete(externalId);
    return Promise.resolve();
  }

  reusableExternalId(
    _provider: SandboxProviderName,
    _spec: SandboxSpec
  ): Promise<string | null> {
    // 简化：返回任意一个仍标记可复用的沙箱（足够覆盖 lease 用例）
    for (const id of this.reusable) {
      return Promise.resolve(id);
    }
    return Promise.resolve(null);
  }
}
