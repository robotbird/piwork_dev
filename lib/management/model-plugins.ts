import type {
  CredentialFieldSchema,
  ProviderDefinition,
  ProviderModelDefinition,
} from "@piwork/model-provider-sdk";

export type ModelPluginCatalogItem = {
  credentialFields: CredentialFieldSchema[];
  description: string;
  installed: boolean;
  models: ProviderModelDefinition[];
  name: string;
  networkHosts: string[];
  packageId: string;
  providerKey: string;
  version: string;
};

export type ModelPluginInstallationView = {
  credentialFields: CredentialFieldSchema[];
  credentialSummary: Record<string, string>;
  credentialsConfigured: boolean;
  defaultModelId: string | null;
  description: string;
  enabled: boolean;
  enabledModels: string[];
  healthStatus: "unknown" | "healthy" | "degraded" | "failed";
  id: string;
  models: ProviderModelDefinition[];
  name: string;
  packageId: string;
  providerKey: string;
  updatedAt: string;
  version: string;
};

export type ModelPluginsView = {
  available: ModelPluginCatalogItem[];
  installed: ModelPluginInstallationView[];
};

export function asProviderDefinition(value: unknown): ProviderDefinition {
  return value as ProviderDefinition;
}
