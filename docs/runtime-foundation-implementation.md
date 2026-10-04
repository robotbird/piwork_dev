# 企业 Runtime 实施记录：契约、tools 适配器与私有交付基础

> 状态：**首批代码已落地，未接入生产装配**。主方案见 [sandbox-execution-surface-design.md](sandbox-execution-surface-design.md)。
> P0 契约/inventory、P1 文件/四工具、SandboxToolsBackend 协议适配器与私有存储/交付回调已实现；真实 Docker 新契约与 CSV 交付 smoke 已通过。生产权限/账本/附件/治理、完整办公验收与单 Worker 尚未完成；不能将本批写成 1～9 全部完成。按要求，本轮不做容量压测、持续负载或突发并发测试；保留资源限额实现，不将功能测试作为千人容量或生产 tools 上线证明。

## 1. 本批次交付

| 落点 | 能力 | 边界 |
| --- | --- | --- |
| `lib/runtime/protocol/run-descriptor.ts` | schemaVersion=1；严格 JSON 编解码，256KiB 总量上限；模型/提示/历史/附件/制品引用；backend/lane/workspace 一致性、hash/预算/安全路径校验 | 不存 bytes/回调/宿主路径/凭据；不是客户端提交 API；schema 有效不等于身份与资源已授权 |
| `lib/runtime/protocol/execution-state.ts` | 独立执行状态与转换检查；活跃执行确认停止后才终结，needs_review 对账后才能终结，禁止自动重排 | 未替换 AgentRun DB enum/RuntimeSnapshot，仍需 DB owner/attempt/fencing CAS；bool 证据须来自可信执行端 |
| `lib/runtime/sandbox/operation-error.ts` | provider 显式 not_started/started/completed/outcome_unknown；只有 not_started+transient+未重试过可建议一次重试 | 未执行自动重试；普通断连/Unavailable 不当作未启动证明；尚未接入持久操作账本 |
| `lib/runtime/sandbox/lazy.ts` | 单飞 ensure、spec 快照、abort/close、迟到 acquire 回收、kill-only、释放失败可观察 | 不执行工具、不自动重建/重放；acquire 失败仍需 provider 清理部分 provision，进程死亡仍需 reaper |
| `sandbox/filesystem.ts` / `remote-files-script.ts` | 可选 `SandboxHandle.filesystem`；stat、流式限额、SHA256、同目录原子发布/替换、hash/不存在前置条件；Linux pinned dir fd + O_NOFOLLOW/O_NONBLOCK，拒绝 symlink/hardlink/特殊文件 | 固定 Node argv helper 不放入 workspace；50MiB 传输上限/30s 操作截止；无 Node 或 Linux /proc/self/fd 则 fail-closed；旧 RPC 文件 API 保持不变 |
| `backends/sandbox-tools/tools.ts` | 官方四工具 schema/truncation，edit/write 用官方 operations 注入保留匹配/BOM/换行/diff；read 图片不宿主解码、Office 不宿主解析；bash 不创建宿主临时日志/转发 env | 注册不 provision，每次先调用 authorization；已接入下述实验 adapter；平台身份回调与持久 intent 仍需正式 P2 接线 |
| `backends/sandbox-tools/backend.ts` / `in-process/backend.ts` | 官方宿主 AgentSession + 复用原 normalizer/session；单 run、终态前 kill/核验、授权或未知结果强制失败、close 单飞；禁内建宿主执行/受管扩展/MCP，平台工具显式白名单 | 尚未接入生产路由与 AgentRun backend 枚举；OpenSandbox tools 明确拒绝；需要持久 intent、workspace owner 与正式授权；生产须 Leasing reuse=false |
| `lib/ai/private-file-store.ts` / 可选 `deliver_file` | operationKey 确定 ID、50MiB 限额、0600 临时文件 fsync + link 不覆盖、相同操作冲突校验；私有平台 URL；归档回调 resolve 后再发布 artifact.created，内存去重 | Publisher 必须绑定平台身份与正式归档；本地私有根须持久共享且不挂入沙箱；bytes/metadata/DB 非跨系统事务；既有上传/Blob public 未自动迁移 |
| `lib/ai/agent-session.ts` / tools 图像校验 | SDK SettingsManager.inMemory 的 session-local images.autoResize=false，prompt/平台工具仅支持 PNG/JPEG/GIF/WebP 且限大小/数量 | SDK 会二次归一化工具图像，不能仅改 read；不支持格式需拒绝，false 单独不能防 conversion；普通会话默认不变 |
| `backends/sandbox-tools/tool-runtime.ts` | 单 run 串行所有权、operationId 防重复、可信内存观察；默认 120s/最大 1800s；输出 10MiB 截止，模型结果 tail 200 行/50KiB | 超时/取消/未知结果 kill 全沙箱且核验 destroyed；不重放，kill 失败不伪造停止；shell exit 不证明子孙停止；观察最多 1000 条，不能跨进程恢复 |
| `sandbox/child-process-channel.ts` | 可选 stdout/stderr bounded pull 合流、EPIPE/启动失败可观察 | RPC 仍读原 stdout；close 仍不是进程树停止证明，停止由 sandbox destroy 承担 |
| `tests/unit/runtime/protocol/` 与 `tests/unit/runtime/sandbox/{lazy,operation-error}.test.ts` | 35 项基础测试；fixture 在 tests/fixtures/runtime 和 tests/support/sandbox | 替身测试不证明真实 provider 强杀/持久卷/网络隔离 |
| `tests/unit/runtime/sandbox/filesystem.test.ts` / `backends/sandbox-tools/*.test.ts` | 41 项文件/工具/后端测试，其中 6 项真实 Docker（Linux anchored 文件、链接/特殊文件拒绝、stdout/stderr、超时子孙停止、启动后断连不重放；新增官方 SDK→CSV→私有存储/归档回调→制品事件） | TestSandboxProvider 非 Linux fallback/进程组仅测试替身；未运行 OpenSandbox 新能力契约/办公 E2E |

新增 `test:runtime:foundation`、`test:runtime:tools`，协议与新 tools 测试纳入 `test:runtime`。没有新增依赖、DB 迁移、生产环境开关或路由切流。纯对话和现有 SandboxRpc 行为不变。

RunDescriptor 当前仅为批准配置的承载契约，所有字段由平台组装。下一阶段装配器必须再次查询当前 user/chat/file/model/tool 权限，并把 egress 与组织基线取交集；不能直接 `parseRunDescriptor(request.body)` 后执行。

### 1.1 用户要求的 MVP 1～9：实际状态

| 项 | 本轮落点 | 尚缺 / 作用 |
| --- | --- | --- |
| 1. tools 后端/受控试点 | 协议 adapter 与 SDK 生命周期已实现，纯文本不 provision；平台工具白名单、失败不可伪装成功 | 正式路由/AgentRun 枚举/受控开关仍未接，待安全门禁后开放 |
| 2. 首发 provider 安全 | 先验 Docker deny-all，6 项真实契约；登记失败清理与 late acquire 回收 | 持久卷/元数据、资源硬限额/部分 provision/orphan 对账仍需完整验收；OpenSandbox tools 不开放 |
| 3. 最小持久账本/工作区所有权 | 保留内存 observation/去重；未新增 DB 表 | 下批必须落实 intent/result/needs_review、不可自动重放与独占/fencing |
| 4. 当前权限/输入版本 | authorization callback 先于 provision；平台工具默认禁用 | 正式 enabled/user/chat/model/file 查询、撤销停止与不可变快照未完成 |
| 5. 附件/私有交付 | 私有存储、可选 deliver_file、先归档后事件、稳定 key/冲突/内存去重 | 正式 LibraryItem 接线、输入水合/版本、共享持久私有卷与旧 public 上传迁移未完成；无恰好一次/崩溃恢复承诺 |
| 6. 受限办公镜像/Skill | 真实 Docker CSV 生成/私有交付 smoke | 批准镜像/依赖/中文字体与少量 DOCX/XLSX/PDF/PPTX 验收尚未实现，不以 node:22-alpine 为办公镜像 |
| 7. 最小治理/reaper | 已有每操作时间/输出/传输上限、续租/最终回收/清理失败可观察 | 全局并发/有界队列/预算、审计/reaper/取消删除对账尚缺；不启用 keep |
| 8. 单 Worker | 未实现，生产仍 Web RunManager 旧路径 | PostgreSQL job/事件/取消、所有权/重启对账；未知副作用不可自动重放 |
| 9. 功能/安全/故障验收 | Runtime 270、Unit 48、TS/Biome；含真实 Docker SDK/私有存储链路 | DB/HTTP 归属、权限撤销/删除/Worker 重启与批准办公格式待补；仍不做容量/持续/突发测试 |

## 2. P0 现状 inventory 与迁移顺序

| 现有消费者/数据 | 当前事实 | 后续迁移动作 |
| --- | --- | --- |
| `lib/db/schema.ts` AgentRun | backend 仅 in_process/sandbox_rpc；状态含 queued/starting/running/waiting_user/settled/failed/aborted | P2 新 backend、P3 新执行状态必须先审计消费方，再增加兼容 schema；本次没增加落库枚举 |
| `lib/runtime/run/run-manager.ts` | 状态类型、SettleOutcome、进程内 LiveRun、lease/orphan/stale 清理 | Worker 后不能把所有非本 Web 进程 run 当 orphan；需要 owner/attempt/CAS；needs_review 不算 settled |
| `lib/db/agent-run-queries.ts` | 活跃/终态集合、backend 类型、条件更新与心跳 | 新状态同步集合/查询/索引；持久队列领取与现 lease 语义区别清楚 |
| `lib/runtime/protocol/events.ts` / `stream-mapping.ts` | RuntimeSnapshot 是会话状态；run.settled/run.failed 是产品流语义 | 独立 job 状态不直接塞入旧 snapshot；取消/待复核需兼容的 UI 表达 |
| `lib/runtime/run/event-store.ts` / `message-builder.ts` | 关键事件持久化、消息构建与投影 | Worker 游标/源 ID、snapshot 替换和产物投影去重分开设计 |
| `lib/db/overview-queries.ts` / `lib/admin/overview.ts` | 成功率和后端分布依赖 AgentRun 枚举 | 增加 sandbox_tools 与待复核展示，不能隐式归为成功 |
| `lib/scheduler/executor.ts` / scheduled-task queries | 经 RunManager 执行；5min 超时与领取租约；定时任务不做执行分类 | 新队列共享准入，claim/resume/终态分离；明确 stale/超时迁移，不靠移除限制放长任务 |
| `lib/runtime/sandbox/leasing.ts` / 两档 provider | acquire/attach/release；新增可选 filesystem seam 已传递，命令观察仅新 tools 进程内；旧 readFile/writeFile 未改变 | P1 OpenSandbox 新契约待验证；登记失败已 kill/核验/标 released 并暴露清理失败；native 持久执行查询、复用失联策略与重启对账仍待补齐 |
| `lib/ai/file-store.ts` / LibraryItem | 随机产物 key，Blob 可为 public | 私有产物存储/交付回调已实现，P2 尚需正式归档与权限/账本；普通上传与旧数据单独迁移，不静默改所有 URL |

跨进程 RunDescriptor 引用的输入/历史 snapshot 还没有持久化表。P3 写入 job 前必须实现不可变 snapshot 和版本/hash 校验；不能只填 ID 后仍加载最新 Chat。

## 3. 首批 20 个办公验收样例（基线，尚未执行）

以下是 P0 样例规格，不是已通过的端到端 fixtures。P2 前补小型脱敏输入、确定格式/数值断言与人工评审标准；损坏/超限输入不依赖模型猜测。

| ID | 请求与输入 | 预期交付/断言 |
| --- | --- | --- |
| O01 | 你好，无附件 | 文本回复、无容器、无执行工具 |
| O02 | 将提供的会议文字整理纪要 | 文本结构完整、无下载要求时不创建容器 |
| O03 | 上传 Markdown 需求，生成 DOCX 周报 | 可打开的 DOCX，关键条目齐全，归档一次 |
| O04 | 上传两份年度资料，生成对比报告 PDF | PDF 可读、中文字体正常、引用来源明确 |
| O05 | 缺失/无权限报告附件 | 不执行对应作业，不虚构报告完成 |
| O06 | CSV 去重、缺失值处理 | 输出 CSV，已知重复/缺失规则及行数一致 |
| O07 | XLSX 按部门汇总金额 | 输出 XLSX，已知数值精确，部门不串组 |
| O08 | 多工作表合并并增加来源列 | 输出 XLSX，列和来源可追溯 |
| O09 | CSV 生成柱状图并写分析 | 图像与 Markdown/报告归档，数据一致 |
| O10 | 损坏 XLSX / 超配额表格 | 结构化失败/限额提示，不留下成功产物 |
| O11 | 文本 PDF 抽取章节和表格 | 文本/CSV，页面顺序和表格值可验证 |
| O12 | DOCX 抽取正文与标题 | Markdown，结构保持；无宿主重解析阻塞 |
| O13 | 扫描 PDF 转文字 | 批准 OCR 镜像内处理，文字覆盖率人工检查 |
| O14 | 超页数/高压缩比 Office 文档 | 超限拒绝/解析进程停止，Web 保持健康 |
| O15 | 基于概要生成 5 页 PPTX | 可编辑 PPTX，可打开、页数正确、无出框 |
| O16 | 根据表格生成 DOCX 月报 | 数字与图表一致、中文排版可读 |
| O17 | DOCX/PPTX 转 PDF | 版面/页数可比对，转换器受限运行 |
| O18 | 仅分析上传图片 | 走视觉输入，不水合、不创建容器 |
| O19 | 对同一图片压缩或 OCR | 按需水合原图，输出格式/尺寸或文字正确 |
| O20 | 定时生成 CSV 汇总，交付时注入归档故障 | 明确运行结果，恢复投影无重复 LibraryItem/逻辑 artifact |

模型回答、内容正确、文件可打开与系统可靠性分别计分；超限拒绝/预期失败样例不能挤入常规任务成功率分母。

## 4. 验证记录

上一批文件/四工具基础执行：

- `corepack pnpm test:runtime:foundation`：35/35 通过。
- `corepack pnpm test:runtime:tools`：28/28 通过，含 5 项真实 Docker 新契约；没有进行并发容量或持续负载测试。
- `corepack pnpm test:runtime`：254 项，248 通过、6 跳过、0 失败；跳过为既有 Durable/LocalRpc/SandboxRpc 能力差口。旧 Docker 与新 tools Docker 契约通过；真实 OpenSandbox/RPC gated 分组未启用，本轮未验证 OpenSandbox 新 helper/强杀或 workspace 持久性。
- 初次全量回归暴露 `sandbox-rpc/inference.test.ts` 的既有时序/清理问题：官方 RpcClient.start() 的 100ms 延时并非 bridge 握手。测试改为 prompt ack 后检查 env，代理 close 置于 after 钩子防断言失败留服务。隔离回归与正常全量回归均通过，未用 test-force-exit 掩盖最终结果。
- `corepack pnpm test:unit`：43/43 通过。
- `node_modules/.bin/tsc --noEmit`：通过。
- 新增/修改 Runtime 基础代码与测试的 Biome 检查：通过。

本环境 pnpm 无独立 PATH 命令，使用已可用的 corepack pnpm。没有执行 DB/E2E/soak，没有进行生产默认值切换。

本批 adapter/私有交付追加验证：

- `corepack pnpm test:runtime:tools`：41/41（含 6 项真实 Docker）；完整 Pi→Docker CSV→私有存储/归档回调→artifact.created→清理后终态通过。归档回调用替身，不视为 DB/HTTP 权限证明。
- `corepack pnpm test:runtime`：270 项，264 通过、6 既有跳过、0 失败。
- `corepack pnpm test:unit`：48/48；私有存储确定 key/并发相同发布/冲突/元数据修复、SDK session-local 图像设置通过。
- `tsc --noEmit`、定向 Biome 与 `git diff --check` 通过；没有依赖升级、DB 迁移、默认路由/环境开关切换或容量测试。
- 日志：`/tmp/piwork-next-{tools,runtime,unit,tsc,biome}-final.log`。

## 5. 下一批入口与阻断门禁

1. **P0 review：**确认 DTO/状态/操作错误接口、模型配额/部署 SLO；输入快照、业务完成标准和身份复核在装配前定稿。容量测试已明确排除，不作为本轮待办。
2. **完成首发 provider 门禁：**本轮先验 Docker deny-all；补持久性、部分 provision/orphan 与资源硬限额。OpenSandbox tools 仍阻断，后续另验新 helper/强杀/原子写、PTY launcher 控制路径隔离与持久卷，不为 MVP 同时实现双档对等。不能用旧 RPC 契约或 Channel.close 替代新工具验收。
3. **P2：**接工具白名单后端之前完成 intent/结果持久账本、workspace 独占/fencing、授权撤销、未知命令复核和安全失败事件。当前版本前置条件不是任意并发 shell writer 的内核 CAS，临时文件默认 0600，不能视为完整原有文件元数据保留；需要明确模式/所有权策略。
4. P2 再把已有私有存储/交付回调接入正式身份/归档/账本，接附件水合、Skill/受限办公镜像、资源准入、审计/reaper、删除对账与管理；P3 接单 Worker、持久 job/取消/事件和恢复演练。
5. 不能因 adapter/私有交付已有测试就启用 keep 或 PIWORK_SANDBOX_BACKEND=tools；开关仍未实现。最终每 run 必须 close；普通对话继续现 in-process，无容器；新 tools 未对生产产生路由变化。

## 6. Pi 官方依据

本次修改前完整读取安装版 coding-agent 1.0.0 `docs/sdk.md`，核对 `dist/core/sdk.d.ts`、官方 `examples/sdk/05-tools.ts` 和 `examples/extensions/tool-override.ts`。依据其 Model/AgentSession/customTools/工具同名路由契约，将 Pi 对象留在 RuntimeSpec，新增 DTO 与资源所有权代码不实现新的 agent loop，也不假定工具覆盖构成安全隔离。

本批另核对安装版 1.0.0 `dist/core/tools/{read,bash,edit,write}.{d.ts,js}`、`tool-definition-wrapper.js`、`output-accumulator.js`、`path-utils.js` 与 `utils/image-process.js`，以及 `docs/security.md`/`containerization.md`：edit/write 使用官方 operations 与 mutation queue；read/bash 保留官方 schema/truncation，但不执行其宿主路径探测/默认图片处理/temp spool；signal/onUpdate 继续 AgentTool 合约，不重复 agent loop。核对 `dist/modes/rpc/rpc-client.js` start 的启动延时用于修正 RPC 测试。OpenSandbox SDK/PTY seam 仍只在 opensandbox/；文件 helper 与 LazySandbox 不依赖 Pi。版本未升级，Durable 未新增 safe 工具标记或恢复保证。

追加核对安装版 `dist/core/agent-session.{d.ts,js}`、`settings-manager.d.ts`、`resource-loader.d.ts`、`utils/tool-result-images.js` 与 `docs/settings.md`：SDK 不仅 read，还会归一化 prompt/tool result 图像，故用官方 SettingsManager.inMemory 的 session-local images.autoResize=false 加 adapter 受支持 MIME/体积校验；不修改全局设置，不重复 Pi loop。
