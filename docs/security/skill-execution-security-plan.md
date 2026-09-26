# Skill 安全执行方案（沙箱与依赖管理规划）

**版本**：0.4（接入点被 v2.0 Runtime 架构取代，治理设计并入——见 §10 版本记录；其余仍为规划稿，未实施）
**日期**：2026-09-19（0.3）/ 2026-09-26（0.4 状态更新）
**适用范围**：管理端技能上传与分发、员工侧技能执行、agent 执行类工具（bash/read/write/edit/deliver_file）、Python 及其他运行时依赖管理
**读者**：后续实现本方案的工程同学
**参考**：[CubePlex 沙箱方案](https://cubeplex.ai/docs/zh-Hans/admin/sandbox)（同类问题域的生产实践，[仓库](https://github.com/cubeplexai/cubeplex)）、[OpenSandbox](https://github.com/opensandbox-group/OpenSandbox)、pi.dev 生态沙箱扩展调研（[pi-extension-opensandbox](https://pi.dev/packages/pi-extension-opensandbox)、[pi-permission-modes](https://pi.dev/packages/pi-permission-modes)、[pi-sandbox](https://pi.dev/packages/pi-sandbox)、[pi-container-sandbox](https://pi.dev/packages/pi-container-sandbox)，均为社区包）。历次吸收与不照搬的决定见 §10 版本记录

> **状态更新（v0.4，2026-09-26）**：本方案的核心接入点——`RemoteSandboxEnv implements ExecutionEnv`（§1.3/§4，仅执行工具进沙箱、agent loop 与扩展留在 Web 进程）——已被 [pi-plugin-support-research.md v2.0](../pi-plugin-support-research.md) 的**完整 Pi 进程沙箱**取代：官方 security 页将"仅内置工具进沙箱"定位为更窄的隔离（narrower form），且无法约束在工具沙箱之外运行的 Extension。以下治理设计仍有效并已并入/引用进 v2.0：§5 依赖预构建与运行时禁装、§6.3 命令 AST 门控与 Confirm 审批、§4.2 网络策略 schema 与 TTL 生命周期、§6.5 密钥占位符与出口代理。§4.1/§8.2 的底座选型作为 v2.0 §7.1 的企业加固层输入；§9 的部署形态决策与 v2.0 §12 合并拍板。

---

## 1. 设计结论

1. **必须做沙箱**。当前架构里管理员上传的 skill 脚本 + agent 的 bash 工具是**直接在 Next.js 服务进程里执行**的（`lib/ai/agent-tools.ts:73` 的 `NodeExecutionEnv`），等于每个员工都可能触发"以服务进程权限跑任意代码"。
2. **Python 依赖不能在运行时装**。`lib/ai/agent-tools.ts:237`（`buildExecutionSystemPrompt`）目前明确让 agent "缺什么就 `pip install`"，这是最大的供应链 RCE 入口，应改为**上传时声明 + 预构建运行时镜像**。
3. **技能本身不是"被执行的程序"，被执行的是 agent 的代码执行工具**。skill 只是被动文件；沙箱的正确位置是把 agent 的执行环境（bash/read/write/edit）整体搬进隔离沙箱。`pi-agent-core` 已有 `ExecutionEnv` 抽象（`NodeExecutionEnv` 是其实现之一），新增 `RemoteSandboxEnv` 实现是天然接入点，也是整个改造中唯一需要动 agent 侧的点。

信任层级（先定清楚，后续所有设计以此为据）：

```
平台 > 组织管理员 > skill 作者 > 员工输入（聊天内容是不可信输入！）
```

管理员上传的 skill 也不应视为完全可信——管理员账号可能被盗，zip 可能来自第三方。

## 2. 现状与威胁模型

现有链路：管理端上传 zip → 校验解压 → 写入服务器本地 `.pi/skills/`（`lib/ai/skills.ts:300` `installProjectSkill`）→ 员工聊天时 `loadProjectSkills()` 全量加载（`app/(chat)/api/chat/route.ts:256`）→ agent 在 `.pi/workspace/<chatId>` 里通过 bash 以绝对路径直接跑技能脚本。

| # | 威胁 | 现状代码位置 |
|---|------|-------------|
| 1 | 恶意/被篡改的 skill 脚本直接跑在宿主机 | `agent-tools.ts:73` 无任何隔离 |
| 2 | 聊天中的 prompt injection 让 agent 跑任意 bash（与 skill 无关） | bash 工具无命令过滤 |
| 3 | 运行时 `pip install` 拉任意包（供应链 RCE） | `agent-tools.ts:237` 提示词明确鼓励 |
| 4 | 跨用户数据泄露：bash 可 `cd /` 读其他 chat 工作区、`.env` 里的 API Key | workspace 只是路径约定，无强制 |
| 5 | SSRF / 内网探测 / 数据外传 | 无网络出口控制 |
| 6 | 失控脚本打挂服务器（挖矿、fork 炸弹、磁盘写满） | 无资源限制，"120s 超时"只是提示词约定（`agent-tools.ts:238`） |
| 7 | 零审计：不知道谁在何时执行了什么 | 无执行日志 |
| 8 | 部署形态矛盾：本地 FS + bash 在 Vercel serverless 上本就不可用 | README 已提示 `.pi/skills` 持久化问题 |

已具备的基础（实现时保留复用）：

- 上传 zip 的路径穿越/大小/文件数校验做得较完整（`skills.ts:21-23`、`normalizeUploadPath`、`extractProjectSkillArchive`）。
- `PIWORK_DISABLE_EXECUTION_TOOLS` 总开关（`agent-tools.ts:22`），Phase 0 可细化其语义。
- `deliver_file` 已限制在 workspace 内、50MB（`agent-tools.ts:84`），出站通道设计可以沿用。
- `isInsideWorkspace` 路径校验函数（`agent-tools.ts:48`）可复用于路径白名单。

## 3. 总体架构：三个平面分离

```
┌─ 管理平面 ──────────────────────────────────────┐
│ 上传/审核/版本/发布策略（技能注册表：DB+对象存储）      │
└──────────────┬─────────────────────────────────┘
               ↓ 按组织/成员组分发（内容寻址、只读）
┌─ Web 平面（现有 Next.js）────────────────────────┐
│ 聊天、agent loop、load_skill、deliver_file        │
└──────────────┬─────────────────────────────────┘
               ↓ ExecutionEnv 接口（新增 RemoteSandboxEnv）
┌─ 执行平面（新增：沙箱集群）────────────────────────┐
│ 每 chat 一个临时沙箱：bash/python + 预装依赖镜像     │
│ 默认断网 · 资源硬限 · 只读技能目录 · 可写仅 workspace │
└─────────────────────────────────────────────────┘
```

**执行位置选服务端沙箱**，理由：

- 员工用的是浏览器，本来就没有本地执行环境；现状也已经是服务端执行，只是没隔离，改造成本最低。
- 浏览器内方案（Pyodide）对 shell、原生依赖（PPT/PDF 处理库）基本不可行，只能作为未来"轻量纯计算技能"的补充。
- "员工本地装 agent"会把信任边界推到数千个端点上，比集中沙箱更难管。

该改造顺带解决：执行平面独立伸缩（水平扩容）、Vercel/多实例部署下的本地 FS 问题。

## 4. 沙箱设计

按"不可信任意代码"标准设计——输入 = 管理员上传的脚本 × 员工聊天里的注入指令，两者乘积不可控。

### 4.1 隔离层级选型

| 层级 | 技术 | 隔离强度 | 适用 |
|------|------|---------|------|
| 进程级（现状） | Node 子进程 | ❌ 不够 | 仅本机开发 |
| 容器 | runc + seccomp | ⚠️ 共享内核，逃逸史多 | 不建议作为唯一防线 |
| **沙箱内核** | **gVisor (runsc)** | ✅ 拦截系统调用层 | **推荐起步：K8s RuntimeClass，运维成本低** |
| microVM | Firecracker / Kata | ✅✈ 硬件级 | 强合规/大规模（E2B、Fly、Fargate 均为 Firecracker 系） |

建议 **K8s + gVisor RuntimeClass 起步**；`RemoteSandboxEnv` 实现时不绑定底层技术，规模或合规要求提高后可切 Firecracker。

另注：Anthropic 官方开源的 `@anthropic-ai/sandbox-runtime`（macOS sandbox-exec + Linux bubblewrap，Claude Code 同款，多个社区沙箱插件的底座）定位是**单用户开发机**的进程级沙箱，不满足我们"多租户服务器跑不可信代码"的隔离强度，**不改变上表选型**；可借鉴的是其声明式策略模型（allowWrite/denyRead/域名白名单）。

### 4.2 沙箱内部约束

- **生命周期**：每个 chat（而非每次命令）一个沙箱实例，保持会话内文件延续；TTL 周期续期（会话存活期间按 TTL/2 或每小时的节奏续期，参考 pi-extension-opensandbox），停止续期即到期销毁。文件不落宿主盘（tmpfs/内存卷），聊天产物只通过 `deliver_file` 出站。**不采用** per-workspace 持久沙箱（CubePlex 模式）：运行时装包导致环境漂移（不可复现，与"技能版本不可变、可审计"冲突），且驻留进程有更长存活窗口；若未来确需会话级延续，用"workspace 卷持久 + 沙箱实例重建"折中。
- **失败降级（fail-closed，必须）**：沙箱创建/连接失败时**绝不回退到本机执行**，该会话的执行类工具直接不可用并明确报错；沙箱中途故障时，本该沙箱内执行的命令转为拒绝或弹确认——**永远不会在无保护状态下被静默执行**（参考 pi-extension-opensandbox / pi-permission-modes）。
- **文件系统**：rootfs 只读；`/workspace` 可写（对应现在 `.pi/workspace/<chatId>`）；`/skills/<name>` **只读挂载、按需只挂当前会话用到的技能**；禁挂 docker socket、宿主路径、云凭证。
- **凭证**：沙箱内零平台密钥。当前 bash 能读到 `.env` 里 `DEEPSEEK_API_KEY` 的问题随之消失；用户数据只通过附件落盘传入（`writeAttachmentsToWorkspace` 机制保留）。
- **网络**：Phase 1 默认**完全断网**（大多数办公技能不需要网）；Phase 2 按技能 manifest 声明的域名白名单，走带审计的 egress proxy。断网同时让"运行时 pip install"天然失效。
- **网络策略 schema（Phase 2，借鉴 CubePlex）**：采用"默认动作 + 有序规则"模型——策略为 `default: Deny` 加一组有序的 `Allow/Deny` 域名规则（如：默认 Deny，仅放行内部 API 网关等声明域名）。员工场景默认动作固定为 Deny，**不提供"默认 Allow"选项**（CubePlex 面向开发者提供该选项，信任模型不同）。策略作用域分层：平台默认 → 组织策略 → 成员组覆盖，且窄作用域**只能收紧、不能放宽**（most-restrictive overlay，参考 pi-permission-modes）——防止下层配置无意削弱平台防线。
- **资源硬限**（不是提示词约定）：cgroups 限 CPU/内存/PID 数/磁盘，墙钟超时（替代 `agent-tools.ts:238` 的"建议 120s"），外加每用户/每组织的并发沙箱数与时长配额。
- **接入点**：新增 `RemoteSandboxEnv implements ExecutionEnv`，替换 `createExecutionTools` 里的 `new NodeExecutionEnv(...)`（`agent-tools.ts:74`）。bash/read/write/edit 语义不变，agent 和 skill 均无感知。

## 5. Python 依赖管理

原则：**声明式、预构建、锁定；运行时禁止安装**。

1. **上传时声明**：skill 包内带 `requirements.txt`（或扩展 SKILL.md frontmatter），声明 Python 版本 + 依赖列表。
2. **上传时构建"技能运行时镜像"**：解析依赖 → 生成带哈希的 lock 文件 → 从**私有 PyPI 镜像**（devpi/Artifactory）拉包 → 漏洞扫描（pip-audit/OSV）→ 生成 SBOM → 构建镜像并缓存。依赖不变则镜像复用。构建本身走供应链校验：对下载的二进制/基础镜像做 SHA256 校验与冒烟测试（如 `node --version`、`python -c "import …"`），让缺库/损坏在**构建期**而非使用期暴露（参考 pi-container-sandbox）。
3. **运行时**：沙箱直接用预构建镜像启动，`pip install` 被禁网 + 只读 rootfs 双重堵死。
4. **标准运行时档位**（降低审核成本）：官方维护 `python-basic` / `python-data`（pandas/openpyxl 等）/ `node` / `office`（pptx/pdf 处理）等几档；大多数技能直接选档，零构建零审核。特殊依赖才走自定义镜像 + 管理员审核流水线。
5. **提示词清理**：`buildExecutionSystemPrompt` 里"缺依赖就 pip install"（`agent-tools.ts:237`）改为"缺依赖时报错并提示联系管理员更新技能"。

## 6. 权限与审批模型（上传 → 发布 → 执行）

### 6.1 管理员上传时（管理平面）

- 静态检查：文件类型/大小/数量（已有）+ **可执行入口白名单**（manifest 声明哪些脚本能被运行）+ 敏感模式扫描（curl/wget/eval/大块 base64 解码/混淆）。
- 权限声明随包：需要网络？需要哪些域名？需要哪个运行时档位？管理员审批的是这份清单，而不是读 200 个文件。
- 内容寻址存储（版本不可变 + 哈希固定），可选双人复核（上传者 ≠ 审批者）与包签名。

### 6.2 发布

按组织/成员组灰度，版本化管理，出问题可秒回滚。现有 enable 开关（管理端 UI）保留，但底层从"本地 FS 目录"迁到 DB + 对象存储——这也是多实例部署的前置条件。

### 6.3 员工执行时（Web 平面）

- 风险三档明示：纯指令技能（无脚本）/ 脚本技能 / 需联网技能。
- 敏感技能首次执行弹确认（或组织策略设为自动放行）。
- **命令级规则（借鉴 CubePlex）**：在技能 manifest 或组织策略中声明命令的三态规则——`Allow`（直接放行）/ `Deny`（直接拒绝）/ `Confirm`（暂停 agent，聊天流中弹出批准卡片，员工批准后才执行）。典型 Confirm：删除类命令、`git push`、访问非白名单域名；典型 Deny：`pip install` / `npm install`（见 §5）。落在 bash 工具层实现，不依赖沙箱基础设施，可与 Phase 1 并行。比技能级"全放行/全禁止"粒度更细。
- **bash 门控必须基于 AST，不能用正则/字符串匹配**（参考 pi-permission-modes）：用 tree-sitter 解析真实命令树，递归重解析 `sh -c '…'`、`$(…)`、反引号内嵌脚本，对命令链中**每条命令**逐一判定；结构性识别 `env`/`nice`/`xargs` 包装器与 `sudo`/`su`/`doas` 提权。字符串匹配可被 base64、环境变量拼接、引号变形轻易绕过，不能作为安全边界。授权以链中提取的**全部命令名**为键——批准 `git` 不会连带放行后续的 `git status && curl … | sh`。
- **授权存储与超时规则**（参考 pi-sandbox）：会话内授权仅存服务端内存，**agent 不可读、不可改**（防 prompt injection 读取或篡改授权状态）；确认提示带超时（如 10 分钟），超时自动按拒绝处理，**超时永不授权**；`Deny` 硬拦截、不提供"本次允许"绕行口（写/执行类操作危险等级高于读，拒绝路径不给绕行）。
- 每条 bash 命令在聊天流里对用户可见可展开（已有 `formatToolStatus` 雏形，`agent-tools.ts:158`）。

### 6.4 非脚本风险（不要漏掉）

- SKILL.md 本身是给 LLM 的指令，纯指令技能也能被写成"把用户文件内容总结后发到某 URL"——纯指令 ≠ 零风险。缓解：上传时内容审查 + 执行期工具面收敛（无网技能的会话里干脆不给联网能力）。
- prompt injection 的攻击对象是 agent 的 bash 工具，与 skill 无关——沙箱必须覆盖**所有**执行类工具调用，而不只是"跑技能脚本"这条路。

### 6.5 密钥绑定与占位符设计（Phase 2，借鉴 CubePlex）

§4.2 的"沙箱内零平台密钥"回答了"平台凭证不进沙箱"，但没有回答**"技能合法需要凭证调内部服务怎么办"**（如调用公司内部 API 网关、企业 SaaS）。采用占位符 + 出口代理方案：

- 技能在 manifest 中申请绑定密钥；管理员审批技能时即审批此绑定，连同目标主机白名单与允许的 header。
- 沙箱内注入的只是占位符（如 `sbxref_...`），出现在日志/输出中也不构成泄露。
- 出站请求经 egress proxy，在**网络边界**将占位符替换为真实值；替换需同时满足两个条件：目标主机在允许列表、占位符位于允许的 header。
- 真实密钥加密存于凭据保险库，从不进入沙箱；泄露的占位符仅对自身沙箱及允许主机有效，沙箱销毁即撤销。

代价：需要维护一个 HTTPS 出口代理，复杂度较高，故放 Phase 2；Phase 1 保持"断网 + 无密钥"。

## 7. 审计与可观测

每次执行记录：用户、chat、skill 名称+版本（哈希）、执行的命令序列、网络访问（若开网）、资源消耗、产物哈希与去向（deliver_file）。集中落库，设保留期。异常检测从简单规则起步：单会话出网流量异常、内网段扫描、超长运行。

## 8. 分阶段落地路线

| 阶段 | 内容 | 成本/效果 |
|------|------|----------|
| **Phase 0：止血** | ① 提示词移除"pip install"改为报错；② 上传端加脚本静态检查 + 可执行入口声明；③ 强制 bash 只能执行技能目录内白名单入口和 workspace 内文件（路径白名单校验，不是提示词约定）；④ 默认只放行纯指令技能上生产，脚本技能需管理员显式开启 | 不引入新基础设施，先封掉最锋利的几个口子 |
| **Phase 1：沙箱化**（核心） | `RemoteSandboxEnv` + gVisor 沙箱池；标准运行时档位镜像；默认断网；资源硬限；执行审计日志；技能存储从本地 FS 迁到 DB+对象存储 | 解决根本问题，可水平扩容 |
| **Phase 2：增强** | 网络策略 schema（默认 Deny + 有序域名规则，§4.2）+ egress proxy + 出站 DLP；密钥占位符与凭据保险库（§6.5）；自定义依赖镜像审核流水线；warm pool 优化冷启动；多组织租户隔离与包签名；配额计费。命令级 Confirm 审批（§6.3）为 Web 平面能力，不依赖沙箱，可与 Phase 1 并行 | 面向规模化运营 |

### 8.1 Phase 0 改动清单（实现时的落点）

| 项 | 文件 | 改动 |
|---|------|------|
| 移除运行时 pip install | `lib/ai/agent-tools.ts:237` | 提示词改为"缺依赖报错"，并考虑在 bash 工具层拦截 `pip install`/`npm install` 命令 |
| bash 硬超时 | `lib/ai/agent-tools.ts:238` 及 bash 工具参数 | "建议 120s"改为默认强制超时 |
| 路径白名单 | `lib/ai/agent-tools.ts:48`（复用 `isInsideWorkspace`） | bash 执行的脚本必须位于当前技能目录声明的入口或 workspace 内 |
| 上传静态检查 | `lib/ai/skills.ts:300`（`installProjectSkill`） | 扫描可执行文件、敏感模式；解析 manifest 中的入口与依赖声明 |
| 脚本技能开关 | 管理端技能管理 + chat route 技能加载 | 含脚本的技能默认不进入员工侧技能列表，需管理员显式启用 |

### 8.2 选型对比（Phase 1 决策输入）

| 方案 | 优点 | 缺点 |
|------|------|------|
| **OpenSandbox（自托管沙箱平台）** | 阿里系开源、可自托管、自带沙箱控制面与 Python/TS/Java/C# SDK，命中"国内自托管"约束；CubePlex 生产在用 | **隔离底座待审**——官方文档未标明底层隔离技术，选型前需单独评估是否达到 §4.1"不可信任意代码"标准 |
| 自建 gVisor on K8s | 成本低、完全可控、运维门槛中等 | 需要自维 K8s |
| 自建 Firecracker | 最强隔离、冷启动好 | 开发量大 |
| E2B / Modal（托管） | 接入最快 | 国内可用性与数据出境是硬约束 |
| 国内云沙箱容器/函数计算 | 合规、免运维底座 | 与云绑定 |

国内自托管概率高，优先评估 **OpenSandbox**（原型验证成本最低，`RemoteSandboxEnv` 可直接对接其 SDK）；其隔离底座审核不通过时，退回**国内云 K8s + gVisor**或**自建 + Firecracker**。

**参考实现**：[pi-extension-opensandbox](https://pi.dev/packages/pi-extension-opensandbox)（pi 生态社区扩展）已实现"pi 会话工具全量路由到远程 OpenSandbox"——`session_start` 创建/连接沙箱、bash/read/write/edit/ls/find/grep 全部路由、TTL 周期续期、`session_shutdown` 按策略销毁（kill/pause/keep）、fail-closed、默认拒绝出站。与 §4.2 的 `RemoteSandboxEnv` 设计完全同构，Phase 1 原型可直接参考其集成层（注意：社区包，代码需审计后决定复用程度）。

## 9. 待拍板决策

实现前需要产品/安全负责人确认：

1. **部署形态**：自托管 K8s 还是云函数/容器服务？直接决定沙箱选型范围。
2. **信任边界**：管理员上传是否需要"上传者 ≠ 审批者"的双人复核，还是管理员单人可信？
3. **技能是否需要联网**：若 Phase 1 就有技能要联网（如抓网页），网络白名单设计要提前，不能先断网再补。

## 10. 版本记录

- **0.1**（2026-09-19）：初版。现状威胁模型、三平面架构、沙箱设计、依赖管理、权限模型、分阶段路线。
- **0.2**（2026-09-19）：对照 [CubePlex 沙箱方案](https://cubeplex.ai/docs/zh-Hans/admin/sandbox)（同类问题域——组织分发技能、成员触发执行——的生产实践）修订。**吸收 4 项**：网络策略 schema（§4.2）、命令级 Confirm 审批（§6.3）、密钥占位符与出口代理（§6.5）、OpenSandbox 进入选型（§8.2）。**明确 3 项不照搬**：① 运行时 pip/npm install（供应链审查权不能交给一次 LLM 决策）；② 默认网络 Allow 选项（员工场景默认动作固定 Deny）；③ per-workspace 持久沙箱（环境漂移 + 驻留风险，见 §4.2 生命周期）。不照搬的根因是信任模型不同：CubePlex 是开发者工作区 agent（长期共用、可信度较高），我们是员工侧办公技能平台（管理员上传、员工触发、聊天内容不可信）。
- **0.3**（2026-09-19）：调研 [pi.dev 生态沙箱扩展](https://pi.dev/packages?name=sandbox&type=extension)（35 个，均为社区包，无 pi 官方维护）。**吸收 6 项**：fail-closed 失败降级与"沙箱不可用绝不静默执行"（§4.2）、TTL 周期续期细则（§4.2）、策略窄作用域只能收紧（§4.2）、bash AST 门控替代字符串/正则匹配（§6.3）、授权仅存服务端内存 + 确认超时默认拒绝 + Deny 无绕行口（§6.3）、镜像构建供应链校验（§5）。**确认 1 项选型判断**：Anthropic `@anthropic-ai/sandbox-runtime` 定位单用户开发机，不改变 gVisor/Firecracker 档位（§4.1）。**新增参考实现** pi-extension-opensandbox（§8.2）。
- **0.4**（2026-09-26）：**接入点被取代**——`RemoteSandboxEnv`（仅执行工具进沙箱）由 [pi-plugin-support-research.md](../pi-plugin-support-research.md) v2.0 的完整 Pi 进程沙箱取代（官方 security 页将"仅工具进沙箱"定位为更窄隔离，且无法约束未委托执行的 Extension）。**四块治理设计仍有效并已并入/引用进 v2.0**：§5 依赖预构建、§6.3 命令 AST 门控、§4.2 网络策略/TTL、§6.5 密钥占位符。§4.1/§8.2 底座选型转为 v2.0 §7.1 的企业加固层输入；§9 部署形态决策并入 v2.0 §12。

---

*本文档为规划稿。实现过程中若与本规划偏离，请更新本文档并升版本号。*
