# Durable + Sandbox 受控组合适配器

> 状态：**非生产、fresh-run 验证实现，已接自动聊天分流（开发环境所有正式启用成员无需勾选）**。真实 OpenSandbox 组合契约与真实模型 `/api/chat` HTTP 验证已通过。未启用时默认矩阵不变；没有独立 Worker、自动恢复或生产耐久承诺。生产显式拒绝，不能删除 `run/index.ts` 的全局 Durable/provider 互斥门禁。

## 已实现的链路

```text
/api/chat（正式身份 + 执行分类/兼容能力保护 → 服务端内部 lane）
  → RunManager → ExplicitDurableRuntimeBackend → DurableChatBackend
  → DurableSandboxBackend
  → 官方 Pi Durable Harness（可信 Node 宿主 / 每 run 私有 SQLite）
  → 官方 ToolTask（先提交 intent，replay=unsafe）
  → createSandboxTools → LazySandbox → SandboxHandle
  → OpenSandbox 或 Docker 的命令与限额/原子文件能力

Harness watchEvents → DurableEventNormalizer → RuntimeEvent
```

只有一个 agent loop。**不在 SandboxRpc 外再包 Durable**，沙箱不运行第二个 Pi 会话；模型 Provider 留在可信宿主，真实模型凭据、宿主 env 与 SQLite 均不传入沙箱。这条路径不需要沙箱内 Pi CLI / Inference Proxy；现有 RPC 路径仍需要它们。

代码：

- `lib/runtime/backends/durable/sandbox-backend.ts`：组合、分配校验、授权、私有执行映射、资源生命周期。
- `lib/runtime/backends/durable/backend.ts`：官方 Harness/registry/watchEvents；新增受管 executionFactory seam，仅在 owned storage + authorize + runId 同时存在时允许持久 workspace 执行。
- `lib/runtime/backends/sandbox-tools/tools.ts`：复用四工具与私有交付回调；不回退宿主默认工具或旧无界文件 API。
- `lib/runtime/sandbox/opensandbox/pty-channel.ts`：新增单消费者 readCombined，按帧到达顺序合并 stdout/stderr，RPC read 仍只输出 stdout。
- `lib/runtime/sandbox/opensandbox/provider.ts`：kill 成功后重复释放不再调用已关闭 SDK 客户端。
- `lib/runtime/sandbox/leasing.ts`：release 解包为原 provider handle，避免严格 OpenSandbox/Docker provider 拒绝 lease wrapper；只接受本层创建的 wrapper，记账一次。
- `lib/runtime/run/durable-chat.ts` / `lib/db/durable-chat-queries.ts`：正式会员/归属/运行状态授权与私有文件、文档库归档装配；查询仍留 DB 层。
- `backends/durable/chat-{policy,input,attachments,backend}.ts`：开发准入/test 白名单、不可变输入/hash、授权附件引用与有界水合、私有交付。

## 装配边界

这是可信服务端调用的 `RuntimeBackend`，不是普通用户可以提交参数的入口。必须注入：

| 参数 | 要求 |
| --- | --- |
| provider | 正式 provider；如包装 LeasingSandboxProvider，必须 `reuse=false`，不能借用另一个 run 的实例 |
| storageFactory | 复用 `openOwnedDurableStorage`，可信私有持久根、平台授权 user/chat/run/inputHash 绑定；不能在沙箱临时盘上存 SQLite |
| authorize | open、每次 execute 与 acquire 时复核当前运行权限 |
| authorizeTool | 每次工具调用、provision 前复核 callId/toolName；不是模型提供身份 |
| sandboxSpec | run/chat/source 必须与 RuntimeSpec 一致，egress 仅 deny-all |
| experimentalOpenSandbox | OpenSandbox 探针必须显式 true，仍受 NODE_ENV=production 拒绝保护 |
| hydrateSandbox（可选） | 取得 handle/提交执行映射后、首次模型工具命令前，用 filesystem 原子写入正式授权的附件；取消必须中断水合并回收 |
| publishArtifact（可选） | 必须平台绑定 user/run/tool-call 的私有存储并正式归档后返回受保护 URL；未配置则没有 deliver_file |

`RuntimeSpec.runId` 和 workspaceDir 必须存在；spec.tools 非空明确拒绝，不静默丢弃 Skill/MCP/平台闭包工具。历史消息可以作为新 run 的初始上下文，但不是可恢复输入快照。每会话仅一个 prompt；第二次 prompt、steer、followUp 明确拒绝，避免先回收沙箱再偷偷继续执行。

普通聊天仍使用现有 routing/SandboxRpc/InProcess。本地仅需启用车道与私有目录；全局 `PIWORK_RUNTIME_BACKEND=durable` 与 `PIWORK_SANDBOX_PROVIDER` 仍互斥。启用后由服务端自动选择非生产 Durable 路径，不是切全局后端或绕过生产门禁。

## 自动聊天分流

### 启用条件

保留现有 provider 配置（docker 或 opensandbox、镜像、CLI 路径，OpenSandbox 的 domain/API key），**不要设置 `PIWORK_RUNTIME_BACKEND=durable`**。在开发环境配置并重启应用：

```bash
PIWORK_DURABLE_CHAT_ENABLED=1
PIWORK_DURABLE_STORAGE_DIR=/absolute/private/piwork-durable
UPLOAD_DIR=/absolute/path/to/existing/uploads
```

- 必须 `NODE_ENV=development|test`；production 或未确定运行环境拒绝。development 中所有正式启用成员可自动分流，无需配置 `PIWORK_DURABLE_CHAT_USER_IDS`，已有名单也不限制开发成员；test 仍必须配置非空 UUID 名单（逗号分隔），不接受 wildcard/邮箱。用户身份始终取正式会话，访客/禁用/无成员账号拒绝，不能用客户端 userId 授权。
- 两个目录必须是可信、持久、非公开、沙箱不可见的绝对路径，彼此及宿主 `.pi/workspace` 不得重叠；目录/祖先由部署方保护。UPLOAD_DIR 要指向既有本地上传根，改变它不会自动迁移旧文件。
- `PIWORK_DISABLE_EXECUTION_TOOLS` 非空时拒绝启用；配错 fail-closed。此车道固定 deny-all、1 CPU/512 MB、600s TTL、每 run 私有临时工作区和 `reuse:false`。不是整个任务的硬时限或重启后的 reaper。
- UI 不显示后端勾选框，也不发送 runtimeLane。schema 剥离客户端 lane/grant，`/api/chat/runtime-options` 仅保留本人能力查询，不构成授权。新用户消息不因旧历史审批状态误入续跑；真正审批续跑保留既有链路，活跃运行不迁移。
- route 在解析附件/创建宿主工作区前复用 `classifyExecution`（官方 classifier 或本地 pi-auto-router），由 `routing/chat-routing.ts` 选定一次：纯问答/文本任务留轻量路径，适配四工具的执行任务进入 Durable；Skill 命令、平台能力关键词/已登记技能或 MCP/extension Package 名称、近期非四工具调用、审批与分类不确定保守留既有链路。兼容保护是启发式，可能过度保守或漏判，不是权限保证；不会扩张现有 SandboxRpc 的闭包/MCP/Package 能力。
- 选定 Durable 后仍正式授权，授权/附件/创建/工具失败不回落宿主、不自动重放。Durable 只支持四工具 + 私有交付，不装配 Skill/Package/MCP/定时任务闭包；适配器继续拒绝非空 spec.tools。每个 Durable 消息是**新 run/新工作区**，只复用文本历史；旧中间文件需重新附加归档文件。

### 授权、输入与附件

服务端从会话取 userId，并复核 `User.isAnonymous=false`、`Member.status=enabled`、Chat/AgentRun 本人归属、实际 `backend=durable_sandbox` 和 queued/starting/running 状态。open、prompt、provision、每次 execute/交付均复核；工具仅允许 read/write/edit/bash/deliver_file，模型必须仍在启用目录（现有目录缓存最多 30 秒）。这不是分布式 lease/workspace fencing 或生产细粒度操作账本。

`RuntimeSpec.durableChat` 是服务端内部的 reference-only grant：userId、目录模型 ID、promptHash 和最多五个 LibraryItem ID/path/hash/size。请求 schema 不接收这个对象，附件字节/工具闭包不放入 grant，也没有宣称 RuntimeSpec 已是跨进程 DTO。官方 SQLite binding 的 inputHash 覆盖模型、系统/追加提示、聊天历史、最终 prompt（含已授权图像）、附件引用及固定工具/镜像/资源/策略版本；发送时再次比对最终 prompt，不能开会话后换输入。

附件只查本人 LibraryItem，采用数据库文件名/MIME，不信任客户端路径；限每个 20 MB、总计 50 MB，图像累计 8 MB。宿主不解析 PDF/Office、不解码/缩放图片；文本/Office 原始字节仅通过 SandboxHandle.filesystem 水合到 `inputs/<序号>-<安全文件名>`，提示只列相对路径/hash/size。模型图像输入用已授权且限额的 MIME/base64。首次模型工具执行前重新查归属、读取并核对 hash/size，再原子写入临时沙箱；缺文件、变更、取消或原子文件能力缺失均失败并回收，不能降级为宿主执行/忽略附件。下载本地文件限额并拒绝 symlink/hardlink/特殊文件；已登记旧 Blob 可有界读取，仅可信 HTTPS Blob 域、不跟随重定向，未迁移旧公开文件。

### 私有交付与记录

`deliver_file` 只写平台私有 store（user/chat/run/tool-call key，校验内容 hash），再登记本人 `LibraryItem(source=ai)`，完成后才发 `artifact.created`；不调用旧 public Blob store。归档失败不发制品事件，不伪装成功。下载仍经现有 `/api/files/:id` 正式鉴权/文档归属检查；未归档孤儿文件不可下载，取消/撤权/崩溃也可能在归档成功与事件提交之间留已归档但无制品事件的记录，生产 orphan/幂等对账仍待补齐。

RunManager 使用同一判定落 `AgentRun.backend=durable_sandbox`，管理看板不再误标为 InProcess。数据库 backend 是 varchar，本次仅扩 TS 值域，无新增 SQL enum/表/迁移。聊天流仍从 RuntimeEvent 经既有 stream-mapping 传输，终态消息/文件引用走原消息落库。

显式 Stop 要等待沙箱 kill/状态核验；`aborted:true` 仅是命令受理。正在执行的 shell 若结果未知，终态可能是 failed（outcome unknown）而不是 aborted，不能改写成干净成功/取消。请求断开仍只是 detach，当前 Node 内继续运行；重启不会自动续跑，正式 Worker/reaper/恢复投影均未完成。

## 持久状态与恢复限制

官方工具 intent/结果继续存在 Pi Storage。另用官方 `defineDoc` 与 conversation.commit 保存 `piwork.sandbox-execution`：runId/provider/sandboxId/stopped，首次命令前提交 sandboxId；该映射不放入模型可写文件。

这不是平台 ToolInvocation 账本，也不是分布式 fencing。SDK acquire 返回与映射 commit 之间仍可能进程崩溃产生孤儿，未来 Worker/reaper 必须按 provider metadata 对账。

- 保留 SQLite O_EXCL owner marker，不按 PID/TTL 偷锁。
- 恢复检查早于 submit/wait/resume；未知 intent/未知结果继续拒绝。
- **组合适配器拒绝重开已经登记的执行会话**，包括已完成 run；不会隐式创建替代沙箱后重跑。
- OpenSandbox 当前 workspace 是临时盘。持久 SQLite 不等于持久 workspace，也不等于能续跑原 shell。
- 终态事件前先 kill 并验证资源停止；清理失败发 failed，close 保留失败与存储 owner marker，不伪装 settled 或解除归属。
- 通用工具全部 unsafe。超时/取消/断连/未知结果 kill-only，无自动 replay。

生产仍需 P2/P3/D1：持久平台账本与生产授权治理、独立 Worker/job claim/取消/恢复所有权、workspace 持久性、孤儿回收、snapshot/源事件游标与消息/用量/制品幂等投影、备份恢复。现有 OpenSandbox launcher 仍在 workspace，控制路径保护和网络硬拒绝验收未完成；真实组合 smoke 不取消这些安全门禁。没有做容量、持续负载或突发并发测试。

## 验证

```bash
corepack pnpm test:runtime:durable-chat     # 开发准入/test 白名单/绑定/水合/私有交付/失败，不需 DB
corepack pnpm test:runtime:durable-chat:db  # 正式 DB 授权与文件归属
corepack pnpm test:runtime:durable-sandbox
corepack pnpm test:runtime:durable
corepack pnpm test:runtime
corepack pnpm exec tsc --noEmit
```

默认无需真实 server，真实组跳过。显式真实 OpenSandbox 验证（独立随机 run，清理只触及本组实例；host faux 模型不需要真实模型调用）：

```bash
PIWORK_DURABLE_OPENSANDBOX_TESTS=1 \
node --env-file=.env.local --conditions=react-server --import tsx --test \
  tests/unit/runtime/backends/durable/opensandbox-composition.test.ts
```

需要 OPENSANDBOX_DOMAIN/API_KEY、可用 server 与含 Node/Linux /proc/self/fd 的镜像（默认 pi-runtime:dev，OPENSANDBOX_IMAGE 可覆盖）。这是功能契约，不是生产聊天或恢复验收。

自动化覆盖：四工具/SQLite 转录与执行映射、纯文本零容器、撤权/创建失败无宿主回退、超时不重放、归档先于 artifact.created、清理失败保留 owner、重复/未接线恢复拒绝、平台工具/生产/OpenSandbox 默认拒绝；PTY stdout/stderr 合并与 RPC 隔离。

上一阶段基线：Runtime 299 项（291 通过、8 跳过），真实 OpenSandbox 组合 2/2。本阶段 Runtime 318 项（310 通过、8 gated 跳过、0 失败）、普通 unit 48/48、DB 38/38；真实模型/OpenSandbox HTTP 脚本全链路通过；tsc、修改实现/测试的定向 Biome（不扩修 schema/provider 原有格式基线）与 diff --check 通过。补正式 DB 授权、显式聊天、水合、私有交付与 HTTP 验证，不做容量/持续负载/突发并发。既有 opensandbox-provider.test.ts 管理控制测试的 lint 基线问题未扩展修复。

自动分流增量验证：Runtime 322 项（314 通过、8 gated 跳过、0 失败），普通 unit 48/48、Durable DB 3/3，tsc/定向 Biome/diff --check 通过。真实 HTTP 不传客户端 lane，文件任务自动进入 durable_sandbox，问候仍为 in_process；附件水合/SQLite binding/私有归档下载/跨用户隔离/停止/超时/实例删除通过。兼容保护目前是保守启发式，不承诺任意平台意图的完美识别；平台集成真实执行与浏览器 UI 未在本组验收。本轮发现既有 token 篡改测试末位固定改成 0 有 1/16 概率未实际修改，改为确保末位不同；未修改 token 实现。早期 HTTP 权限断言由 400 修正为正式 403，其隔离 fixture 经确认零 run/零 sandbox 后仅清理本组 schema/目录。

### 真实聊天 HTTP 验证（显式 opt-in）

```bash
PIWORK_DURABLE_CHAT_HTTP_TESTS=1 \
node --env-file=.env.local --conditions=react-server --import tsx \
  tests/e2e/durable-chat-http.mts
```

**会调用真实已配置模型与真实 provider**，默认不运行。需要非生产 DB 有 CREATE SCHEMA 权限，以及上述 provider/CLI 与正式模型插件配置。可用 PIWORK_DURABLE_CHAT_HTTP_MODEL 选模型、PIWORK_DURABLE_CHAT_HTTP_PORT 换端口（默认 3011）。测试创建唯一隔离 PG schema（无 public search_path fallback，迁移 FK 仅在 fixture 内重映射），只复制加密模型配置，不复制真实用户/聊天/任务，并将测试服未显式配置的 DB 默认 pool 限为 2（仅该 fixture URL），避免第二个 dev server 的单宿主 orphan sweep 触碰日常 runs。Pi transcript 仍在该测试运行私有 SQLite，未改为 PG。

测试独立构建目录/tsconfig（NEXT_DIST_DIR/NEXT_TSCONFIG_PATH），测试服务器关闭 Inference Proxy、使用默认 matrix；真实 OpenSandbox、真实模型验收已通过（不发送客户端 lane，自动路由）：`/api/chat` 工具流/制品、AgentRun backend/status、私有归档/下载与跨用户隔离、附件哈希/水合、SQLite binding、Stop、超时失败、通过独立 provider control.inspect 确认删除、普通「你好」仍为 in_process。此脚本不是浏览器 UI、恢复或网络硬隔离验收。

成功后停止测试服务器并删除仅该 schema/私有目录；失败保留 schema/owner/文件证据，先核对正式 provider 实例并逐个销毁后再清理，不能按 PID/TTL 偷锁或自动重放。早期真实 HTTP 验证发现 lease wrapper 被严格 provider.release 拒绝，已修复并加回归；该轮残留实例均经独立控制面确认删除后手工清理，不宣称已有自动 reaper。

## 官方依据（安装版本 1.0.2 优先）

- `node_modules/@earendil-works/pi-durable/README.md`：Extensions、Tools、Environment、Persist and Resume、Your Own State、Agent Events、Storage。
- `pi-durable/dist/harness/tool.js`：intent 在 execute 前 commit，stored/current replay 都 safe 才重跑，恢复不执行 beforeTool；复用该机制而不另写调度器。
- `pi-durable/dist/harness/tool.js` 的 api.output 与 chord overlap：AgentTool onUpdate 接入官方有界进度提交。
- 官方仓库 `packages/durable/test/examples/29-sandbox-per-conversation.ts`、`30-tool-override.ts`：可信宿主持有沙箱映射、按运行选择工具；这里复用现有 SandboxHandle 工具而不启用 NodeExecutionEnv。
- Pi coding-agent 官方 docs/sdk.md、docs/extensions.md 与安装版四工具 schema/operations/truncation：工具逻辑继续由现有工厂复用，edit 按 1.0.2 的 edits[] 参数验证。
