# 平台联网搜索（首版）

## 启用与使用

本功能不依赖已安装的 `pi-web-access`，不加载第三方搜索 Extension。可信控制面持有 Tavily 凭据，Pi 1.0.3 的官方 `customTools` / AgentSession 负责搜索工具调用与后续回答。

在服务端环境配置：

```dotenv
PIWORK_WEB_SEARCH_ENABLED=1
TAVILY_API_KEY=tvly-your-api-key
```

重启服务，新建对话，输入：

> 请联网搜索最近一周的人工智能新闻，列出 5 条结果，附来源链接和发布日期。

可见“正在联网搜索”进度与“网页来源”链接；来源通过 RuntimeEvent 持久化，刷新后保留。模型需引用返回链接，未知日期不得编造。搜索由模型决定调用，不能保证每个时效问题必定调用；明确请求联网时系统提示要求使用工具。禁用/缺少密钥/授权失败/供应商故障均不允许伪造搜索结果。

默认关闭。开启开关但未填 Key 时工具返回“尚未配置”，不会使用其他供应商或宿主插件 fallback。本批不会修改 `.env.local`、安装新插件或删除已安装插件。配置仍由部署环境管理，没有新增管理端密钥表单。

## 能力与边界

- 工具名 `platform_web_search`，与第三方 `web_search` 不同，避免同名注册；参数 query（1–500 字符）、recency（day/week/month/year）、limit（1–8，默认 5）。无 userId、chatId、密钥、endpoint 参数。
- 只调用固定 `https://api.tavily.com/search`，显式 basic search；不请求 AI answer、原始网页 HTML、图片；不自动重试或切换供应商。请求拒绝 HTTP 重定向，不允许模型选请求地址。
- 输出最多 8 条标题（250 字符）、摘要（1200 字符）、公开 HTTP(S) 来源链接和供应商明确提供的可解析发布日期；未记录日期为 null。供应商原始响应体、错误和 API Key 不进入日志、RuntimeEvent 或模型结果。
- 不直接抓取来源 URL、不做浏览器自动化、不下载/解析 PDF/Office/视频，不运行脚本。链接的静态展示过滤并不是 DNS/SSRF 安全抓取实现。`web_fetch` 后续须独立完成 DNS pinning、重定向逐跳校验、有界读取等验收后再开放。
- 查询词会发送给 Tavily；管理员开启前须批准供应商和数据发送边界。提示要求仅发送必要公开关键词、不要发送凭据/敏感私有资料，但这不是自动 DLP 保证；需要企业数据防泄漏策略时应另接正式数据治理。网页摘要是外部不可信参考数据，不是指令。

## 权限与运行路径

`route → RunManager → RuntimeBackend → Pi AgentSession → platform_web_search → 可信搜索 Gateway → Tavily`。

`lib/ai/web-tools.ts` 只定义 Pi 工具；`lib/search/service.ts` 持有受控搜索、参数/输出校验与准入；`lib/search/chat.ts` 从正式宿主身份绑定 user/chat/model，每次工具执行通过既有 db 查询检查 Chat 归属、enabled 账号、当前模型权限和 Token 额度。身份不取模型参数。不另建 agent loop、RPC 客户端或通用插件宿主。

- 开关开启时，纯搜索的本地启发式可以选择无工作区；官方 classifier criteria/state 同步支持平台搜索。混合执行、附件、浏览器、插件/MCP/Skill、近期执行上下文保守保留原执行路由。分类不等于授权；误判也仅提供受限平台白名单，不开放宿主 shell/filesystem。
- 仅 `workspaceDir=null` 的轻量会话装配该工具/提示，继续禁用内建执行工具、受管 Extension/MCP。默认 matrix 中搜索走 InProcess，既有 OpenSandbox 与非生产 Durable 执行配置保持不变。
- 混合“搜索并运行脚本/生成文件”的执行 run 暂不装配平台搜索；不能当作完整组合能力。用户需先搜索，再独立提出执行任务，且仍可能受近期执行上下文的保守规则影响。
- 显式 `PIWORK_SANDBOX_ROUTING=all` 不绕过：SandboxRpc 收到平台搜索工具在签 token/provision 前明确拒绝；LocalRpc 同样在 spawn 前拒绝。Durable 不装配该工具，原非空 tools 拒绝门禁不变。没有失败后自动换后端。

## 限额与事件

- 单轮最多 6 次出站调用；每用户每分钟最多 20 次、同时最多 2 次；进程内同时最多 8 次。计数与占位不跨 await，终态/异常释放占位，HMR 复用计数器。用户窗口最多 1000 项，过期无活跃项淘汰，超过拒绝而非无限增长。
- 12 秒请求与响应体总超时；响应最多 256 KiB；透传官方工具 signal，取消阻止未开始请求并取消正文读取；供应商错误脱敏为明确搜索失败。
- 这些只是单进程准入契约，不是分布式配额、容量验证或不可变计费账本；Tavily 费用不属于官方 message.completed.usage Token 统计。
- 官方 `tool_execution_end` 成功结果中的有界 sources 投影为 `source.created`；stream-mapping 输出标准 `source-url`，message-builder 生成相同持久化 parts。来源事件只含 sourceId/title/url，不持久供应商原始正文。聊天 UI 按 URL 去重，链接新窗口打开，noopener/noreferrer。

## 验证

```bash
pnpm test:search
pnpm test:unit
PIWORK_SANDBOX_DOCKER_TESTS=0 pnpm test:runtime
pnpm exec tsc --noEmit
```

测试在 `tests/unit/ai/web-search*.test.ts`、`tests/unit/chat/web-search.test.ts`、`tests/unit/runtime/backends/web-search.test.ts`：固定请求、Key 脱敏、合法/非法参数、日期缺口、空结果、返回体限额、超时/取消、每次授权与撤权、限额/并发占位、分类矩阵、RPC 拒绝、官方 AgentSession 真实工具循环（faux 模型与搜索替身）、事件/stream/持久消息一致性。默认不调用真实 Tavily 或真实模型、不做容量测试。真实联网/浏览器 UI 需配置后手工验收，不能用替身通过代替。

官方依据：安装版 Pi 1.0.3 `docs/sdk.md`、`docs/extensions.md`、`examples/sdk/05-tools.ts`、`dist/core/sdk.d.ts`（customTools/tools/noTools）、`pi-agent-core/dist/types.d.ts`（AgentTool.execute/signal/content/details）与当前官方 `tool_execution_end` 类型。Tavily 请求字段核对 https://docs.tavily.com/documentation/api-reference/endpoint/search 。
