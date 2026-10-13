# 仓库目录指南

本轮整理日期：2026-10-13。目录按实际职责分类；实现状态以 [当前架构](architecture.md) 和具体文档的状态说明为准。移动文档和测试辅助文件不改变运行链路或生产门禁。

## 应用与业务代码

| 目录 | 职责 |
| --- | --- |
| `app/(auth)` | 登录、注册与认证入口 |
| `app/(account)` | 个人设置 |
| `app/(chat)` | 聊天、项目、文档库、任务页面与 HTTP 入口 |
| `app/(admin)` | 组织、角色、模型、Skill、沙箱等管理入口 |
| `app/api` | 通用 API；依具体路由鉴权，不放 agent loop |
| `components/{chat,admin,auth,profile,projects,documents,scheduled-tasks}` | 业务 UI |
| `components/{ui,ai-elements}` | 共享基础与 AI 展示组件 |
| `hooks/`、`i18n/` | 客户端状态与中英文消息 |
| `artifacts/{text,code,image,sheet}` | 文档产物的客户端/服务端实现；属于业务源码 |
| `lib/{chat,documents,projects,uploads}` | 各业务域校验、共享类型、上下文及上传策略 |
| `lib/{auth,admin,db}` | 身份、管理域、数据库查询及迁移 |
| `lib/{artifacts,editor,i18n}` | 产物、编辑器、翻译辅助 |
| `lib/{collab,scheduler,search}` | 协作事件、周期任务、受控联网搜索 |
| `public/`、`app/icon.*`、`app/(chat)/*graph-image.png`、`app/(chat)/twitter-image.png` | 产品静态资源、应用图标和分享图片 |

根目录 Next.js、TypeScript、Drizzle、Playwright、Biome 等配置按工具约定保留；`README.md`、`AGENTS.md`、`LICENSE`、依赖清单和锁文件仍为根入口。

## Agent 与执行集成

| 目录 | 职责 |
| --- | --- |
| `lib/ai` | Pi 会话、模型、工具、Skill 和附件装配 |
| `lib/runtime/protocol` | 平台 Runtime 契约 |
| `lib/runtime/backends` | 官方 SDK/RPC/Durable 的适配、路由与事件归一化 |
| `lib/runtime/run` | RunManager、持久化、订阅/重放、最终消息构建 |
| `lib/runtime/sandbox` | Pi 无关的 provider/handle/channel、Docker/OpenSandbox 和 bridge |
| `lib/runtime/inference-proxy` | 沙箱模型访问代理、窄 token 与审计 |
| `lib/{pi-packages,mcp,model-plugins}` | 包、MCP 配置、供应商插件的注册及安装边界 |
| `packages/model-provider-sdk` | 可复用供应商 SDK |
| `plugins/piwork-llm-*` | 项目供应商插件及 Logo 素材 |
| `docker/pi-runtime` | 与核心依赖版本同步的完整 Pi 镜像 |

保留 `route → RunManager → RuntimeBackend → Pi AgentSession` 与 `RuntimeEvent → stream-mapping`。本轮核对核心包为 1.2.0，参考该安装版本的官方 `pi-coding-agent/docs/sdk.md` 与 `docs/rpc.md`；仅整理位置和引用，没有更改 Pi 调用或事件协议。

## 测试、脚本与文档

| 目录 | 放置内容 |
| --- | --- |
| `tests/unit` | 按业务模块分组的 node:test |
| `tests/e2e` | Playwright、HTTP/RPC、外部服务专项及 Durable 手动探针 |
| `tests/support` | 环境、替身、契约辅助；`playwright/` 集中 page objects、fixtures、helpers 和清理工具，`prompts/` 保存模型 fixture 辅助 |
| `tests/fixtures` | 静态文件、模型替身、Pi 包与 Skill 夹具 |
| `scripts` | 构建、初始化、运维脚本和现有 Durable 交互演示 |
| `.agents/skills`、`.claude`、`.github`、`.husky` | 开发代理、CI 和 Git hook 配置 |
| `docs/` 顶层 | 文档导航、架构、开发、运维、国际化、Pi 升级和目录指南 |
| `docs/features` | 业务功能实现与验收边界 |
| `docs/runtime` | Runtime 集成、沙箱执行与实施记录 |
| `docs/plans` | 平台演进和后续实施目标 |
| `docs/research` | 选型、官方能力评估和源码调研 |
| `docs/security` | 安全威胁模型与目标方案 |
| `docs/design-system` | 视觉规范、设计 token 与界面参考 |
| `docs/archive` | 历史研究和文字验收记录 |

`plugin:verify` 已指向 `tests/e2e/plugin-chain.mts`；该命令调用真实模型，本轮目录检查不执行它。Durable 手动探针改用 `pnpm exec tsx tests/e2e/pi-durable-manual-spike.mts all`；历史验证结论没有重新认定为当前能力。

## 本地数据与生成内容

| 目录 | 处理规则 |
| --- | --- |
| `.uploads`、`.pi/workspace`、`.piwork` | 上传、聊天工作区和受管安装/运行数据；不作为目录整理的清理对象 |
| `node_modules`、`.pnpm-store`、`.next`、`dist`、`*.tsbuildinfo` | 依赖及构建缓存，维持工具原有位置 |
| `llm/` | 已忽略的 Dify 迁移参考；与实际 `plugins/` 分开，不误当运行源码 |
| `test-results`、`playwright-report` | 已忽略的验证产物；截图统一输出到 `test-results/` |

检查仓库和测试脚本明确列出的临时截图路径，本轮未发现可删除的验证图片（0 张）。应用图标、分享图片、供应商 Logo、用户文件和构建图片均保留。成员/角色截图脚本原先写入 `artifacts/*-screens`，已改为 `test-results/*-screens`，旧输出目录补充忽略规则。历史文字验收记录保留，清除失效的临时图片路径。

## 本轮验证

- TypeScript `tsc --noEmit` 通过。
- 原 `test:unit` 所列 AI/MCP/Pi Package 单元测试 75 项通过，无跳过。
- Playwright `test --list` 正常收集 58 项；仅检查收集与导入，不执行浏览器场景。
- README、AGENTS 与全部 docs 的本地 Markdown 链接检查无缺失；`git diff --check` 通过。
- 未调用真实模型或生产数据库；未改变已有成员/角色界面的未提交工作。

临时测试代码的逐项检查与待清理候选见 [检查记录](development-code-audit.md)，与正式回归测试分开判断。
