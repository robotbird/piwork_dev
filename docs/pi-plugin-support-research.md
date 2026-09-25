# pi.dev 插件体系与 piwork 网页安装可行性研究报告

> 状态：调研报告 v1.6（2026-09-25；v1.1 附录 A 抽样与 SDK 接口实测；v1.2 附录 B pi-mcp-adapter 无头 spike 实录——全链路验证通过；v1.3 附录 C 升级评估；v1.4 升级已实施并通过全部回归，见 C.7 执行记录；v1.5 附录 D 第三方 pi-web 宿主调研；v1.6 附录 E 复用性 spike C——官方 pi 插件与 piwork 自有工具/模型层同会话共存实证 + 开放问题 #2 关闭）
> 调研对象：pi 官方文档 https://pi.dev/docs/latest（latest，2026-09-25 抓取）+ piwork 当前工作区代码（main @ 2c96a59）
> 核心问题：**pi 的插件能否在 piwork 通过网页进行安装？安装后能否用于 piwork？**

---

## 0. 结论摘要

| 问题 | 结论 |
| --- | --- |
| pi.dev 官网支持网页一键安装插件吗？ | **不支持**。pi.dev/packages 是纯浏览画廊（5377 个包），每项只提供可复制的 `pi install npm:xxx` 命令，安装动作只能发生在用户终端的 pi CLI 里 |
| piwork 能实现"网页安装 pi 插件"吗？ | **工程上可行，但需要 piwork 自建**。pi 没有提供网页安装的官方接口；piwork 需要在服务端执行等价动作（npm 拉包 + 安装到受控目录 + 注册表记录）。piwork 已有模型插件网页安装的完整先例链路，模式可以复制 |
| pi 插件现在能直接用于 piwork 吗？ | **不能**。piwork 只依赖 `pi-agent-core`（agent 循环）和 `pi-ai`（模型流），**没有引入 `@earendil-works/pi-coding-agent`**——而扩展运行时（`ExtensionAPI`、`ResourceLoader`、settings/package 管理）全部在后者里。pi 扩展在 piwork 中没有宿主 |
| 升级后能用吗？ | **可以，且已在 spike 级实证**。pi SDK 官方为"嵌入式宿主"预留了自定义 `ResourceLoader` 扩展点（宿主完全接管资源存储与发现）；升级已完成（0.87.1，附录 C.7）。**附录 E spike C（2026-09-25）**：在同一次 `createAgentSession` 里，官方 npm 包 pi-mcp-adapter（经 `DefaultPackageManager.installAndPersist` 安装）、piwork 形态自定义工具、与 piwork-llm-deepseek 同形的声明式 Provider **三者共存**，官方插件的 MCP 工具与 piwork 工具在同一轮对话里被真实执行（6/6 断言通过）。剩余工作是聊天主链路的工程桥接与安全治理，详见 §4、§5、附录 E |
| 第三方 pi-web 把网页安装做出来了吗？ | **做出来了，且是我们的路线 A + 附录 B 安装路径的生产级互证**。`@jmfederico/pi-web`（Settings → Pi packages）支持任意 npm/git/URL/本地源的网页安装与卸载，服务端就是 `DefaultPackageManager.installAndPersist()`。但它是**单用户可信模型**（无沙箱、不建议公网暴露），定位与 piwork 的多租户产品不同——可作为参考实现与个人体验工具，不能替代 piwork 自建。详见附录 D |

一句话结论：**"网页安装"是 piwork 自己要建的能力（pi 官方没有，安装动作 = 服务端调 `DefaultPackageManager.installAndPersist`，附录 B/E 已两度实证；pi-web 生产级互证，附录 D）；"安装后可用"已在 spike 级实证（附录 E）——官方 pi 插件与 piwork 自有工具、模型插件层可在同一 AgentSession 共存并真实执行；剩余是聊天主链路的工程桥接与安全治理，pi 扩展"全权限可信代码"模型与 piwork 插件沙箱理念的张力仍需分阶段化解。skill 已在 piwork 落地（与 pi 同源 `loadSkills` 装载，格式兼容性经画廊头部包实测确认，附录 E.3）。**

---

## 1. 调研范围与方法

- 文档侧：逐页抓取 pi.dev/docs/latest 的 quickstart、cli、configuration、sdk、extensions、packages、custom-provider 共 7 页，以及 pi.dev/packages 画廊页。
- 代码侧：交叉验证 piwork 的依赖树（package.json、node_modules）、聊天链路（`app/(chat)/api/chat/route.ts`、`lib/ai/`）、模型插件链路（`lib/model-plugins/`、`packages/model-provider-sdk`、管理 API）。
- npm 侧：验证 `@earendil-works/pi-coding-agent` 的存在性与版本对齐。
- 所有代码结论附 `文件:行号`，文档结论附来源页。

---

## 2. pi 官方插件体系全景

pi 的定制能力是一个"从轻到重"的阶梯（quickstart「Choose how to customize Pi」）：

| 需求 | 机制 | 形态 |
| --- | --- | --- |
| 给某个目录持久指令 | `AGENTS.md` / context files | 纯文本 |
| 复用提示词 | Prompt template | markdown 资源 |
| 任务型指令+配套文件 | Skill | 目录资源（不跑代码） |
| 可执行工具/命令/事件处理器 | **Extension** | TypeScript 代码 |
| 自定义终端组件 | TUI | 代码（终端 UI） |
| 接入不支持的模型服务 | Custom provider | Extension 的一种 |
| 打包分发以上资源 | **Pi package** | npm 包/目录 |

### 2.1 Extension：pi 的"插件"本体

来源：https://pi.dev/docs/latest/extensions

- **形态**：TypeScript 模块，默认导出 factory，接收 `ExtensionAPI` 实例。pi 用 **jiti 直接跑 TS，无需编译**；支持单文件与带 `index.ts`/`index.js` 的目录。
- **API 面**（`ExtensionAPI`）：
  - `pi.on()` 订阅事件（返回退订函数）
  - `pi.registerTool()` —— 模型可调用的工具
  - `pi.registerCommand()` —— slash 命令
  - `pi.registerShortcut()` / `pi.registerFlag()` —— 快捷键与 CLI flag
  - `pi.registerProvider()` / `pi.unregisterProvider()` —— 模型供应商
  - `pi.sendUserMessage()` / `pi.sendMessage()` / `pi.appendEntry()` —— 消息与持久化
  - `pi.events` —— 扩展间通信；`pi.setActiveTools()` 等会话控制
- **事件面**：覆盖完整生命周期——`before_agent_start`（可改 prompt 段落/工具，`forceSystemPrompt` 可整体替换）、`message_end`、`tool_call`（可改输入或拦截）、`tool_result`、`provider_stream_event`（只读）、`context`/`context_with_system`、`turn_end`、`agent_end`、`agent_before_settle`（最后一个可动边界）、`agent_settled`（终结通知）、`project_trust`、`cache_warming_decision`、`user_bash`、`session_shutdown`。
- **上下文**：处理器拿到 `ExtensionContext`（工作目录、`ctx.ui`、session manager、model runtime、abort signal 等）；嵌套模型调用走 `ctx.modelRegistry.streamSimple()`。
- **UI 依赖**：`ctx.ui`（对话框/通知/widget/自定义组件）是**终端 UI**。扩展在 interactive/RPC/JSON/print 四种模式下都会加载，但 **JSON/print 模式无 UI**；官方要求扩展用 `ctx.mode === "tui"` 守卫终端专属代码、用 `ctx.hasUI` 判断可交互性。
- **加载发现**：
  - 开发期：`pi --extension ./hello.ts`（`-e` 可重复；`-ne` 关闭自动发现）
  - 持久化：`~/.pi/agent/extensions/`（用户级）与 `.pi/extensions/`（项目级，需 project trust）
  - 分发：Pi package（见 2.2）
- **安全模型**：扩展**运行在 pi 进程内、拥有与进程相同的 OS 权限**，能看到 prompt、工具调用、文件、凭据、会话历史。官方口径是"只加载你信任的来源"，**没有任何沙箱**。
- **生命周期约束**：factory 里不得启动进程/socket/watcher/timer（从 `session_start` 起、在幂等的 `session_shutdown` 里清理）；`/reload` 会整体替换扩展运行时。

### 2.2 Pi package：分发与安装

来源：https://pi.dev/docs/latest/packages

- **定义**：普通 npm 包或目录，可捆绑 extensions/skills/prompts/themes 四类资源；显式声明走 package.json 的 `pi` 键（`pi.extensions`/`pi.skills`/`pi.prompts`/`pi.themes`），约定目录则自动发现。
- **四种 source**：
  | source | 例子 | 行为 |
  | --- | --- | --- |
  | npm | `npm:@example/pi-tools@1.0.0` | 安装到 pi 的 npm 目录，版本钉死 |
  | git | `git:github.com/example/pi-tools@v1` | clone 并对齐 ref，tag/commit 钉死 |
  | URL | `https://github.com/...` | 视为 git source |
  | 本地 | `./pi-tools` | 从解析路径加载，不复制 |
- **安装命令**：`pi install <source>`（`--local`/`-l` 写项目级 `.pi/settings.json`，默认写 `~/.pi/agent/settings.json` 的 `packages` 声明）；`pi remove`、`pi list`、`pi update --extensions`；`pi -e npm:xxx` 可单次试用不落盘。
- **依赖规则**：宿主提供的包（`@earendil-works/pi-ai`、`pi-agent-core`、`pi-coding-agent`、`pi-tui`、`typebox`）**必须放 peerDependencies 且版本 `"*"`，不得打包**——否则会出现重复 class/registry。
- **资源过滤**：settings.json 里对象形式声明可按 glob 收窄（`!` 排除、`+path`/`-path` 精确加减、`[]` 全禁）；`autoload:false` 时项目级条目变成对个人级包的"过滤增量"。同一包按身份去重（npm 按名、git 按 repo URL 去 ref、本地按绝对路径）。
- **官方画廊**：npm 包打上 `pi-package` keyword 即可进入 **pi.dev/packages** 画廊（可选 `pi.image`/`pi.video` 预览字段）。**没有官方 registry，更没有网页一键安装**——画廊每项给的是可复制的 `$ pi install npm:pi-mcp-adapter` 命令（带 Copy 按钮）。

### 2.3 pi.dev/packages 画廊实况（2026-09-25 抓取）

- 收录 **5377 个包**，按 extension / skill / theme / prompt 四类筛选，展示下载量、更新时间、npm/GitHub 链接与举报入口。
- 代表性包：
  - `pi-mcp-adapter`（MCP 适配器，约 1M 下载/月）、`pi-subagents`（子代理编排）、`pi-web-access`（搜索/抓取/PDF）
  - `billion-context`（上下文压缩代理）、`@langfuse/pi-observability-plugin`、`@gotgenes/pi-permission-system`、`pi-ast-guard`（安全类）
  - `bigpowers`（73 个工程技能，skill 类包）
- **安装交互 = 复制命令到终端**。这是"网页安装"问题在 pi 官方侧的最终答案：**官方不提供网页安装，网页只是目录**。

### 2.4 Custom provider（与 piwork 现有插件同型）

来源：https://pi.dev/docs/latest/custom-provider

- provider 接入阶梯：静态模型+受支持 API → `models.json`；动态发现 → `refreshModels`；`/login` 流程 → OAuth 配置；新协议 → 实现 `streamSimple`。
- `pi.registerProvider()` 两种形态：完整 `Provider`（来自 `@earendil-works/pi-ai`，推荐）或 legacy `ProviderConfig`（name + config）。
- 凭据语法：`$NAME`/`${NAME}`（env）、`!command`（命令输出）；OAuth 凭据落 `~/.pi/agent/auth.json`。

### 2.5 SDK 的宿主扩展点（对 piwork 最重要）

来源：https://pi.dev/docs/latest/sdk

- `@earendil-works/pi-coding-agent` 包可把 pi 嵌入 Node/Bun 进程：`createAgentSession()` 返回拥有会话、模型、工具、队列、压缩状态与**扩展运行时**的 `AgentSession`；`AgentSessionRuntime` 提供多会话/fork/导入。
- 资源供给通过 `ResourceLoader`：
  - `DefaultResourceLoader`：标准目录发现 + 选择性覆盖，还支持 **inline extension factories**（不落盘直接给工厂函数）
  - **自定义 `ResourceLoader`**：官方明说用于"宿主完全自管资源存储与发现"的场景——这正是网页宿主（piwork）需要的接口
- 工具集通过 factory options 的 `tools`/`noTools`/`excludeTools`/`customTools` 配置。
- 版本事实：npm 上 `@earendil-works/pi-coding-agent` latest 为 0.87.1，**0.83.0 存在**——与 piwork 当前 `pi-agent-core`/`pi-ai` 的 0.83.0 精确对齐。

---

## 3. piwork 现状（代码事实）

### 3.1 运行时构成：自建 loop，无 pi 扩展运行时

| 层 | 实现 | 证据 |
| --- | --- | --- |
| 依赖 | 仅 `pi-agent-core` + `pi-ai` @ 0.83.0，**无 `pi-coding-agent`** | `package.json:30-31`；`node_modules/@earendil-works/` 下只有这两个包 |
| Agent loop | `new Agent(...)`（pi-agent-core 的 Agent 类），跑在 Next.js 聊天 API route 的服务端进程 | `app/(chat)/api/chat/route.ts:1,390-416` |
| 工具 | pi-agent-core 内置工厂（`createBashTool`/`createReadTool`/`createWriteTool`/`createEditTool`）+ 自研工具（文档、天气等）+ skill 工具，`toolExecution: "sequential"` | `lib/ai/agent-tools.ts:3-11`；`lib/ai/tools/`；`app/(chat)/api/chat/route.ts:395-415` |
| 执行环境 | `NodeExecutionEnv`（pi-agent-core/node），每会话独立工作区 `.pi/workspace/<chatId>` | `lib/ai/agent-tools.ts:12,29-34` |
| 模型层 | pi-ai `createModels()` 全局注册表；插件 Provider 同步进 `piModels`；`streamSimple`/`complete` | `lib/ai/pi.ts:32,79-102,162-172` |
| Skills | **直接用 pi-agent-core 的 `loadSkills`/`formatSkillsForSystemPrompt` 装载**，生成 `load_skill`/`create_skill` 工具；管理端已有 skills zip 上传链路（formData + .zip，存 `.pi/skills/` + DB `Skill` 表） | `lib/ai/skills.ts:2-10,822-895`；`app/(management)/api/management/skills/route.ts:73-130` |

**结论**：piwork 是"用 pi 的零件自造的 agent"，等价于自己实现了 `createAgentSession` 的一层薄替代，但**没有引入 ExtensionAPI / 事件总线 / ResourceLoader / settings-package 体系**。pi 扩展在这个架构里没有可挂载的宿主。值得强调：这不是遗漏，而是**成文的架构决策**——架构文档 §3.3 明确写明不引入 `@earendil-works/pi-coding-agent` 的完整 `ExtensionAPI`，理由是避免把 TUI、本地信任目录、全系统权限暴露给上传包（该决策针对的是"零信任上传包"场景；为"受信扩展层"重新评估它不违背该决策的前提）。

### 3.2 现有插件机制：模型供应商插件（piwork-llm-*）

按 `docs/model-provider-plugin-architecture.md`（713 行，v2）实现，链路：

```
管理页/API（builtin catalog 选择安装）
  → ProviderPluginManager.install(zipBytes)          lib/model-plugins/manager.ts
  → inspect（manifest/结构校验）                     lib/model-plugins/inspect.ts
  → static-scan（危险 API 静态扫描）                  lib/model-plugins/static-scan.ts
  → build（esbuild 产物 bundle）                     lib/model-plugins/build.ts
  → host/worker 沙箱激活（受限 API）                  lib/model-plugins/host/worker-runtime.mjs
  → registry（进程内缓存）                            lib/model-plugins/registry.ts
  → piModels.setProvider() 进聊天链路                 lib/ai/pi.ts:97-99
```

- 插件契约（`packages/model-provider-sdk/src/index.ts`）：`definition`（凭据表单 schema、模型目录、`networkHosts` 网络白名单声明）+ `validateCredentials` + 默认导出 `activate` 工厂。
- 受限扩展 API（`PiworkLlmExtensionAPI`，`packages/model-provider-sdk/src/index.ts:113-118`）：只有 `context` / `onDispose` / `registerProvider`（注册 pi-ai `Provider`）——**源码注释自述"与 Pi 官方 extension 的 registerProvider 语义一致"**，即它就是 pi `ExtensionAPI` 的一个刻意收缩的子集。
- 隔离执行：安装时**丢弃作者的 dist、从 src 用 esbuild 重建**（`lib/model-plugins/build.ts:73-105`，allowlist 依赖以 symlink 复用宿主审核过的包）；`node:worker_threads` 加载（256MB 堆上限、activate 15s 超时、日志 secret 脱敏、`stripFunctions` 跨线程处理），activate 时强制契约校验（恰好注册一次、id==runtimeProviderId、getModels/stream/streamSimple 齐备）。
- **网页安装现状**：`app/(management)/api/management/model-plugins/route.ts:43-90` 的 POST 只收 JSON `{packageId}`，从**内置目录**（`plugins/piwork-llm-*` 现场打 zip，与上传包走完全相同的检查链）安装；**不存在 multipart zip 上传入口，管理 UI 也没有文件选择控件**。架构文档 §10 规划的 `/inspect`、`/install`（multipart）、升级/回滚接口均未实现。`manager.ts:17-20` 明示：Phase 0/1 用 WorkerThreadPluginHost，**生产开放用户上传前必须切换到 RemotePluginHost（独立进程/容器），该 adapter 未实现**。
- 存储模型：Postgres 单表 `ModelProviderPlugin`（`lib/db/schema.ts:130-161`：definition jsonb、AES-256-GCM 加密凭据、enabledModels/healthStatus 等；架构文档 §7 规划的四表合并成了单表）；构建产物落本地 `.piwork/artifacts|staging`；zip 原包不持久化；Vercel Blob 只用于聊天附件，与插件无关。

### 3.3 两套"扩展 API"对比

| 维度 | pi ExtensionAPI（pi-coding-agent） | piwork PiworkLlmExtensionAPI |
| --- | --- | --- |
| 能力面 | 工具/命令/事件/快捷键/provider/消息注入/会话控制 | 仅 `registerProvider` |
| 代码形态 | TS 模块（jiti 直跑，无需构建） | TS 源码 zip（必须走宿主 esbuild 构建） |
| 运行位置 | pi 进程内，全 OS 权限 | 独立 worker 沙箱 |
| 网络访问 | 不限 | `networkHosts` 白名单 |
| 凭据 | 进程环境/auth.json，扩展可读 | 仅激活时注入，脱敏 logger，禁止持久化 |
| 分发 | npm/git/本地/画廊 | zip 上传/内置目录 |
| 注册表 | settings.json packages 声明 | 数据库 installation 记录（进程内 registry 缓存） |
| 信任模型 | 可信代码，无沙箱 | 零信任，逐层校验 |

**这是本次调研最重要的结构性发现：pi 与 piwork 对"第三方代码"的信任假设正好处于两个极端。**

---

## 4. 可行性分析

### 4.1 "在 piwork 通过网页安装 pi 插件"

**pi 官方侧**：不存在网页安装通道（§2.3）。`pi install` 是终端 CLI 动作，落点是用户家目录 `~/.pi/agent`（可用 `PI_CODING_AGENT_DIR` 重定向，见 configuration 页）。

**piwork 侧自建**是唯一路径，且先例齐全，工程上可行：

1. **目录源**：画廊背后就是 npm（`pi-package` keyword）。piwork 管理端可以直接查 npm registry（`https://registry.npmjs.org/-/v1/search?keywords=pi-package`）拿到与 pi.dev/packages 同源的数据，自建浏览/搜索 UI。
2. **安装动作**：服务端执行等价于 `pi install npm:xxx` 的操作——在受控的每租户/全局插件目录里跑 npm install（钉版本）、解析包的 `pi` 键/约定目录、写入 piwork 自己的注册表（DB），而不是写 settings.json。
3. **供给运行时**：通过自定义 `ResourceLoader`（§2.5）把 DB 注册表映射成资源发现——这正是 SDK 官方为"宿主自管资源存储"设计的接口。`DefaultResourceLoader` + `PI_CODING_AGENT_DIR` 指向受控目录也可作为过渡。
4. **先例**：piwork 已有"管理页选包 → install → 建记录 → 刷注册表 → 进聊天链路"的完整网页安装流水线（§3.2），把"包源从内置目录换成 npm"是模式复制而非模式发明。

### 4.2 "安装后用于 piwork"：三条路线

| 路线 | 做法 | 保真度 | 工程量/风险 |
| --- | --- | --- | --- |
| **A. 升级到 pi-coding-agent SDK** | 用 `createAgentSession()` + 自定义 `ResourceLoader` 替换/包裹 `app/(chat)/api/chat/route.ts` 里的自建 `new Agent()` loop | 最高：ExtensionAPI、事件、工具、inline extensions 全部官方语义 | 重构聊天主链路；需把 piwork 现有 customTools/skills/deliver-file 映射进 session 工厂；版本对齐已验证（0.83.0 存在） |
| **B. pi RPC sidecar** | 每会话/每租户 spawn `pi --mode rpc` 子进程，`PI_CODING_AGENT_DIR` 指向受管目录；网页安装=在该目录执行 `pi install` | 高：连 jiti/TUI 之外的官方行为都原样保留 | 进程管理、生命周期、流式转发成本高；Web 端转 RPC 事件桥接量大 |
| **C. 自实现兼容层** | 在现有 pi-agent-core loop 上实现 `ExtensionAPI` 子集（`registerTool`/`on` 事件/`registerProvider`），加载体外 npm 安装的扩展 | 中：只能覆盖子集，官方 API 演进要持续追赶 | 不动主链路，短期 cheapest；长期是自造轮子债 |

**建议：A 为目标态，C 不做或只做一次性验证，B 视隔离需求作为 A 的补充**（对高权限扩展用 sidecar 隔离，对受信扩展用 SDK 内嵌）。

### 4.3 兼容性与安全风险清单

1. **安全模型冲突（最大风险）**：pi 扩展 = 全权限可信代码；piwork 现有插件 = 零信任沙箱。在 **Web 服务器上**安装并运行第三方 npm 扩展 = 把 RCE 面开给 npm 上的任意发布者（画廊有 report 机制但无审核）。piwork 已有的 static-scan / worker 隔离 / `networkHosts` 思路必须延伸到 pi 扩展，且要接受"官方扩展假设它们能读进程环境与文件系统"带来的功能性折损（读不到真实凭据/文件的扩展可能直接失效）。
2. **TUI 依赖**：`ctx.ui` 是终端 UI。json/print 模式无 UI 是官方既定行为，扩展被要求用 `ctx.mode`/`ctx.hasUI` 守卫——意味着**纯工具/事件/provider 类扩展可用，TUI 组件类扩展在 Web 宿主里天然不可用**。画廊选型时要按此过滤；slash 命令的触发入口需要 piwork 前端自建（官方命令菜单是终端交互）。
3. **宿主包版本对齐**：扩展的 peerDependencies 用 `"*"` 引用宿主包（`pi-ai`/`pi-agent-core`/`pi-coding-agent` 等），要求宿主在进程里提供兼容版本。升级路径已评估（0.83.0 → 0.87.1，附录 C）：两包先行、`pi-coding-agent` 于 Phase B 三包同代引入（共存实测无冲突）。
4. **注册表与多租户**：pi 的 settings.json/`~/.pi/agent` 是单用户全局模型；piwork 是 installation（一插件多实例）+ DB 注册表 + 多用户。需要自定义 ResourceLoader/settingsManager 做映射，`project_trust` 这类信任事件在 Web 宿主里也要重新定义语义。
5. **事件面差异**：piwork 自建 loop 的事件（`tool_execution_start/end` 等）与 pi 的扩展事件（`tool_call`/`agent_before_settle` 等）不同名不同义；路线 A 天然对齐，路线 C 需要逐一映射。
6. **与现有 piwork-llm-* 的关系**：pi provider extension 与 `piwork-llm-*` 注册的是同一个 `Provider` 抽象（§3.2），且参考插件 `piwork-llm-deepseek` 内部就是复用 pi-ai 的 `openAICompletionsApi` 官方实现（含 DeepSeek compat 配置）——两套体系在协议原语层已经同源。若引入 pi 扩展运行时，可收敛为：`piwork-llm-*` 继续作为**沙箱化供应商子集**，pi provider extension 作为**全功能可信层**；或长期把 `piwork-llm-*` 重新包装成受限的 pi 扩展。这是架构决策点，不是技术障碍。
7. **skill 类资源是低成本快赢**：pi 包中的 skills/prompts/themes 是**静态资源不跑代码**，网页安装它们没有 RCE 面。更重要的是，piwork 的 skills 层**本来就是用 pi-agent-core 的 `loadSkills`/`formatSkillsForSystemPrompt` 装载的**（`lib/ai/skills.ts:2-10`）——即 piwork 的 skill 格式就是 pi 的 skill 格式，且管理端已有完整的 skills zip 上传流水线（`app/(management)/api/management/skills/route.ts` + DB `Skill` 表）可复用。剩余工作主要是"从 pi 包目录提取 skills 资源"而非"发明格式适配"。

---

## 5. 建议路线图

**Phase 0 —— 依赖升级（✅ 已完成，2026-09-25，见附录 C.7 执行记录）**
- `pi-ai`/`pi-agent-core` 0.83.0 → 0.87.1；`loadSkills` 第 3 参、faux context 的 `systemPrompt` 折叠、harness 工具 execute 重排与 `env.*` 方法 context 尾参均已迁移；typecheck / biome / `plugin:verify` 31 项 / e2e 相关面全绿。版本窗口（附录 B.2）已打开。

**Phase A —— 静态资源先行（低风险快赢）**
- 管理端接入 npm `pi-package` 目录源（浏览/搜索/详情）：registry 搜索 API 已实测可用（`https://registry.npmjs.org/-/v1/search?text=keywords:pi-package`，2026-09-25 返回 10638 项，含名称/版本/描述/keywords，与 pi.dev/packages 画廊同源）。
- 支持网页安装 pi 包中的 **skills/prompts**（跳过 extensions/themes）：piwork 的 skills 已用 pi-agent-core 的 `loadSkills` 装载（格式兼容经实测确认，附录 E.3），且已有 skills zip 上传 API/UI 流水线可复用——增量工作是从 npm 安装的 pi 包里提取 `skills/` 资源并纳入现有管理端（DB `Skill.source` 枚举需从 `catalog|upload` 扩展出 `pi-package` 类目，`lib/db/schema.ts:116`）。
- 落点：`/management/tools` 管理页（`app/(management)/management/tools/page.tsx` 现为占位页，section 定义已就绪——"MCP / API / 插件 · 接入与管理"，`lib/management/sections.ts:36-43`）。

**Phase B —— 扩展运行时引入（架构升级，可行性已由附录 E spike C 实证）**
- 引入 `@earendil-works/pi-coding-agent@0.87.1`（与升后的两包同代，共存已验证，附录 C.4），用 `createAgentSession()` + `DefaultResourceLoader`（带 `extensionFactories`/`noSkills` 过滤）替换聊天 route 的自建 Agent loop。spike C 已证明该形态下官方插件 + piwork 工具 + piwork 声明式 Provider 三层共存、全链路执行（附录 E.1）。
- 工程桥接点（spike C 实测沉淀，附录 E.4）：调用方传入的 resourceLoader 必须先 `await reload()`；扩展身份断言用 `sourceInfo.source`；模型凭据必须经 `CredentialStore`（piwork 用 DB 实现 `read/list/write` 三方法后传 `ModelRuntime.create({credentials})`）或 `<PROVIDER_ID>_API_KEY` 环境变量注入——**provider 对象内联的 auth resolver 过不了会话的 prompt 前置鉴权**；piwork 事件桥接层可直接复用（`tool_execution_start/end` 事件同名）。
- 网页安装扩展限**管理员手动白名单**（人工审源码后才可装），不开放普通用户。

**Phase C —— 安全治理与规模化**
- 把 static-scan/worker 隔离/网络白名单扩展到 pi 扩展执行；定义 Web 宿主下的能力降级清单（文件系统视图、凭据注入、`ctx.ui` 缺席时的行为）。
- 高权限扩展走 sidecar（路线 B）隔离；评估多租户 agent-dir 策略。
- 决策 `piwork-llm-*` 与 pi provider extension 的收敛方向。

**验证成本估计**：Phase A 约为一次中型 feature；Phase B 是一次架构级改造（聊天主链路重构 + 回归）；Phase C 是持续工程。

---

## 6. 开放问题（2026-09-25 附录 A/E 验证后更新，原列 5 项已全部关闭）

1. ~~`pi install npm:` 在 0.83.0 的确切落盘布局~~ **已验证**：用户级 `<agentDir>/npm/node_modules/<name>`、项目级 `<cwd>/.pi/npm/node_modules/<name>`、单次试用走临时目录；`agentDir` 可整体自定义 → piwork 用受管目录（如 `.piwork/` 下）即得自包含安装根。见附录 A.2。
2. ~~pi skill 与 piwork skill 的目录/manifest 字段级差异~~ **已验证兼容**（2026-09-25，附录 E.3）：piwork skill 与 pi skill 本就共用同一个加载器 `loadSkills`（pi-agent-core），格式同源是构造性事实；画廊头部 skills 包 bigpowers（81 个 SKILL.md）实测全部通过 piwork 约束——name 全部匹配 `^[a-z0-9-]+$`、无保留名冲突、frontmatter 同为 `name`+`description`（pi 特有的 `model`/`effort` 字段被加载器安全忽略），description 长度在 piwork DB 1024 上限内。Phase A 的增量工作确认为"从 pi 包提取 skills 资源进现有流水线"，无格式适配层。
3. ~~`createAgentSession` 与现有工具的兼容性~~ **已验证**：`customTools: ToolDefinition[]` / `resourceLoader` / `sessionManager`（支持 `inMemory()`）/ `settingsManager` / `agentDir` / `model` 全部可注入；session 级无 `NodeExecutionEnv` 参数（SDK bash 工厂收 `env?: NodeJS.ProcessEnv`），piwork 现有工具需薄适配到 `ToolDefinition`。见附录 A.2。
4. ~~自定义 `ResourceLoader` 的 interface 形状~~ **已验证**：接口仅 7 个 getter + `extendResources` + `reload`；且 `DefaultResourceLoaderOptions` 自带 `additionalExtensionPaths`/`additionalSkillPaths`/`extensionFactories`（inline 工厂）与每类资源的 `*Override` 钩子——**大概率无需自写 ResourceLoader 类**。见附录 A.2。
5. ~~无 TUI 宿主下的实际行为面~~ **已抽样验证**：10 个头部包中约 4 个无头可用、3 个部分可用（工具可用/对话框与命令不可用）、3 个 TUI 重度不可用；头部作者普遍以 `hasUI`/`ctx.mode` 守卫。见附录 A.1。

## 附录 A：第 1 步验证结果（2026-09-25 实测）

> 方法：抽样包与 SDK 均从 npm 拉取真实 tarball（`npm pack`）解压分析源码，非文档推断。临时目录分析，未改动仓库。

### A.1 生态价值抽样（画廊 Top 10 包无头可用性）

按"纯工具/事件/provider（✅ Web 宿主可用）→ 工具可用但对话框/命令依赖 UI（⚠️ 部分）→ TUI 组件是产品本体（❌）"分级：

| 包 | 类型 | 无头可用性 | 依据（源码符号统计） |
| --- | --- | --- | --- |
| @langfuse/pi-observability-plugin | 事件观测 | ✅ | 零 `registerTool`，纯事件订阅；`hasUI` 守卫齐全 |
| billion-context | provider + tools | ✅ | 20×`registerProvider`、24×`registerTool`、无 `ctx.ui`/`pi-tui` |
| pi-memory | tools + 事件 | ✅ | 7×`registerTool`，UI 用量极小且有守卫 |
| bigpowers | skills + extension | ✅（skills 可立即用） | `skills/` 约定目录；extension 侧 30×`registerTool`、仅 1×`ctx.ui` |
| pi-mcp-adapter | MCP 工具 | ⚠️ | 核心 12×`registerTool`；51×`hasUI` 守卫（headless-aware）；42×`ctx.ui` 集中在配置/状态对话框 |
| pi-web-access | 搜索/抓取/PDF | ⚠️ | 10×`registerTool` + 55×`ctx.mode` 守卫；32×`ctx.ui` |
| pi-ast-guard | 安全钩子 | ⚠️ | 事件钩子（`tool_call`/`tool_result`）可用；7×`registerCommand` + 5×`ctx.ui` 不可用 |
| @gotgenes/pi-permission-system | 权限系统 | ❌ | 18×`ctx.ui`、9×`pi-tui`——交互式权限对话框即核心 UX |
| pi-subagents | 子代理编排 | ❌ | 72×`ctx.ui`、28×`pi-tui`、20×`registerCommand`——终端面板即产品 |
| @quintinshaw/pi-dynamic-workflows | 工作流 | ❌ | 144×`ctx.ui`、15×`pi-tui` |

**结论**：约 40% 无头全可用、30% 部分可用（工具能注册、UI/命令缺失）、30% TUI 不可用。高价值目标（MCP、web 访问、记忆、观测、上下文压缩）恰好集中在可用/部分可用区；且头部包普遍以 `hasUI`/`ctx.mode` 写了无头守卫，生态对嵌入式宿主友好度超预期。部分可用档的"工具在无 UI 时是否照常注册"需在 spike 中实测确认。

### A.2 SDK 接口事实核查（@earendil-works/pi-coding-agent@0.83.0）

对报告 §6 三个问题的答案，全部来自 dist `.d.ts`/`.js` 实测：

1. **`ResourceLoader` 接口形状**（`dist/core/resource-loader.d.ts`）：仅 `getExtensions/getSkills/getPrompts/getThemes/getAgentsFiles/getSystemPrompt(getAppendSystemPrompt)/extendResources/reload`——纯数据供给接口，无文件系统耦合。**关键发现**：`DefaultResourceLoaderOptions` 自带 `additionalExtensionPaths`/`additionalSkillPaths`/`additionalPromptTemplatePaths`/`additionalThemePaths`、`extensionFactories`（inline 扩展工厂）以及每类资源的 `*Override` 钩子（如 `skillsOverride(base)` 可整段替换为 DB 查询结果）→ **piwork 大概率无需实现自定义 ResourceLoader 类，用 Default + 附加路径/覆盖钩子即可接自己的注册表**。
2. **`createAgentSession` 注入点**（`dist/core/sdk.d.ts:10-60`）：`cwd`/`agentDir`/`model`/`modelRuntime`/`customTools: ToolDefinition[]`/`resourceLoader`/`sessionManager`（支持 `SessionManager.inMemory()`）/`settingsManager`/`tools`(allowlist)/`excludeTools`/`noTools`。工具工厂（`createBashTool`/`createCodingTools`/`withFileMutationQueue` 等）直接从 SDK 根导出。session 级无 `NodeExecutionEnv` 参数，bash 工厂收 `env?: NodeJS.ProcessEnv`（`dist/core/tools/bash.d.ts:30`）；piwork 现有 `AgentTool` 需薄适配到 `ToolDefinition`（name/label/description/parameters(TypeBox)/execute，形状接近）。
3. **`pi install npm:` 落盘布局**（`dist/core/package-manager.js:1648-1677`）：用户级 `<agentDir>/npm/node_modules/<name>`；项目级 `<cwd>/.pi/npm/node_modules/<name>`；`pi -e` 单次试用走临时目录；`getExtensionTempFolder` = `<agentDir>/tmp/extensions`（0700）。**`agentDir` 全局可自定义 → piwork 指定受管 agentDir 即得到自包含、可按租户/按环境隔离的安装根，与宿主用户的 `~/.pi` 完全不冲突。**
4. **超预期发现：`PackageManager` 是公开编程接口**（`dist/core/package-manager.d.ts`）：`install`/`installAndPersist`/`remove`/`update`/`listConfiguredPackages`/`getInstalledPath`，且带 `ProgressCallback`（start/progress/complete/error）进度事件。**piwork 的"网页安装"可以直接在服务端调 `DefaultPackageManager`，无需 spawn pi CLI 子进程**，进度还能实时推给前端。
5. **版本与依赖**：0.83.0 的 dependencies 为 `pi-agent-core ^0.83.0`/`pi-ai ^0.83.0`/`pi-tui ^0.83.0` + jiti/proper-lockfile/semver/hosted-git-info/glob 等（自带包管理机制）；bin 即 `pi` CLI（`dist/cli.js`）。与 piwork 现有 0.83.0 依赖同代，无版本冲突。

### A.3 对路线图的影响

- Phase A/B 的"安装动作"统一收敛为服务端调 `DefaultPackageManager.installAndPersist()` + 受管 agentDir，比原设想（自拼 npm install 命令）更简单、且天然继承 git/local/过滤等全部官方语义。
- 路线 A 的迁移成本下修：无需自写 ResourceLoader；主要工作剩"自建 loop → `createAgentSession`"的会话桥接与 `ToolDefinition` 适配。
- 生态可用性确认：MCP/搜索/记忆/观测/上下文压缩等高价值包落在无头可用区，值得做；TUI 重度包（编排面板、权限对话框）明确排除在范围外。

## 附录 B：pi-mcp-adapter 无头验证实录（2026-09-25 spike）

> 目的：回答"怎么验证一个工具插件"。场地 `/tmp/pi-verify/spike-a|b/`（独立 npm 项目，受管 agentDir，不碰 piwork 仓库与用户 `~/.pi`）。验证五级：P0 加载 / P0 注册 / P1 执行 / P1 交互面 / P2 集成。harness 三个脚本：`install-pkg.mjs`（程序化安装）、`verify-headless.mjs`（加载+注册检查）、`verify-exec.mjs`（faux 模型驱动端到端执行）。

### B.1 总结果

| 验证项 | A 组（0.83.0 + adapter 2.20.0） | B 组（0.87.1 + adapter 2.37.0） |
| --- | --- | --- |
| 程序化安装 `installAndPersist("npm:...")` | ✅ 3s / 42 依赖 | ✅ 4s / 44 依赖 |
| 无头加载（非 TUI、无真实 LLM） | ❌ 旧版自身依赖 bug（`ext-apps` 找不到 `sdk/types.js`） | ✅ extensions=1、errors=none |
| 工具注册 | —（加载失败） | ✅ `[read, bash, edit, write, mcpScript, mcp]` 与默认工具共存 |
| 端到端执行（echo MCP server） | — | ✅ 两次 `tool_execution_end`，第二次 `result.content[0].text === "echo: hello from piwork spike"`、`details: {mode:"call", server:"echo", tool:"echo"}` |
| 包内 skill 资源 | ✅（`mcp-scripting` 出现在 skill 列表） | ✅（经 extension 注册，session 创建后可见） |

**结论：验证方法成立；且"网页安装 pi 插件并用于 piwork 聊天"的全链路（安装→加载→注册→执行）在 0.87.1 栈上被完整证明可行。**

### B.2 版本窗口（重要约束）

- adapter 2.21.2 起 peer 要求 `pi-ai ^0.84.1`；**2.20.x 是最后接受 `"*"` 的版本线，且 2.20.0 自带依赖树 bug（A 组实测加载失败）**。
- 含义：piwork 现状 0.83.0 基本骑不上当前生态（旧版有坑、新版装不上），**要消费 pi 生态就必须把 `pi-ai`/`pi-agent-core`/`pi-coding-agent` 同步升到 0.87.x**。这从"纪律建议"升级为"硬前提"。

### B.3 过程中的机制发现（对 piwork 直接有用）

1. **`~/.agents/skills` 泄漏（安全发现）**：`DefaultResourceLoader` 即使指定了自定义 `agentDir`，也会扫用户全局 `~/.agents/skills/`（A/B 组均复现：32 个本机 skill 混入）。切断方案已找到：skill 对象带 `sourceInfo.baseDir` 来源字段，用 `skillsOverride`（或 `noSkills` + 受管 `additionalSkillPaths`）按 baseDir 白名单过滤即可。piwork 服务器上必须做。
2. **模型注入即 `registerProvider`**：faux 测试模型通过 inline extension factory `pi.registerProvider(faux.provider)` 注入 session 的 ModelRuntime 才能参与流式——**这正是 piwork `piwork-llm-*` 插件映射进 pi 扩展运行时的同构路径**（两者注册的都是 pi-ai `Provider`），路线 A 的模型层迁移方案由此坐实。
3. **测试要领**：`fauxAssistantMessage` 默认 `stopReason: "stop"`，必须显式 `{ stopReason: "toolUse" }` 才触发工具执行；`prompt()` 有鉴权前置，`models.json` 里给 provider 配 `apiKey: "dummy"` 即可通过（官方文档明示的测试模式）。
4. **事件名兼容**：`AgentSession` 事件流含 `tool_execution_start/end`——与 piwork 聊天 route 现在订阅的 pi-agent-core 事件同名，**piwork 的事件桥接层（`app/(chat)/api/chat/route.ts:418+`）可直接复用**。
5. **系统提示自动集成**：扩展工具（`mcp`/`mcpScript`）自动出现在 system prompt 的 `<tools>` 段——piwork 无需自建工具清单注入逻辑。
6. **MCP 配置发现**：adapter 自动读 cwd 的 `.mcp.json` 并懒连接 stdio server（首次 `mcp({connect})` 时 spawn），无 UI 依赖，适合 Web 宿主。

### B.4 验证方法沉淀（对任意工具插件通用）

1. `DefaultPackageManager.installAndPersist("npm:<pkg>@<ver>")` 装进受管 agentDir（网页安装同路径）；
2. `DefaultResourceLoader` + `createAgentSession({sessionManager: inMemory()})` 无头建会话，查 `extensionsResult.errors` 与 `session.getActiveToolNames()`（P0）；
3. faux 模型脚本化 `fauxToolCall(..., {stopReason:"toolUse"})` 响应序列驱动 `session.prompt()`，订阅 `tool_execution_end` 检查真实结果（P1，零 API key）；
4. 读 `extensionsResult` 的 commands 列表评估 Web 端需要自建的触发入口（P1 交互面）；
5. 全程 grep 源码统计 `ctx.ui`/`pi-tui`/`hasUI` 用量预判无头兼容档位（附录 A.1 方法）。



## 附录 C：pi 三包 0.83.0 → 0.87.1 升级评估（2026-09-25 实测）

> 方法：先 grep 枚举 piwork 对 `pi-ai`/`pi-agent-core` 的**完整导入面**（约 30 个符号、含 `api/openai-completions.lazy` 子路径），再对两版 npm tarball 解压产物做逐符号 `.d.ts` diff；关键行为疑点用独立 npm 项目实测（faux context 形状、三包共存去重），不空口推断。材料在 `/tmp/pi-verify/versions/` 与 `/tmp/pi-verify/coexist/`。

### C.1 结论

**建议升级，风险低，工作量约 1 个工作日（含回归）。** piwork 完整导入面上只命中 1 处编译破坏 + 1 处静默运行时破坏，其余全部确认为兼容或纯新增。升级同时把附录 B.2 的"版本窗口"约束（pi-mcp-adapter 2.21.2+ 要求 `pi-ai ^0.84.1`）从硬阻塞变为已解决，并为 Phase B 铺平（`pi-coding-agent@0.87.1` 共存已验证）。

### C.2 破坏性变更清单（按 piwork 命中情况）

| # | 变更（0.83.0 → 0.87.1） | piwork 命中点 | 性质 | 修复 |
| --- | --- | --- | --- | --- |
| 1 | `loadSkills(env, dirs)` → 新增第 3 参 `context: Context`（chord 异步上下文） | `lib/ai/skills.ts` **6 处调用**（:216,231,241,289,395…） | **编译破坏** | 传 `BACKGROUND_CONTEXT`——0.87 的包根 `index.d.ts` 新增 `export * from "./harness/context.ts"`，可直接 `import { BACKGROUND_CONTEXT } from "@earendil-works/pi-agent-core"` |
| 2 | provider 收到的上下文规范化：`systemPrompt` 折叠进 `messages` 首条 `SystemMessage`，`TranscriptContext` 无 `systemPrompt` 字段（**实测确认**） | `lib/ai/pi.ts:48` 的 faux 工厂读 `context.systemPrompt?.includes("Generate a short chat title")` | **静默运行时破坏**（TS 不报错：piwork 自己把参数标注为 `Context`，字段运行时变 `undefined`） | 改为扫 `context.messages` 中 `role === "system"` 的消息文本；不修则 e2e 标题断言从 "Test Conversation" 静默退化为通用 mock 文案 |
| 3 | `Provider.stream/streamSimple` 与 `StreamFunction` 的 `context` 参数类型 `Context` → `TranscriptContext`（品牌化，仅 `normalizeContext()` 可产出） | piwork 模型插件是**声明式 Provider**（`createProvider({api: openAICompletionsApi(), ...})`，不手写 stream，`plugins/piwork-llm-deepseek/src/index.ts:54-72`） | **不命中** | 无。声明式的协议转发由 pi-ai 内部消化；将来若手写 stream，实现参数声明更宽的 `Context` 也满足接口（TS 方法协变 + TranscriptContext 是 Context 子类型） |
| 4 | `BashPrepare`/`ReadImageProcessor` 回调签名追加 `context: Context`；`TruncationResult` → `ShellOutputTruncation` | `lib/ai/agent-tools.ts:76-79` 四个工厂**全部无参调用**，未用任何回调 | 不命中 | —（未来想用 prepare 回调时按新签名写） |
| 5 | `Message` 联合新增 `SystemMessage`；`FauxResponseFactory` 的 state 扩展为 `FauxProviderState`（`callCount` 保留）、`stream` 收参 `StreamOptions` → `SimpleStreamOptions` | pi.ts faux 用法只读 context、不走 state；piwork 无消息类型穷举 switch | 兼容/低风险 | — |
| 6 | 根目录散置 `.md` skill 现在要求 frontmatter | piwork skills 走 DB+zip 目录形态 | 低风险 | 留意导入外部 skill 时的报错信息 |
| 7 | `AgentHarnessTool.execute` 重排为 `(toolCallId, params, onUpdate, toolContext, invocation, context)`——**signal 参数移除**，改经 chord context 传递；`onUpdate` 变必传 | `lib/ai/agent-tools.ts` 的 `bindToolContext` 适配层 | **编译破坏**（实施时发现，见 C.7：评估阶段 diff 集未含 `harness/types.d.ts`） | 适配层重写：`withAbortSignal(signal, BACKGROUND_CONTEXT)` 桥接取消信号；invocation 给 no-op（内置工具不读 memo） |
| 8 | `FileSystem`/`Shell` 接口全部方法（readTextFile/writeFile/createDir/remove/listDir/exec/cleanup…）新增尾参 `context: Context` | `lib/ai/skills.ts` 33 处 `env.*` 调用 | **编译破坏**（实施时发现，同上） | 各调用点补 `BACKGROUND_CONTEXT` 尾参 |

### C.3 确认无变化的高风险面（diff 零差异）

- **Agent 类与 AgentOptions**（`agent.d.ts`：仅新增可选 `finishTurn`/`prepareRequest`）——聊天主链路 `new Agent(...)` 不动；
- **工具 execute 5 参签名**（`tools/index.d.ts` 零差异）——`bindToolContext`（`lib/ai/agent-tools.ts:62-71`）不动；
- `node.d.ts`、`edit.d.ts`、`write.d.ts`：零差异；
- **`Models.streamSimple` 仍收 `Context`**（`models.d.ts:142`）——piwork 热路径 `streamPiAgent`（`lib/ai/pi.ts:162-172`）不动；`TranscriptContext` 只出现在 Provider 实现侧接口（`:93`）；
- `utils/event-stream.d.ts`（`createAssistantMessageEventStream`）零差异；`api/openai-completions.lazy.d.ts` 零差异（deepseek 插件路径）；
- `formatSkillInvocation`/`formatSkillsForSystemPrompt` 未变；
- exports map 仅新增（如 `cloudflare-ai-binding`），无删除。

### C.4 依赖与三包共存（实测）

- 新增运行时依赖：`@earendil-works/chord@0.87.1`、`@earendil-works/pi-telemetry@0.87.1`（均被正确提升为单副本）；typebox 1.3.7 → 1.3.27。
- **`pi-ai` + `pi-agent-core` + `pi-coding-agent` 三包 0.87.1 共存**（独立 npm 项目实测）：版本解析全部一致无冲突。npm 布局下 `pi-coding-agent/node_modules/` 内保留了 `pi-ai`/`pi-agent-core` 的嵌套副本——同版本、接口全鸭子类型、`TranscriptContext` 品牌仅存在于类型层（JS 无运行时检查），跨副本传 Provider/Model 对象安全（附录 B spike 即此布局跑通全链路）。**piwork 实际使用 pnpm**，默认符号链接布局下大概率解析为同一副本；升级 PR 里用 `pnpm why @earendil-works/pi-ai` 复验一次即可。
- **本次升级不必引入 `pi-coding-agent`**：仅升 `pi-ai`/`pi-agent-core` 两包即可完成；三包对齐是 Phase B 届时的事。

### C.5 迁移步骤（建议顺序）

1. `package.json`：`pi-ai`/`pi-agent-core` 0.83.0 → 0.87.1（`pi-coding-agent` 暂不加）；`pnpm install`。
2. `lib/ai/skills.ts`：6 处 `loadSkills(env, dir)` → `loadSkills(env, dir, BACKGROUND_CONTEXT)`（新增一行 root import）。
3. `lib/ai/pi.ts`：faux 工厂的标题判断从 `context.systemPrompt` 迁到 system 消息扫描（防 #2 静默破坏）。
4. 重建模型插件 artifacts：`lib/model-plugins/build.ts` 的 externals 是裸导入名 + 宿主 node_modules symlink，重建即自动指向 0.87 产物；随后 `pnpm plugin:verify`（真实 DeepSeek 调用回归）。
5. `pnpm typecheck` + 全量 e2e（faux 路径已被步骤 3 修复，标题断言可作升级回归的哨兵）。
6. `pnpm why` 复验副本唯一性。

### C.6 风险评估

- **代码量**：评估估 ~2 文件 ~10 行；实际 ~3 文件 ~50 行（C.7 执行记录：#7/#8 两处评估漏项贡献了主要增量），仍在 1 天内完成。
- **最大风险类别**恰是 #2 那类"类型层不报错的运行时行为漂移"（systemPrompt 折叠、faux state 扩展都是这一类）——已通过实测逐一排雷；若后续 0.87 → 更高版本，同样方法可复制（枚举导入面 → 逐符号 diff → 行为疑点实测）。**C.7 的教训：diff 集必须覆盖 `harness/types.d.ts` 这类"接口聚合文件"，编译器（tsc）是比抽样 diff 更可靠的最终裁判。**
- **不做升级的代价**（对照附录 B.2）：0.83.0 骑不上当前 pi 生态（新版包装不上、旧版包有坑），Phase A/B 全部被阻塞。

### C.7 执行记录（2026-09-25 实施完成）

**改动**（3 文件 + package.json）：
1. `package.json`：两包 0.83.0 → 0.87.1；`pnpm install` 后 `pnpm why` 确认 pnpm 布局单副本（`Found 1 version` ×2，优于附录 C.4 的 npm 嵌套副本观察）。
2. `lib/ai/skills.ts`：8 处 `loadSkills` + 33 处 `env.*` 调用补 `BACKGROUND_CONTEXT` 尾参（评估只预见了前者）。
3. `lib/ai/agent-tools.ts`：`bindToolContext` 按 #7 重写（`withAbortSignal` 桥 + `NOOP_INVOCATION` stub + onUpdate 默认值）；`env.cleanup(BACKGROUND_CONTEXT)`。内置工具源码经 grep 确认不读 `invocation` memo，stub 安全；`NodeExecutionEnv` 内部读 `context.abortSignal`（nodejs.js:329,398），桥接方向已核实。
4. `lib/ai/pi.ts`：faux 工厂按 #2 迁移（`systemPrompt` 字段 + system 消息双形态检查）。

**回归结果**：
| 验证项 | 结果 |
| --- | --- |
| `tsc --noEmit` | ✅ 0 错误 |
| `pnpm check`（ultracite/biome） | ✅ 通过 |
| `pnpm plugin:verify`（真实 DeepSeek） | ✅ 31/31——含流式、thinking 流、abort、凭据校验，证明声明式 Provider 在 0.87 下真实工作 |
| e2e `models.test.ts`（插件安装→配置→卸载） | ✅ 2/2 |
| e2e 其余（chat/api/auth/model-selector/organization/roles，共 36 项） | ✅ 首轮全量通过 |
| e2e `members.test.ts` | ⚠️ 存在既有的会话建立 flake（注册后落在 /login，240s 超时；失败点两次运行间漂移 186→168）。该链路与 `lib/ai`/pi 包零依赖（grep 证实 members/auth 页面不 import lib/ai），且首轮全量中同文件多数用例通过——判定与升级无关，建议单独跟踪 |

**过程发现**：
- 评估漏项 #7/#8 的根因：0.87 的 `.d.ts` diff 集按"piwork 导入符号所在文件"抽样，漏了 `harness/types.d.ts`（FileSystem/Shell/AgentHarnessTool 接口聚合处）；tsc 一轮即全部暴露。
- e2e `models.test.ts` 的插件安装用例依赖干净库（`piwork-llm-deepseek` 行残留会导致 409），afterAll 兜底清理——与团队"测试后清库"约定一致；注意该用例会删除库里任意来源的同 packageId 行。

## 附录 D：第三方 pi-web 宿主调研（2026-09-25 实测）

> 对象：https://github.com/jmfederico/pi-web（`@jmfederico/pi-web`）。方法：浅克隆 main（对应 1.202609.1，2026-09-22 发布）做源码级审读 + npm registry 元数据核实；与本报告 §4 路线 A/B 及附录 B spike 结论互证。材料：`/tmp/pi-verify/pi-web/`。**本附录为源码审读结论，未在本机实际安装运行 pi-web。**

### D.1 身份与定位

- **第三方项目**（作者 Federico Jaramillo Martinez，MIT），非 earendil/pi 官方出品；站点 pi-web.dev。
- 定位原文："Web UI for persistent Pi Coding Agent sessions in real workspaces"——让 pi 会话**常驻**在一台机器的真实工作目录里（服务器/台式机/云 VM），浏览器随时接入，而非 piwork 那种每会话独立工作区的多租户 SaaS 形态。
- 活跃度：npm 首发 2026-05-09，最新 1.202609.1 发布于 2026-09-22（三天前），周下载约 1.1k；changesets 驱动、测试覆盖极重（几乎每个源文件配 `.test.ts`）。
- 形态：三个 bin（`pi-web`/`pi-web-server`/`pi-web-sessiond`），原生按用户级服务安装（Linux systemd user / macOS launchd 双后端，`src/nativeServices/`），另有 beta Docker（注意：挂载 docker.sock 等宿主等价权限，仅限可信环境）。
- 版本要求：**peerDependencies 要求 `pi-agent-core`/`pi-ai`/`pi-coding-agent` >= 0.87.0**——与 piwork Phase 0 升级后的 0.87.1 精确同窗。

### D.2 架构：路线 A 的生产级存在证明

pi-web **不是** spawn `pi` CLI 子进程（路线 B），而是把 pi SDK 直接嵌进自家守护进程（路线 A）：

| 层 | 实现 | 证据 |
| --- | --- | --- |
| 会话宿主 | 常驻 sessiond（每用户一个服务），内部用 `createAgentSessionServices()` + `createAgentSessionFromServices()` + `createAgentSessionRuntime()` 创建/管理会话 | `src/server/sessions/piSessionService.ts:728,997,1028`（5148 行） |
| Web 网关 | Fastify + WebSocket（vite/lit 客户端），会话事件与浏览器消息投影 | `src/server/`、`browserMessageProjection.ts` |
| 组织模型 | Machine（运行端点）→ Project（文件夹）→ Workspace（provider 拥有、git worktree）→ Session（跑在 workspace 里的 pi 会话）；可联邦代理多台远程机器 | README、`src/server/app.machines.test.ts` |
| 资源装载 | `DefaultResourceLoader` 的覆盖钩子：`resourceLoaderOptions.appendSystemPromptOverride`（追加系统提示段） | `piSessionService.ts`（`piWebResourceLoaderOptions`） |
| project trust | **Web 版信任解析器**：镜像 SDK 流程——先装载预信任扩展集，回调让扩展经 `project_trust` 事件决定，结果写入 SettingsManager 后才加载项目级资源；无浏览器信任提示时不信任项目的资源直接跳过（与无 UI 的 `pi` 行为一致） | `piSessionService.ts:964-995`（`resolveWebProjectTrusted` + `ProjectTrustStore`） |
| 模型层 | 全 daemon 共享一个 ModelRuntime；目录刷新只在后台调度，请求路径永不触发 | `docs/config.md`（:327） |
| agentDir | `PI_CODING_AGENT_DIR`，默认 `~/.pi/agent`——**与用户 pi CLI 完全同源**（auth、models、settings、sessions、Pi packages）；会话里 spawn 的 `pi` CLI 看到同一份状态 | `docs/config.md:291,:220` |
| 工具定制 | `defineTool` 包装内置 edit 工具计算 diff 预览供 Web UI；`spawn_session` 子会话工具可按需启停 | `piSessionService.ts`（`createPiWebEditToolDefinition` 等） |
| 随宿主注入的 pi 扩展 | `extensions/pi-web.ts`：注册 `/pi-web` slash 命令（status/logs/restart/doctor…），甚至允许 agent 在用户明确授权下重启宿主 sessiond | `extensions/pi-web.ts:91` |
| pi 扩展对话框桥接 | confirm/select/input 三种 `ctx.ui` 对话框在网页会话流里**内联呈现**，浏览器刷新后仍可回答、跨标签页首答生效；其余 pi UI 面（自定义编辑器/widget）明确不支持 | `docs/plugins.md`「Pi extension dialogs」 |

**对本报告的直接意义**：§4.3 里列的三大宿主难题——project trust 语义（#4）、`ctx.ui` 依赖（#2）、事件桥接（#5）——pi-web 都给出了生产级解法，且证明 `createAgentSession*` 家族足以承载完整 Web 宿主。路线 A 的可行性从"SDK 文档 + 我们的 spike"升级为"第三方 5 千行级生产实现互证"。

### D.3 Pi 包的网页安装（与附录 B 完全互证）

`Settings → Pi packages` 输入 npm/git/URL/本地源 → 服务端执行安装。实现（`src/server/piPackageService.ts`）：

```ts
const settingsManager = SettingsManager.create(cwd, agentDir);
const manager = new DefaultPackageManager({ cwd, agentDir, settingsManager });
// listConfiguredPackages / installAndPersist / removeAndPersist / update / flush
```

- **正是附录 B spike 验证的 `DefaultPackageManager.installAndPersist()` 路径**——本报告 Phase A/B 的"安装动作统一收敛为服务端调 PackageManager"设计获得生产级背书。
- 工程细节可借鉴：变更走**串行 mutation 队列**（`enqueueMutation`，:127-136）；支持 user/project 两个 scope（project 即 `local: true`，:161-169）；装完 `settingsManager.flush()` 落盘；列表项带 `installedPath` 供身份解析。
- 内置"可装包"运营：Relays（对活跃 profile **自动安装**，用户移除会被记住不再静默重装）、Captain's Log / Workspace Reviews（示例，默认不装）——`knownAutoInstallPiPackages.ts` + dismissal store。

### D.4 生效与治理规则（安装 ≠ 启用）

| 变更 | 生效动作 |
| --- | --- |
| 浏览器-only PI WEB 插件 安装/修改 | 刷新页面 |
| 服务器端插件 安装/更新/启停 | **重启目标 sessiond**，再刷新页面 |
| 普通 Pi 资源（extensions/skills/prompts）变更 | 每个空闲会话里跑 `/reload` |
| 注册 model provider 的扩展变更 | 按"provider 重启指引"单独处理 |

配套治理设计（对 piwork Phase C 有直接参考价值）：

- **安装与启用分离**：一个包可同时含 pi 扩展/skills/.prompts 与 PI WEB 插件；禁用 Web 插件不影响包内 pi 扩展。
- **恢复通道**：`pi-web plugins disable <id> --restart`；safe-start 三档（`bundled-only`/`none`/`clear`）——插件把 daemon 搞挂时的逃生门，编辑配置不加载插件代码。
- **期望态 vs 活跃态**：daemon 重启前 Settings 会同时展示"期望/活跃"两态，配对浏览器入口在服务端不匹配时被扣留而非跑不兼容代码。

### D.5 PI WEB 插件（第二体系，与 pi 扩展并存）

- 形态：**browser entries**（panels/内容渲染器/action 命令/themes，Lit，跑在页面）+ **server entries**（跑在 sessiond，Node 进程权限）+ package peers（浏览器↔服务端通信，宿主代管 machine/workspace 归属）+ capabilities 声明式依赖（版本化，启动前校验）。
- 声明：包 `package.json` 的 `piWeb.plugins` 键；`activate()/start()/dispose()` + `lifetimeSignal` 生命周期；安装包限 4096 条目 / 16 MiB（.git、node_modules 除外）；`browserRoot` 之外不公开。
- API 治理警示：当前 browser API v4 / server API v3，**无兼容垫片**（2026-09 的 1.202609.1 刚破坏性升级）——第三方宿主插件生态同样面临 API churn 治理问题。
- 工作区 provider 可替换：Git 发现逻辑可被声明式接管（冲突可见报错、失败不静默移交）。

### D.6 安全模型

- 官方口径：**可信用户、可信仓库、可信服务器路径；不是沙箱、不是权限系统、不是多租户平台**。"Server entries run inside the session daemon with its filesystem, environment, and process permissions. They are not sandboxed"（`docs/plugins.md`「Trust and recovery」）。
- 网络：默认绑 `127.0.0.1`；远程访问要求私网 / SSH 隧道 / 带认证的可信反代 / fleet token 注册；明确"不要暴露公网"。
- Docker 模式挂载 docker.sock（宿主 root 等价）与宿主路径读写——进一步印证其信任假设。
- **结论**：pi-web 选择了与 pi 本体一致的"全可信"端，与本报告 §3.3 指出的 piwork 零信任插件模型是两个极端；piwork 不能把 pi-web 当作安全架构参照，但其"安装≠启用、生效矩阵、safe-start、期望/活跃双态"是纯治理层面的好设计，可平移。

### D.7 对 piwork 路线图的增量结论

1. **Phase B（路线 A）风险下修**：session 桥接、project trust、对话框、事件投影、工作区管理全部有了可抄的参考实现（piSessionService.ts 一处即 5148 行，含完整测试）。
2. **Phase A/B 的安装服务设计定稿**：照抄 `piPackageService.ts` 的骨架（SettingsManager + DefaultPackageManager + 串行队列 + scope + flush + installedPath 暴露），把落点从文件系统 settings.json 换成 piwork 的 DB 注册表即可。
3. **Phase C 治理清单扩充**：safe-start 恢复通道、期望/活跃双态展示、安装与启用分离三件套值得纳入。
4. **不可照搬**：单用户 agentDir（`~/.pi/agent` 与 CLI 同源）与 piwork 的多租户受管 agentDir 相反——恰好是附录 B 已验证可切断的点。
5. 若 piwork 只是想**先体验 pi 插件生态**（MCP、web-access 等），pi-web 是当下最快的个人途径（见 D.8），与 piwork 自建不冲突。

### D.8 直接用 pi-web 跑 pi 插件（操作手册，macOS/Linux）

```sh
# 1) 前置：Node >= 22.19，pi CLI >= 0.87 且已配置模型（pi 内 /login 或 models.json）
node -v && pi --version

# 2) 安装 pi-web（全局 npm 包；node-pty 需要跑安装脚本）
npm install -g @jmfederico/pi-web --allow-scripts=node-pty

# 3) 安装为按用户服务（macOS=launchd，Linux=systemd --user）；也可用 beta Docker
pi-web install
pi-web open        # 打开浏览器（默认 http://127.0.0.1:<port>）
```

然后在 Web UI 里装 pi 插件：

1. **Settings → Pi packages** → 输入源（如 `npm:pi-mcp-adapter`，也支持 git/URL/本地路径）→ Install；
2. 生效：普通扩展/skills 在空闲会话跑 `/reload` 或开新会话；带 PI WEB 插件的包再走 **Settings → PI WEB plugins** 启用 + 重启 sessiond（`systemctl --user restart pi-web-sessiond` 或 `pi-web restart`）+ 刷新页面；
3. 工具类扩展（如 pi-mcp-adapter 的 `mcp`/`mcpScript`）注册后即可在会话里被模型调用，`.mcp.json` 放在项目根自动发现。

安全红线：只装可信来源的包（扩展以你的用户权限跑在 sessiond 里）；不要把端口暴露公网，远程用 SSH 隧道或带认证的反代。

## 附录 E：复用性 spike C——官方 pi 插件 × piwork 自有资产同会话共存实证（2026-09-25）

> 目的：回答本报告的核心收束问题——**"官方 pi 插件能否在 piwork 复用"**。附录 B 证明了安装→加载→注册→执行链路（faux 模型驱动）；本 spike 把假设再逼近 piwork 真实形态一层：**用与 `piwork-llm-deepseek` 完全同形的声明式 Provider（`createProvider` + `openAICompletionsApi()`，走真实 openai-client SSE 流式解析）驱动会话**，与 piwork 形态自定义工具（`defineTool`）、官方 npm 包扩展三者放进**同一个** `createAgentSession`，一轮对话里全部真实执行。场地 `/tmp/pi-verify/spike-c/`（独立 npm 项目，三包 0.87.1 直接依赖、受管 agentDir，不碰 piwork 仓库与用户 `~/.pi`）。

### E.1 总结果：6/6 断言通过

| # | 断言 | 结果 |
| --- | --- | --- |
| 1 | 无扩展加载错误 | ✅ |
| 2 | 官方包 pi-mcp-adapter@2.37.0（经 `DefaultPackageManager.installAndPersist` 装入受管 agentDir）加载成功 | ✅ `extensions loaded: 2`（adapter + inline 桥接扩展） |
| 3 | 官方插件工具 `mcp`/`mcpScript` 与 piwork 工具 `piwork_echo` 并存注册 | ✅ `active tools: bash, edit, mcp, mcpScript, piwork_echo, read, write` |
| 4 | piwork 自定义工具执行 | ✅ `piwork-echo: hello from piwork custom tool` |
| 5 | 官方插件 MCP 工具对真实 stdio MCP 服务器执行 | ✅ `echo: hello from official pi plugin`（echo server 由 adapter 按 workspace `.mcp.json` 自动 spawn） |
| 6 | 最终助手文本经声明式 Provider 流式返回 | ✅ `ALL_TOOLS_DONE` |

mock OpenAI 服务器日志 3 次请求（tool_call → tool_call → 文本）= 完整 agent 循环全部走过 piwork 形态的声明式 Provider。**结论：官方 pi 插件复用不存在技术障碍，剩余是工程桥接。**

### E.2 spike 构成（全部真实组件，零 faux）

- **模型层**：`createProvider({ api: openAICompletionsApi() /* pi-ai/api/openai-completions.lazy */, baseUrl: mock, models: [...] })` —— 与 `plugins/piwork-llm-deepseek/src/index.ts:54-72` 逐字段同形；经 inline extension factory `pi.registerProvider(provider)` 注入 session。
- **工具层**：`defineTool({ name: "piwork_echo", parameters: Type.Object({...}), execute })` —— piwork `lib/ai/tools/*` 的目标形态。
- **插件层**：`install-pkg.mjs` 服务端调 `DefaultPackageManager.installAndPersist("npm:pi-mcp-adapter@2.37.0")`（网页安装同路径，pi-web `piPackageService.ts` 同款）+ `DefaultResourceLoader({ cwd, agentDir, extensionFactories, noSkills: true })`。
- **驱动层**：本地 mock OpenAI SSE 服务器按请求序脚本化返回 tool_calls/文本（openai 官方 client 的标准流式格式），加 stdio echo MCP 服务器。

### E.3 顺带验证：npm 目录源与 skills 兼容性（Phase A 前置）

1. **npm 目录源可用**：`registry.npmjs.org/-/v1/search?text=keywords:pi-package` 返回 10638 项（含 pi-mcp-adapter、pi-web-access、pi-subagents、billion-context 等画廊同款），字段齐全，可直接支撑管理端浏览/搜索 UI。
2. **skills 格式兼容**（关闭开放问题 #2）：画廊头部 skills 包 **bigpowers@2.88.9**（`pi` 键声明 extensions/skills/prompts，81 个 SKILL.md）实测——name 100% 匹配 piwork `^[a-z0-9-]+$` 模式、无保留名冲突、frontmatter 为 `name`+`description`+pi 特有 `model`/`effort` 字段（同源加载器安全忽略）、description 在 DB 1024 上限内。**无格式适配层需求**。

### E.4 新增机制发现（Phase B 桥接必读）

1. **调用方传入的 resourceLoader 必须自己 `await reload()`**：`createAgentSession` 只对**它自己创建的** loader 调 reload（`dist/core/sdk.js:76-79`）；传入 `options.resourceLoader` 而不先 reload → extensions 静默为 0。这是最容易踩的静默坑。
2. **扩展身份用 `sourceInfo.source`**：包扩展对象的 `name` 字段为 undefined，身份标识在 `sourceInfo.source`（如 `"npm:pi-mcp-adapter@2.37.0"`）与 `sourceInfo.scope/origin/baseDir`——管理端列表/审计应以此为准。
3. **凭据注入的真相**：会话 `prompt()` 的前置鉴权查的是 ModelRuntime 的 CredentialStore（auth.json）与环境变量（`<PROVIDER_ID>_API_KEY` 命名约定，实测 `PIWORK_MOCK_API_KEY` 通过），**不认 provider 对象内联的 `auth.apiKey.resolve`**。piwork-llm-* 的 DB 凭据要进 AgentSession，正路是实现 `CredentialStore`（`read/list/write` 三方法，`pi-ai/dist/auth/types.d.ts:57`）后 `ModelRuntime.create({ credentials: store })`——DB AES-GCM 解密在 read 里做，天然延续"凭据只在激活时注入"的现有纪律。
4. **声明式 Provider 原样可用**：openai-completions 的 SSE 解析、tool_calls 循环、finish 处理全部在 pi-ai 内部消化——piwork 模型插件层迁移是"换注册地点"（`piModels.setProvider` → inline extension `registerProvider` + CredentialStore），不是重写。
5. **事件层直接复用**：session 事件流含 `tool_execution_start/end`、`message_start/end`——与 piwork 聊天 route 现在订阅的 pi-agent-core 事件同名同义（附录 B.3.4 的结论在高保真度下复证）。

### E.5 对路线图的收束

- **Phase B 的技术不确定性已清零**：三层共存、全链路执行、事件兼容、凭据通道全部有了实测答案；剩余工作是聊天 route 的工程改造（自建 `new Agent()` loop → `createAgentSession`，工具适配 `ToolDefinition`，凭据桥 `CredentialStore`）+ 回归。
- **Phase A 无格式风险**：npm 目录源可用、skills 无格式适配层，剩余是纯流水线工作（提取/入库/管理 UI）。
- `/management/tools` 占位页（`app/(management)/management/tools/page.tsx`）+ 已就绪的 section 定义是 Phase A/B 的天然 UI 落点。


---

- pi 文档：[quickstart](https://pi.dev/docs/latest/quickstart) · [extensions](https://pi.dev/docs/latest/extensions) · [packages](https://pi.dev/docs/latest/packages) · [custom-provider](https://pi.dev/docs/latest/custom-provider) · [sdk](https://pi.dev/docs/latest/sdk) · [configuration](https://pi.dev/docs/latest/configuration) · [cli](https://pi.dev/docs/latest/cli)
- pi 画廊：https://pi.dev/packages
- piwork 代码：`package.json`、`app/(chat)/api/chat/route.ts`、`lib/ai/pi.ts`、`lib/ai/agent-tools.ts`、`packages/model-provider-sdk/src/index.ts`、`lib/model-plugins/*`、`app/(management)/api/management/model-plugins/route.ts`、`docs/model-provider-plugin-architecture.md`
- npm：`@earendil-works/pi-coding-agent`（latest 0.87.1 / 0.83.0 存在）
- 附录 A 实测材料：10 个画廊抽样包 + `pi-coding-agent@0.83.0` 的 npm tarball，解压于 `/tmp/pi-verify/`（临时目录，可直接翻看源码复核）
- 附录 B spike harness：`/tmp/pi-verify/spike-b/`（2026-09-25 晚些时候 /tmp 清理后已失，结论以本报告记载为准；方法可按 B.4 重建）
- 附录 C 实测材料：`/tmp/pi-verify/versions/` 与 `/tmp/pi-verify/coexist/`（同上已失；升级本身已实施进仓库并通过回归，见 C.7）
- 附录 D 材料：https://github.com/jmfederico/pi-web · https://pi-web.dev（浅克隆于 `/tmp/pi-verify/pi-web/`，2026-09-25 重新克隆复核 piPackageService 接线，与 D.3 记载一致）
- 附录 E spike harness：`/tmp/pi-verify/spike-c/`（install-pkg.mjs / mock-openai-server.mjs / mcp-echo-server.mjs / spike.mjs / workspace/ / agent-dir/，三包 0.87.1，可复跑）；bigpowers tarball 与解压于 `/tmp/pi-verify/phase-a/`
