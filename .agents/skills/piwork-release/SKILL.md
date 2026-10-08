---
name: piwork-release
description: 提交代码 push 到 GitHub 后的 CI 自动打包发版部署。当用户在提交/推送代码的指令中包含「部署/发版/上线」（如「push 并部署」「提交后上线」），或明确要求走 GitHub Actions/Release 自动打包发布到 123.56.79.62 生产服务器（piwork.net）时使用。不经 GitHub 的纯本机构建部署仍用 piwork-deploy。
---

# piwork CI 发版部署

链路：`git 提交/推送 → 打 v* tag → release.yml 在 GitHub Actions 自动构建打包 → 等 CI 完成 → 从 GitHub Release 下载 piwork.tar.gz → deploy.sh ci 推送到 root@123.56.79.62:/yepeng/web/piwork.net → 装依赖/迁移/切换 → pm2 重启 → 健康检查（失败自动回滚）`。

构建发生在 GitHub Actions（7GB 内存），服务器只做装依赖/迁移/切换/重启——这是服务器 3.5G 内存禁止构建约束下的推荐发版路径。

## 触发判断

- 指令 = 提交/push + 部署关键词（部署/发版/上线/release）→ 走本技能。
- 只说「部署」且不提 GitHub/CI → 用 piwork-deploy 的 `daily`（本机构建）。
- 首次部署/初始化服务器 → piwork-deploy 的 `first`。

## 执行步骤

1. **提交并推送当前分支**（工作区有未提交变更时，按 git 技能规范写英文提交信息后提交）：
   - 本机到 github.com 的 HTTPS 443 经常被阻断；`git push` 失败时改推 SSH（认证已验证可用）：
     `git push git@github.com:robotbird/piwork_dev.git <branch>`
   - 工作区干净且用户只要部署 → 跳过本步。
2. **发版部署**（脚本自动完成分支/tag 推送 → 等 CI → 下载产物 → 服务器部署）：
   ```bash
   bash .agents/skills/piwork-release/scripts/release-deploy.sh             # patch 自增（默认）
   bash .agents/skills/piwork-release/scripts/release-deploy.sh minor       # 或 major / vX.Y.Z
   ```
   - 脚本要求工作区干净；分支与 tag 推送内置 SSH 兜底（HTTPS 被断不影响）。
   - CI 等待最长 30 分钟（`PIWORK_RELEASE_TIMEOUT` 可调）；产物下载失败自动重试，仍失败按脚本提示浏览器手动下载后 `deploy.sh ci <文件>`。
   - 只想发版不部署加 `--skip-deploy`（产物目录保留并打印路径）。
3. **汇报**：新版本号（tag + git SHA）、CI run 链接、Release 链接、服务器健康检查结果、访问地址。

## 规则与边界

- 每次「部署」都会产生一个新 tag + GitHub Release，这是 CI 打包的唯一触发方式（release.yml 只认 `v*` tag）；不要手动在服务器上构建。
- CI 构建期间（约 4-8 分钟）不要并行做其他部署或大量 SSH 连接（服务器 5M 带宽，频繁连接触发防护封 IP）。
- 服务器侧动作全部由 `piwork-deploy/scripts/deploy.sh ci` 完成（解包→装生产依赖→迁移→原子切换→pm2 reload→健康检查→失败自动回滚→清理旧版本）；不要手写零散 ssh 命令拼接部署。
- 服务器配置/env/nginx/PG 与故障速查见 piwork-deploy/references/server.md；改配置用编辑 `shared/.env.local` + `pm2 reload piwork`，不要靠重新发版。
