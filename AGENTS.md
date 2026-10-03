# 项目规则

## Pi-first 开发约束（强制）

本项目是完全基于 **Pi Agent** 构建的企业智能体平台。实现任何功能、修复缺陷、进行重构或设计集成方案之前，必须先理解 Pi 对应能力的官方用法，不得仅凭经验、记忆或第三方示例直接实现。

### 官方资料

- 官方文档（优先查看与当前版本匹配的页面）：<https://pi.dev/docs/latest>
- 官方代码库及源码：<https://github.com/earendil-works/pi>
- 本项目当前安装版本：以 `package.json` 和锁文件为准；2026-10-02 核对的 `@earendil-works/pi-ai`、`@earendil-works/pi-agent-core`、`@earendil-works/pi-coding-agent` 均为 `1.0.0`（`@earendil-works/pi-durable`/`chord` 仍为 0.99.2，见评估文档）。升级后同步更新这里和架构文档。

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
| `app/(auth)`、`app/(chat)`、`app/(admin)` | 页面、Server Actions、HTTP API 与入口鉴权；聊天路由不实现 Pi agent loop |
| `components/`、`hooks/` | UI 组件与客户端状态，不直接依赖 Pi SDK/RPC 内部事件 |
| `lib/runtime/protocol` | 平台 Runtime 输入、命令、事件与 Backend/Session 契约 |
| `lib/runtime/backends` | Pi 运行适配器与事件归一化；新增后端实现相同协议；`sandbox-rpc` 复用官方 RpcClient，只换 spawn 策略 |
| `lib/runtime/sandbox` | Pi 无关的 SandboxProvider/SandboxHandle/SandboxChannel seam、DB 注册表/租约与 UDS bridge；生产 Docker/OpenSandbox provider 见 OpenSandbox 接入 Spec，未落地不得当现状描述 |
| `lib/runtime/run` | RunManager、订阅/重放、运行持久化和最终消息构建 |
| `lib/ai` | Pi 会话、模型、工具、Skill、附件装配；优先调用官方 SDK |
| `lib/pi-packages`、`lib/mcp`、`lib/model-plugins` | Pi Package、MCP 配置与模型供应商插件；各自持有安装/注册边界 |
| `lib/db`、`lib/admin` | Schema、迁移、查询与管理域规则 |
| `docker/` | 沙箱运行时镜像（`pi-runtime` 预装完整 pi，版本随仓库 `package.json` 同步） |
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

## 沙箱 Runtime 边界

`lib/runtime/sandbox` 持有 Pi 无关的 `SandboxProvider/SandboxHandle/SandboxChannel` seam、注册表与 bridge 泵，`sandbox/docker` 是 docker CLI provider（安全基线自持，不依赖任何第三方 runtime 的默认值；egress 默认 deny-all（`--network none`），allowlist = 每沙箱独立非 internal 网桥 + `--add-host host-gateway` + `--dns 127.0.0.1`——raw-IP 直连是该档已声明的开发近似残余缺口，生产 FQDN 级硬拒绝归 OpenSandbox egress sidecar/NetworkPolicy），`sandbox/opensandbox` 是生产 provider（`@alibaba-group/opensandbox` SDK 只在该目录 import；PTY pipe 通道按 spec §11 D-2，exec 行走二进制 0x00 帧、exit 帧 `exit_code`、鉴权 header `OPEN-SANDBOX-API-KEY`；与 Docker 档的安全基线差异如实声明，见 spec §5.1）；`lib/db/sandbox-queries.ts` 持有注册、租约、重连与停止查询，`/admin/sandboxes` 提供管理员列表/详情、状态核验、延长 1 小时和真实销毁；生命周期操作由 `lib/admin/sandbox-service.ts` 经 Pi 无关的 Provider `SandboxControl` 编排，DB 查询仍留 `lib/db/sandbox-queries.ts`。`runtimeConfig`（迁移 0016）保存创建额度/egress/workspace 快照，不能当实时用量；OpenSandbox 控制面使用官方 SandboxManager，SDK import 仍只在 opensandbox/。销毁按 RunManager 的 chat + expectedRunId 停关联 run，再真实 kill，成功后落库；刷新失败不得伪装 destroyed。关联任务通过 `/api/admin/sandboxes/:id/task` 管理员只读访问，不扩张普通聊天写入权限。`SandboxRpcBackend`（`lib/runtime/backends/sandbox-rpc`）必须复用官方 `RpcClient` 与 `LocalRpcRuntimeSession`，只经 bridge 换 spawn 策略，不得重写 RPC 客户端或事件归一化；`remoteCliPath` 必须指向完整安装的 pi 包（单拷 dist/bundle 不是合法分发）。宿主 env 不透传沙箱；provider 失败 fail-closed，不得回退 in-process。沙箱内 `deliver_file` 只经 Artifact Gateway 出站（extension 落 workspace outbox manifest + 宿主侧收割出站归档），沙箱内工具不得直呼平台回调或携带平台凭据。

沙箱内模型访问只经 Inference Proxy（`lib/runtime/inference-proxy`）：控制面旁路 HTTP 反代讲官方 pi-messages wire 协议（pi-ai `dist/api/pi-messages.js`），沙箱内 pi 经 agentDir `models.json`（`apiKey: "${PIWORK_RUN_TOKEN}"` env 模板）对接；真实模型凭据只留在控制面模型插件 Worker host，沙箱内唯一凭据是 AgentRun 级 run token（sha256 存储、滑动 30min TTL、grant 限 provider/model，acquire 失败即撤销）。egress 白名单由 `deriveSandboxEgress` 派生（只收紧：无 proxy 恒 deny-all，有 = 代理主机 ∪ 装配基线 ∩ RuntimeSpec 申请）。代理访问审计落 `InferenceAccessAudit`（`lib/db/inference-audit-queries.ts`，迁移 0015；脱敏、chatId 无外键）。生产装配经 `PIWORK_INFERENCE_URL`（沙箱视角地址）显式启用，缺省 = deny-all 无模型通道；可选 `PIWORK_INFERENCE_PROXY_HOST`/`PIWORK_INFERENCE_PROXY_PORT`/`PIWORK_INFERENCE_EGRESS_ALLOWLIST`；listen 失败 fail-closed。

路由矩阵（v2.0 §8.1）：`lib/runtime/backends/routing` 的 `requiresSandbox`（workspaceDir 非 null = 执行工具开启）逐 run 分流——执行工具 run 走 SandboxRpc、纯对话 in-process 并存非降级，`RunManager.backendKindFor` 把实际执行位落 AgentRun.backend；沙箱路由失败原样上抛绝不回落 in-process。装配 `PIWORK_SANDBOX_ROUTING=matrix`（默认）|`all`。已知边界（如实声明）：平台闭包工具（技能工具、create_scheduled_task）不跨进程，沙箱路由的 run 丢失它们；Package/MCP 未进 RuntimeSpec 仍走 in-process。生产装配走 `lib/runtime/run/index.ts` 的 `PIWORK_SANDBOX_PROVIDER=docker|opensandbox`（+ 必填 `PIWORK_SANDBOX_CLI_PATH`，指向 `docker/pi-runtime` 镜像内预装的完整 pi；opensandbox 另需 `OPENSANDBOX_DOMAIN`/`OPENSANDBOX_API_KEY`，走平台密钥存储落 env；fail-closed），测试替身 TestSandboxProvider 只在 `tests/support/sandbox`，禁止进生产装配。测试放 `tests/unit/runtime/sandbox`、`tests/unit/runtime/backends`、`tests/unit/runtime/inference-proxy` 与 `tests/unit/db`，契约测试默认用 TestSandboxProvider，Docker 契约组需本机 docker（无则跳过；含 egress allowlist 对照用例），真实容器上的 RPC 契约组需显式 `PIWORK_SANDBOX_DOCKER_RPC_TESTS=1` 并先构建 pi-runtime 镜像（默认关闭），OpenSandbox 真实 server 契约组需显式 `PIWORK_SANDBOX_CONTRACT_OPENSANDBOX=1`（+ `OPENSANDBOX_DOMAIN`/`OPENSANDBOX_API_KEY`，默认关闭）。
