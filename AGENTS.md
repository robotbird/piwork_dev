# 项目规则

## Pi-first 开发约束（强制）

本项目是完全基于 **Pi Agent** 构建的企业智能体平台。实现任何功能、修复缺陷、进行重构或设计集成方案之前，必须先理解 Pi 对应能力的官方用法，不得仅凭经验、记忆或第三方示例直接实现。

### 官方资料

- 官方文档（优先查看与当前版本匹配的页面）：<https://pi.dev/docs/latest>
- 官方代码库及源码：<https://github.com/earendil-works/pi>
- 本项目当前安装版本：以 `package.json` 和锁文件为准；本轮核对 npm 最新发布并将 `@earendil-works/pi-ai`、`@earendil-works/pi-agent-core`、`@earendil-works/pi-coding-agent`、`@earendil-works/pi-durable`、`@earendil-works/chord` 全部对齐到 `1.0.2`（Durable 仍 experimental，见评估文档）。升级后同步更新这里和架构文档。

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

新增或修改代码前先读 [当前架构](docs/architecture.md) 和 [开发与测试约定](docs/development.md)，文档导航见 [docs/README.md](docs/README.md)。企业 MVP 后续实施基线为 [千人企业 MVP 与沙箱执行面实施方案](docs/sandbox-execution-surface-design.md)：先工具执行安全/平台账本，再单 Worker，后受控 Durable 生产试点；RunDescriptor/独立执行状态、LazySandbox/操作错误分类、限额/原子文件能力与四工具工厂已落地但未接生产，进度见 docs/runtime-foundation-implementation.md；SandboxToolsBackend 协议适配器、私有本地制品与交付回调已实现，但生产路由/DB 枚举/权限与账本尚未接线；Durable 已补官方 SQLite 单写者/绑定/调度前未知结果阻断与 SIGKILL 测试基础；正式 Worker/reaper/Durable 生产恢复仍不得改写为当前能力。本轮容量/持续负载/突发并发测试已按要求排除，资源准入和安全契约实现仍保留，不能宣称千人容量已验证。RunDescriptor 校验不等于授权，独立执行状态不等于现有 DB enum；LazySandbox 当前 kill-only。shell 结果未知不自动重放，Docker keep 前须有 reaper，工具同名覆盖不是安全保证，Durable 提交去重不等于副作用恰好一次。`docs/pi-plugin-support-research.md` 是分阶段目标设计；其中的 Sandbox/RPC 目标不能当成已部署现状。

| 目录 | 职责 |
| --- | --- |
| `app/(auth)`、`app/(chat)`、`app/(admin)` | 页面、Server Actions、HTTP API 与入口鉴权；聊天路由不实现 Pi agent loop |
| `components/`、`hooks/` | UI 组件与客户端状态，不直接依赖 Pi SDK/RPC 内部事件 |
| `lib/runtime/protocol` | 平台 Runtime 输入、命令、事件与 Backend/Session 契约 |
| `lib/runtime/backends` | Pi 运行适配器与事件归一化；新增后端实现相同协议；`sandbox-rpc` 复用官方 RpcClient，只换 spawn 策略；`sandbox-tools` 已有实验 RuntimeBackend（复用 InProcessRuntimeSession/官方 SDK）、工具/内存观察/交付回调，未装配生产 |
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

P1 tools 文件能力只用 `SandboxHandle.filesystem`，不可回退旧无界/非原子 readFile/writeFile；生产 Linux helper 必须 pin directory fd、拒绝 symlink/hardlink/特殊文件；非 Linux fallback 仅测试显式启用。工具工厂复用 Pi 官方 schema/truncation 与 edit/write operations，不调用默认宿主执行、图片解码或临时日志；每次执行先调用注入 authorization，P2 前仍需持久 intent/fencing/归档。命令观察仅进程内，shell exit 不代表子孙退出；超时/取消/未知结果 kill 全沙箱并验证状态，不自动重放。Docker 新契约通过不能当 OpenSandbox、重启恢复或容量证明。SandboxToolsBackend 当前只支持 Docker/Test 注入，OpenSandbox 新 tools 明确拒绝，生产必须 Leasing reuse=false。SDK 自身会归一化 prompt/tool-result 图像，新 tools 会话须以 session-local images.autoResize=false 加受支持 MIME/体积校验，不能只关闭 read 自带 resize。私有制品必须平台绑定 user/run/tool-call key、存入不向沙箱暴露的持久私有根目录、先正式归档再发事件；不得用返回受保护 URL 的后验检查代替私有写入/身份授权。旧 public Blob 未静默迁移。

测试文件放在 `tests/unit` 或 `tests/e2e`；测试专用环境、替身和 fixture 分别放 `tests/support`、`tests/fixtures`。更新运行脚本并执行相关测试，不要在 `app/` 或 `lib/` 中就地新建 `*.test.*`、`*.spec.*` 或测试专用代码。

## Durable + Sandbox 组合适配器（非生产）

`lib/runtime/backends/durable/sandbox-backend.ts` 的 DurableSandboxBackend 已实现 fresh-run 组合：官方 Harness/owned SQLite 留可信宿主，四工具经 LazySandbox/SandboxHandle；sandbox 映射存官方 defineDoc/commit。OpenSandbox 仅显式 experimentalOpenSandbox 非生产探针，现 SandboxToolsBackend 默认拒绝不变；组合后端生产拒绝、单 prompt/deny-all、平台 tools 非空拒绝、已登记会话重开 needs-review，不提供自动恢复。终态前回收并验证，清理失败保留 owner；通用工具 unsafe。默认聊天/环境开关互斥保持不变。测试为 tests/unit/runtime/backends/durable，新增 test:runtime:durable-sandbox；真实组 PIWORK_DURABLE_OPENSANDBOX_TESTS=1，默认跳过。真实四工具/超时契约通过不等于 launcher 控制路径、持久 workspace、生产授权治理/账本/Worker/snapshot 投影/容量已验收；见 docs/durable-sandbox-composition.md。不得把这个适配器变成绕过 P2/P3/D1 的生产入口。

### 非生产自动聊天分流

`PIWORK_DURABLE_CHAT_ENABLED=1` 仅 NODE_ENV=development|test；development 对所有正式启用成员开放自动分流，无需用户白名单且忽略旧名单；test 仍要求 `PIWORK_DURABLE_CHAT_USER_IDS` 为非空 UUID 白名单。生产/未知环境拒绝；必须配置私有绝对 PIWORK_DURABLE_STORAGE_DIR/UPLOAD_DIR，彼此及宿主 chat workspace 不重叠。不要打开全局 PIWORK_RUNTIME_BACKEND=durable。`/api/chat/runtime-options` 仅保留本人能力查询；UI 不选择后端，客户端 runtimeLane 被 schema 剥离。route 在附件解析/宿主 workspace 创建前复用执行分类器，并由 routing/chat-routing.ts 选择一次内部 lane：问答走既有轻量链路，适配四工具的执行任务走 Durable；Skill 命令、平台能力关键词/已登记名称/近期非四工具调用、审批续跑与分类不确定保守留既有链路。不扩张既有 SandboxRpc 的闭包/MCP/Package 支持；分类不等于授权，选定后失败不 fallback。`run/durable-chat.ts` 装配正式 DB 授权（查询在 db/durable-chat-queries.ts）、Leasing reuse=false、私有交付/LibraryItem 归档，`backends/durable/chat-*` 绑定最终 prompt/模型/历史/附件/hash/config。RuntimeSpec 仅增加宿主 reference-only grant，不放附件字节/跨进程闭包，不宣称可序列化 Worker DTO。Durable 每个新消息 fresh-run/临时 workspace；Durable 不接 Skill/MCP/Package/定时任务，兼容请求在执行前留既有链路；不绕过组合适配器 spec.tools 非空拒绝门禁。

附件只取本人 LibraryItem，采用可信文件名/MIME和限额，宿主不解析 Office/图片；首次工具命令前复核所有权及 hash/size，经 SandboxHandle.filesystem 原子写入相对 inputs 路径；水合失败/取消不得忽略或回退宿主。制品绑定 user/chat/run/tool-call，私有存储并正式归档后才发事件，旧公开 Blob 未迁移。AgentRun.backend 新增 durable_sandbox（DB 实为 varchar，无 SQL enum 迁移），未启用时保持原矩阵，选定后失败不 fallback。Stop 受理不等于干净取消；未知 shell 效果可落 failed，kill/状态核验后仍不自动重放。Leasing release 必须向底座传原始 handle 而非 wrapper，严格 provider 不接受外来 handle。

测试新增 test:runtime:durable-chat（unit）、:db、:http；HTTP 仅 PIWORK_DURABLE_CHAT_HTTP_TESTS=1，使用真实模型/provider，fixture 在 tests/support/durable 创建唯一 PG schema（无 public search_path fallback，迁移 FK 仅 fixture 重映射）、独立 build/tsconfig 与私有 SQLite，不触碰日常 runs；失败保留证据待人工核验，不能自动偷锁。真实 HTTP 通过不等于浏览器 UI、Worker/自动恢复、安全硬隔离或容量验收；生产门禁不变。

## Durable 生产化门禁

控制面 PostgreSQL 持有身份/RBAC/配置、平台任务元数据与审计/用量投影；Runtime 的 Pi Durable transcript/inbox/tasks/checkpoint 继续使用每运行私有 SQLite。文件/制品走私有文件或对象存储。不得仅为“统一数据库”替换官方执行状态存储，也不得把 Cloudflare DO 的单写者/Alarm/PITR 当成本项目已有能力。Node 部署仍需可靠持久卷、单 Writer、备份恢复、唤醒与副作用对账。

`backends/durable/storage.ts` 只复用官方 SQLite facade/Storage；可信私有持久卷、平台授权 user/chat/run/inputHash 绑定、O_EXCL owner marker，不按 PID/TTL 自动偷锁。恢复检查必须早于 submit/wait/resume（均启动官方调度）；未知 intent/已物化未知结果拒绝，不能自动重放。所有通用工具 unsafe，execute 内复核当前授权并透传 signal；不可仅依赖恢复会跳过的 beforeTool。持久 adapter 未接沙箱而 workspace 非 null 必须拒绝；生产默认 MemoryStorage 明确禁止，实验开关不是生产上线入口。Worker/映射/事件快照投影/正式权限与账本/取消删除恢复对账仍未完成；存储锁不等于 workspace fencing。测试与 fixture 在 tests/unit/runtime/backends/durable 与 tests/support/durable，不做容量测试。

## 数据库连接池边界

应用查询统一复用 `lib/db/client.ts` 的 `getDb()`，按 POSTGRES_URL/时钟档进程缓存（含 HMR），默认池 max=5/UTC 沙箱池 max=2，idle_timeout=20。默认数据库时钟不变，沙箱显式 UTC；迁移独立单连接。不要在查询模块自建池，不把所有池改为 UTC，不终止其他应用连接；旧池需服务重启释放。test:db:client 验证复用/时钟/查询错误传播；test:runtime:db 文件串行以免测试进程耗尽额度，不代表容量验证。

## RunManager 启动与孤儿清理边界

首次 await 前预留 chat；创建 DB run/取得 lease/发布启动所有权与清理经本管理器短临界区串行，不能把 backend.open 或模型/工具执行放进锁。starting run 一并参与心跳与清理排除，向 LiveRun 同步交接。未知但持 lease 的 run 只按心跳过期清理，不能仅因缺少本进程 LiveRun 就失败；条件 UPDATE 保留非终态检查，实际更新行的 lease 删除须同事务。DB 清理测试限定自己的 runId，不清理真实会话。HMR 会保留旧 manager，修改后需服务重启。这不是完整 Worker/fencing/恢复，失败终态不自动翻转或重放；历史纠错需独立持久证据核验。

## 后台对话记录边界

`/admin/conversations` 与 `/api/admin/conversations[/<id>]` 仅 enabled/admin 成员只读访问；`lib/db/conversation-queries.ts` 持有 Chat/Message_v2/最新 AgentRun 的检索与分页，`lib/admin/conversations.ts` 持有共享校验/文本投影。仅 text parts，不返回 reasoning/工具载荷/附件地址，不读 Pi 原生 session/SQLite，不开放跨用户聊天写入。状态取最近 run；模型经 AgentRun.requestedModel（迁移 0017）请求快照与 SDK/RPC/Durable 的 message.completed.model 持久化。查询逐 run 优先实际 model/responseModel、其次请求快照、最后同 run/chat 的 allowed 代理审计证据，不用当前配置猜历史，支持跨轮模型筛选。供应商展示按已记录 provider 精确关联 ModelProviderPlugin 的公开 displayName/providerKey，复用包内 Logo API，不显示内部 installation ID，未知/卸载与图标失败保守回退；当前展示元数据不能覆盖历史模型身份或读取凭据。Token 聚合会话所有已保留 message.completed.usage 五字段，totalTokens 以官方值为准、不重复 reasoning/缓存，不与代理审计相加；不含分类/标题/压缩/嵌套工具费用，未知不填零、记录缺口标部分。不能虚构会话归档状态或不可变审计能力，口径见 docs/conversation-model-usage.md。测试 test:conversations/:db 在 tests/unit/admin 与 tests/unit/db，:http 在 tests/e2e；新增模型快照需迁移和重启开发 RunManager 后生效。

## 文档库边界

`components/documents` 与 `lib/documents` 持有文档库界面及可共享类型；`lib/db/library-queries.ts` 持有归档、文件夹和所有权查询。上传入口必须登记 LibraryItem；生产 Runtime 在组装处注入归档回调，Pi `deliver_file` 完成归档后才发送 `artifact.created`。不要将数据库访问或用户身份判断写入 Pi 通用工具。文件夹为用户目录，当前不是项目权限模型。

## 定时任务边界

`lib/scheduler` 持有周期计划校验、调度与执行编排；`lib/db/scheduled-task-queries.ts` 持有归属查询、事务领取和运行记录。AI 创建工具通过回调注入平台身份，不接收模型提供的 userId。执行保持 `scheduler → RunManager → RuntimeBackend → Pi AgentSession`，等待 settled 后才写入结果；enabled 与运行 status 分离。MVP 只支持单个常驻 Node 实例，不能作为已部署分布式 Worker/Sandbox 能力描述。测试放在 tests/unit/scheduler 和 tests/unit/db。

## 项目 Workspace 边界

`lib/projects` 持有资料文本提取与聊天上下文组装；`lib/db/project-queries.ts` 持有项目/项目聊天/来源的归属查询与事务删除。项目聊天复用既有 Chat 表（`Chat.projectId`）与完整聊天链路，页面不实现第二个 agent loop；项目主页输入通过预建聊天加 `?query=` 进入聊天页。资料上下文是全文注入（无检索、无 Embedding），不要把 Source 查询写入 Pi 通用工具，也不要让项目逻辑绕过 RunManager 直接调用 Pi。删除项目必须先停活跃 run 并在事务内清理 vote/message。

## 沙箱 Runtime 边界

`lib/runtime/sandbox` 持有 Pi 无关的 `SandboxProvider/SandboxHandle/SandboxChannel` seam、注册表与 bridge 泵，`sandbox/docker` 是 docker CLI provider（安全基线自持，不依赖任何第三方 runtime 的默认值；egress 默认 deny-all（`--network none`），allowlist = 每沙箱独立非 internal 网桥 + `--add-host host-gateway` + `--dns 127.0.0.1`——raw-IP 直连是该档已声明的开发近似残余缺口，生产 FQDN 级硬拒绝归 OpenSandbox egress sidecar/NetworkPolicy），`sandbox/opensandbox` 是生产 provider（`@alibaba-group/opensandbox` SDK 只在该目录 import；PTY pipe 通道按 spec §11 D-2，exec 行走二进制 0x00 帧、exit 帧 `exit_code`、鉴权 header `OPEN-SANDBOX-API-KEY`；与 Docker 档的安全基线差异如实声明，见 spec §5.1）；`lib/db/sandbox-queries.ts` 持有注册、租约、重连与停止查询，`/admin/sandboxes` 提供管理员列表/详情、状态核验、延长 1 小时和真实销毁；生命周期操作由 `lib/admin/sandbox-service.ts` 经 Pi 无关的 Provider `SandboxControl` 编排，DB 查询仍留 `lib/db/sandbox-queries.ts`。`runtimeConfig`（迁移 0016）保存创建额度/egress/workspace 快照，不能当实时用量；OpenSandbox 控制面使用官方 SandboxManager，SDK import 仍只在 opensandbox/。销毁按 RunManager 的 chat + expectedRunId 停关联 run，再真实 kill，成功后落库；刷新失败不得伪装 destroyed。关联任务通过 `/api/admin/sandboxes/:id/task` 管理员只读访问，不扩张普通聊天写入权限。`SandboxRpcBackend`（`lib/runtime/backends/sandbox-rpc`）必须复用官方 `RpcClient` 与 `LocalRpcRuntimeSession`，只经 bridge 换 spawn 策略，不得重写 RPC 客户端或事件归一化；`remoteCliPath` 必须指向完整安装的 pi 包（单拷 dist/bundle 不是合法分发）。宿主 env 不透传沙箱；provider 失败 fail-closed，不得回退 in-process。沙箱内 `deliver_file` 只经 Artifact Gateway 出站（extension 落 workspace outbox manifest + 宿主侧收割出站归档），沙箱内工具不得直呼平台回调或携带平台凭据。

沙箱内模型访问只经 Inference Proxy（`lib/runtime/inference-proxy`）：控制面旁路 HTTP 反代讲官方 pi-messages wire 协议（pi-ai `dist/api/pi-messages.js`），沙箱内 pi 经 agentDir `models.json`（`apiKey: "${PIWORK_RUN_TOKEN}"` env 模板）对接；真实模型凭据只留在控制面模型插件 Worker host，沙箱内唯一凭据是 AgentRun 级 run token（sha256 存储、滑动 30min TTL、grant 限 provider/model，acquire 失败即撤销）。egress 白名单由 `deriveSandboxEgress` 派生（只收紧：无 proxy 恒 deny-all，有 = 代理主机 ∪ 装配基线 ∩ RuntimeSpec 申请）。代理访问审计落 `InferenceAccessAudit`（`lib/db/inference-audit-queries.ts`，迁移 0015；脱敏、chatId 无外键）。生产装配经 `PIWORK_INFERENCE_URL`（沙箱视角地址）显式启用，缺省 = deny-all 无模型通道；可选 `PIWORK_INFERENCE_PROXY_HOST`/`PIWORK_INFERENCE_PROXY_PORT`/`PIWORK_INFERENCE_EGRESS_ALLOWLIST`；listen 失败 fail-closed。

路由矩阵（v2.0 §8.1）：`lib/runtime/backends/routing` 的 `requiresSandbox`（workspaceDir 非 null = 执行工具开启）逐 run 分流——执行工具 run 走 SandboxRpc、纯对话 in-process 并存非降级，`RunManager.backendKindFor` 把实际执行位落 AgentRun.backend；沙箱路由失败原样上抛绝不回落 in-process；backend.open 失败须由 RunManager 落 failed 并释放 lease，沙箱 argv 派生显式传 remoteCliPath，避免 Turbopack 不支持的宿主 import.meta.resolve。装配 `PIWORK_SANDBOX_ROUTING=matrix`（默认）|`all`。已知边界（如实声明）：平台闭包工具（技能工具、create_scheduled_task）不跨进程，沙箱路由的 run 丢失它们；Package/MCP 未进 RuntimeSpec 仍走 in-process。生产装配走 `lib/runtime/run/index.ts` 的 `PIWORK_SANDBOX_PROVIDER=docker|opensandbox`（+ 必填 `PIWORK_SANDBOX_CLI_PATH`，指向 `docker/pi-runtime` 镜像内预装的完整 pi；opensandbox 另需 `OPENSANDBOX_DOMAIN`/`OPENSANDBOX_API_KEY`，走平台密钥存储落 env；fail-closed），测试替身 TestSandboxProvider 只在 `tests/support/sandbox`，禁止进生产装配。测试放 `tests/unit/runtime/sandbox`、`tests/unit/runtime/backends`、`tests/unit/runtime/inference-proxy` 与 `tests/unit/db`，契约测试默认用 TestSandboxProvider，Docker 契约组需本机 docker（无则跳过；含 egress allowlist 对照用例），真实容器上的 RPC 契约组需显式 `PIWORK_SANDBOX_DOCKER_RPC_TESTS=1` 并先构建 pi-runtime 镜像（默认关闭），OpenSandbox 真实 server 契约组需显式 `PIWORK_SANDBOX_CONTRACT_OPENSANDBOX=1`（+ `OPENSANDBOX_DOMAIN`/`OPENSANDBOX_API_KEY`，默认关闭）。

## 个人中心与账户边界

`app/(account)/settings` 与 `components/profile` 持有个人设置入口和界面，`lib/db/profile-queries.ts` 持有本人资料、运行统计与更新查询；Server Action 从正式会话取 userId，不接受客户端身份。邮箱为登录标识只读，密码修改须校验旧密码并 CAS 更新哈希。任务统计取本人保留的 AgentRun，不虚构 Token/Skill 使用次数。应用不提供访客功能，历史访客 JWT 拒绝，未登录业务页面跳登录/API 返回 401；管理入口与管理 API 仅 enabled/admin 成员。测试放 tests/unit/db 与 tests/e2e。

个人头像上传通过 `/api/profile/avatar`，仅正式启用账号可用，格式限 PNG/JPEG/WebP 且最多 2 MB，必须登记 LibraryItem；User.image 保存平台生成的本人 LibraryItem 预览地址，客户端不提交任意头像 URL 或 userId。恢复默认头像清空引用，保留已归档文件。

个人设置使用独立二级路由 `/settings/profile`（资料）、`/settings/security`（密码）、`/settings/usage`（统计）；共享 settings/layout 与 SettingsSidebar，页面由 SettingsPage 复用正式身份校验和本人查询，链接导航支持直达、刷新与浏览器历史。`/settings` 与旧 `/profile` 重定向个人资料；账户动作归 settings/actions.ts，头像 API 保持 `/api/profile/avatar`。

个人资料页仅展示账户信息（含只读角色与所在部门），统计和最近任务归 `/settings/usage`。`profile-queries` 按本人 userId 左联 Member/Department，读取 MemberRole/Role 的实际角色名称；无关联角色时回退 Member.role，无部门或成员信息显示未分配。客户端不可修改组织归属和角色。

用量统计页展示本人已记录 Token 聚合指标、AgentRun 时长与连续活跃天数、近一年 Token 活动热力图（每日/每周/累计），不再展示最近任务列表。Token 使用量从本人 RuntimeEvent 的 message.completed.usage 聚合，旧任务无记录显示未记录，不得虚构。

个人设置三个页面复用管理 Skill 页面内容宽度（居中 max-width 960px）与响应式留白。Token 用量依据 Pi 1.0.0 官方 SDK message_end 和 pi-ai Usage 类型；归一化只保存五个数值字段，经现有 RuntimeEvent 持久化，未新增表。累计仅包含实际保留的用量记录。参考 https://pi.dev/docs/latest/sdk 与 node_modules/@earendil-works/pi-ai/dist/types.d.ts。

聊天执行分类归 `lib/ai/execution-classifier.ts`，复用 Pi 官方 classifier API；未配置模型时复用 pi-auto-router 0.3.0 纯函数进行本地分类，配置模型后优先官方 API；模型低置信度和失败保守保留执行路由。无工作区的 InProcess 会话关闭受管扩展/MCP 与内建执行工具，仅保留平台显式工具白名单。分类不负责迁移运行中的会话；定时任务尚未接入。配置与数据发送边界见 docs/development.md 的官方执行需求分类章节。
