# Pi Durable 评估与采用门禁

> 状态：**评估与试点计划，不是生产恢复能力承诺**。当前 `DurableBackend` 已补持久存储与恢复安全基础，但仍未完成 Worker/平台映射/恢复投影接线；默认生产路径不改变，不能宣称已生产上线。
> 本轮已核对 npm 最新发布并安装：pi-ai / pi-agent-core / pi-coding-agent / pi-durable / chord 均为 **1.0.2**。Durable 仍 Experimental。已适配新版 Registry/Extension/Agent configuration API 并移除旧选项兼容转型；存储继续官方 SQLite。
> 完整执行顺序、企业 MVP 门禁与代码落点见 [企业 MVP 与沙箱执行面实施方案](sandbox-execution-surface-design.md)。本文替代旧版中“定时任务恰好一次”“版本化承诺部分成立”“全面迁移后退役 RunManager”等结论。

## 1. 决策摘要

1. **保留 Pi AgentSession 为办公 MVP 主 harness**，不全面替换聊天链路。
2. **先稳定工具执行和平台运行账本，再把执行宿主移到单独 Worker，最后试点 Durable**。Worker 解耦 Web 与执行生命周期；Durable 提供内部 checkpoint 恢复，二者互补。
3. Durable 仅从**文件处理、少外部副作用、不依赖 MCP 的定时任务**试点；不按模型预估时长自动迁移运行中的会话。
4. 固定经测试的版本，以恢复测试和升级门禁管理 experimental 风险；`1.0.x`、依赖对齐、连续 patch 无 breaking 标注均不等于 API 稳定承诺。
5. **同 requestId 提交去重不等于业务恰好一次执行**。工具副作用幂等、权限复核、产物归档与平台结果投影必须独立实现。

## 2. 能力与明确边界

| 能力 | 已安装 1.0.2 的官方行为（0.99.2→1.0.2 逐项核对语义未变） | 平台需要补齐的部分 |
| --- | --- | --- |
| Harness / Conversation / Task | 存储先提交后可见；转录、文档、任务 checkpoint 持久化 | 平台 AgentRun、用户归属、准入、取消与管理仍由 piwork 持有 |
| resume | 重开存储、重新装配 registry 后恢复未完任务；模型请求可能重新发起 | 启动对账、运行所有权、权限复核、沙箱命令孤儿处理 |
| requestId | 同 conversation 同 requestId 找回同 submission | 不保证模型计费、shell、邮件、外部 API 或文件交付只发生一次 |
| tool replay | intent 中策略与当前注册策略均为 safe 才重跑；默认 unsafe；恢复重放不执行 beforeTool | 授权与幂等检查必须在 execute 入口再次执行，不仅放在 hook |
| unsafe 工具中断 | 模型收到 interrupted 错误结果，工具 task failed | generation 使用 allSettled，仍可能继续回答；不能直接把 AgentRun 判 failed |
| watchEvents | 首次快照 + commit 增量，消费积压超过阈值会以新 snapshot 替换 | snapshot 是替换视图，不是历史 delta 重放；现适配器须补恢复映射 |
| SQLite | WAL + synchronous=NORMAL；进程崩溃安全，主机故障可能丢最新提交 | 持久盘、备份与恢复演练、RPO/RTO；不把同机文件等同于高可用 |
| 单写者 | 一个 storage 同时只归一个进程，无跨进程锁 | 启动互斥、明确 owner；有多实例需求时需仲裁和 fencing，不仅改 Storage |
| MCP / Skill | 本次核对未发现与 coding-agent 内置 MCP 等价的完整装配；Skill 可用 registry sections/tools 承载 | 不假定原有 MCP/Skill/Package 直接兼容；试点限制任务能力集合 |

**恢复不等于撤销：**进程崩溃时，外部命令可能仍在运行，已经发送的邮件无法由 checkpoint 自动回滚；模型请求重新发起也可能增加费用。

## 3. 当前原型与历史 spike

2026-10-01 的历史 spike 记录：MemoryStorage 一问一答、SQLite close-重开、requestId 去重、watchEvents 事件与公告/发布包 API 漂移均曾验证。临时脚本未入库，**不能替代可重复的发布门禁**。

当前 `lib/runtime/backends/durable/`：

- 默认开发原型仍用 MemoryStorage；生产明确拒绝该默认值。可注入官方 SQLite 单写者存储与当前授权回调，尚未装配生产入口。
- AgentTool 转 durable 工具，模型 Provider 与提示装配有桥接；历史回灌有损。
- 存储/身份与输入 hash 绑定、进程强杀后的官方恢复、未知 intent 阻断已进入重复测试；平台工具桥、完整跨重启映射、snapshot 重建仍未完成生产验收。
- ~~主包 1.0.0 与 durable 嵌套 pi-ai 0.99.2 共存；一处显式类型转型不构成跨版本兼容保证。~~ **已解决（2026-10-04）**：五包全部对齐 1.0.2，双版本嵌套消除；`toDurableTool` 的 3 处 `as never` 转型移除后 `tsc --noEmit` 全绿，无需任何适配层。验证：Durable 契约套件 35/35、手动 spike 16/16（`scripts/pi-durable-manual-spike.mts`，含 SIGKILL 恢复与 replay 双重门）、全量 Runtime 套件 284 项 0 失败。
- 实验开关不应开放给普通生产用户，不能宣称“已有 DurableBackend 即已有耐久执行”。

升级时须核对**全部相关包与锁文件实际解析版本**，包括 chord 与使用它的 NodeExecutionEnv。只把 durable 升到依赖 `pi-ai ^1.0.2` 的版本，不能保证仍固定 1.0.0 的主包与嵌套版本自动合一。

### 受控组合增量（非生产，不是 D1）

新增 `DurableSandboxBackend`：复用官方 Harness/owned SQLite + 现有沙箱四工具，映射存官方 document，终态前停止资源；真实 OpenSandbox 四工具/合并输出与超时不重放两项契约通过。fresh-run、单 prompt、deny-all、生产拒绝；已登记会话重开 needs-review。默认聊天与全局环境开关互斥不变；另已接非生产、正式启用成员的自动聊天分流（development 全部启用成员无需勾选，test 保留 UUID 白名单；问答轻量、四工具任务 Durable、平台兼容与分类不确定留原链路），补服务端 DB 授权、输入/hash 绑定、附件限额/水合与私有 LibraryItem 归档，真实 OpenSandbox/模型 HTTP 流、下载隔离、停止/超时/实例删除与普通问答验证通过。仍未落地 Worker/生产平台操作账本/workspace 持久性/恢复投影，不是 D1 或正式生产入口。详见 [组合实现与验证](durable-sandbox-composition.md)。

## 4. 为什么现阶段不全面替换

- 官方 README 明示 Experimental；API 漂移已有历史证据。
- 办公能力装配优先于 harness 迁移：MCP、Skill、文件归档、模型插件和权限需逐项验证。
- 当前 Message_v2 / RuntimeEvent 是产品投影，Durable 转录是内部恢复状态；两者不能无条件互换。
- 当前失败标记、租约和用户重发能力**不是 loop checkpoint 恢复**，但也不应仅为恢复而同步重做整条产品链路。

启动试点的条件：产品明确要求跨进程恢复、基础执行安全已达标、独立执行宿主可用、有稳定维护责任人与故障演练预算。官方稳定承诺可以降低风险，但不是试点的唯一前提；没有承诺时禁止默认全面切流。

## 5. 工具 replay 门禁

| 工具类别 | 初始策略 | 转为 safe 的必要证据 |
| --- | --- | --- |
| read | 可试点 safe | 每次 execute 复核归属与授权；接受恢复时读取新内容；审计副作用可去重 |
| write | unsafe | 操作 ID、目标版本/hash 前置条件、原子替换、重复调用找回同结果，不能覆盖后续改写 |
| edit | unsafe | 不能只依赖 oldText；例如 A→AA 重放可再次匹配。须有版本/hash 和操作结果日志 |
| bash | **unsafe，默认禁止自动重放** | 任意 shell 无通用幂等证明；特定已批准作业应封装成独立工具而非放开通用 bash |
| deliver_file | unsafe | 稳定 operationId/object key，存储、归档、事件投影重复执行均不重复交付 |
| create_scheduled_task | unsafe，待验证 | 确定 ID 去重跨重启成立；恢复后身份、当前权限与调度参数再次复核 |
| 邮件/OA/日程等 | unsafe，默认不进首轮试点 | 外部系统支持幂等键或查询对账；确认凭证绑定操作参数，结果未知时禁止自动重复发送 |

当前 `storeFile` 使用本地随机后缀或 Blob `addRandomSuffix`，所以“按 userId,url upsert”不能证明 deliver_file 幂等。

## 6. 分阶段执行

### D0：固定版本与可重复恢复验证（可与基础工具开发并行）

- 核对拟采用版本的 README、类型、tool/generation/scheduler/storage/events 源码；不猜 API。
- 把历史 spike 固化到 `tests/unit/runtime/backends/durable/`，升级后跑完整 Backend 契约。
- 使用独立子进程 kill/restart，不只 close；覆盖模型请求中断、工具 intent 前后、safe/unsafe、快照替换、requestId 去重。
- 更新本文件中的版本证据，确认双版本与显式转型处理方式。

**产出：**版本固定清单、恢复语义报告、可重复测试。D0 通过不等于允许生产切流。

### 本批 D0 增量（已实现，仍非 D1 上线）

- `lib/runtime/backends/durable/storage.ts` 复用官方 `openNodeSqliteDatabase` + `SqliteStorage.open`，WAL 上显式设 synchronous=FULL；私有目录/文件、O_EXCL owner marker、user/chat/run/inputHash 与固定版本绑定。并不以 FULL 推断主机故障 RPO：仍需真实盘/备份/故障验证。
- 单写者 marker 不按 TTL/PID 自动偷取；异常退出留下锁，必须由未来 Worker/reaper 在确认旧进程/外部动作停止及权限仍有效后对账。当前没有生产自动解除锁 API；不是分布式 fencing，也不代表工作区独占。
- `recovery.ts` 在官方调度开始前检查 execute intent 及已物化 interrupted/tool_error/aborted 结果，拒绝为 needs-review 错误；不注册 safe 重放。注意 submit/wait 同样启动调度，不能仅把保护放在 resume 前。
- 持久 adapter 必须注入当前授权，open 与每次 execute 都复核；授权/工具失败触发异步 abort，终态强制 failed，不能被模型正常回答掩盖。执行工具的 AbortSignal 透传；close 单飞、等官方 Harness 关闭才释放存储归属，清理错误不吞掉。
- 持久 adapter 当前拒绝 workspace 执行，因为沙箱与账本未接好；默认 prototype 的 `PIWORK_RUNTIME_BACKEND=durable` 仍不可与 sandbox 同开。没有静默丢工具、默认切流、修改 `.env.local` 或升级依赖。
- `tests/unit/runtime/backends/durable/` 新增 **14 项**：官方 SQLite 转录/requestId、第二写者/绑定漂移/符号链接、真实子进程 SIGKILL 的模型请求恢复与 unsafe intent 不重放、已物化未知结果、授权撤销不可伪成功、生产 MemoryStorage 拒绝。`tests/support/durable/crash-child.ts` 仅测试；解除死进程锁只在测试取得 exit 证据后做。
- 本批验证：全 Runtime **284 项，278 通过、6 既有跳过、0 失败**；TypeScript/定向 Biome 通过。未做容量、持续或突发测试；D0 的存储不可用/磁盘满/备份还原/全部 phase/snapshot 矩阵尚未全部验收。

**剩余生产必需：**单 Worker 与持久 job/取消/所有权、run/conversation/submission/version 映射和输入快照、正式权限/删除恢复对账、源事件游标/快照替换与消息/Token/产物幂等投影、沙箱命令及平台副作用 ledger、部署卷/备份/回滚演练。仅 SQLite 接入不等于这一生产闭环完成。

### D1：独立 Worker 内受控定时任务试点

前置：实施方案 P0–P3 通过；平台运行与沙箱所有权、产物幂等、取消与存储备份已落实。

- Worker 持有 Harness；SQLite 单写者、可靠持久盘；禁止第二进程同时 open。
- 平台保存 runId / conversationId / submissionId 映射、harness 与工具版本。
- claim 后、resume 前、每次工具执行复核当前权限；模型凭据只由运行宿主装配。
- 完成时以幂等投影更新 AgentRun、ScheduledTaskRun、消息和产物。
- 故障恢复时先对账旧命令，再 resume；工具 task failed 不直接等同于整 run failed。

**产出：**管理员白名单可用的文件任务车道。试点不注册创建定时任务工具，避免递归调度。

### D2：人工显式选择的后台任务

D1 稳定后提供“后台处理”入口，共享平台运行账本和事件协议。新任务选定 lane，启动后固定，禁止中途迁移 harness。交互聊天仍走 AgentSession；MCP 不满足试点范围的请求拒绝或明确选择兼容车道，不能隐式丢工具。

### D3：按需求扩展存储与多 Worker

默认采用控制面 PostgreSQL + Runtime 私有 SQLite + 私有文件/对象存储三层分工，而非统一所有数据进 PostgreSQL。官方 Harness 继续负责执行与恢复语义，不重写 scheduler/checkpoint/task ownership。按用户决定，本轮 Postgres Storage 代码、专项测试与 0017/0018 迁移全部撤回；本地新建的两张空表及两条迁移记录已事务删除，平台原业务表未变。只有未来明确出现无法由 SQLite/部署模型满足的需求时才重新评估自定义 Storage，不因“企业版”预先替换。Cloudflare DO 的单写者/Alarm/PITR 是运行模型能力，并非 Pi 或本项目 Node 部署自动拥有；持久卷、Writer 归属、唤醒、备份与副作用对账仍须验收。不做容量测试或千人容量承诺。

**不设必然的“全面迁移/退役 RunManager”阶段。** 后续只替换经验证可由 Durable 接管的内部执行状态；平台运行管理职责继续保留。

## 7. 上线、回滚与恢复验收

- 同 requestId 重提找回同 submission；unsafe 工具不自动重放；有副作用且结果未知时进入平台 needs_review，而非自动再执行。
- snapshot 重建不能漏文本、工具状态、产物或重复计算 Token；投影游标和序号跨重启保持一致。
- 用户停用、任务取消、工具撤权后不得通过恢复绕过权限。
- 真正 kill/restart、主机重启、磁盘满、存储不可用、备份恢复全部有实测结果。
- 灰度开关只影响**新任务**；存量任务绑定原 lane/版本。回滚停止新 Durable 准入，保留原 Worker 处理或挂起旧任务，不以 InProcess 自动接管未完成副作用。
- SQLite 的 RPO/RTO 由实测和业务确认，不沿用“100ms partial 持久化”推断主机故障的数据损失上限。

## 8. 官方与代码依据

本次实际核对：

- 安装的 `@earendil-works/pi-durable@1.0.2/README.md`：Experimental、resume、requestId、watch、Storage 单写者与 SQLite 持久性。
- `dist/harness/tool.js`：safe×safe、默认 unsafe、恢复不走 beforeTool、interrupted 结果。
- `dist/harness/generation.js`：工具 allSettled 与后续 generation，submission 终态不能从单个工具失败推断。
- D0 初批依据 0.99.2 README 与 docs/pico-v5.md、pico-v5-handoff.md、pico-v5-chord-usage.md；本轮升级核对 1.0.2 README 与官方版本化 docs/spec.md 的 Storage/Backends 契约，以及 registry/define/harness types；dist/harness/types.d.ts、storage/sqlite/{node,storage}.{d.ts,js}。只用官方 SQLite facade/Storage/Harness/inspect/context，未重写 scheduler；核实普通 hooks 抛错会被忽略，所以安全拒绝不用 hooks throw，恢复前检查并在 live 工具失败时明确 abort/failed。
- Pi coding-agent 1.0.2 `docs/sdk.md`：AgentSession、资源装配、customTools、SessionManager 与 agent_settled。
- 项目 `lib/runtime/backends/durable/`、`lib/ai/file-store.ts`、`package.json` 与锁文件。

后续升级与实现须补查对应版本官方源码、`dist/harness/types.d.ts`、`dist/types.d.ts`、scheduler/storage/events 与官方恢复示例；源码/测试优先于最新网页和公告。
