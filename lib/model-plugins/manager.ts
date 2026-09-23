import type { Provider } from "@earendil-works/pi-ai";

import { buildPluginArtifact, type PluginArtifact } from "./build";
import { type PackageInspection, PluginPackageError } from "./contract";
import {
  type ActivateProviderRequest,
  type ActivationSnapshot,
  HostedPiProviderAdapter,
  WorkerThreadPluginHost,
} from "./host/worker-host";
import { inspectPluginZip } from "./inspect";

/**
 * Provider Plugin Manager（架构 §4 的核心深模块）。
 * 外部只看到 inspect/install/activate/resolve；命名规则、ZIP 安全、
 * 构建、隔离加载与生命周期都被藏在实现后面。
 *
 * Phase 0/1 形态：内置与受信任插件使用 WorkerThreadPluginHost；
 * 生产用户上传包需切换 RemotePluginHost（同一 interface 的另一 adapter）。
 */
export class ProviderPluginManager {
  private readonly hosts = new Map<string, WorkerThreadPluginHost>();
  private readonly installations = new Map<string, PluginInstallation>();
  private readonly providers = new Map<string, Provider>();

  inspect(fileName: string, zipBytes: Uint8Array): PackageInspection {
    return inspectPluginZip(fileName, zipBytes);
  }

  /** 检查 + 从源码重建 artifact（不加载执行） */
  async install(
    fileName: string,
    zipBytes: Uint8Array
  ): Promise<PluginInstallation> {
    const inspection = this.inspect(fileName, zipBytes);
    const artifact = await buildPluginArtifact(zipBytes, inspection);
    return {
      artifact,
      inspection,
      installationId: `builtin:${inspection.providerKey}`,
      runtimeProviderId: inspection.providerKey,
    };
  }

  /**
   * 激活：在隔离 worker 中运行插件 activate factory，并在主线程拿到
   * 可注册进 Pi Models registry 的 Provider adapter。
   */
  async activate(
    installation: PluginInstallation,
    credentials: Record<string, unknown>,
    config: Record<string, unknown> = {}
  ): Promise<ActivatedInstallation> {
    if (this.providers.has(installation.runtimeProviderId)) {
      throw new PluginPackageError(
        "already_active",
        `Provider "${installation.runtimeProviderId}" is already registered`
      );
    }

    const host = new WorkerThreadPluginHost();
    const request: ActivateProviderRequest = {
      artifactEntry: installation.artifact.entryPath,
      config,
      credentials,
      installationId: installation.installationId,
      providerId: installation.inspection.providerKey,
      runtimeProviderId: installation.runtimeProviderId,
    };
    let snapshot: ActivationSnapshot;
    try {
      snapshot = await host.activate(request);
    } catch (error) {
      await host.dispose();
      throw error;
    }

    const secretKey = String(credentials.api_key ?? "");
    const adapter = new HostedPiProviderAdapter(snapshot, host, {
      apiKey: secretKey,
      name: `${installation.inspection.name} API key`,
    });

    this.hosts.set(installation.installationId, host);
    this.installations.set(installation.installationId, installation);
    this.providers.set(adapter.id, adapter);

    return {
      definition: snapshot.definition,
      installation,
      provider: adapter,
    };
  }

  async inspectDefinition(
    installation: PluginInstallation
  ): Promise<import("@piwork/model-provider-sdk").ProviderDefinition> {
    const host = new WorkerThreadPluginHost();
    try {
      return await host.inspect(installation.artifact.entryPath);
    } finally {
      await host.dispose();
    }
  }

  /** 通过插件定义校验凭据（真实探测请求，由插件自身实现） */
  async validateCredentials(
    installation: PluginInstallation,
    credentials: Record<string, unknown>,
    config: Record<string, unknown> = {}
  ): Promise<void> {
    const host =
      this.hosts.get(installation.installationId) ??
      new WorkerThreadPluginHost();
    try {
      await host.validateCredentials({
        artifactEntry: installation.artifact.entryPath,
        config,
        credentials,
      });
    } finally {
      if (!this.hosts.has(installation.installationId)) {
        await host.dispose();
      }
    }
  }

  resolvePiProvider(runtimeProviderId: string): Provider | undefined {
    return this.providers.get(runtimeProviderId);
  }

  async deactivate(installationId: string): Promise<void> {
    const host = this.hosts.get(installationId);
    if (!host) {
      return;
    }
    const installation = this.installations.get(installationId);
    this.hosts.delete(installationId);
    if (installation) {
      this.providers.delete(installation.runtimeProviderId);
    }
    await host.dispose();
  }

  async disposeAll(): Promise<void> {
    await Promise.all([...this.hosts.keys()].map((id) => this.deactivate(id)));
  }
}

export type PluginInstallation = {
  artifact: PluginArtifact;
  installationId: string;
  inspection: PackageInspection;
  /** 安装实例在 Pi registry 中的 provider id（Phase 0：内置单实例直接用 provider key） */
  runtimeProviderId: string;
};

export type ActivatedInstallation = {
  definition: import("@piwork/model-provider-sdk").ProviderDefinition;
  installation: PluginInstallation;
  provider: Provider;
};
