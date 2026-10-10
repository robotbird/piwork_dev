# 千人企业 MVP 与沙箱执行面实施方案

> **状态：已进入分阶段实现。** P0 契约、P1 lazy/限额文件/四工具、SandboxToolsBackend 协议适配器与私有存储/交付回调已落地，Docker 新契约与 CSV 交付 smoke 已通过，**未接入生产装配**；正式权限/账本/输入/治理/办公验收与单 Worker 仍待完成；OpenSandbox 新 tools 不开放，不能将适配器测试当作完整 P2/P3 验收。本轮按要求不做容量、持续负载或突发并发测试。详见 [实施记录](runtime-foundation-implementation.md)。当前后端、安全配置与普通问答路由不变。
> 适用目标：约 1000 个企业内部账户，先提供受限并发的办公 MVP，逐步支持稳定后台任务；不是 1000 个并发任务或高可用承诺。
> 当前 Pi 版本以仓库安装包和锁文件为准，最新基线见 [升级记录](pi-upgrades.md)。正文的旧版本查证保留为方案制定时的历史证据，不代表当前安装版本。
> 当前事实见 [architecture.md](architecture.md)；Durable 专项门禁见 [pi-durable-evaluation.md](pi-durable-evaluation.md)。本方案替代旧稿中无条件 shell 重试、Docker 自动 TTL 回收、文件工具天然 safe、容量已足够与 Durable 先于 Worker 生产化的设计。

## 1. 目标、范围与架构决策

### 1.1 产品范围

MVP 必须能完成：文档总结与报告、CSV/XLSX 数据清洗与分析、PDF/Office 文本抽取、基础 PPT/DOCX/PDF 生成、图片/OCR 类处理和定时文件任务。每类提供少量经过验证的 Skill 与样例，不承诺任意脚本、任意格式、任意网站均可执行。

首轮企业部署不包含：分布式高可用、用户上传扩展强隔离、任意 MCP 服务自助启用、未经确认的邮件/OA 写操作、全自动小时级无人值守任务。邮件/日程/OA 等集成需按 §5 的权限与确认门禁逐步开放。

长任务承诺按阶段区分：

- P2 前后内部试点：分钟级，进程故障可中断；中间文件可保留，但不是自动续跑。
- P3 单 Worker：Web 发布不打断执行；Worker 故障显式失败或 needs_review，用户可以续作。
- D1 通过：仅批准的后台任务支持 checkpoint 恢复；仍不保证任意 shell 或外部副作用恰好一次。

### 1.2 决策

1. **Pi loop 在可信运行宿主中，沙箱只提供进程和文件执行能力。** P2 宿主暂为现有 Next.js；企业正式放量前完成 P3 独立 Worker。
2. Pi AgentSession 是主 harness，复用官方 agent loop、工具调用、资源装配与事件。四个执行工具同名覆盖；覆盖只负责路由，安全控制由平台策略与 provider 强制。
3. 保留 RuntimeBackend/RuntimeSession 与 RuntimeEvent 的平台 seam；不让页面直接依赖 Pi 事件。平台 RunManager 职责保留，内部可演进为控制面与执行端适配器。
4. 同一运行在开始时固定 backend/lane/配置版本；不按 classifier 预测时长迁移正在运行的会话。后台处理由用户显式选择或定时任务定义选择。
5. 先安全工具、运行账本、资源治理和 Worker，后 Durable。不自研 Pi agent loop，不提前建设完整分布式平台。
6. RPC 后端在迁移期为兼容路径；是否长期保留取决于能力和维护成本，不宣称可随时无损切回。

### 1.3 当前到目标的增量

当前设置 sandbox provider 时，执行类 run 经 SandboxRpcBackend 在容器内运行 pi；未设置时仍可能走 InProcess 执行。目标企业配置必须显式启用沙箱并 fail-closed，**不允许无 provider 时静默宿主执行**。

目标运行链保持：route → 平台运行管理 → RuntimeBackend → 官方 Pi harness；工具执行经 SandboxHandle，事件经 RuntimeEvent → stream-mapping。未来 Worker 只改变运行宿主和命令传输，不改变产品协议。

## 2. 状态归属与稳定契约（P0 先定稿）

| 信息 | 权威来源 | 不得混淆的部分 |
| --- | --- | --- |
| 用户、组织、资源授权 | 平台 DB 与当前会话 | 模型提供的 userId、Skill 文本不是授权 |
| 用户可见运行与结果 | AgentRun / ScheduledTaskRun / Message / LibraryItem | Pi 内部 task failed 不等于业务 run failed |
| 内部会话恢复状态 | AgentSession 状态；Durable 试点为其 Storage | RuntimeEvent 是产品事件，不是完整 Pi checkpoint |
| 文件字节 | 私有文件存储 + 持久 workspace | 活跃容器不是唯一文件副本 |
| 命令/工具操作结果 | 平台操作日志与 provider 执行记录 | SSE 断开不等于命令未执行 |

### 2.1 两层运行描述

保留当前包含 Pi Model/Message/AgentTool 的 `RuntimeSpec` 为**运行宿主内部装配对象**。新增版本化 `RunDescriptor` 作为持久化和跨进程 DTO，不继续向 RuntimeSpec 添加附件字节或工具闭包。

RunDescriptor 至少包含：

- schemaVersion、runId、chatId、平台写入的 userId、lane/backend、attempt、policyVersion；
- 模型 provider/model 引用、批准工具/Skill/Package 的 ID 与不可变版本/hash；
- 输入消息/历史引用与修订号、提示版本；不依赖可变的“聊天最新状态”重建输入；
- workspaceId、文件 LibraryItem ID/content hash/安全目标路径；
- 资源额度、egress 申请、超时、预算；不含真实模型密钥、任意回调或整份文件 bytes。

平台提交时校验归属和能力；Worker claim 后及工具执行时复核当前授权。Worker 从可信目录装配 Pi Provider、工具与提示，下载文件并验证 hash。客户端与模型不能指定运行身份。

### 2.2 状态、所有权与取消

沿用 queued/running/settled/failed/aborted 的现有语义，按需新增 waiting_capacity/needs_review 或等价独立执行状态字段；迁移前审计所有枚举消费者，不擅自让旧客户端忽略新状态。

- queued / waiting_capacity → starting → running → 终态；有副作用且结果未知 → needs_review，不自动重交。
- 数据库 claim 产生 owner、leaseToken/fencingToken；心跳延期。投影写入必须带 expected owner/attempt，过期执行者不能写回结果。
- 平台 fencing 不能直接阻止已启动的 shell；重新授予 workspace 前必须终止/对账旧进程，无法确认则隔离 workspace。
- 用户停止、删除聊天、停用账户写入持久取消请求；执行端接收后先停工具进程，再终结会话。删除接口不得假装已同步擦除无法停止的资源。
- 启动对账处理 queued、过期 lease、未知命令、待归档产物与待删除 workspace。运行中的后端与工具版本固定；撤权优先于恢复。

### 2.3 事件与最终结果

- 平台持有每 run 单调游标/事件 ID；订阅先读取 DB 游标，活跃执行端只作为增量来源。
- 高频 command.output 做有界缓冲、批量/节流与背压；关键终态、工具结果、产物事件必须持久化。明确非持久化输出的重连缺口，不声称回放所有日志。
- Message、产物与 usage 投影用稳定源 ID 去重。Durable snapshot 是替换状态，须显式映射，不能拼成重复 delta。
- Pi AgentSession 以 agent_settled 判断自动执行完成；“没有错误且生成了一段文字”不能证明业务交付完成。文件任务需验证预期产物存在、格式有效并完成归档。

## 3. 沙箱工具与 provider 契约

### 3.1 四个工具

新增 `lib/runtime/backends/sandbox-tools/`。参数与 Pi 安装版 read/bash/edit/write schema 对齐，工具注释清楚说明路径、截断与超时；不复制实现 Pi 已提供的会话循环。

| 工具 | 行为 | 必须实现的约束 |
| --- | --- | --- |
| bash | 沙箱 shell 执行，流式 onUpdate | 运行/workspace 串行执行；默认 120s，上限初始 1800s；进程树硬终止；stdout/stderr 合并、有界尾部；不自动重放未知结果 |
| read | 文本行范围/图片；PDF/Office 走受限解析作业 | 传输前及传输中限额；不能读完整大文件后才检查；解析不在 Web 主事件循环重负载运行 |
| edit | 唯一匹配、diff、原子替换 | workspace/file mutation 串行化、内容 hash 前置条件；失败不得留下半文件；并不天然幂等 |
| write | 覆盖写入与建目录 | 配额、临时文件+同 FS rename、版本前置条件；拒绝逃逸、符号链接绕过与特殊文件 |

文本截断默认对齐安装版 Pi（read 1000 行/50KB、bash 200 行/50KB）；升级时核对源码。文件传输初始上限 50MB、解析输入 20MB；大文件使用沙箱内分段处理，而不是把 100MB 数据整体复制到宿主。

### 3.2 provider 增量能力

现有 SandboxChannel 的 endInput/close **不是已验证的进程树强杀契约**；现有 readFile 全量读、writeFile 非原子写也不足以承载上述工具。

P1 在 `lib/runtime/sandbox` 内设计并实现 provider 无关能力。当前 `filesystem.ts`/`remote-files-script.ts` 与 `backends/sandbox-tools` 已有增量代码和 Docker 测试，可信观察仅进程内，完整账本/重启对账与 OpenSandbox 门禁尚未完成：

- 以 operationId 启动命令，返回可查询的 executionId、进程状态和有界输出；
- 明确 stop/kill 进程组、等待退出的语义；无法证明退出则销毁容器并标记结果未知；
- stat / 限额读取或流式传输，写入原子提交与 hash 校验；
- workspace 路径与符号链接处理，禁止读写宿主或其他 workspace；
- renew、inspect、destroy 与错误分类：not_started / started / completed / outcome_unknown。

命令记录/退出标记不得仅凭模型可写文件判断；优先 provider 的控制记录，若使用 launcher，控制路径和元数据须不可由任务脚本伪造。MVP 无法可靠查询旧命令时，容器销毁+人工复核优于猜测并重跑。

Docker/OpenSandbox 都通过同一契约；底层 SDK import 仍只在各 provider 目录。TestSandboxProvider 只在 tests/support，不进入生产装配。

### 3.3 LazySandbox 与重试

- 工具先声明，首次执行/水合时 ensure；promise 单飞，确保 close/cancel 后的迟到 acquire 被释放，不遗留容器。
- 纯文本/纯视觉对话不建容器。read 可以首次创建，但遇到文件不存在不重建；已有容器失效时，先核对持久 workspace，再决定是否重新 attach。
- **只对明确未启动的 provision/连接失败做一次有界重试**；命令已启动或结果未知不自动执行第二次。
- write/edit 在操作日志与原子写保障前同样不自动重放；附件按 content hash 水合可幂等重试。
- 长命令定期 renew，默认 30s；续期失败记录降级状态，不能让过期 lease 的旧 run 继续写回。
- 无 provider 或策略未授权必须明确拒绝；沙箱不可用作为工具错误反馈，不退回宿主工具。
- 若用户要求的执行/交付未完成，不得仅因模型转告错误后正常结束便标记业务成功。技术终态和业务结果分别记录。

## 4. 文件、附件、Skill 与 workspace

### 4.1 附件水合

提交描述只存 LibraryItem 引用、hash 和目标路径；执行端按授权下载，按并发信号量流式水合，临时文件+hash 校验后 rename。不能用 test -f 判断正确版本。

图片直接用于视觉输入；需要 OCR/压缩/图表编辑时按需水合原图。非图片也不必在 backend.open 批量下载，首次使用前水合；图片与文件路径映射写入提示。

水合失败记录结构化错误与文件可用状态，**不能 warning 后让任务假装输入完整**；必需输入失败阻止对应作业，可选输入由用户确认后继续。

### 4.2 私有存储与产物幂等

企业文件不得沿用 public Blob URL 作为访问控制；采用经鉴权的本地/私有对象存储或短期签名下载。存储凭据不进沙箱。

增加操作日志/产物投影账本（名称和迁移编号以实施时实际库为准）：

1. 平台为一次工具调用分配稳定 operationId，跨恢复保持不变，不采用模型新生成的随机 ID。
2. deliver_file 验证归属、路径、类型、大小/hash，以 operationId 对应稳定 object key 存储。
3. DB 按 `(runId, operationId, artifactIndex)` 唯一键登记 LibraryItem/交付结果。
4. 归档成功后才发布 artifact.created；以同一逻辑 ID 去重。
5. 存储成功 DB 失败、DB 成功事件未发布均由后台对账完成；不能假定跨存储事务原子。

当前 storeFile 随机命名不能直接满足该协议；保留普通上传行为，为运行产物增加幂等存储入口和结果找回能力。

### 4.3 workspace 与容器分离

- workspace 是持久数据，容器是可销毁执行环境。Docker 用持久目录；OpenSandbox 需先验证持久卷挂载、销毁重挂、备份与授权。
- 未通过持久性验证的 provider 不得用于有恢复承诺的后台任务；keep 活着也不等于持久存储。
- 初始每 workspace 2GB/20000 文件、每用户 10GB 的试点配额；写入、脚本生成与临时目录均需实际限制，不能只检查上传入口。
- 默认初始 workspace 闲置保留 7 天，最终归档文件独立保留；组织审批后配置期限并在删除前提示。期限是试点配置，不是合规法律结论。
- 模型可写 progress/state.md 与中间产物用于续作，但这不是可信 checkpoint；状态恢复仍以平台和 harness 为准。

### 4.4 keep、TTL 与擦除

默认 release=kill，文件通过持久 workspace 保留；仅在 reaper、空闲容器上限与 provider 持久性验证通过后启用 keep（试点初始 idle 10min，最大 TTL 1h）。

**Docker 无原生 TTL，必须新增 reaper**：定期扫描注册表并核验 provider 状态；仅清理无有效运行租约的过期容器；还扫描带平台 label 的孤儿容器。单运行宿主可负责扫描，防重入；未来多实例需 DB claim。销毁成功后才落 destroyed，失败进入待确认并重试。

聊天删除/用户停用：写入持久取消和删除 tombstone → 停 run/旧进程 → 销毁实例 → 清理 workspace → 对账确认。用户可见“清理中/失败”，不得伪装已擦除。归档文件按独立策略处理，命令审计保留仅限批准的合规字段与期限。

### 4.5 办公镜像与 Skill

构建最小办公执行镜像，固定依赖版本和 digest：按首批任务选择 Python 数据库/Office 生成工具、PDF 工具、受许可中文字体；OCR/LibreOffice 等重依赖单独评估资源或镜像档位。禁止运行时任意安装软件以绕过 egress。

批准 Skill 制品按 safe_name/version/hash 同步到只读目录，重写提示内脚本路径为沙箱路径；拒绝路径逃逸、危险链接与未批准依赖。P2 就交付首批脚本 Skill，不能把所有脚本支持留到 Phase 2 却承诺多种办公任务。

## 5. 工具权限、MCP 与安全策略

### 5.1 执行宿主信任

运行宿主有模型和文件访问能力；只加载平台批准的代码。Package、模型插件 Worker 与 MCP stdio 不能因为叫 Worker 就被视为强沙箱。用户上传扩展不进入执行宿主，另行隔离设计。

- 默认禁止发现工作区/宿主全局扩展、上下文和 MCP 配置。
- 远程 read/bash/edit/write 为平台保留名称；禁止扩展覆盖，装配及工具集刷新后校验实现来源与允许列表。
- 独立配置 MCP、受管扩展和内建工具，不再耦合 disableBuiltinTools。权限不因 classifier 或 workspaceDir 自动授予。
- 企业配置未启用合法 sandbox provider 时执行类请求 fail-closed；纯对话可以继续。

### 5.2 网络与凭据

沙箱无模型凭据、不继承宿主 env、不挂 Docker socket或控制面文件。egress 默认 deny-all，申请与组织基线取交集，不因模型请求自动放宽。

生产 allowlist 必须通过真实 IP/FQDN 绕过、IPv6、DNS、metadata、内网与控制面端口测试。当前 Docker/OpenSandbox 已声明的 raw-IP 绕过问题不能靠改工具架构消除：未落实外部 firewall/egress gateway 等强制控制前，仅批准 deny-all 任务，不向企业放开网络型脚本。

### 5.3 MCP 与外部动作

MVP 默认 MCP/扩展 off；按服务分别批准读/写能力、执行位置、身份和凭据范围。不能仅有全局 on 开关；服务 enabled 不等于所有员工有权调用。stdio 服务资源与进程数计入预算，生命周期必须随会话清理或通过受控共享连接管理。

- 只读工具仍检查数据归属；写入/外发工具要求用户确认或组织预批准的范围。
- 确认凭证绑定 run/工具/目标/参数 hash/有效期；恢复和参数变化不能复用旧确认。
- 无通用 HITL 前，禁止外发、删除、支付、批量修改等工具；不依赖提示词提醒代替门禁。
- 命令字符串 deny 规则不能成为 shell 安全边界；容器/网络/权限是强制边界，高风险业务动作通过独立工具管理。

### 5.4 审计

新增统一 ToolInvocation/Operation 审计，覆盖四工具、文件交付、MCP 与业务工具；SandboxCommandAudit 可作为命令细节投影，但不能替代 MCP 审计。

至少记录：run/operation/用户/工具与版本/策略版本/执行位置/开始终态/耗时/结果码/批准来源。参数只存批准字段或 hash，命令中的密钥与敏感内容脱敏；完整 argv 不默认无限保存。初始审计保留 90 天须经组织确认。

执行前持久记录 intent；副作用类动作 intent/确认记录无法落库时拒绝执行。终态记录失败写入持久 outbox 并对账；不把 warning-only 当作完整审计。管理页展示未知结果和待对账状态。

## 6. 容量、准入与公平性

1000 账户仅说明组织规模。P0 收集日活、峰值请求率、任务类型比例、平均/P95 时长、文件规模、模型 RPM/TPM、预期完成时间，再校准限额。

以下是**试点保护值，不是千人容量证明**：

| 额度 | 初始值/策略 | 验收与调整 |
| --- | --- | --- |
| 每用户活跃 run | 2，后台最多 1 | 包括聊天/定时/后台，避免多个入口绕过 |
| 全局活跃 run | 32，其中沙箱执行最多 16 | 所有模型轮次统一准入；交互预留 8 个位置，不被后台占满 |
| 活跃/存活容器 | 活跃最多 16，存活总数最多 24 | keep 启用后也限制空闲容器；达到上限先淘汰空闲实例 |
| 每容器资源 | 2 CPU / 2GB，pids/临时盘受限 | 大型 Office/OCR 按实测档位调整，不自动超配 |
| 解析并发 | 2，单输入 20MB、初始 200 页/60s | 解压后总量、压缩比、图像像素另设硬上限并测试 |
| 文件传输并发 | 4，全程背压 | 不使用所有 run×附件的内存批量数组 |
| 后台等待队列 | 全局 100，每用户 5，过期时间显式 | DB 持久队列，调度/手动入口共享；交互超额返回明确 429/Retry-After |
| 模型 RPM/TPM | 取供应商合同额度的初始 80% | Provider 全局预算；重试、分类、标题、压缩均计入容量和成本 |
| 费用/Token | 每用户/部门预算，组织配置 | 不能用聊天 usage 汇总冒充所有辅助调用账单 |

run 槽、模型请求槽、容器槽、解析槽分开控制。多轮任务预算耗尽时等待/停止并通知，不无限重试；429 使用有界退避和 jitter。日程任务错过周期沿用现产品策略，不能因为队列变长自动重放历史周期。

内存预算计入 Buffer 复制、图片解码、Office 展开、事件缓冲、SSE 与 stdio MCP。初始容器上限 16×2CPU/2GB 是额度合计，不是实际耗用；宿主数量由压测峰值与保留余量确定，不使用未经测量的超卖比承诺容量。

## 7. 单 Worker 执行宿主（正式放量前完成）

P2 可先内部验证工具；P3 将 Pi session 生命周期移出 Next.js。先一个常驻 Worker、一套 PostgreSQL，不引入 Kafka/Kubernetes/多主。

建议新增 `lib/runtime/worker/`（宿主与命令泵）、`lib/db/runtime-job-queries.ts`（提交/claim/心跳/取消/outbox）；独立启动入口与脚本在实施时确定并写入 package.json。查询仍留 lib/db；工具不 import 路由。

- Web 鉴权并事务提交 RunDescriptor，返回 runId；RunManager 控制端通过 Backend adapter 提交/取消/订阅。
- Worker 事务 claim，装配官方 AgentSession + SandboxTools；终态和关键事件写入 DB；浏览器仍消费 RuntimeEvent。
- DB 事件游标作为跨 Web 进程的可重连来源；MVP 可以轮询+通知优化，不以进程内 EventEmitter 为唯一事实来源。
- 调度器通过同一入口提交 job，领取调度计划与运行结果分开；旧 5 分钟超时/10 分钟 stale 策略按新生命周期明确迁移，不直接取消安全限制。
- Web 发布仅停止新请求；Worker 发布停止领取、排空至上限，超限任务停止或 needs_review，不隐式重放。
- Worker crash 后 AgentSession run 明确失败/待复核，文件保留；不把进程拆分宣传成 checkpoint 自动恢复。
- DB 或策略目录不可用时停止新准入；活跃执行按既定安全策略停止/保留，不能回退宿主执行。

## 8. Durable 后台车道

完整门禁见 [专项评估](pi-durable-evaluation.md) §5–7。

D0 可提前做版本与恢复测试；**D1 生产试点依赖 P0–P3**。Worker 内选择 Durable harness，共享 RunDescriptor、运行账本、工具、workspace、操作日志、准入与审计。

- 先文件类定时任务，单 SQLite/单写者；数据库、workspace、对象存储备份分别演练。
- 平台记录 conversation/submission/run 映射和投影游标，重启先对账旧命令再 resume。
- read 可验证后 safe；bash 强制 unsafe；write/edit/deliver_file/业务工具初始 unsafe，不能按工具名宣称幂等。
- 权限检查在 execute 内执行，恢复重放不依赖 beforeTool。
- interrupted 是工具错误，不必然使整个 submission 失败；副作用结果未知则平台策略阻断后续危险动作并要求复核。
- snapshot 必须能重建平台视图与去重投影。现 Durable 原型忽略的 snapshot 不能进入生产。
- SQLite 不提供多实例锁或高可用；Postgres Storage 与多 Worker 仅在实际需求后开展。

## 9. 实施工作包与依赖

每个工作包须有负责人、迁移/配置清单、验证记录和回滚记录；不能以“单测绿”替代真实 provider 验收。具体工作量在 P0 inventory 后估算，不预设不可靠工期。

| 包 | 前置 | 代码/交付落点 | 完成标准 |
| --- | --- | --- | --- |
| P0 契约与任务基线 | 无 | protocol RunDescriptor；状态/预算/策略设计；首批办公样例；现枚举与查询 inventory | schema/状态/错误/幂等/授权 review；量化负载与部署 SLO 经确认 |
| P1 provider 与安全工具 | P0 | sandbox 能力增量、lazy；sandbox-tools 四工具；受限解析；命令操作记录 | 首发选定 provider 的真实强杀/原子写/限额/逃逸/未知结果验收；其他 provider 受阻，不要求 MVP 双档对等；不接默认生产 |
| P2 内部 tools 试点 | P1 | agent-session 独立门禁；产物账本/私有存储；水合/Skill 镜像；reaper；资源准入/审计/删除对账；管理页 | §10 安全与功能门禁通过；白名单 tools 灰度；默认 rpc 不变 |
| P3 单 Worker 与企业放量 | P2 | worker 宿主/DB jobs/命令与事件 adapter；共享调度入口；发布排空；备份/告警 | Web 发布不中断 run；故障状态明确；功能/安全门禁与恢复演练通过，才翻 tools 默认；本轮容量测试排除且不作容量承诺 |
| D0 Durable 验证 | 可并行 P1/P2 | 固定版本；恢复/快照/升级测试报告 | kill/restart 与 replay 行为确认，不开放生产 |
| D1/D2 Durable 车道 | P3 + D0 | 文件定时任务 → 显式后台任务 | 实际恢复、权限变化、投影幂等、备份/回滚验收通过，白名单逐步扩大 |
| P4 按需求扩容 | 实测瓶颈/业务要求 | 多 Worker、强仲裁、必要时 Postgres Storage/HA | fencing、故障转移与容量证明；不作为 MVP 前置 |

配置语义：`PIWORK_SANDBOX_BACKEND=rpc|tools` 为新任务装配选择，默认在 P3 验收前仍为 rpc；`PIWORK_SANDBOX_PROVIDER` 必填于企业执行部署；MCP/扩展默认 off。新预算/队列/保留配置名在 P0 定稿，不把本文保护值当作已存在 env。工具路径不需要沙箱内完整 pi；RPC 路径仍需要现有完整 pi 安装和 Inference Proxy。

迁移编号由当时 migrations journal 分配，不预先占用 0017。新增索引/状态先兼容上线，再启用生产功能。history、公开文件与旧 workspace 的数据迁移须单独评审，不能静默移动或改变原文件访问。

## 10. 测试与上线门禁

### 10.1 自动化位置

- `tests/unit/runtime/protocol/`：DTO 序列化、版本拒绝、授权引用与状态迁移。
- `tests/unit/runtime/sandbox/`：lazy 单飞、取消竞态、reaper/孤儿清理；provider 强杀、路径/符号链接、原子写与限额。
- `tests/unit/runtime/backends/sandbox-tools/`：schema、截断、流式/背压、超时/abort、文件版本、结果未知不重放。
- `tests/unit/runtime/worker/`：claim、lease/fencing、取消、Web/Worker 重启、发布排空、旧 worker 迟到写回。
- `tests/unit/runtime/backends/durable/`：真实子进程崩溃恢复、safe/unsafe、快照重建、权限变更。
- `tests/unit/db/`：job/operation/artifact 唯一键、投影事务、取消/删除 tombstone、过期 claim、调度结果对账。
- `tests/e2e/`：办公交付与下载、权限隔离、进度/重连/停止、限流/排队、删除待清理、管理复核。
- `tests/integration/`：真实 provider 网络/Office 镜像/负载与混沌；fixture 与替身仍在 tests/fixtures、tests/support。

实现时将命令纳入 package.json。已新增 `pnpm test:runtime:foundation` 并将协议测试纳入 `test:runtime`。最低回归：`pnpm exec tsc --noEmit`、`pnpm test:unit`、`pnpm test:runtime`、涉及持久化时的 `pnpm test:runtime:db` 及相关 Playwright/真实 provider 契约。实际执行与跳过项记录于实施记录，不把替身测试冒充生产 provider 验收。

### 10.2 强制用例

1. shell 已写文件但通道断开：没有自动第二次执行；显示未知结果并对账。
2. timeout/abort：子孙进程确实退出，不仅 docker exec 客户端退出；后续不能偷偷写 workspace。
3. keep 累积与 Docker 重启：空闲容器总量受限、reaper 回收、销毁失败不伪装成功。
4. 写文件中途故障、重复 edit、并发 bash 改写：无半文件、版本冲突明确，不覆盖后续修改。
5. store 成功/归档失败/事件发布失败各点注入故障：一次 operation 只交付一份 LibraryItem/逻辑 artifact。
6. 超大展开 Office、压缩炸弹、恶意 PDF/大图片：解析被限制，不拖垮 Web/Worker。
7. 用户跨 workspace、符号链接、扩展覆写工具、未批准 MCP：全部拒绝；网络 deny-all 实测阻断。
8. 图片分析零容器；同图压缩/OCR 按需水合原图；必需输入下载失败不输出虚假完成。
9. 删除/停用/撤权与执行竞争：持久取消、擦除对账、旧 owner 不能写回；unknown 命令不能进入新 run。
10. Web 发布任务继续；Worker crash 状态明确；Durable 试点重启后不重复副作用/Token/产物投影。

### 10.3 功能和运维验收（本轮不做容量测试）

**功能：**首批至少 20 个固定办公样例，覆盖 §1.1 各类别，每类含失败输入；真实模型/镜像端到端完成、人工检查内容与格式。常规样例交付成功率目标 ≥95%，失败原因可定位，不以“模型正常结束”代替成功。

**范围排除：**本轮不实施容量压测、8h 持续负载、突发并发或供应商吞吐校准，不将其作为本轮功能交付门禁。保留资源预算、有限排队/限流、公平调度与可观测性实现，并用功能契约验证限额拒绝和资源回收；这些测试不证明千人容量。宿主规模与可承载并发仍未经验证，后续是否测试另行确认。

**技术安全门槛：**无重复外部副作用、跨用户泄漏或失控进程；未知命令明确复核、失败可定位；模型供应商故障和主动限流单独记录，不从报表隐藏。持续负载下 event-loop/内存/连接趋势及吞吐指标本轮不测。

**真实灰度：**管理员白名单验证实际办公任务，工具/归档/队列/资源信息可查，分别记录 Docker/OpenSandbox 的行为和失败原因。真实功能验收不等于负载测试，不凭本地耗时或样例成功率宣称容量已达标。

**运维：**仪表盘包含运行/模型/容器/解析/队列、429、unknown operations、reaper 失败、磁盘、事件积压与费用；每项有负责人/告警阈值。单实例 MVP 无自动故障转移；初始目标备份恢复 RPO ≤24h、RTO ≤4h，需演练和业务签字，不接受则提升备份与部署方案后再上线。

**发布：**P3 与相应 provider 全部门禁通过才把新任务默认翻为 tools。任何安全隔离失败阻断上线，不能用成功率抵消。

## 11. 回滚、运行手册与后续文档

- 配置只影响新 run；运行中 run 继续绑定旧 backend/镜像/策略。切流前检查两路径能力矩阵。
- tools → rpc 回滚前确认 workspace 挂载、附件路径、历史和平台闭包工具差口；不兼容任务停止新准入并保留原路径排空，不能假装无损回切。
- Durable 停止新准入后保留旧 Worker/存储；未知副作用挂起复核，不自动 InProcess 接管。
- RPC-only 的 Inference Proxy、run token、outbox/bridge 暂保留；完成回滚演练和约定维护窗口后再决定删除，不立即标全部 legacy。
- 运行手册至少包括：容量耗尽、模型 429、沙箱不可用、磁盘满、unknown command、删除失败、备份恢复、Web/Worker 发布和撤权。
- 每个增量落地时更新 architecture.md/development.md/AGENTS.md 的**当前实现**；本批次已有契约/lazy/四工具、tools 协议 adapter 和私有存储/交付回调，但正式身份/账本/生产路由未接；不能把 tools 后端/Worker/Durable/reaper 标已上线。

## 12. 依据与未验证项

实际核对的 Pi 依据：

- coding-agent 1.0.0 `docs/sdk.md`：customTools/resourceLoader/SessionManager/AgentSession 与 agent_settled。
- 官方 `examples/extensions/tool-override.ts` 与 `dist/core/agent-session.js`：支持同名覆盖与远程路由；后注册工具可覆盖，不是安全保证。
- Durable 0.99.2 README、`dist/harness/tool.js` / `generation.js`：单写者、提交去重、恢复 safe 门禁、工具失败后的 generation 行为。
- 项目 `lib/runtime/sandbox/index.ts`、`leasing.ts`、Docker provider：全量读、非原子写、无原生 Docker TTL；这些能力须增量实现，不假定现 seam 已够用。
- 项目 `lib/ai/file-store.ts`、agent-session 与 DurableEventNormalizer：随机文件 key、门禁耦合、snapshot 差口。

实施前还须核验：OpenSandbox 持久卷与真实强杀、两档网络硬拒绝、办公镜像限额、拟升级 Pi/Durable 的完整签名与恢复示例。未证实能力阻断依赖它的工作包，不用“实现时再确认”绕过上线门禁。

参照 cubeplex 的工具级沙箱思路只作设计输入；其重试/恢复/解析取舍不直接移植为本项目安全保证。本方案更新 [platform-runtime-roadmap.md](platform-runtime-roadmap.md) 的目标执行位置，历史 RPC 设计保留历史属性。
