import type { ProviderModelDefinition } from "@piwork/model-provider-sdk";

/**
 * piwork-llm-zhipuai 模型目录：由 Dify langgenius-zhipuai_0.0.35 的
 * models/llm/*.yaml 迁移而来（43 个对话模型，按 _position.yaml 排序）。
 * 价格已按 Dify pricing unit 折算为每百万 token；汇率与刊例价以供应商官网为准。
 */
export const modelCatalog: ProviderModelDefinition[] = [
  {
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "glm-5.3",
    },
    modelId: "glm-5.3",
    modelType: "llm",
    parameterRules: [
      {
        default: 65_536,
        max: 131_072,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: "max",
        help: {
          en: "Controls the model's reasoning effort. GLM-5.3 always uses thinking mode.",
          "zh-CN": "控制模型的思考强度。GLM-5.3 始终启用思考模式。",
        },
        label: {
          en: "Reasoning Effort",
          "zh-CN": "思考强度",
        },
        name: "reasoning_effort",
        options: ["low", "high", "max"],
        type: "string",
      },
      {
        help: {
          en: "Specifies the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 8,
      output: 28,
    },
    properties: {
      contextSize: 1_000_000,
      defaultMaxTokens: 65_536,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: true,
    },
    label: {
      en: "glm-5.3-flash",
    },
    modelId: "glm-5.3-flash",
    modelType: "llm",
    parameterRules: [
      {
        default: 65_536,
        max: 131_072,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: "max",
        help: {
          en: "Controls the model's reasoning effort. GLM-5.3-Flash always uses thinking mode.",
          "zh-CN": "控制模型的思考强度。GLM-5.3-Flash 始终启用思考模式。",
        },
        label: {
          en: "Reasoning Effort",
          "zh-CN": "思考强度",
        },
        name: "reasoning_effort",
        options: ["low", "high", "max"],
        type: "string",
      },
      {
        help: {
          en: "Specifies the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.8,
      output: 2.8,
    },
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
    label: {
      en: "glm-5.2",
    },
    modelId: "glm-5.2",
    modelType: "llm",
    parameterRules: [
      {
        default: 65_536,
        max: 131_072,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: "Controls whether the model uses Internet search results while generating text.",
          "zh-CN": "控制模型是否在生成文本时参考互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        default: true,
        help: {
          en: "Controls the model's reasoning. GLM-5.2 uses dynamic thinking by default and allows it to be disabled.",
          "zh-CN": "控制模型的推理能力。GLM-5.2 默认启用动态思考，也允许关闭。",
        },
        label: {
          en: "Thinking Mode",
          "zh-CN": "推理模式",
        },
        name: "thinking",
        type: "boolean",
      },
      {
        default: "max",
        help: {
          en: "Controls reasoning effort. none/minimal disable thinking, low/medium map to high, and xhigh maps to max.",
          "zh-CN":
            "控制思考强度。none/minimal 关闭思考，low/medium 映射为 high，xhigh 映射为 max。",
        },
        label: {
          en: "Reasoning Effort",
          "zh-CN": "思考强度",
        },
        name: "reasoning_effort",
        options: ["none", "minimal", "low", "medium", "high", "xhigh", "max"],
        type: "string",
      },
      {
        help: {
          en: "Specifies the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 8,
      output: 28,
    },
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
    label: {
      en: "glm-5.1",
    },
    modelId: "glm-5.1",
    modelType: "llm",
    parameterRules: [
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Controls the model's thinking capability.",
          "zh-CN": "控制模型的推理能力。",
        },
        label: {
          en: "Thinking Mode",
          "zh-CN": "推理模式",
        },
        name: "thinking",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 6,
      output: 24,
    },
    properties: {
      contextSize: 204_800,
      defaultMaxTokens: 131_072,
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
      en: "glm-5v-turbo",
    },
    modelId: "glm-5v-turbo",
    modelType: "llm",
    parameterRules: [
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Controls the model's thinking capability.",
          "zh-CN": "控制模型的推理能力。",
        },
        label: {
          en: "Thinking Mode",
          "zh-CN": "推理模式",
        },
        name: "thinking",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 5,
      output: 22,
    },
    properties: {
      contextSize: 204_800,
      defaultMaxTokens: 131_072,
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
    label: {
      en: "glm-5-turbo",
    },
    modelId: "glm-5-turbo",
    modelType: "llm",
    parameterRules: [
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Controls the model's thinking capability.",
          "zh-CN": "控制模型的推理能力。",
        },
        label: {
          en: "Thinking Mode",
          "zh-CN": "推理模式",
        },
        name: "thinking",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 5,
      output: 22,
    },
    properties: {
      contextSize: 204_800,
      defaultMaxTokens: 131_072,
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
    label: {
      en: "glm-5",
    },
    modelId: "glm-5",
    modelType: "llm",
    parameterRules: [
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Controls the model's thinking capability.",
          "zh-CN": "控制模型的推理能力。",
        },
        label: {
          en: "Thinking Mode",
          "zh-CN": "推理模式",
        },
        name: "thinking",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 4,
      output: 18,
    },
    properties: {
      contextSize: 204_800,
      defaultMaxTokens: 131_072,
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
    label: {
      en: "glm-4.7",
    },
    modelId: "glm-4.7",
    modelType: "llm",
    parameterRules: [
      {
        default: 1,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 1.0. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 1.0 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.95,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.95. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.95 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 4096,
        max: 131_072,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Controls the model's thinking capability.",
          "zh-CN": "控制模型的推理能力。",
        },
        label: {
          en: "Thinking Mode",
          "zh-CN": "推理模式",
        },
        name: "thinking",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 2,
      output: 8,
    },
    properties: {
      contextSize: 200_000,
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
    label: {
      en: "glm-4.7-flash",
    },
    modelId: "glm-4.7-flash",
    modelType: "llm",
    parameterRules: [
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Controls the model's thinking capability.",
          "zh-CN": "控制模型的推理能力。",
        },
        label: {
          en: "Thinking Mode",
          "zh-CN": "推理模式",
        },
        name: "thinking",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0,
      output: 0,
    },
    properties: {
      contextSize: 204_800,
      defaultMaxTokens: 131_072,
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
    label: {
      en: "glm-4.7-flashx",
    },
    modelId: "glm-4.7-flashx",
    modelType: "llm",
    parameterRules: [
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Controls the model's thinking capability.",
          "zh-CN": "控制模型的推理能力。",
        },
        label: {
          en: "Thinking Mode",
          "zh-CN": "推理模式",
        },
        name: "thinking",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.5,
      output: 3,
    },
    properties: {
      contextSize: 204_800,
      defaultMaxTokens: 131_072,
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
    label: {
      en: "glm-4.6",
    },
    modelId: "glm-4.6",
    modelType: "llm",
    parameterRules: [
      {
        default: 1,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 1.0. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 1.0 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.95,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.95. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.95 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 4096,
        max: 131_072,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Controls the model's thinking capability.",
          "zh-CN": "控制模型的推理能力。",
        },
        label: {
          en: "Thinking Mode",
          "zh-CN": "推理模式",
        },
        name: "thinking",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 2,
      output: 8,
    },
    properties: {
      contextSize: 200_000,
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
    label: {
      en: "glm-4.5",
    },
    modelId: "glm-4.5",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 1024,
        max: 98_304,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Controls the model's thinking capability.",
          "zh-CN": "控制模型的推理能力。",
        },
        label: {
          en: "Thinking Mode",
          "zh-CN": "推理模式",
        },
        name: "thinking",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 2,
      output: 8,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 1024,
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
    label: {
      en: "glm-4.5-x",
    },
    modelId: "glm-4.5-x",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 1024,
        max: 98_304,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Controls the model's thinking capability.",
          "zh-CN": "控制模型的推理能力。",
        },
        label: {
          en: "Thinking Mode",
          "zh-CN": "推理模式",
        },
        name: "thinking",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 8,
      output: 16,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 1024,
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
    label: {
      en: "glm-4.5-air",
    },
    modelId: "glm-4.5-air",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 1024,
        max: 98_304,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Controls the model's thinking capability.",
          "zh-CN": "控制模型的推理能力。",
        },
        label: {
          en: "Thinking Mode",
          "zh-CN": "推理模式",
        },
        name: "thinking",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.8,
      output: 2,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 1024,
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
    label: {
      en: "glm-4.5-airx",
    },
    modelId: "glm-4.5-airx",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 1024,
        max: 98_304,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Controls the model's thinking capability.",
          "zh-CN": "控制模型的推理能力。",
        },
        label: {
          en: "Thinking Mode",
          "zh-CN": "推理模式",
        },
        name: "thinking",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 4,
      output: 12,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 1024,
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
    label: {
      en: "glm-4.5-flash",
    },
    modelId: "glm-4.5-flash",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 1024,
        max: 98_304,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Controls the model's thinking capability.",
          "zh-CN": "控制模型的推理能力。",
        },
        label: {
          en: "Thinking Mode",
          "zh-CN": "推理模式",
        },
        name: "thinking",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0,
      output: 0,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 1024,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: true,
      streamToolCall: false,
      toolCall: false,
      vision: true,
    },
    label: {
      en: "glm-4.5v",
    },
    modelId: "glm-4.5v",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 16_384,
        max: 16_384,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: "Controls the model's thinking capability.",
          "zh-CN": "控制模型的推理能力。",
        },
        label: {
          en: "Thinking Mode",
          "zh-CN": "推理模式",
        },
        name: "thinking",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 2,
      output: 6,
    },
    properties: {
      contextSize: 16_384,
      defaultMaxTokens: 16_384,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: true,
      streamToolCall: false,
      toolCall: false,
      vision: true,
    },
    label: {
      en: "glm-4.1v-thinking-flash",
    },
    modelId: "glm-4.1v-thinking-flash",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 1024,
        max: 4095,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: "Controls the model's thinking capability.",
          "zh-CN": "控制模型的推理能力。",
        },
        label: {
          en: "Thinking Mode",
          "zh-CN": "推理模式",
        },
        name: "thinking",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0,
      output: 0,
    },
    properties: {
      contextSize: 65_536,
      defaultMaxTokens: 1024,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: true,
      streamToolCall: false,
      toolCall: false,
      vision: true,
    },
    label: {
      en: "glm-4.1v-thinking-flashx",
    },
    modelId: "glm-4.1v-thinking-flashx",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 1024,
        max: 4095,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: "Controls the model's thinking capability.",
          "zh-CN": "控制模型的推理能力。",
        },
        label: {
          en: "Thinking Mode",
          "zh-CN": "推理模式",
        },
        name: "thinking",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 2,
      output: 2,
    },
    properties: {
      contextSize: 65_536,
      defaultMaxTokens: 1024,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "glm-4-plus",
    },
    modelId: "glm-4-plus",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 1024,
        max: 4095,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 5,
      output: 5,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 1024,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "glm-4",
    },
    modelId: "glm-4",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 1024,
        max: 4095,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 100,
      output: 100,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 1024,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "glm-4-0520",
    },
    modelId: "glm-4-0520",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 1024,
        max: 4095,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 100,
      output: 50,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 1024,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "glm-4-air",
    },
    modelId: "glm-4-air",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 1024,
        max: 4095,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.5,
      output: 0.5,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 1024,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "glm-4-air-0111",
    },
    modelId: "glm-4-air-0111",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 1024,
        max: 4095,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.5,
      output: 0.5,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 1024,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "glm-4-air-250414",
    },
    modelId: "glm-4-air-250414",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 1024,
        max: 4095,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.5,
      output: 0.5,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 1024,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "glm-4-airx",
    },
    modelId: "glm-4-airx",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 1024,
        max: 4095,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 10,
      output: 10,
    },
    properties: {
      contextSize: 8192,
      defaultMaxTokens: 1024,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "glm-4-flash",
    },
    modelId: "glm-4-flash",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 1024,
        max: 4095,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0,
      output: 0,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 1024,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "glm-4-flash-250414",
    },
    modelId: "glm-4-flash-250414",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 1024,
        max: 4095,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0,
      output: 0,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 1024,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "glm-4-flashx",
    },
    modelId: "glm-4-flashx",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 1024,
        max: 4095,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.1,
      output: 0.1,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 1024,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "glm-4-flashx-250414",
    },
    modelId: "glm-4-flashx-250414",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 1024,
        max: 4095,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.1,
      output: 0.1,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 1024,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "glm-4-long",
    },
    modelId: "glm-4-long",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 1024,
        max: 4095,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 1,
      output: 1,
    },
    properties: {
      contextSize: 1_048_576,
      defaultMaxTokens: 1024,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: false,
      toolCall: false,
      vision: true,
    },
    label: {
      en: "glm-4v",
    },
    modelId: "glm-4v",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 1024,
        max: 1024,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 50,
      output: 50,
    },
    properties: {
      contextSize: 8192,
      defaultMaxTokens: 1024,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: false,
      toolCall: false,
      vision: true,
    },
    label: {
      en: "glm-4v-flash",
    },
    modelId: "glm-4v-flash",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 1024,
        max: 1024,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0,
      output: 0,
    },
    properties: {
      contextSize: 4096,
      defaultMaxTokens: 1024,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: false,
      toolCall: false,
      vision: true,
    },
    label: {
      en: "glm-4v-plus",
    },
    modelId: "glm-4v-plus",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 1024,
        max: 1024,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 4,
      output: 4,
    },
    properties: {
      contextSize: 8192,
      defaultMaxTokens: 1024,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: false,
      toolCall: false,
      vision: true,
    },
    label: {
      en: "glm-4v-plus-0111",
    },
    modelId: "glm-4v-plus-0111",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 1024,
        max: 1024,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 4,
      output: 4,
    },
    properties: {
      contextSize: 16_384,
      defaultMaxTokens: 1024,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: false,
      vision: false,
    },
    label: {
      en: "glm-z1-air",
    },
    modelId: "glm-z1-air",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 8192,
        max: 30_720,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.5,
      output: 0.5,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 8192,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: false,
      vision: false,
    },
    label: {
      en: "glm-z1-airx",
    },
    modelId: "glm-z1-airx",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 8192,
        max: 30_720,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 5,
      output: 5,
    },
    properties: {
      contextSize: 32_768,
      defaultMaxTokens: 8192,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: false,
      vision: false,
    },
    label: {
      en: "glm-z1-flash",
    },
    modelId: "glm-z1-flash",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 8192,
        max: 30_720,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0,
      output: 0,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 8192,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: false,
      vision: false,
    },
    label: {
      en: "glm-z1-flashx",
    },
    modelId: "glm-z1-flashx",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 8192,
        max: 30_720,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.1,
      output: 0.1,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 8192,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "glm-3-turbo",
    },
    modelId: "glm-3-turbo",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 1024,
        max: 8192,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 1,
      output: 1,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 1024,
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
      en: "glm-4.6v-flash",
    },
    modelId: "glm-4.6v-flash",
    modelType: "llm",
    parameterRules: [
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Controls the model's thinking capability.",
          "zh-CN": "控制模型的推理能力。",
        },
        label: {
          en: "Thinking Mode",
          "zh-CN": "推理模式",
        },
        name: "thinking",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0,
      output: 0,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 131_072,
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
      en: "glm-4.6v-flashx",
    },
    modelId: "glm-4.6v-flashx",
    modelType: "llm",
    parameterRules: [
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            "模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑“自行判断”是否使用互联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "web_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Controls the model's thinking capability.",
          "zh-CN": "控制模型的推理能力。",
        },
        label: {
          en: "Thinking Mode",
          "zh-CN": "推理模式",
        },
        name: "thinking",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.15,
      output: 1.5,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 131_072,
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
      en: "glm-4.6v",
    },
    modelId: "glm-4.6v",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.95,
        help: {
          en: "Sampling temperature, controls the randomness of the output, must be a positive number. The value range is (0.0,1.0], which cannot be equal to 0. The default value is 0.95. The larger the value, the more random and creative the output will be; the smaller the value, The output will be more stable or certain. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "采样温度，控制输出的随机性，必须为正数取值范围是：(0.0,1.0]，不能等于 0,默认值为 0.95 值越大，会使输出更随机，更具创造性；值越小，输出会更加稳定或确定建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        max: 1,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.7,
        help: {
          en: "Another method of temperature sampling is called kernel sampling. The value range is (0.0, 1.0) open interval, which cannot be equal to 0 or 1. The default value is 0.7. The model considers the results with top_p probability mass tokens. For example 0.1 means The model decoder only considers tokens from the candidate set with the top 10% probability. It is recommended that you adjust the top_p or temperature parameters according to the application scenario, but do not adjust both parameters at the same time.",
          "zh-CN":
            "用温度取样的另一种方法，称为核取样取值范围是：(0.0, 1.0) 开区间，不能等于 0 或 1，默认值为 0.7 模型考虑具有 top_p 概率质量tokens的结果例如：0.1 意味着模型解码器只考虑从前 10% 的概率的候选集中取 tokens 建议您根据应用场景调整 top_p 或 temperature 参数，但不要同时调整两个参数。",
        },
        name: "top_p",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "When `do_sample` is set to true, the sampling strategy is enabled. When `do_sample` is set to false, the sampling strategies such as `temperature` and `top_p` will not take effect. The default value is true.",
          "zh-CN":
            "do_sample 为 true 时启用采样策略，do_sample 为 false 时采样策略 temperature、top_p 将不生效。默认值为 true。",
        },
        label: {
          en: "Sampling strategy",
          "zh-CN": "采样策略",
        },
        name: "do_sample",
        type: "boolean",
      },
      {
        default: 16_384,
        max: 131_072,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: true,
        help: {
          en: "Controls the model's thinking capability.",
          "zh-CN": "控制模型的推理能力。",
        },
        label: {
          en: "Thinking Mode",
          "zh-CN": "推理模式",
        },
        name: "thinking",
        type: "boolean",
      },
      {
        help: {
          en: "specifying the format that the model must output",
          "zh-CN": "指定模型必须输出的格式",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 1,
      output: 3,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 16_384,
      mode: "chat",
    },
  },
];
