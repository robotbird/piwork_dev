/** 聊天初始选中值：仅在接口返回前占位，实际模型以模型管理平台目录为准 */
export const DEFAULT_CHAT_MODEL = "deepseek/deepseek-flash";

/** artifacts（AI SDK 网关路径）仍引用的标题模型配置 */
export const titleModel = {
  description: "Fast model for title generation",
  id: "deepseek/deepseek-flash",
  name: "DeepSeek Flash",
  provider: "deepseek",
};

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  gatewayOrder?: string[];
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
};

/**
 * 测试环境专用静态清单：e2e 依赖其构造 faux 供应商与合成目录
 * （见 lib/ai/active-models.ts 的 buildTestCatalog），产品路径不使用。
 */
export const chatModels: ChatModel[] = [
  {
    description: "Fast DeepSeek model for everyday questions",
    id: "deepseek/deepseek-flash",
    name: "DeepSeek Flash",
    provider: "deepseek",
  },
  {
    description: "DeepSeek's higher-quality model",
    id: "deepseek/deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    provider: "deepseek",
  },
];

export function getCapabilities(): Record<string, ModelCapabilities> {
  return Object.fromEntries(
    chatModels.map((model) => [
      model.id,
      {
        reasoning: true,
        tools: false,
        vision: model.id === "deepseek/deepseek-flash",
      },
    ])
  );
}

export type ModelAvailability = "healthy" | "impacted" | "unknown";

const knownModelIds = new Set(chatModels.map((m) => m.id));

export function getModelAvailability(modelId: string): ModelAvailability {
  return knownModelIds.has(modelId) ? "healthy" : "unknown";
}
