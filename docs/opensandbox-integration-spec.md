# OpenSandbox 接入与 Runtime Sandbox 升级 Spec

> 状态：**规划稿 v1.5**（2026-10-03）。本文是 [Pi Package 与 Runtime 架构](pi-plugin-support-research.md)（v2.0）Step 5「接入 SandboxProvider」的具体化，并吸收外部参考文章的分层建议（见 §3）。**Phase 0–4 完整落地；Phase 5 MVP 落地（路由矩阵 + 冷启动达标；Package 灰度/资源审计/Worker 化等后续完善，见 §6 Phase 5 未落地清单）**（进度见 §6；接口契约 §7 为落地版）；现状以 [项目架构](architecture.md) 与代码为准。
> v1.5 修订：Phase 5 MVP——`RoutingRuntimeBackend` 路由矩阵（执行工具 → 沙箱、纯对话 in-process 并存非降级、逐 run 落 AgentRun.backend 实际执行位、fail-closed 不回落）+ `PIWORK_SANDBOX_ROUTING=matrix|all` 装配 + docker 档冷启动实测 P50 490ms（≤3s 达标）；未落地项逐条声明（§6 Phase 5）。
> v1.4 修订：Phase 4 完成——`lib/runtime/inference-proxy/`（pi-messages wire 代理 + RunTokenRegistry + models.json 生成）与 egress 派生/审计落地，§11 D-3 定案为 **pi-messages 协议代理**（非 openai-compatible）；docker 档 allowlist 实测修正：`--internal` 网桥连宿主网关都不可达（会掐断代理通道），改为每沙箱独立非 internal 网桥 + `--add-host host-gateway` + `--dns 127.0.0.1`，raw-IP 直连残余缺口如实声明（§6 Phase 4、§8）。
> v1.3 修订：Phase 3 完成——`OpenSandboxProvider` + PTY pipe 通道落地（`lib/runtime/sandbox/opensandbox/`），§6 Phase 3 落地条目、§7 组装段、§9 gated 契约、§11 D-2 实现级修正（二进制 exec 帧、`exit_code` snake_case、`OPEN-SANDBOX-API-KEY` header 名）。
> v1.2 修订：Phase 0 spike 完成——§5.1 新增实测审计结论（rootfs/直连 IP/横向暴露/snapshot 供应链 + 两项计划外发现），§11 D-2 定案、D-1/D-4 补输入。
> v1.1 修订：按「最大化复用 Pi 官方能力 + 显式解耦缝」重写 §4/§6/§7——`SandboxRpcBackend` 从「泛化重写」改为「官方 `RpcClient` + `cliPath` 注入 bridge shim」（依据 `rpc-client.js` spawn 实测核对，§4.2）；支线 E 补充官方 extension 形态；接口契约增加 `SandboxChannel` 解耦缝。
> 关联：[skill 执行安全方案](security/skill-execution-security-plan.md)（治理细则）、[Pi Durable 评估](pi-durable-evaluation.md)（支线 E 的前置裁决）、[平台演进架构](platform-runtime-roadmap.md)（整体分期）。

## 1. 背景与目标

平台要在聊天链路里执行不可信代码（skill 脚本、第三方 Package、MCP 服务进程），当前生产路径 InProcessBackend 将这些代码跑在 Next.js 进程内，无隔离。v2.0 已裁决目标态：**完整 Pi 进程进 Sandbox**（v2.0 称 `SandboxRpcBackend`；本 spec 落为 `RpcProcessBackend` 的 spawn 策略 B，§4.2），开发与 MVP 用 plain Docker，生产 `SandboxProvider` 适配企业级底座。本文完成两件事：

1. **选型审计更新**：skill 安全方案 §8.2 对 OpenSandbox 挂起的「隔离底座待审」项，依据 2026-10-02 核对的官方文档给出结论（§5）。
2. **升级方案**：给出从当前代码到「OpenSandbox 上跑完整 Pi 进程」的分阶段路径、接口契约、安全映射与验收标准（§6–§10）。

不在本文范围：Package 制品流水线（v2.0 Step 6，独立模块）、Durable 主链路迁移（受 [pi-durable-evaluation.md](pi-durable-evaluation.md) §4 触发条件约束）、Desktop Local Runtime（Step 9）。

## 2. 现状基线（2026-10-02 代码核对）

| 项 | 现状 | 位置 |
| --- | --- | --- |
| Runtime 契约 | `RuntimeBackend/RuntimeSession/RuntimeSpec/RuntimeCommand/RuntimeEvent` 已定义 | `lib/runtime/protocol/`（对应 v2.0 Step 1 ✅） |
| 生产 backend | `InProcessBackend` 包装 `createPiworkAgentSession()`，bash/read/write/edit 为 **pi-coding-agent 内建工具**（`agent-session.ts` 的 `noTools: "builtin"` 开关控制），跑在 Next.js 进程 | `lib/runtime/backends/in-process/backend.ts` |
| RPC 原型 | `LocalRpcBackend`（官方 `RpcClient` spawn 本机 pi 子进程），已过契约测试，**未接入生产组装**（对应 v2.0 Step 3 原型 ✅） | `lib/runtime/backends/local-rpc/` |
| Durable 原型 | `DurableBackend`（Harness + MemoryStorage），`PIWORK_RUNTIME_BACKEND=durable` 实验开关；已知差口：deliver_file 归档、执行工具沙箱、MCP/Skill 装配 | `lib/runtime/backends/durable/` |
| AgentRun/事件持久化 | `RunManager` + Postgres AgentRunStore/EventStore 已有（Step 2 大体 ✅，cursor 恢复语义待按 Step 2 完成标准复核） | `lib/runtime/run/` |
| ExecutionEnv 接口 | 存在于 `@earendil-works/pi-durable@0.99.2`（`dist/env/index.d.ts`，`extends FileSystem, Shell`）；**`@earendil-works/pi-agent-core@1.0.0` 无此概念**。当前仅 `lib/ai/skills.ts` 用 `NodeExecutionEnv`（`pi-durable/env/node`）做 skill 管线读写 | 见左 |
| bridge Package | 未做（Step 4 ❌）：InProcess 直接持 `registerGeneratedFile` 回调；LocalRpc/Durable 同样未接 deliver_file 归档 | `lib/runtime/backends/*/` |
| SandboxProvider | 不存在（Step 5 ❌，本文主体） | — |
| skill 安全方案 §8.1 Phase 0 清单 | 引用的 `createExecutionTools`（`agent-tools.ts:74`）在当前代码**不存在**，该清单需按 §2 现状重写落点 | `docs/security/skill-execution-security-plan.md` |

## 3. 对参考文章的对齐与分歧

参考文章（外部 LLM 生成的分析，主张「piwork Web → Pi Durable → ExecutionEnv → OpenSandbox」分层收敛）。逐条裁决：

**吸收 3 项：**

1. **三层职责分离**：「Agent Harness 管任务做到哪、沙箱管代码在哪安全执行、piwork 管企业产品层」的分层模型与 v2.0 三平面（Control/Runtime/Sandbox）一致，作为本文叙述框架。
2. **不重复造 Sandbox Runtime**：OpenSandbox 已提供生命周期（create/pause/resume/renew/delete）、shell/文件/PTY、egress 控制、资源限制与多种运行后端，piwork 只做 `SandboxProvider` 适配，不自研沙箱控制面。
3. **对实验 API 包一层**：文章建议的「不让业务代码直接依赖 Pi Durable API」与 DurableBackend 现状一致（`RuntimeBackend` 协议隔离），同样原则适用于 OpenSandbox SDK（§7 接口契约）。

**修正 3 项（依据本地源码与官方文档，非推测）：**

1. **「Pi Durable 是 Harness 层」不能推出「主链路切 Durable」**。项目已裁决（[pi-durable-evaluation.md](pi-durable-evaluation.md) §4）：pi-durable 0.99.2 实验期 API、MCP/Skill/模型插件/deliver_file 均无对应物，现阶段不替换主链路。**Sandbox 接入与 backend 选择正交**：`SandboxProvider` 服务于 RPC 族 backend，主链路切换与 Durable 采用各自按既有评估推进。
2. **`OpenSandboxExecutionEnv` 插不进主链路**。ExecutionEnv 是 pi-durable 的接口（0.99.2 `env/index.d.ts` 核实）；主链路 pi-coding-agent 的执行工具是内建工具，pi-agent-core 1.0.0 无 ExecutionEnv 概念。且 Pi 官方 containerization 页明确：仅路由执行工具（Gondolin 形态）是**更窄的隔离**——「other extension tools still run on the host unless they also delegate their work」，且 VM 内命令继承宿主环境变量。因此工具级路由只保留为支线 E（DurableBackend 实验，§6.6），不作为生产目标态。
3. **文章的 Pi Durable 恢复叙事忽略差口**：DurableBackend 现为 MemoryStorage、无 MCP/Skill/归档；「服务重启 → resume() → 重新绑定 Sandbox 继续」依赖 Postgres 存储与平台工具桥先补齐（评估文档 P3 前置）。

## 4. 目标架构：复用与解耦

### 4.1 分层与三条解耦缝

架构按「Pi 知识」和「沙箱知识」两个变化轴解耦，各自收敛、单向依赖（`protocol ← backends ← sandbox`，反向 import 禁止）：

```text
┌───────────────────────────────────────────────────────────┐
│ piwork Web 控制面（不变）                                   │
│ Chat / Skill / Package 治理 / 模型插件 / 审计 / RBAC        │
└──────────────┬────────────────────────────────────────────┘
               │ 缝 1（已有）：RuntimeBackend 协议
               │   lib/runtime/protocol —— 控制面唯一依赖
               ▼
┌───────────────────────────────────────────────────────────┐
│ Backend 层（Pi 知识收敛点）                                 │
│  ├ InProcessBackend      AgentSession SDK（现状，纯对话）   │
│  ├ RpcProcessBackend     官方 RpcClient（本模块，§4.2）     │
│  │    ├ spawn 策略 A：本机 spawn（= 现 LocalRpcBackend）    │
│  │    └ spawn 策略 B：cliPath → bridge shim → 沙箱内 pi     │
│  └ DurableBackend        实验支线（不换主链路）              │
└──────────────┬────────────────────────────────────────────┘
               │ 缝 2（本模块新增）：SandboxChannel
               │   双工字节流 —— backend 只见「一条到沙箱内
               │   命令的管道」，不见 PTY/exec/endpoint 细节
               ▼
┌───────────────────────────────────────────────────────────┐
│ Sandbox 层（沙箱知识收敛点，Pi 无关）                       │
│  SandboxProvider 接口（§7）                                │
│   ├ TestSandboxProvider    内存替身（契约测试）             │
│   ├ DockerSandboxProvider  开发/CI 底座                    │
│   └ OpenSandboxProvider    生产底座（SDK 隔离在此目录内）   │
└──────────────┬────────────────────────────────────────────┘
               │ 缝 3（平台侧）：OpenSandbox lifecycle/exec API
               ▼
┌───────────────────────────────────────────────────────────┐
│ OpenSandbox：lifecycle server + execd + egress sidecar     │
│ Docker / K8s 容器(+gVisor/Kata) / FastSandbox(microVM)    │
│   沙箱内：完整 pi 进程（官方 bundle 原样）+ 只读 Package     │
│   挂载 + 仅 workspace 可写 + NodeExecutionEnv 本地执行      │
└───────────────────────────────────────────────────────────┘
```

**替换矩阵**（解耦的验收口径）：

| 变化 | 只动哪里 | 不动哪里 |
| --- | --- | --- |
| 换沙箱底座（Docker↔OpenSandbox↔未来 Desktop local） | provider 实现 | backend、协议、前端、事件流 |
| 换 Pi 接入形态（in-process↔RPC↔durable） | backend 实现 | provider、协议、前端、事件流 |
| OpenSandbox SDK 升级/换版本 | `lib/runtime/sandbox/opensandbox/` | 其余全部 |
| Pi 主包升级 | backend 装配 + 沙箱镜像 | provider、协议、前端 |

### 4.2 Pi 能力复用清单（零 fork 原则）

对 Pi 只做**装配和注入**，不改源码、不 monkey-patch、不并行重实现：

| Pi 官方能力 | 复用方式 | 核对依据 |
| --- | --- | --- |
| `RpcClient`（pi-coding-agent 1.0.0） | 进程控制全量 API 原样使用：`prompt/steer/followUp/abort/clearQueue/getState/compact/getEntries/getMessages`；LocalRpc 与沙箱模式**同一客户端**，只差 spawn 策略 | `dist/modes/rpc/rpc-client.d.ts`（全 API 面）；LocalRpcBackend 已在用 |
| `RpcClient.bash()` / `abortBash()` | 控制面在 agent 环境（沙箱模式即沙箱内）执行命令的**官方通道**：健康检查、workspace 预热、产物导出，不自建旁路 | 同上 `:161-165` |
| stdin/stdout JSONL RPC 协议 | 传输协议不变；bridge shim 只做**透明字节转发**，不解析不改写 | `rpc-client.js:42-77`（spawn + `attachJsonlLineReader` 严格分行） |
| spawn 注入点 `cliPath` | 官方 options 字段，指向我们的 bridge shim（node 可执行脚本）——这是官方客户端给出的**唯一且足够**的扩展缝 | `rpc-client.js:31,42`（硬编码 `spawn("node", [cliPath, ...args])`——shim 必须是 node 脚本，属官方既定边界，Pi 升级时以回归测试覆盖） |
| `SessionManager`（v3 JSONL） | 会话 seeding（`--session` 绝对路径 + appendMessage）沿用 LocalRpc 现实现，落盘进 workspace 卷 | `local-rpc/spawn.ts:46-57` 已在用 |
| `--extension` / `PI_OFFLINE` / `--no-builtin-tools` | 沙箱内装配与收紧：Package/bridge 经 `--extension` 挂载，离线安装禁令与工具开关同现状 | `local-rpc/spawn.ts:73-98` 已在用 |
| 内建 bash/read/write/edit + skills + MCP | 沙箱内原样运行——平台不重做任何工具语义，`noTools: "builtin"` 路由逻辑复用 | `agent-session.ts:140`；InProcess 同源 |
| Extension 机制（工具路由形态） | 过渡期工具级隔离走**官方 extension**（Gondolin/pi-extension-opensandbox 同款形态），不自造工具替换层 | 官方 containerization 页对 Gondolin 的定位（§3 修正 2） |
| Docker Sandboxes 凭据代理模式 | Inference Proxy 的官方先例——**复用模式不复用工具**（sbx 是交互 CLI，非可嵌入基础设施） | v2.0 §7.2 已定；官方页 "Provider credentials remain on the host and substituted by the proxy" |

**本模块自建清单**（Pi/OpenSandbox 都不提供、且属于平台职责）：`SandboxProvider` 三实现与 `SandboxChannel`、bridge shim（约百行透明泵）、RuntimeSpec→SandboxSpec 策略派生（纯函数）、Artifact Gateway（deliver_file 出站）、Inference Proxy（凭据通道）、审计。

### 4.3 RpcProcessBackend 的进程拓扑（复用的落点）

```text
Next.js 进程（控制面）                     沙箱（OpenSandbox/Docker）
┌──────────────────────┐                 ┌──────────────────────────┐
│ RunManager           │                 │ workspace 卷（唯一可写）   │
│  └ RpcProcessBackend │                 │  └ session.jsonl（seed）  │
│     └ 官方 RpcClient │                 │ 只读 Package/镜像层       │
│        spawn("node", │                 │  └ pi bundle（官方原样）  │
│         [shim, ...]) │── 缝2: 字节流 ─▶│ pi --mode rpc            │
│  SessionManager seed │   (PTY/exec/    │  ├ 内建执行工具           │
│  （本地落盘→putFile） │    endpoint，    │  ├ MCP/skills/extension  │
│                      │    provider 内部)│  └ NodeExecutionEnv      │
└──────────────────────┘                 └──────────────────────────┘
```

与参考文章分层图的差异：文章把 OpenSandbox 放在「Pi Durable 之下经 ExecutionEnv 调用」（工具级路由）；本方案生产态把**完整 Pi 进程放进 OpenSandbox**，ExecutionEnv（NodeExecutionEnv）在沙箱内本地运行——扩展、MCP 进程、skill 脚本随之全部入界，与官方「complete Pi process runs inside an isolated environment, its extensions run there too」一致。

## 5. OpenSandbox 选型审计（更新 skill 安全方案 §8.2 待审项）

2026-10-02 核对官方文档站（open-sandbox.ai）与 npm：

| 维度 | 核对结果 |
| --- | --- |
| 开发方/许可 | opensandbox-group（阿里系），Apache-2.0；SDK 维护者为 alibaba-inc 域名 |
| 组件 | lifecycle server（FastAPI，鉴权/SQLite或PostgreSQL/编排）、execd（Go，沙箱内）、egress sidecar、ingress（K8s 必需）、K8s 控制器（BatchSandbox/Pool/SandboxSnapshot CRD） |
| 运行后端 | `runtime.type: docker`（单机）；`kubernetes`（workload provider 为 batchesandbox / agent-sandbox）；FastSandbox（K8s 上 Firecracker microVM，gRPC FastPath，`fsb-` 前缀） |
| 隔离底座 | **容器档**：capability drop、AppArmor、seccomp、RuntimeClass（`[secure_runtime]` 支持 gVisor/Kata）——共享内核；**microVM 档**：FastSandbox/Firecracker、BatchSandbox QEMU 快照路径 |
| 生命周期 | create（image/snapshotId/templateId，异步需轮询）、pause/resume、renew expiration、delete；snapshot 可提交为 OCI 镜像；`access.renew.extend.seconds` 访问自动续期 |
| 能力 | 命令执行（SSE 流式/后台/持久 bash 会话）、PTY WebSocket、文件操作、Jupyter、资源限制（CPU/内存/GPU）、卷（host/pvc/ossfs） |
| 网络 | egress FQDN/通配符白名单，`dns` 与 `dns+nft` 模式，运行时 PATCH 策略；Credential Vault（TLS MITM 注入凭据——与 §7.2 Inference Proxy 模型冲突，见 §11 D-3） |
| SDK | JS/TS：`@alibaba-group/opensandbox@1.1.0`（2026-09-21，OpenAPI 生成 + 手写适配层）；另有 Python/Java/C#/Go/MCP |
| 部署 | 单机：`uvx opensandbox-server init-config ~/.sandbox.toml --example docker && uvx opensandbox-server`（需 Docker + Python 3.10+，本地 8080）；K8s：Helm umbrella chart，装序 base→controller→(fast-sandbox)→ingress-gateway→server；多副本仅 PostgreSQL+K8s 快照场景 |
| 鉴权 | 服务端默认拒绝无 API key 启动（`OPENSANDBOX_SERVER_API_KEY`）；沙箱访问另有 secureAccess/X-EXECD-ACCESS-TOKEN |

**结论**：skill 安全方案 §8.2 的「隔离底座待审」可以关闭——底层隔离技术现已明确，且分档可选：开发/CI 用 Docker 单机；生产按部署形态决策选 K8s 容器（+gVisor/Kata）或 FastSandbox microVM。「容器共享内核不宜作唯一防线」（skill 方案 §4.1）通过 `[secure_runtime]` 或 FastSandbox 满足。

### 5.1 Phase 0 实测审计结论（2026-10-02，本机 colima + 源码版 server + SDK 1.1.0）

三项遗留审计项 + 两项计划外发现（spike 于 `/tmp` 一次性运行，结果记录于此；复跑要点见 §6 Phase 0）：

| 审计项 | 实测结论 | 影响 |
| --- | --- | --- |
| Docker 档 read-only rootfs | **默认不是**：`mount` 显示 overlay rw，`touch /` 成功（rc=0）。docker runtime 不设 `ReadOnlyRootfs` | provider 必须自己强制：Docker provider 建 `HostConfig.ReadonlyRootfs=true` + workspace 卷可写 + tmpfs；OpenSandbox 档不能依赖其默认 |
| execd 横向暴露面 | `docker.publish_host` 默认 `0.0.0.0`，每个沙箱的 execd(44772)/HTTP(8080) 发布在宿主所有接口；未请求 `secureAccess` 时 execd **无鉴权** | 生产部署必须 `publish_host=127.0.0.1`（或内网 IP）+ 创建时 `secureAccess=true`；开发单机可接受 |
| snapshot 供应链校验 | **无**：docker runtime 的 snapshot = `docker commit` 到本地镜像 `opensandbox-snapshots:<id>`（`snapshot_runtime.py`），无 digest 固定/签名/内容校验；K8s 档发布为 OCI 镜像，校验也属外部职责 | snapshot 产物一律当不可信镜像对待（平台侧自行 digest pin + 准入）；MVP 不使用 snapshot |
| （计划外）egress 直连 IP 逃逸 | `networkPolicy={defaultAction:deny}` + 服务端 `mode="dns+nft"` 下：**DNS 层拒绝有效**（deny 域名返回 NXDOMAIN，allow 域名解析合成地址后可连通）；但**直连 IP `1.1.1.1:80` 完整数据面流出**（收到真实 `HTTP/1.1 301`）；:443 直连被丢弃。`dns` 模式更弱（仅域名路径） | OpenSandbox docker 档 egress 是**域名级过滤**，不是网络级 deny-all。平台 deny-all 语义必须由 provider 网络隔离兜底（Docker internal network / `--network none`；生产 K8s 用 NetworkPolicy）。§8 安全映射据此加一行 |
| （计划外）无 policy 时零强制 | create 不带 `networkPolicy` 就**不挂 egress sidecar**，沙箱完全桥接直出（实测直连/域名全通） | egress 策略是 opt-in；`SandboxSpec.egress` 必须总是显式下发（deny-all 也下发），不能依赖服务端默认 |

**判读方法论坑（记录防重蹈）**：本机宿主运行 Clash Verge（mihomo TUN + fake-IP，`198.18.0.0/15`/`fdfe:dcba:9876::`），宿主所有 DNS（含 `dig @1.1.1.1`）都返回 fake-IP——首轮 spike 曾把宿主 fake-IP 误判为 OpenSandbox「DNS 陷阱」。沙箱内 DNS 结论必须以「带 policy 的沙箱 + 对照 denied/allowed 域名」为准，不能拿无 policy 沙箱的解析结果下结论。

**部署运维实测（开发档，colima）**：PyPI `opensandbox-server` 1.1.0 wheel 缺 `fast_sandbox/generated` protobuf 桩，`uvx` 不可用——从 GitHub 源码 `uv run` 启动；colima 需 `DOCKER_HOST=unix://$HOME/.colima/default/docker.sock`（Python docker SDK 找不到默认 socket）；VM resolv.conf 曾为悬空符号链接导致镜像拉取 DNS 走 `[::1]:53`，VM 内写静态 resolv.conf 修复；macOS 宿主无法路由 VM bridge IP，需 `[proxy] resolve_internal=false` 走 host-mapped 端口。SDK 侧：`SandboxInfo.expiresAt`（非 expiration）、`status.state`（非 state）；create `timeoutSeconds` 服务端最小 60s；文件 `mode` 是「八进制数字字面」约定（`755` 而非 `0o755`）；首次运行先预拉 `ubuntu:24.04`/`opensandbox/execd:v1.1.0`/`opensandbox/egress:v1.1.7`（默认 30s create 超时会输给拉取耗时）。

## 6. 分阶段升级方案

实施纪律沿用 v2.0 §10：一次只跨一个 seam，每阶段先过契约测试再替换调用方。

> 进度（2026-10-02）：Phase 0 ✅（spike 全链路实测 + 三项遗留审计项与两项计划外发现已裁决，§5.1）；Phase 1 ✅（seam + TestSandboxProvider + 契约套件 + DB/registry/leasing + 沙箱管理页）；Phase 2 ✅ 全部完成标准达成（SandboxRpcBackend 策略 B + DockerSandboxProvider（契约套件 10/10，含 rootfs 只读/断网/路径遏制/匿名卷）+ Artifact Gateway（deliver_file 出站）+ RunManager 装配开关 + pi-runtime 镜像 + Docker provider 上的 RPC 契约同套件通过（gated），见 §7 落地版）。

### Phase 0：审计 spike 与部署形态输入（无生产代码）✅（2026-10-02）

- 本地 Docker 单机（colima）源码版 server + `@alibaba-group/opensandbox` 1.1.0 spike：create（~0.5-1s，镜像预拉取后）→ exec（SSE 流式）→ files（中文 9B write/read 往返）→ renew（`expiresAt` 后移）→ pause/resume（`status.state` Paused→Running）→ delete；TTL 60s（服务端最小值）到期后 `getInfo` 返回 `DOCKER::SANDBOX_NOT_FOUND`。审计结论见 §5.1。
- **D-2 实测（RPC 双向流通道）**：一次性 `commands.run` **无 stdin**，不可承载 RPC；execd PTY **pipe 模式 WS**（`POST /pty {cwd}` → `ws /pty/<sid>/ws?pty=0`，二进制帧 `0x00`stdin/`0x01`stdout/`0x02`stderr，文本 JSON 帧 `{"type":"exit",...}`/`{"type":"signal",...}`）经 server 的 `/sandboxes/{id}/proxy/{port}/...` WS 代理（时以为 `X-API-Key` 鉴权——Phase 3 核对 `middleware/auth.py` 实为 `OPEN-SANDBOX-API-KEY`，且单租户 proxy 路径豁免鉴权，spike 之所以「能用」是被忽略而非通过校验）**字节级保真**：分三段发送的 223B JSONL（含中文）回显完全一致，exit 帧可观测。PTY 会话本身是 shell——以首行 stdin `exec node <cli> --mode rpc` 替换为 pi 进程。**结论：OpenSandboxProvider 的 `SandboxChannel` 用 pipe 模式 PTY WS 实现（§11 D-2 定案）**。
- 部署形态输入（§11 D-1）：Docker 单机档全生命周期可用（含 pause/resume、egress sidecar、proxy），但 rootfs/直连 IP/横向暴露三项（§5.1）都要平台侧自管——单机 Docker 档定位为开发/CI；生产档位仍按 D-1 在 K8s(+secure_runtime) 与 FastSandbox 间决策，spike 未覆盖该两项。
- 运维坑与复跑要点：见 §5.1 部署运维实测段。

完成标准：spike 记录覆盖上表「遗留审计项」三项 + D-2 有实测结论 —— **已满足**。

### Phase 1：SandboxProvider seam（纯接口，无 Docker 依赖）

- 新建 `lib/runtime/sandbox/`：`SandboxProvider`/`SandboxHandle`/`SandboxSpec` 接口（§7）+ `TestSandboxProvider`（内存替身）。
- RunManager 组装点接受 provider 注入，默认 `null`（行为不变）。
- 契约测试进 `tests/unit/runtime/sandbox/`。

完成标准：现有全部测试不变绿转绿；Test provider 过契约套件。

### Phase 2：DockerSandboxProvider（开发/CI 底座，v2.0 Step 5 前半）✅（2026-10-02）

- ~~直接用 Docker Engine API（或复用 OpenSandbox `runtime.type: docker`，二选一见 §11 D-4）起 plain 容器~~ **已落地（docker CLI 直连，D-4 裁决）**：`lib/runtime/sandbox/docker/provider.ts`——安全基线全部 provider 自持（§5.1 结论）：`--read-only` rootfs + `--tmpfs /tmp` + `--cap-drop ALL` + `no-new-privileges` + `--pids-limit` + CPU/内存限额 + deny-all 断网（`--network none`）；workspace 为空/ephemeral source 时挂**匿名卷**（named volume 会跨 chat 共享，违反隔离基线）；startProcess/writeFile/readFile 全走 `docker exec`（argv 直传无 shell 引用问题，dd/cat/busybox 兼容）；契约套件 `tests/unit/runtime/sandbox/docker-provider.test.ts` 10/10（colima 实测）。已知边界：docker 无原生 TTL，renew 仅 registry 记账，回收靠 release/管理页。
- `RpcProcessBackend` 落地（§4.3）：**不重写客户端**——现 `LocalRpcBackend` 保持「官方 RpcClient + spawn 策略 A（本机）」，`SandboxRpcBackend` 策略 B（`lib/runtime/backends/sandbox-rpc/`，已落地）：`cliPath` 指向 bridge shim，shim 经 UDS 泵连 `SandboxChannel`，在容器内起官方 pi `--mode rpc`。seeding 仍走官方 `SessionManager` 本地落盘 + `writeFile` 进 workspace。先在 Test/Docker provider 上打通；fail-closed（§7.3）。
- bridge shim 首版（已落地，`lib/runtime/sandbox/bridge/`）：stdin↔UDS↔channel↔stdout 透明泵，带断线/EOF 传播；不解析 JSONL。实测要点见 §7（allowHalfOpen、endInput、remoteCliPath 必填）。
- ~~此阶段同步落 v2.0 Step 4 最小件：`deliver_file` 改经 Artifact Gateway（沙箱内无法直呼控制面回调）~~ **已落地**：沙箱侧 extension（`deliver-file-extension.ts` 源码物化进 workspace，纯 JSON Schema 参数 + node 内建依赖，零 node_modules 解析）落 outbox manifest（`result.details.manifest` 随官方 `tool_execution_end` 事件流出）；宿主侧 `artifact-gateway.ts` 订阅 `client.onEvent` 收割 → `storeFile` 出站 → `registerGeneratedFile` 归档 → `artifact.created` 入事件流。幂等（manifest id 去重）、坏输入容忍（交付 best-effort 不击穿 run）、close 顺序契约（flush 在 `super.close` 的 queue.end 之前、沙箱 release 之前）。
- **RunManager 装配（已落地）**：`PIWORK_SANDBOX_PROVIDER=docker`（+ `PIWORK_SANDBOX_CLI_PATH` 必填、`PIWORK_SANDBOX_IMAGE`/`PIWORK_SANDBOX_TTL_SECONDS` 可选）→ `LeasingSandboxProvider(DockerSandboxProvider, dbSandboxRegistry)` + SandboxRpcBackend；AgentRun 落库 `backend: "sandbox_rpc"`。未设置 = in-process 行为不变；未知取值/缺 CLI 路径启动即抛错（fail-closed 不回退）。与 `PIWORK_RUNTIME_BACKEND=durable` 互斥。
- **pi-runtime 镜像（已落地，Step 6 首版，`docker/pi-runtime/Dockerfile`）**：node:22-alpine + 完整安装 `@earendil-works/pi-coding-agent@1.0.0`（`npm install --prefix /opt/pi`，依赖纯 JS/WASM 无 native addon，musl 可用）+ 非 root `pi` 用户 + 预建 `/workspace`；容器内 cli 路径即 `PIWORK_SANDBOX_CLI_PATH` 默认值。构建期断言 node >=22.19（pi engines）。受限网络构建：基础镜像走 `docker.m.daocloud.io` 镜像源、npm 走 `--build-arg NPM_REGISTRY=https://registry.npmmirror.com`（见 development.md）。
- **Docker provider 上的 RPC 契约（已落地，gated）**：`PIWORK_SANDBOX_DOCKER_RPC_TESTS=1` 时 `backends.test.ts` 追加 `SandboxDocker` harness，与 LocalRpc/SandboxRpc 同套件跑真实容器底座（官方 RpcClient → UDS bridge → docker exec 管道 → 容器内完整 pi），2026-10-02 colima 实测 7/7 非 skip 用例通过（冷启动含容器创建约 0.6-2.1s/用例）。faux 扩展经 esbuild 打成自包含 .mjs 预写进 bind-mount workspace（容器内无仓库 node_modules；官方 jiti loader 对 ESM 默认导出函数即扩展工厂），与 LocalRpc 共用同一份 `tests/support/faux-provider-extension.ts`，保证两条链路行为一致仅分发方式不同。

完成标准：v2.0 Step 5 验收——跨 workspace、读平台 env、未授权网络、资源耗尽均被阻止（provider 契约套件覆盖 rootfs/断网/遏制；平台 env 不透传为拓扑保证）；RPC 契约测试在 Docker provider 上通过（与 LocalRpc 同套件，gated harness 7/7）；沙箱不可用时明确失败、无静默回退（契约已测）——**已全部满足（2026-10-02）**。

### Phase 3：OpenSandboxProvider（生产底座，v2.0 Step 5 后半）✅（2026-10-02）

- ~~用 `@alibaba-group/opensandbox` 实现同接口~~ **已落地（`lib/runtime/sandbox/opensandbox/`，SDK 只在该目录 import）**：`provider.ts`（`ManagedSandbox` 结构子集 + factory/openChannel 注入缝供离线单测；create 透传 metadata/`networkPolicy`（deny-all 也显式下发）/`resource{cpu,memory}`（server 键名，container_ops.py）/`timeoutSeconds`=spec.ttlSeconds；state 映射 Creating|Resuming→creating、Running→ready、Pausing|Paused→paused、Error/未知→degraded、Deleting|Deleted→destroyed；destroy 后 destroyedStatus 本地终态（SDK `close()` 已释放传输无法再查）；kill 遇 NotFound 幂等达成）+ `pty-channel.ts`（§11 D-2 传输，launcher 哨兵门控）。TTL 续期经 leasing 层调 `handle.renew()`（server 原生 `renew(timeoutSeconds)`）；到期销毁 = server 原生 TTL（§5.1 实测 NOT_FOUND → status 映射 destroyed，单测覆盖）。
- 生命周期映射：chat 级复用（lease 粒度，`LeasingSandboxProvider` 不变）、失败分类全量 `SandboxUnavailableError`（fail-closed，§7.3）。
- 生产形态：`OPENSANDBOX_DOMAIN`/`OPENSANDBOX_API_KEY` 走环境注入（部署时由平台密钥存储落 env，不进 RuntimeSpec 明文），缺任一启动即抛错。
- 测试：离线单测 `tests/unit/runtime/sandbox/opensandbox-provider.test.ts` 21 用例（launcher 生成/帧解析/policy/state 映射/acquire 全参/fail-closed/attach/status/writeFile 逐层/PTY 通道全握手）；真实 server 契约 gated 复验（§9）**12/12 通过**（本机 colima + 源码版 server 1.1.0，含双向通信、exit 传播、路径遏制、renew、destroy fail-closed）。
- 实现级修正（live 契约跑发现，§11 D-2 同步）：exec 启动行必须走**二进制 0x00 帧**（文本帧只承载 JSON 控制消息，非 JSON 被 server 静默丢弃）；exit 帧 code 字段为 **`exit_code`**（snake_case，`model/pty_ws.go`）；proxy 鉴权 header 名为 **`OPEN-SANDBOX-API-KEY`**（与 SDK 同名；单租户 proxy 路径豁免鉴权，故 spike 期的 `X-API-Key` 「能用」实为被忽略）。

完成标准：~~Phase 2 全部安全验收在 OpenSandboxProvider 上复验通过；TTL 续期与到期销毁有测试；provider 可配置切换且互不影响契约测试~~ **已达成**（同套契约 12/12；TTL 续期契约用例 + 到期 NotFound 映射单测；`PIWORK_SANDBOX_PROVIDER=docker|opensandbox` 可配置切换，默认套件零影响）。

### Phase 4：网络、凭据与审计（v2.0 Step 7）✅（2026-10-03）

- egress 默认拒绝 + FQDN 白名单（按 RuntimeSpec 生成，策略只能收紧）✅：`deriveSandboxEgress`（backend）——无 Inference Proxy 恒 deny-all；启用后 allowlist = 代理主机 ∪ 装配基线（`PIWORK_INFERENCE_EGRESS_ALLOWLIST`）∩ RuntimeSpec 申请（只收紧：超基线申请被丢弃）。docker 档实现含**实测修正**：`--internal` 网桥无默认路由、连宿主网关都不可达（会掐断代理通道）→ 改为每沙箱独立**非 internal** 网桥（结构上无跨沙箱横向）+ 白名单 FQDN `--add-host <fqdn>:host-gateway` + `--dns 127.0.0.1` 掐灭外部解析；**残余缺口（如实声明）**：raw-IP 直连外网在 docker 档未被硬断，真实 FQDN 级默认拒绝是 OpenSandbox egress sidecar / 生产 NetworkPolicy 职责（§8）。云 metadata/内网横向由「无默认外部路由 + dead DNS + 每沙箱独立网桥」阻断。
- Inference Proxy 上线（v2.0 §7.2；D-3 定案为 **pi-messages 协议代理**，非 openai-compatible）✅：`lib/runtime/inference-proxy/`——控制面旁路 HTTP 反代，讲 pi 官方 `pi-messages` wire 协议（单 POST `{model, context, options}` → SSE 事件流，pi-ai `dist/api/pi-messages.js` 核对）；沙箱内官方 pi 经 agentDir `models.json`（`api: "pi-messages"` + `apiKey: "${PIWORK_RUN_TOKEN}"` env 模板 + baseUrl 指代理）原生对接，无兼容层。凭据：`RunTokenRegistry` 按 AgentRun 签发窄权限 token（32B hex、仅存 sha256、滑动 30min TTL、grant 限定 provider/model），run close/acquire 失败即撤销（不留给过期兜底）；真实模型凭据只在控制面（模型插件 Worker host 经 `UpstreamResolver`），平台 env 不注入沙箱，沙箱内唯一凭据即 run token。
- 审计 ✅（范围收窄如实声明）：`InferenceAccessAudit`（迁移 `0015`，追加型、chatId 无外键——chat 删除后审计仍在、脱敏无 token/内容材料）落每次代理访问（allowed/denied/error + tokens/时长）；run/tool/command/artifact 审计沿用既有 RuntimeEvent 事件流与 Artifact Gateway；**资源用量审计未落地**（延后随 Phase 5 路由矩阵一起评估，OpenSandbox `/metrics` 为补充）。

完成标准（达成）：沙箱内读不到平台密钥（env 三层分离 + token 唯一凭据，装配专测断言）；未授权访问失败且留脱敏审计（401/403 均落审计行；docker 档 live 契约含 allowed/denied 对照）。

### Phase 5：路由矩阵与生产切换（v2.0 Step 8）✅ MVP（2026-10-03）

- **路由矩阵落地（MVP）✅**：`RoutingRuntimeBackend`（`lib/runtime/backends/routing/backend.ts`）逐 run 分流——`requiresSandbox(spec)` = 执行类工具开启（`workspaceDir` 非 null，即 bash 等非平台代码执行载体）→ SandboxRpc；纯对话 → in-process（并存非降级）；沙箱路由 open 失败原样上抛（fail-closed，绝不回落 in-process）。`RunManager.backendKindFor` 逐 run 解析，AgentRun.backend 落**实际执行位**（非装配位）。装配：`PIWORK_SANDBOX_ROUTING=matrix`（provider 设置时的默认）| `all`（全量沙箱，诊断形态）。
- **冷启动达标 ✅（实测，colima docker 档）**：open（容器创建 + workspace 挂载 + bridge + pi RPC 握手）P50 **490ms**（5 轮 479–590ms），远低于 3s 预算；镜像预拉取（`ensureImage` missing 即拉 + 运维侧预构建 pi-runtime）。
- **明确未落地（后续完善，如实声明）**：①平台闭包工具（技能工具、`create_scheduled_task`）不跨进程，Sandbox 路由的 run 丢失它们（v2.0 Step 4 bridge 方案解锁）；②Package/MCP 未进入 RuntimeSpec，仍走 in-process，管理员批准的单 Package 灰度未启动（沙箱侧打包搬运属后续阶段）；③资源用量审计（承 Phase 4 延后项）；④Worker 化生产切换（lease 领取 + LISTEN/NOTIFY 事件分发）——当前仍是单进程 RunManager（v2.0 §12 部署形态决策前不引入）；⑤§10 验收链路的 web 级 e2e（链路各段已由契约/装配/inference 测试分段覆盖，见 §9）。

完成标准（MVP 裁定）：路由矩阵 + fail-closed + 逐 run 落库 + P50 冷启动达标；§10 链路分段全绿。完整验收链路（web e2e + 资源审计）随未落地项推进。

### 支线 E：工具级路由（官方 extension 形态，过渡期缓解，不排期进主线）

两条子路径，都是官方机制、都不是生产终态（窄隔离裁决见 §3 修正 2）：

- **E1 主链路过渡（官方 extension 形态）**：写一个 pi extension factory（Gondolin/pi-extension-opensandbox 同款官方形态），把内建 bash/read/write/edit/ls/find/grep 路由进 OpenSandbox——在沙箱模式（spawn 策略 B）建成前，给含 skill 脚本的 run 提供下限隔离。边界必须明示：extension 自身、MCP 服务进程、未委托的其他 extension 工具仍在宿主进程；因此**不能**据此把 §8.1 路由矩阵里「含非平台代码」的 run 留在 in-process，矩阵判定不改。
- **E2 Durable 支线（ExecutionEnv 形态）**：实现 pi-durable `ExecutionEnv`（0.99.2 `env/index.d.ts`：`FileSystem + Shell`，`Result` 返回风格）的 OpenSandbox 远程版，挂 `DurableBackend` 补其「执行工具沙箱边界」差口；受 pi-durable 评估触发条件约束。
- 共同参考：`pi-extension-opensandbox@0.1.9`（社区包，routes 内建工具，fail-closed、TTL/2 续期）——Phase 0 审计其源码，判定「借鉴设计」还是「直接复用」（§11 D-4）。两条子路径共用其 OpenSandbox 集成层结论。

## 7. 接口契约（Phase 1/2 落地版，与 `lib/runtime/sandbox/index.ts` 同步）

```ts
// lib/runtime/sandbox/index.ts（已落地）—— Pi 无关层
interface SandboxSpec {
  runId: string;                 // AgentRun id，审计关联
  chatId: string;                // lease 粒度 = chat 级复用
  userId?: string;               // 审计/管理页归属；可省——dbSandboxRegistry 从
                                 // Chat 归属补全（RuntimeSpec 不携带 userId）
  image: string;                 // 预构建 Pi 运行时镜像（Step 6 产物，首版手写）
  workspaceVolume: { source: string };  // chat workspace 挂载，唯一可写区
  resource: { cpuCores: number; memoryMB: number };
  egress: { mode: "deny-all" } | { mode: "allowlist"; fqdns: string[] };
  ttlSeconds: number;            // 默认 3600；续期策略见 §6 Phase 3
  metadata?: Record<string, string>;   // 审计标识；opensandbox.io/ 前缀保留
}

/** 缝 2：双工字节流。backend 经它见「一条到沙箱内命令的管道」 */
interface SandboxChannel {
  write(chunk: Uint8Array): Promise<void>;
  read(): AsyncIterable<Uint8Array>;
  /** 对端写侧 EOF（RpcClient 进程退场）→ 转发为沙箱内 stdin EOF（非 kill）：
   *  官方 RpcClient.stop() 是 SIGTERM/SIGKILL 而非 stdin.end（rpc-client.js:89-98
   *  实测核对），故 EOF 即对端死亡，pi rpc 按官方 stdio 语义干净退出 */
  endInput(): Promise<void>;
  close(): Promise<void>;
  // 退出通知：EOF/非零退出/连接断开，backend 据此判进程死亡
  readonly onExit: Promise<{ code: number | null; signal: string | null }>;
}

interface SandboxHandle {
  readonly id: string;
  /** workspace 在沙箱内的绝对路径（startProcess cwd 与上传文件的 argv 引用基准） */
  readonly workspaceRoot: string;
  /** 在沙箱内启动长驻命令并返回其 IO 通道（RPC/PTY/endpoint 由 provider 内部决定）；
   *  env 为沙箱内覆盖项，基础 env 最小化（不继承宿主）由实现决定 */
  startProcess(command: { argv: string[]; cwd?: string; env?: Record<string, string> }): Promise<SandboxChannel>;
  writeFile(path: string, content: Uint8Array): Promise<void>;  // 仅 workspace 内；嵌套目录自动创建
  readFile(path: string): Promise<Uint8Array>;                  // 产物导出
  renew(): Promise<void>;
  status(): Promise<"creating" | "ready" | "paused" | "degraded" | "destroyed">;
  destroy(policy: "kill" | "pause" | "keep"): Promise<void>;
}

interface SandboxProvider {
  readonly name: "test" | "docker" | "opensandbox";
  acquire(spec: SandboxSpec): Promise<SandboxHandle>;   // chat 级复用走 lease
  /** 按 externalId 重连（chat 级复用下半程）；不存在/不可用抛 SandboxUnavailableError */
  attach(externalId: string): Promise<SandboxHandle>;
  release(handle: SandboxHandle, policy: "kill" | "pause" | "keep"): Promise<void>;
}
```

```ts
// lib/runtime/backends/sandbox-rpc/backend.ts（Phase 2 已落地）—— Pi 知识层
// SandboxRpcBackend 与 LocalRpcBackend 共用 LocalRpcRuntimeSession（事件规范化、
// 终态推导、watchdog 零改动），差异只在进程拓扑：
//   策略 A（本机）： cliPath = pi bundle cli.js            —— 现状不变
//   策略 B（沙箱）： cliPath = bridge shim（host 侧独立进程）
//     shim 源码内嵌字符串物化（Turbopack 路径改写免疫），从 env
//     PIWORK_SANDBOX_BRIDGE_SOCKET 连 UDS；UDS 服务端泵（bridge/pump.ts）持有
//     SandboxChannel，在沙箱内 startProcess(argv)（buildSandboxAgentArgv 镜像
//     rpc-client.js:29-39 的官方 spawn argv 顺序），字节双向透传 + 背压传导。
//     关键实测修正：UDS server 必须 allowHalfOpen——shim 的写侧 FIN 只代表
//     RpcClient 退场（→ endInput 转发 EOF），不得触发 net 默认的回 FIN 全关。
// seeding：官方 SessionManager 本地落盘 → writeFile 上传 workspace（--session
//     给沙箱内绝对路径；空历史不落盘合法）。agentDir 物化 .keep 后经
//     PI_CODING_AGENT_DIR 指过去。env 三层分离：RpcClient env = shim 定位；
//     沙箱内 env = 最小集 + agentDir + options.env；宿主 env 不透传。
// remoteCliPath 必填：官方分发形态是「已安装的完整包」——dist/bundle 运行时
//     仍从周边 node_modules 解析 jiti（TS 扩展装载器）等依赖，单拷 bundle 树
//     不是合法分发（2026-10-02 实测扩展装载即失败）。同机测试底座传
//     resolveDefaultCliPath()；容器底座由镜像预装完整 pi（P3 Step 6）。
```

- 组装（已落地，`lib/runtime/run/index.ts`）：`PIWORK_SANDBOX_PROVIDER=docker|opensandbox` 注入 `LeasingSandboxProvider(<provider>, dbSandboxRegistry)` + SandboxRpcBackend（`PIWORK_SANDBOX_CLI_PATH` 必填、`PIWORK_SANDBOX_IMAGE`/`PIWORK_SANDBOX_TTL_SECONDS` 可选）；`PIWORK_SANDBOX_ROUTING`（Phase 5）选执行形态：`matrix`（默认，路由矩阵）/`all`（全量沙箱）——matrix 下 AgentRun.backend 逐 run 落实际执行位；**opensandbox**（Phase 3 落地）另需 `OPENSANDBOX_DOMAIN`/`OPENSANDBOX_API_KEY` 必填（平台密钥存储落 env）、`OPENSANDBOX_PROTOCOL`（http|https）、`OPENSANDBOX_READY_TIMEOUT_SECONDS`/`OPENSANDBOX_EXECD_PORT` 可选；未设置默认 in-process 不变；未知取值或缺配置**启动即抛错**（fail-closed 不回退）；与 `PIWORK_RUNTIME_BACKEND=durable` 互斥。
- Inference Proxy 装配（Phase 4 落地，`buildInferenceOptions`）：`PIWORK_INFERENCE_URL`（**沙箱视角**可达地址，如 `http://host.docker.internal:3210`）显式启用，缺省 = deny-all 无模型通道（Phase 2/3 形态不变）；监听侧 `PIWORK_INFERENCE_PROXY_HOST`（默认 `0.0.0.0`——容器需可达，每请求都验 run token）、`PIWORK_INFERENCE_PROXY_PORT`（默认 3210）；egress 基线 `PIWORK_INFERENCE_EGRESS_ALLOWLIST`（逗号分隔 FQDN）。上游 = 模型插件 WorkerThread host（`getActivePiProviders`），真实凭据只在控制面；listen 失败 fail-closed（首个 run 的 mint 即抛，run failed）；HMR 下监听 promise 挂 globalThis 复用。backend 侧 `SandboxInferenceOptions = { proxyUrl, baselineFqdns?, mintRunToken, revokeRunTokens }`：mint 先于 acquire（token 泄漏闭环——acquire 失败即撤销已签发 token）；agentDir 物化 `models.json`（`api: "pi-messages"`、`apiKey: "${PIWORK_RUN_TOKEN}"` env 模板、baseUrl = proxyUrl、模型条目按 grant 收窄），沙箱内 env 注入 `PIWORK_RUN_TOKEN`；egress 经 `deriveSandboxEgress` 派生（见 Phase 4 条目，只收紧）。
- SDK 隔离：业务代码只依赖上述接口；`@alibaba-group/opensandbox` 仅在 `lib/runtime/sandbox/opensandbox/` 内部 import（沿用模型插件 WorkerThread host 的边界先例）；bridge shim 同理只 import 该目录的 connector。
- `SandboxChannel` 的 PTY 字节保真（\r\n/echo 污染 JSONL）是 provider 内部职责，Phase 0 实测（D-2）；对 backend 与 shim 保密。

### fail-closed 语义（§7.3，与 v2.0 §8.1 一致）

- provider 创建/连接失败：该 run 立即 `failed`，错误明示「沙箱不可用」，**绝不**回退 in-process 执行第三方代码。
- 运行中沙箱故障：该沙箱内本应执行的命令一律拒绝（不弹「本机执行」绕行口）。
- TTL 到期/续期失败：视同故障，按销毁策略回收，run 落 `failed` 并可审计。
- 纯对话路径不受影响（路由矩阵允许并存）。

## 8. 安全基线映射（v2.0 §7.1 → OpenSandbox 手段）

| 基线维度 | 实现手段 | 阶段 |
| --- | --- | --- |
| 文件：只读 root、仅 workspace 可写、禁 Docker socket | 镜像只读层 + workspace 卷（host/pvc）；read-only rootfs 可行性 Phase 0 验证 | P2/P3 |
| 进程：完整 Pi/Extension/MCP 同隔离域、非 root、限 syscall | 完整进程进沙箱（本方案前提）；镜像非 root 用户；caps drop/AppArmor/seccomp；强档 gVisor/Kata 或 FastSandbox | P2/P3 |
| 资源：CPU/内存/PID/磁盘/墙钟/并发配额 | OpenSandbox resource 限制 + 命令 timeoutMs + 租户并发配额（控制面） | P2/P3 |
| 网络：默认拒绝、按任务放行、阻断 metadata/内网 | **两层**：provider 网络隔离兜底 deny-all（docker `--network none`；K8s NetworkPolicy）+ allowlist 域名级放行。Phase 4 落地（docker 档）：每沙箱独立**非 internal** 网桥（`--internal` 实测连宿主网关不可达）+ `--add-host host-gateway` + `--dns 127.0.0.1`；**残余缺口**：raw-IP 直连可绕过（§5.1 实测同源），生产 FQDN 级硬拒绝 = OpenSandbox egress sidecar（dns+nft）/ NetworkPolicy | P4 ✅（docker 档；生产档随 Phase 5） |
| 凭据：禁平台全量 env、只发短期窄 token | ✅ pi-messages Inference Proxy + AgentRun 级 run token（32B hex、sha256 存储、滑动 30min、grant 限 provider/model、acquire 失败即撤销）；平台密钥只存控制面 Worker host | P4 ✅ |
| 出站：Artifact/Tool/网络走显式网关并审计 | Artifact Gateway（deliver_file 改造）+ Tool Gateway（延后，见 v2.0 §12.2） | P2/P4 |
| 故障：fail-closed | §7.3 | P2 起 |

## 9. 测试计划

- 契约测试：`tests/unit/runtime/sandbox/`——Test/Docker/OpenSandbox 三 provider 同套件（acquire/exec/renew/destroy、失败分类、TTL）。OpenSandbox harness 经 `PIWORK_SANDBOX_CONTRACT_OPENSANDBOX=1`（+ `OPENSANDBOX_DOMAIN`/`OPENSANDBOX_API_KEY`，可选 `OPENSANDBOX_PROTOCOL`/`OPENSANDBOX_IMAGE`）注册进同一套件（execPath 用容器内 node）；默认关闭，离线 21 用例单测（`opensandbox-provider.test.ts`）常驻。Docker 契约组（Phase 4 后 12 用例）含 **egress 对照用例**：白名单 FQDN 经宿主网关可达宿主探针 + 外网/未列 FQDN 拒绝（宿主探针必须绑 `0.0.0.0`——容器经 VM 网关回宿主）。
- backend 契约：`tests/unit/runtime/backends/` 扩展——`RpcProcessBackend` 策略 B 过既有 Runtime 契约（与 LocalRpc 策略 A 同套件，对齐 Durable 先例，含 abort、进程泄漏、stderr）。
- Inference Proxy（Phase 4 ✅）：`tests/unit/runtime/inference-proxy/`——`events.test.ts`（AssistantMessageEvent → SSE 行映射与上游违约防护）、`tokens.test.ts`（签发/校验/滑动 TTL/撤销）、`models-manifest.test.ts`（models.json 聚合与 env 模板）、`server.test.ts`（HTTP/SSE 端到端，上游用官方 `fauxProvider`：401/400/403/413/503 分类 + 全落审计、happy path、无终态合成 error、客户端中断归类 client_aborted）；`tests/unit/runtime/backends/sandbox-rpc/inference.test.ts` 装配专测（egress 派生只收紧、mint 失败不开沙箱、acquire 失败撤 token、**全链路**：TestSandboxProvider 内真实 pi 子进程经 models.json + `${PIWORK_RUN_TOKEN}` 走代理出文本）；`tests/unit/db/inference-audit-queries.test.ts`（脱敏落库、chat 删除后审计仍在）。
- 安全用例（v2.0 Step 5 完成标准）：跨 workspace 读取、平台 env 读取、未授权网络、资源耗尽、Docker socket 访问——全部必须被阻止且留审计。
- fail-closed 用例：provider down、沙箱中途死亡、TTL 到期——run 终态与错误信息断言。
- 路由矩阵（Phase 5 ✅）：`tests/unit/runtime/backends/routing.test.ts`——`requiresSandbox` 判定（workspaceDir）、RoutingRuntimeBackend 分流、沙箱路由失败原样上抛且不回落 in-process、RunManager `backendKindFor` 逐 run 落 AgentRun.backend 实际执行位、与真实 SandboxRpcBackend（TestSandboxProvider）的分流闭环（纯对话零 acquire、workspace run 真起沙箱且 close→kill 回收）。冷启动为一次性实测（docker 档 P50 490ms，§6 Phase 5），不做常驻测试。
- e2e：沙箱模式跑通第一条验收链路（§10）；本地 e2e 前置杀残留 dev server 的既有约定不变。
- 测试数据清理沿用 `tests/e2e/helpers/test-cleanup.ts` afterAll 模式；OpenSandbox server 为外部依赖，CI 用 Docker provider 跑安全用例，OpenSandbox provider 用例标记可选/nightly。

## 10. 验收标准（第一条链路，转录 v2.0 §11 并具体化）

```text
创建 AgentRun → 解析已批准 Package/MCP
→ SandboxProvider.acquire（OpenSandbox 或 Docker）
→ 沙箱内 spawn pi --mode rpc（--session seeding，v2.0 §8.2）
→ 执行一个 MCP tool + 一个文件工具
→ SSE 展示消息与工具事件（RuntimeEvent 归一化不变）
→ deliver_file 经 Artifact Gateway 出站归档
→ 完成/abort 后 release（默认 kill）
```

必须同时满足：沙箱看不到平台密钥；读不到其他 chat workspace；访问不了未授权网络；Runtime 崩溃命令不落宿主；审计含用户/AgentRun/Package hash/工具/Artifact/资源用量；TTL 续期在长 run 中生效。

## 11. 风险与待拍板决策

| # | 决策 | 选项与倾向 | 阻塞 |
| --- | --- | --- | --- |
| D-1 | 部署形态与隔离档位（承 v2.0 §12.1 + skill 方案 §9） | 开发=Docker 单机已定（Phase 0 ✅ 实测可用，但 rootfs/直连 IP/横向暴露需平台自管，§5.1）；生产=K8s 容器+`[secure_runtime]`（gVisor/Kata）vs FastSandbox microVM——spike 未覆盖，仍待生产部署评估 | Phase 3 承诺 |
| D-2 | `SandboxChannel` 的 OpenSandbox 传输实现 | **已定（Phase 0 ✅，Phase 3 实现级修正）**：pipe 模式 PTY WS 经 server proxy（`POST /pty` → `ws ?pty=0`，`0x00/0x01/0x02` 二进制帧 + exit/signal JSON 帧），223B JSONL 分帧字节保真实测通过。落地补充（live 契约 + `pty_ws.go` 源码核对）：exec 启动行必须走**二进制 0x00 帧**（文本帧仅承载 JSON 控制消息，非 JSON 静默丢弃）；exit 帧 code 字段为 `exit_code`（snake_case）；无 stdin EOF 帧 → `endInput` 映射 SIGTERM signal 帧（同官方 RpcClient.stop() 语义）；proxy 鉴权 header 为 `OPEN-SANDBOX-API-KEY`（与 SDK 同名，`middleware/auth.py`；单租户 proxy 路径豁免鉴权，多租户必验）；undici 7.16 WebSocket 支持 headers option（2026-10-02 裸 TCP 实测 upgrade 请求携带），多租户 WS 鉴权可行。实现 = `lib/runtime/sandbox/opensandbox/pty-channel.ts`（launcher 哨兵 `piwork:exec-ready` 门控，外层 shell 读走 RPC 字节竞态免疫） | 无 |
| D-3 | 凭据通道 | **已定（Phase 4 ✅）**：Inference Proxy 讲 **pi-messages wire 协议**（pi-ai `dist/api/pi-messages.js` 核对）——沙箱内官方 pi 经 `models.json` 原生对接，无需 openai-compatible 兼容层；凭据 = AgentRun 级短期窄 token。不启用 OpenSandbox Credential Vault（避免两套凭据语义） | 无 |
| D-4 | Docker provider 实现路径与 pi-extension-opensandbox 复用 | **已定（Phase 2 ✅）**：**docker CLI 直连**（经 colima/docker context 路由，不用 Engine API 库），安全基线全部 provider 自持（§5.1 三缺口不由任何第三方 runtime 兜底）。理由：Phase 0 实测 OpenSandbox docker 档不做 read-only rootfs、直连 IP 可绕过 egress、publish_host 默认全域暴露。社区扩展（pi-extension-opensandbox）审计留作支线 E 参考 | ~~Phase 2/3~~ |
| D-5 | 支线 E 排期 | 默认不排；触发条件=pi-durable 评估 §4 任一满足且产品需要 | — |
| D-6 | pause/snapshot 用于 warm pool | OpenSandbox 支持 pause/resume 与 OCI snapshot（Phase 0 实测 pause/resume 可用；snapshot 无供应链校验，§5.1）；对应 v2.0 Step 9，首版只做 kill | Step 9 |

风险：OpenSandbox 文档与实现漂移（K8s 多副本限制、Docker 快照不支持 PostgreSQL 多副本）→ provider 层只依赖 lifecycle/exec API 小面；`@alibaba-group/opensandbox` 1.x API 变动 → 精确 pin + SDK 隔离在 `lib/runtime/sandbox/opensandbox/`；pi-durable 0.99.2 与 pi-ai 1.0.0 双版本嵌套（现存 `as never` 转型）→ 不因支线 E 引入新耦合。

## 12. 官方依据

- Pi 官方：[containerization](https://pi.dev/docs/latest/containerization)（四种方法、完整进程 vs 工具级隔离的官方区分、Gondolin env 泄漏警告——2026-10-02 核对）、[security](https://pi.dev/docs/latest/security)、[rpc](https://pi.dev/docs/latest/rpc)；已装包源码核对（2026-10-02）：`pi-coding-agent@1.0.0` `dist/modes/rpc/rpc-client.d.ts`（`RpcClientOptions` 全字段与全 API 面，含 `bash()/abortBash()/fork()/clone()/compact()/getEntries()`）、`rpc-client.js:31-42`（`spawn("node", [cliPath, "--mode", "rpc", ...])` 硬编码——cliPath 注入 shim 的依据与边界）、`pi-agent-core@1.0.0`（无 ExecutionEnv）、`pi-durable@0.99.2` `dist/env/index.d.ts`（ExecutionEnv = FileSystem + Shell）。
- pi-ai@1.0.0 源码核对（2026-10-03，Phase 4）：`dist/api/pi-messages.{js,d.ts}`（wire 协议：单 POST `{model, context, options}` → SSE 事件流 + done/error 终态，Bearer 鉴权，wire model 为裸 id）、`dist/types.d.ts` AssistantMessageEvent（每事件携 `partial` 累积消息、done/error 终态、`deferred` reason 透传）、`dist/utils/transcript.js`（normalizeContext 请求侧对照）、`dist/providers/faux.js`（官方测试替身——代理上游与全链路测试基座，honors `options.signal`）、`dist/core/model-config.js` + `provider-composer.js`（models.json `ProviderConfigSchema`、`${ENV}` apiKey 模板从进程 env 解析、`$PI_CODING_AGENT_DIR/models.json` 发现路径、模型 ref `<provider>/<id>`）。
- OpenSandbox 官方：[architecture](https://open-sandbox.ai/architecture/)、[deployment](https://open-sandbox.ai/deployment/)、[GitHub README](https://github.com/opensandbox-group/OpenSandbox)（Docker 单机 quickstart、SDK 包名）；npm：`@alibaba-group/opensandbox@1.1.0`、`pi-extension-opensandbox@0.1.9`（2026-10-02 npm view）。
- 本地代码：`lib/runtime/protocol/backend.ts`、`lib/runtime/backends/{in-process,local-rpc,durable}/`（`local-rpc/spawn.ts` 的 `buildRpcClientOptions`/`seedSessionFile` 为沙箱模式复用基座）、`lib/runtime/run/index.ts`、`lib/ai/agent-session.ts`（`noTools: "builtin"`）、`lib/ai/skills.ts:12`（NodeExecutionEnv 用法）。

---

*本文档为规划稿。实现过程中若与本规划偏离，请更新本文档并升版本号；落地状态变化时同步更新 [docs/README.md](README.md) 与 [architecture.md](architecture.md) 的对应条目。*
