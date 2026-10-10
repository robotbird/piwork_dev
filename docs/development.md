# 开发与测试约定

## 企业 MVP 目标方案的实施规则

[千人企业 MVP 与沙箱执行面实施方案](sandbox-execution-surface-design.md) 是 P0–P3/D0–D2 的执行基线。P0 契约、P1 lazy/限额原子文件、四工具与 SandboxToolsBackend 协议适配器、私有制品存储/交付回调已落地，Docker 新契约已通过，但尚未接入生产；本轮不做容量/持续负载/突发并发测试，资源限额和安全契约仍须实现；进度、inventory 和样例规格见 [实施记录](runtime-foundation-implementation.md)。新增 RunDescriptor/Worker、操作与产物账本、provider 强杀/限额/原子写、reaper 和 Durable 恢复测试时，按其工作包顺序与上线门禁推进；实际新增目录、迁移和 package.json 命令在落地时同步本文。不得把方案里的保护值当成已有配置，也不得把 close 测试、提交去重或同名工具覆盖当成崩溃恢复、业务恰好一次或安全隔离证明。

## Skill 沙箱实施约束

最新需求优先实现 [Skill 沙箱基本执行](skill-sandbox-execution.md)：复用现有 RPC，不新建 Worker/backend/审批系统；`sandbox-rpc/skills.ts` 在 Linux 宿主用 pinned fd 限额收集启用目录，使用 SandboxHandle.filesystem 原子复制，在 Pi 启动前完成。RuntimeSpec.skills 仅宿主装配引用；不要接受客户端路径/原始脚本字节，不作为 Worker DTO。官方 CLI --no-skills + 显式 --skill 与原生 /skill:name 承接加载/展开，模型使用 read，不新增宿主工具闭包桥。Mac portable collector 仅明确 test 选项（NODE_ENV=test）；生产不得 fallback。`pnpm test:skills:sandbox` 包含 14 项，随 test:runtime 收集；fixture 在 tests/fixtures/skills，真实探针与打包步骤见上述文档，默认跳过且不调用真实 LLM。

原 manifest/hash/path 协议、Node-only hash helper 与 tests/unit/runtime/protocol/skill-bundle.test.ts 保留。只读 mount/不可变审批、逐次正式授权、持久 intent、执行-only OpenSandbox tools/Worker 属于 [企业目标](skill-sandbox-security-design.md)，其门禁不因 RPC 资源补齐取消；enabled/复制/regular 元数据不代表批准或企业安全验收。

## 新代码放置

- HTTP 路由和页面放在 `app/`；路由负责解析输入、鉴权和调用业务层。聊天运行控制放在 `lib/runtime/run`，后端实现放在 `lib/runtime/backends`，Pi 会话与资源装配放在 `lib/ai`。
- 平台与 Pi 的边界先扩展 `lib/runtime/protocol`，再改后端和 UI 映射；不要让页面或组件直接解析 Pi 内部事件。
- 数据结构/迁移归 `lib/db/schema.ts` 与 `lib/db/migrations`；数据访问归 `lib/db/*-queries.ts`。管理业务规则归 `lib/admin`。
- Pi 官方已有的会话、工具、状态或包管理能力应优先复用；修改 Pi 集成前按 [AGENTS.md](../AGENTS.md) 核对当前安装版本的官方资料。

## 测试目录

所有自动化测试代码放在 `tests/`，不在 `app/`、`lib/`、`components/` 等源码目录内添加 `*.test.*` / `*.spec.*` 或测试专用替身。

```text
tests/
  unit/                 node:test；按被测业务模块分组
    ai/ db/ mcp/ pi-packages/ chat/ runtime/
  integration/          需要真实外部服务的专项验证脚本
  support/              node:test 专用环境、契约用例和替身
  fixtures/             文件、Pi package 和模型 fixture
  e2e/                  Playwright 场景
  pages/ prompts/       E2E page object 与 prompt 辅助
  fixtures.ts helpers.ts  E2E 公共入口
```

单元测试优先用 `@/lib/...` 或显式相对导入被测模块。测试前置环境 `tests/support/runtime-env.ts`、`tests/support/db-env.ts` 必须按测试文件中的首个 side-effect import 先加载；RPC faux 扩展是 `tests/support/faux-provider-extension.ts`，通过文件路径传给子进程。`tests/fixtures/mock-models.ts` 和 `legacy-ai-sdk-models.ts` 是 AI SDK 模型替身，不作为 `node:test` 用例收集；后者仍由 `lib/ai/providers.ts` 的测试环境分支引用，后续调整该旧链路时应改为显式注入测试模型。

手工验证 MCP 管理链路的 stdio/HTTP 服务在 `tests/fixtures/mcp-servers/`；用法见该目录的 README。真实模型插件链路验证在 `tests/integration/plugin-chain.mts`，需要可用的 DeepSeek 凭据。`scripts/` 只保留构建脚本，不存放测试实现。

## 常用验证

```bash
pnpm exec tsc --noEmit
pnpm test:unit          # 无数据库的 node:test
pnpm test:search        # 平台联网搜索：网关/授权/限额/官方工具循环/来源/路由，无真实外部调用
pnpm test:runtime:foundation # P0 DTO/状态与 P1 lazy/操作错误分类，无 DB/容器
pnpm test:skills:sandbox # 现有 RPC 完整 Skill 目录与真实官方工具循环，无真实模型
pnpm test:skills:sandbox:smoke # 默认跳过；Linux 单真实容器 + faux model，需打包测试扩展
pnpm test:runtime:tools # 文件/工具/后端与私有交付契约；Docker 可用时运行真实组
pnpm test:runtime:durable # SQLite/单写者/恢复阻断与真实子进程 SIGKILL
pnpm test:runtime:durable-sandbox # 组合适配器/PTY；真实 OpenSandbox 默认跳过
pnpm test:runtime:durable-chat # 开发准入/test 白名单/绑定/水合/私有交付，无 DB
pnpm test:runtime:durable-chat:db # 正式 DB enabled/归属/状态与附件授权
pnpm test:runtime:durable-chat:http # 默认跳过；显式 opt-in 才调用真实模型/provider
pnpm test:runtime       # 含 Durable 基础、沙箱 tools、RPC、RunManager 与聊天流映射
pnpm test:runtime:db    # PostgreSQL 集成测试；需 .env.local 中 POSTGRES_URL
pnpm test              # Playwright E2E；会启动本地 Next.js 服务
pnpm test:chat:share:ui # 隔离 Chromium 分享及邀请弹窗：自动生成/重开复用/轮换/失败重试/撤销、勾选即添加成员及失败重试、邀请弹框已加入/未加入成员均可协作及 Fork、关闭回首页/移动端边界；API 与导航模拟，无 DB/模型
pnpm check             # 项目静态检查
pnpm plugin:verify     # 模型插件链路验证
```

`playwright.config.ts` 的 `testDir` 指向 `tests`，项目 `e2e` 只收集 `tests/e2e/*.test.ts`。新建单元测试时按模块放入 `tests/unit` 并更新相应的 `package.json` 命令；需要共享替身时放 `tests/support`。数据库测试与普通单元测试分开运行，避免无数据库环境下误收集。

## 平台联网搜索

配置 `PIWORK_WEB_SEARCH_ENABLED=1` 与服务端 `TAVILY_API_KEY` 后重启，新对话明确要求联网并引用来源。首版为固定 Tavily public search，不依赖已安装 pi-web-access、不抓取任意 URL；只有无工作区轻量会话装配官方 customTools 的 platform_web_search。matrix 可在现有 OpenSandbox/Durable 配置下保持轻量；all/RPC 不支持时拒绝，不能回退宿主，混合执行仍按原门禁。Key/供应商原始错误不进入模型或事件，查询词会发送到 Tavily，不是自动 DLP。sources 经新 source.created → source-url 在 stream 与最终消息同形保存。

`pnpm test:search` 覆盖测试替身与真实官方 AgentSession 工具循环；网关/工具测试随 test:unit，来源/路由测试随 test:runtime。单进程限额契约不等于容量或分布式配额验证。无新 DB 表/迁移，未改 .env.local，默认关闭；缺 Key 明确工具错误。真实联网与浏览器 UI 尚需配置后验收。完整配置/安全口径见 [联网搜索](web-search.md)，参考 Pi docs/sdk.md、docs/extensions.md、sdk.d.ts 和 pi-agent-core AgentTool 类型，以及 Tavily 官方 Search API。

## 企业 Runtime 基础验证

- 新协议测试放 `tests/unit/runtime/protocol`；lazy/错误分类测试放 `tests/unit/runtime/sandbox`，均纳入 `test:runtime`。
- DTO fixture 放 `tests/fixtures/runtime/run-descriptor.ts`，惰性 provider 替身放 `tests/support/sandbox/lazy-provider.ts`；禁止进生产装配。
- `RunDescriptor` 校验不是授权；Worker 接线时仍需身份/文件/工具复核与输入快照。`ExecutionState` 不是当前 DB enum，新增消费者与迁移前不得直接写入 AgentRun。
- LazySandbox 本批次 kill-only，无自动 provision/命令重试。close 必须等待迟到资源释放并观察异常；新增 Docker tools 强杀/路径/原子写测试已通过；OpenSandbox 新能力、持久卷、reaper 仍待验收。
- `sandbox/filesystem.ts` 通过固定 Node argv helper 执行限额读/stat/原子写；Linux 用 pinned dir fd + O_NOFOLLOW 拒绝链接/逃逸，非 Linux 降级仅测试显式启用。生产镜像须有 Node 与 /proc/self/fd；不得回退旧的无界 readFile/非原子 writeFile。
- `backends/sandbox-tools/backend.ts` 已实现 RuntimeBackend，复用 InProcessRuntimeSession/官方 AgentSession，但未进入生产装配与 DB backend 枚举。复用 Pi 官方 schema/truncation 与 edit/write operations；read/bash 避免官方默认宿主路径探测、图片解码和临时日志。authorization 回调在 provision 前执行，私有交付回调先归档后发 artifact.created；P2 尚需持久 intent、正式 DB 授权/归档与路由接线。
- tools 测试在 `tests/unit/runtime/backends/sandbox-tools`，文件契约在 `tests/unit/runtime/sandbox/filesystem.test.ts`；`test:runtime:tools` 与 `test:runtime` 均收集。Docker 组复用 `PIWORK_SANDBOX_DOCKER_TESTS=0|1`，使用 node:22-alpine 与仓库 .pi/test-sandboxes；OpenSandbox 不因 Docker 通过而视为通过。
- 命令观察仅存内存（最多 1000 条）；完成 shell 不是子孙退出证明。超时/取消/断连/输出超过 10MiB 后 kill 全沙箱、验证 destroyed 再报停止证据，失败保持未知且不重放；每 run 最终必须 close。版本前置条件不是针对任意并发 shell writer 的内核 CAS，P2 仍需独占 workspace/fencing 与持久对账。
- 新 adapter 的 beforeTerminal/onAbort 等生命周期钩子只对 tools 生效，默认 InProcess 行为不切换；清理失败可重复观察且不能发 settled，单 run 会话不可在回收后再次 prompt。SandboxSpec 的 run/chat/source/deny-all 必须匹配；OpenSandbox tools 目前明确拒绝。
- `lib/ai/private-file-store.ts` 的 operationKey 必须由平台绑定 user/run/tool-call，不来自模型；本地根目录必须是 Web/Worker 共用的持久私有卷且不挂入沙箱。确定 key/原子 link 不覆盖已有对象，冲突拒绝；bytes/metadata/DB 不是跨系统事务，仍需账本与对账。既有 public Blob 上传不自动迁移。
- 新 tools 使用 SDK SettingsManager.inMemory 的 images.autoResize=false；AgentSession 不仅 read，还会对 prompt/tool result 图像归一化，所以必须同时验证受支持 MIME/大小。关闭 resize 不能单独防止不支持格式的 conversion；普通会话默认不变。对应 `tests/unit/ai/agent-session-isolation.test.ts` 与 backend 图像输入测试。
- 新 `private-file-store.test.ts` 验证私有 URL/幂等并发发布/冲突/元数据修复；真实 Docker 新增完整 SDK→CSV→私有存储/归档回调→制品事件契约，归档回调用替身，不当作真实 DB/HTTP 权限验收。全部随既有 test:unit/test:runtime 收集。
- 无独立 pnpm PATH 时可用 `corepack pnpm` 执行现有脚本。本批次未增加 DB 表、配置开关或 Pi 依赖版本。

## 非生产 Durable 聊天自动分流

- `PIWORK_DURABLE_CHAT_ENABLED=1` 仅 development/test 的正式启用成员：development 无需用户白名单，所有正式启用账号可自动分流（忽略旧名单）；test 仍要求非空 UUID 白名单。生产/未知环境拒绝；必须 private absolute `PIWORK_DURABLE_STORAGE_DIR`/`UPLOAD_DIR`，不重叠/不在宿主 workspace，env 改动重启。不能用全局 `PIWORK_RUNTIME_BACKEND=durable` 开这个车道，原 provider/global Durable 互斥不删。启动配置见 [组合说明](durable-sandbox-composition.md) 与 [运行手册](operations.md)。本地启用只需车道开关和私有绝对目录；未启用时保持原矩阵。
- `run/durable-chat.ts` 注入 DB 授权（查询 `db/durable-chat-queries.ts`）、Leasing reuse=false、库文件查询/有界读取与私有归档；`backends/durable/chat-*` 负责策略/hash/binding/水合/受管执行。RuntimeSpec 仅包含服务端 reference-only grant（身份、最终 promptHash、模型目录 ID、LibraryItem/hash/size/相对路径），不传附件字节/闭包，也不冒充跨进程 RunDescriptor。AgentRun.backend 新增 durable_sandbox，数据库原列是 varchar，无 SQL enum/迁移。
- UI 无后端勾选框，客户端 runtimeLane 被 schema 剥离。route 在附件解析/宿主工作区创建前复用执行分类器，由 routing/chat-routing.ts 决定内部 lane；问答走轻量链路，四工具执行任务走 Durable。Skill 命令、平台关键词/启用技能与 MCP/extension Package 名称、近期非四工具调用、审批与分类不确定保守留既有链路，不扩张其原有闭包/MCP/Package 能力。元数据只在宿主用于准入保护，不向模型发送凭据。Durable 不装配 Skill/Package/MCP/定时任务，组合适配器非空 tools 仍拒绝。每消息是 fresh-run，不能续用上次临时文件。附件先核验本人归档 metadata/限额，再首次工具命令前重新查归属/hash/size，经 filesystem 原子水合；不在宿主解析 Office/解码图片。私有写入/正式 LibraryItem 归档完成才发制品事件。未启用 Durable 时保持原矩阵，选定后授权/附件/后端失败不 fallback；无工作区普通会话本就禁用受管扩展/MCP，现在也不写共享 MCP 配置。
- 取消中断水合并强杀沙箱，shell 未知结果允许 failed/outcome unknown，不能为了 Stop 测试强行改成干净 aborted；终态前核验停止、不自动重放。Leasing release 必须解包原 handle，不能向严格 provider 传 lease wrapper，单测覆盖归属与记账。
- 新单测随 `test:runtime` 收集；DB 测试在 tests/unit/db；HTTP 入口 tests/e2e/durable-chat-http.mts，显式 PIWORK_DURABLE_CHAT_HTTP_TESTS=1（真实模型/provider）。测试 helper 在 tests/support/durable，创建唯一隔离 PG schema，无 public search_path fallback；迁移 public FK 仅 fixture 重映射，只复制加密模型配置，不复制用户/聊天/任务。避免第二个 Next 进程的 RunManager orphan sweep 改动日常 runs。独立 NEXT_DIST_DIR/NEXT_TSCONFIG_PATH 隔离构建并恢复仅本组生成的 next-env import，成功停服后删除仅本组 schema/目录，失败保留证据待人工核验。真实 HTTP 已通过，不代表浏览器 UI、生产权限治理、Worker/恢复/安全硬隔离/容量。

## Pi 依赖升级验证

当前基线、官方 breaking changes 与本轮验证见 [Pi 升级记录](pi-upgrades.md)。精确版本仅维护在依赖文件、镜像默认值及 Durable binding/hash 中；以下旧版本测试数字保留为历史记录，不代表本轮验收。

### 历史 Pi / Durable 1.0.3 升级验证

- 五包（pi-ai/pi-agent-core/pi-coding-agent/pi-durable/chord）与 pnpm 锁文件固定 1.0.3；Dockerfile 默认版本同步，已重建 pi-runtime:dev。依据官方 durable/coding-agent/ai CHANGELOG 1.0.3、安装版 durable README/dist/env/index.d.ts 和 coding-agent docs/sdk.md；继续复用官方 NodeExecutionEnv/Harness/SQLite/AgentSession，不新增 agent loop。
- Durable 1.0.3 扩展 FileSystem/BinaryReader/Shell 的 breaking changes 无本地自定义 ExecutionEnv 需要补接口；SandboxHandle 是另一平台 seam，不自动获得官方 watch/reader 能力。Azure provider 改名 azure，旧外部 auth/models/settings 配置须人工核对，API id azure-openai-responses 不变。
- storage binding 与 durable chat input hash 版本同步；1.0.2 及更旧运行拒绝跨版本静默重开，须另做迁移验收，不删除 owner marker、不重放 shell。新增 storage.test.ts 分别验证 durableVersion/piVersion 漂移拒绝。
- 验证：tsc --noEmit；PIWORK_SANDBOX_DOCKER_TESTS=0 pnpm test:runtime（330 项，315 通过、15 跳过、0 失败）；pnpm test:unit（48/48）；PIWORK_SANDBOX_DOCKER_RPC_TESTS=1 的 backends.test.ts（49 项，41 通过、8 既有边界跳过、0 失败，SandboxDocker 实际 6 项通过），容器包版本核验 1.0.3；定向 Biome 与版本绑定回归 5/5 通过。真实模型/OpenSandbox HTTP、旧存储迁移、生产恢复和容量不在本次验收范围。重启服务以加载新 SDK 与 HMR 单例；外部部署镜像也须更新。

## Durable 持久化与恢复基础（未接生产）

- 新实现为 `backends/durable/storage.ts` 与 `recovery.ts`；只复用官方 SQLite facade/storage/Harness/inspect/context，不重写 scheduler。当前全 Pi/chord 版本以 package.json 与锁文件为准；registry.install(defineExtension)、section、conversation.configure 与 settings.toolExecution 按新版 API 迁移，移除了旧 HarnessOptions 兼容转型。SQLite 仍为 Runtime 状态存储；PostgreSQL 只持有控制面数据与平台投影，本轮 PostgreSQL Storage 代码/测试/两项迁移及本地新增空表已经撤回。
- 私有根必须是可信持久卷；binding 由平台已授权的 user/chat/run 与不可变输入/配置 hash 组装。目录/文件不可公开，不挂入沙箱。SQLite FULL 不是已测主机容灾或备份。
- owner marker 使用 O_EXCL，不因进程 PID/租约过期自动删除；崩溃后 fail-closed，需要未来 Worker/reaper 停止旧执行端并重新授权后对账。存储锁不是 workspace lock，不支持多 Writer/共享盘分布式恢复。
- 先授权/open/inspect，后 submit/wait/resume；后者均可启动官方调度。所有通用工具 replay=unsafe，每次 execute 都授权并透传 signal；禁止只依赖恢复会跳过的 beforeTool hook。未知 intent/已物化未知结果拒绝恢复，当前返回 needs-review 错误，尚未落平台 needs_review DB 状态。
- `DurableBackend` storageFactory 必须搭配 authorize；NODE_ENV=production 默认 MemoryStorage 抛错；持久路径 workspace 非 null 默认拒绝，仅可信 executionFactory + owned storage/authorize/runId 可承载受管执行。新 `DurableSandboxBackend` 本身生产拒绝，OpenSandbox 需显式非生产探针；fresh-run/单 prompt/deny-all，无平台工具/MCP/自动恢复。默认实验开关仍无正式持久 factory，不能用于生产部署，也不与 Sandbox provider 同启。装配/真实契约命令和剩余门禁见 [组合适配器](durable-sandbox-composition.md)。
- `tests/unit/runtime/backends/durable/` 的 14 项由新 test:runtime:durable 与全 Runtime 收集；子进程 fixture 在 tests/support/durable，测试显式 kill/exit 后解锁不是生产策略。生产尚缺 Worker/job mapping、snapshot/source cursor、正式授权/账本/取消删除对账及部署演练；见 pi-durable-evaluation.md。

SQLite 不是 Demo 标记，PostgreSQL 也不是所有状态的唯一生产选项。当前每个 run 的 SQLite 必须位于可靠私有持久卷，不得依赖容器临时盘；单 Writer、备份恢复、Worker 唤醒与崩溃副作用对账是独立上线门禁。旧版本 binding 数据不可静默跨版本重开，须另做版本迁移验收。Cloudflare DO 的 SQLite/Alarm/PITR 不是当前 Node 部署的现状。

## 文档库验证

- 先运行 `node --import tsx lib/db/migrate.ts` 应用 `0010` 目录及历史记录回填。
- `pnpm test:documents:db`：真实 PostgreSQL，验证所有权、文件夹/移动、交付归档顺序、失败传播及 Document 版本去重。使用独立测试用户并清理记录、临时文件；普通 Runtime 测试仍不依赖数据库。
- `pnpm test:documents:http`：先启动本地 `pnpm dev`，默认访问 `http://localhost:3000`（可设 `LIBRARY_TEST_URL`）。用本地 AUTH_SECRET 签发独立测试用户会话，验证任意格式上传、文件夹归属、下载字节、重命名/移动、跨用户拒绝和输入校验，随后清理测试数据。脚本在 `tests/e2e/library-http.mts`，不纳入默认 Playwright 收集。
- `pnpm exec tsc --noEmit`、相关文件 Biome 检查，以及 `pnpm test:runtime` 验证原有事件链路。
- 本机 Colima/OpenSandbox 网络：`host.docker.internal` 示例不保证适用所有环境。需从沙箱验证 `PIWORK_INFERENCE_URL` 实际可达（无 token 应返回 401）；若解析成 Clash 的 `198.18.*` fake-IP 或连接超时，应修正本机 DNS/TUN 与宿主路由，不关闭 egress 限制、不回退 in-process。仅在宿主成功监听 3210 不能证明沙箱能访问。
- 本地推理网络排障（2026-10-03）：`host.docker.internal` 在 Clash fake-IP 下解析为 `198.18.0.112`，沙箱内 Pi 报 `fetch failed`。本机验证可改用宿主当前局域网地址（本次 `PIWORK_INFERENCE_URL=http://172.20.10.2:3210`），重启开发服务后复验；该地址不是跨网络固定配置，切换网络需重新确认。OpenSandbox 当前 egress 镜像支持显式 IP target，本次仍下发 `defaultAction: deny`，仅放行代理地址。验证必须从带相同 policy 的新沙箱发请求，再跑真实聊天；宿主可达不能替代沙箱验证。Pi 1.0.0 `pi-ai/dist/api/pi-messages.js` 向 `baseUrl/messages` 发请求，网络错误由官方客户端传回；本次仅调整本地代理地址。真实 `/api/chat` 发送「你好」已返回「你好！有什么可以帮你的吗？」，AgentRun 的 backend 为 `sandbox_rpc`、status 为 `settled`、errorMessage 为 null。
- 本地推理网络复查（2026-10-04）：Run `4a4dd76f-a8f2-453c-a467-e1efa9ab0d6a` 为 `failed / fetch failed`，无 tool 事件且无 InferenceAccessAudit；沙箱 ready 不是 run running。本机切换网络后宿主地址为 `192.168.1.5`，旧 `172.20.10.2:3210` 超时。本地 `.env.local` 已改为 `http://192.168.1.5:3210`；新建 OpenSandbox（defaultAction=deny，仅 allow 新 IP）内通过 `docker exec` 发无 token POST `/messages` 得到 401，验证网络与代理鉴权入口可达，验证容器已销毁。- OpenSandbox server 全部 create 超时排障（2026-10-04）：`acquire 失败: Request timed out (timeoutSeconds=30)`，server 侧实际错误为 `Egress sidecar did not become ready within 30s ... [Errno 61] Connection refused`。同刻同端口对照：宿主 curl 与一次性 venv python 探测新 sidecar `/healthz` 均 200，仅长驻 server 进程持续 refused——Python urllib 默认 opener 只在进程首次请求时捕获一次系统代理；server 启动时 Clash 系统代理开启，Clash 关闭后其就绪探测全被发往已关闭的本地代理端口。修复 = 重启 opensandbox-server（当前系统代理已关则直接恢复）；加固 = 启动时加 `no_proxy=*`。server 代理链路受影响时 SDK server-proxy 的 RPC 也会失败，重启后需从新沙箱复验完整聊天。
- Provider startProcess 探针另遇文件上传 502，未将网络探针当作完整 RPC/真实聊天验收；需重启开发服务加载新配置，并销毁旧白名单沙箱后复验聊天。官方依据：安装版 pi-ai 1.0.2 `dist/api/pi-messages.js`（POST baseUrl/messages，fetch 异常转 error 事件）。
- 沙箱启动排障：聊天流异常见服务端 `[chat] stream execution failed` 日志；backend.open 失败必须落 failed 并释放 lease。沙箱 argv 派生传显式 cliPath，不能依赖 Turbopack 的 import.meta.resolve。参考 Pi 1.0.0 `dist/modes/rpc/rpc-client.js` 的 cliPath 注入契约。
- 开发模式 RunManager 单例跨 HMR 保留；更新 Runtime 组装回调后重启开发服务才能让已有单例加载新回调，避免替换仍有活跃运行的单例。

### 聊天文档库选择验证

- `pnpm test:chat:library` 验证搜索/最近排序、目录排除、跨文件夹选择、格式与20 MB限制、笔记 MIME 归一化；也由 `test:runtime` 收集。
- `pnpm test:documents:http` 新增选择接口：本人文件解析、非本人/文件夹拒绝、无效 ID 与不支持扩展名拒绝。沿用独立账号与文件清理，不调用模型。
- `pnpm test:chat:library:http` 使用本地服务和独立正式身份（`LIBRARY_TEST_URL`），Chromium 截获文档库、模型目录、附件解析与聊天 POST，验证搜索、图片/文件名、浏览全部、附件发送和390px布局；不调用真实模型，不等于真实附件问答或容量验收。
- 上传文件复用现有存储引用；可编辑笔记选择时归档快照，沿用原存储模式（旧 public Blob 不迁移）。项目预建 query 链路仍不传附件。Pi 依据为安装版 Pi SDK/Message Types与PromptOptions.images/ImageContent，既有Runtime负责运行。

## 定时任务验证与运行

1. `pnpm db:migrate` 应用 0012（增加 enabled/领取租约和运行记录，旧 cancelled 任务转为停用）。
2. 常驻 Node 开发/部署环境设置 `SCHEDULED_TASKS_ENABLED=true`，重启 `pnpm dev` 或 `pnpm start`；默认不开启后台调度。进程启动时立即扫描，之后每 30 秒扫描，且不会重入。进程必须保持运行。手动“立即运行”不依赖该开关。
3. `pnpm test:scheduler` 验证 Cron 时区、非法输入、工具创建协议和完成语义；`pnpm test:scheduler:db` 使用 .env.local 的本地数据库，独立测试用户，验证归属、并发领取、暂停、重复执行、运行记录和过期租约。
4. 任务中心输入“每天上午 9 点整理 AI 日报”，应进入真实聊天，AI 调用创建工具；回到任务中心后应看到计划及北京时间。立即运行后应先显示运行中，终态后打开结果。失败后仍保留下一周期。
5. 运行期间暂停仅阻止后续计划；运行期间编辑和删除返回 409。删除任务保留已生成聊天，删除聊天将运行记录的 chatId 置空。
6. POST `/api/scheduled-tasks/execute` 必须携带 `Authorization: Bearer <SCHEDULED_TASKS_API_KEY>`；缺少配置亦返回 401。不要在前端暴露该密钥。外部调用须允许最多 360 秒响应时间。

## 项目 Workspace 验证

- `pnpm test:chat:models`：目录未加载/空目录、有效/失效偏好与模型授权错误提示；随 `test:runtime` 收集。`pnpm test:chat:models:http`：已有本地服务（可设 CHAT_MODEL_TEST_URL），独立 enabled 身份/项目/聊天，Chromium 延迟模型目录并覆盖无 cookie/旧 ID/有效 ID，断言项目 query 只发一次且请求模型与选择一致。POST 被截获，不调用真实模型、不修改现有账号/聊天。模型身份依据安装版 Pi `docs/models.md`；仅修平台目录消费，服务端授权与既有 RunManager/Pi 链路不变。

1. `pnpm db:migrate` 应用 0013（Project/Source 表与 Chat.projectId/updatedAt）。
2. `pnpm test:runtime:db` 覆盖 `tests/unit/db/project-queries.test.ts`：项目归属隔离、项目聊天列表摘要排序、资料写入/删除与项目级联清理。
3. 手动流程：`/projects` 创建项目 → 进入项目 → 「来源」上传 PDF/TXT/Markdown → 大输入框发起聊天 → AI 回答应引用资料内容 → 返回项目主页聊天列表可见标题/摘要/时间 → 再开新聊天仍引用同一批资料。删除项目后其聊天与资料一并消失，且不出现在主侧边栏「最近」。

## 对话分享与协作验证（2026-10-09）

- `pnpm test:chat:share`（真实 PostgreSQL，`tests/unit/db/chat-share-queries.test.ts`）：协作成员增删查、`getChatAccess` 归属判定、分享链接创建/过期/撤销/regenerate 轮换、token 哈希恒时比较、fork 复制语义、`listChatHistoryIncludingShared` 合并与游标。
- `pnpm test:chat:share:unit`（无 DB）：token 生成格式与哈希拒绝。
- `pnpm test:chat:navigation:ui`：隔离 Chromium，使用实际 ActiveChatProvider/ChatHeader/SidebarHistory，模拟 Next 导航与 HTTP，不连接 DB/真实模型；覆盖新对话生成中分享、即时侧栏刷新、多次切换后历史水合，以及协作成员无分享入口和头部占位按钮隐藏；实际 MultimodalInput 另覆盖缓存草稿 `n` 初始化恢复、Backspace 删除与全量清空，恢复仅初始化一次，持久化必须晚于恢复，空字符串不能重新回填旧缓存。新对话元数据刷新不得覆盖本地生成流，也不得在 submitted/streaming 时另行 resume。标题通知须晚于 DB 更新。Pi 依据为安装版 Pi `docs/message-types.md`；本次仅修平台 UI 状态与消息投影，不新增 Pi API。
- `pnpm test:chat:collab`（无 DB，`tests/unit/collab/chat-event-hub.test.ts`）：SSE 房间 attach/detach 的 hello/presence 广播、typing 6s TTL 到期清除与手动停止、同用户多连接的 typing 生命周期、message/run 事件广播与空房间 no-op；不测 HTTP 层。
- 实时协作 HTTP 冒烟（SSE 鉴权 401/403/404、hello/presence/typing 事件到达、typing POST 204）已用本地 dev server + 临时脚本验证，脚本不入库；完整链路验证见 docs/chat-collaboration.md §7 手工路径。
- 手动路径：A 分享给 B（直接添加）+ 生成链接给 C；两个浏览器登录 A/B 打开同一对话，一方发消息/输入，另一方实时看到消息出现、在线绿点与「正在输入」；A 移除 B 后 B 的 SSE 在 15s 内收到 missing 断开。

## 沙箱 Runtime 验证

日常启动顺序、健康检查与维护处置（含 OpenSandbox server 启动脚本与已知故障）统一见 [运行手册](operations.md)；本节只保留测试与验收。

1. `pnpm db:migrate` 应用 0014（Sandbox 表与索引）与 0015（InferenceAccessAudit）。
2. `pnpm test:runtime` 覆盖：`tests/unit/runtime/sandbox/`（provider 契约、bridge 泵、`docker-provider.test.ts` 的 Docker 契约组）、`tests/unit/runtime/backends/sandbox-rpc.test.ts`（fail-closed、seeding 落 workspace、close→kill、deliver_file 全链路）、`tests/unit/runtime/backends/sandbox-rpc/artifact-gateway.test.ts`（manifest 收割/幂等/容忍）、`tests/unit/runtime/backends/sandbox-rpc/inference.test.ts`（egress 派生、mint/acquire 失败闭环、Inference Proxy 全链路：沙箱内真实 pi 经 models.json + run token 走代理出文本）、`tests/unit/runtime/inference-proxy/`（events/tokens/models-manifest/server，上游用官方 `fauxProvider`）与 `tests/unit/runtime/backends/backends.test.ts` 的 `SandboxRpc` harness（官方 pi 经 bridge 跑完整契约，与 LocalRpc 同套件）。沙箱契约测试默认用 `TestSandboxProvider`（`tests/support/sandbox/`），不需要 Docker。
3. DockerSandboxProvider 契约组需本机 docker（colima 可）：无 docker 自动整组跳过；`PIWORK_SANDBOX_DOCKER_TESTS=0` 强制跳过、`=1` 强制开启。workspace 落在仓库 `.pi/test-sandboxes/`（colima 只挂载 /Users；目录已 gitignore）。egress allowlist 对照用例会在宿主起临时探针（绑 `0.0.0.0`）验证白名单 FQDN 经网关可达、外网/未列 FQDN 拒绝。
4. **pi-runtime 镜像**（`docker/pi-runtime/Dockerfile`，预装完整 `@earendil-works/pi-coding-agent`，非 root `pi` 用户，workspace 挂载点 `/workspace`）：`docker build -f docker/pi-runtime/Dockerfile -t pi-runtime:dev docker/pi-runtime`。pi 版本与仓库 `package.json` 一致（`--build-arg PI_CLI_VERSION=` 覆盖）。受限网络（docker.io 直连不可达）：先 `docker pull docker.m.daocloud.io/library/node:22-alpine && docker tag docker.m.daocloud.io/library/node:22-alpine node:22-alpine`，再加 `--build-arg NPM_REGISTRY=https://registry.npmmirror.com`。构建后 `PIWORK_SANDBOX_CLI_PATH=/opt/pi/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js`。
5. **Docker provider 上的 RPC 契约组（gated）**：`PIWORK_SANDBOX_DOCKER_RPC_TESTS=1` 时 `tests/unit/runtime/backends/backends.test.ts` 追加 `SandboxDocker` harness（需镜像已构建 + 本机 docker）：同一契约套件跑真实容器底座（RpcClient → UDS bridge → docker exec → 容器内完整 pi）。faux 扩展经 esbuild 预打包为自包含 .mjs（`tests/support/sandbox/faux-extension-bundle.ts`），与 LocalRpc 共用同一扩展源文件。默认关闭（不设该变量 = 不注册 harness）。
6. `pnpm test:runtime:db` 覆盖 `tests/unit/db/sandbox-queries.test.ts`（注册表/租约、externalId 重连、运行中停止与归属过滤）与 `tests/unit/db/inference-audit-queries.test.ts`（脱敏字段落库、chatId 无外键——chat 删除后审计仍在）。
7. 生产装配开关：`PIWORK_SANDBOX_PROVIDER=docker|opensandbox` + `PIWORK_SANDBOX_CLI_PATH`（沙箱内 pi 安装绝对路径；可选 `PIWORK_SANDBOX_IMAGE`/`PIWORK_SANDBOX_TTL_SECONDS`）切换沙箱装配；`PIWORK_SANDBOX_ROUTING=matrix`（默认，路由矩阵：执行工具的 run 走沙箱、纯对话 in-process，AgentRun.backend 落实际执行位）|`all`（全量沙箱）；opensandbox 另需 `OPENSANDBOX_DOMAIN`/`OPENSANDBOX_API_KEY` 必填（可选 `OPENSANDBOX_PROTOCOL`/`OPENSANDBOX_READY_TIMEOUT_SECONDS`/`OPENSANDBOX_EXECD_PORT`）；未设置 = InProcess 不变；错误取值/缺配置启动即抛错（fail-closed）。Inference Proxy：设置 `PIWORK_INFERENCE_URL`（沙箱视角可达地址，如 `http://host.docker.internal:3210`）即启用（缺省 = deny-all 无模型通道），可选 `PIWORK_INFERENCE_PROXY_HOST`（默认 `0.0.0.0`）/`PIWORK_INFERENCE_PROXY_PORT`（默认 3210）/`PIWORK_INFERENCE_EGRESS_ALLOWLIST`（逗号分隔 FQDN 基线）。
8. OpenSandbox server 是外部依赖，不在默认测试内：本地 spike 方式见 [OpenSandbox 接入 Spec](opensandbox-integration-spec.md) §6 Phase 0（源码运行、colima 注意事项、已知坑）。本地复跑：`~/.sandbox.toml` 就绪后在 `/tmp/OpenSandbox/server` 以 `DOCKER_HOST=unix://$HOME/.colima/default/docker.sock OPENSANDBOX_SERVER_API_KEY=<key> uv run opensandbox-server` 启动。
9. **OpenSandbox provider 真实 server 契约组（gated）**：`PIWORK_SANDBOX_CONTRACT_OPENSANDBOX=1 OPENSANDBOX_DOMAIN=127.0.0.1:8080 OPENSANDBOX_API_KEY=<key> node --conditions=react-server --import tsx --test tests/unit/runtime/sandbox/provider-contract.test.ts`（可选 `OPENSANDBOX_PROTOCOL`/`OPENSANDBOX_IMAGE`，默认 `pi-runtime:dev` 需已构建并预拉 `opensandbox/execd:v1.1.0`/`opensandbox/egress:v1.1.7`）。同一契约套件追加 `[OpenSandbox]` harness（12 用例，2026-10-02 实测 12/12）；离线单测 `opensandbox-provider.test.ts`（21 用例）常驻默认套件，不需要 server。
10. 路由矩阵测试：`tests/unit/runtime/backends/routing.test.ts`（矩阵判定、分流、fail-closed 不回落、RunManager 逐 run 落库、真实 SandboxRpcBackend 分流闭环）随 `pnpm test:runtime` 常驻。冷启动为一次性实测（2026-10-03 colima docker 档 P50 490ms），无常驻测试。

### OpenSandbox 单机启用验证（2026-10-10）

- `pnpm test:opensandbox:activation`：仅 `PIWORK_OPENSANDBOX_ACTIVATION_TEST=1`；读取当前 DB 额度并创建一个真实沙箱，检查 Docker 实际 CPU/内存、loopback 映射、文件/PTY/Pi 版本、代理 401、续期和删除。要求本机 Docker 管理权限；不是容量或完整安全验收。
- `pnpm test:opensandbox:rpc`：仅 `PIWORK_OPENSANDBOX_RPC_TEST=1`；官方 RpcClient getState，不提交 prompt、只注入无效模型 token。`PIWORK_RPC_PROBE_EXTENSION=1` 加交付扩展与合成历史，创建/上传均使用官方 SessionManager，cwd 指向沙箱内目录；不读取真实用户历史。
- `pnpm test:opensandbox:chat`：仅 `PIWORK_OPENSANDBOX_CHAT_TEST=1`，复用已启动 HTTP 服务（默认 127.0.0.1:3002，可设 OPENSANDBOX_CHAT_TEST_URL），创建唯一正式启用测试身份；真实模型先问候走 in_process，再带历史执行 bash/file 走 sandbox_rpc，核对终态和资源快照/销毁。成功仅清理本组身份/Chat/Message/Sandbox/workspace；失败禁用夹具成员并留 /var/tmp 证据，不重放失败 run。不启动第二个 RunManager，不清理其他会话。
- 三项入口在 `tests/e2e/opensandbox-*.mts`，默认跳过；配置与启动见 operations.md §8。RPC seeding 回归在 sandbox-rpc.test.ts 断言上传 header.cwd=handle.workspaceRoot。依据安装版 Pi 1.1.0 docs/sdk.md、session-format.md、dist/core/session-cwd.js 与 dist/main.js 的 CLI 工作目录检查；不修改官方 agent loop。

## 数据库连接池验证

- 所有应用查询从 `lib/db/client.ts` 取 `getDb()`，不就地创建 postgres 池；UTC 沙箱档保留独立时钟，禁止把默认池统一改成 UTC（现有 now() 数据依赖默认数据库时区）。默认/UTC 上限为 5/2，idle_timeout=20，按 URL/时钟进程内缓存；迁移脚本独立单连接不变。
- `pnpm test:db:client` 验证池身份复用、URL/UTC 隔离、额度/空闲回收配置、真实时钟和 getUserById 查询/错误传播；也随 test:runtime:db 收集。全 DB 功能测试以 `--test-concurrency=1` 串行文件，防止多个测试进程自身耗尽连接；这不是容量测试。
- 首次从旧模块池切换后需重启开发服务，旧池不在新注册表中且不会被 HMR 主动关闭。不要终止其他应用数据库连接，不靠增加 max_connections 掩盖连接生命周期问题。官方依据：安装的 postgres README「The Connection Pool」「Connection timeout」；本次无 Pi API 变更。

## 运行启动与清理竞态验证

- `pnpm test:runtime` 中 run-manager 回归覆盖延迟 backend.open、启动期心跳/清理、同 chat 同步预留、另一 chat 独立启动，以及 DB 行创建后返回 runId 前的清理窗口。状态为 queued → starting（已获 lease）→ running → settled；失败不解除终态保护，不重放模型或工具。
- `pnpm test:runtime:db` 中 agent-run-queries 测试限定到自己的 runId 夹具，不全库清理真实会话；覆盖新鲜 lease 保留、无 lease 孤儿、过期心跳、已完成终态，以及用真实 PG 行锁复现清理与正常完成交错。条件 UPDATE 和 lease 删除同事务，只删除真正转 failed 的 lease。
- 未知持 lease 的 run 要等心跳过期后惰性清理，不再仅因本管理器没有 LiveRun 就失败。不是完整 Worker/reaper/fencing 实现。修改 RunManager 后须重启开发服务（globalThis 的 HMR 缓存会保留旧实例），不直接从失败事件反向覆盖终态；历史纠错必须独立核验已落库成功事件和最终消息，不能回放副作用。
- 官方依据：Pi `pi-coding-agent/docs/sdk.md`、`examples/sdk/01-minimal.ts`；本次仅修正平台 RunManager/DB 生命周期，保持 backend → 官方 AgentSession 的事件/agent loop 不变。

## 角色与权限工作台验证

- 视觉以根目录 `DESIGN.md` 为准：主按钮/开关复用中性 primary token，角色与 Tab 选中态保持墨色/浅灰，蓝色仅用于链接与焦点等语义；不复制参考图的蓝色按钮。浏览器回归校验明暗主题主按钮的实际背景/文字与 primary/primary-foreground 一致。

- 应用迁移 `0018_role_policies.sql` 后重启开发服务（生产 RunManager globalThis/HMR 单例不会自动更新注入的授权回调）。本轮已在本地应用迁移。
- `pnpm test:roles`：策略 schema、默认/禁用/多角色合并/不可用模型、额度边界及 RunManager 准入和先持久化后复核测试；随 test:runtime 收集。
- `pnpm test:roles:db`：独立用户/角色/聊天夹具，验证 JSON 保存/恢复、账户禁用、角色共享累计、零/缺失/日期窗口、排除非完成事件及缓存重复累计；只清理本组 IDs。
- `pnpm test:roles:http`：已有本地服务，正式 JWT 独立管理员/成员，验证管理鉴权、非法策略、成员模型目录/no-store、伪造模型 403、已记录额度超限 429、恢复默认；不会调用真实模型。`PIWORK_ROLE_BROWSER_TESTS=1` 追加 Chromium Tab、保存/刷新持久化、无意外成员弹窗、390px 布局，截图 `/tmp/piwork-role-{models,quota,mobile}.png`。可设 ROLE_TEST_URL。
- 原 Playwright `tests/e2e/roles.test.ts` 已改用角色列表按钮和右侧详情选择器，增加模型/额度保存场景；截图脚本 `tests/e2e/roles-screenshot.ts` 使用新布局。不要把 HTTP/浏览器回归当容量或强预算验证。
- Token 基于官方 Usage.totalTokens，仅已记录完成消息；额度为共享角色统计，非每人限额、预留账本或请求硬上限。在途/并发可超支，缺失用量不计入；warn 为服务端日志，不能声称用户通知或自动降级。口径与授权合并规则见 architecture.md「角色工作台」。Pi 依据：安装版 Pi docs/models.md、docs/custom-provider.md、pi-ai/dist/models.d.ts 和 types.d.ts；平台授权仍在可信宿主，复用现有 SDK/RPC/Durable 与 RuntimeEvent。

## 模型供应商配置弹窗验证

- `tests/unit/admin/model-configuration.test.ts` 随 test:runtime 收集：三个插件的公开默认地址与源码常量一致；新配置只初始化非秘密字段默认值；已配置供应商轮换时不注入默认地址、覆盖已有自定义连接配置。
- `pnpm test:models:configuration`：先启动本地 Next 服务（可设 MODEL_CONFIGURATION_TEST_URL），使用独立管理员与 disabled 供应商夹具，验证包目录/公开地址投影及 1440/1280/768/390/320px Chromium 下弹窗比例、长列表滚动、底部按钮始终在视口、必填 API Key 与默认字段、密钥轮换请求。PATCH 在浏览器截获，只断言请求，不调用真实模型或保存真实凭据；不是生产网络/凭据验证或真实移动设备验收。
- 公开 defaultBaseUrl 是插件静态定义，旧安装可回退同包/版本定义；不是后台通过解密取出的当前自定义端点。源码变化后需刷新插件目录缓存（服务重启），不改供应商实际请求地址、权限或 Pi Provider 注册。
- 依据：Pi pi-ai `dist/types.d.ts` 的 BaseModel.baseUrl、项目 model-provider-sdk/插件静态 definition，以及 Radix 官方 Dialog 可访问性契约；仅扩展平台公开展示元数据，保留官方 createProvider/AgentSession 调用链。

## 对话记录验证

- `pnpm test:conversations:http`：真实本地 Next HTTP，独立身份/聊天夹具验证页面、供应商公开名称/providerKey、模型/Token 列表详情一致、筛选和管理员权限；不调用真实模型。`PIWORK_CONVERSATION_BROWSER_TESTS=1` 追加 Playwright Chromium 验证可见文本不含内部 installation ID、供应商 Logo/筛选/详情与加载失败回退。DB usage 测试另覆盖 installation/legacy key 精确映射、禁用与卸载、未知 provider、不泄露凭据、不改变历史模型/筛选 key，以及按供应商名称检索。
- `pnpm test:conversations:db` 另覆盖模型快照、实际 responseModel、跨轮多模型、同 run/chat 审计证据、真实零/未知用量、事件幂等和 Token 累计；完整链路见 [对话模型与用量](conversation-model-usage.md)。
- `pnpm test:conversations`：筛选 schema、分页限额与仅 text 的消息投影；也随 test:runtime 收集。
- `pnpm test:conversations:db`：独立用户/项目/聊天夹具，验证文字搜索（含 `%_` 字面量）、真实最新 run 状态、无 run/无项目、时间筛选、页码钳制、UTC 输出和预览顺序；也随 test:runtime:db 收集。需要可用 PostgreSQL 连接额度。
- 手工打开 `/admin/conversations`，检查后台侧栏与主题、筛选/分页/排序/刷新、桌面并列详情与窄屏上下布局、完整记录只读弹窗、复制 ID、空态/错误态。列表 10/20/50 条，全文消息每页 50 条，预览最近三条。模型按实际完成消息/请求快照/历史审计证据展示并可筛选；详情提供会话累计 Token、输入/输出/缓存明细与记录覆盖，状态是最近 run 而非会话归档状态。
- 页面与两个 API 均复用 requireAdminRole；普通聊天 API 所有权不放宽。完整记录仅保存的文本，不返回 reasoning、工具载荷或附件地址。新增迁移 0017_run_model_snapshot（AgentRun.requestedModel 可空 json），需先 db:migrate，开发服务重启后让 RunManager 新请求快照生效。完成事件追加 model，复用既有 Pi SDK/RPC/Durable 归一化与事件持久化，不将平台聊天投影当原生 Pi session；参考 Pi SDK、Message Types、Session Format。

## 管理端 Token 统计验证

- `pnpm test:tokens`：日期有效性/93 天限额、去重、未知/真实零、等长周期对比、同名部门隔离；随 test:runtime 收集。
- `pnpm test:tokens:db`：独立用户/部门/角色/聊天夹具，验证默认数据库自然日边界、仅完成事件累计、覆盖率、部门筛选、实际模型/请求快照与多角色不重复；仅清理自己的夹具，随 test:runtime:db 收集。无需迁移。
- `pnpm test:tokens:http`：本地 Next 服务，独立管理员/成员/部门/聊天夹具，验证真实用量、页面、no-store、未登录/非管理员拒绝与日期 400；`PIWORK_TOKEN_BROWSER_TESTS=1` 追加 Chromium 桌面查询、明细数值、390px 无页面横溢出与暗色重载检查（截图在 /tmp）。本轮 HTTP/浏览器通过；不代表容量验收。
- 手工打开 `/admin/token-statistics`：检查中英文、明暗主题、日期与组织查询、加载/错误/重试、趋势悬停、部门明细与窄屏内部滚动；页面/API 必须复用 requireAdminRole。
- 统计只读平台持久化 `message.completed`，不新增 Pi API；核对安装版 Pi `pi-ai/dist/types.d.ts` Usage（totalTokens 为准，reasoning 为 output 子集）与 `pi-coding-agent/docs/sdk.md` message_end；统计口径见 architecture.md「管理端 Token 统计」。

## 管理概览验证

- `pnpm test:runtime:db` 覆盖 `tests/unit/db/overview-queries.test.ts`：30 天窗口口径（总量/成功率计数/活跃用户）、30 天按日趋势补零与回溯日期分桶、后端分布、最近 run 关联字段与耗时、最近 Skill、五源动态合并、资源计数与 DB 探测。开发库含真实存量数据，断言一律基于 seed 前快照的差值，并对共享窗口（今日写入者）只做下界断言；Skill/McpServer/SandboxInstance 夹具按生产写入方使用 UTC 墙钟。
- `pnpm test:runtime` 包含 `tests/unit/admin/overview.test.ts`（变化率、插件健康聚合纯函数）。
- 手工：管理员打开 `/admin` 应看到真实数据（服务端预取，右上角刷新按钮走 `GET /api/admin/overview`）；未登录由中间件 307 跳转，普通成员看到「仅管理员可见」占位、API 返回 401。「热门 Skill」面板已改为「最近更新 Skill」（平台未统计使用次数）。
- 时区：概览输出的 ISO 时间戳已按写入时钟在 SQL 内显式转换（见 architecture.md §4）；若新增概览数据源，先确认该表的时间戳写入时钟归属（默认连接 `now()` = 会话墙钟；`new Date()` 或显式 UTC 连接 = UTC 墙钟）。

## Sandbox 资源配置验证

- 首次应用迁移 0021（SandboxSettings）并重启服务加载新的 RunManager 注入；之后管理员保存额度无需重启。`/admin/sandbox-settings` 的 CPU/内存仅影响新建 RPC 沙箱，Provider/镜像/TTL/路由/代理仍在 env；默认/轻量预设不自动保存或启用沙箱。非生产 Durable 独立额度不变，生产门禁不变。
- `pnpm test:sandbox:settings`：范围/步长/严格输入、模拟正式授权边界的 GET/PATCH/no-store/安全错误，RPC 每次 open 的动态读取、额度透传与配置失败先于 mint/acquire；复用既有官方 Pi RPC 全轮契约，无真实模型。
- `pnpm test:sandbox:settings:db`：唯一 PG schema（不含 public fallback）中应用真实 0021 SQL，仅测试 FK 重映射；默认、upsert、更新者、热读、非法保存与脏配置/DB 故障传播。只清理本组 schema，不写日常全局设置。单测随 test:runtime，DB 随 test:runtime:db 收集。
- `pnpm test:sandbox:settings:ui`：隔离 Chromium、真实组件与主题、模拟配置 API，检查轻量预设、保存失败/重试、刷新持久化、数值校验、390px/暗色布局。不使用真实账号/DB/模型/provider，不代表真实容器、容量或生产安全验收。
- 依据 Pi 1.1.0 docs/rpc.md、examples/rpc-client.ts、dist/modes/rpc/rpc-client.d.ts；CPU/内存只传 SandboxSpec，不改 Pi agent loop。生产 RPC reuse=false 保证新容器与额度快照一致；单沙箱限额不提供跨 run 并发保护。

## 沙箱管理 MVP 验证（2026-10-03）

- `pnpm db:migrate` 应用 `0016`（runtimeConfig 创建快照），旧实例不虚构额度或安全配置。
- `pnpm test:runtime` 包含 `tests/unit/admin/sandbox-service.test.ts`：刷新与销毁串行、服务故障不误标 destroyed、续期/销毁成功后落库；OpenSandbox 单测增加生命周期 Manager、传输释放与延期语义。`tests/unit/runtime/run/run-manager.test.ts` 验证 expectedRunId 不误停新 run；`pnpm test:runtime:db` 验证 UTC 到期往返、延长不被自动续期缩短、终态不被迟到刷新复活。
- 先启动 `pnpm dev`，再运行 `pnpm test:sandboxes:http`：需本机 Docker 和 `pi-runtime:dev` 镜像，使用独立管理员/聊天所有者，验证真实容器状态、外部暂停、续期、真实销毁、幂等、管理员鉴权、关联任务只读与跨聊天拒绝。仅创建/清理自己的测试容器及账号；默认自动清理。可设 `SANDBOX_TEST_URL`。脚本是 `tests/e2e/sandboxes-http.mts`，不纳入 Playwright 自动收集。
- `tests/e2e/sandboxes.test.ts` 验证权限、搜索/筛选与详情；测试 Provider 行只作为历史记录，不提供真实生命周期操作，不再用数据库标记伪装容器销毁。
- 手工验收：管理员打开 `/admin/sandboxes` → 发起开启执行工具的聊天 → 列表自动出现实例 → 打开详情 → 通过 Run ID 搜索 → 延长 1 小时并核对到期时间 → “查看任务”以只读查看关联聊天 → 确认销毁，检查 OpenSandbox/Docker 中容器消失。run 默认完成即销毁，因此运行中观察要在任务结束前完成。OpenSandbox 真实链路仍需环境中的 server 地址/密钥及 Inference Proxy；不以 Docker 联调替代 OpenSandbox 真实验收。
- MVP 只负责已登记容器，状态刷新依赖 Provider 控制面；不提供日志、用量曲线、跨实例分布式操作锁或 Docker 到期回收器。Runtime 组装改变后需重启开发服务。

## 个人中心与登录验证

- `pnpm test:profile:db`：真实 PostgreSQL，独立用户/聊天/运行夹具，验证账户与任务隔离、用户名更新、密码 CAS 和查询不泄漏哈希，结束后清理夹具。此测试亦由 `test:runtime:db` 通配收集。
- `pnpm test:profile`：Playwright 验证登录页/注册页、注销后必须登录、访客 provider 关闭、个人菜单普通用户无管理入口、资料修改持久化、错误旧密码拒绝、新密码重新登录和普通用户无法访问管理页/API。
- 手动检查 `/settings/profile` 桌面/移动布局、无任务状态和管理员菜单。个人资料编辑只修改本人用户名，邮箱只读；任务统计口径见 architecture.md。

- 个人头像验证：test:profile 覆盖 PNG 上传、刷新后保留、菜单同步、伪造图片拒绝、其他用户下载拒绝和恢复默认头像；夹具只清理测试账号自己的归档与本地字节。test:profile:db 覆盖头像更新/重置和用户隔离。

个人设置使用独立二级路由 `/settings/profile`（资料）、`/settings/security`（密码）、`/settings/usage`（统计）；共享 settings/layout 与 SettingsSidebar，页面由 SettingsPage 复用正式身份校验和本人查询，链接导航支持直达、刷新与浏览器历史。`/settings` 与旧 `/profile` 重定向个人资料；账户动作归 settings/actions.ts，头像 API 保持 `/api/profile/avatar`。

- 资料组织信息验证：profile DB 测试覆盖部门、实际关联角色名称及未分配空值/用户隔离；profile E2E 检查资料页无统计/最近任务、显示角色/部门，统计页仍有任务指标。

- 热力图验证：profile DB 测试覆盖近一年每日零值、本人/其他用户隔离与区间外记录排除；profile E2E 覆盖记录列表移除、每周/累计切换和移动端无页面溢出。

个人设置三个页面复用管理 Skill 页面内容宽度（居中 max-width 960px）与响应式留白。Token 用量依据 Pi 官方 SDK message_end 和 pi-ai Usage 类型；归一化只保存五个数值字段，经现有 RuntimeEvent 持久化，未新增表。累计仅包含实际保留的用量记录。参考 https://pi.dev/docs/latest/sdk 与 node_modules/@earendil-works/pi-ai/dist/types.d.ts。

## 官方执行需求分类（2026-10-03）

聊天入口在创建工作区前调用 `lib/ai/execution-classifier.ts`，复用 Pi `createModels()`、官方 TypeSafe/OpenRouter provider、`getModelOfType("classifier", ...)` 和 `Models.classify()`。配置 `PIWORK_CLASSIFIER_MODEL=typesafe/jev-latest` + `TYPESAFE_API_KEY`，或 `PIWORK_CLASSIFIER_MODEL=openrouter/typesafe/jev-1.13` + `OPENROUTER_API_KEY`，密钥仅在控制面环境中配置。普通聊天模型不能传给 classifier API。本地分类依据：https://pi.dev/packages/pi-auto-router 与固定 npm 0.3.0 `src/intent-classifier.ts`；该包原用途为模型路由，沙箱权限映射由平台持有，启发式误判不开放宿主执行权限。官方依据：https://pi.dev/docs/latest/models#use-classifier-models；安装源码 `pi-ai/dist/models.d.ts`、`types.d.ts`、`providers/typesafe.js`。

分类发送当前输入（最多 8000 字符）、最近 6 条文本历史（每条最多 1500 字符）和附件数量，不发送附件字节、平台凭据或身份。三个结果为 conversation/platform_tools/workspace_execution；只有合法、成功且置信度至少 0.9 的前两类关闭工作区。未配置模型时使用 pi-auto-router 0.3.0 的纯函数 `classifyIntent()`（不加载它的扩展或模型路由）；补充中文执行、文件生成、附件和最近两条执行上下文规则。问候及文本创作等轻量请求关闭工作区，执行信号、code 类和附件保守开启工作区。配置模型后优先调用官方 API，非法模型、错误、2 秒超时、未知结果或低置信度均保守开启工作区；请求取消原样传播。配置分类器即会将上述文本发送到指定供应商。分类费用暂未计入 RuntimeEvent message.completed 的聊天 Token 聚合，不宣称统计含分类调用。

`workspaceDir=null` 的 InProcess 会话禁用内建执行工具、受管扩展与 MCP 自动加载，并以平台 customTools 名称设置工具白名单；仅保留模型桥与平台显式注入工具。需要扩展/MCP/Skill 脚本、文件生成或工作区操作的请求分类到执行。不会在同一 run 中自动升级或迁移会话；误判时执行能力不可用，可在下一次明确请求执行。SandboxRpc 的 Package/MCP 与闭包工具边界仍存在，不因分类器接入变为已支持。显式 `PIWORK_SANDBOX_ROUTING=all` 仍全量沙箱；分类不改变未装配 sandbox provider 时的旧 InProcess 执行行为。定时任务路径暂不调用分类器。

验证：`node --conditions=react-server --import tsx --test tests/unit/ai/execution-classifier.test.ts`（正常结果、低置信度/非法结果、供应商异常、上下文裁剪与请求取消），随 `test:unit` 通配收集；路由与后端契约测试随 `test:runtime`。真实效果需配置独立 classifier 凭据并重启服务，检查“你好”的 AgentRun.backend 为 in_process、执行请求为 sandbox_rpc；无模型配置时本地启发式已生效；配置模型但凭据缺失/异常仍保守执行。

本地文件操作回归（2026-10-10）：用户原句“请获取当前服务器时间 写入time.txt”此前误判 lightweight；file-operation-intent 纯函数补足中文落盘与命名 txt/md/json/yaml 等文件操作，并复用于 search/intent，当前/最近两条历史中的文件操作都不能被纯搜索提前放行。原句 classifyExecution（未配置模型）、中英文保存/读取、纯文本创作/文件名解释不执行、联网开启与连续请求均有回归；配置模型优先级、授权及单 run 分流不变。Runtime344通过/15跳过；unit61通过；类型/Biome检查通过。`PIWORK_OPENSANDBOX_TIME_TEST=1 PIWORK_OPENSANDBOX_CHAT_TEST=1 pnpm test:opensandbox:chat` 使用独立夹具发送用户原句，要求 sandbox_rpc/真实bash date与time.txt目标/销毁；原句未显式要求交付，不能要求模型必然返回下载。只在实际有artifact.created时校验归档/本人下载；仅本地存储，成功清理本组 LibraryItem/验证过的文件ID字节，失败禁用夹具保留证据，不重放用户旧run。真实原句在服务器验证通过（run7189ac8c-1b2a-46b8-a752-92771f7be719，sandbox_rpc/settled，沙箱销毁确认；成功夹具已清理）。文件位于临时沙箱，未交付则终态删除，沙箱时区默认为UTC。

本地启发式验证（历史基线）：分类器与启发式 7 项测试、路由 5 项测试通过；真实 `/api/chat` 输入「你好」返回成功，AgentRun.backend=`in_process`、status=`settled`、errorMessage=null。pi-auto-router 发布的是 TS 源码，Next.js 通过 `transpilePackages` 编译其纯函数模块；未加载第三方扩展。规则有误判可能，附件与执行上下文保守进入执行路径。
