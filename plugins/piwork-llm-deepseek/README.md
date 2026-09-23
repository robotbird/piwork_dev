# piwork-llm-deepseek

piwork 模型供应商参考插件（TypeScript），由 Dify 官方插件
`langgenius/deepseek 0.0.24`（`llm/langgenius-deepseek_0.0.24`）迁移而来。

## 迁移对照

| Dify 内容 | 本插件对应物 |
| --- | --- |
| `manifest.yaml` | `piwork.plugin.json` |
| `provider/deepseek.yaml` | `src/provider.ts` 的 `definition` |
| `provider/deepseek.py` | `src/provider.ts` 的 `validateCredentials` |
| `models/llm/*.yaml` | `src/models.ts` 的 `modelCatalog` |
| `models/llm/llm.py` | 复用 Pi 官方 `openai-completions` API implementation（不自行实现） |
| `_assets/icon.svg` | `assets/icon.svg` |

## 行为迁移说明

- 调用协议：Dify 的 `OAICompatLargeLanguageModel` 逻辑（消息清洗、thinking
  参数归一化、`reasoning_content` 解析）由 Pi `openai-completions` 官方实现
  覆盖：`compat.thinkingFormat: "deepseek"` 发送 `thinking: {type}` 参数并
  解析 `reasoning_content` 流式事件；`maxTokensField: "max_tokens"` 保持与
  DeepSeek API 一致。
- `<think>` 标记包装：Dify 在文本中注入 `<!--dify-deepseek-reasoning-->`
  标记以区分思考与正文；piwork 通过 Pi 原生 thinking 事件区分，无需标记。
- 凭据：`api_key`（secret）与 `endpoint_url`（可选，默认
  `https://api.deepseek.com`）与 Dify schema 一致。
- 未迁移：`enable_request_metadata`（附加 `X-Dify-App-Id` / `X-Dify-Source`
  请求头）是 Dify 平台专属的可观测性行为。

## 打包

```bash
pnpm tsx scripts/package-plugin.ts plugins/piwork-llm-deepseek
# → dist/piwork-llm-deepseek.zip
```
