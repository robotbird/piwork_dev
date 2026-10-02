# Pi Durable 评估与采用计划

> 核对日期：2026-10-01。对象：`@earendil-works/pi-durable@0.99.2`（2026-09-30 发布，官方公告同日）。
> **状态：评估完成，结论为现阶段不替换主链路；P2 旁路原型已落地（`DurableBackend`，见 §5），生产默认路径不变。** 除原型外的 Pi Durable 能力未接入生产。

## 1. Pi Durable 是什么

官方定位：一个"耐久 agent harness"——存储 + 并行跑多路对话的执行机械。它**不取代** Pi coding agent，而是与其共享 `pi-ai` 与"极简/可塑"原则的平行框架，用于构建任意 agentic 应用。核心概念：

- **Harness**：打开在一个存储后端之上，所有变更经一条原子提交线落盘，"先提交后可见"。
- **Conversation / Entry**：对话是不可变条目转录（`pi.user`、`pi.assistant`、`pi.tool-result`、`pi.system`、`pi.reset` 及自定义 kind）；可 fork（按条目位置继承父历史，不复制）。
- **Task**：每个模型请求/工具调用/压缩都是持久状态机任务，逐 checkpoint 落盘；进程死掉后新进程 `resume()` 从上个 checkpoint 继续。任务间有 ownership 树（abort 自底向上传播），`requestId` 让提交恰好一次。
- **Registry / 扩展**：具名的 system prompt sections、tools（TypeBox schema、`replay: "safe"` 重放语义）、hooks（`beforeTool`/`onYield` 等）、自定义 tasks；对话只存名字不存代码，registry 可热替换。
- **Document**：与转录同事务提交的类型化 JSON 应用状态（内置 `pi.conversation.config`、`pi.live`、`pi.inbox`、`pi.usage`）。
- **观察面**：`viewState()`/`watch()` 输出结构化视图与提交级操作帧；`watchEvents()` 输出 coding-agent 风格事件（`message_start`/`message_update`/`text_delta`/`tool_execution_*`/`turn_*`/`run_*`/`compaction_*`/`snapshot`）。
- **压缩**：后台 compaction 任务 + 上下文超限自动压缩重试一次；`reset()`/`control: { handoff }` 换语境而旧条目仍可查。

依赖：`@earendil-works/pi-ai@^0.99.2`（与本项目当前版本一致）、`@earendil-works/chord@^0.99.2`（应用组合运行时，承担文档状态）、`typebox`、`diff`。存储后端自带 Memory/SQLite/JSONL（便携核不依赖 Node API），并带 conformance 套件供自研后端（如 Postgres）对齐。

**稳定性**：包 README 第一行即 *"Experimental. The API changes without notice between releases."*；官方公告也称 experimental。本地已实证公告与发布版存在 API 漂移（见 §3）。

## 2. 与 piwork 现状的映射

| piwork 现有能力 | Pi Durable 对应 | 差口 |
| --- | --- | --- |
| RunManager 生命周期、订阅、断线重放（lib/runtime/run） | `Harness` + `submission.wait()` + `viewState()/watch()`（快照 + 增量帧，天然支持晚加入/重连） | 可替代，且重连语义更优；需重写 stream-mapping 的输入源 |
| AgentRun / RuntimeEvent / Message_v2 的 PostgreSQL 持久化 | 对话转录即持久化（SQLite/JSONL 自带；Postgres 需自研 Storage 后端 + conformance 套件对齐） | 自研 Postgres 后端是一块独立工程；数据模型与现有 Chat/Message_v2 完全不同，需迁移策略 |
| InProcessBackend → Pi AgentSession（pi-coding-agent SDK） | Harness 内置 generation/tool 任务直接调 `pi-ai` | 会话装配、系统提示分段、`noTools`/cwd 等边界需在 registry/sections/env 上重建 |
| 模型插件（lib/model-plugins → ModelRuntime + registerProvider 扩展） | `createModels({ credentials })` + `models.setProvider(provider)`（pi-ai 原生 Provider，插件产出的就是该类型） | 插件桥接可行；需把凭据存储适配为 pi-ai `CredentialStore`，Worker 激活链路要重接 |
| 内置 MCP（0.99.2 builtin:mcp，刚完成的重构）/ codemode / tool_search | **无对应物**（README 与公告均未提及 MCP） | 最大差口；要么放弃要么在 durable tools 上重做 MCP 客户端 |
| Skill 管线（系统提示段 + createSkillTools） | `registry.systemPrompt.section()` + 自定义 tools | 机制可承载，但注册/启停/管理端联动需重建 |
| deliver_file 归档、聊天工作区（.pi/workspace/:chatId） | 自定义 tool + 每 conversation 的 `env`（NodeExecutionEnv 按 cwd 构建） | 可承载；归档回调语义需自定义工具实现 |
| 定时任务（lib/scheduler：事务领取、lease、恢复） | Task 状态机 + checkpoint + resume + `background: true` | 可替代且更强（崩溃恢复、恰好一次）；执行编排需重写 |
| 项目 Workspace、文档库、配额、管理端、鉴权 | 不涉及（应用层） | 不受影响 |
| 多实例/分布式（当前 MVP 单实例约束） | 一个存储同一时刻只归一个进程所有，无跨进程锁 | 与现状约束相同；未来多实例需 Postgres 后端 + 单写者仲裁 |

## 3. 本地 spike 实录（2026-10-01）

环境：macOS arm64，Node 26.10，`npm pack @earendil-works/pi-durable@0.99.2` 解包后 `npm install`，独立于仓库。脚本化 faux provider（pi-ai 自带，无网络）。

结果：

1. **内存存储一问一答**：`Harness.open(MemoryStorage) → root() → setModel() → submit() → wait()` 返回 `done`，读回 assistant 条目文本。✅
2. **SQLite 持久化与恢复**：提交并 `close()` 后重开同一 sqlite 文件，`root()` 返回同一对话 id；同 `requestId` 重复提交返回同一 submission（恰好一次）。✅
3. **事件流**：`watchEvents` 实测产出 `snapshot/message_start/message_end/turn_start/turn_end/run_start/run_end/submission` 等事件类型，与 pi-coding-agent 的 AgentEvent 命名高度同形。✅
4. **API 漂移实证**：官方公告示例 `harness.root(context, { agent: { model, cwd } })` 在已发布的 0.99.2 中**不存在**（`ConversationCreateOptions` 仅 `{ ownership, init }`），须按 README 用 `root.setModel()` 设置。公告/仓库主分支领先于发布包，印证 README 的"API 随版本无预警变更"。

## 4. 结论：现阶段不替换主链路

不替换的四条理由（按权重）：

1. **实验期 API**：官方明示 experimental、API 无预警变更，且公告与发布包已经漂移。把生产聊天链路（route → RunManager → Backend → 会话装配 → stream-mapping → 前端协议）整体迁到会变的 API 上，维护成本不可控。
2. **能力差口集中在刚投资的点上**：MCP（0.99.2 内置扩展，刚完成重构）、Skill 管线、模型插件 Worker 链路、deliver_file 归档在 Pi Durable 中均无现成对应物，迁移=重做。
3. **数据面重构**：Chat/Message_v2/RuntimeEvent/AgentRun → 转录条目模型是一次性不可逆迁移，涉及项目聊天、定时任务运行记录、文档归档等所有下游。
4. **当前痛点强度不足以抵消成本**：crash 恢复、无限长会话、多人协同是 Pi Durable 的核心收益；平台当前单实例 MVP 的崩溃恢复窗口小（run 状态已有 lease/恢复语义），痛点未到阈值。

**应当启动替换的触发条件**（满足其一即重评）：Pi Durable 宣布 stable/版本化承诺；或官方为 durable 提供 MCP/codemode 对应物；或产品明确需要长时运行（小时级）、多端协同、跨进程恢复；或决定自研 Postgres Storage 后端并愿意先在旁路链路试点。

## 5. 分阶段采用计划

- **P0 跟踪（已做）**：本文档留档；每次升级 Pi 三主包时顺带核对 `@earendil-works/pi-durable` 版本与 CHANGELOG，关注 MCP 支持与 stable 声明。
- **P1 存储后端预研（可独立做）**：以 `@earendil-works/pi-durable/testing` 的 conformance 套件为目标，实现 Postgres Storage 原型（约 20 个方法的接口：`commit/mintId` + 各类 scan/get + `close`），放在 `tests/` 或独立目录，不进生产依赖。这一步不依赖 API 稳定，且无论最终是否迁移都不浪费。
- **P2 旁路原型（已落地，2026-10-01）**：`lib/runtime/backends/durable/` 实现了满足 `lib/runtime/protocol` 契约的 `DurableBackend`——每个 `open()` 新建独立 Harness + MemoryStorage，模型桥复用 `lib/ai/pi` 的 provider 体系（测试环境即 faux），AgentTool 映射为 durable 工具，`spec.systemPrompt + appendSystemPrompt` 注册为 registry system prompt section，有损历史以 `pi.user`/`pi.assistant` 条目回灌，事件经 `DurableEventNormalizer`（`watchEvents` AgentEvent → RuntimeEvent，含块相位合成与失败推导）对齐现有事件语义。已挂入 `tests/unit/runtime/backends/backends.test.ts` 契约套件（`supportsPlatformTools: false`，与 LocalRpc 同层差口：平台侧工具闭包/deliver_file 归档未接入），文本+推理、工具差口跳过项、abort、失败、close、单消费者、clearQueue 用例全部通过。生产组装 `lib/runtime/run/index.ts` 默认恒为 InProcessBackend，设 `PIWORK_RUNTIME_BACKEND=durable` 才切换（实验开关）。注意：主包升级 Pi 1.0.0 后（2026-10-02），pi-durable 0.99.2 仍以 pi-ai 0.99.2 解析（pnpm 嵌套双版本），`DurableBackend` 在 Harness 选项处有一处显式转型——1.0.0 的 `TranscriptContext` brand 是 `unique symbol` 纯类型标记，运行时无足迹，契约测试全部通过；pi-durable 发布对齐 pi-ai 1.0.0 的版本后应移除该转型并重评。
- **P3 单面试点**：选一个收益最大的受控面先行（首选定时任务执行：长时、可恢复、恰好一次语义天然匹配），用 feature flag 切流，保留可回退。试点前先补齐原型差口：Postgres/SQLite 持久存储（跨重启恢复才有意义）、平台工具桥（deliver_file 归档）、真实 provider 下的流式验证。
- **P4 主链路迁移**：P3 稳定且框架出 experimental 后，按"数据迁移脚本 + 双写窗口 + 灰度"标准流程迁移聊天主链路，同步退役 RunManager/InProcessBackend。

## 6. Pi 官方依据

- `@earendil-works/pi-durable@0.99.2` 包内 `README.md`（安装、概念、持久化/恢复、工具、观察面、存储表、示例索引）。
- 公告文（官方博客 "Why Pi Durable?"，2026-09-30）：Harness 定位、示例、`npm install` 三包说明。
- 已核对源码/类型：`dist/index.d.ts`（导出面）、`dist/types.d.ts`（`Storage` 接口约 20 方法、Tx/Entry/Task/EntryDraft/SubmissionRecord 类型）、`dist/harness/events.d.ts`（AgentEvent 事件名清单）、`dist/harness/types.d.ts`（`ConversationCreateOptions` 无 `agent` 项、`ToolRegistration`/`PromptSection`/`Conversation` 句柄、`HarnessOptions`）、`dist/harness/events.js`（MessageChange 派生：`*_start`/`*_delta`/`block`/`message` 的触发条件）、`dist/harness/live.js`（`endRun` 与 `tx.settleSubmission` 同 commit，run_end 送达时 submission 已是终态）、`dist/harness/generation.js`（`no_model`/`model_error` 结算路径）、`dist/harness/config.js`（`ConversationConfigState` 无 instructions 字段）；`pi-ai` 0.99.2 `dist/models.d.ts`（`createModels`/`MutableModels.setProvider`）与 `dist/providers/faux.d.ts`。
- 本地 spike 四项实测（见 §3），脚本是临时文件未入库，结果以本文记录为准。
- P2 原型实现依据同上类型面；事件映射的块相位合成与终态推导差异记录在 `lib/runtime/backends/durable/event-normalizer.ts` 头注释。
