# 临时测试与调试代码检查

检查日期：2026-10-13。检查范围为仓库源码、脚本、测试入口及其静态引用，排除依赖、构建缓存、上传/运行数据和已忽略的 Dify 参考目录。此记录为静态检查，不代表重新执行真实模型、数据库或浏览器验收。

## 结论

业务目录未发现 `*.test.*` / `*.spec.*` 文件、`debugger` 语句或独立 test/debug/mock HTTP 入口。发现 4 个手动验证/演示脚本、5 个当前无外部代码引用的辅助文件，以及仍由正式回归测试使用的内嵌测试模型代码。它们不能统一当作废弃文件处理；本轮检查不删除代码。

## 手动验证与演示脚本

| 文件 | 证据与处理建议 |
| --- | --- |
| `tests/e2e/members-screenshot.ts` | 独立 main，只注册账号、访问页面并截图；未纳入 package.json 命令或 Playwright `.test.ts` 收集。没有账号清理逻辑，浏览器异常路径也未用 finally。属于一次性界面验证候选，可在确认不再需要后删除 |
| `tests/e2e/roles-screenshot.ts` | 独立截图脚本，开发文档仍引用；只在成功路径关闭浏览器并清理账号/角色，异常路径缺少 finally。属于手动界面验证，不是正式回归用例 |
| `tests/e2e/pi-durable-manual-spike.mts` | 历史 1.0.2 实验的六组 faux/SQLite/进程探针，文档保留历史验证引用。不是 package.json 默认测试入口；脚本标注历史版本，不能因本轮整理而称为已验证兼容 1.2.0。保留历史证据，后续可由现有 Durable 正式测试替代或移入明确的实验目录 |
| `scripts/pi-durable-demo.mts` | faux 交互演示，数据保存在 `.piwork/durable-demo/`，包含模拟崩溃和恢复。无应用/CI/package.json 入口引用；不是平台生产执行能力。建议后续归入 `tests/support/durable/` 并核对脚本根目录解析与新版 API |

截图脚本已经输出到忽略目录 `test-results/`。检查过程中不执行上述脚本，不创建测试身份、不操作数据库、不运行 SIGKILL 探针。

## 当前无外部静态代码引用的辅助文件

| 文件 | 引用关系 |
| --- | --- |
| `tests/support/playwright/helpers.ts` | 导出的随机账号/消息函数未发现调用 |
| `tests/support/playwright/fixtures.ts` | 未发现其他文件导入；只引用下方 ChatPage |
| `tests/support/playwright/pages/chat.ts` | 仅由上方未使用的 fixtures.ts 引用 |
| `tests/fixtures/mock-models.ts` | 仅开发文档提及，未发现代码导入；引用下方 prompt helper |
| `tests/support/prompts/utils.ts` | 仅由上方 mock-models.ts 引用 |

这是静态引用结论，不排除人工运行或仓库外调用。作为待清理候选记录，未直接删除。`tests/fixtures/legacy-ai-sdk-models.ts` 不属于此类，它仍被 `lib/ai/providers.ts` 导入。

## 业务源码内仍有测试实现

| 位置 | 当前用途与边界 |
| --- | --- |
| `lib/ai/pi.ts` | PLAYWRIGHT 环境下创建官方 fauxProvider、生成固定/长流响应，导出 getTestFauxHandle；多项 web-search、Runtime、Durable、sandbox-tools 单测直接依赖此句柄 |
| `lib/ai/active-models.ts`、`lib/ai/models.ts` | 测试模型目录、能力与默认值；其中 models.ts 还提供生产类型/配置及 route 使用的 getModelAvailability，不能整文件删除 |
| `lib/ai/providers.ts` | 业务模块静态导入 tests/fixtures/legacy-ai-sdk-models，并在测试环境组装 AI SDK customProvider；存在源码到测试 fixture 的反向依赖，开发文档已记录待显式注入 |
| `lib/model-plugins/pi-credential-store.ts` | 测试 faux provider 的 dummy 凭据分支；正式会话回归依赖它通过官方 auth 门，不能直接移除 |
| `lib/constants.ts` | 用 PLAYWRIGHT_TEST_BASE_URL/PLAYWRIGHT/CI_PLAYWRIGHT 的 truthiness 判定测试环境；这是应用现有的测试接线，不能当作一次性调试开关删除 |
| `lib/ai/agent-session.ts`、`lib/pi-packages/manager.ts` | 测试环境离线/资源装配短路，与上述回归环境配套；属于持续使用的测试兼容分支 |

这部分尚未完全满足“测试实现归 tests/support、业务模块只提供通用注入 seam”的目标。后续需要独立重构并验证进程内会话、Next 测试服务器和官方 credential/provider 装配；仅移动文件或删分支会破坏已有测试。检查已核对安装版 Pi 1.2.0 `pi-ai/dist/providers/faux.d.ts` 的 fauxProvider/FauxProviderHandle/setResponses 类型，本轮没有改变官方 Pi 行为。

## 保留内容

`tests/unit` 的回归、`tests/e2e` 已登记的 HTTP/UI/RPC/真实 provider 探针、`tests/support` 的环境与替身、`tests/fixtures` 的协议/包/Skill 夹具继续保留。`smoke`、`faux`、`probe` 等命名本身不构成删除依据。生产迁移/初始化/打包脚本的控制台输出、bridge 的临时物化文件和沙箱临时 workspace 属于正常实现，不能误作调试残留删除。
