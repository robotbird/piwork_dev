# 服务器事实与部署参考（root@123.56.79.62）

> 实测于 2026-10-06。与 `docs/operations.md`（本地运行手册）互补：本文只讲生产服务器。

## 1. 服务器环境

| 项 | 值 |
| --- | --- |
| SSH | `root@123.56.79.62`（本机已配免密公钥，BatchMode 可用） |
| 系统 | Linux，磁盘 `/` 共 79G |
| Node | v24.14.0（nvm，`/root/.nvm/versions/node/v24.14.0/bin/node`） |
| 包管理 | corepack 0.34.6；pnpm 经 `corepack pnpm` 调用（项目 packageManager=pnpm@10.32.1） |
| 内存 | **3.5G**（已跑 bjjxysbz/001erp/skillkit/PG，≈700M 可用）→ 禁止服务器上构建 |
| pm2 | 已有应用：skillkit-share、bjjxysbz(:3000)、001erp(:3001)；`pm2 save` 已配置开机恢复 |
| nginx | `/usr/local/nginx/sbin/nginx`，vhost 目录 `/usr/local/nginx/vhosts/*.conf`（主配置 117 行 include） |
| PostgreSQL | 18.4，`127.0.0.1:54321`（仅本机），systemd 管理；管理方式 `sudo -u postgres psql -p 54321` |
| 证书目录 | `/usr/local/nginx/cert/`（目前只有 bjjxysbz.com 的证书，piwork.net 暂无） |
| npm registry | 服务器在国内，安装统一走 `https://registry.npmmirror.com`（脚本已内置） |
| 带宽 | **公网出口 5M**（≈625KB/s）：tar 上传限速 `PIWORK_DEPLOY_RATE=450`（本机需装 pv，脚本自动生效）；日常部署上传约 60MB ≈ 2 分钟。频繁大量 SSH 连接可能触发服务器防护（fail2ban/云安全中心）封 IP——监控部署进度只看本地日志文件，不要并行抢 SSH |

## 2. 目录布局

```
/yepeng/web/piwork.net/
├── releases/<UTC时间戳>/        # 每次部署一个完整版本（源码+.next+node_modules）
│   ├── .release-info            # 版本号/git SHA/构建时间
│   ├── .env.local -> ../../shared/.env.local
│   ├── .piwork   -> ../../shared/piwork    # Pi agent 目录 + 模型插件暂存
│   ├── .pi       -> ../../shared/pi        # 运行 workspace（.pi/workspace）
│   └── .uploads  -> ../../shared/uploads   # 默认附件目录（UPLOAD_DIR 指向 shared/uploads）
├── current -> releases/<最新>    # 原子切换软链，pm2 只认这里
├── .previous-release             # 上一版本绝对路径（rollback 用）
├── start.sh                      # pm2 固定入口：cd current && node next start -p 3002
└── shared/
    ├── .env.local                # 生产配置（部署不覆盖；chmod 600）
    ├── uploads/  piwork/  pi/
```

pm2 应用名 `piwork`，端口 **3002**（3000/3001 已被占用）。

## 3. 服务器 .env.local 模板

首次部署由脚本生成；手工修改后 `pm2 reload piwork` 生效：

```bash
POSTGRES_URL=postgresql://piwork:<口令>@127.0.0.1:54321/piwork
AUTH_SECRET=<openssl rand -base64 32 生成，≥16 字符>
UPLOAD_DIR=/yepeng/web/piwork.net/shared/uploads
SCHEDULED_TASKS_ENABLED=true        # 本机是唯一常驻 RunManager 实例
# 可选：PIWORK_WEB_SEARCH_ENABLED=1 + TAVILY_API_KEY=tvly-xxx（联网搜索，默认关）
# 可选：BLOB_READ_WRITE_TOKEN=（附件改用 Vercel Blob）
# 可选：PIWORK_DISABLE_EXECUTION_TOOLS=1（不受信多用户环境禁用执行工具）
# 不要设置：PIWORK_SANDBOX_*（沙箱）、PIWORK_DURABLE_CHAT_ENABLED / PIWORK_RUNTIME_BACKEND=durable（非生产限定）
# 不要设置：NEXT_PUBLIC_BOTID_ENABLED（Vercel BotID 反爬，仅 Vercel 部署才开；
#   部署脚本构建时已强制置空。开启后客户端挑战脚本依赖 WebCrypto，
#   在非安全上下文（http://IP:port）会让所有 /api/chat 请求报
#   "Cannot read properties of undefined (reading 'importKey')" 而失败）
```

## 4. nginx 模板（HTTP）

脚本按此生成 `/usr/local/nginx/vhosts/piwork.net.conf`（参照 bjjxysbz.com.conf 的反代写法，无证书阶段先 HTTP）：

```nginx
server {
    listen 80;
    server_name piwork.net www.piwork.net;
    client_max_body_size 20M;
    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;   # 聊天是长流式响应
        proxy_send_timeout 300s;
        proxy_buffering off;       # 不缓冲，保证打字机效果
    }
    error_page 500 502 503 504 /50x.html;
    location = /50x.html { root /usr/local/nginx/html; }
}
```

### HTTPS 升级（拿到 piwork.net 证书后）

1. 证书放到 `/usr/local/nginx/cert/piwork.net.pem/.key`。
2. 仿照 `bjjxysbz.com.conf`：80 端口 301 跳 `https://piwork.net`，443 段加 `ssl_certificate/ssl_certificate_key`、`ssl_protocols TLSv1.2 TLSv1.3`、HSTS，proxy 段照抄上面模板。
3. `.env.local` 无需改（next-auth 用 `AUTH_TRUST_HOST` 语义由 X-Forwarded-Proto 识别协议；如遇重定向异常可加 `AUTH_URL=https://piwork.net`）。
4. `/usr/local/nginx/sbin/nginx -t && /usr/local/nginx/sbin/nginx -s reload`。

## 5. 首个管理员

注册页只创建 `User`，`Member.role` 默认 `member`；管理员 = `Member.role='admin'` 且 `status='enabled'`。注册完成后在服务器执行：

```bash
sudo -u postgres psql -p 54321 piwork
```

```sql
-- <邮箱> 换成刚注册的账号
INSERT INTO "Member" (id, role, status, "userId")
SELECT gen_random_uuid(), 'admin', 'enabled', u.id FROM "User" u WHERE u.email = '<邮箱>'
ON CONFLICT ("userId") DO UPDATE SET role = 'admin', status = 'enabled';
```

之后用该账号登录即可访问 `/admin`（系统角色 super_admin/admin/member 由迁移种子数据保证存在）。

## 6. 故障速查

| 现象 | 处置 |
| --- | --- |
| SSH 失败 | 本机确认公钥：`ssh root@123.56.79.62 true`；脚本要求免密（BatchMode） |
| 预检报「PostgreSQL 不可达」 | 服务器 `sudo -u postgres psql -p 54321 -tAc 'select 1'`；PG 在 54321 不是 5432 |
| 应用账号连不上库 | `pg_hba.conf` 需允许 127.0.0.1 密码认证（scram-sha-256），改后 reload PG |
| `corepack pnpm` 拉取慢/失败 | 确认 `COREPACK_NPM_REGISTRY=https://registry.npmmirror.com`（脚本已带）；服务器出网受限时先手工配好 pnpm |
| 安装后 `esbuild native ok` 失败 | 平台二进制缺失：`cd <release> && corepack pnpm install --prod --ignore-scripts` 重跑；仍失败查 `node_modules/@esbuild/linux-x64` |
| 迁移失败 | `ssh root@123.56.79.62 "cd /yepeng/web/piwork.net/current && corepack pnpm dlx tsx lib/db/migrate.ts"` 单独重跑看报错；先 `sudo -u postgres psql -p 54321 piwork -c '\dt'` 看库状态 |
| 健康检查 000/超时 | `pm2 logs piwork --lines 50 --nostream`；常见：`.env.local` 缺失/口令错（软链丢了→重跑 link）、端口冲突、node 版本不符 |
| 健康检查 500 | 看日志定位；常见 DB 连接失败（POSTGRES_URL）、AUTH_SECRET 未生成 |
| pm2 进程 cwd 指向旧版本 | 脚本已自动 delete+start 重建；手工：`pm2 delete piwork && pm2 start /yepeng/web/piwork.net/start.sh --name piwork --cwd /yepeng/web/piwork.net --time && pm2 save` |
| nginx 改完不生效 | 必须用 `/usr/local/nginx/sbin/nginx -t && -s reload`（PATH 里没有 nginx） |
| 域名打不开但服务器正常 | DNS 未指向服务器：`dig +short piwork.net` 应为 123.56.79.62；先用 `curl -H 'Host: piwork.net' http://123.56.79.62/` 验证 |
| 磁盘紧张 | 清旧版本：`ls /yepeng/web/piwork.net/releases`，保留最近 2-3 个，`rm -rf` 其余（勿删 current 指向的） |
| pm2 重启后丢失 | `pm2 save` 未执行时；日常部署脚本与 delete+start 重建路径都会 save |
