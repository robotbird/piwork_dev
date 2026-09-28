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
