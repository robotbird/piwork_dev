import type {
  ProviderDefinition,
  ValidateCredentialsContext,
} from "@piwork/model-provider-sdk";

import { modelCatalog } from "./models";

export const DEFAULT_API_HOST = "dashscope.aliyuncs.com";
export const COMPATIBLE_API_PATH = "/compatible-mode/v1";

const DEFAULT_BASE_URL = `https://${DEFAULT_API_HOST}${COMPATIBLE_API_PATH}`;

const DEFAULT_VALIDATE_MODEL = "qwen-turbo";

/** DashScope 兼容模式固定携带的 API 路径，归一化 API Host 时需要剥掉 */
const KNOWN_API_PATHS = [
  "/compatible-mode/v1",
  "/api-ws/v1/inference",
  "/api/v1",
];

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
      help: {
        text: {
          en: "Optional. Workspace-specific host such as llm-xxx.cn-beijing.maas.aliyuncs.com, copied from the Model Studio console. Leave empty to keep using the shared DashScope host.",
          "zh-CN":
            "可选。业务空间专属域名，如 llm-xxx.cn-beijing.maas.aliyuncs.com，可从百炼控制台的 API Host 复制。留空则继续使用共享的 DashScope 域名。",
        },
        title: { en: "API Host", "zh-CN": "接入域名" },
      },
      label: { en: "API Host", "zh-CN": "接入域名" },
      placeholder: {
        en: "e.g. llm-xxx.cn-beijing.maas.aliyuncs.com",
        "zh-CN": "例如 llm-xxx.cn-beijing.maas.aliyuncs.com",
      },
      required: false,
      type: "text-input",
      variable: "api_host",
    },
    {
      default: DEFAULT_VALIDATE_MODEL,
      label: {
        en: "Validate Model Name",
        "zh-CN": "验证模型名称",
      },
      placeholder: {
        en: "Model name used to test credentials (default qwen-turbo)",
        "zh-CN": "用于连通性测试的模型名称（默认 qwen-turbo）",
      },
      required: false,
      type: "text-input",
      variable: "validate_model",
    },
  ],
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
 * 归一化 API Host：业务空间域名可能是裸 host，也可能被粘贴成完整
 * Base URL；去掉 scheme 与已知 API 路径后得到 host[:port]。
 * 与 Dify models/_common.py 的 normalize_api_host 行为一致。
 */
export function normalizeApiHost(raw: unknown): string {
  if (typeof raw !== "string") {
    return "";
  }
  let host = raw.trim();
  if (!host) {
    return "";
  }
  host = host.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "").replace(/\/+$/, "");
  for (const path of KNOWN_API_PATHS) {
    if (host.toLowerCase().endsWith(path)) {
      host = host.slice(0, -path.length);
      break;
    }
  }
  return host.replace(/\/+$/, "");
}

/** 兼容模式 Base URL：api_host 优先，否则共享 DashScope 域名 */
export function resolveBaseUrl(
  credentials: Readonly<Record<string, unknown>>
): string {
  const host = normalizeApiHost(credentials.api_host);
  if (host) {
    return `https://${host}${COMPATIBLE_API_PATH}`;
  }
  return DEFAULT_BASE_URL;
}

/**
 * 凭据验证：发送一次 max_tokens=1 的最小补全请求。
 * 等价于 Dify TongyiProvider.validate_credentials 的探测行为；
 * qwen-turbo 在各开通层级普遍可用，可用 validate_model 覆盖。
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
