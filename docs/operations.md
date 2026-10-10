# 运行手册：本地/单机启动与维护

> 状态：当前实现。本文是运行与维护的单一入口，**组件、端口、启动命令或配置项变化时必须同步更新本文**。
> §1–§7 为本机（macOS + colima + OpenSandbox docker 档）实测基线（2026-10-04）；§8 为 3.5 GB Linux 测试服务器的独立配置与验证记录（2026-10-10）。架构与边界见 [项目架构](architecture.md)，开发与测试约定见 [开发与测试](development.md)。

## 1. 组件与端口总览

| 组件 | 端口/位置 | 说明 |
| --- | --- | --- |
| PostgreSQL | `POSTGRES_URL`（本机 5432） | 控制面：身份/聊天/运行/沙箱注册表/审计 |
| colima + docker | `unix://$HOME/.colima/default/docker.sock` | 沙箱底座；容器 `sandbox-<id>` 与 `sandbox-egress-<id>` |
| OpenSandbox lifecycle server | `http://127.0.0.1:8080` | 源码 `/tmp/OpenSandbox/server`，配置 `~/.sandbox.toml`（含 `api_key`），状态库 `~/.opensandbox/opensandbox.db` |
| Next.js dev 服务（`pnpm dev`） | `http://localhost:3000` | 应用入口；**同进程托管 Inference Proxy** |
| Inference Proxy | `0.0.0.0:3210` | 沙箱内模型的唯一出站通道；真实凭据只留在控制面 |
| 沙箱宿主映射端口 | 40000–60000 | 每个 egress 沙箱占 3 个（execd 44772 / http 8080 / egress API 18080） |

关键事实：`PIWORK_INFERENCE_URL` 是**沙箱视角**的代理地址，必须用宿主当前局域网 IP（本机曾用 `172.20.10.2`，切网后为 `192.168.1.5`；`host.docker.internal` 在 Clash fake-IP 下会解析成 `198.18.*` 不可用）。

## 2. 启动顺序与命令

严格按序启动；前一步健康检查不通过不要继续。

### 0) 配置检查（`.env.local`）

沙箱/推理变量的完整清单已在 `.env.example` 注释块（默认全部注释 = in-process 不变）；本地实际启用值在 `.env.local`：

```bash
PIWORK_SANDBOX_PROVIDER=opensandbox
PIWORK_SANDBOX_ROUTING=matrix            # 执行 run 走沙箱、纯对话 in-process
PIWORK_SANDBOX_IMAGE=pi-runtime:dev
PIWORK_SANDBOX_CLI_PATH=/opt/pi/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js
OPENSANDBOX_DOMAIN=127.0.0.1:8080
OPENSANDBOX_PROTOCOL=http
OPENSANDBOX_API_KEY=<与 ~/.sandbox.toml 的 api_key 一致>
PIWORK_INFERENCE_URL=http://<宿主当前局域网IP>:3210
# 可选：PIWORK_INFERENCE_PROXY_HOST/PORT、PIWORK_INFERENCE_EGRESS_ALLOWLIST、
#       PIWORK_SANDBOX_TTL_SECONDS、SCHEDULED_TASKS_ENABLED=true（常驻调度）
```

**IP 变化（换 Wi-Fi/热点）后必须**：更新 `PIWORK_INFERENCE_URL` → 重启 dev 服务 → 到 `/admin/sandboxes` 销毁旧沙箱（旧 egress 白名单仍放行失效 IP，不销毁会继续复用坏策略）。

### 1) docker 底座（colima）

```bash
colima start            # 已运行则跳过；docker context 默认 colima
docker info --format '{{.ServerVersion}}'   # 有版本号输出即健康
```

### 2) pi-runtime 镜像（首次或 pi 版本变化时）

```bash
docker build -f docker/pi-runtime/Dockerfile -t pi-runtime:dev docker/pi-runtime
# 受限网络先 docker pull docker.m.daocloud.io/library/node:22-alpine 并 tag，
# 再加 --build-arg NPM_REGISTRY=https://registry.npmmirror.com
```

镜像内 pi 版本随仓库 `package.json` 同步（`--build-arg PI_CLI_VERSION=` 覆盖）。

### 3) OpenSandbox lifecycle server

```bash
cd /tmp/OpenSandbox/server
DOCKER_HOST=unix://$HOME/.colima/default/docker.sock \
  no_proxy='*' NO_PROXY='*' \
  uv run opensandbox-server --config ~/.sandbox.toml
```

- `no_proxy='*'` 是**必须的加固项**：Python urllib 的代理配置在进程首次请求时捕获一次，之后不随系统代理变化（见 §6 F1）。
- 健康检查（server 无响应时后续 acquire 全部 30s 超时）：

```bash
curl -s -H "OPEN-SANDBOX-API-KEY: $(grep '^OPENSANDBOX_API_KEY' .env.local | cut -d= -f2)" \
  "http://127.0.0.1:8080/sandboxes?page_size=1"    # 期望 HTTP 200
```

### 4) 数据库迁移

```bash
pnpm db:migrate
```

### 5) 应用与 Inference Proxy

```bash
pnpm dev     # 3000 应用 + 3210 Inference Proxy 同进程
```

代理监听失败会 fail-closed（首个沙箱 run 显式失败），不会静默无模型通道。需要常驻定时任务时另设 `SCHEDULED_TASKS_ENABLED=true`（MVP 单实例，不承诺分布式调度）。

### 6) 启动验证清单

```bash
# ① 推理代理鉴权入口（沙箱视角地址；无 token 应 401，超时即网络/地址错误）
curl --max-time 5 -o /dev/null -w '%{http_code}\n' -X POST http://<局域网IP>:3210/messages   # 期望 401
```

- ② 登录后发「你好」：应答正常，AgentRun `backend=in_process`、`status=settled`。
- ③ 发执行类请求（如「每隔 5 秒输出当前时间，共 12 次」）：`/admin/sandboxes` 出现实例，AgentRun `backend=sandbox_rpc`；完成后默认销毁。
- ④ 沙箱内网络验证（可选，等价于 run 时的通道）：

```bash
node --conditions=react-server --import tsx --input-type=module -e '...provider.acquire + docker exec 探针...'
```

用 §6 F2 的最小探针思路：临时沙箱内 `node -e fetch(...)` 预期 401，`release(h,"kill")` 清理。

### 7) 非生产 Durable + Sandbox 自动聊天分流（默认关闭）

普通部署继续上面的 matrix/RPC 设置；**不切全局后端，不设置 PIWORK_RUNTIME_BACKEND=durable**。仅开发/test 环境可额外配置：

```bash
PIWORK_DURABLE_CHAT_ENABLED=1
PIWORK_DURABLE_STORAGE_DIR=/absolute/private/durable
UPLOAD_DIR=/absolute/path/to/existing/uploads
```

- 私有目录必须持久、沙箱不可见、不公开、不与彼此或 `.pi/workspace` 重叠，祖先目录由部署方保护；UPLOAD_DIR 指向旧上传根，不自动迁移已有文件。production/未知 NODE_ENV、禁用执行工具或配错均拒绝。development 所有正式启用成员可自动分流，无需用户白名单且忽略旧名单；test 仍要求非空 UUID 名单（PIWORK_DURABLE_CHAT_USER_IDS），不接受通配符/邮箱。
- 重启应用后无需勾选：问答走轻量链路，适配四工具的文件/命令任务自动走 Durable；Skill/平台能力关键词、已登记名称、近期非四工具调用、审批及分类不确定保守留既有链路，不扩张其能力。客户端 runtimeLane 被剥离；本人能力 API `/api/chat/runtime-options` 仅保留查询，执行前仍复核 enabled/归属/运行状态/模型。分流不是授权，选定后失败不 fallback，活跃运行不迁移。
- Durable 四工具+私有交付，每条消息新工作区，无 Skill/MCP/Package/定时任务/审批续跑/Worker/自动恢复。附件需本人 LibraryItem，20 MB/文件、总计 50 MB、最多五个，图像累计 8 MB；水合变更/缺失失败，不在宿主解析 Office/图片或回退宿主。制品私有保存、正式归档后才可下载。
- 验证看 AgentRun.backend=durable_sandbox、RuntimeEvent/Message_v2 文件引用、本人文档库/跨用户下载拒绝和 `/admin/sandboxes` 销毁记录。Stop 命令受理不等于干净取消，shell 未知效果可能 failed；清理失败保留 SQLite owner，禁止 PID/TTL 偷锁、自动重放或假装成功。
- SQLite 留控制面私有 root，临时 workspace 终态强杀并核验；此车道的工具沙箱不需要模型代理，仍需保留普通 RPC provider/CLI 配置。生产平台账本、Worker、reaper、持久 workspace/恢复与安全硬隔离验收未完成。

可选真实 HTTP 验证（**会调用真实模型和 provider**，不是容量/UI/恢复测试）：

```bash
PIWORK_DURABLE_CHAT_HTTP_TESTS=1 \
node --env-file=.env.local --conditions=react-server --import tsx \
  tests/e2e/durable-chat-http.mts
```

需要非生产 DB 的 CREATE SCHEMA 权限；fixture 创建唯一 schema（无 public fallback，只复制加密模型配置）、独立 build/tsconfig、私有 SQLite/文件，并启动 3011 测试服务器（PIWORK_DURABLE_CHAT_HTTP_PORT 可覆盖）。这样不触碰日常 RunManager 的运行表/构建；NEXT_DIST_DIR/NEXT_TSCONFIG_PATH 为可选构建隔离配置，普通启动仍使用 `.next`/`tsconfig.json`。成功后停测试服并清理仅该 schema/目录；失败保留隔离 schema/owner/文件证据，先独立核验并销毁**本组** provider 实例再清理，不自动偷锁。真实 OpenSandbox/模型 HTTP 验证已通过。

## 3. 日常维护

### 后台 Sandbox 额度配置

首次升级先应用迁移 0021 并重启应用；管理员打开「运行与环境 → Sandbox 配置」（`/admin/sandbox-settings`），设置 CPU/内存并保存。默认沿用 2 核/2048 MB，轻量预设 1 核/768 MB 仅试验起点，需要点保存才生效。保存后新建 RPC 沙箱直接读取，无需再次重启；运行中实例不调整，非生产 Durable 独立额度不变。RPC 每 run 创建新实例并默认终态 kill。

此页面不会安装 Docker/OpenSandbox、启动底座或启用沙箱路由；Provider、镜像、CLI、TTL、推理代理与凭据仍须按 §2 配置并重启。显示“已配置”不代表底座或代理连通性已验证。3.5 GB 小内存主机建议串行轻量功能验证，关注 `free -h` 的 available、`docker stats` 与 OOM，确认容器终态销毁；配置不是内存预留或并发限制，不跑服务器 Next.js 构建或容量测试。

### 沙箱生命周期

- run 结束默认 `kill` 销毁；chat 级复用靠租约保活；到期时间见 `/admin/sandboxes`（详情可延长 1 小时、真实销毁）。
- 状态核验失败显示「状态待确认」，不当作已销毁；销毁前会先停关联 run（chat + expectedRunId）。
- `SandboxInstance.runtimeConfig` 是创建时的额度/egress 快照，不是实时用量。

### 残留清理（server 异常中断后）

```bash
docker ps -a --format '{{.Names}} {{.Status}}' | grep '^sandbox'
docker rm -f sandbox-<id> sandbox-egress-<id>          # 确认无活跃 run 后逐个清理
docker volume ls -q | grep '^opensandbox-runtime-'     # 孤儿 runtime 卷一并删
```

管理页登记的实例用页面「销毁」（会同步注册表）；直接 docker rm 的残留记录再由页面核验处理。

### 日志位置

- OpenSandbox server：启动终端 stdout（建议 `tee /tmp/opensandbox-server.log` 留档）。
- 应用/Inference Proxy：`pnpm dev` 终端；聊天流异常见 `[chat] stream execution failed`。
- 历史排障输出在 `/tmp/piwork-*.log`（过期可清理）。
- 数据库侧：AgentRun.errorMessage、RuntimeEvent(type=run.failed)、InferenceAccessAudit（脱敏）是判定失败层级的第一入口。

## 4. 失败层级速查

| 现象 | 先看哪里 | 指向 |
| --- | --- | --- |
| acquire 30s 超时 | server 终端日志 | §6 F1（server 卡死/代理缓存）或 docker 底座未起 |
| run.failed `fetch failed`，无 tool 事件、InferenceAccessAudit 空 | RuntimeEvent / Audit 表 | §6 F2（模型代理地址不可达） |
| 403/401（代理审计 denied） | InferenceAccessAudit | run token 过期（30min 滑动）或模型 grant 不匹配，重发请求即可 |
| 沙箱 ready 但任务无输出 | server 日志 + docker events | RPC/PTY 通道问题，附 server 错误上报 |

## 5. 重启顺序与注意

1. 先在 `/admin/sandboxes` 确认无「运行中」实例（server 停机会掐断活跃 run 的 RPC/模型通道）。
2. 停 `pnpm dev` → 停 OpenSandbox server → （需要时）`colima stop`。
3. 启动按 §2 逆序回放：colima → server（带 `no_proxy`）→ dev。
4. colima 重启后所有沙箱容器消失；登记实例由页面核验收敛为 destroyed/过期，不需要手工改库。
5. **改 `.env.local` 的 runtime 装配（provider/routing/inference/durable chat 开关与私有根）后必须重启 `pnpm dev`**：开发模式 RunManager 单例跨 HMR 保留，热更新不会加载新回调。

## 6. 已知故障与处置（实测）

### F1 全部沙箱创建 30s 超时（2026-10-04）

- 症状：聊天流 `SandboxUnavailableError: acquire 失败: Request timed out (timeoutSeconds=30)`；server 日志 `Egress sidecar did not become ready within 30s ... [Errno 61] Connection refused`；docker events 只见 egress sidecar 创建、主容器始终不出现。
- 根因：长驻 server（uptime 1 天+）的 Python urllib 默认 opener 在**进程首次请求时**捕获一次系统代理；启动时 Clash 系统代理开启，之后关闭 Clash，server 的就绪探测全部发往已关闭的本地代理端口。同刻宿主 curl/一次性 python 探测同端口 `/healthz` 均 200，可对照确认。
- 处置：重启 server；启动命令带 `no_proxy='*' NO_PROXY='*'` 防复发。切换系统代理（开/关 Clash）后建议主动重启 server。

### F2 模型请求 fetch failed（2026-10-04）

- 症状：`run.failed: fetch failed`，无任何 tool 事件，InferenceAccessAudit 无记录（请求没到代理）。
- 根因：宿主 IP 变化后 `PIWORK_INFERENCE_URL` 仍指旧地址。
- 处置：§2 步骤 0 的「IP 变化」三步；验证必须从**新建沙箱**内发请求（旧沙箱 egress 白名单不会更新）。无 token 打 `/messages` 期望 401——401 证明网络通、鉴权入口正常。

### F3 Clash fake-IP / TUN

`host.docker.internal` 可能解析为 `198.18.*`（fake-IP）导致沙箱内 fetch failed。用宿主局域网 IP 作为 `PIWORK_INFERENCE_URL`；不关闭 egress 限制、不回退 in-process。

### F4 SDK startProcess 偶发 502

`Upload failed (status=502) / UNEXPECTED_RESPONSE`（SDK→execd 文件上传）。单次出现可重试；持续复现先查 server 日志与 colima 状态，再上报，不当网络结论。

### F6 有历史的 RPC 启动退出（Pi 1.1.0，2026-10-10）

- 症状：普通聊天成功，随后执行 run 在 prompt 受理前 failed，`Agent process exited (code=0 signal=null). Stderr:` 为空；桥接退出码不能当作沙箱内 Pi 成功证据。单纯文件/代理 401/无历史 getState 都可能正常。
- 根因：历史 JSONL header.cwd 保存了宿主目录，沙箱内只有 `/workspace`。官方 CLI 的 `getMissingSessionCwdIssue` 拒绝不存在的 stored cwd；PTY stderr 未走宿主 RpcClient.getStderr，所以错误被桥接掩盖。
- 修复：仍使用官方 SessionManager.create，只将 SandboxRpc 种子 cwd 指向 handle.workspaceRoot；不挂载宿主原路径、不手改 JSONL、不绕过 Pi 检查、不回退宿主。LocalRpc 默认 cwd 不变。必须复验“先问候再执行”的有历史聊天，不重放旧失败 run。

### F5 backend.open 失败的行为

RunManager 必然落 `AgentRun.status=failed`（errorMessage 带真实错误）并释放沙箱租约，绝不回落 in-process；查错从 AgentRun/RuntimeEvent/server 日志三层对照，不要只看前端通用提示。

### F7 文件操作被误判为轻量问答（2026-10-10）

- 症状：用户原句“请获取当前服务器时间 写入time.txt”的run da0c95b6-0a82-4af7-80a4-81870af5913a落in_process/settled，路由日志requiresExecution=false/reason=lightweight，无tool/artifact事件。env仍为opensandbox/matrix；不是底座停机或失败fallback。
- 根因：未配置PIWORK_CLASSIFIER_MODEL，走pi-auto-router0.3.0本地纯函数；平台补充规则遗漏中文“写入”和命名文本文件操作。原句没有触发已有执行关键词。
- 修复：ai/file-operation-intent.ts补中文落盘、保存/读取txt/md/json/yaml等文件提示，执行启发式和纯搜索检测共用；历史文件任务的“继续/查询…”也不能提前走纯搜索。普通文章创作/文件名含义解释仍轻量，配置模型时官方classifier优先级不变，文件授权/后端失败不fallback不变。
- 回归：原句及中英文文本/配置文件动作、开启联网和历史连续请求、负例通过；Runtime344通过/15跳过，unit61通过，类型/Biome通过。真实原句验证用§8的独立HTTP夹具，加PIWORK_OPENSANDBOX_TIME_TEST=1（本地文件存储），检查sandbox_rpc、实际bash date/time.txt及销毁；下载只在实际调用deliver_file时检查，不能将“写入”当作“必然交付”。修复使用deploy.sh daily部署至releases/20261010061055，原句真实验证通过（run7189ac8c-1b2a-46b8-a752-92771f7be719为sandbox_rpc/settled，sandbox e1a29c1a-99e9-4761-8981-475dcd0e5972已由provider确认删除，成功夹具清理）。另一次过严的下载断言诊断夹具已禁用并保留，模型未调用deliver_file，非run失败。旧用户run不修改、不重放；需要下载请在新请求明确“并交付文件供我下载”，写入目标为沙箱目录（默认UTC时区），不写宿主目录；临时文件随沙箱销毁。
- 官方依据：已安装pi-auto-router@0.3.0/src/intent-classifier.ts（classifyIntent仅返回意图类别，不授权执行）及Pi classifier类型/调用契约；继续使用官方分类器/原Runtime链路，不新增agent loop。

### Skill 基础执行验证（2026-10-10）

最新实现与使用见 [Skill 沙箱基本执行](skill-sandbox-execution.md)：复用 SandboxRpc 同步完整启用目录、原生 Skill 加载与脚本执行，不新增 Worker/backend/审批库；本轮代码尚未部署应用。独立打包探针在服务器单容器实测，通过官方 `/skill` 展开、实际 Node 脚本/assets/references、输出、store→archive 测试回调及 artifact 事件、底座删除；无真实模型调用/会话写入。成功 sandbox ed506858-406b-4ba8-a1bb-3996820a8666 已删除；一次 probe store 夹具字段误用修正后重测，其 sandbox 65415653-7a4c-4c27-b2a1-721561082db3 也已回收。应用 release/env/路由未改。复制不是只读挂载/不可变审批，不是企业安全、浏览器下载或容量验收。

## 7. 关联文档

- [项目架构](architecture.md)：模块边界与运行链路
- [开发与测试](development.md)：测试命令、沙箱契约组、排障记录（历史细节）
- [OpenSandbox 接入 Spec](opensandbox-integration-spec.md)：provider 设计与安全基线
- 本地基线官方依据：安装版 `@alibaba-group/opensandbox@1.1.0`（SDK）、`/tmp/OpenSandbox/server/opensandbox_server`（docker runtime 的 create/egress/readiness 实现）；Linux server 1.1.1 依据见下一节。

## 8. 3.5 GB Linux 测试服务器 OpenSandbox

服务器 `root@123.56.79.62` / `/yepeng/web/piwork.net` 使用 Linux amd64、Docker 26.1.3；**在本机编译 Next.js/amd64 镜像，不在服务器构建，不启用 Durable、不做并发或容量测试**。

| 组件 | 安装/配置 | 限制 |
| --- | --- | --- |
| OpenSandbox lifecycle | PyPI opensandbox-server==1.1.1；uv Python 3.12.15；/opt/piwork-opensandbox/venv | systemd piwork-opensandbox.service，MemoryMax=512M / CPUQuota=50%，初始实测约 114 MiB |
| 配置/状态 | /etc/piwork-opensandbox/sandbox.toml（600，含随机 API key）；/var/lib/piwork-opensandbox/opensandbox.db | SQLite 留可信宿主；API 127.0.0.1:8080，NO_PROXY=* |
| Docker runtime | pi-runtime:1.1.0-amd64（完整 Pi 1.1.0）；execd:v1.1.0 / egress:v1.1.7 | publish_host=127.0.0.1，映射范围40000–40100；egress dns+nft，pids_limit=1024 |
| Next.js/模型代理 | 应用3002；代理172.17.0.1:3210 | 同进程私网绑定，sandbox视角URL=http://172.17.0.1:3210；API key/模型凭据不公开 |
| 主沙箱资源 | DB 已保存0.5核/768 MB，TTL600秒、matrix | 每run新建/终态kill；额度不包含sidecar与lifecycle服务，不等于内存预留或并发准入 |

环境在 shared/.env.local：PIWORK_SANDBOX_PROVIDER=opensandbox、PIWORK_SANDBOX_ROUTING=matrix、PIWORK_SANDBOX_IMAGE=pi-runtime:1.1.0-amd64、PIWORK_SANDBOX_CLI_PATH 使用§2完整安装路径；OPENSANDBOX_DOMAIN=127.0.0.1:8080 / PROTOCOL=http / API_KEY 从私有TOML读取；READY_TIMEOUT_SECONDS=60；PIWORK_INFERENCE_URL=http://172.17.0.1:3210 / PROXY_HOST=172.17.0.1 / PROXY_PORT=3210。修改前备份环境，确认无活跃run后pm2 reload piwork；服务或完整聊天检查失败时撤回应用分流，不降级重放失败任务。

```bash
systemctl status piwork-opensandbox --no-pager
journalctl -u piwork-opensandbox --since '10 minutes ago' --no-pager
curl --noproxy '*' -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/health
# lifecycle需凭据的请求由SDK或私有Python读取TOML发起，不把key放入命令行/输出。
cd /yepeng/web/piwork.net/current
PIWORK_OPENSANDBOX_ACTIVATION_TEST=1 pnpm test:opensandbox:activation
PIWORK_OPENSANDBOX_RPC_TEST=1 PIWORK_RPC_PROBE_EXTENSION=1 pnpm test:opensandbox:rpc
PIWORK_OPENSANDBOX_CHAT_TEST=1 pnpm test:opensandbox:chat # 会真实调用模型，仅一个执行沙箱
```

源码/测试依赖tsx不在生产安装时，可使用已安装的 `pnpm dlx tsx --conditions=react-server --env-file=.env.local tests/e2e/<上述文件>.mts`；禁止误加载开发机env。启动探针使用无效token，不提交模型prompt；HTTP探针只管理独立夹具，失败保留证据并禁用测试成员。release代码变更仍通过piwork-deploy/scripts/deploy.sh，不覆盖现有版本目录的生产源码。备份路径记录在 /var/lib/piwork-opensandbox/app-env-backup-path，配置不输出密钥。

**当前状态：OpenSandbox matrix 已启用（2026-10-10）。** 首次真实聊天暴露F6，先撤回分流，再通过官方SessionManager cwd修复、Runtime回归344通过/15跳过（0失败）、类型/Biome检查与本机Next构建，首次使用deploy.sh daily部署到 releases/20261010053540，随后F7分类修复部署到 releases/20261010061055（当前）。基线Git为ace2c5f（v3.1.4），两项修复为未提交工作区增量，.release-info明确标记working_tree_dirty=1 / hotfix=sandbox-session-cwd+file-operation-routing，未创建Git提交或新Release。

2026-10-10 补充安全核查：activation 探针实际 execd 命令 UID=100/GID=101、NoNewPrivs=1、CapEff=0；Docker privileged=false、securityOpt=no-new-privileges=true，rootfs 仍可写。临时核查 sandbox ef868226-6795-4e6c-afab-d4f7f4bcabad 已由 provider 确认销毁。仅更新/运行探针，没有部署新的应用或调整路由。该核查不等于只读 Skill、账本、恢复、完整出网绕过或企业安全验收；新 Skill 方案及生产门禁见 [实施方案](skill-sandbox-security-design.md)。

实测通过：Docker实际CPU=0.5/内存=768MB和所有映射HostIp=127.0.0.1；file/PTY/Pi1.1.0/401/renew/kill；官方RpcClient带交付扩展与合成历史getState；正式HTTP先问候(in_process settled)，再带历史bash创建/读取hello.txt(sandbox_rpc settled)，官方工具完成、资源快照、注册表destroyed与provider inspect=null。最终成功夹具已清理；两次诊断失败夹具的成员已禁用并保留证据（首次RPC故障与一次终态后异步清理的过早断言，均确认沙箱已销毁）；旧failed run没有翻转或重放。测试等待后台close/release后再核验销毁，不把AgentRun settled等同于资源已回收。

只有单沙箱串行功能验证；未验证浏览器UI、附件解析/水合、真实deliver_file下载、并发容量、重启恢复或完整安全隔离，Durable未启用。公共域名访问此前异常不在本项修复内，本轮HTTP使用服务器本机入口。Docker网关绑定不是完整跨租户/宿主隔离证明，仍需安全、Worker/reaper、未知副作用对账等独立验收。

依据：官方OpenSandbox server配置指南与1.1.1 wheel内config.py（publish_host为实际HostIp绑定）、CLI、Docker runtime；Pi 1.1.0 docs/sdk.md/session-format.md、SessionManager与CLI session-cwd检查。保持官方存储/进程协议，不替换agent loop。
