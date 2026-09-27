# Piwork

Piwork 是基于 Pi Agent 的企业智能体平台，提供聊天、模型供应商插件、Skill、Pi Package、MCP 服务及组织管理。前端使用 Next.js App Router；服务端通过 Pi SDK 驱动 Agent，并使用 PostgreSQL 持久化业务数据与运行事件。

## 文档

- [文档导航](docs/README.md)
- [当前项目架构](docs/architecture.md)：模块职责、聊天运行链路、已实现能力和目标方案边界
- [开发与测试约定](docs/development.md)：目录位置、验证命令和测试迁移规则
- [Pi Package 与 Runtime 目标架构](docs/pi-plugin-support-research.md)
- [后续编码规则](AGENTS.md)

## 本地运行

使用 `pnpm@10.32.1`。按 [.env.example](.env.example) 配置 `.env.local` 中的数据库、身份认证和模型凭据，然后运行：

```bash
pnpm install
pnpm db:migrate
pnpm dev
```

默认访问 <http://localhost:3000>。需要可用模型时，请在管理界面配置模型供应商插件及凭据；聊天路径不会在模型目录为空时回退到静态模型。

## 验证

```bash
pnpm exec tsc --noEmit
pnpm test:unit
pnpm test:runtime
pnpm test:runtime:db # 需本地 PostgreSQL
pnpm test            # Playwright E2E
pnpm check
```

测试统一位于 `tests/`。测试目录、运行前置条件和 Pi 版本核对方式见 [开发与测试约定](docs/development.md) 与 [AGENTS.md](AGENTS.md)。
