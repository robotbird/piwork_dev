import {
  type Api,
  type AssistantMessage,
  type Context,
  createModels,
  createProvider,
  envApiKeyAuth,
  fauxAssistantMessage,
  fauxProvider,
  type Message,
  type Model,
  type SimpleStreamOptions,
} from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import type { ChatMessage } from "@/lib/types";
import { getTextFromMessage } from "@/lib/utils";
import { isTestEnvironment } from "../constants";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const EMPTY_USAGE = {
  cacheRead: 0,
  cacheWrite: 0,
  cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0, total: 0 },
  input: 0,
  output: 0,
  totalTokens: 0,
};

const deepseekModels: Model<"openai-completions">[] = [
  {
    api: "openai-completions",
    baseUrl: DEEPSEEK_BASE_URL,
    contextWindow: 128_000,
    cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 },
    id: "deepseek-flash",
    input: ["text"],
    maxTokens: 8192,
    name: "DeepSeek Flash",
    provider: "deepseek",
    reasoning: true,
  },
  {
    api: "openai-completions",
    baseUrl: DEEPSEEK_BASE_URL,
    contextWindow: 128_000,
    cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 },
    id: "deepseek-v4-pro",
    input: ["text"],
    maxTokens: 8192,
    name: "DeepSeek V4 Pro",
    provider: "deepseek",
    reasoning: true,
  },
];

const piModels = createModels();

if (isTestEnvironment) {
  const faux = fauxProvider({
    models: deepseekModels.map(({ id, name, reasoning }) => ({
      id,
      name,
      reasoning,
    })),
    provider: "deepseek",
    tokensPerSecond: 100,
  });

  faux.setResponses(
    Array.from({ length: 200 }, () => (context: Context) => {
      if (context.systemPrompt?.includes("Generate a short chat title")) {
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
} else {
  piModels.setProvider(
    createProvider({
      api: openAICompletionsApi(),
      auth: {
        apiKey: envApiKeyAuth("DeepSeek API key", ["DEEPSEEK_API_KEY"]),
      },
      baseUrl: DEEPSEEK_BASE_URL,
      id: "deepseek",
      models: deepseekModels,
      name: "DeepSeek",
    })
  );
}

function apiModelId(modelId: string) {
  return modelId.startsWith("deepseek/")
    ? modelId.slice("deepseek/".length)
    : modelId;
}

export function getPiModel(modelId: string) {
  const model = piModels.getModel("deepseek", apiModelId(modelId));
  if (!model) {
    throw new Error(`Unsupported DeepSeek model: ${modelId}`);
  }
  return model;
}

function assistantMessage(text: string, modelId: string): AssistantMessage {
  return {
    api: "openai-completions",
    content: [{ text, type: "text" }],
    model: apiModelId(modelId),
    provider: "deepseek",
    role: "assistant",
    stopReason: "stop",
    timestamp: Date.now(),
    usage: EMPTY_USAGE,
  };
}

export function toPiContext(
  messages: ChatMessage[],
  modelId: string,
  systemPrompt: string
): Context {
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

  return { messages: piMessages, systemPrompt };
}

export function streamPiAnswer(
  modelId: string,
  context: Context,
  signal?: AbortSignal
) {
  return piModels.stream(getPiModel(modelId), context, {
    maxRetries: 2,
    signal,
    timeoutMs: 55_000,
  });
}

export function streamPiAgent(
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions
) {
  return piModels.streamSimple(model, context, {
    ...options,
    maxRetries: options?.maxRetries ?? 2,
    timeoutMs: options?.timeoutMs ?? 55_000,
  });
}

export async function completePiText({
  modelId,
  prompt,
  systemPrompt,
}: {
  modelId: string;
  prompt: string;
  systemPrompt: string;
}) {
  const result = await piModels.complete(
    getPiModel(modelId),
    {
      messages: [{ content: prompt, role: "user", timestamp: Date.now() }],
      systemPrompt,
    },
    { maxRetries: 2, timeoutMs: 30_000 }
  );

  if (result.stopReason === "error" || result.stopReason === "aborted") {
    throw new Error(result.errorMessage ?? "DeepSeek request failed");
  }

  return result.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}
