// biome-ignore-all lint/performance/noAwaitInLoops: provider activation is intentionally sequential and bounded

import "server-only";

import type { Provider } from "@earendil-works/pi-ai";
import type {
  LocalizedText,
  ProviderDefinition,
  ProviderModelDefinition,
} from "@piwork/model-provider-sdk";

import { listPluginInstallations } from "@/lib/db/model-plugin-queries";

import { getBuiltinPluginPackage } from "./builtin-catalog";
import { decryptPluginCredentials } from "./credentials";
import { ProviderPluginManager } from "./manager";

export type PluginInstallationRuntime = {
  defaultModelId: string | null;
  definition: ProviderDefinition;
  displayName: string;
  installationId: string;
  models: ProviderModelDefinition[];
  provider: Provider;
  providerKey: string;
  runtimeProviderId: string;
};

export function pickLocalizedText(text: LocalizedText): string {
  return text["zh-CN"] ?? text.en ?? Object.values(text)[0] ?? "";
}

let registryPromise: Promise<PluginInstallationRuntime[]> | null = null;
let activeManager: ProviderPluginManager | null = null;

export function resetPluginRegistry(): void {
  registryPromise = null;
  if (activeManager) {
    activeManager.disposeAll().catch((error) => {
      console.warn("[piwork-plugin] failed to dispose plugin hosts", error);
    });
    activeManager = null;
  }
}

export function loadPluginInstallations(): Promise<
  PluginInstallationRuntime[]
> {
  registryPromise ??= buildRegistry().catch((error) => {
    registryPromise = null;
    throw error;
  });
  return registryPromise;
}

async function buildRegistry(): Promise<PluginInstallationRuntime[]> {
  const records = (await listPluginInstallations()).filter(
    (record) => record.enabled && record.credentialsConfigured
  );
  const manager = new ProviderPluginManager();
  activeManager = manager;
  const output: PluginInstallationRuntime[] = [];

  for (const record of records) {
    const pluginPackage = await getBuiltinPluginPackage(record.packageId);
    if (!pluginPackage || pluginPackage.version !== record.version) {
      console.warn(
        `[piwork-plugin] package unavailable: ${record.packageId}@${record.version}`
      );
      continue;
    }
    try {
      const installation = await manager.install(
        pluginPackage.fileName,
        pluginPackage.zipBytes
      );
      installation.installationId = record.id;
      installation.runtimeProviderId = `installation:${record.id}`;
      const activated = await manager.activate(
        installation,
        decryptPluginCredentials(record.encryptedCredentials)
      );
      const enabled = new Set(record.enabledModels);
      output.push({
        defaultModelId: record.defaultModelId,
        definition: activated.definition,
        displayName: record.displayName,
        installationId: record.id,
        models: activated.definition.models.filter((model) =>
          enabled.has(model.modelId)
        ),
        provider: activated.provider,
        providerKey: record.providerKey,
        runtimeProviderId: installation.runtimeProviderId,
      });
    } catch (error) {
      console.warn(
        `[piwork-plugin] failed to activate ${record.packageId}:`,
        error
      );
    }
  }
  return output;
}
