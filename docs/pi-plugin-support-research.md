# Piwork Pi Package 与 Runtime 技术架构

> 版本：v2.0（2026-09-26）
>
> 范围：Pi Package 网页安装、企业治理、Agent Runtime、Sandbox、Web/Desktop 复用
>
> Pi 版本：`@earendil-works/pi-ai` / `pi-agent-core` / `pi-coding-agent` 1.0.0（2026-10-02 起；MCP 为 Pi 内置扩展，见架构文档第 10/11 节）
>
> 历史与证据库：v1.x 为调研报告（spike 实录与实施 gotchas，附录 A–F），已归档至 [docs/archive/pi-plugin-research-v1.7.md](archive/pi-plugin-research-v1.7.md)（git 8cb4286）。Step 3/4 实施前必读其附录 E.4（loader reload / CredentialStore / 事件桥）与 F.1（RPC 协议纪律：`agent_settled` 判据、JSONL 分帧、停机语义）。

## 1. 架构结论

Piwork 不重新实现 Pi 的 Agent、Extension、Skill、Prompt 或 Package Runtime。Piwork 负责企业控制面，标准 Pi Runtime 负责执行。

生产链路统一为：

```text
Task
  → Sandbox
  → Runtime Worker
  → Pi RPC
  → Piwork Runtime Protocol
  → SSE
  → Web / Desktop
```

关键决策：

| 问题 | 决策 |
| --- | --- |
| Pi Package 能否网页安装 | Pi 官方画廊只提供 CLI 安装命令；Piwork 已用官方 `DefaultPackageManager.installAndPersist()` 实现基础网页安装 |
| 官方插件如何运行 | 生产环境在 Task/Session 级 Sandbox 内运行完整 Pi 进程，不在 Next.js 进程内运行第三方 Extension |
| SDK 与 RPC 如何分工 | SDK adapter 用于开发、测试和迁移；Sandbox RPC adapter 是生产目标态 |
| 前端是否理解 Pi RPC | 否。Web/Desktop 只依赖 Piwork Runtime Protocol 和规范化事件 |
| Skill 如何定位 | 员工侧继续展示 Skill；底层统一归属 Package，管理员管理 Package、资源、版本、审批和权限 |
| Package 如何分发 | 公共源先导入 Enterprise Package Registry；Sandbox 只挂载审批后的只读制品，不直接访问 npm |
| 凭据如何处理 | 平台密钥默认不进入 Sandbox；模型和企业系统优先通过 Inference Proxy / Tool Gateway 访问 |

### 1.1 决策记录：相对 v1.7 的反转与理由

v1.7（归档附录 F.5）的结论是"双执行后端、in-process 为生产默认、RPC sidecar 按需路由，产品需要长会话语义时再翻转"。v2.0 将生产目标态反转为 Sandbox RPC（上表第 2 行），理由：

1. **官方安全指引**：pi.dev security 页将 full container/VM 列为 "usually the strongest practical option"，把"仅内置工具进沙箱"明确定位为更窄的隔离（narrower form）。piwork 必须加载扩展（内置 MCP、模型桥等），而扩展在工具级沙箱之外运行，"仅隔离执行工具"路线不成立。
2. **零信任一致性**：第三方 Extension 以 Web 进程权限运行，与模型插件架构（model-provider 文档 §11）确立的零信任立场矛盾。v1.7 将该矛盾定位为 Phase C 待解事项，本文件将其收敛为：不可信代码有且只有 Sandbox 一个去处。
3. **fail-closed**：不可信代码的执行位置不允许有第二个选项，隔离失败即拒绝执行。

长会话语义（fork/steer/成本统计）由"翻转触发条件"降级为 Step 9 的可选演进。无第三方代码的纯对话路径仍可 in-process（路由矩阵见 §8.1）。

## 2. 当前实现

已完成：

- 三个 Pi 主包已统一到 1.0.0。
- 聊天链路通过 `createAgentSession()` 和 `DefaultResourceLoader` 加载官方扩展。
- 模型插件通过 `ExtensionAPI.registerProvider()` 注入 Pi session。
- 管理端已有 Pi Package 搜索、安装、卸载和数据库记录。
- Package 安装直接复用官方 PackageManager；包内 skills 可进入现有 Skill 管理链路。
- MCP 已改用 Pi 内置 MCP 扩展（受管 agentDir `mcp.json` + 自定义 `loadConfig`）；旧系统 Package `pi-mcp-adapter` 自动退役。

主要代码位置：

| 能力 | 当前代码 |
| --- | --- |
| AgentSession 创建 | `lib/ai/agent-session.ts` |
| 聊天事件桥 | `app/(chat)/api/chat/route.ts` |
| 工具与 workspace | `lib/ai/agent-tools.ts` |
| Package 安装 | `lib/pi-packages/manager.ts` |
| Package 目录 | `lib/pi-packages/catalog.ts` |
| Package 管理接口 | `app/(admin)/api/admin/pi-packages/` |
| Package 数据 | `lib/db/schema.ts` 的 `PiPackage` |

当前风险：

1. Extension、MCP 和执行工具仍与 Next.js 共享进程权限。
2. `.piwork/pi-agent` 是全平台共享的 live agentDir，缺少租户授权快照。
3. workspace 只是路径约定，不是文件系统隔离。
4. `maxDuration = 60` 和 55 秒 provider timeout 不适合长任务。
5. Package 缺少制品哈希、来源证明、扫描、审批、租户授权和回滚。
6. 系统 Package 可以在请求路径懒安装，运行时仍依赖公共 npm。
7. `deliver_file` 依赖进程内闭包，无法直接迁移到 RPC Worker。

## 3. 设计原则

1. **Pi-first**：复用官方 Agent loop、PackageManager、ResourceLoader、RpcClient 和事件语义。
2. **控制面与执行面分离**：Piwork Server 是可信控制面；Package、Extension、MCP、生成命令和脚本属于不可信执行面。
3. **完整进程隔离**：必须隔离完整 Pi 进程。只隔离 bash 工具无法限制未委托执行的 Extension。
4. **默认失败关闭**：Sandbox/RPC 不可用时，不得静默回退到 Web 进程执行第三方代码。
5. **最小暴露**：Runtime 只获得当前任务需要的 workspace、Package 资源、网络目标和短期凭据。
6. **前端协议稳定**：Pi 升级或 Runtime 实现变化不影响 Web/Desktop。
7. **小接口、深实现**：复杂的 Pi RPC、Sandbox、事件和恢复逻辑收敛到 Runtime module 内。

## 4. 目标架构

```text
┌──────────────── Piwork Control Plane ────────────────┐
│ Auth / Tenant / RBAC / Chat / AgentRun               │
│ Package Registry / Policy / Secrets / Audit          │
│ Scheduler / Artifact metadata                        │
└───────────────────────┬──────────────────────────────┘
                        │ Piwork Runtime Protocol
┌───────────────────────▼──────────────────────────────┐
│ Runtime Plane                                         │
│ Task Worker / Runtime Backend / SandboxProvider       │
│ Lease / Health / Recovery / Event persistence         │
└───────────────────────┬──────────────────────────────┘
                        │ RpcClient + JSONL stdio
┌───────────────────────▼──────────────────────────────┐
│ Sandbox Plane                                         │
│ Standard Pi Runtime (`pi --mode rpc`)                 │
│ Approved Packages / Skills / Extensions / Prompts     │
│ MCP / Bash / Files / generated processes              │
│ read-only root + writable workspace + resource limits │
└───────────────────────────────────────────────────────┘
```

职责划分：

- Control Plane 决定谁能运行什么，并保存任务、授权、制品和审计数据。
- Runtime Plane 管理 Worker、Sandbox、Pi 进程和事件，不加载第三方 Extension。
- Sandbox Plane 执行所有不可信代码，不持有平台数据库或加密主密钥。

## 5. Runtime module

### 5.1 Interface

Seam 放在“平台如何驱动 Agent Runtime”，而不是 Pi RPC 的每个命令上：

```ts
interface RuntimeBackend {
  open(spec: RuntimeSpec): Promise<RuntimeSession>;
}

interface RuntimeSession {
  send(command: RuntimeCommand): Promise<RuntimeAck>;
  events(cursor?: string): AsyncIterable<RuntimeEvent>;
  snapshot(): Promise<RuntimeSnapshot>;
  close(reason: string): Promise<void>;
}
```

`RuntimeCommand` 首版仅包含 `prompt`、`steer`、`followUp`、`abort` 和 `clearQueue`。Pi 的 fork、compact、模型切换等能力先保留在 adapter 内；出现真实产品调用方后再扩充公共 interface。

### 5.2 Adapters

- `InProcessBackend`：包装当前 `createPiworkAgentSession()`，用于开发、测试和迁移。
- `SandboxRpcBackend`：通过 Worker 和 Sandbox 控制官方 `RpcClient`，用于生产。
- `InMemoryBackend`：只用于 Runtime interface 契约测试。

### 5.3 规范化事件

| Runtime event | Pi 来源 | 用途 |
| --- | --- | --- |
| `run.started/settled/failed` | prompt response、`agent_start`、`agent_settled`、进程错误 | AgentRun 状态 |
| `message.delta/completed` | `message_update`、`message_end` | 对话流 |
| `tool.started/completed` | `tool_execution_start/end` | 工具步骤 |
| `command.output` | `bash_execution_update` | 命令输出 |
| `queue.changed` | steer/follow-up/clear queue | 用户干预 |
| `artifact.created` | Piwork bridge | 文件交付 |
| `runtime.health` | Worker/Sandbox/RPC | 健康和恢复 |

浏览器通过 REST 发送 command，通过 SSE 接收 Runtime event，不直接连接 Pi stdin/stdout。

## 6. Package Center

### 6.1 安装与发布

```text
Pi Catalog / npm / Git / internal source
  → Import（官方 PackageManager）
  → Manifest、依赖、许可证、安全和无头可用性检查（`ctx.ui` 重度包在无 UI 运行时不可用；画廊头部抽样约 30% 属此类，分级标准见归档 v1.7 附录 A.1）
  → 管理员审批
  → 版本与 content hash 锁定
  → Enterprise Package Registry
  → 租户/成员组授权
  → RuntimeBundleManifest
  → Sandbox 只读挂载
```

约束：

- Sandbox 不直接访问公共 npm。
- 制品不可变，升级产生新版本，不覆盖旧版本。
- Registry 保存制品和 provenance；数据库保存版本、审批、授权和回滚指针。
- 系统 Package 与第三方 Package 使用同一发布链路。
- `.piwork/pi-agent` 仅作为开发或构建缓存，不再是生产共享 Runtime 根目录。

### 6.2 权限

RBAC 应映射到 Package resource，而不仅是整包开关：

```text
Package
├── extensions
├── skills
├── prompts
└── themes
```

管理员可以允许 skills/prompts，同时禁用 extensions，或通过 Pi 官方 resource filter 选择具体资源。

## 7. Sandbox 与凭据

### 7.1 安全基线

| 维度 | 要求 |
| --- | --- |
| 文件 | read-only root；只读 Package bundle；仅当前 workspace 可写；禁止 Docker socket 和宿主根目录 |
| 进程 | 完整 Pi、Extension、MCP 和子进程位于同一隔离域；非 root；限制 capabilities/syscalls |
| 资源 | CPU、内存、PID、磁盘、墙钟时长和租户并发配额 |
| 网络 | 默认拒绝；按任务策略放行；阻断云 metadata 和内网横向访问 |
| 凭据 | 禁止注入平台全量 env；只发短期窄权限 token 或占位符 |
| 出站 | Artifact、Tool 和网络访问通过显式网关并审计 |
| 故障 | Sandbox/RPC 不可用时 fail-closed |

隔离底座分两层依据：官方 containerization 页列出四种方法——plain Docker、Docker Sandboxes（sbx，凭据留宿主、代理替换）、OpenShell、Gondolin——其中 Docker Sandboxes 的凭据代理与 §7.2 同构；gVisor/Kata/OpenSandbox 是企业加固选型（skill 安全方案 §4.1：容器共享内核，不宜作唯一防线）。开发与 MVP 用 plain Docker；生产 `SandboxProvider` 适配 Docker Sandboxes、OpenShell 或 gVisor 级底座，随部署形态决策（§12）确定。

### 7.2 凭据通道与模型访问

模型 Provider 注入与 `deliver_file` 是同一类问题：piwork-llm-* 目前经 inline extension factory 注入 session，而 inline 工厂跨不进 Sandbox 进程。统一方案：

- **Inference Proxy 是 Sandbox 内唯一的模型入口**：Sandbox Pi 配置指向代理的 openai-compatible provider（模型目录由 RuntimeSpec 生成到 Sandbox agentDir 的 models.json）；真实 provider credential 只存在于代理侧。
- **piwork-llm-* 插件代码留在控制面执行**（现行 WorkerThread host），成为代理的上游实现。model-provider 文档 Phase 2 规划的 `RemotePluginHost` 由此被吸收为 Inference Proxy 的上游执行器，不再是平行机制——三份文档在模型访问上的口径以本节为准。
- **官方先例**：pi containerization 页的 Docker Sandboxes 即 "Provider credentials remain on the host and substituted by the proxy"。
- **MVP 形态**：Inference Proxy = 控制面旁路的 HTTP 反向代理 + 按 AgentRun 签发的短期窄权限 token（随 run 过期），复用管理端 RBAC 与凭据存储；首版不做多租户路由以外的功能。
- 企业系统访问优先经过 Tool Gateway，在 Sandbox 外执行 RBAC 与 scope 校验；确需直连时，只签发与目标主机、权限和时效绑定的短期凭据，并同时配置 egress allowlist。
- 平台密钥默认不进入 Sandbox；技能合法需要凭证调内部服务的场景，沿用 skill 安全方案 §6.5 的占位符 + 出口代理设计。

## 8. 运行模型与数据

第一阶段继续以 `chatId` 作为逻辑 runtime key，不立即把所有 Chat 改为 Task。

新增最小模型：

| 模型 | 作用 |
| --- | --- |
| `AgentRun` | 一次执行尝试：chat、用户、backend、状态、spec hash、开始/结束和错误 |
| `RuntimeLease` | Worker/Sandbox 的临时归属与租约 |
| `RuntimeEvent` | 带单调 `seq` 的关键事件，用于恢复和审计 |
| `PackageVersion` | 不可变 Package 制品、hash、provenance 和扫描结果 |
| `PackageApproval` | 审批状态和审批人 |
| `PackageGrant` | 租户、成员组或用户授权 |

AgentRun 状态机：

```text
queued → starting → running ↔ waiting_user
                         └→ settled | failed | aborted
```

### 8.1 路由矩阵

判定标准：`RuntimeSpec` 是否包含任何非平台代码（已批准 Package、Extension 或执行工具）。

| RuntimeSpec 内容 | 执行位置 | 说明 |
| --- | --- | --- |
| 含任何非平台代码 | Sandbox + Pi RPC | 包括第三方/受管 Package 与 MCP 服务进程——来源同为外部，按第三方对待 |
| 纯对话（无执行工具、无 Package） | 允许 in-process | 无第三方代码，不构成降级 |

fail-closed 禁止的是"Sandbox 失败后静默回退到 Web 进程执行第三方代码"，不是无风险 in-process 路径的存在。禁止降级，允许并存。

### 8.2 会话历史 seeding

每个 AgentRun 是新的 Pi 进程，必须显式携带之前的对话上下文：

- 控制面从数据库重建会话条目（与现行 `SessionManager.inMemory` 同源的 lossy 重建），生成 Pi session 文件写入该 chat 的 workspace，Sandbox 内 Pi 以 `--session` 加载；run 结束照旧将最终消息持久化回数据库——Postgres 保持会话历史的 source of truth。
- 不采用"Sandbox 内 session 文件为唯一事实"：那是 Step 9（fork/clone/成本统计）的演进选项，不是本阶段前提。
- 保真度与现状持平（lossy），不倒退；修复保真度同样属于 Step 9。

文本 token delta 经进程内 SSE 直传（现状不变），在 message 完成时落库；数据库持久化状态、工具、Artifact 和错误等关键 RuntimeEvent，并携带 `(runId, seq)` 单调游标序。跨进程事件分发（Worker 时代）到 Step 8 再评估，首选 Postgres LISTEN/NOTIFY 或短轮询；Redis 仅作为届时证明不够时的可选加速项，MVP 不引入（2026-09-26 决策，与 §12 部署形态一并复核）。

## 9. 建议代码结构

```text
lib/runtime/
  protocol/          # spec、command、event、status、cursor
  backends/
    in-process/      # 当前 SDK 实现的 adapter
    sandbox-rpc/     # 生产 Worker client
  pi-adapter/        # Pi RPC ↔ Runtime Protocol
  scheduler/         # lease、worker selection、idle policy
  sandbox/           # SandboxProvider interface
  packages/          # bundle resolver 和校验
  audit/             # Runtime 审计

runtime-worker/
  supervisor/        # 启停和监控 Pi RPC
  bridge-package/    # Artifact 与 Tool Gateway bridge
```

控制面暂时保持模块化单体。需要独立部署的是 Runtime Worker/Sandbox 执行面，而不是所有业务模块。

## 10. 重构步骤

### Step 1：提取 Runtime seam

- 新建 Runtime Protocol 类型。
- 将 `createPiworkAgentSession()` 和事件订阅封装进 `InProcessBackend`。
- route 只负责鉴权、输入准备、调用 backend 和输出 SSE。
- 用同一套契约测试验证真实 adapter 与 in-memory adapter。

完成标准：行为不变；route 不再直接 import `AgentSession` 或 `createPiworkAgentSession`。

### Step 2：增加 AgentRun 和事件游标

- 建立 AgentRun 状态机、RuntimeLease 和关键 RuntimeEvent。
- 支持 SSE 按 cursor 恢复与事件幂等。
- 游标与恢复仅用 Postgres（`seq > cursor` 重放 + 进程内接管活流）；不引入 Redis。

完成标准：刷新或断线后可以恢复执行状态；重复事件不会重复落库。

### Step 3：实现 RpcClient adapter

- 使用 faux provider 验证 prompt、steer、follow-up、abort、`agent_settled`、stderr、停机和崩溃。
- 实现 Pi RPC record 与 Runtime command/event 的转换。

完成标准：InProcess 与本机 RPC adapter 通过相同 Runtime 契约测试，无事件丢失和进程泄漏。

### Step 4：实现 bridge Package

- 将 `deliver_file` 改为 Artifact Gateway 调用。
- 为企业 Tool Gateway 提供最小 Pi Extension。

完成标准：RPC 模式可以执行 MCP、生成文件并显示现有下载卡片。

### Step 5：接入 SandboxProvider

- 先实现本地 Docker adapter 和测试 adapter。
- 应用只读 root、workspace 挂载、资源限制、默认断网和 fail-closed。
- 定义 lease 粒度与空闲回收（chat 级复用、TTL 续期，参考 skill 安全方案 §4.2）。

完成标准：跨 workspace、读取平台 env、未授权网络和资源耗尽测试均被阻止；lease 复用策略生效。

### Step 6：建设 Package 制品流水线

- 将安装升级为 `import → scan → approve → seal → publish`。
- Package Resolver 生成不可变 Runtime bundle。
- 移除请求路径的系统 Package 懒安装。

完成标准：Sandbox 无公网 npm 仍能启动；相同 hash 可复现和回滚。

### Step 7：接入凭据、网络和审计

- 上线 Inference Proxy / Tool Gateway。
- RuntimeSpec 固化权限、resource filter、egress 和 package hash。
- 审计 run、tool、command、network、Artifact 和资源用量。

完成标准：Sandbox 内无法读取平台密钥；未授权访问失败并留下脱敏审计。

### Step 8：迁移生产默认路径

- Web 请求只创建或控制 AgentRun。
- Worker 领取 lease 并执行，SSE 从持久 cursor 获取事件（Postgres LISTEN/NOTIFY 或短轮询；Redis 仅在证明不够时作为可选加速项）。
- 管理员和单个批准 Package 先灰度，再按组织扩大。
- 禁止 Sandbox 失败后回退 in-process。

完成标准：任务超过 60 秒不受 Web 请求限制；Worker 崩溃可恢复或明确失败；Web 扩容不依赖会话粘性；P50 冷启动（workspace 挂载 + Pi 进程启动 + 首个事件）满足聊天体验预算（建议 ≤3s，以镜像预拉取缓解；warm pool 正式化留 Step 9）。

### Step 9：长会话与 Desktop

- 按产品需求增加 fork/clone、成本统计、idle suspend/resume 和 warm pool。
- Desktop 实现 Local Runtime/Sandbox adapter，复用相同 Protocol、Package bundle 和事件。

实施纪律：一次只跨一个 seam。Step 1 不改数据库，Step 2 不引入 RPC 也不引入 Redis（游标仅 Postgres），Step 3 不引入 Docker；每一步先通过 Runtime interface 契约测试，再替换调用方。

## 11. 第一条验收链路

```text
创建 AgentRun
→ 解析已批准的 Pi Package/MCP 服务
→ 启动 Sandbox + Runtime Worker + Pi RPC
→ 执行一个 MCP tool 和一个文件工具
→ SSE 展示消息和工具事件
→ 导出一个 Artifact
→ 正常完成或 abort 后回收 Sandbox
```

必须同时满足：

- Sandbox 看不到平台密钥。
- 不能读取其他 Chat 的 workspace。
- 不能访问未授权网络。
- Runtime 崩溃不会让命令落到宿主执行。
- 审计包含用户、AgentRun、Package hash、工具、Artifact 和资源用量。

## 12. 待拍板决策

1. **部署形态**（与 skill 安全方案 §9 合并决策）：自托管 K8s / 单机容器编排 / 云容器服务。决定 `SandboxProvider` 首选底座与 Step 8 运维形态，阻塞 Step 5 之后的承诺。
2. **Inference Proxy / Tool Gateway MVP 形态确认**：§7.2 的"HTTP 反向代理 + AgentRun 级短期 token + 复用管理端 RBAC"是否作为首版；Tool Gateway 是否可延后（首版只有 Inference Proxy + Artifact Gateway）。
3. **无头可用性档位**：审批流按归档 v1.7 附录 A.1 的三级（全可用 / 部分可用 / 不可用）标注，"不可用"档是否直接拒绝进入 Registry。

## 13. 官方依据与关联文档

- [Pi Packages](https://pi.dev/docs/latest/packages)
- [Pi SDK](https://pi.dev/docs/latest/sdk)
- [Pi RPC](https://pi.dev/docs/latest/rpc)
- [Pi RPC Commands](https://pi.dev/docs/latest/rpc-commands)
- [Run Pi safely](https://pi.dev/docs/latest/security)
- [Run Pi in an isolated environment](https://pi.dev/docs/latest/containerization)
- [Pi Package Catalog](https://pi.dev/packages)
- [v1.x 调研报告归档（证据库）](archive/pi-plugin-research-v1.7.md)
- [skill 安全执行方案](security/skill-execution-security-plan.md)——沙箱治理细节（依赖预构建、命令 AST 门控、网络策略 schema、密钥占位符）；其 `RemoteSandboxEnv` 接入点已被本文取代
- [模型供应商插件架构](model-provider-plugin-architecture.md)——插件契约与安装链路；运行时收敛见本文 §7.2
