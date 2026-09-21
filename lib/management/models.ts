/**
 * 模型管理页与模型接口共用的视图模型、约束常量与纯函数助手。
 * 数据来自 ModelProvider / ProviderModel 数据表，由接口层组装后下发给页面。
 *
 * 默认模型约定：isDefault 全库至多一条为 true（企业级默认），
 * 由接口在事务中维护；停用或删除默认模型时自动取消默认标记。
 */

export type ProviderProtocol = "openai-compatible";

export type ProviderModelType = "chat" | "multimodal";

/** 供应商列表页的一行 */
export type ModelProviderSummary = {
  createdAt: string;
  description: string | null;
  enabled: boolean;
  id: string;
  /** 该供应商下的模型数量 */
  modelCount: number;
  name: string;
  protocol: ProviderProtocol;
};

/** 供应商详情页的基本配置与模型列表 */
export type ProviderDetailView = {
  apiKey: string;
  baseUrl: string;
  createdAt: string;
  description: string | null;
  enabled: boolean;
  id: string;
  models: ProviderModelItem[];
  name: string;
  protocol: ProviderProtocol;
  updatedAt: string;
};

export type ProviderModelItem = {
  createdAt: string;
  enabled: boolean;
  id: string;
  isDefault: boolean;
  modelId: string;
  name: string;
  type: ProviderModelType;
};

export type ProvidersView = {
  providers: ModelProviderSummary[];
};

export const PROVIDER_NAME_MAX_LENGTH = 128;
export const PROVIDER_DESCRIPTION_MAX_LENGTH = 1024;
export const PROVIDER_BASE_URL_MAX_LENGTH = 2048;
export const PROVIDER_API_KEY_MAX_LENGTH = 512;
export const MODEL_NAME_MAX_LENGTH = 128;
export const MODEL_ID_MAX_LENGTH = 256;

export const PROVIDER_PROTOCOL_LABELS: Record<ProviderProtocol, string> = {
  "openai-compatible": "OpenAI Compatible",
};

export const MODEL_TYPE_LABELS: Record<ProviderModelType, string> = {
  chat: "对话",
  multimodal: "多模态",
};

/** 校验 Base URL：必须是 http(s) 地址且不带查询串与锚点 */
export function isValidBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.search === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}

/** API Key 展示掩码：保留前 3 位与后 4 位，中间用圆点填充 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return "•".repeat(Math.max(apiKey.length, 6));
  }
  return `${apiKey.slice(0, 3)}${"•".repeat(12)}${apiKey.slice(-4)}`;
}

/** 测试连通性的采样请求体（OpenAI 兼容协议） */
export const MODEL_TEST_PROMPT = "ping";

const PROVIDER_TONES = [
  "bg-blue-500/10 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
  "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  "bg-amber-500/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  "bg-violet-500/10 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
  "bg-rose-500/10 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
] as const;

/** 供应商名散列到固定标识配色，刷新后保持不变 */
export function getProviderTone(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return PROVIDER_TONES[hash % PROVIDER_TONES.length];
}

/** 供应商标识展示字：名称首字符（中文或拉丁首字母，取大写） */
export function getProviderInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "?";
  }
  return [...trimmed][0].toUpperCase();
}

/** 列表页时间列格式：YYYY-MM-DD HH:mm（本地时区） */
export function formatStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
