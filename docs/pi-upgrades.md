# Pi 官方依赖升级记录

## 当前基线（2026-10-10 核对）

官方 npm registry（`https://registry.npmjs.org`）的 `latest`：

| 包 | 升级前 | 本次精确固定 |
| --- | --- | --- |
| `@earendil-works/pi-ai` | 1.0.3 | 1.1.0 |
| `@earendil-works/pi-agent-core` | 1.0.3 | 1.1.0 |
| `@earendil-works/pi-coding-agent` | 1.0.3 | 1.1.0 |
| `@earendil-works/pi-durable` | 1.0.3 | 1.1.0 |
| `@earendil-works/chord` | 1.0.3 | 1.1.0 |

实际部署版本始终以 `package.json` / `pnpm-lock.yaml` 与镜像内安装结果为准，不将此记录的 latest 当成未来版本承诺。三份项目内模型插件的 pi-ai 开发依赖同步；model-provider-sdk 的 `*` peer 保持宿主提供，不打包另一份 SDK。Dockerfile 两处默认 CLI 版本同步。

## 官方变更与适配

- pi-ai `CHANGELOG.md`：stream 函数必须返回官方 `AssistantMessageEventStream`。模型插件宿主已经使用 `createAssistantMessageEventStream()`，无需另建流实现。
- Durable `CHANGELOG.md`：Storage 扫描新增 `order` 契约；TaskRuntime.context 的 cutoff 改为 `{ at }`。本项目复用官方 SqliteStorage（已实现双向分页），未自建 Storage 或使用旧 cutoff 调用。
- Durable 的 NodeExecutionEnv.watch 权限错误行为在中间版本变化，由官方实现承接；平台 SandboxHandle 不是官方 ExecutionEnv。
- coding-agent `CHANGELOG.md`：新增 `agent_settled.aborted` 和执行/响应时长字段。保持现有 RuntimeEvent 投影与取消/未知结果门禁，不因新增字段声称已持久化完整官方遥测。
- `storage.ts` 的 Pi/Durable binding 与 `chat-input.ts` 的输入 hash 同步。旧版运行（含升级前基线）拒绝静默重开，测试分别验证两个版本字段漂移；不迁移 SQLite、不删除 owner marker、不自动重放工具。

## 官方依据

以安装版 `node_modules/@earendil-works/` 下文件为准：

- `pi-ai/CHANGELOG.md`、`dist/utils/event-stream.d.ts` 与 `dist/types.d.ts`。
- `pi-coding-agent/CHANGELOG.md`、`docs/sdk.md`、`docs/message-types.md`、`docs/session-format.md`、`docs/cli-integration.md` 与官方 SDK/RPC 示例。
- `pi-durable/CHANGELOG.md`、`README.md`、`dist/storage/sqlite/storage.js`。

官方源码版本参考：<https://github.com/earendil-works/pi/tree/v1.1.0>。

## 验证与部署边界

本轮验证：

- `pnpm exec tsc --noEmit`：通过。
- `pnpm test:unit`：58/58 通过。
- `PIWORK_SANDBOX_DOCKER_TESTS=0 pnpm test:runtime`：355 项，340 通过、15 跳过、0 失败（含更新后的版本绑定拒绝回归和 SIGKILL 恢复基础测试）。
- `docker build -f docker/pi-runtime/Dockerfile -t pi-runtime:dev docker/pi-runtime`：成功；无网络容器内 CLI 包版本核验为 1.1.0。
- `PIWORK_SANDBOX_DOCKER_RPC_TESTS=1` 的 `backends.test.ts`：49 项，41 通过、8 既有能力边界跳过、0 失败；SandboxDocker 6 项实际通过。
- 修改的源码/测试/依赖声明定向 Biome 检查：通过。

未运行真实模型/OpenSandbox HTTP、数据库/浏览器专项、旧存储迁移或容量验收。部署需重启 Web 服务以加载新 SDK/HMR 单例，并发布新执行端镜像；本地构建不等于远端已部署。Durable 仍 experimental，生产门禁、Worker/恢复/账本与容量未验收边界不变。

## 文档版本约定

当前能力说明尽量不重复精确 Pi 版本，统一引用依赖文件及本记录。历史升级章节、研究草案、Pocket 外部仓库版本保留原始版本作为查证背景，不代表本项目当前安装版本；不将旧验证结果改写为本轮验证。
