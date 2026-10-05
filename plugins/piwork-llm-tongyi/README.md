# piwork-llm-tongyi

piwork 模型供应商插件（TypeScript），由 Dify 官方插件
`langgenius/tongyi 0.2.22`（`llm/langgenius-tongyi_0.2.22`）迁移而来。

## 迁移对照

| Dify 内容 | 本插件对应物 |
| --- | --- |
| `manifest.yaml` | `piwork.plugin.json` |
| `provider/tongyi.yaml` | `src/provider.ts` 的 `definition` |
| `provider/tongyi.py` | `src/provider.ts` 的 `validateCredentials` |
| `models/llm/*.yaml` | `src/models.ts` 的 `modelCatalog` |
| `models/llm/llm.py` | 复用 Pi 官方 `openai-completions` API implementation（不自行实现） |
| `models/rerank|tts|speech2text/*.yaml` | 未迁移（piwork 首期插件契约仅开放 `llm` 类型） |
| `_assets/icon.svg` | `assets/icon.svg`（manifest `assets.icon`，聊天模型下拉经 `/api/models/icon` 下发显示） |
| `_assets/icon-dark.svg` | `assets/icon-dark.svg`（manifest `assets.iconDark`，暗色变体备用） |
| `_assets/tongyi.PNG`、`_assets/tongyi_latest.png` | `assets/` 同名保留（随包保留的品牌 logo 原图，页面不消费） |

## 行为迁移说明

- 调用协议：Dify 的 Tongyi 大模型走 DashScope SDK（原生 + 兼容模式混合）；
  本插件统一使用 DashScope **OpenAI 兼容模式**
  （`https://dashscope.aliyuncs.com/compatible-mode/v1`），由 Pi
  `openai-completions` 官方实现覆盖：`compat.thinkingFormat: "qwen"` 发送
  `enable_thinking: boolean`（与 Dify `enable_thinking` 布尔参数一致），
  流式 `reasoning_content` 由 Pi 原生解析为 thinking 事件；
  `maxTokensField: "max_tokens"` 保持与 DashScope 文档一致；
  `supportsStore`/`supportsDeveloperRole`/`supportsReasoningEffort` 显式
  关闭（与 pi-ai 官方 DashScope 托管目录 qwen-token-plan 的 compat 基线
  一致，`reasoning_effort` 不在上游 Dify 参数面内，不发送）。
- thinking 开关映射：目录中 `features.reasoning` 取自 Dify YAML 的
  `enable_thinking` 参数规则（qwen3 系混合思考模型等 43 个）。无该规则的
  模型不发送 thinking 参数；思考流均照常解析展示。
- 视觉模型（`features.vision`，29 个）按图片输入装配；上游 `video`、
  `audio`、`document`、`structured-output` 等 feature 超出 piwork SDK
  首期模型定义，未迁移（omni 全模态模型仅保留文本对话输入）。
- 凭据：仅 `api_key`（secret；Dify 变量名 `dashscope_api_key` 在本插件
  中按 piwork 约定为 `api_key`），与 piwork-llm-deepseek 参考插件一致。
  Base URL 固定为 DashScope 兼容模式
  `https://dashscope.aliyuncs.com/compatible-mode/v1`（Dify
  `models/_common.py` 默认值），探测模型固定为 `qwen-turbo`（Dify
  `tongyi.py` 默认值），两者不作为凭据字段暴露在配置界面；业务空间
  专属域名（api_host）与国际端点（use_international_endpoint /
  dashscope-intl.aliyuncs.com）未迁移。
- 模型目录：98 个对话模型按 `_position.yaml` 排序。上游标记
  `deprecated: true` 的 20 个历史模型保留并打 `deprecated` 标记；14 个
  存在 YAML 但未列入 `_position.yaml` 的模型（deepseek-v3.2、
  qwen3-vl-flash、qwen-turbo-0919 等；另有两个 distill 模型文件名大小写
  与 position 条目不同，按 model id 去重）已附加在目录尾部。价格按
  Dify `pricing.unit` 折算为每百万 token（qwen3.7-max 为 USD，其余 CNY）。
- `qwen3.8-max`/`qwen3.8-flash`/`qwen3.7-flash`/
  `qwen3.7-flash-2026-07-15`/`deepseek-v4.1-flash`/`qwen-mt-plus`/
  `qwen-mt-turbo` 上游未声明 max_tokens 规则，`defaultMaxTokens` 回退
  4096；平台默认请求不主动发送 max_tokens，该值仅作客户端上限与展示。
- 翻译模型 `qwen-mt-plus`/`qwen-mt-turbo` 的 `translation_options`、
  `domains` 参数保留为目录参数规则，由调用方按 DashScope 文档传参。

## 打包

```bash
pnpm tsx scripts/package-plugin.mts plugins/piwork-llm-tongyi
# → dist/piwork-llm-tongyi.zip
```
