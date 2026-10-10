# Piwork 平台与 Agent Runtime 演进架构

> Pi 版本说明：正文版本为方案制定时的查证背景；当前依赖和升级验证见 [升级记录](pi-upgrades.md)，不将历史版本当作当前安装版本。

> 状态：**目标架构与迁移路线，不是当前部署拓扑。** 当前实现见 [architecture.md](architecture.md)。
> 最新执行基线：[千人企业 MVP 与沙箱执行面实施方案](sandbox-execution-surface-design.md)；Durable 专项门禁见 [pi-durable-evaluation.md](pi-durable-evaluation.md)。
> 本次修订将旧目标“Worker → Sandbox → Pi RPC”调整为“Worker 承载 Pi loop，Sandbox 承载工具执行”。现有 SandboxRpcBackend 保持当前事实，不因文档修订退役。

## 1. 平台与 Pi 的职责

平台拥有身份、组织、资源授权、AgentRun、准入预算、运行/操作账本、审计、文件归档与用户界面。Pi 提供官方 AgentSession / harness、模型调用、工具轮次、会话状态与扩展机制。

浏览器和未来 Desktop 通过平台 RuntimeEvent 与运行命令接入，不直接消费 Pi SDK/RPC 内部事件。当前 RuntimeSpec 仍含 Pi 类型和工具闭包，只作为运行宿主内部 seam；未来跨进程使用版本化 RunDescriptor，不能宣称当前 RuntimeSpec 已可序列化。

## 2. 当前事实与目标分界

| 能力 | 当前状态 | 目标增量 |
| --- | --- | --- |
| Web/API、用户/组织、模型/Skill/MCP 管理 | 已有实现 | 细化每次运行与工具授权、不可变配置引用 |
| RunManager / RuntimeEvent / AgentRun | 在 Next.js 进程内管理执行 | 保留平台职责，执行宿主迁到独立 Worker |
| InProcessBackend | 无 sandbox 配置时默认；矩阵纯对话路径 | AgentSession 仍为主 harness，执行类企业配置不允许静默宿主执行 |
| SandboxRpcBackend | 已有 Docker/OpenSandbox、bridge、文件与模型代理链路 | 保留迁移兼容，按能力矩阵逐步 tools 灰度 |
| SandboxProvider | 已有 seam、注册表、租约、管理与 provider | 强杀/操作查询、原子写、限额传输、持久 workspace、reaper |
| DurableBackend | MemoryStorage 实验原型 | 单 Worker 内的受控文件任务恢复试点；不是默认耐久执行 |
| Runtime 基础 / 沙箱工具工厂 | RunDescriptor/状态、lazy/限额文件、SandboxToolsBackend/私有存储与交付回调已落地，Docker 新契约通过；未接生产路由 | 首发先验 Docker deny-all；生产账本/权限/附件/治理与 P2/P3 尚缺，OpenSandbox tools 未开放；本轮容量测试排除；见 [实施记录](runtime-foundation-implementation.md) |
| Worker / 通用持久 job 队列 | 未实施 | 单 Worker 起步，claim/取消/游标/发布排空；先不做多主 |
| Desktop / 用户扩展强隔离 | 规划 | 独立需求和安全设计，不作为企业 MVP 前置 |

## 3. 目标业务闭环

平台鉴权并固定运行输入与资源引用，事务提交 AgentRun/RunDescriptor。运行宿主领取任务、复核授权，装配官方 Pi AgentSession；批准的 read/bash/edit/write 经 SandboxHandle 执行。关键事件和最终结果写回平台，客户端按游标订阅 RuntimeEvent。

单 Worker 将 Web 发布与运行生命周期解耦，但 Worker 崩溃时 AgentSession 运行仍需明确失败/复核，不能自动宣称恢复。Durable 车道后续接管批准任务的内部 checkpoint，与平台运行和操作账本对账。

若未来新增 Task 对象，Task 表示长期目标，AgentRun 表示执行尝试，Chat 是交互容器；当前不把 chatId/runId 混称 taskId，也不预先虚构 Task API。

## 4. Runtime 与安全边界

### 4.1 执行位置

目标生产运行宿主为独立可信 Worker，loop 在 Worker 内；沙箱无 Pi 进程、无模型凭据，只运行受限工具/作业。MVP 内部 tools 验证可暂在 Next.js，正式企业放量前通过单 Worker 门禁。

平台 RuntimeBackend/RuntimeSession 契约保留。Worker 装配闭包工具，而不是跨进程传闭包。新增跨进程 Backend adapter 与持久化 DTO，不重写官方 Pi loop。

### 4.2 安全要求

- 同名工具覆盖不提供强隔离；受管扩展不能覆盖平台执行工具，未批准代码不进入运行宿主。
- 沙箱网络默认 deny-all；现 raw-IP 绕过限制未修复前不得作为生产 allowlist 保证。
- shell 启动后断连视为结果未知，不自动重放；终止必须确认进程树退出。
- 容器是缓存，workspace 是持久数据；keep 前具备 reaper/空闲上限，Docker 不假定原生 TTL。
- 权限、审计与外部动作确认独立于模型提示；副作用操作 intent 不可落库则拒绝执行。
- 模型/存储凭据仅在可信运行宿主，企业文件私有访问；用户扩展强隔离另行设计。

RPC 对有明确整会话隔离需求的场景可另行评估，不能因保留旧代码便声称 tools/RPC 可无损互换。

## 5. 顺序与验收

| 阶段 | 工作 | 上线门槛 |
| --- | --- | --- |
| P0 | 稳定 DTO/状态/授权/幂等/资源策略 | 对齐首批办公任务和部署 SLO |
| P1 | provider 能力与沙箱四工具 | 两档真实强杀/限额/原子写/隔离契约通过 |
| P2 | tools 白名单、办公镜像/Skill、私有交付、审计/reaper/预算 | 安全与功能达标，默认仍 rpc |
| P3 | 单 Worker、DB job/事件/取消、共享调度、发布排空 | 功能/安全、备份与故障演练通过，才翻默认；本轮不做容量测试，不承诺并发容量 |
| D0–D2 | 固定 Durable 版本恢复验证 → 文件定时试点 → 显式后台任务 | 依赖 P3；快照、权限变化、未知副作用与幂等投影达标 |
| P4 | 按需求多 Worker、Storage/HA | 以实测瓶颈与业务 SLA 决定，不预建完整分布式平台 |

本轮按要求排除容量压测、持续负载和突发并发测试；资源限额与准入实现仍保留，功能完成不代表千人容量经过验证。

完整工作包、目录、初始保护值、测试门禁和回滚条件以 [实施方案](sandbox-execution-surface-design.md) §9–11 为准。新后端开关只影响新运行；存量运行绑定原 backend/版本，回滚需要能力矩阵和排空，不中途迁移。

## 6. Desktop 边界

未来 Desktop 可以选择企业运行环境或本机 Runtime。共享运行命令与归一化事件语义，但本地目录权限、确认、凭据、出站和同步策略需单独设计。Electron 等选型未定。

不要求当前改为 apps/web/apps/desktop 或抽取大量共享包；出现第二个真实客户端后再按实际依赖抽取。企业运行 DTO 和工具 seam 可降低后续迁移成本，但不承诺零重构。

## 7. 依据和文档纪律

Pi coding-agent 1.0.0 `docs/sdk.md`、官方 `examples/extensions/tool-override.ts`、安装版工具注册源码及 Durable 0.99.2 README/tool/generation 源码是本次决策依据。独立 RPC 适配继续复用官方 RpcClient，不自研 RPC 协议。

本文件描述目标；每个阶段完成时才更新 architecture.md/development.md/AGENTS.md 的现状、实际目录和命令。旧 `pi-plugin-support-research.md` 的 RPC 目标属于历史设计，不再作为最新实施顺序；已实现部分仍按代码核对。
