# piwork-llm-zhipuai

piwork 模型供应商插件（TypeScript），由 Dify 官方插件
`langgenius/zhipuai 0.0.35`（`llm/langgenius-zhipuai_0.0.35`）迁移而来。

## 迁移对照

| Dify 内容 | 本插件对应物 |
| --- | --- |
| `manifest.yaml` | `piwork.plugin.json` |
| `provider/zhipuai.yaml` | `src/provider.ts` 的 `definition` |
| `provider/zhipuai.py` | `src/provider.ts` 的 `validateCredentials` |
| `models/llm/*.yaml` | `src/models.ts` 的 `modelCatalog` |
| `models/llm/llm.py` | 复用 Pi 官方 `openai-completions` API implementation（不自行实现） |
| `models/text_embedding/*.yaml` | 未迁移（piwork 首期插件契约仅开放 `llm` 类型） |
| `_assets/icon.svg` | `assets/icon.svg`（manifest `assets.icon`，聊天模型下拉经 `/api/models/icon` 下发显示） |
| `_assets/icon-dark.svg` | `assets/icon-dark.svg`（manifest `assets.iconDark`，暗色变体备用） |
| `_assets/zhipuai.png` | `assets/zhipuai.png`（随包保留的品牌 logo 原图，页面不消费） |

## 行为迁移说明

- 调用协议：GLM 的 OpenAI 兼容协议由 Pi `openai-completions` 官方实现覆盖：
  `compat.thinkingFormat: "zai"` 发送 `thinking: {type: enabled|disabled}`
  参数（与 Dify `llm.py` 中 thinking 布尔参数的归一化结果一致），流式
  `reasoning_content` 由 Pi 原生解析为 thinking 事件；`maxTokensField:
  "max_tokens"` 保持与 GLM API 一致；`supportsStore`/`supportsDeveloperRole`/
  `supportsReasoningEffort` 显式关闭，与 pi-ai 对 `open.bigmodel.cn` 的官方
  URL 自动检测结果相同，且在自定义 `base_url` 下保持行为不变。
- thinking 开关映射：目录中 `features.reasoning` 取自 Dify YAML 的
  `thinking` 参数规则（有该规则的模型才开放思考开关）。`glm-z1-*` 与
  `glm-5.3`/`glm-5.3-flash` 在上游没有 thinking 开关（z1 系不可关闭、5.3 系
  强制开启），因此标记为非 reasoning 模型：不发送 thinking 参数，服务端
  默认行为不变，思考流仍照常解析展示。
- `web_search` 联网搜索参数：保留为目录参数规则；piwork 聊天链路未接入
  ZhipuAI 内置搜索工具的装配逻辑，参数不透传。
- 视觉模型（`features.vision`）按图片输入装配；上游 `video` 能力
  （`video_url` 内容分片）超出 piwork SDK 首期模型定义，未迁移。
- 凭据：`api_key`（secret）、`base_url`（可选，默认
  `https://open.bigmodel.cn/api/paas/v4`）、`validate_model`（可选，默认
  `glm-5-turbo`），与 Dify provider_credential_schema 一致；探测请求与
  Dify 的最小连通性验证等价（`max_tokens=1` 非流式补全）。
- 模型目录：43 个对话模型按 `_position.yaml` 排序。上游标记
  `deprecated: true` 且缺失 `context_size` 的 5 个遗留 ChatGLM 模型
  （chatglm_lite/32k/pro/std/turbo）未迁移；`glm-4.6v`/
  `glm-4.6v-flash`/`glm-4.6v-flashx` 在上游 YAML 存在但未列入
  `_position.yaml`，已附加在目录尾部。价格按 Dify `pricing.unit` 折算为
  每百万 token（CNY）。
- `glm-5`/`glm-5.1`/`glm-5-turbo`/`glm-5v-turbo`/`glm-4.7-flash`/
  `glm-4.7-flashx`/`glm-4.6v-flash`/`glm-4.6v-flashx` 上游未声明
  max_tokens 规则，`defaultMaxTokens` 取同插件家族规则上限 131072；
  平台默认请求不主动发送 max_tokens，该值仅作客户端上限与展示。

## 打包

```bash
pnpm tsx scripts/package-plugin.mts plugins/piwork-llm-zhipuai
# → dist/piwork-llm-zhipuai.zip
```
