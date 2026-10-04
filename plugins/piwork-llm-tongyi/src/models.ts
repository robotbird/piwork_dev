import type { ProviderModelDefinition } from "@piwork/model-provider-sdk";

/**
 * piwork-llm-tongyi 模型目录：由 Dify langgenius-tongyi_0.2.22 的
 * models/llm/*.yaml 迁移而来（98 个对话模型，按 _position.yaml 排序）。
 * 价格已按 Dify pricing unit 折算为每百万 token；汇率与刊例价以供应商官网为准。
 */
export const modelCatalog: ProviderModelDefinition[] = [
  {
    features: {
      reasoning: true,
      streamToolCall: true,
      toolCall: true,
      vision: true,
    },
    label: {
      en: "qwen3.8-max",
      "zh-CN": "qwen3.8-max",
    },
    modelId: "qwen3.8-max",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.6,
        help: {
          en: "Controls generation randomness. Qwen3.8 Max treats values below 0.6 as 0.6.",
          "zh-CN":
            "控制生成文本的随机性。Qwen3.8 Max 会将低于 0.6 的值按 0.6 处理。",
        },
        max: 1.99,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 131_072,
        help: {
          en: "Specifies the maximum total number of tokens for reasoning and the answer.",
          "zh-CN": "指定思维链与回复合计的最大 Token 数量。",
        },
        max: 131_072,
        min: 1,
        name: "max_completion_tokens",
        type: "int",
      },
      {
        help: {
          en: "Nucleus sampling threshold in the range (0, 1.0]. Higher values increase randomness.",
          "zh-CN":
            "核采样的概率阈值，取值范围为（0, 1.0]。值越大，生成结果越随机。",
        },
        max: 1,
        min: 0.01,
        name: "top_p",
        type: "float",
      },
      {
        default: 20,
        help: {
          en: "The number of candidate tokens sampled at each generation step.",
          "zh-CN": "每步生成时参与采样的候选 Token 数量。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 100,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "Used to make generation reproducible where possible, in the range [0, 2^31-1].",
          "zh-CN":
            "用于尽可能复现相同输入与参数下的生成结果，取值范围为 [0, 2^31-1]。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        max: 2_147_483_647,
        min: 0,
        name: "seed",
        type: "int",
      },
      {
        default: 1.05,
        help: {
          en: "Controls repetition and must be greater than 0; 1.0 applies no penalty.",
          "zh-CN": "控制生成内容的重复度，必须大于 0；1.0 表示不惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            '模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑"自行判断"是否使用互联网搜索结果。',
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "enable_search",
        type: "boolean",
      },
      {
        default: true,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: "xhigh",
        help: {
          en: "Reasoning effort, corresponding to 4096, 16384, or 262144 chain-of-thought tokens.",
          "zh-CN":
            "思考模式的推理强度，分别对应 4096、16384 与 262144 个思维链 Token。",
        },
        label: {
          en: "Reasoning effort",
          "zh-CN": "推理强度",
        },
        name: "reasoning_effort",
        options: ["low", "medium", "xhigh"],
        type: "string",
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
        options: ["text", "json_object", "json_schema"],
        type: "string",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 12,
      output: 36,
    },
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
      en: "qwen3.8-flash",
      "zh-CN": "qwen3.8-flash",
    },
    modelId: "qwen3.8-flash",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 131_072,
        min: 1,
        name: "max_completion_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            '模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑"自行判断"是否使用互联网搜索结果。',
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "enable_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 2048,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 262_144,
        min: 1,
        name: "thinking_budget",
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
        options: ["text", "json_object", "json_schema"],
        type: "string",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.8,
      output: 2.7,
    },
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
    label: {
      en: "qwen3.7-max",
    },
    modelId: "qwen3.7-max",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 65_536,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            '模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑"自行判断"是否使用互联网搜索结果。',
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "enable_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 2048,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 262_144,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "USD",
      input: 12,
      output: 36,
    },
    properties: {
      contextSize: 1_000_000,
      defaultMaxTokens: 8192,
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
      en: "qwen3.7-plus",
      "zh-CN": "qwen3.7-plus",
    },
    modelId: "qwen3.7-plus",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 65_536,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            '模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑"自行判断"是否使用互联网搜索结果。',
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "enable_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 2048,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 262_144,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 2,
      output: 8,
    },
    properties: {
      contextSize: 1_000_000,
      defaultMaxTokens: 8192,
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
      en: "qwen3.7-plus-2026-05-26(Qwen3.7)",
      "zh-CN": "qwen3.7-plus-2026-05-26(Qwen3.7)",
    },
    modelId: "qwen3.7-plus-2026-05-26",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 65_536,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            '模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑"自行判断"是否使用互联网搜索结果。',
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "enable_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 2048,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 262_144,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 2,
      output: 8,
    },
    properties: {
      contextSize: 1_000_000,
      defaultMaxTokens: 8192,
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
      en: "qwen3.7-flash",
      "zh-CN": "qwen3.7-flash",
    },
    modelId: "qwen3.7-flash",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 131_072,
        min: 1,
        name: "max_completion_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            '模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑"自行判断"是否使用互联网搜索结果。',
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "enable_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 2048,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 262_144,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.2,
      output: 0.8,
    },
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
      en: "qwen3.7-flash-2026-07-15(Qwen3.7)",
      "zh-CN": "qwen3.7-flash-2026-07-15(Qwen3.7)",
    },
    modelId: "qwen3.7-flash-2026-07-15",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 131_072,
        min: 1,
        name: "max_completion_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            '模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑"自行判断"是否使用互联网搜索结果。',
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "enable_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 2048,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 262_144,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.2,
      output: 0.8,
    },
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
      en: "qwen3.6-plus",
    },
    modelId: "qwen3.6-plus",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 65_536,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 2048,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 81_920,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 2,
      output: 12,
    },
    properties: {
      contextSize: 1_000_000,
      defaultMaxTokens: 8192,
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
      en: "qwen3.6-plus-2026-04-02(Qwen3.6)",
    },
    modelId: "qwen3.6-plus-2026-04-02",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 65_536,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 2048,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 81_920,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 2,
      output: 12,
    },
    properties: {
      contextSize: 1_000_000,
      defaultMaxTokens: 8192,
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
      en: "qwen3.6-flash-2026-04-16(Qwen3.6)",
    },
    modelId: "qwen3.6-flash-2026-04-16",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 65_536,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 2048,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 81_920,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 1.2,
      output: 7.2,
    },
    properties: {
      contextSize: 1_000_000,
      defaultMaxTokens: 8192,
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
      en: "qwen3.6-flash",
    },
    modelId: "qwen3.6-flash",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 65_536,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 2048,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 81_920,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 1.2,
      output: 7.2,
    },
    properties: {
      contextSize: 1_000_000,
      defaultMaxTokens: 8192,
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
      en: "qwen3.5-plus",
    },
    modelId: "qwen3.5-plus",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 65_536,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 2048,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 81_920,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.8,
      output: 4.8,
    },
    properties: {
      contextSize: 1_000_000,
      defaultMaxTokens: 8192,
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
      en: "qwen3.5-plus-2026-02-15(Qwen3.5)",
    },
    modelId: "qwen3.5-plus-2026-02-15",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 65_536,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 2048,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 81_920,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.8,
      output: 4.8,
    },
    properties: {
      contextSize: 1_000_000,
      defaultMaxTokens: 8192,
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
      en: "qwen3.5-flash",
    },
    modelId: "qwen3.5-flash",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 65_536,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 2048,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 81_920,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.2,
      output: 2,
    },
    properties: {
      contextSize: 1_000_000,
      defaultMaxTokens: 8192,
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
      en: "qwen3.5-flash-2026-02-23(Qwen3.5)",
    },
    modelId: "qwen3.5-flash-2026-02-23",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 65_536,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 2048,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 81_920,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.2,
      output: 2,
    },
    properties: {
      contextSize: 1_000_000,
      defaultMaxTokens: 8192,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: false,
      vision: true,
    },
    label: {
      en: "qvq-max",
    },
    modelId: "qvq-max",
    modelType: "llm",
    parameterRules: [
      {
        default: 2000,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 8192,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 1.6,
      output: 4,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 2000,
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
      en: "qwq-plus",
    },
    modelId: "qwq-plus",
    modelType: "llm",
    parameterRules: [
      {
        default: 2000,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 8192,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 1.6,
      output: 4,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 2000,
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
      en: "kimi-k2.5",
      "zh-CN": "kimi-k2.5",
    },
    modelId: "kimi-k2.5",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.6,
        help: {
          en: "Sampling temperature. Recommended 1.0 for thinking mode, 0.6 for instant mode.",
          "zh-CN":
            "采样温度。思考模式下建议使用 1.0，非思考模式下建议使用 0.6。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.95,
        help: {
          en: "Nucleus sampling parameter. Recommended 0.95 for thinking mode.",
          "zh-CN": "核采样参数。思考模式下建议使用 0.95。",
        },
        max: 1,
        min: 0,
        name: "top_p",
        type: "float",
      },
      {
        default: 1024,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 32_768,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: false,
        help: {
          en: "Enable thinking mode for enhanced reasoning capabilities, suitable for complex logical reasoning, math problems, and coding tasks.",
          "zh-CN":
            "启用深度思考模式，使模型具备强大的推理能力，适合解决复杂的逻辑推理、数学问题和代码编写等任务。",
        },
        label: {
          en: "Thinking Mode",
          "zh-CN": "深度思考",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 512,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 32_768,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 4,
      output: 21,
    },
    properties: {
      contextSize: 262_144,
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
      en: "kimi-k2-thinking",
      "zh-CN": "kimi-k2-thinking",
    },
    modelId: "kimi-k2-thinking",
    modelType: "llm",
    parameterRules: [
      {
        default: 1,
        help: {
          en: "Sampling temperature. Recommended 1.0 for thinking mode.",
          "zh-CN": "采样温度。思考模式下建议使用 1.0。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 1024,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 16_384,
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 4,
      output: 16,
    },
    properties: {
      contextSize: 262_144,
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
      en: "Moonshot-Kimi-K2-Instruct",
      "zh-CN": "Moonshot-Kimi-K2-Instruct",
    },
    modelId: "Moonshot-Kimi-K2-Instruct",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.6,
        help: {
          en: "Sampling temperature.",
          "zh-CN": "采样温度。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 1,
        help: {
          en: "Nucleus sampling parameter.",
          "zh-CN": "核采样参数。",
        },
        max: 1,
        min: 0,
        name: "top_p",
        type: "float",
      },
      {
        default: 0,
        help: {
          en: "Controls the tendency to repeat topics. Positive values encourage new topics.",
          "zh-CN": "用于控制模型生成时的主题重复度。正值会鼓励模型讨论新主题。",
        },
        label: {
          en: "Presence Penalty",
          "zh-CN": "存在惩罚",
        },
        max: 2,
        min: -2,
        name: "presence_penalty",
        type: "float",
      },
      {
        default: 1024,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 8192,
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 4,
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
      reasoning: false,
      streamToolCall: false,
      toolCall: false,
      vision: false,
    },
    label: {
      en: "DeepSeek-R1",
      "zh-CN": "DeepSeek-R1",
    },
    modelId: "deepseek-r1",
    modelType: "llm",
    parameterRules: [
      {
        default: 4096,
        max: 16_384,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 4,
      output: 16,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 4096,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: false,
      toolCall: false,
      vision: false,
    },
    label: {
      en: "DeepSeek-R1-Distill-Qwen-14B",
      "zh-CN": "DeepSeek-R1-Distill-Qwen-14B",
    },
    modelId: "deepseek-r1-distill-qwen-14b",
    modelType: "llm",
    parameterRules: [
      {
        default: 4096,
        max: 8192,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 1,
      output: 3,
    },
    properties: {
      contextSize: 32_000,
      defaultMaxTokens: 4096,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: false,
      toolCall: false,
      vision: false,
    },
    label: {
      en: "DeepSeek-R1-Distill-Qwen-32B",
      "zh-CN": "DeepSeek-R1-Distill-Qwen-32B",
    },
    modelId: "deepseek-r1-distill-qwen-32b",
    modelType: "llm",
    parameterRules: [
      {
        default: 4096,
        max: 8192,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 2,
      output: 6,
    },
    properties: {
      contextSize: 32_000,
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
      en: "DeepSeek-V4-Pro",
      "zh-CN": "DeepSeek-V4-Pro",
    },
    modelId: "deepseek-v4-pro",
    modelType: "llm",
    parameterRules: [
      {
        default: 1,
        name: "temperature",
        type: "float",
      },
      {
        default: 4096,
        help: {
          en: "Specifies the upper limit on the length of generated results. If the generated results are truncated, you can increase this parameter.",
          "zh-CN": "指定生成结果长度的上限。如果生成结果截断，可以调大该参数。",
        },
        max: 393_216,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "Only sample from the top K options for each subsequent token.",
          "zh-CN": "仅从每个后续标记的前 K 个选项中采样。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        name: "top_k",
        type: "int",
      },
      {
        name: "frequency_penalty",
        type: "float",
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
        options: ["text"],
        type: "string",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            '模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑"自行判断"是否使用互联网搜索结果。',
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "enable_search",
        type: "boolean",
      },
      {
        default: true,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 12,
      output: 24,
    },
    properties: {
      contextSize: 1_048_576,
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
      en: "DeepSeek-V4.1-Flash",
      "zh-CN": "DeepSeek-V4.1-Flash",
    },
    modelId: "deepseek-v4.1-flash",
    modelType: "llm",
    parameterRules: [
      {
        default: 1,
        help: {
          en: "Sampling temperature, which controls the diversity of generated text.",
          "zh-CN": "采样温度，控制模型生成文本的多样性。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 393_216,
        help: {
          en: "The maximum number of output tokens, including reasoning and the model response.",
          "zh-CN": "模型输出的最大 Token 数，包含思维链和模型回答。",
        },
        max: 393_216,
        min: 1,
        name: "max_completion_tokens",
        type: "int",
      },
      {
        help: {
          en: "Controls reasoning effort. Values range from 1 to 100; higher values enable stronger reasoning.",
          "zh-CN":
            "控制模型的推理力度，取值范围为 1～100，数值越大推理力度越强。",
        },
        label: {
          en: "Reasoning Effort",
          "zh-CN": "推理强度",
        },
        max: 100,
        min: 1,
        name: "reasoning_effort",
        type: "int",
      },
      {
        help: {
          en: "Specifies the format that the model must output.",
          "zh-CN": "指定模型必须输出的格式。",
        },
        label: {
          en: "Response Format",
          "zh-CN": "回复格式",
        },
        name: "response_format",
        options: ["text", "json_object"],
        type: "string",
      },
      {
        default: false,
        help: {
          en: "Whether to use web search results as a reference when generating text.",
          "zh-CN": "是否在生成文本时参考联网搜索结果。",
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "enable_search",
        type: "boolean",
      },
      {
        default: true,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 2,
      output: 8,
    },
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
    label: {
      en: "DeepSeek-V4-Flash-0731",
      "zh-CN": "DeepSeek-V4-Flash-0731",
    },
    modelId: "deepseek-v4-flash-0731",
    modelType: "llm",
    parameterRules: [
      {
        default: 1,
        name: "temperature",
        type: "float",
      },
      {
        default: 4096,
        help: {
          en: "Specifies the upper limit on the length of generated results. If the generated results are truncated, you can increase this parameter.",
          "zh-CN": "指定生成结果长度的上限。如果生成结果截断，可以调大该参数。",
        },
        max: 393_216,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "Only sample from the top K options for each subsequent token.",
          "zh-CN": "仅从每个后续标记的前 K 个选项中采样。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        name: "top_k",
        type: "int",
      },
      {
        name: "frequency_penalty",
        type: "float",
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
        options: ["text"],
        type: "string",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            '模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑"自行判断"是否使用互联网搜索结果。',
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "enable_search",
        type: "boolean",
      },
      {
        default: true,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 1,
      output: 2,
    },
    properties: {
      contextSize: 1_048_576,
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
      en: "DeepSeek-V4-Flash",
      "zh-CN": "DeepSeek-V4-Flash",
    },
    modelId: "deepseek-v4-flash",
    modelType: "llm",
    parameterRules: [
      {
        default: 1,
        name: "temperature",
        type: "float",
      },
      {
        default: 4096,
        help: {
          en: "Specifies the upper limit on the length of generated results. If the generated results are truncated, you can increase this parameter.",
          "zh-CN": "指定生成结果长度的上限。如果生成结果截断，可以调大该参数。",
        },
        max: 393_216,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "Only sample from the top K options for each subsequent token.",
          "zh-CN": "仅从每个后续标记的前 K 个选项中采样。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        name: "top_k",
        type: "int",
      },
      {
        name: "frequency_penalty",
        type: "float",
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
        options: ["text"],
        type: "string",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            '模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑"自行判断"是否使用互联网搜索结果。',
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "enable_search",
        type: "boolean",
      },
      {
        default: true,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 1,
      output: 2,
    },
    properties: {
      contextSize: 1_048_576,
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
      en: "DeepSeek-V3.2-exp",
      "zh-CN": "DeepSeek-V3.2-exp",
    },
    modelId: "deepseek-v3.2-exp",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.6,
        name: "temperature",
        type: "float",
      },
      {
        default: 4096,
        help: {
          en: "Specifies the upper limit on the length of generated results. If the generated results are truncated, you can increase this parameter.",
          "zh-CN": "指定生成结果长度的上限。如果生成结果截断，可以调大该参数。",
        },
        max: 65_536,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.95,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "Only sample from the top K options for each subsequent token.",
          "zh-CN": "仅从每个后续标记的前 K 个选项中采样。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        name: "top_k",
        type: "int",
      },
      {
        default: 1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        name: "frequency_penalty",
        type: "float",
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
        options: ["text"],
        type: "string",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            '模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑"自行判断"是否使用互联网搜索结果。',
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "enable_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 2,
      output: 3,
    },
    properties: {
      contextSize: 131_072,
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
      en: "DeepSeek-V3.1",
      "zh-CN": "DeepSeek-V3.1",
    },
    modelId: "deepseek-v3.1",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.6,
        name: "temperature",
        type: "float",
      },
      {
        default: 4096,
        help: {
          en: "Specifies the upper limit on the length of generated results. If the generated results are truncated, you can increase this parameter.",
          "zh-CN": "指定生成结果长度的上限。如果生成结果截断，可以调大该参数。",
        },
        max: 65_536,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.95,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "Only sample from the top K options for each subsequent token.",
          "zh-CN": "仅从每个后续标记的前 K 个选项中采样。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        name: "top_k",
        type: "int",
      },
      {
        default: 1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        name: "frequency_penalty",
        type: "float",
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
        options: ["text"],
        type: "string",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            '模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑"自行判断"是否使用互联网搜索结果。',
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "enable_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
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
      defaultMaxTokens: 4096,
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
      en: "DeepSeek-V3",
      "zh-CN": "DeepSeek-V3",
    },
    modelId: "deepseek-v3",
    modelType: "llm",
    parameterRules: [
      {
        name: "temperature",
        type: "float",
      },
      {
        default: 512,
        help: {
          en: "Specifies the upper limit on the length of generated results. If the generated results are truncated, you can increase this parameter.",
          "zh-CN": "指定生成结果长度的上限。如果生成结果截断，可以调大该参数。",
        },
        max: 4096,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "Only sample from the top K options for each subsequent token.",
          "zh-CN": "仅从每个后续标记的前 K 个选项中采样。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        name: "top_k",
        type: "int",
      },
      {
        name: "frequency_penalty",
        type: "float",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 2,
      output: 8,
    },
    properties: {
      contextSize: 64_000,
      defaultMaxTokens: 512,
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
      "zh-CN": "glm-5.2",
    },
    modelId: "glm-5.2",
    modelType: "llm",
    parameterRules: [
      {
        default: 1,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 16_384,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 131_072,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.95,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.99,
        min: 0.01,
        name: "top_p",
        type: "float",
      },
      {
        default: 20,
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
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
      defaultMaxTokens: 16_384,
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
      "zh-CN": "glm-5.1",
    },
    modelId: "glm-5.1",
    modelType: "llm",
    parameterRules: [
      {
        default: 1,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 16_384,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 16_384,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.95,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.99,
        min: 0.01,
        name: "top_p",
        type: "float",
      },
      {
        default: 20,
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 4,
      output: 18,
    },
    properties: {
      contextSize: 202_752,
      defaultMaxTokens: 16_384,
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
      "zh-CN": "glm-5",
    },
    modelId: "glm-5",
    modelType: "llm",
    parameterRules: [
      {
        default: 1,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 16_384,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 16_384,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.95,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.99,
        min: 0.01,
        name: "top_p",
        type: "float",
      },
      {
        default: 20,
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 4,
      output: 18,
    },
    properties: {
      contextSize: 202_752,
      defaultMaxTokens: 16_384,
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
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 16_384,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 16_384,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.99,
        min: 0.01,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 3,
      output: 14,
    },
    properties: {
      contextSize: 202_752,
      defaultMaxTokens: 16_384,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: false,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "MiniMax-M2.5",
      "zh-CN": "MiniMax-M2.5",
    },
    modelId: "MiniMax-M2.5",
    modelType: "llm",
    parameterRules: [
      {
        default: 1,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content (including reasoning chain and reply). It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量（包含思维链和回复），它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 32_768,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.95,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 1,
        min: 0,
        name: "top_p",
        type: "float",
      },
      {
        default: 0,
        help: {
          en: "Controls the diversity of vocabulary in the generated text. Positive values reduce the reuse of words that have already appeared, making the output more diverse.",
          "zh-CN":
            "控制生成文本中词汇的多样性。正值会减少重复使用已出现的词汇，使输出更加多样化。",
        },
        label: {
          en: "Presence penalty",
          "zh-CN": "存在惩罚",
        },
        name: "presence_penalty",
        type: "float",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 2.1,
      output: 8.4,
    },
    properties: {
      contextSize: 196_608,
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
      en: "qwen3-max",
    },
    modelId: "qwen3-max",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 65_536,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 6,
      output: 24,
    },
    properties: {
      contextSize: 262_144,
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
      en: "qwen3-max-2025-09-23",
    },
    modelId: "qwen3-max-2025-09-23",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 65_536,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 6,
      output: 24,
    },
    properties: {
      contextSize: 262_144,
      defaultMaxTokens: 8192,
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
      en: "qwen3-max-2026-01-23",
    },
    modelId: "qwen3-max-2026-01-23",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 65_536,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            '模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑"自行判断"是否使用互联网搜索结果。',
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "enable_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 6,
      output: 24,
    },
    properties: {
      contextSize: 262_144,
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
      en: "qwen3-max-preview",
    },
    modelId: "qwen3-max-preview",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 65_536,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 6,
      output: 24,
    },
    properties: {
      contextSize: 262_144,
      defaultMaxTokens: 8192,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: false,
      toolCall: false,
      vision: false,
    },
    label: {
      en: "qwen3-coder-plus",
    },
    modelId: "qwen3-coder-plus",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 65_536,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 65_536,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 4,
      output: 16,
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
      streamToolCall: false,
      toolCall: false,
      vision: false,
    },
    label: {
      en: "qwen3-coder-480b-a35b-instruct",
    },
    modelId: "qwen3-coder-480b-a35b-instruct",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 65_536,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 65_536,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 6,
      output: 24,
    },
    properties: {
      contextSize: 262_144,
      defaultMaxTokens: 65_536,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: false,
      toolCall: false,
      vision: false,
    },
    label: {
      en: "qwen3-coder-30b-a3b-instruct",
    },
    modelId: "qwen3-coder-30b-a3b-instruct",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 65_536,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 65_536,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 1.5,
      output: 6,
    },
    properties: {
      contextSize: 262_144,
      defaultMaxTokens: 65_536,
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
      en: "qwen3-next-80b-a3b-instruct",
    },
    modelId: "qwen3-next-80b-a3b-instruct",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 32_768,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 1,
      output: 4,
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
      en: "qwen3-next-80b-a3b-thinking",
    },
    modelId: "qwen3-next-80b-a3b-thinking",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 32_768,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        default: 512,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 81_920,
        min: 1,
        name: "thinking_budget",
        type: "int",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 1,
      output: 10,
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
      en: "qwen3-235b-a22b-thinking-2507",
    },
    modelId: "qwen3-235b-a22b-thinking-2507",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 32_768,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        default: 512,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 81_920,
        min: 1,
        name: "thinking_budget",
        type: "int",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 2,
      output: 20,
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
      en: "qwen3-235b-a22b-instruct-2507",
    },
    modelId: "qwen3-235b-a22b-instruct-2507",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 32_768,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
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
      defaultMaxTokens: 8192,
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
      en: "qwen3-235b-a22b",
    },
    modelId: "qwen3-235b-a22b",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 16_384,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 512,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 38_912,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
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
      defaultMaxTokens: 8192,
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
      en: "qwen3-30b-a3b-instruct-2507",
    },
    modelId: "qwen3-30b-a3b-instruct-2507",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 32_768,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 512,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 8192,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.75,
      output: 3,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 8192,
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
      en: "qwen3-30b-a3b",
    },
    modelId: "qwen3-30b-a3b",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 16_384,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 512,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 8192,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.75,
      output: 3,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 8192,
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
      en: "qwen3-32b",
    },
    modelId: "qwen3-32b",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 16_384,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 512,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 8192,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
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
      defaultMaxTokens: 8192,
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
      en: "qwen3-14b",
    },
    modelId: "qwen3-14b",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 8192,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 512,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 8192,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 1,
      output: 4,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 8192,
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
      en: "qwen3-8b",
    },
    modelId: "qwen3-8b",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 8192,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        default: true,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 512,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 8192,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.5,
      output: 2,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 8192,
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
      en: "qwen3-vl-plus",
    },
    modelId: "qwen3-vl-plus",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 32_768,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 1,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 512,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 8192,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 1,
      output: 10,
    },
    properties: {
      contextSize: 262_144,
      defaultMaxTokens: 8192,
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
      en: "qwen3-vl-plus-2025-09-23",
    },
    modelId: "qwen3-vl-plus-2025-09-23",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 32_768,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 1,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 512,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 8192,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 1,
      output: 10,
    },
    properties: {
      contextSize: 262_144,
      defaultMaxTokens: 8192,
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
      en: "qwen3-vl-235b-a22b-instruct",
    },
    modelId: "qwen3-vl-235b-a22b-instruct",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 32_768,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 1,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
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
      defaultMaxTokens: 8192,
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
      en: "qwen3-vl-235b-a22b-thinking",
    },
    modelId: "qwen3-vl-235b-a22b-thinking",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 32_768,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 1,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        default: 512,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 81_920,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 2,
      output: 20,
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
      vision: true,
    },
    label: {
      en: "qwen3-vl-30b-a3b-instruct",
    },
    modelId: "qwen3-vl-30b-a3b-instruct",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 32_768,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 1,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.75,
      output: 3,
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
      vision: true,
    },
    label: {
      en: "qwen3-vl-30b-a3b-thinking",
    },
    modelId: "qwen3-vl-30b-a3b-thinking",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 32_768,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 1,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        default: 512,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 81_920,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.75,
      output: 7.5,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 8192,
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
      en: "qwen-plus-latest(Qwen3)",
    },
    modelId: "qwen-plus-latest",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 32_768,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 2048,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 81_920,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.8,
      output: 2,
    },
    properties: {
      contextSize: 1_000_000,
      defaultMaxTokens: 8192,
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
      en: "qwen-plus-2025-07-28(Qwen3)",
    },
    modelId: "qwen-plus-2025-07-28",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 32_768,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 512,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 81_920,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.8,
      output: 2,
    },
    properties: {
      contextSize: 1_000_000,
      defaultMaxTokens: 8192,
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
      en: "qwen-plus-2025-04-28(Qwen3)",
    },
    modelId: "qwen-plus-2025-04-28",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 16_384,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 512,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 8192,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
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
      defaultMaxTokens: 8192,
      mode: "chat",
    },
  },
  {
    deprecated: true,
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "qwen-plus-0125",
    },
    modelId: "qwen-plus-0125",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 8192,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
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
      defaultMaxTokens: 8192,
      mode: "chat",
    },
  },
  {
    deprecated: true,
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "qwen-plus-0112",
    },
    modelId: "qwen-plus-0112",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 8192,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
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
      defaultMaxTokens: 8192,
      mode: "chat",
    },
  },
  {
    deprecated: true,
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "qwen-plus-1220",
    },
    modelId: "qwen-plus-1220",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 8192,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
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
      defaultMaxTokens: 8192,
      mode: "chat",
    },
  },
  {
    deprecated: true,
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "qwen-plus-chat",
    },
    modelId: "qwen-plus-chat",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 2000,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 2000,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 4,
      output: 12,
    },
    properties: {
      contextSize: 32_768,
      defaultMaxTokens: 2000,
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
      en: "qwen-plus",
    },
    modelId: "qwen-plus",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 32_768,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.8,
      output: 2,
    },
    properties: {
      contextSize: 1_000_000,
      defaultMaxTokens: 8192,
      mode: "chat",
    },
  },
  {
    deprecated: true,
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "qwen-turbo-chat",
    },
    modelId: "qwen-turbo-chat",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 1500,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 1500,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 2,
      output: 6,
    },
    properties: {
      contextSize: 8192,
      defaultMaxTokens: 1500,
      mode: "chat",
    },
  },
  {
    deprecated: true,
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "qwen-turbo",
    },
    modelId: "qwen-turbo",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 2000,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 16_384,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.3,
      output: 3,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 2000,
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
      en: "qwen-max",
    },
    modelId: "qwen-max",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 8192,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 2.4,
      output: 9.6,
    },
    properties: {
      contextSize: 32_768,
      defaultMaxTokens: 8192,
      mode: "chat",
    },
  },
  {
    deprecated: true,
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "qwen-max-longcontext",
    },
    modelId: "qwen-max-longcontext",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8000,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 8000,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 40,
      output: 120,
    },
    properties: {
      contextSize: 32_000,
      defaultMaxTokens: 8000,
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
      en: "qwen-vl-max",
    },
    modelId: "qwen-vl-max",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 2000,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 8192,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
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
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 1.6,
      output: 4,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 2000,
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
      en: "qwen-vl-plus",
    },
    modelId: "qwen-vl-plus",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 2000,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 8192,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
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
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
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
      defaultMaxTokens: 2000,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: false,
      toolCall: false,
      vision: false,
    },
    label: {
      en: "qwen-long",
    },
    modelId: "qwen-long",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 2000,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 32_768,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.5,
      output: 2,
    },
    properties: {
      contextSize: 10_000_000,
      defaultMaxTokens: 2000,
      mode: "chat",
    },
  },
  {
    deprecated: true,
    features: {
      reasoning: false,
      streamToolCall: false,
      toolCall: false,
      vision: false,
    },
    label: {
      en: "qwen-math-plus-latest",
    },
    modelId: "qwen-math-plus-latest",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 3072,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 3072,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 4,
      output: 12,
    },
    properties: {
      contextSize: 4096,
      defaultMaxTokens: 3072,
      mode: "chat",
    },
  },
  {
    deprecated: true,
    features: {
      reasoning: false,
      streamToolCall: false,
      toolCall: false,
      vision: false,
    },
    label: {
      en: "qwen-math-plus-0919",
    },
    modelId: "qwen-math-plus-0919",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 3072,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 3072,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 4,
      output: 12,
    },
    properties: {
      contextSize: 4096,
      defaultMaxTokens: 3072,
      mode: "chat",
    },
  },
  {
    deprecated: true,
    features: {
      reasoning: false,
      streamToolCall: false,
      toolCall: false,
      vision: false,
    },
    label: {
      en: "qwen-math-plus-0816",
    },
    modelId: "qwen-math-plus-0816",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 3072,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 3072,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 4,
      output: 12,
    },
    properties: {
      contextSize: 4096,
      defaultMaxTokens: 3072,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: false,
      toolCall: false,
      vision: false,
    },
    label: {
      en: "qwen-math-plus",
    },
    modelId: "qwen-math-plus",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 3072,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 3072,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 4,
      output: 12,
    },
    properties: {
      contextSize: 4096,
      defaultMaxTokens: 3072,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: false,
      toolCall: false,
      vision: false,
    },
    label: {
      en: "qwen-math-turbo",
    },
    modelId: "qwen-math-turbo",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 3072,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 3072,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 2,
      output: 6,
    },
    properties: {
      contextSize: 4096,
      defaultMaxTokens: 3072,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: false,
      toolCall: false,
      vision: false,
    },
    label: {
      en: "qwen-mt-plus",
    },
    modelId: "qwen-mt-plus",
    modelType: "llm",
    parameterRules: [
      {
        default: "auto",
        label: {
          en: "source language",
          "zh-CN": "源语言",
        },
        name: "source_lang",
        options: [
          "English",
          "Chinese",
          "Traditional Chinese",
          "Russian",
          "Japanese",
          "Korean",
          "Spanish",
          "French",
          "Portuguese",
          "German",
          "Italian",
          "Thai",
          "Vietnamese",
          "Indonesian",
          "Malay",
          "Arabic",
          "Hindi",
          "Hebrew",
          "Burmese",
          "Tamil",
          "Urdu",
          "Bengali",
          "Polish",
          "Dutch",
          "Romanian",
          "Turkish",
          "Khmer",
          "Lao",
          "Cantonese",
          "Czech",
          "Greek",
          "Swedish",
          "Hungarian",
          "Danish",
          "Finnish",
          "Ukrainian",
          "Bulgarian",
          "Serbian",
          "Telugu",
          "Afrikaans",
          "Armenian",
          "Assamese",
          "Asturian",
          "Basque",
          "Belarusian",
          "Bosnian",
          "Catalan",
          "Cebuano",
          "Croatian",
          "Egyptian Arabic",
          "Estonian",
          "Galician",
          "Georgian",
          "Gujarati",
          "Icelandic",
          "Javanese",
          "Kannada",
          "Kazakh",
          "Latvian",
          "Lithuanian",
          "Luxembourgish",
          "Macedonian",
          "Maithili",
          "Maltese",
          "Marathi",
          "Mesopotamian Arabic",
          "Moroccan Arabic",
          "Najdi Arabic",
          "Nepali",
          "North Azerbaijani",
          "North Levantine Arabic",
          "Northern Uzbek",
          "Norwegian Bokmål",
          "Norwegian Nynorsk",
          "Occitan",
          "Odia",
          "Pangasinan",
          "Sicilian",
          "Sindhi",
          "Sinhala",
          "Slovak",
          "Slovenian",
          "South Levantine Arabic",
          "Swahili",
          "Tagalog",
          "Ta’izzi-Adeni Arabic",
          "Tosk Albanian",
          "Tunisian Arabic",
          "Venetian",
          "Waray",
          "Welsh",
          "Western Persian",
          "auto",
        ],
        type: "string",
      },
      {
        default: "Chinese",
        label: {
          en: "target language",
          "zh-CN": "目标语言",
        },
        name: "target_lang",
        options: [
          "English",
          "Chinese",
          "Traditional Chinese",
          "Russian",
          "Japanese",
          "Korean",
          "Spanish",
          "French",
          "Portuguese",
          "German",
          "Italian",
          "Thai",
          "Vietnamese",
          "Indonesian",
          "Malay",
          "Arabic",
          "Hindi",
          "Hebrew",
          "Burmese",
          "Tamil",
          "Urdu",
          "Bengali",
          "Polish",
          "Dutch",
          "Romanian",
          "Turkish",
          "Khmer",
          "Lao",
          "Cantonese",
          "Czech",
          "Greek",
          "Swedish",
          "Hungarian",
          "Danish",
          "Finnish",
          "Ukrainian",
          "Bulgarian",
          "Serbian",
          "Telugu",
          "Afrikaans",
          "Armenian",
          "Assamese",
          "Asturian",
          "Basque",
          "Belarusian",
          "Bosnian",
          "Catalan",
          "Cebuano",
          "Croatian",
          "Egyptian Arabic",
          "Estonian",
          "Galician",
          "Georgian",
          "Gujarati",
          "Icelandic",
          "Javanese",
          "Kannada",
          "Kazakh",
          "Latvian",
          "Lithuanian",
          "Luxembourgish",
          "Macedonian",
          "Maithili",
          "Maltese",
          "Marathi",
          "Mesopotamian Arabic",
          "Moroccan Arabic",
          "Najdi Arabic",
          "Nepali",
          "North Azerbaijani",
          "North Levantine Arabic",
          "Northern Uzbek",
          "Norwegian Bokmål",
          "Norwegian Nynorsk",
          "Occitan",
          "Odia",
          "Pangasinan",
          "Sicilian",
          "Sindhi",
          "Sinhala",
          "Slovak",
          "Slovenian",
          "South Levantine Arabic",
          "Swahili",
          "Tagalog",
          "Ta’izzi-Adeni Arabic",
          "Tosk Albanian",
          "Tunisian Arabic",
          "Venetian",
          "Waray",
          "Welsh",
          "Western Persian",
        ],
        type: "string",
      },
      {
        help: {
          en: "If you want the style of the translation to be more in line with the characteristics of a particular domain, you can describe your domain in a piece of natural language text and provide it to the big model as a hint.",
          "zh-CN":
            "如果您希望翻译的风格更符合某个领域的特性，如法律、政务领域翻译用语应当严肃正式，社交领域用语应当口语化，可以用一段自然语言文本描述您的领域，将其提供给大模型作为提示。",
        },
        label: {
          en: "Domain Tips",
          "zh-CN": "领域提示 (只支持英文)",
        },
        name: "domains",
        type: "string",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 1.8,
      output: 5.4,
    },
    properties: {
      contextSize: 16_384,
      defaultMaxTokens: 4096,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: false,
      toolCall: false,
      vision: false,
    },
    label: {
      en: "qwen-mt-turbo",
    },
    modelId: "qwen-mt-turbo",
    modelType: "llm",
    parameterRules: [
      {
        default: "auto",
        label: {
          en: "source language",
          "zh-CN": "源语言",
        },
        name: "source_lang",
        options: [
          "English",
          "Chinese",
          "Traditional Chinese",
          "Russian",
          "Japanese",
          "Korean",
          "Spanish",
          "French",
          "Portuguese",
          "German",
          "Italian",
          "Thai",
          "Vietnamese",
          "Indonesian",
          "Malay",
          "Arabic",
          "Hindi",
          "Hebrew",
          "Burmese",
          "Tamil",
          "Urdu",
          "Bengali",
          "Polish",
          "Dutch",
          "Romanian",
          "Turkish",
          "Khmer",
          "Lao",
          "Cantonese",
          "Czech",
          "Greek",
          "Swedish",
          "Hungarian",
          "Danish",
          "Finnish",
          "Ukrainian",
          "Bulgarian",
          "Serbian",
          "Telugu",
          "Afrikaans",
          "Armenian",
          "Assamese",
          "Asturian",
          "Basque",
          "Belarusian",
          "Bosnian",
          "Catalan",
          "Cebuano",
          "Croatian",
          "Egyptian Arabic",
          "Estonian",
          "Galician",
          "Georgian",
          "Gujarati",
          "Icelandic",
          "Javanese",
          "Kannada",
          "Kazakh",
          "Latvian",
          "Lithuanian",
          "Luxembourgish",
          "Macedonian",
          "Maithili",
          "Maltese",
          "Marathi",
          "Mesopotamian Arabic",
          "Moroccan Arabic",
          "Najdi Arabic",
          "Nepali",
          "North Azerbaijani",
          "North Levantine Arabic",
          "Northern Uzbek",
          "Norwegian Bokmål",
          "Norwegian Nynorsk",
          "Occitan",
          "Odia",
          "Pangasinan",
          "Sicilian",
          "Sindhi",
          "Sinhala",
          "Slovak",
          "Slovenian",
          "South Levantine Arabic",
          "Swahili",
          "Tagalog",
          "Ta’izzi-Adeni Arabic",
          "Tosk Albanian",
          "Tunisian Arabic",
          "Venetian",
          "Waray",
          "Welsh",
          "Western Persian",
          "auto",
        ],
        type: "string",
      },
      {
        default: "Chinese",
        label: {
          en: "target language",
          "zh-CN": "目标语言",
        },
        name: "target_lang",
        options: [
          "English",
          "Chinese",
          "Traditional Chinese",
          "Russian",
          "Japanese",
          "Korean",
          "Spanish",
          "French",
          "Portuguese",
          "German",
          "Italian",
          "Thai",
          "Vietnamese",
          "Indonesian",
          "Malay",
          "Arabic",
          "Hindi",
          "Hebrew",
          "Burmese",
          "Tamil",
          "Urdu",
          "Bengali",
          "Polish",
          "Dutch",
          "Romanian",
          "Turkish",
          "Khmer",
          "Lao",
          "Cantonese",
          "Czech",
          "Greek",
          "Swedish",
          "Hungarian",
          "Danish",
          "Finnish",
          "Ukrainian",
          "Bulgarian",
          "Serbian",
          "Telugu",
          "Afrikaans",
          "Armenian",
          "Assamese",
          "Asturian",
          "Basque",
          "Belarusian",
          "Bosnian",
          "Catalan",
          "Cebuano",
          "Croatian",
          "Egyptian Arabic",
          "Estonian",
          "Galician",
          "Georgian",
          "Gujarati",
          "Icelandic",
          "Javanese",
          "Kannada",
          "Kazakh",
          "Latvian",
          "Lithuanian",
          "Luxembourgish",
          "Macedonian",
          "Maithili",
          "Maltese",
          "Marathi",
          "Mesopotamian Arabic",
          "Moroccan Arabic",
          "Najdi Arabic",
          "Nepali",
          "North Azerbaijani",
          "North Levantine Arabic",
          "Northern Uzbek",
          "Norwegian Bokmål",
          "Norwegian Nynorsk",
          "Occitan",
          "Odia",
          "Pangasinan",
          "Sicilian",
          "Sindhi",
          "Sinhala",
          "Slovak",
          "Slovenian",
          "South Levantine Arabic",
          "Swahili",
          "Tagalog",
          "Ta’izzi-Adeni Arabic",
          "Tosk Albanian",
          "Tunisian Arabic",
          "Venetian",
          "Waray",
          "Welsh",
          "Western Persian",
        ],
        type: "string",
      },
      {
        help: {
          en: "If you want the style of the translation to be more in line with the characteristics of a particular domain, you can describe your domain in a piece of natural language text and provide it to the big model as a hint.",
          "zh-CN":
            "如果您希望翻译的风格更符合某个领域的特性，如法律、政务领域翻译用语应当严肃正式，社交领域用语应当口语化，可以用一段自然语言文本描述您的领域，将其提供给大模型作为提示。",
        },
        label: {
          en: "Domain Tips",
          "zh-CN": "领域提示 (只支持英文)",
        },
        name: "domains",
        type: "string",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.7,
      output: 1.95,
    },
    properties: {
      contextSize: 16_384,
      defaultMaxTokens: 4096,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: false,
      toolCall: false,
      vision: false,
    },
    label: {
      en: "qwen-coder-turbo",
    },
    modelId: "qwen-coder-turbo",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 8192,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 2,
      output: 6,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 8192,
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
      en: "qwen-flash-2025-07-28(Qwen3)",
    },
    modelId: "qwen-flash-2025-07-28",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 995_904,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 995_904,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.99,
        min: 0.01,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            '模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑"自行判断"是否使用互联网搜索结果。',
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "enable_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 81_920,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 81_920,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.15,
      output: 1.5,
    },
    properties: {
      contextSize: 1_000_000,
      defaultMaxTokens: 995_904,
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
      en: "qwen-flash",
    },
    modelId: "qwen-flash",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 32_768,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 32_768,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.99,
        min: 0.01,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            '模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑"自行判断"是否使用互联网搜索结果。',
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "enable_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 81_920,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 81_920,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.15,
      output: 1.5,
    },
    properties: {
      contextSize: 1_000_000,
      defaultMaxTokens: 32_768,
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
      en: "farui-plus",
    },
    modelId: "farui-plus",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 2000,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 2000,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 20,
      output: 20,
    },
    properties: {
      contextSize: 12_288,
      defaultMaxTokens: 2000,
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
      en: "DeepSeek-V3.2",
      "zh-CN": "DeepSeek-V3.2",
    },
    modelId: "deepseek-v3.2",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.6,
        name: "temperature",
        type: "float",
      },
      {
        default: 4096,
        help: {
          en: "Specifies the upper limit on the length of generated results. If the generated results are truncated, you can increase this parameter.",
          "zh-CN": "指定生成结果长度的上限。如果生成结果截断，可以调大该参数。",
        },
        max: 65_536,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.95,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "Only sample from the top K options for each subsequent token.",
          "zh-CN": "仅从每个后续标记的前 K 个选项中采样。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        name: "top_k",
        type: "int",
      },
      {
        default: 1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        name: "frequency_penalty",
        type: "float",
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
        options: ["text"],
        type: "string",
      },
      {
        default: false,
        help: {
          en: 'The model has a built-in Internet search service. This parameter controls whether the model refers to Internet search results when generating text. When Internet search is enabled, the model will use the search results as reference information in the text generation process, but the model will "judge" whether to use Internet search results based on its internal logic.',
          "zh-CN":
            '模型内置了互联网搜索服务，该参数控制模型在生成文本时是否参考使用互联网搜索结果。启用互联网搜索，模型会将搜索结果作为文本生成过程中的参考信息，但模型会基于其内部逻辑"自行判断"是否使用互联网搜索结果。',
        },
        label: {
          en: "Web Search",
          "zh-CN": "联网搜索",
        },
        name: "enable_search",
        type: "boolean",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 2,
      output: 3,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 4096,
      mode: "chat",
    },
  },
  {
    deprecated: true,
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "qwen-max-0403",
    },
    modelId: "qwen-max-0403",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 2000,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 2000,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 40,
      output: 120,
    },
    properties: {
      contextSize: 8000,
      defaultMaxTokens: 2000,
      mode: "chat",
    },
  },
  {
    deprecated: true,
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "qwen-plus-0723",
    },
    modelId: "qwen-plus-0723",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8000,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 8000,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 4,
      output: 12,
    },
    properties: {
      contextSize: 32_000,
      defaultMaxTokens: 8000,
      mode: "chat",
    },
  },
  {
    deprecated: true,
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "qwen-plus-0806",
    },
    modelId: "qwen-plus-0806",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 8192,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
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
      defaultMaxTokens: 8192,
      mode: "chat",
    },
  },
  {
    deprecated: true,
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "qwen-plus-0919",
    },
    modelId: "qwen-plus-0919",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 8192,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
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
      defaultMaxTokens: 8192,
      mode: "chat",
    },
  },
  {
    deprecated: true,
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "qwen-plus-1125",
    },
    modelId: "qwen-plus-1125",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 8192,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
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
      defaultMaxTokens: 8192,
      mode: "chat",
    },
  },
  {
    deprecated: true,
    features: {
      reasoning: false,
      streamToolCall: true,
      toolCall: true,
      vision: false,
    },
    label: {
      en: "qwen-plus-1127",
    },
    modelId: "qwen-plus-1127",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 8192,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
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
      defaultMaxTokens: 8192,
      mode: "chat",
    },
  },
  {
    deprecated: true,
    features: {
      reasoning: false,
      streamToolCall: false,
      toolCall: false,
      vision: false,
    },
    label: {
      en: "qwen-turbo-0624",
    },
    modelId: "qwen-turbo-0624",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 2000,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 2000,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 2,
      output: 6,
    },
    properties: {
      contextSize: 8000,
      defaultMaxTokens: 2000,
      mode: "chat",
    },
  },
  {
    deprecated: true,
    features: {
      reasoning: false,
      streamToolCall: false,
      toolCall: false,
      vision: false,
    },
    label: {
      en: "qwen-turbo-0919",
    },
    modelId: "qwen-turbo-0919",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 8192,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
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
        name: "enable_search",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.3,
      output: 0.6,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 8192,
      mode: "chat",
    },
  },
  {
    deprecated: true,
    features: {
      reasoning: false,
      streamToolCall: false,
      toolCall: false,
      vision: true,
    },
    label: {
      en: "qwen-vl-max-0809",
    },
    modelId: "qwen-vl-max-0809",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 2000,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 2000,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
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
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 20,
      output: 20,
    },
    properties: {
      contextSize: 32_000,
      defaultMaxTokens: 2000,
      mode: "chat",
    },
  },
  {
    deprecated: true,
    features: {
      reasoning: false,
      streamToolCall: false,
      toolCall: false,
      vision: true,
    },
    label: {
      en: "qwen-vl-plus-0809",
    },
    modelId: "qwen-vl-plus-0809",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 2000,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 2000,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
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
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 8,
      output: 8,
    },
    properties: {
      contextSize: 32_768,
      defaultMaxTokens: 2000,
      mode: "chat",
    },
  },
  {
    features: {
      reasoning: false,
      streamToolCall: false,
      toolCall: false,
      vision: false,
    },
    label: {
      en: "qwen3-coder-plus-2025-09-23",
    },
    modelId: "qwen3-coder-plus-2025-09-23",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected, the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 65_536,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 65_536,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.9,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 4,
      output: 16,
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
      streamToolCall: false,
      toolCall: false,
      vision: true,
    },
    label: {
      en: "qwen3-omni-flash-2025-12-01",
    },
    modelId: "qwen3-omni-flash-2025-12-01",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 2,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 16_384,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 1,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top k",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 512,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 24_576,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 1.8,
      output: 69,
    },
    properties: {
      contextSize: 65_536,
      defaultMaxTokens: 8192,
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
      en: "qwen3-vl-flash",
    },
    modelId: "qwen3-vl-flash",
    modelType: "llm",
    parameterRules: [
      {
        default: 0.3,
        help: {
          en: "Used to control the degree of randomness and diversity. Specifically, the temperature value controls the degree to which the probability distribution of each candidate word is smoothed when generating text. A higher temperature value will reduce the peak value of the probability distribution, allowing more low-probability words to be selected, and the generated results will be more diverse; while a lower temperature value will enhance the peak value of the probability distribution, making it easier for high-probability words to be selected. , the generated results are more certain.",
          "zh-CN":
            "用于控制随机性和多样性的程度。具体来说，temperature 值控制了生成文本时对每个候选词的概率分布进行平滑的程度。较高的 temperature 值会降低概率分布的峰值，使得更多的低概率词被选择，生成结果更加多样化；而较低的 temperature 值则会增强概率分布的峰值，使得高概率词更容易被选择，生成结果更加确定。",
        },
        max: 1.99,
        min: 0,
        name: "temperature",
        type: "float",
      },
      {
        default: 8192,
        help: {
          en: "It is used to specify the maximum number of tokens when the model generates content. It defines the upper limit of generation, but does not guarantee that this number will be generated every time.",
          "zh-CN":
            "用于指定模型在生成内容时 token 的最大数量，它定义了生成的上限，但不保证每次都会生成到这个数量。",
        },
        max: 32_768,
        min: 1,
        name: "max_tokens",
        type: "int",
      },
      {
        default: 0.8,
        help: {
          en: "The probability threshold of the kernel sampling method during the generation process. For example, when the value is 0.8, only the smallest set of the most likely tokens with a sum of probabilities greater than or equal to 0.8 is retained as the candidate set. The value range is (0,1.0). The larger the value, the higher the randomness generated; the lower the value, the higher the certainty generated.",
          "zh-CN":
            "生成过程中核采样方法概率阈值，例如，取值为 0.8 时，仅保留概率加起来大于等于 0.8 的最可能 token 的最小集合作为候选集。取值范围为（0,1.0)，取值越大，生成的随机性越高；取值越低，生成的确定性越高。",
        },
        max: 0.99,
        min: 0.1,
        name: "top_p",
        type: "float",
      },
      {
        help: {
          en: "The size of the sample candidate set when generated. For example, when the value is 50, only the 50 highest-scoring tokens in a single generation form a randomly sampled candidate set. The larger the value, the higher the randomness generated; the smaller the value, the higher the certainty generated.",
          "zh-CN":
            "生成时，采样候选集的大小。例如，取值为 50 时，仅将单次生成中得分最高的 50 个 token 组成随机采样的候选集。取值越大，生成的随机性越高；取值越小，生成的确定性越高。",
        },
        label: {
          en: "Top K",
          "zh-CN": "取样数量",
        },
        max: 99,
        min: 0,
        name: "top_k",
        type: "int",
      },
      {
        default: 1234,
        help: {
          en: "The random number seed used when generating, the user controls the randomness of the content generated by the model. Supports unsigned 64-bit integers, default value is 1234. When using seed, the model will try its best to generate the same or similar results, but there is currently no guarantee that the results will be exactly the same every time.",
          "zh-CN":
            "生成时使用的随机数种子，用户控制模型生成内容的随机性。支持无符号 64 位整数，默认值为 1234。在使用 seed 时，模型将尽可能生成相同或相似的结果，但目前不保证每次生成的结果完全相同。",
        },
        label: {
          en: "Random seed",
          "zh-CN": "随机种子",
        },
        name: "seed",
        type: "int",
      },
      {
        default: 1.1,
        help: {
          en: "Used to control the repeatability when generating models. Increasing repetition_penalty can reduce the duplication of model generation. 1.0 means no punishment.",
          "zh-CN":
            "用于控制模型生成时的重复度。提高 repetition_penalty 时可以降低模型生成的重复度。1.0 表示不做惩罚。",
        },
        label: {
          en: "Repetition penalty",
          "zh-CN": "重复惩罚",
        },
        name: "repetition_penalty",
        type: "float",
      },
      {
        default: false,
        help: {
          en: "Whether to enable thinking mode.",
          "zh-CN": "是否开启思考模式。",
        },
        label: {
          en: "Thinking mode",
          "zh-CN": "思考模式",
        },
        name: "enable_thinking",
        type: "boolean",
      },
      {
        default: 512,
        help: {
          en: "The maximum length of the thinking process, only effective when thinking mode is true.",
          "zh-CN": "思考过程的最大长度，只在思考模式为 true 时生效。",
        },
        label: {
          en: "Thinking budget",
          "zh-CN": "思考长度限制",
        },
        max: 8192,
        min: 1,
        name: "thinking_budget",
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
      {
        help: {
          en: "Enter extra HTTP headers in JSON string format, which will be included in the API request.",
          "zh-CN":
            "以 JSON 字符串格式输入额外的 HTTP 请求头，这些请求头将包含在 API 请求中。",
        },
        label: {
          en: "Extra Headers",
          "zh-CN": "额外请求头，Json字符串格式",
        },
        name: "extra_headers",
        type: "string",
      },
    ],
    pricing: {
      currency: "CNY",
      input: 0.5,
      output: 2,
    },
    properties: {
      contextSize: 131_072,
      defaultMaxTokens: 8192,
      mode: "chat",
    },
  },
];
