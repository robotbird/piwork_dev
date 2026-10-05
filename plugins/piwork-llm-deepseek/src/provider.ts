import type {
  ProviderDefinition,
  ValidateCredentialsContext,
} from "@piwork/model-provider-sdk";

import { modelCatalog } from "./models";

export const DEFAULT_BASE_URL = "https://api.deepseek.com";

const VALIDATION_MODEL = "deepseek-v4-flash";

export const definition: ProviderDefinition = {
  credentialFields: [
    {
      label: { en: "API Key", "zh-CN": "API Key" },
      placeholder: {
        en: "Enter your API Key",
        "zh-CN": "在此输入您的 API Key",
      },
      required: true,
      type: "secret-input",
      variable: "api_key",
    },
  ],
  defaultBaseUrl: DEFAULT_BASE_URL,
  description: {
    en: "Official DeepSeek models with reasoning, tool calling, and native vision in V4.1 Flash.",
    "zh-CN":
      "DeepSeek 官方模型，支持推理、工具调用和 V4.1 Flash 原生视觉理解。",
  },
  help: {
    title: {
      en: "Get your API Key from deepseek",
      "zh-CN": "从深度求索获取 API Key",
    },
    url: {
      en: "https://platform.deepseek.com/api_keys",
      "zh-CN": "https://platform.deepseek.com/api_keys",
    },
  },
  models: modelCatalog,
  name: { en: "deepseek", "zh-CN": "深度求索" },
  networkHosts: ["api.deepseek.com"],
  provider: "deepseek",
};

/**
 * 凭据验证：发送一次 max_tokens=1 的最小补全请求。
 * 等价于 Dify OAICompatLargeLanguageModel.validate_credentials 的探测行为。
 */
export async function validateCredentials(
  ctx: ValidateCredentialsContext
): Promise<void> {
  const apiKey =
    typeof ctx.credentials.api_key === "string"
      ? ctx.credentials.api_key.trim()
      : "";
  if (!apiKey) {
    throw new Error("api_key is required");
  }

  const response = await ctx.fetch(`${DEFAULT_BASE_URL}/chat/completions`, {
    body: JSON.stringify({
      max_tokens: 1,
      messages: [{ content: "ping", role: "user" }],
      model: VALIDATION_MODEL,
      stream: false,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
    signal: ctx.signal,
  });

  if (response.ok) {
    return;
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error(`Invalid API key (HTTP ${response.status})`);
  }
  throw new Error(
    `Credential validation failed: HTTP ${response.status} ${response.statusText}`
  );
}
