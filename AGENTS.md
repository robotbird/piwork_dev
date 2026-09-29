# 项目规则

## Pi-first 开发约束（强制）

本项目是完全基于 **Pi Agent** 构建的企业智能体平台。实现任何功能、修复缺陷、进行重构或设计集成方案之前，必须先理解 Pi 对应能力的官方用法，不得仅凭经验、记忆或第三方示例直接实现。

### 官方资料

- 官方文档（优先查看与当前版本匹配的页面）：<https://pi.dev/docs/latest>
- 官方代码库及源码：<https://github.com/earendil-works/pi>
- 本项目当前安装版本：以 `package.json` 和锁文件为准；2026-09-27 核对的 `@earendil-works/pi-ai`、`@earendil-works/pi-agent-core`、`@earendil-works/pi-coding-agent` 均为 `0.87.1`。升级后同步更新这里和架构文档。

### 必须遵守的工作流程

1. 在编写或修改代码前，先确认本次任务涉及的 Pi 包、模块、API、扩展点和版本。
2. 查阅官方文档中与该功能直接相关的指南、SDK/API 参考和示例。
3. 若文档不完整、存在歧义、与已安装版本可能不一致，继续核对官方仓库中的对应源码、类型定义、测试和示例。
4. 基于查证结果设计和实现；优先复用 Pi 官方提供的 API、agent loop、状态管理、工具调用、事件流和扩展机制，避免重复实现 Pi 已具备的能力。
5. 不得猜测 Pi API。无法从官方文档或源码确认的行为，必须明确标注不确定性，并在继续实现前补充验证。
6. 完成变更时，在交付说明中简要列出本次参考的官方文档或源码位置，以及实现与其保持一致的关键点。

### 资料优先级

当资料冲突时，按以下顺序判断：

1. 与本项目实际安装版本对应的官方源码和类型定义；
2. Pi 官方版本化文档；
3. Pi 官方仓库中的测试与示例；
4. Pi 最新文档；
5. 第三方资料仅可作为补充，不得作为 Pi 行为的唯一依据。

## 架构与目录约束

新增或修改代码前先读 [当前架构](docs/architecture.md) 和 [开发与测试约定](docs/development.md)，文档导航见 [docs/README.md](docs/README.md)。`docs/pi-plugin-support-research.md` 是分阶段目标设计；其中的 Sandbox/RPC 目标不能当成已部署现状。

| 目录 | 职责 |
| --- | --- |
| `app/(auth)`、`app/(chat)`、`app/(management)` | 页面、Server Actions、HTTP API 与入口鉴权；聊天路由不实现 Pi agent loop |
| `components/`、`hooks/` | UI 组件与客户端状态，不直接依赖 Pi SDK/RPC 内部事件 |
| `lib/runtime/protocol` | 平台 Runtime 输入、命令、事件与 Backend/Session 契约 |
| `lib/runtime/backends` | Pi 运行适配器与事件归一化；新增后端实现相同协议 |
| `lib/runtime/run` | RunManager、订阅/重放、运行持久化和最终消息构建 |
| `lib/ai` | Pi 会话、模型、工具、Skill、附件装配；优先调用官方 SDK |
| `lib/pi-packages`、`lib/mcp`、`lib/model-plugins` | Pi Package、MCP 配置与模型供应商插件；各自持有安装/注册边界 |
| `lib/db`、`lib/management` | Schema、迁移、查询与管理域规则 |
| `packages/`、`plugins/` | 可复用 SDK 与项目内插件样例 |
| `tests/` | 所有自动化测试、fixture、测试环境与替身；源码目录不得新增测试代码 |
| `docs/` | 当前架构、开发约定、方案与历史调研；状态需明确 |

变更聊天链路时保持 `route → RunManager → RuntimeBackend → Pi AgentSession` 的职责方向，并通过 `RuntimeEvent → stream-mapping` 向前端输出。新后端先满足 `lib/runtime/protocol` 契约。数据访问留在 `lib/db` 查询层，路由负责鉴权和编排。跨模块边界、运行状态或目录发生变化时，同步更新 `docs/architecture.md`、`docs/development.md` 和本文件。

测试文件放在 `tests/unit` 或 `tests/e2e`；测试专用环境、替身和 fixture 分别放 `tests/support`、`tests/fixtures`。更新运行脚本并执行相关测试，不要在 `app/` 或 `lib/` 中就地新建 `*.test.*`、`*.spec.*` 或测试专用代码。

## 文档库边界

`components/documents` 与 `lib/documents` 持有文档库界面及可共享类型；`lib/db/library-queries.ts` 持有归档、文件夹和所有权查询。上传入口必须登记 LibraryItem；生产 Runtime 在组装处注入归档回调，Pi `deliver_file` 完成归档后才发送 `artifact.created`。不要将数据库访问或用户身份判断写入 Pi 通用工具。文件夹为用户目录，当前不是项目权限模型。

## 定时任务边界

`lib/scheduler` 持有周期计划校验、调度与执行编排；`lib/db/scheduled-task-queries.ts` 持有归属查询、事务领取和运行记录。AI 创建工具通过回调注入平台身份，不接收模型提供的 userId。执行保持 `scheduler → RunManager → RuntimeBackend → Pi AgentSession`，等待 settled 后才写入结果；enabled 与运行 status 分离。MVP 只支持单个常驻 Node 实例，不能作为已部署分布式 Worker/Sandbox 能力描述。测试放在 tests/unit/scheduler 和 tests/unit/db。

## 项目 Workspace 边界

`lib/projects` 持有资料文本提取与聊天上下文组装；`lib/db/project-queries.ts` 持有项目/项目聊天/来源的归属查询与事务删除。项目聊天复用既有 Chat 表（`Chat.projectId`）与完整聊天链路，页面不实现第二个 agent loop；项目主页输入通过预建聊天加 `?query=` 进入聊天页。资料上下文是全文注入（无检索、无 Embedding），不要把 Source 查询写入 Pi 通用工具，也不要让项目逻辑绕过 RunManager 直接调用 Pi。删除项目必须先停活跃 run 并在事务内清理 vote/message。
