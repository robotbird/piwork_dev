import type { ProviderModelDefinition } from "@piwork/model-provider-sdk";

/**
 * DeepSeek 模型目录：由 Dify langgenius/deepseek 0.0.24 的
 * models/llm/*.yaml 迁移而来（deepseek-flash / deepseek-v4-flash /
 * deepseek-v4-flash-vision-exp / deepseek-v4-pro）。
 */
export const modelCatalog: ProviderModelDefinition[] = [
  {
    features: {
      reasoning: true,
      streamToolCall: true,
      toolCall: true,
      vision: true,
    },
    label: { en: "DeepSeek V4.1 Flash", "zh-CN": "DeepSeek V4.1 Flash" },
    modelId: "deepseek-flash",
    modelType: "llm",
    parameterRules: [
      {
        default: 1,
        help: {
          en: "Controls randomness in non-thinking mode. Has no effect in thinking mode.",
          "zh-CN": "控制非思考模式下的随机性。思考模式下不生效。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 65_536,
        help: {
          en: "Maximum output tokens, including reasoning, up to 393216. Input and output together must fit within the context window.",
          "zh-CN":
            "输出 token 上限，包含思考内容，最大 393216。输入和输出总长度不能超过上下文限制。",
        },
        max: 393_216,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 1,
        help: {
          en: "Nucleus sampling in thinking mode, from 0.95 to 1.0. Fixed at 1.0 in non-thinking mode.",
          "zh-CN":
            "思考模式下的核采样概率，取值 0.95 至 1.0。非思考模式下固定为 1.0。",
        },
        max: 1,
        min: 0.95,
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "Controls whether DeepSeek thinking mode is enabled. Enabled by default.",
          "zh-CN": "控制是否启用 DeepSeek 的思考模式，默认启用。",
        },
        name: "thinking",
        type: "boolean",
      },
      {
        default: "high",
        help: {
          en: "Controls reasoning effort in thinking mode. The official docs support low, high and max.",
          "zh-CN": "控制思考模式下的推理强度。官方文档支持 low、high 和 max。",
        },
        name: "reasoning_effort",
        options: ["low", "high", "max"],
        type: "string",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    properties: {
      contextSize: 1_000_000,
      defaultMaxTokens: 65_536,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: true,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: { en: "deepseek-v4-flash", "zh-CN": "deepseek-v4-flash" },
    modelId: "deepseek-v4-flash",
    modelType: "llm",
    parameterRules: [
      {
        default: 1,
        help: {
          en: "Control the diversity and randomness of generated results.",
          "zh-CN":
            "控制生成结果的多样性和随机性。数值越小，越严谨；数值越大，越发散。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 4096,
        help: {
          en: "Specifies the upper limit on the length of generated results.",
          "zh-CN": "指定生成结果长度的上限。如果生成结果截断，可以调大该参数。",
        },
        max: 384_000,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 1,
        help: {
          en: "Control the randomness of generated results via nucleus sampling.",
          "zh-CN":
            "控制生成结果的随机性。数值越小，随机性越弱；数值越大，随机性越强。",
        },
        max: 1,
        min: 0.01,
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "Controls whether DeepSeek v4 thinking mode is enabled.",
          "zh-CN": "控制是否启用 DeepSeek v4 的思考模式。",
        },
        name: "thinking",
        type: "boolean",
      },
      {
        default: "high",
        help: {
          en: "Controls reasoning effort in thinking mode. The official docs support low, high and max.",
          "zh-CN": "控制思考模式下的推理强度。官方文档支持 low、high 和 max。",
        },
        name: "reasoning_effort",
        options: ["low", "high", "max"],
        type: "string",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    properties: {
      contextSize: 1_000_000,
      defaultMaxTokens: 4096,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: true,
      streamToolCall: true,
      toolCall: true,
      vision: true,
    },
    label: {
      en: "deepseek-v4-flash-vision-exp",
      "zh-CN": "deepseek-v4-flash-vision-exp",
    },
    modelId: "deepseek-v4-flash-vision-exp",
    modelType: "llm",
    parameterRules: [
      {
        default: 1,
        help: {
          en: "Control the diversity and randomness of generated results.",
          "zh-CN":
            "控制生成结果的多样性和随机性。数值越小，越严谨；数值越大，越发散。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 4096,
        help: {
          en: "Specifies the upper limit on the length of generated results.",
          "zh-CN": "指定生成结果长度的上限。如果生成结果截断，可以调大该参数。",
        },
        max: 384_000,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 1,
        help: {
          en: "Control the randomness of generated results via nucleus sampling.",
          "zh-CN":
            "控制生成结果的随机性。数值越小，随机性越弱；数值越大，随机性越强。",
        },
        max: 1,
        min: 0.01,
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "Controls whether DeepSeek v4 thinking mode is enabled.",
          "zh-CN": "控制是否启用 DeepSeek v4 的思考模式。",
        },
        name: "thinking",
        type: "boolean",
      },
      {
        default: "high",
        help: {
          en: "Controls reasoning effort in thinking mode. The official docs support low, high and max.",
          "zh-CN": "控制思考模式下的推理强度。官方文档支持 low、high 和 max。",
        },
        name: "reasoning_effort",
        options: ["low", "high", "max"],
        type: "string",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    properties: {
      contextSize: 1_000_000,
      defaultMaxTokens: 4096,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: true,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: { en: "deepseek-v4-pro", "zh-CN": "deepseek-v4-pro" },
    modelId: "deepseek-v4-pro",
    modelType: "llm",
    parameterRules: [
      {
        default: 1,
        help: {
          en: "Control the diversity and randomness of generated results.",
          "zh-CN":
            "控制生成结果的多样性和随机性的。数值越小，越严谨；数值越大，越发散。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 4096,
        help: {
          en: "Specifies the upper limit on the length of generated results.",
          "zh-CN": "指定生成结果长度的上限。如果生成结果截断，可以调大该参数。",
        },
        max: 384_000,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 1,
        help: {
          en: "Control the randomness of generated results via nucleus sampling.",
          "zh-CN":
            "控制生成结果的随机性。数值越小，随机性越弱；数值越大，随机性越强。",
        },
        max: 1,
        min: 0.01,
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "Controls whether DeepSeek v4 thinking mode is enabled.",
          "zh-CN": "控制是否启用 DeepSeek v4 的思考模式。",
        },
        name: "thinking",
        type: "boolean",
      },
      {
        default: "high",
        help: {
          en: "Controls reasoning effort in thinking mode. The official docs support low, high and max.",
          "zh-CN": "控制思考模式下的推理强度。官方文档支持 low、high 和 max。",
        },
        name: "reasoning_effort",
        options: ["low", "high", "max"],
        type: "string",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    properties: {
      contextSize: 1_000_000,
      defaultMaxTokens: 4096,
      mode: "chat",
    },
  },
];
