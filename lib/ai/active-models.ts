import "server-only";

import {
  type ChatModel,
  chatModels,
  DEFAULT_CHAT_MODEL,
  getCapabilities,
  type ModelCapabilities,
} from "@/lib/ai/models";
import { isTestEnvironment } from "@/lib/constants";
import {
  loadPluginInstallations,
  type PluginInstallationRuntime,
  pickLocalizedText,
} from "@/lib/model-plugins/registry";

/** 聊天可见的插件模型目录，不包含凭据。 */
export type ActiveModelCatalog = {
  defaultModelId: string | null;
  models: (ChatModel & { capabilities: ModelCapabilities })[];
};

/** 目录缓存的存活时长：管理端变更最迟在该时长后对聊天生效 */
const CATALOG_TTL_MS = 30_000;

let cache: { catalog: ActiveModelCatalog; expiresAt: number } | null = null;

/** 客户端与接口共用的模型标识："{供应商名}/{Model ID}" */
export function compositeModelId(
  providerName: string,
  modelId: string
): string {
  return `${providerName}/${modelId}`;
}

/** 平台配置的优先模型：默认模型 → 首个模型；未配置时返回 null，由调用方处理 */
export function getPreferredModelId(
  catalog: ActiveModelCatalog
): string | null {
  return catalog.defaultModelId ?? catalog.models[0]?.id ?? null;
}

/**
 * 测试环境专用目录：e2e 依赖模块加载时注册的 faux 供应商与静态模型清单，
 * 不访问数据库。凭证字段留空（faux 供应商不鉴权）。
 */
function buildTestCatalog(): ActiveModelCatalog {
  const capabilities = getCapabilities();
  return {
    defaultModelId: DEFAULT_CHAT_MODEL,
    models: chatModels.map((model) => ({
      ...model,
      capabilities: capabilities[model.id] ?? {
        reasoning: true,
        tools: false,
        vision: false,
      },
      providerKey: model.provider,
      providerName: providerDisplayName(model.provider),
    })),
  };
}

/**
 * 模型管理平台目录（内存缓存 CATALOG_TTL_MS）。
 * 模型管理平台只消费 piwork-llm-* 插件安装实例；
 * 未配置任何启用模型时返回空目录（models 为空数组）；
 * 调用方据此向用户呈现「未配置模型」。
 */
export async function getActiveModelCatalog(): Promise<ActiveModelCatalog> {
  if (isTestEnvironment) {
    return buildTestCatalog();
  }
  if (cache && Date.now() < cache.expiresAt) {
    return cache.catalog;
  }
  const plugins = await loadPluginInstallations();
  const catalog: ActiveModelCatalog = {
    defaultModelId: null,
    models: plugins.flatMap((plugin) => pluginCatalogModels(plugin)),
  };
  const defaultPlugin = plugins.find((plugin) => plugin.defaultModelId);
  if (defaultPlugin?.defaultModelId) {
    catalog.defaultModelId = compositeModelId(
      defaultPlugin.runtimeProviderId,
      defaultPlugin.defaultModelId
    );
  }
  cache = { catalog, expiresAt: Date.now() + CATALOG_TTL_MS };
  return catalog;
}

export function invalidateActiveModelCatalog(): void {
  cache = null;
}

/** 插件目录模型 → 聊天模型条目（能力来自插件 definition） */
function pluginCatalogModels(
  plugin: PluginInstallationRuntime
): (ChatModel & { capabilities: ModelCapabilities })[] {
  const providerName =
    pickLocalizedText(plugin.definition.name) || plugin.displayName;
  return plugin.models
    .filter((model) => model.modelType === "llm")
    .map((model) => ({
      capabilities: {
        reasoning: model.features.reasoning,
        tools: model.features.toolCall,
        vision: model.features.vision,
      },
      description: "",
      id: compositeModelId(plugin.runtimeProviderId, model.modelId),
      name: pickLocalizedText(model.label),
      provider: plugin.runtimeProviderId,
      providerKey: plugin.providerKey,
      providerName,
    }));
}

/** 供应商展示名回退：无插件 definition 时按 provider key 标题化 */
function providerDisplayName(providerKey: string): string {
  return providerKey
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
