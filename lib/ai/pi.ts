import {
  type AssistantMessage,
  type Context,
  createModels,
  type FauxProviderHandle,
  fauxAssistantMessage,
  fauxProvider,
  type Message,
  type Provider,
} from "@earendil-works/pi-ai";
import {
  type ActiveModelCatalog,
  getActiveModelCatalog,
  getPreferredModelId,
} from "@/lib/ai/active-models";
import { chatModels } from "@/lib/ai/models";
import { loadPluginInstallations } from "@/lib/model-plugins/registry";
import type { ChatMessage } from "@/lib/types";
import { getTextFromMessage } from "@/lib/utils";
import { isTestEnvironment } from "../constants";

const EMPTY_USAGE = {
  cacheRead: 0,
  cacheWrite: 0,
  cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0, total: 0 },
  input: 0,
  output: 0,
  totalTokens: 0,
};

const piModels = createModels();

/** 测试环境的 faux 供应商对象；getActivePiProviders 经它喂给扩展会话 */
let testFauxProvider: Provider | undefined;
/** 测试环境的 faux 注册句柄；契约测试经它重排脚本化响应 */
let testFauxHandle: FauxProviderHandle | undefined;

if (isTestEnvironment) {
  // e2e 专用 faux 供应商：模型清单与 lib/ai/models 的静态测试目录保持一致
  const faux = fauxProvider({
    models: chatModels.map((model) => ({
      id: model.id.split("/")[1] ?? model.id,
      name: model.name,
      reasoning: true,
    })),
    provider: "deepseek",
    tokensPerSecond: 100,
  });
  testFauxProvider = faux.provider;
  testFauxHandle = faux;

  faux.setResponses(
    Array.from({ length: 200 }, () => (context: Context) => {
      // pi-ai 0.87 起会在流式前把 systemPrompt 规范化成首条 system 消息
      // （TranscriptContext 不再有 systemPrompt 字段）；两种形态都检查，
      // 标题判定才不会静默失配。
      const systemText = [
        context.systemPrompt ?? "",
        ...context.messages
          .filter((message) => message.role === "system")
          .map((message) =>
            typeof message.content === "string"
              ? message.content
              : message.content
                  .filter((part) => part.type === "text")
                  .map((part) => part.text)
                  .join(" ")
          ),
      ].join("\n");
      if (systemText.includes("Generate a short chat title")) {
        return fauxAssistantMessage("Test Conversation");
      }

      const prompt = context.messages
        .filter((message) => message.role === "user")
        .map((message) =>
          typeof message.content === "string"
            ? message.content
            : message.content
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join(" ")
        )
        .join(" ")
        .toLowerCase();

      return fauxAssistantMessage(
        prompt.includes("hello") || prompt.includes("hi")
          ? "Hello! How can I help you today?"
          : "This is a mock response for testing."
      );
    })
  );
  piModels.setProvider(faux.provider);
}

/** node:test 契约测试专用：取得 faux 句柄以重排脚本化响应（仅测试环境） */
export function getTestFauxHandle(): FauxProviderHandle | undefined {
  return testFauxHandle;
}

/** 最近一次注册进 pi 的平台目录；引用一致说明缓存未过期，无需重复注册 */
let registeredCatalog: ActiveModelCatalog | undefined;
let registeredPluginProviderIds = new Set<string>();

async function ensurePiProviders(): Promise<void> {
  if (isTestEnvironment) {
    // 测试环境在模块加载时注册 faux 供应商
    return;
  }
  const catalog = await getActiveModelCatalog();
  if (catalog === registeredCatalog) {
    return;
  }
  const plugins = await loadPluginInstallations();
  const nextProviderIds = new Set(
    plugins.map((plugin) => plugin.runtimeProviderId)
  );
  for (const providerId of registeredPluginProviderIds) {
    if (!nextProviderIds.has(providerId)) {
      piModels.deleteProvider(providerId);
    }
  }
  for (const plugin of plugins) {
    piModels.setProvider(plugin.provider);
  }
  registeredPluginProviderIds = nextProviderIds;
  registeredCatalog = catalog;
}

/** 拆分 "{provider}/{modelId}" 复合 id；裸 id 视为 deepseek */
function splitModelId(modelId: string): { model: string; provider: string } {
  const separatorIndex = modelId.indexOf("/");
  if (separatorIndex === -1) {
    return { model: modelId, provider: "deepseek" };
  }
  return {
    model: modelId.slice(separatorIndex + 1),
    provider: modelId.slice(0, separatorIndex),
  };
}

export async function getPiModel(modelId: string) {
  await ensurePiProviders();
  const { model, provider } = splitModelId(modelId);
  const resolved = piModels.getModel(provider, model);
  if (!resolved) {
    throw new Error(`Unsupported chat model: ${modelId}`);
  }
  return resolved;
}

function assistantMessage(text: string, modelId: string): AssistantMessage {
  const { model, provider } = splitModelId(modelId);
  return {
    api: "openai-completions",
    content: [{ text, type: "text" }],
    model,
    provider,
    role: "assistant",
    stopReason: "stop",
    timestamp: Date.now(),
    usage: EMPTY_USAGE,
  };
}

/** 有损重建历史：只保留裁剪文本，工具调用/图片/推理段不回放（与既有行为一致） */
export function toPiHistoryMessages(
  messages: ChatMessage[],
  modelId: string
): Message[] {
  const piMessages: Message[] = [];

  for (const message of messages) {
    const text = getTextFromMessage(message).trim();
    if (!text) {
      continue;
    }
    if (message.role === "assistant") {
      piMessages.push(assistantMessage(text, modelId));
    } else if (message.role === "user") {
      piMessages.push({ content: text, role: "user", timestamp: Date.now() });
    }
  }

  return piMessages;
}

/**
 * 平台当前可用 provider 对象列表（测试环境为 faux 供应商）。
 * createAgentSession 的模型桥（pi.registerProvider）以此注入，
 * 使会话 runtime 与 piModels 单例持有同一批 provider 实例。
 */
export async function getActivePiProviders(): Promise<Provider[]> {
  if (isTestEnvironment) {
    return testFauxProvider ? [testFauxProvider] : [];
  }
  const plugins = await loadPluginInstallations();
  return plugins.map((plugin) => plugin.provider);
}

/**
 * 一次性文本补全（标题生成等）。不传 modelId 时使用平台默认模型；
 * 平台未配置任何模型时直接抛错（标题生成等调用方自行兜底）。
 */
export async function completePiText({
  modelId,
  prompt,
  systemPrompt,
}: {
  modelId?: string;
  prompt: string;
  systemPrompt: string;
}) {
  const catalog = await getActiveModelCatalog();
  const target = modelId ?? getPreferredModelId(catalog);
  if (!target) {
    throw new Error("No model configured on the model management platform");
  }
  const result = await piModels.complete(
    await getPiModel(target),
    {
      messages: [{ content: prompt, role: "user", timestamp: Date.now() }],
      systemPrompt,
    },
    { maxRetries: 2, timeoutMs: 30_000 }
  );

  if (result.stopReason === "error" || result.stopReason === "aborted") {
    throw new Error(result.errorMessage ?? "Model request failed");
  }

  return result.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}
