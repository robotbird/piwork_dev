import type {
  ProviderDefinition,
  ValidateCredentialsContext,
} from "@piwork/model-provider-sdk";

import { modelCatalog } from "./models";

export const DEFAULT_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

const DEFAULT_VALIDATE_MODEL = "glm-5-turbo";

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
    {
      default: DEFAULT_BASE_URL,
      label: { en: "API Base URL", "zh-CN": "API Base URL" },
      placeholder: {
        en: "Enter your API Base URL",
        "zh-CN": "输入您的 API Base URL",
      },
      required: false,
      type: "text-input",
      variable: "base_url",
    },
    {
      default: DEFAULT_VALIDATE_MODEL,
      label: {
        en: "Validate Model Name",
        "zh-CN": "验证模型名称",
      },
      placeholder: {
        en: "Model name used to test credentials (default glm-5-turbo)",
        "zh-CN": "用于连通性测试的模型名称（默认 glm-5-turbo）",
      },
      required: false,
      type: "text-input",
      variable: "validate_model",
    },
  ],
  description: {
    en: "Official ZHIPU AI models: the GLM chat family with thinking mode, tool calling, and vision.",
    "zh-CN":
      "智谱 AI 官方模型：GLM 全系对话模型，支持思考模式、工具调用与视觉理解。",
  },
  help: {
    title: {
      en: "Get your API key from ZHIPU AI",
      "zh-CN": "从智谱 AI 获取 API Key",
    },
    url: {
      en: "https://open.bigmodel.cn/usercenter/apikeys",
      "zh-CN": "https://open.bigmodel.cn/usercenter/apikeys",
    },
  },
  models: modelCatalog,
  name: { en: "ZHIPU AI", "zh-CN": "智谱 AI" },
  networkHosts: ["open.bigmodel.cn"],
  provider: "zhipuai",
};

/** 凭据 base_url 覆盖默认地址；空值回退官方开放平台端点 */
export function resolveBaseUrl(
  credentials: Readonly<Record<string, unknown>>
): string {
  const baseUrl =
    typeof credentials.base_url === "string"
      ? credentials.base_url.trim().replace(/\/+$/, "")
      : "";
  return baseUrl || DEFAULT_BASE_URL;
}

/**
 * 凭据验证：发送一次 max_tokens=1 的最小补全请求。
 * 等价于 Dify ZhipuAILargeLanguageModel.validate_credentials 的探测行为；
 * validate_model 可覆盖探测模型（私有兼容端点可能托管不同模型名）。
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
  const validateModel =
    typeof ctx.credentials.validate_model === "string" &&
    ctx.credentials.validate_model.trim()
      ? ctx.credentials.validate_model.trim()
      : DEFAULT_VALIDATE_MODEL;

  const response = await ctx.fetch(
    `${resolveBaseUrl(ctx.credentials)}/chat/completions`,
    {
      body: JSON.stringify({
        max_tokens: 1,
        messages: [{ content: "ping", role: "user" }],
        model: validateModel,
        stream: false,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: ctx.signal,
    }
  );

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
