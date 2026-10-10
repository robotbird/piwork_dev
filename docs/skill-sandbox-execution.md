# Skill 沙箱基本执行（当前实现）

2026-10-10：按最新需求收缩为现有 SandboxRpc 的资源同步，不引入 Worker、新 backend、审批数据库或通用工具 RPC 桥。代码已接聊天/定时任务装配；真实 OpenSandbox 官方 RPC + Node 脚本探针通过。**尚未部署本轮应用代码；不是企业级安全/恢复/容量验收。**

## 简单链路

`route/scheduler → RuntimeSpec.skills → SandboxRpcBackend → 完整目录复制 → 沙箱官方 Pi → read/bash → 既有 deliver_file`

- 复用已启用的受管 Skill 目录 `.pi/skills/<name>`；RuntimeSpec.skills 是可信宿主内的 Skill 路径元数据，不接收客户端身份/路径，不是 Worker DTO。无脚本字节或新工具闭包字段。
- 执行类 run 在 mint/acquire 前读取限额快照：SKILL.md、scripts、references、assets 及其他合法普通文件。只收目录本身，父目录依赖、宿主 node_modules 不同步。
- Linux collector 使用目录 fd + O_NOFOLLOW，拒绝 symlink/hardlink/特殊文件、保留凭据路径、超限和读取时变更；规范名称及来源必须匹配受管 root。部署配置的 root 可 symlink 到共享目录，但 root 内的 Skill/子文件不能是链接。
- 每 run 最多 100 Skills、512 文件/目录、单文件 10 MiB、总文件 50 MiB，串行读取/上传，不进行容量测试。宿主 collector 目前要求 Linux；非 Linux 路径读取只供显式 test 注入，不能生产 fallback。因此 Mac 上执行该集成需要 Linux 宿主；普通无 Skill 规格和纯问答的原路径不变。
- 使用 SandboxHandle.filesystem.writeAtomic 创建 `piwork/skills/<随机本次目录>/<name>/...`，新目录、no-overwrite、限额与 hash 校验；不使用 tar 解压或旧无界文件 API。任何水合失败都在 Pi 启动前失败并回收沙箱，不回落宿主。
- 完成全部复制后，给官方 CLI 传 `--no-skills --skill <沙箱绝对 SKILL.md>`。禁自动 Extension/MCP/上下文/模板发现，仅显式平台交付扩展保留。不会把 Skill 当作 Extension 自动执行。
- 沙箱不桥接宿主 load_skill/create_skill：模型使用官方 read 加载 Skill。显式 UI `/name 参数` 转为原生 `/skill:name`，在项目/附件上下文组装后由**沙箱内官方 Pi**展开，以免注入宿主 location/baseDir。无 sandbox provider 时保留既有 InProcess 行为。
- 系统提示移除原宿主 Skill catalog，CLI 发布正确沙箱 catalog；仅重定位平台生成的 workspace 提示，不改写用户正文/历史字符串。脚本用镜像现有 node/python3/sh 解释器，不假定复制后具有 executable bit。缺依赖明确报告，不运行时安装。
- 沿用资源额度、模型代理/窄 run token、路由矩阵、租约、终态回收和既有 Artifact Gateway。写入文件不等于交付，要求下载时应调用 deliver_file。

## 使用

1. 管理端安装并启用包含 `SKILL.md` 与脚本资源的 Skill；正文使用相对 Skill 目录路径，不能写死宿主绝对路径。
2. 配置现有 sandbox provider/image/CLI/inference proxy。Linux 应用宿主加载本轮代码并重启；无需新增数据库迁移或运行后端开关。
3. 聊天输入 `/技能名 参数`。沙箱内读取指令并运行脚本，产物写工作区；需要下载时请求“执行并交付结果供下载”。
4. 无网或依赖缺失不自动下载、不回落宿主；按运行时镜像能力处理。现 pi-runtime Dockerfile 含 Node/bash/Python/python-pptx，但并不覆盖全部技能的依赖。

## 测试与真实探针

- `pnpm test:skills:sandbox`：14 通过；真实官方 CLI/RPC 工具循环（TestSandboxProvider 不是安全隔离），目录完整性、禁用目录不复制、越界/链接/配额拒绝、原子传输、失败不启动 Pi/回收、prompt 路径。
- `pnpm test:runtime`：376 通过、8 跳过、0 失败；TypeScript、相关 Biome 和 diff 检查通过。
- `tests/fixtures/skills/sandbox-script`：Node 脚本实际读取随包 assets/references，写 `skill-result.txt`，内容 `SKILL_SCRIPT_OK:沙箱资源:引用说明`。
- `tests/e2e/sandbox-skill-smoke.mts`：opt-in，仅一个真实容器、0.5 核/768 MB、官方 RpcClient 和确定性官方 fauxProvider，无真实 LLM/密钥。验证官方 `/skill` 展开 location 为沙箱路径、实际脚本/资源/输出、store→archive 回调及 artifact.created、底座确认删除。归档用测试回调，不是正式 DB/浏览器下载验收。
- OpenSandbox 服务器实测成功：sandbox `ed506858-406b-4ba8-a1bb-3996820a8666` 已确认删除。此前一次 probe store 夹具误读 content（接口为 buffer）已修正，对应 sandbox `65415653-7a4c-4c27-b2a1-721561082db3` 也已销毁；未修改真实会话、路由或应用 release。

探针需先打包测试扩展，避免宿主源码路径进入容器：

```bash
pnpm exec esbuild tests/support/sandbox/skill-probe-extension.ts --bundle --platform=node --format=esm --packages=external --outfile=/tmp/piwork-skill-probe-extension.mjs
PIWORK_SANDBOX_SKILL_TEST=1 \
PIWORK_SKILL_TEST_EXTENSION=/tmp/piwork-skill-probe-extension.mjs \
node --conditions=react-server --import tsx --env-file=.env.local tests/e2e/sandbox-skill-smoke.mts
```

读取现有 provider/image/CLI 环境，可用 PIWORK_SKILL_TEST_ROOT 指向本组 fixture root。默认 `pnpm test:skills:sandbox:smoke` 跳过；在 Linux 宿主操作，不在生产服务器构建 Next/image，不并发起探针。

## 明确边界

启用状态沿用原管理员信任模式，**不是不可变审核或细粒度执行授权**；目录是受限复制，不是只读 mount。沙箱内任意 bash 能修改自身文件，也可能读取其窄模型代理 token；已有网络/Artifact Gateway/公开 Blob 边界不因本功能自动升级。父目录共享依赖、运行时自动装包、宿主 create_skill/MCP/Package 桥、跨 run 文件延续、Worker/reaper/持久 intent/自动恢复均不增加。Linux pinned 文件能力不是完整内核隔离或业务审批。

完整企业目标仍见 [安全实施方案](skill-sandbox-security-design.md)，其中执行-only backend/P2/P3 门禁不取消；本次只是已有 RPC 资源补齐，不能改称完成企业安全建设。

依据 Pi 1.1.0 `docs/skills.md`、`cli.md`、`settings.md`、`packages.md`；安装源码 `dist/core/resource-loader.js`（noSkills 保留 additionalSkillPaths）、`dist/core/agent-session.js` `_expandSkillCommand`、`dist/core/system-prompt.js`（customPrompt 仍添加 Skill catalog）、官方 RpcClient。没有自建 loop/Skill 命令解释器或 RPC 协议。
