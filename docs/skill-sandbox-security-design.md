# Skill 沙箱执行与企业安全实施方案

状态：**设计及第一批协议基础，未生产接线**（2026-10-10）。不是安全认证、生产验收或容量证明。现有 OpenSandbox RPC 路由保持不变；不因此开放 SandboxToolsBackend 的 OpenSandbox 门禁，不启用 Durable。

> 最新范围调整：用户要求简化为基础脚本执行，现已完成 [现有 RPC Skill 资源补齐](skill-sandbox-execution.md)，不以本方案的 Worker/审批数据库作为该基础功能的前置开发项。本文件保留为完整企业目标；下文“第一批仅协议”的记录为此前阶段，不代表最新基本功能状态。RPC 复制不是只读 mount/审批，不能因此宣称企业安全目标已实现。执行-only OpenSandbox tools/P2/P3 生产门禁仍不变。

## 1. 目标与信任边界

实现管理员审核过的 Skill 的完整目录（SKILL.md、scripts、references、assets）进入执行沙箱，模型按需加载指令并调用脚本，输入仅来自授权资料，输出经私有归档交付。Skill 加载不等于执行，enabled 不等于代码审核，文件校验不等于授权。

企业目标沿用 sandbox-execution-surface-design.md 的 P2/P3：可信宿主持有官方 Pi AgentSession、模型密钥、授权和账本；OpenSandbox 只持有限额进程/文件及批准的输入。不是把宿主目录直接复制到现有 RPC 沙箱后宣布完成，也不是默认启用新的宿主工具执行入口。

所有执行指 **所有模型可触发的进程、脚本、文件操作和外部写入**，包含 Skill、附件处理、定时任务、Extension、MCP、Package 和审批续跑。平台可信业务查询可以留在宿主，但必须是经过审核、固定输入 schema、逐次授权的业务回调，不能给模型任意宿主命令/路径/代码入口。不要求将数据库、模型插件宿主或控制面自身放进执行沙箱。

威胁模型包含恶意 Skill/提示注入、被替换的脚本/依赖、越权输入/输出、路径逃逸/链接竞争、凭据窃取、出网和资源滥用、取消失败、未知副作用及进程重启。容器共享宿主内核；高风险租户需要进一步评估独立 Worker/VM 隔离，不能把容器当成消除所有风险。

## 2. 本轮核实的现状

- Pi 1.1.0 Skills 是按需加载的目录指令，不是安全沙箱或独立脚本调用 API。沿用官方 AgentSession、customTools、工具 operations，不创建第二个 agent loop。
- 现有 managed-skills 新注册默认 enabled=true，没有不可变审批/内容 hash 绑定。因此旧 enabled 记录不能自动获得新脚本执行许可。现有 create_skill 会写项目 Skill 目录；目标应改为本人草稿/审核后发布，不能让员工模型工具直接更新全局可用 Skill 或受审快照。load_skill 也应从批准的私有快照读取而非动态宿主目录。
- SandboxToolsBackend 已有四工具/逐次授权注入，但尚未装配生产，默认拒绝 OpenSandbox；正式权限/持久 intent/Worker 门禁仍缺。
- 当前 SandboxRpc 把完整 Pi 放容器，模型代理 run token 在容器可见。不能把这个凭据布局直接复用于目标执行-only 沙箱；在新布局中沙箱不持有模型代理 token，默认无出网。
- 2026-10-10 单沙箱真实探针：0.5 核/768 MB，实际 execd 命令 UID=100、GID=101、CapEff=0、NoNewPrivs=1；Docker privileged=false、no-new-privileges=true；根文件系统可写。功能/核查后已确认销毁。核对的是实际命令身份，不仅是镜像 USER。
- 功能 smoke 不覆盖只读 Skill、持久账本、恢复、完整出网绕过和权限矩阵，不能称为企业级验收。本轮不做容量、持续负载或突发并发测试。

## 3. 首版固定安全契约

### 3.1 审核与供应链

- 平台维护不可变 SkillVersion：skillId/version/manifest hash/文件 hashes/批准镜像 digest/审核主体及时间/依赖清单/权限需求。可撤销；每次工具执行复核当前授权与撤销状态。
- 上传、目录同步和启用不自动审批。代码修改、依赖或镜像变化产生新版本并重新审核。审核记录由正式管理员 API 写入，模型和客户端不能构造 approved 授权。首版脚本采用上传者与审批者分离，例外需另行明确风险审批，不默认降为单人自动放行。
- 安装/扫描处理不可信归档：流式配额，拒绝路径逃逸、链接、特殊文件、重复/大小写冲突及文件/目录冲突。归档文件名黑名单不是凭据/DLP 检测，也不证明代码无恶意。不在应用宿主运行包安装 hooks 或脚本；扫描/构建在独立受限环境进行。恶意代码审核不能由关键词扫描或模型评分替代。
- 依赖通过可信构建流程预装，固定版本和 digest，保存 SBOM/扫描结果；首版禁止运行时 pip/npm/apt 安装及任意联网下载，不静默补依赖。无依赖或审批匹配则拒绝执行。

### 3.2 文件与路径

- 协议仅传 manifest、ID/hash 和库文件 reference，不传宿主路径、凭据、回调或脚本字节。
- 本轮实现 `lib/runtime/protocol/skill-bundle.ts`：严格 schema、根 SKILL.md、规范相对路径、regular 类型声明、文件/目录冲突、512 文件、单文件 10 MiB、总量 50 MiB、manifest 1 MiB（JSON 解码前限额及子项校验前计数）、保留目录/凭据文件拒绝；canonical manifest hash；目标路径 `/opt/piwork/skills/<skillId>/<manifestHash>`。
- **该模块没有收集/审核/上传/执行能力**。regular 声明不能证明真实文件没有链接；元数据大小/hash 不能证明真实字节一致。可信 collector 须 pin directory fd、拒绝 symlink/hardlink/特殊文件、限额流式读和逐字节 hash。禁止以普通路径 lstat→read 替代竞争安全实现。
- 私有不可变快照中的实际字节，在水合前重新核验；沙箱先准备临时版本，全部核验后发布。发布失败/取消不得开始首个工具调用，不能留下半水合可执行目录。
- Skill 在单独只读挂载中，执行 UID 不能修改脚本或切换版本；仅 chmod 或放到可写 workspace/.skills 不满足这个保证。当前 provider 接口未提供该挂载，必须先扩展及验收，不能先虚构路径交给模型。
- 输入在独立只读 inputs（复核 user/chat/run、库文件所有权、hash/size）；outputs/workspace 为限额可写区。Linux pinned fd/限额/原子操作是必须项，非 Linux fallback 只允许测试。不得挂宿主 home、Docker socket、应用目录或公开 Blob 根目录。
- 技能正文和资源目录使用官方 Pi 发现/解析机制；仅向模型投影批准版本的沙箱路径。返回 load_skill 内容和精确路径本身不执行；不通过任意字符串替换猜测脚本路径，也不让模型提供宿主根目录。宿主 callback 身份闭包不进入 Worker DTO。

### 3.3 执行、身份和出网

- 首版仅四工具 + 明确白名单的 load_skill/deliver_file。禁宿主内建执行、受管扩展和 MCP；不靠同名工具覆盖或分类器构造安全边界。
- 路由/分类仅选择 lane；backend 和每次 execute 再校验正式 enabled 身份、chat 归属、角色权限、run/attempt/fencing、审批 hash 和预算。协作、定时任务、审批续跑要同样接线，未支持的入口必须拒绝，不能默默回落宿主。
- 不给模型沙箱注入模型密钥、run proxy token、数据库/对象存储凭据或宿主环境。外部联网/写入通过批准的固定 Gateway，独立 schema、逐次授权、审计及幂等策略。首版任意网络 deny-all。shell 关键字/AST 扫描或管理员确认不能证明任意 Python/Node 子进程安全；资源、路径、凭据和网络能力必须由隔离底座及 Gateway 限制。禁止运行时装依赖是平台政策，不得把提示词/命令字符串拦截当成硬隔离证据。
- 必须验证实际 UID/GID、no-new-privileges、有效 capabilities、seccomp、只读 Skill/控制路径、CPU/内存/PID/磁盘/输出/时间配额。后台持久准入首版仅 1 个执行沙箱；这是准入策略，不是容量证明，额度校验不等于已落实的磁盘/并发约束。
- 应用进程重启/失联后必须有 owner lease、reaper 和未知结果阻断；在此之前不能开放持久复用或自动恢复。

### 3.4 账本、取消和交付

- 工具调用执行前持久化 intent（user/chat/run/attempt/toolCallId、审批与策略版本、参数 hash、沙箱/lease、预算），提交成功才启动副作用；完成持久化 outcome、用量和结果 reference。敏感正文/凭据不进入普通日志。
- 区分 not_started/started/completed/outcome_unknown；未知效果不自动重放。首版不自动重试 shell；不照搬 CubePlex 的重建重试。Durable 提交去重不能证明副作用恰好一次。
- 取消/超时/失联立即阻止后续操作，kill 全沙箱并核实底座状态；未核实不得记干净停止或释放所有权。Stop 受理不等于销毁确认。
- 输出受限读取、拒绝链接，私有存储并绑定 user/chat/run/toolCallId，正式 LibraryItem 归档后才发 artifact.created；模型不提供公开 URL、身份或可信 MIME。文件写入不等于已交付。旧公开 Blob 不静默迁移。

## 4. 实施顺序与生产门禁

1. **已完成：协议与核查基础。** Manifest/hash/path 契约和单测；真实 UID/capabilities 探针。未改生产 lane，无新脚本执行能力。
2. **P2：控制面。** 不可变私有快照、审批/撤销/角色授权、正式查询层、持久工具 intent/outcome、单槽准入、私有输入/交付、所有入口盘点。旧 Skill 禁止自动迁移为 approved。
3. **P1/P2 provider 验收。** OpenSandbox 执行-only launcher/控制路径隔离、只读 Skill 挂载、Linux 原子限额文件契约、无模型 token/deny-all、实际身份和攻击测试。通过前保留当前 `opensandbox-not-verified` 门禁。
4. **脚本 Skill 集成。** 可信宿主官方 AgentSession + SandboxToolsBackend + load_skill 固定版本加载；仅审定无网 Skill，缺依赖/文件/hash 不匹配失败，不 fallback。新增独立显式开关，默认关闭，先非生产。
5. **P3：单 Worker。** 持久 claim/fencing、heartbeat/reaper、独立执行状态与 RuntimeEvent 投影、取消/重启/人工对账。没有这一步不能称为正式生产安全运行面。
6. **生产审批。** 功能与恶意用例通过、所有入口矩阵与审计证据完整、明确剩余风险及回滚方式，再独立申请开启。Durable、联网 Skill、MCP/Package、复用和自动恢复不随本需求开启。

验收至少覆盖：真实 Python/Node Skill 脚本及私有下载；禁用/撤销/换 hash/模型伪造身份；输入跨用户；路径穿越/链接竞争/归档炸弹；只读脚本与控制目录写入拒绝；依赖缺失；外网/内网/metadata 服务/代理 token 不可达；PID/输出/时间等限额；取消后子孙退出；进程失联/重启/结果未知不重放；失败不开宿主；归档失败无交付事件。单次成功调用不足以替代这些安全测试。

## 5. 本轮验证

- `pnpm test:runtime:foundation`：41 通过、0 失败（含新增 6 项 manifest 测试及固定 v1 hash 向量）。
- `pnpm test:runtime`：368 通过、8 跳过、0 失败；不是容量测试，也不能替代尚未实现功能的验收。
- TypeScript、相关 Biome、git diff whitespace 检查通过。
- 服务器仅串行 1 个探针，确认实际资源/身份/控制标志及销毁。未部署新应用代码，未改路由/审批权限，未创建 Git commit。

## 6. 官方依据

- 安装版本 `@earendil-works/pi-coding-agent@1.1.0`：`docs/skills.md`、`docs/sdk.md`、`docs/security.md`、`docs/containerization.md`、`docs/rpc.md`。
- 官方强调 Skill/项目 trust/提示词不构成安全边界；工具-only 隔离不保护其他宿主扩展；工作 cwd 不限制 OS 权限。该方案以 OS 隔离、最小权限和平台授权约束执行，不让 manifest 或 enabled 状态代替这些机制。
- 项目基线：`sandbox-execution-surface-design.md`、`runtime-foundation-implementation.md`、`architecture.md`、`development.md`。CubePlex 仅参考目录分发体验，不复用其自动重试/信任假设。
