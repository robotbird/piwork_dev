# 对话记录：模型与 Token 调用链路

## 当前实现

### 1. 请求模型

聊天入口 `app/(chat)/api/chat/route.ts` 用启用模型目录验证客户端模型，调用 `getPiModel()` 得到 Pi `Model`，组装 `RuntimeSpec.model`。非生产 Durable 分类只选择执行 lane，不替换模型；定时任务执行器也通过同一 RunManager 提交模型。

`RunManager.start()` 在 `backend.open()` 之前调用 `createAgentRun()`，将 `provider/id/name` 存入 `AgentRun.requestedModel`（迁移 `0017_run_model_snapshot`，可空 json）。这是请求快照，不是实际成功调用证明；即使 open/lease/prompt 失败也保留选定模型。不保存 Model 的 baseUrl、apiKey、headers 或供应商配置。

### 2. 实际完成模型和用量

- InProcess/SandboxTools：官方 AgentSession `message_end` → `PiEventNormalizer`。
- LocalRpc/SandboxRpc：官方 RpcClient JSON `message_end` → 同一 `PiEventNormalizer`。沙箱 `models.json` 保留 provider/id；模型通道仍经现有 Inference Proxy。
- Durable/组合车道：官方 `AgentEvent.message_end.entry.model[0]` → `DurableEventNormalizer`。

两类归一化器均生成 `RuntimeEvent.message.completed`，只加入可选 `model={provider,id,responseModel?}` 和已有 `usage={input,output,cacheRead,cacheWrite,totalTokens}`。`responseModel` 如有记录，代表供应商返回的具体模型。`RunManager.consume()` 通过已有白名单分配 seq，先 `PostgresEventStore.append()` 再广播；`runtimeEventData()` 不丢弃这些字段。 `(runId,seq)` 唯一键让重放/重复 append 不重复入账。

这是平台事件投影；不读 Pi JSONL 或 Durable SQLite，不另建 agent loop，不改变停止、恢复、安全与授权门禁。前端仍不消费 Pi 内部事件。

### 3. 会话级查询

`lib/db/conversation-queries.ts` 按 Chat → AgentRun → RuntimeEvent 聚合，list 与 detail 共用同一统计表达式，分页只限制会话或消息展示，不截断用量。

每个 run 的模型证据优先级：

1. 完成事件 model，优先具体 responseModel，否则 id；保留同 run 多模型。
2. 没有完成模型身份时使用 requestedModel，标注“请求模型快照”。
3. 两者皆无时只接受同 runId **且同 chatId** 的 InferenceAccessAudit `action=stream/status=allowed` provider/model，标注“历史推理审计”；拒绝/错误审计不当成实际响应。

供应商展示仅按已记录的 provider 精确匹配 ModelProviderPlugin（`installation:<安装记录 id>` 或直接 providerKey），取公开 displayName/providerKey。列表、详情与筛选显示供应商名称和 `/api/models/icon?provider=<providerKey>` 的包内 Logo，不展示内部 installation ID；未知/已卸载供应商显示未知供应商，图标缺失或加载失败回退通用图标。名称/Logo 是当前展示元数据，不能用插件当前模型配置推断或覆盖历史模型身份，不读取凭据。

多个 run 切换模型均保留，不把最后一次/当前默认模型冒充整个会话历史。模型筛选键为 JSON `[provider,id]`，避免跨 provider 同名模型混淆。查询支持模型检索、历史模型筛选和未记录模型筛选。

### 4. Token 口径

累计所有仍保留的 `message.completed.usage` 五个字段；一次工具循环可能有多条完成消息，全部计入。**totalTokens 直接累加 Pi 官方值**，不另加 reasoning（其已含在 output）；cacheRead/cacheWrite 另列明细，但不再加到 totalTokens。失败/取消前已持久化的完成消息也计入。

没有 usage 的旧会话显示“未记录”，供应商报告真实零则显示 0。页面另显示 usageRecordedMessages/completedMessages 与暂无 usage 的 run 数量，存在缺口时标注“部分记录”。运行中的未完成调用尚无最终 usage，只能刷新查看已经完成的调用，不能估算实时流 Token。

不将推理审计的 input/output 与完成事件重复相加：审计缺缓存和完整 totalTokens，不能替代主统计。当前不含分类、标题生成、压缩以及工具内部嵌套模型费用，不是供应商账单/终身用量。会话删除会级联删除 run/event；无可靠历史证据的模型与 Token 不回填、不按当前配置猜测。

### 5. 状态一致性与历史纠错

列表状态始终读最新 AgentRun，不在 UI 用成功消息掩盖 failed。已修复启动期 backend.open 尚未返回时被孤儿清理误判的竞态：启动所有权/心跳覆盖到 LiveRun 交接；未知持 lease 的 run 等心跳过期，数据库清理使用非终态条件 UPDATE 与同事务 lease 删除。详见 development.md「运行启动与清理竞态验证」。

历史误标只能定点人工核验：原错误确为 `worker lost (process restart)`，失败时间早于 run.started，之后有 message.completed / run.settled(reason=completed)，确定性 assistant 最终消息已落库，无存活 lease、无工具副作用或失败证据。留存变更前元数据，再按成功事件时间纠正 startedAt/endedAt、状态和错误文本；不得自动批量翻转失败终态，不重新执行 prompt/工具，不改模型或 Token 记录。

## 验证

- `pnpm db:migrate`：先应用 0017 再部署查询；开发 RunManager 单例跨 HMR 保留，新增请求快照需重启开发服务后对新 run 验证。
- `pnpm test:conversations:db`：模型快照实际 DB 写入、responseModel/切换模型/代理历史证据/模型搜索筛选/未知与真实零/多轮累计/重复事件幂等。
- `pnpm test:conversations:http`：独立管理员/普通用户/聊天夹具，真实 HTTP 验证列表、详情、供应商元数据、模型过滤、页面服务端渲染、管理员只读权限与参数校验。加 `PIWORK_CONVERSATION_BROWSER_TESTS=1` 验证供应商名称/Logo、筛选与详情、图标加载失败回退和可见文本不含 installation ID（需 Playwright Chromium；已安装且有 Logo 的供应商时验证品牌图标，否则验证未知供应商）。不调用真实模型、不修改用户聊天。
- `tests/unit/runtime/backends/usage.test.ts`：SDK/Durable 的模型和 usage 归一化一致，reasoning 不重复累计。
- `tests/unit/runtime/run/run-manager.test.ts`：包括 open 失败前模型快照透传。
- `pnpm test:runtime:db` / `pnpm test:runtime` 与 `pnpm exec tsc --noEmit`：既有回归；功能验证不等于容量验证。

## 官方依据（Pi 1.0.2）

安装的 `pi-coding-agent/docs/sdk.md`（message_end 权威完成消息）、`docs/message-types.md`（AssistantMessage、responseModel、Usage、reasoning 口径）、`examples/sdk/01-minimal.ts`；安装的 `pi-ai/dist/types.d.ts`（AssistantMessage/Usage）和 `pi-durable/dist/harness/events.d.ts`、`dist/types.d.ts`（message_end/EntryRecord）。未修改官方存储或事件机制，只扩展平台归一化负载与控制面投影。
