import type {
  ProviderDefinition,
  ValidateCredentialsContext,
} from "@piwork/model-provider-sdk";

import { modelCatalog } from "./models";

/**
 * DashScope OpenAI 兼容模式端点（Dify models/_common.py 的
 * DEFAULT_API_HOST + COMPATIBLE_API_PATH）
 */
export const DEFAULT_BASE_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1";

/** Dify tongyi.py 的连通性探测模型，仅插件内部使用 */
const VALIDATION_MODEL = "qwen-turbo";

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
    en: "Alibaba Cloud Model Studio (DashScope) Tongyi Qwen chat models with thinking mode, tool calling, and vision.",
    "zh-CN": "阿里云百炼通义千问系列模型，支持思考模式、工具调用与视觉理解。",
  },
  help: {
    title: {
      en: "Get your API key from AliCloud",
      "zh-CN": "从阿里云百炼获取 API Key",
    },
    url: {
      en: "https://bailian.console.aliyun.com/?apiKey=1#/api-key",
      "zh-CN": "https://bailian.console.aliyun.com/?apiKey=1#/api-key",
    },
  },
  models: modelCatalog,
  name: { en: "Tongyi", "zh-CN": "通义" },
  networkHosts: ["dashscope.aliyuncs.com"],
  provider: "tongyi",
};

/**
 * 凭据验证：发送一次 max_tokens=1 的最小补全请求。
 * 等价于 Dify TongyiProvider.validate_credentials 的探测行为；
 * Base URL 与探测模型由插件固定提供，管理员只需填写 API Key。
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
