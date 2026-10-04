# 运行手册：本地/单机启动与维护

> 状态：当前实现。本文是运行与维护的单一入口，**组件、端口、启动命令或配置项变化时必须同步更新本文**。
> 命令均在本机（macOS + colima + OpenSandbox docker 档）实测通过（2026-10-04）。架构与边界见 [项目架构](architecture.md)，开发与测试约定见 [开发与测试](development.md)。

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

## 3. 日常维护

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
5. **改 `.env.local` 的 runtime 装配（provider/routing/inference）后必须重启 `pnpm dev`**：开发模式 RunManager 单例跨 HMR 保留，热更新不会加载新回调。

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

### F5 backend.open 失败的行为

RunManager 必然落 `AgentRun.status=failed`（errorMessage 带真实错误）并释放沙箱租约，绝不回落 in-process；查错从 AgentRun/RuntimeEvent/server 日志三层对照，不要只看前端通用提示。

## 7. 关联文档

- [项目架构](architecture.md)：模块边界与运行链路
- [开发与测试](development.md)：测试命令、沙箱契约组、排障记录（历史细节）
- [OpenSandbox 接入 Spec](opensandbox-integration-spec.md)：provider 设计与安全基线
- 官方依据：安装版 `@alibaba-group/opensandbox@1.1.0`（SDK）、`/tmp/OpenSandbox/server/opensandbox_server`（docker runtime 的 create/egress/readiness 实现：`services/docker/docker_service.py`、`services/docker/networking.py`、`services/docker/port_allocator.py`）
