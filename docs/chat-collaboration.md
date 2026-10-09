# 聊天分享与协作（分享链接 + 协作成员 + Fork）

> 状态：已实现（首版 + 实时协作）。参考 [pi-pocket](https://github.com/TannerMidd/pi-pocket) 的 invite/fork/attribution 机制（`src/server/config.ts` 的 StoredInvite、`auth.ts` 的 redeem、`commands.ts` 的 #fork、`web/avatar.js` 的稳定色头像）与 multiplayer 实时机制（`src/server/room.ts`、`src/server/http/events.ts`），按 piwork 的正式账号企业平台与 PostgreSQL/RunManager 架构重新设计。本文描述当前实现与边界；架构总览见 [架构](architecture.md)。

## 1. 需求

1. **分享给指定人员**：对话界面右上角「分享」按钮打开分享弹窗，从组织内启用成员中选择一个或多个人，确认后其成为该对话的协作成员，可直接读写该对话，并在侧边栏「最近」中看到（带「共享」标记与所有者名）。
2. **分享链接 + token**：对话所有者可生成分享链接（`/chat/:chatId/join?t=<token>`）。其他已登录的正式启用成员打开链接后可参与该对话的协作；对话头部显示参与者头像堆叠，用户消息按发送者显示头像/名字归属。
3. **加入或 Fork**：拿到链接的用户在加入页二选一：
   - **参与协作**：加入后成为协作成员，与所有者共用同一对话（消息互见、都能续发消息）；
   - **Fork 新对话**：复制当前对话全部消息历史为自己所有的新对话（原对话不受影响），独立继续。

### 非目标（当前明确不做）

- 不做 pins/reactions/notes 等 multiplayer 文档同步（pi-pocket 的 ChatDoc/ReactionsDoc 体系依赖 Pi Durable 复制状态，piwork 无对应基础设施）。
- 不做权限分级（steer/viewer）：协作成员与所有者同为读写，仅删除对话、改可见性、生成/撤销链接、移除协作成员、重写历史（编辑/重新生成）保留给所有者。
- 不做匿名/站外分享：平台无访客，链接只对已登录的正式启用成员生效。
- 不做 token 永久有效：链接 7 天过期，可撤销、可重新生成（重新生成使旧链接立即失效）。
- 不做多实例横向扩展：实时事件为单常驻 Node 进程内广播（与平台 MVP 单实例前提一致）；多实例需外部总线（Redis pub/sub 等），当前不做。
- 不改变运行链路：协作消息仍走既有 `route → RunManager → RuntimeBackend → Pi AgentSession`，不新增 agent loop；未新增 Pi API 用法（平台控制面功能）。

## 2. 数据模型（迁移 0020）

| 表/列 | 说明 |
| --- | --- |
| `ChatCollaborator`（新表） | `chatId`（FK→Chat，级联删）、`userId`（FK→User，级联删）、`invitedBy`（FK→User，置空；直接指定时为所有者，链接加入时为加入者本人）、`createdAt`；`UNIQUE(chatId, userId)`。只存协作成员，**不存所有者行**——所有者始终以 `Chat.userId` 判定，避免回填与双路径。 |
| `ChatShareInvite`（新表） | `chatId`（FK 级联）、`createdBy`（FK）、`tokenHash`（sha256 hex，UNIQUE；token 本体只在创建响应中出现一次，之后不可再取回）、`expiresAt`（创建 +7 天）、`revokedAt`（可空）。每对话最多一条未撤销未过期链接；重新生成 = 撤销旧的 + 建新的。 |
| `Chat.forkedFromChatId`（新列，可空） | FK→Chat，`ON DELETE SET NULL`；fork 产物指向源对话。 |
| `Message_v2.userId`（新列，可空） | FK→User，`ON DELETE SET NULL`；用户消息写入时由服务端从会话取身份（不信任客户端 metadata），assistant 消息为 null。旧消息为 null，展示时按对话所有者归属回退。 |

## 3. 权限模型

统一入口 `lib/db/chat-share-queries.ts` 的 `getChatAccess(chatId, userId)`：单条查询返回 chat、`isOwner`、`isCollaborator`（满足其一即「对话成员」）。

| 操作 | 所有者 | 协作成员 | 持有效链接的登录用户 | 其他人 |
| --- | --- | --- | --- | --- |
| 读取消息/参与运行/续发消息/投票 | ✅ | ✅ | ❌（须先加入或 fork） | ❌ |
| 删除对话、改可见性 | ✅ | ❌ | ❌ | ❌ |
| 编辑/重新生成（重写历史） | ✅ | ❌ | ❌ | ❌ |
| 生成/重新生成/撤销链接、添加/移除协作成员 | ✅ | ❌ | ❌ | ❌ |
| 通过链接「参与协作」/「Fork」 | —（已在对话中） | —（已在对话中） | ✅ | ❌ |
| Fork（从对话页内） | ✅ | ✅ | 凭链接 ✅ | ❌ |

- 分享/加入均要求双方为**启用成员**：直接添加时按 Member(status=enabled) 过滤；链接加入时校验加入者存在启用成员记录（`ensureMemberForUserId` 语义之外仍 fail-closed）。
- 协作成员发消息使用**自己的**模型目录、Token 额度与频控（既有 `getUserModelCatalog`/`checkUserTokenQuota`/`getMessageCountByUserId` 不变）；RunManager `authorizeStart` 按 `spec.userId`（=请求者）复核角色模型授权。
- 并发冲突沿用既有语义：同一对话同一时刻仅一个活跃 run，第二条消息返回 `conflict:chat`，不因协作引入新队列。
- Durable 自动分流（`PIWORK_DURABLE_CHAT_ENABLED`）要求请求者为对话所有者：协作成员的消息固定走既有经典矩阵（`selectChatRuntime` 的 `durableEnabled` 输入加入 `isChatOwner` 条件），复用 `durable-chat-queries` 的归属复核作为第二道门，不 fallback。

## 4. API

| 路由 | 方法 | 权限 | 行为 |
| --- | --- | --- | --- |
| `/api/chat/share?chatId=` | GET | 对话成员 | 返回 `myRole`、`participants`（所有者+协作成员，仅 id/name/image/title，不含 email）、`collaborators`、活跃链接 `{ expiresAt }`（仅所有者；token 不回显）；所有者另附 `members`（可分享的启用成员目录，排除自己）。 |
| `/api/chat/share` | POST | 所有者 | `{ chatId, memberIds?, regenerate? }`：添加协作成员（幂等 onConflictDoNothing）；`regenerate` 或无活跃链接时创建新链接，**token 明文仅出现在本次响应**。 |
| `/api/chat/share` | DELETE | 所有者 | `userId` 参数 = 移除该协作成员；`revoke=1` = 撤销活跃链接。移除后该用户立即失去读写（下次请求 forbidden），侧边栏条目随之消失。 |
| `/api/chat/share/join` | POST | 登录 + 启用成员 + 有效链接 | `{ chatId, token }`：constant-time 比较 tokenHash，校验未撤销/未过期；已是成员返回 `alreadyMember`；成功写入 ChatCollaborator。 |
| `/api/chat/fork` | POST | 对话成员，或登录 + 有效链接 | `{ chatId, token? }`：事务内复制 Chat（新 id、标题 `《源标题》（分支）`、owner=发起者、`forkedFromChatId`、visibility=private）与全部 Message_v2（**重新生成消息 id**，保留 createdAt/userId/parts），返回新 chatId。不复制协作成员与链接。 |

接入既有路由的所有权判定改为 `getChatAccess`：

- `/api/chat` POST：非成员 `forbidden:chat`；用户消息落库写 `Message_v2.userId`；协作成员不触发 durable lane。
- `/api/chat/[id]/stream`、`/api/chat/[id]/stop`、`/api/vote` GET/PATCH：成员可读/可停/可投票（投票 PK 仍为 `(chatId, messageId)`，跨成员共享一份）。
- `/api/messages` GET：成员返回 `isReadonly=false` + `participants` + `myRole`；非成员 403（沿用 public 可见性例外：public 对话他人仍只读可见，`isReadonly=true`，但**不**下发参与者名单）。
- `/api/history`：合并本人对话与协作对话（`Chat.userId = me OR EXISTS ChatCollaborator`，项目聊天除外），协作条目附 `sharedWithMe: true` 与 `ownerName`；分页游标语义不变。
- `app/(chat)/actions.ts` 的 `updateChatVisibility`/`deleteTrailingMessages`：保持所有者限定。

## 5. 交互与视觉

遵循 [设计系统](design-system/openai-unified-interface/design-spec.md)：内容先行、结构安静、蓝色只表达可交互/进行中、`1px` 轻边框、胶囊/中圆角。

- **分享弹窗**（`components/chat/share-dialog.tsx`，Radix Dialog，`max-w-lg`）：三个区块——① 成员选择（搜索 + 复选列表，选中计数 + 「添加」）；② 当前协作成员（头像 + 名字 + 所有者移除按钮）；③ 分享链接（所有者：「生成链接」→ 一次性展示完整链接 + 复制按钮 + 过期时间，附「重新生成」「撤销」）。链接仅在生成时展示一次（token 服务端只存哈希），文案明示。
- **参与者头像堆叠**（`components/chat/participant-avatars.tsx`）：对话头部分享按钮左侧，最多显示 4 个圆形头像（`size-6`，白描边叠压 `-ml-1.5`），超出显示 `+N`；hover 提示名字。有 `User.image` 用 `next/image`（unoptimized，复用 `user-nav.tsx` 模式），否则显示姓名首字母。
- **消息归属**：对话参与者 > 1 时，用户消息气泡旁显示发送者小头像（旧消息/无归属回退为对话所有者）；单人对话不显示，保持现状。
- **加入页**（`app/(chat)/chat/[id]/join/page.tsx`）：居中卡片——对话标题、所有者、消息数与协作人数、两条主操作（「参与协作」accent 实心 /「Fork 新对话」描边）；链接无效/过期显示失效卡片；已是成员显示「进入对话」。移动端宽度 `calc(100vw - 32px)`。
- **侧边栏共享标记**：协作对话行标题旁小「共享」badge + 所有者名（次要文字层级）。

## 6. 安全边界（如实声明）

- token 为 24 字节 CSPRNG base64url；服务端只存 sha256，比较用 `timingSafeEqual`。token 明文只在创建响应出现一次；**泄露即换链**（重新生成）。链接不提供 Webhook/邮件外发，由用户自行分发。
- 加入页不泄露对话内容：未加入前只返回标题、所有者名、消息/成员计数，不返回消息正文与参与者完整名单。
- fork 复制的是消息文本/附件引用；本地受保护附件 URL 仍按原归属鉴权，fork 所有者可能无权读取源所有者的历史附件（旧 Blob 公共对象不受影响）——首版如实保留该边界，不复制附件字节。
- 协作成员能看到对话全部历史与后续消息（等同所有者），企业内分享前请确认内容可共享；移除协作成员不撤销其已看到的内容，也不是审计事件。
- 分享不改变 Chat.visibility 语义：协作成员不是 public；public 仍为平台内任意登录者只读，且不下发参与者名单。
- 本功能不产生新的模型调用路径、不改变 RunManager/后端契约、不新增 Pi API 依赖；分类器/标题/定时任务等辅助链路的身份仍取自服务端会话。

## 7. 测试与验证

- `pnpm test:chat:share`（`tests/unit/db/chat-share-queries.test.ts`，真实 PostgreSQL）：协作成员增删查、`getChatAccess` 归属判定、链接创建/过期/撤销/regenerate 轮换、token 哈希校验、fork 复制（新 id/归属/`forkedFromChatId`/源不动）、`listChatHistoryIncludingShared` 合并与游标。
- `tests/unit/chat/share-token.test.ts`（无 DB）：token 生成格式、哈希比较的恒时与错误拒绝、过期/撤销判定。
- 既有 `test:runtime`/`test:unit` 回归：聊天请求 schema、RunManager、事件链路不受影响。
- 手工验收路径：A 创建对话 → 分享给 B（直接添加）+ 生成链接给 C；B 直接读写并看到头像；C 打开链接选择「参与协作」后读写；D 打开链接选择「Fork」得到独立对话；A 撤销链接后 E 打开同链接失效。

## 8. 实时协作（第二版，参考 pi-pocket 机制）

### 8.1 pi-pocket 机制研究结果

pi-pocket 的 multiplayer 由四层组成：

1. **传输层**：每个浏览器 tab 一条 SSE（`/api/events`，15s ping，retry 1.5s），外加降级长轮询（`/api/poll`，seq/ack 去重补偿丢包）；
2. **房间层**：每个会话一个进程内 `Room`（`Set<Client>`），订阅 Pi Durable 的复制视图（chord `AttachedReplicatedState`）；commit 触发 90ms 合并去抖后向各 Client 推**增量 diff**（`sentEntries`/`sentFields` 逐客户端去重）；聊天消息存 ChatDoc（Durable 文档），新消息只广播新增部分；
3. **presence/typing**：纯内存（重启即失），tabs 计数、visibility 判 away、typing 6s TTL 自动清除；
4. **接入鉴权**：attach 时 `canSee` 检查，无权发 `missing` 事件并降级为只收全局事件；离线通知走独立 Web Push（RFC 8291/8292）。房间在最后一个 client 离开 30s 后关闭。

### 8.2 piwork 适配设计（关键差异）

piwork 无 chord/Pi Durable 复制视图，消息以 PostgreSQL `Message_v2` 为唯一真相，运行流已有 RunManager 订阅重放机制（`/api/chat/[id]/stream` 任意成员可 attach 活跃 run，客户端已有 `resumeStream`）。因此实时层采用「**通知与内容分离**」：

- SSE 只承载小事件（presence/typing/message 通知/run 通知/missing），**不推送消息正文**；收到事件后客户端重新拉 `/api/messages`（真相在 DB）或 `resumeStream()`（复用既有活跃 run 重放+活流 tail，看到别人正在生成的回复）；
- 事件 hub 为进程内模块（`lib/collab/chat-event-hub.ts`），全局单例、房间空即删，无持久化；
- typing 6s TTL、presence 内存态与 pi-pocket 一致；接入鉴权在 SSE 建连时 `getChatAccess` 校验 + **15s ping 周期复查**，被移除的成员在下一次 ping 收到 `missing` 并断开。

### 8.3 服务端 API

| 路由 | 说明 |
| --- | --- |
| `GET /api/chat/[id]/events` | 成员专用 SSE：`retry: 3000`、15s `: ping`；事件：`hello`（自者，含在线/typing 快照 + connectionId）、`presence`（他人加入/离开）、`typing`（userId + true/false，6s TTL）、`message`（actorId + role，仅通知不携带正文）、`run`（actorId + started/finished）、`missing`（权限复查失败，客户端应停止订阅并提示）。 |
| `POST /api/chat/[id]/typing` | 成员专用：`{ typing: boolean }`，节流由客户端负责。 |

事件发布点（均为服务端既有持久化路径之后）：

- `/api/chat` POST 用户消息落库后 → `message(user)`；RunManager start 成功 attach 后 → `run(started)`；
- `lib/runtime/run/index.ts` 的 `messageStore.upsertAssistantMessage`（终态幂等 upsert，经典/Durable/定时任务共用）→ `message(assistant, actorId=null)` + `run(finished)`；
- `lib/scheduler/executor.ts` 定时任务用户消息落库后 → `message(user)` + run start 后 `run(started)`（watcher 可看到定时任务触发的对话）。 

### 8.4 客户端行为（`hooks/use-chat-collab.ts` + `use-active-chat` 集成）

- 成员视图对 `/api/chat/[id]/events` 维持 EventSource（自动重连）；
- `message` 事件：actorId 为本人则跳过（自己已在流内）；否则且本地无进行中 run（status=ready）时重拉 `/api/messages` 并 `setMessages` 重建（真相在 DB，幂等）；
- `run started`：非本人且本地 ready 时 `resumeStream()` attach 到对方活跃 run，实时看到回复生成；
- `typing`：输入包装器节流上报（≥2s 间隔，空输入/发送后上报 false）；展示层过滤本人；
- `presence`/`hello`：参与者头像显示在线点（绿）与输入中指示（蓝点脉冲 + 「X 正在输入…」文字）；
- `missing`：关闭订阅，界面退回非实时（下次刷新重新走成员校验）。

### 8.5 边界（如实声明）

- 单实例：hub 无跨进程广播，多副本部署时同一对话的 watcher 可能分布在不同进程收不到彼此事件（MVP 单常驻 Node 前提下不发生）；不做容量验证；
- 事件尽力而为：SSE 断线期间的消息由重连后的 `hello` + 客户端拉取补偿，但不保证秒级；assistant 事件 actorId 为 null（messageStore 回调无运行归属），本人自己也会重拉一次（幂等，无内容风险）；
- 权限撤销延迟：SSE 建连校验 + 15s ping 复查之间被移除的成员最多续订 15s 事件（事件本身不含正文，泄露面仅为 presence/typing/“有新消息”信号）；
- HMR：开发环境模块热替换会重建 hub（连接丢失自动重连），无需迁移；生产无此问题；
- 与 pi-pocket 的差异：无长轮询降级（部署在自有 nginx + pm2，SSE 可直达）；无 Web Push 离线通知；无 pins/reactions；不推送内容 diff（避免与 DB 真相双写）。

### 8.6 跨用户头像投影（2026-10-09 修复）

**问题**：`User.image` 保存的是本人 LibraryItem 预览地址 `/api/library/:id?preview=1`，该路由按本人归属鉴权（`getLibraryItem(session.user.id, id)`）——协作者加载所有者头像返回 404，参与者头像堆叠里只有当前登录者本人能显示图片，他人显示为破损图标。

**修复**：新增头像投影端点 `GET /api/users/:id/avatar`，协作链路（`listChatParticipants`/`listChatCollaborators`/`listShareableMembers`/`getChatShareSummary` 的 `ownerImage`）统一下发 `/api/users/:id/avatar` 而非原始 library 地址：

- 可见性：登录且启用成员（头像属企业内成员互可见的身份信息；参与者名单本身已按对话成员收敛）；
- 服务端双归属校验：严格解析目标用户 `User.image`（只认本平台 library 预览格式，不代理任意 URL），且解析出的 LibraryItem.`userId` 必须等于该用户（防把他人文件当头像读取）；
- 仅限图片 content-type（与上传端约束一致）；未设置/格式不符/归属不匹配 → 404，前端 `UserAvatar` 回退姓名首字母；
- `private, max-age=3600` 短缓存；本人侧边栏头像（user-nav）仍用原始 URL，不受影响；`/api/library/[id]` 归属鉴权不变。
