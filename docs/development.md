# 开发与测试约定

## 新代码放置

- HTTP 路由和页面放在 `app/`；路由负责解析输入、鉴权和调用业务层。聊天运行控制放在 `lib/runtime/run`，后端实现放在 `lib/runtime/backends`，Pi 会话与资源装配放在 `lib/ai`。
- 平台与 Pi 的边界先扩展 `lib/runtime/protocol`，再改后端和 UI 映射；不要让页面或组件直接解析 Pi 内部事件。
- 数据结构/迁移归 `lib/db/schema.ts` 与 `lib/db/migrations`；数据访问归 `lib/db/*-queries.ts`。管理业务规则归 `lib/management`。
- Pi 官方已有的会话、工具、状态或包管理能力应优先复用；修改 Pi 集成前按 [AGENTS.md](../AGENTS.md) 核对当前安装版本的官方资料。

## 测试目录

所有自动化测试代码放在 `tests/`，不在 `app/`、`lib/`、`components/` 等源码目录内添加 `*.test.*` / `*.spec.*` 或测试专用替身。

```text
tests/
  unit/                 node:test；按被测业务模块分组
    ai/ db/ mcp/ pi-packages/ chat/ runtime/
  integration/          需要真实外部服务的专项验证脚本
  support/              node:test 专用环境、契约用例和替身
  fixtures/             文件、Pi package 和模型 fixture
  e2e/                  Playwright 场景
  pages/ prompts/       E2E page object 与 prompt 辅助
  fixtures.ts helpers.ts  E2E 公共入口
```

单元测试优先用 `@/lib/...` 或显式相对导入被测模块。测试前置环境 `tests/support/runtime-env.ts`、`tests/support/db-env.ts` 必须按测试文件中的首个 side-effect import 先加载；RPC faux 扩展是 `tests/support/faux-provider-extension.ts`，通过文件路径传给子进程。`tests/fixtures/mock-models.ts` 和 `legacy-ai-sdk-models.ts` 是 AI SDK 模型替身，不作为 `node:test` 用例收集；后者仍由 `lib/ai/providers.ts` 的测试环境分支引用，后续调整该旧链路时应改为显式注入测试模型。

手工验证 MCP 管理链路的 stdio/HTTP 服务在 `tests/fixtures/mcp-servers/`；用法见该目录的 README。真实模型插件链路验证在 `tests/integration/plugin-chain.mts`，需要可用的 DeepSeek 凭据。`scripts/` 只保留构建脚本，不存放测试实现。

## 常用验证

```bash
pnpm exec tsc --noEmit
pnpm test:unit          # 无数据库的 node:test
pnpm test:runtime       # Runtime 契约、RPC、RunManager 与聊天流映射
pnpm test:runtime:db    # PostgreSQL 集成测试；需 .env.local 中 POSTGRES_URL
pnpm test              # Playwright E2E；会启动本地 Next.js 服务
pnpm check             # 项目静态检查
pnpm plugin:verify     # 模型插件链路验证
```

`playwright.config.ts` 的 `testDir` 指向 `tests`，项目 `e2e` 只收集 `tests/e2e/*.test.ts`。新建单元测试时按模块放入 `tests/unit` 并更新相应的 `package.json` 命令；需要共享替身时放 `tests/support`。数据库测试与普通单元测试分开运行，避免无数据库环境下误收集。

## 文档库验证

- 先运行 `node --import tsx lib/db/migrate.ts` 应用 `0010` 目录及历史记录回填。
- `pnpm test:documents:db`：真实 PostgreSQL，验证所有权、文件夹/移动、交付归档顺序、失败传播及 Document 版本去重。使用独立测试用户并清理记录、临时文件；普通 Runtime 测试仍不依赖数据库。
- `pnpm test:documents:http`：先启动本地 `pnpm dev`，默认访问 `http://localhost:3000`（可设 `LIBRARY_TEST_URL`）。用本地 AUTH_SECRET 签发独立测试用户会话，验证任意格式上传、文件夹归属、下载字节、重命名/移动、跨用户拒绝和输入校验，随后清理测试数据。脚本在 `tests/e2e/library-http.mts`，不纳入默认 Playwright 收集。
- `pnpm exec tsc --noEmit`、相关文件 Biome 检查，以及 `pnpm test:runtime` 验证原有事件链路。
- 开发模式 RunManager 单例跨 HMR 保留；更新 Runtime 组装回调后重启开发服务才能让已有单例加载新回调，避免替换仍有活跃运行的单例。

## 定时任务验证与运行

1. `pnpm db:migrate` 应用 0012（增加 enabled/领取租约和运行记录，旧 cancelled 任务转为停用）。
2. 常驻 Node 开发/部署环境设置 `SCHEDULED_TASKS_ENABLED=true`，重启 `pnpm dev` 或 `pnpm start`；默认不开启后台调度。进程启动时立即扫描，之后每 30 秒扫描，且不会重入。进程必须保持运行。手动“立即运行”不依赖该开关。
3. `pnpm test:scheduler` 验证 Cron 时区、非法输入、工具创建协议和完成语义；`pnpm test:scheduler:db` 使用 .env.local 的本地数据库，独立测试用户，验证归属、并发领取、暂停、重复执行、运行记录和过期租约。
4. 任务中心输入“每天上午 9 点整理 AI 日报”，应进入真实聊天，AI 调用创建工具；回到任务中心后应看到计划及北京时间。立即运行后应先显示运行中，终态后打开结果。失败后仍保留下一周期。
5. 运行期间暂停仅阻止后续计划；运行期间编辑和删除返回 409。删除任务保留已生成聊天，删除聊天将运行记录的 chatId 置空。
6. POST `/api/scheduled-tasks/execute` 必须携带 `Authorization: Bearer <SCHEDULED_TASKS_API_KEY>`；缺少配置亦返回 401。不要在前端暴露该密钥。外部调用须允许最多 360 秒响应时间。

## 项目 Workspace 验证

1. `pnpm db:migrate` 应用 0013（Project/Source 表与 Chat.projectId/updatedAt）。
2. `pnpm test:runtime:db` 覆盖 `tests/unit/db/project-queries.test.ts`：项目归属隔离、项目聊天列表摘要排序、资料写入/删除与项目级联清理。
3. 手动流程：`/projects` 创建项目 → 进入项目 → 「来源」上传 PDF/TXT/Markdown → 大输入框发起聊天 → AI 回答应引用资料内容 → 返回项目主页聊天列表可见标题/摘要/时间 → 再开新聊天仍引用同一批资料。删除项目后其聊天与资料一并消失，且不出现在主侧边栏「最近」。

## 沙箱 Runtime 验证

1. `pnpm db:migrate` 应用 0014（Sandbox 表与索引）与 0015（InferenceAccessAudit）。
2. `pnpm test:runtime` 覆盖：`tests/unit/runtime/sandbox/`（provider 契约、bridge 泵、`docker-provider.test.ts` 的 Docker 契约组）、`tests/unit/runtime/backends/sandbox-rpc.test.ts`（fail-closed、seeding 落 workspace、close→kill、deliver_file 全链路）、`tests/unit/runtime/backends/sandbox-rpc/artifact-gateway.test.ts`（manifest 收割/幂等/容忍）、`tests/unit/runtime/backends/sandbox-rpc/inference.test.ts`（egress 派生、mint/acquire 失败闭环、Inference Proxy 全链路：沙箱内真实 pi 经 models.json + run token 走代理出文本）、`tests/unit/runtime/inference-proxy/`（events/tokens/models-manifest/server，上游用官方 `fauxProvider`）与 `tests/unit/runtime/backends/backends.test.ts` 的 `SandboxRpc` harness（官方 pi 经 bridge 跑完整契约，与 LocalRpc 同套件）。沙箱契约测试默认用 `TestSandboxProvider`（`tests/support/sandbox/`），不需要 Docker。
3. DockerSandboxProvider 契约组需本机 docker（colima 可）：无 docker 自动整组跳过；`PIWORK_SANDBOX_DOCKER_TESTS=0` 强制跳过、`=1` 强制开启。workspace 落在仓库 `.pi/test-sandboxes/`（colima 只挂载 /Users；目录已 gitignore）。egress allowlist 对照用例会在宿主起临时探针（绑 `0.0.0.0`）验证白名单 FQDN 经网关可达、外网/未列 FQDN 拒绝。
4. **pi-runtime 镜像**（`docker/pi-runtime/Dockerfile`，预装完整 `@earendil-works/pi-coding-agent`，非 root `pi` 用户，workspace 挂载点 `/workspace`）：`docker build -f docker/pi-runtime/Dockerfile -t pi-runtime:dev docker/pi-runtime`。pi 版本与仓库 `package.json` 一致（`--build-arg PI_CLI_VERSION=` 覆盖）。受限网络（docker.io 直连不可达）：先 `docker pull docker.m.daocloud.io/library/node:22-alpine && docker tag docker.m.daocloud.io/library/node:22-alpine node:22-alpine`，再加 `--build-arg NPM_REGISTRY=https://registry.npmmirror.com`。构建后 `PIWORK_SANDBOX_CLI_PATH=/opt/pi/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js`。
5. **Docker provider 上的 RPC 契约组（gated）**：`PIWORK_SANDBOX_DOCKER_RPC_TESTS=1` 时 `tests/unit/runtime/backends/backends.test.ts` 追加 `SandboxDocker` harness（需镜像已构建 + 本机 docker）：同一契约套件跑真实容器底座（RpcClient → UDS bridge → docker exec → 容器内完整 pi）。faux 扩展经 esbuild 预打包为自包含 .mjs（`tests/support/sandbox/faux-extension-bundle.ts`），与 LocalRpc 共用同一扩展源文件。默认关闭（不设该变量 = 不注册 harness）。
6. `pnpm test:runtime:db` 覆盖 `tests/unit/db/sandbox-queries.test.ts`（注册表/租约、externalId 重连、运行中停止与归属过滤）与 `tests/unit/db/inference-audit-queries.test.ts`（脱敏字段落库、chatId 无外键——chat 删除后审计仍在）。
7. 生产装配开关：`PIWORK_SANDBOX_PROVIDER=docker|opensandbox` + `PIWORK_SANDBOX_CLI_PATH`（沙箱内 pi 安装绝对路径；可选 `PIWORK_SANDBOX_IMAGE`/`PIWORK_SANDBOX_TTL_SECONDS`）切换沙箱装配；`PIWORK_SANDBOX_ROUTING=matrix`（默认，路由矩阵：执行工具的 run 走沙箱、纯对话 in-process，AgentRun.backend 落实际执行位）|`all`（全量沙箱）；opensandbox 另需 `OPENSANDBOX_DOMAIN`/`OPENSANDBOX_API_KEY` 必填（可选 `OPENSANDBOX_PROTOCOL`/`OPENSANDBOX_READY_TIMEOUT_SECONDS`/`OPENSANDBOX_EXECD_PORT`）；未设置 = InProcess 不变；错误取值/缺配置启动即抛错（fail-closed）。Inference Proxy：设置 `PIWORK_INFERENCE_URL`（沙箱视角可达地址，如 `http://host.docker.internal:3210`）即启用（缺省 = deny-all 无模型通道），可选 `PIWORK_INFERENCE_PROXY_HOST`（默认 `0.0.0.0`）/`PIWORK_INFERENCE_PROXY_PORT`（默认 3210）/`PIWORK_INFERENCE_EGRESS_ALLOWLIST`（逗号分隔 FQDN 基线）。
8. OpenSandbox server 是外部依赖，不在默认测试内：本地 spike 方式见 [OpenSandbox 接入 Spec](opensandbox-integration-spec.md) §6 Phase 0（源码运行、colima 注意事项、已知坑）。本地复跑：`~/.sandbox.toml` 就绪后在 `/tmp/OpenSandbox/server` 以 `DOCKER_HOST=unix://$HOME/.colima/default/docker.sock OPENSANDBOX_SERVER_API_KEY=<key> uv run opensandbox-server` 启动。
9. **OpenSandbox provider 真实 server 契约组（gated）**：`PIWORK_SANDBOX_CONTRACT_OPENSANDBOX=1 OPENSANDBOX_DOMAIN=127.0.0.1:8080 OPENSANDBOX_API_KEY=<key> node --conditions=react-server --import tsx --test tests/unit/runtime/sandbox/provider-contract.test.ts`（可选 `OPENSANDBOX_PROTOCOL`/`OPENSANDBOX_IMAGE`，默认 `pi-runtime:dev` 需已构建并预拉 `opensandbox/execd:v1.1.0`/`opensandbox/egress:v1.1.7`）。同一契约套件追加 `[OpenSandbox]` harness（12 用例，2026-10-02 实测 12/12）；离线单测 `opensandbox-provider.test.ts`（21 用例）常驻默认套件，不需要 server。
10. 路由矩阵测试：`tests/unit/runtime/backends/routing.test.ts`（矩阵判定、分流、fail-closed 不回落、RunManager 逐 run 落库、真实 SandboxRpcBackend 分流闭环）随 `pnpm test:runtime` 常驻。冷启动为一次性实测（2026-10-03 colima docker 档 P50 490ms），无常驻测试。

## 沙箱管理 MVP 验证（2026-10-03）

- `pnpm db:migrate` 应用 `0016`（runtimeConfig 创建快照），旧实例不虚构额度或安全配置。
- `pnpm test:runtime` 包含 `tests/unit/management/sandbox-service.test.ts`：刷新与销毁串行、服务故障不误标 destroyed、续期/销毁成功后落库；OpenSandbox 单测增加生命周期 Manager、传输释放与延期语义。`tests/unit/runtime/run/run-manager.test.ts` 验证 expectedRunId 不误停新 run；`pnpm test:runtime:db` 验证 UTC 到期往返、延长不被自动续期缩短、终态不被迟到刷新复活。
- 先启动 `pnpm dev`，再运行 `pnpm test:sandboxes:http`：需本机 Docker 和 `pi-runtime:dev` 镜像，使用独立管理员/聊天所有者，验证真实容器状态、外部暂停、续期、真实销毁、幂等、管理员鉴权、关联任务只读与跨聊天拒绝。仅创建/清理自己的测试容器及账号；默认自动清理。可设 `SANDBOX_TEST_URL`。脚本是 `tests/e2e/sandboxes-http.mts`，不纳入 Playwright 自动收集。
- `tests/e2e/sandboxes.test.ts` 验证权限、搜索/筛选与详情；测试 Provider 行只作为历史记录，不提供真实生命周期操作，不再用数据库标记伪装容器销毁。
- 手工验收：管理员打开 `/management/sandboxes` → 发起开启执行工具的聊天 → 列表自动出现实例 → 打开详情 → 通过 Run ID 搜索 → 延长 1 小时并核对到期时间 → “查看任务”以只读查看关联聊天 → 确认销毁，检查 OpenSandbox/Docker 中容器消失。run 默认完成即销毁，因此运行中观察要在任务结束前完成。OpenSandbox 真实链路仍需环境中的 server 地址/密钥及 Inference Proxy；不以 Docker 联调替代 OpenSandbox 真实验收。
- MVP 只负责已登记容器，状态刷新依赖 Provider 控制面；不提供日志、用量曲线、跨实例分布式操作锁或 Docker 到期回收器。Runtime 组装改变后需重启开发服务。
