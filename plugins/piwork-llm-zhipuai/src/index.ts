import { createProvider, type Model } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import type { PiworkLlmExtensionAPI } from "@piwork/model-provider-sdk";

import { modelCatalog } from "./models";
import { DEFAULT_BASE_URL, definition } from "./provider";

export { definition, validateCredentials } from "./provider";

/** 目录模型 → Pi Model（openai-completions 协议 + GLM 兼容参数） */
function toPiModel(
  entry: (typeof modelCatalog)[number],
  providerId: string,
  baseUrl: string
): Model<"openai-completions"> {
  return {
    api: "openai-completions",
    baseUrl,
    compat: {
      maxTokensField: "max_tokens",
      // GLM 协议：thinking: {type} 参数、max_tokens 字段，不发送 store/
      // developer 角色/reasoning_effort（与 pi-ai 对 open.bigmodel.cn 的
      // 官方 URL 自动检测一致，显式声明以覆盖自定义 base_url 场景）
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
      supportsStore: false,
      thinkingFormat: "zai",
    },
    contextWindow: entry.properties.contextSize,
    cost: {
      cacheRead: 0,
      cacheWrite: 0,
      input: entry.pricing?.input ?? 0,
      output: entry.pricing?.output ?? 0,
    },
    id: entry.modelId,
    input: entry.features.vision ? ["text", "image"] : ["text"],
    maxTokens: entry.properties.defaultMaxTokens,
    name: entry.label["zh-CN"] ?? entry.label.en ?? entry.modelId,
    provider: providerId,
    reasoning: entry.features.reasoning,
  };
}

/**
 * 插件入口：activate factory 注册完整 Pi Provider。
 * 协议实现复用 Pi 官方 openai-completions（含 reasoning_content 解析与
 * zai thinking 参数），不自行实现 ProviderStreams。
 */
export default function activate(pi: PiworkLlmExtensionAPI) {
  const { credentials, runtimeProviderId } = pi.context;

  const apiKey =
    typeof credentials.api_key === "string" ? credentials.api_key.trim() : "";
  if (!apiKey) {
    throw new Error("ZHIPU AI plugin requires the api_key credential");
  }

  const baseUrl = DEFAULT_BASE_URL;

  const provider = createProvider({
    api: openAICompletionsApi(),
    auth: {
      // 凭据由宿主在激活时注入；这里封装成静态 ApiKey auth
      apiKey: {
        name: "ZHIPU AI API key",
        resolve: async () => ({
          auth: { apiKey },
          source: "piwork-llm-zhipuai",
        }),
      },
    },
    baseUrl,
    id: runtimeProviderId,
    models: modelCatalog.map((entry) =>
      toPiModel(entry, runtimeProviderId, baseUrl)
    ),
    name: definition.name["zh-CN"] ?? definition.name.en ?? runtimeProviderId,
  });

  pi.registerProvider(provider);
}
