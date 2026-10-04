# 对话执行流:沙箱 vs 进程内闭环

- 日期:2026-10-04
- 性质:架构分析笔记(只读结论,不含代码变更)
- 范围:backend agent 运行时 —— `cubeplex/streams/run_manager.py`、`cubeplex/middleware/sandbox.py`、`cubeplex/sandbox/*`
- 行号为分析当日 main 分支快照,后续以函数名为准

## 一句话结论

一次对话的 agent 主循环 —— LLM 调用、中间件编排、工具调度、事件流、HITL 暂停/恢复 —— **全部在 backend 进程内(cubeloop `Agent` 的 asyncio 循环)闭环**。沙箱不是"对话跑在容器里",而是远端 OpenSandbox 容器提供的一个 shell + 文件系统,只有一部分工具调用落到那里;LLM API 请求从 backend 直接发出,沙箱不参与模型调用。

## 一次对话的完整路径

1. **入口**:conversation 路由 → `RunManager._execute_run` 后台执行,解析模型、系统提示词、工具、skills。
2. **沙箱装配(可选)**:`_build_agent_for_conversation` 附近读 `sandbox.enabled`(默认 False)。开启时创建的是 `LazySandbox` 包装 —— 工具列表一开始就注册给模型,但容器在第一次真正用到时才 provision;底层走 `SandboxManager.get_or_create`(OpenSandbox pod + 按 scope 挂 PVC)。
3. **进程内循环**:cubeloop `Agent` 流式跑 loop;事件经 `RunManager` 写 Redis → SSE。subagent 也是同进程内嵌套的 cubeloop Agent,直接复用同一批工具对象。
4. **状态分三处放**:对话状态在 Postgres checkpointer、运行协调在 Redis、文件在沙箱 PVC。容器本身无 agent 状态,可随时杀掉重建。
5. **崩溃恢复**:启动时 `streams/recovery.py` 的 `recover_stranded_runs` 把卡死 run 标记 stale 并修复孤儿 tool_calls,保证线程一致;HITL 暂停的 run 因 checkpointer 在 Postgres 可跨进程恢复。

## 真正进沙箱的环节

| 环节 | 位置 | 进容器的部分 |
|---|---|---|
| `execute` | `middleware/sandbox.py` | 整条 shell 命令在容器跑,stdout 回进程;唯一真正"执行"语义的入口 |
| `write` | 同上 | 内容 upload 到容器 FS |
| `edit` | 同上 | 只有两头进容器:download 原文 → 匹配/diff/改写全在**进程内** → upload 写回 |
| `read` | 同上 + `sandbox/base.py` `file_read` 默认实现 | 容器只出字节;PDF→markdown、OCR、notebook 解析全在**进程内** parser registry 完成 |
| 附件水合 | `run_manager.py` `_hydrate_attachments_into_sandbox` | 非图片附件从 ObjectStore 物化到 `/workspace/uploads/...` |
| `save_artifact` / `present_file` | `middleware/artifacts.py` | 从容器 FS 读出后登记到 DB/ObjectStore |
| `view_images` | `tools/builtin/view_images.py` | 仅当容器已 initialized 才从容器读图,否则回落 ObjectStore |
| `generate_image` | `tools/builtin/generate_image.py` | 生成的 PNG 写入容器再登记 |
| `load_skill` | skills sync | skills tar 包推送到 `/workspace/.skills` |

## 容器何时才创建(LazySandbox 触发条件)

run 启动时**不创建容器**。以下任何一个先发生,才触发 `get_or_create` provision:

- 模型第一次调用 `execute` / `write` / `edit` / `read`(`lazy.py` 四个工具的底层都走 `_ensure_with_retry`)
- 用户消息带**非图片附件**(run 启动时水合会 upload → 触发创建;图片附件走 ObjectStore,不触发)
- 模型调用 `generate_image`
- 模型调用 `load_skill`

例外:`view_images` **不触发创建** —— 纯看图对话永远不会起容器。

**永不进容器的(与开关无关)**:LLM API 调用、middleware 链、命令策略拦截(`before_tool_call` 在命令到容器**之前**进程内裁决)、`ask_user` / `write_todos` / memory / calculator / datetime / find_skills、MCP 工具、subagent 编排。

**进哪个沙箱**:`_resolve_sandbox_target` 决定 —— 默认按 creator 归到用户级共享容器,`sandbox_mode='dedicated'` 时 topic/conversation 用带独立 PVC 的专属容器。

## 边界情况

- **`sandbox.enabled=False`(默认)**:`execute/write/edit/read` 这组工具根本不会注册进工具列表 —— 不是"走了别的路",而是沙箱路径整个不存在。
- **provision 失败 → 干净降级**:记 "Sandbox unavailable, continuing without",对话继续跑纯内置工具。沙箱是增强项,不是闭环的必要条件。
- **命令策略**:deny/confirm 规则在 `before_tool_call` 进程内执行,被拦的命令不会到容器(无副作用);confirm 走 HITL 暂停,Postgres checkpoint 持久化,可跨进程恢复。
- **`LocalSandbox`**(`sandbox/local.py`):唯一"进程内执行 shell"的实现,仅限 dev/test,生产路径(OpenSandbox)不会用到。

## 架构评价

**总评:合理,且是当前 agent 产品的主流形态**(与 Claude/ChatGPT 代码解释器同构):编排闭环在进程内,执行面外置沙箱。

做对的:

- **循环不进沙箱**:agent loop 是 IO 密集的编排,需要贴着模型凭证、org 策略、记忆、MCP catalog、checkpointer;放进容器会割裂 HITL、prompt cache 管理和凭证注入。隔离真正需要保护的是"模型生成的 shell 命令",只隔离那一层就够。
- **沙箱是纯执行面、无 agent 状态**:故障域清晰,容器可随时杀掉重建。
- **可降级 + 惰性创建**:沙箱不是单点;LazySandbox 让不碰代码执行的对话零容器成本。
- **信任边界分层正确**:真正的边界是容器 + 网络策略(egress 走 placeholder/exchange,明文密钥不进沙箱);进程内命令字符串规则(deny/confirm)只是纵深防御,且 fail-closed、无副作用。
- **崩溃恢复语义完整**:不自动续跑、但状态一致、用户可重发,是可辩护的取舍。

风险(是税,不是方向错误):

1. **run 生命周期与进程绑定**:一个 run 活在接到它的那个 worker 进程里,重启只标记+修复。对话场景可接受;若出现小时级自治任务,需要把 run 挪进独立执行层 —— RunManager/checkpointer/Redis 已解耦,届时是"迁移"不是"重构"。
2. **`edit` 是全量 read-modify-write**:整个文件 download 进 backend 内存、进程内 diff、再 upload —— `read` 有 100MB 上限,`edit` 未见对应限制,大文件会造成 backend 内存/带宽尖峰;另与用户在终端面板里的并发编辑存在竞态。这是最值得加一道防线的地方。
3. **SandboxManager 的进程内状态**:`_touch_cache`、`_egress_generations` 是 per-process dict,多副本下是尽力而为语义;代码注释里大量篇幅在处理 race,是复杂度最集中的 bug 温床。DB+TTL 兜底方向正确,需防"补丁叠补丁"。
4. **PVC 孤儿留给运维**:delete 时 PVC 显式留给 operator 清理,规模上来后是持续负担。

## 关键文件索引

- `backend/cubeplex/streams/run_manager.py` — run 生命周期、工具/中间件装配、沙箱启用判断、附件水合、sandbox scope 解析
- `backend/cubeplex/middleware/sandbox.py` — execute/write/edit/read 工具、命令策略 `before_tool_call`
- `backend/cubeplex/sandbox/lazy.py` — LazySandbox 惰性创建
- `backend/cubeplex/sandbox/manager.py` — OpenSandbox 生命周期(provision/resume/reap/egress/PVC)
- `backend/cubeplex/sandbox/base.py` — Sandbox 协议 + `file_read` 默认实现(字节来自容器,解析在进程内)
- `backend/cubeplex/sandbox/local.py` — dev-only 进程内沙箱
- `backend/cubeplex/streams/recovery.py` — 启动时 stranded run 恢复
- `backend/docs/agent-system-design.md` — 官方运行时说明(与本笔记结论一致)
