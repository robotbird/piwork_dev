---
name: piwork-deploy
description: 将 piwork（本仓库 Next.js 企业智能体平台）打包部署到生产服务器 root@123.56.79.62:/yepeng/web/piwork.net（pm2 + nginx + PostgreSQL）。当用户提到部署/上线/发布/更新 piwork、首次部署、日常部署、发版、回滚 piwork、查 piwork 服务器状态，或提到 123.56.79.62、piwork.net 的部署运维时使用。
---

# piwork 打包部署

把本仓库部署到 `root@123.56.79.62:/yepeng/web/piwork.net`。所有操作通过 `scripts/deploy.sh` 完成，不要手写零散的 ssh/rsync 命令拼接部署（脚本里有幂等、健康检查、自动回滚和数据目录保护）。

## 快速命令

```bash
bash .agents/skills/piwork-deploy/scripts/deploy.sh first     # 首次部署（服务器初始化 + 建库 + nginx + 启动）
bash .agents/skills/piwork-deploy/scripts/deploy.sh daily     # 日常部署（本机构建 → 上传 → 迁移 → 切换）
bash .agents/skills/piwork-deploy/scripts/deploy.sh ci <piwork.tar.gz>  # CI 产物部署（piwork-release 技能自动调用，也可手工）
bash .agents/skills/piwork-deploy/scripts/deploy.sh rollback  # 回滚到上一版本
bash .agents/skills/piwork-deploy/scripts/deploy.sh status    # 版本/pm2/健康检查
# 通用选项: --dry-run（只打印动作）--skip-build --keep N --force-nginx
```

## 模式选择

用户说「部署/上线/发版」时，先判断用哪种模式：

1. 跑一次 `deploy.sh status`（只读）。如果输出里没有 `current` 软链或 pm2 里没有 `piwork` 应用 → 用 `first`；否则用 `daily`。
2. 用户明确说「首次/第一次/初始化」→ `first`（幂等，重复跑安全）。
3. 用户说「回滚/回退」→ `rollback`；只问状态 → `status`。
4. 用户要求用 GitHub Actions/Release 的构建产物部署（或由 piwork-release 技能串联）→ `ci <piwork.tar.gz>`：上传解包 CI 产物（须含 `.next/BUILD_ID`），跳过本机构建，装依赖/迁移/切换/健康检查/自动回滚与 `daily` 相同。

`daily` 是默认日常路径，内置失败自动回滚：健康检查不过会自动切回上一版本并重启，然后报错退出。

## 执行规则

1. 部署前不要问用户确认技术细节（端口、路径等都在脚本顶部和环境变量里定死）；只有当预检硬性失败（SSH 不通、端口被占、PG 不可达）时才向用户报告并停下。
2. 直接跑非 dry-run 版本；`--dry-run` 只在用户要求预览或排查时用。
3. 构建在本机执行（服务器只有 3.5G 内存，禁止在服务器上跑 `next build`）。脚本会用 `corepack pnpm` 构建（内置 `PIWORK_DURABLE_CHAT_ENABLED=` 置空，避免本机开发配置的 durable 开关触发 production 构建守卫），然后 tar over ssh 打包源码 + `.next`（排除 `cache/` 与 `dev/`——后者是 dev 模式 turbopack 持久缓存，本机已实测膨胀到 14G）上传到服务器新版本目录并解包。
4. 数据库迁移在服务器上、切换软链**之前**执行（先迁移后启动新代码）。
5. 部署完成后按下面的清单验证，并把结果（版本号、git SHA、健康状态、访问地址）汇报给用户。

## 部署后验证清单

```bash
# 1) 进程与健康（脚本已自动做，可复核）
ssh root@123.56.79.62 "pm2 list | grep piwork"
ssh root@123.56.79.62 "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3002/"   # 期望 200/3xx
# 2) 域名访问（DNS 生效后）
curl -sI http://piwork.net/ | head -3
# 3) 出错时看日志
ssh root@123.56.79.62 "pm2 logs piwork --lines 50 --nostream"
```

## 首次部署后的人工步骤（必须提醒用户）

1. **DNS**：把 `piwork.net` / `www.piwork.net` A 记录指到 `123.56.79.62`；生效前用 `curl -H 'Host: piwork.net' http://123.56.79.62/` 验证。
2. **第一个管理员**：浏览器打开 `http://piwork.net/register` 注册账号，然后在服务器提升为管理员（登录库执行 SQL，见 `references/server.md` §首个管理员）。
3. **模型供应商**：登录后进 `/admin` 配置模型供应商与 API Key，否则聊天不可用。
4. **HTTPS**（可选）：上传证书后按 `references/server.md` §HTTPS 升级改 nginx 配置（重跑脚本时加 `--force-nginx` 不会自动做这一步，需手工编辑模板）。

## 边界与注意（不要做）

- **不要在服务器上构建**（3.5G 内存会 OOM），也不要把「服务器构建」当成备选方案对外承诺。
- 服务器配置文件是 `/yepeng/web/piwork.net/shared/.env.local`（部署不会覆盖它）；改完配置用 `ssh root@123.56.79.62 "pm2 reload piwork"` 生效，不要重新 full 部署来改配置。
- `shared/` 下的 `uploads/`（附件）、`piwork/`（Pi agent 目录与模型插件暂存）、`pi/`（运行 workspace）是持久数据，版本目录里的 `.env.local/.piwork/.pi/.uploads` 是指向它们的软链；不要删除 `shared/`，不要向 `current` 指向的版本目录做删除式同步（会清掉软链与其目标）。
- 生产默认**全部 in-process**：不启用沙箱、Durable、Docker、OpenSandbox（`.env.local` 里没有 `PIWORK_SANDBOX_*`）。用户要求启用执行沙箱时，先读 `docs/operations.md` 和 AGENTS.md 的沙箱门禁，单独评审，不要顺手加上。
- 生产环境不要设置 `PIWORK_DURABLE_CHAT_ENABLED` / `PIWORK_RUNTIME_BACKEND=durable`（非生产限定）。
- pm2 入口固定是 `/yepeng/web/piwork.net/start.sh`（每次重启 `cd current`），不要改成直接指向某个版本目录，否则日常部署的软链切换会失效。
- 服务器 3000/3001 端口被 bjjxysbz/001erp 占用，piwork 固定 3002；换端口要同步改 nginx 配置。

## 故障排查

预检或健康检查失败时，按 `references/server.md` 的「故障速查」定位（SSH/依赖、PG 54321、pnpm registry、pm2 cwd、nginx include），不要盲目重跑。部署产物的详细规则（目录布局、env 模板、nginx 模板）都在 `references/server.md`。
