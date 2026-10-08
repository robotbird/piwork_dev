#!/usr/bin/env bash
#
# piwork 打包部署脚本 —— piwork-deploy 技能的执行入口，也可手工运行。
# 目标服务器：root@123.56.79.62，部署根目录 /yepeng/web/piwork.net
# 服务器形态：pm2 守护（start.sh 固定入口，cwd=current 软链）+ 本机 nginx 反代 + PostgreSQL 18(127.0.0.1:54321)
# 构建策略：本机构建（服务器仅 3.5G 内存，不承担 next build），服务器只做安装依赖/迁移/切换/重启。
#
# 用法:
#   deploy.sh first              首次部署：服务器初始化（建库/生成 .env.local/nginx 配置）+ 构建 + 启动
#   deploy.sh daily              日常部署：本机构建 → rsync 上传 → 服务器装依赖/迁移 → 原子切换 → 健康检查（失败自动回滚）
#   deploy.sh ci <piwork.tar.gz> CI 产物部署：上传 GitHub Actions 构建的产物（piwork-release 技能自动调用，也可手工），其余同 daily
#   deploy.sh rollback           回滚到上一个版本（current 软链切回并重启）
#   deploy.sh status             查看当前版本、pm2 状态与健康检查
# 选项:
#   --dry-run                    只打印将执行的动作，不做任何修改（仍会做只读探测）
#   --skip-build                 跳过本机构建，复用现有 .next（仅调试用）
#   --keep N                     服务器保留的版本数（默认 3）
#   --force-nginx                覆盖服务器上已存在的 nginx 配置
# 可用环境变量覆盖默认值: PIWORK_DEPLOY_HOST / PIWORK_DEPLOY_BASE / PIWORK_DEPLOY_PORT /
#   PIWORK_DEPLOY_DOMAIN / PIWORK_DEPLOY_PGPORT / PIWORK_DEPLOY_REGISTRY
set -euo pipefail

HOST="${PIWORK_DEPLOY_HOST:-root@123.56.79.62}"
BASE="${PIWORK_DEPLOY_BASE:-/yepeng/web/piwork.net}"
APP="${PIWORK_DEPLOY_APP:-piwork}"
PORT="${PIWORK_DEPLOY_PORT:-3002}"
DOMAIN="${PIWORK_DEPLOY_DOMAIN:-piwork.net}"
PGPORT="${PIWORK_DEPLOY_PGPORT:-54321}"
REGISTRY="${PIWORK_DEPLOY_REGISTRY:-https://registry.npmmirror.com}"
NGX_BIN="/usr/local/nginx/sbin/nginx"
NGX_CONF="/usr/local/nginx/vhosts/${DOMAIN}.conf"
KEEP=3
DRY=0 SKIP_BUILD=0 FORCE_NGINX=0 CMD="" ARTIFACT=""

PROJECT_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
TS="$(date -u +%Y%m%d%H%M%S)"
REL="$BASE/releases/$TS"

# ---------- 基础工具 ----------
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=30
  -o ControlMaster=auto -o ControlPath="/tmp/piwork-deploy-ssh-%C" -o ControlPersist=180)

log()  { printf '\033[1;36m[deploy]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[失败]\033[0m %s\n' "$*" >&2; exit 1; }

rq() { ssh "${SSH_OPTS[@]}" "$HOST" "$@"; }   # 远端只读命令（dry-run 也执行）
rr() {                                        # 远端可变更命令（dry-run 只打印，仍排空 stdin 以免上游 SIGPIPE）
  if [ "$DRY" = "1" ]; then cat >/dev/null 2>/dev/null; log "(dry-run) 远端: $*"; else ssh "${SSH_OPTS[@]}" "$HOST" "$@"; fi
}

usage() { sed -n '2,20p' "$0"; exit 1; }

# ---------- 本地预检 ----------
precheck_local() {
  [ -f "$PROJECT_ROOT/package.json" ] || die "找不到项目根目录: $PROJECT_ROOT"
  command -v tar >/dev/null || die "本机缺少 tar"
  command -v ssh >/dev/null || die "本机缺少 ssh"
  ssh "${SSH_OPTS[@]}" "$HOST" "true" 2>/dev/null || die "SSH 连不上 ${HOST}（确认本机已配好免密公钥）"
}

# ---------- 服务器预检（首次） ----------
precheck_server_first() {
  log "服务器预检..."
  local node_ver node_bin corepack_ver
  node_ver="$(rq 'node -v 2>/dev/null || echo none')"
  [ "$node_ver" != "none" ] || die "服务器没有 node"
  node_bin="$(rq 'command -v node')"
  NODE_BIN_REMOTE="$node_bin"
  corepack_ver="$(rq 'corepack --version 2>/dev/null || echo none')"
  [ "$corepack_ver" != "none" ] || die "服务器没有 corepack（Node 24 自带，检查 PATH）"
  rq 'pm2 -v >/dev/null 2>&1' || die "服务器没有 pm2"
  rq "[ -x $NGX_BIN ]" || die "服务器没有 $NGX_BIN"
  rq "sudo -u postgres psql -p $PGPORT -tAc 'select 1' 2>/dev/null | grep -q 1" || die "服务器 PostgreSQL(${PGPORT}) 不可达（sudo -u postgres psql -p ${PGPORT}）"
  if rq "pm2 describe $APP >/dev/null 2>&1"; then
    warn "pm2 中已存在应用 ${APP}，首次部署会先删除再重建"
  elif rq "ss -tln | grep -q ':$PORT '"; then
    die "端口 $PORT 已被其他进程占用；如需换端口: PIWORK_DEPLOY_PORT=xxxx 重跑"
  fi
  local free_mb
  free_mb="$(rq "df -mP $BASE 2>/dev/null | tail -1 | tr -s ' ' | cut -d' ' -f4")"
  [ -n "$free_mb" ] && [ "$free_mb" -gt 3000 ] 2>/dev/null || warn "磁盘可用空间不足 3G（free=${free_mb:-unknown}MB），继续但请注意清理旧版本"
  log "预检通过 (node=$node_ver)"
}

# ---------- 服务器预检（ci 模式：只要 node/pm2 可用，不设 nginx/PG/端口门槛）----------
precheck_server_ci() {
  local node_ver
  node_ver="$(rq 'node -v 2>/dev/null || echo none')"
  [ "$node_ver" != "none" ] || die "服务器没有 node"
  NODE_BIN_REMOTE="$(rq 'command -v node')"
  rq 'pm2 -v >/dev/null 2>&1' || die "服务器没有 pm2"
}

# ---------- 共享目录与数据 ----------
ensure_shared_dirs() {
  rr "mkdir -p $BASE/releases $BASE/shared/piwork $BASE/shared/pi $BASE/shared/uploads"
}

ensure_pg() {
  # 已有 .env.local 时不再动数据库口令，只确保库存在
  if rq "[ -f $BASE/shared/.env.local ]"; then
    log "shared/.env.local 已存在，跳过数据库口令设置"
    return 0
  fi
  PGPWD="$(openssl rand -hex 16)"
  local role_exists db_exists
  role_exists="$(rq "sudo -u postgres psql -p $PGPORT -tAc \"SELECT 1 FROM pg_roles WHERE rolname='$APP'\"" | tr -d '[:space:]')"
  if [ "$role_exists" = "1" ]; then
    log "数据库角色 $APP 已存在，重设口令"
    echo "ALTER ROLE $APP WITH LOGIN PASSWORD '$PGPWD';" | rr "sudo -u postgres psql -p $PGPORT -v ON_ERROR_STOP=1 -q"
  else
    log "创建数据库角色 $APP"
    echo "CREATE ROLE $APP WITH LOGIN PASSWORD '$PGPWD';" | rr "sudo -u postgres psql -p $PGPORT -v ON_ERROR_STOP=1 -q"
  fi
  db_exists="$(rq "sudo -u postgres psql -p $PGPORT -tAc \"SELECT 1 FROM pg_database WHERE datname='$APP'\"" | tr -d '[:space:]')"
  if [ "$db_exists" != "1" ]; then
    log "创建数据库 $APP"
    echo "CREATE DATABASE $APP OWNER $APP;" | rr "sudo -u postgres psql -p $PGPORT -v ON_ERROR_STOP=1 -q"
  fi
  if [ "$DRY" = "1" ]; then
    log "(dry-run) 跳过数据库登录验证"
    return 0
  fi
  local login_ok
  login_ok="$(rq "PGPASSWORD=$PGPWD psql -h 127.0.0.1 -p $PGPORT -U $APP -d $APP -tAc 'select 1' 2>/dev/null" | tr -d '[:space:]')"
  [ "$login_ok" = "1" ] || die "应用账号连不上数据库（检查 pg_hba.conf 是否允许 127.0.0.1 密码登录）"
}

ensure_env_file() {
  if rq "[ -f $BASE/shared/.env.local ]"; then
    log "保留现有 shared/.env.local（如需改配置请直接编辑该文件后 pm2 reload ${APP}）"
    return 0
  fi
  local auth_secret
  auth_secret="$(openssl rand -base64 32 | tr -d '\n')"
  log "生成 shared/.env.local（AUTH_SECRET 自动生成）"
  cat <<EOF | rr "umask 077 && cat > $BASE/shared/.env.local && chmod 600 $BASE/shared/.env.local"
# piwork 生产配置 —— 由 piwork-deploy 生成；手工修改后执行 pm2 reload piwork 生效
POSTGRES_URL=postgresql://$APP:$PGPWD@127.0.0.1:$PGPORT/$APP
AUTH_SECRET=$auth_secret
# 附件本地磁盘存储（private uploads，deploy 不会动这个目录）
UPLOAD_DIR=$BASE/shared/uploads
# 本机就是唯一常驻 RunManager 实例，定时任务需要它为 true
SCHEDULED_TASKS_ENABLED=true
# ---- 可选项（按需取消注释）----
# 联网搜索: PIWORK_WEB_SEARCH_ENABLED=1 + TAVILY_API_KEY=tvly-xxx
# 附件改用 Vercel Blob: BLOB_READ_WRITE_TOKEN=xxx（配置后 UPLOAD_DIR 失效）
# 沙箱执行（默认全部 in-process）：启用前先读 docs/operations.md 并单独评审
# PIWORK_DISABLE_EXECUTION_TOOLS=1   # 多用户不受信环境禁用执行工具
EOF
}

# ---------- 本机构建 ----------
build_local() {
  if [ "$SKIP_BUILD" = "1" ]; then
    warn "跳过本机构建（--skip-build），复用现有 .next"
    [ -d "$PROJECT_ROOT/.next" ] || die ".next 不存在，无法跳过构建"
    return 0
  fi
  cd "$PROJECT_ROOT"
  command -v corepack >/dev/null || die "本机缺少 corepack（Node 自带；或改用 npx pnpm@10）"
  log "本机安装依赖 (corepack pnpm install --frozen-lockfile)"
  if [ "$DRY" != "1" ]; then
    corepack pnpm install --frozen-lockfile
  else
    log "(dry-run) 本地: corepack pnpm install --frozen-lockfile"
  fi
  # 本机 .env.local 是开发配置（durable 分流等 development 限定开关），next build 以
  # NODE_ENV=production 收集页面数据时会触发 runtime:durable-chat:non-production-only
  # 守卫；进程 env 优先于 .env.local，构建时置空即可（生产服务器 .env.local 无此开关）。
  log "本机构建 (next build，中和开发机 runtime 开关)..."
  if [ "$DRY" != "1" ]; then
    PIWORK_DURABLE_CHAT_ENABLED= corepack pnpm exec next build
  else
    log "(dry-run) 本地: PIWORK_DURABLE_CHAT_ENABLED= corepack pnpm exec next build"
  fi
}

# ---------- 上传新版本 ----------
upload_release() {
  log "打包上传新版本 → $HOST:$REL"
  rr "mkdir -p $REL"
  local gitsha
  gitsha="$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo no-git)"
  rr "printf 'release=%s\ngit=%s\nbuilt_at=%s\n' '$TS' '$gitsha' '$(date -u +%FT%TZ)' > $REL/.release-info"
  if [ "$DRY" = "1" ]; then
    log "(dry-run) tar 源码+.next(不含 cache/dev) | ssh 解包到 $REL/"
    return 0
  fi
  cd "$PROJECT_ROOT"
  # 走 tar over ssh：本机 macOS 的 openrsync 对大目录不可靠，tar 在两端(bsd/GNU)都稳定；
  # 每次都是全新时间戳目录，无需增量/删除语义。
  # 带宽限制：PIWORK_DEPLOY_RATE=<KB/s>（需本机安装 pv），小水管服务器建议 180 左右
  local rate_pipe=""
  if [ -n "${PIWORK_DEPLOY_RATE:-}" ]; then
    if command -v pv >/dev/null; then
      rate_pipe="pv -L ${PIWORK_DEPLOY_RATE}k"
      log "上传限速 ${PIWORK_DEPLOY_RATE}KB/s"
    else
      warn "设置了 PIWORK_DEPLOY_RATE 但本机没有 pv，未限速"
    fi
  fi
  tar --no-xattrs -czf - \
    --exclude=./node_modules --exclude=./.git --exclude=./.github --exclude=./.husky \
    --exclude=./.agents --exclude=./.zcode \
    --exclude=./.pnpm-store --exclude=./.turbo \
    --exclude=./.env --exclude='./.env.*' \
    --exclude='./.pi*' --exclude=./.uploads \
    --exclude=./tests --exclude=./docs --exclude=./docker --exclude=./llm \
    --exclude=./dist --exclude=./artifacts \
    --exclude=./playwright-report --exclude=./test-results --exclude=./playwright.config.ts \
    --exclude=./biome.jsonc --exclude=./DESIGN.md --exclude=./design-qa.md \
    --exclude=./LICENSE --exclude=./README.md --exclude=./AGENTS.md \
    --exclude='*.tsbuildinfo' --exclude=./.DS_Store \
    --exclude='./design-qa*.png' --exclude='./model-provider-*.png' \
    --exclude='./.next/cache' --exclude='./.next/dev' \
    . | $rate_pipe ssh "${SSH_OPTS[@]}" "$HOST" "tar --no-same-owner -xzf - -C $REL"
  # 完整性：生产构建必有 BUILD_ID；缺了说明本机不是 next build 产物
  rq "[ -f $REL/.next/BUILD_ID ]" || die "服务器缺少 $REL/.next/BUILD_ID —— .next 不是生产构建产物，检查本机构建步骤"
  log "上传完成"
}

# ---------- 上传 CI 产物（deploy.sh ci）----------
upload_artifact() {
  if [ "$DRY" = "1" ]; then
    log "(dry-run) cat $ARTIFACT | ssh tar -xzf - -C $REL"
    return 0
  fi
  [ -s "$ARTIFACT" ] || die "CI 产物不存在或为空: $ARTIFACT"
  log "上传 CI 产物 $(basename "$ARTIFACT") → $HOST:$REL"
  rr "mkdir -p $REL"
  local rate_pipe=""
  if [ -n "${PIWORK_DEPLOY_RATE:-}" ]; then
    if command -v pv >/dev/null; then
      rate_pipe="pv -L ${PIWORK_DEPLOY_RATE}k"
      log "上传限速 ${PIWORK_DEPLOY_RATE}KB/s"
    else
      warn "设置了 PIWORK_DEPLOY_RATE 但本机没有 pv，未限速"
    fi
  fi
  # CI 产物自身已含 .release-info（release=<tag>），不需要重写
  cat "$ARTIFACT" | $rate_pipe ssh "${SSH_OPTS[@]}" "$HOST" "tar --no-same-owner -xzf - -C $REL"
  # 完整性：与 daily 同一标准，CI 生产构建必有 BUILD_ID
  rq "[ -f $REL/.next/BUILD_ID ]" || die "服务器缺少 $REL/.next/BUILD_ID —— 产物不是 CI 生产构建（release.yml）"
  log "上传完成"
}

# ---------- 服务器侧装配 ----------
link_shared() {
  # 运行时会写入的数据目录/配置统一指到 shared，部署切换不丢数据：
  #   .env.local  配置   .piwork  Pi agent 目录+模型插件暂存   .pi  运行 workspace   .uploads  默认上传目录
  rr "cd $REL && ln -sfn ../../shared/.env.local .env.local && ln -sfn ../../shared/piwork .piwork && ln -sfn ../../shared/pi .pi && ln -sfn ../../shared/uploads .uploads"
}

install_deps() {
  log "服务器安装生产依赖 (pnpm install --prod --ignore-scripts)"
  rr "cd $REL && COREPACK_NPM_REGISTRY=$REGISTRY npm_config_registry=$REGISTRY corepack pnpm install --prod --frozen-lockfile --ignore-scripts"
  # esbuild 已不在生产依赖（迁移用 dlx tsx 自带），仅提示不阻断；
  # 真正门禁是 run_migrations 与切换后的 wait_health。
  rr "cd $REL && node -e \"require('esbuild'); console.log('esbuild native ok')\"" \
    || warn "生产依赖无 esbuild（迁移走 dlx tsx），跳过该检查"
}

run_migrations() {
  log "执行数据库迁移"
  rr "cd $REL && COREPACK_NPM_REGISTRY=$REGISTRY npm_config_registry=$REGISTRY corepack pnpm dlx tsx lib/db/migrate.ts"
}

write_start_sh() {
  # pm2 唯一入口固定为 $BASE/start.sh：每次重启都 cd current（软链），因此 pm2 restart 天然加载新版本
  log "写入 $BASE/start.sh"
  cat <<EOF | rr "cat > $BASE/start.sh && chmod +x $BASE/start.sh"
#!/bin/sh
export NODE_ENV=production
export HOME=/root
cd $BASE/current || exit 1
exec $NODE_BIN_REMOTE node_modules/next/dist/bin/next start -p $PORT
EOF
}

flip_current() {
  local prev
  prev="$(rq "readlink $BASE/current 2>/dev/null || true")"
  log "切换 current: ${prev:-<无>} → $REL"
  rr "ln -sfn $REL $BASE/current"
  rr "printf '%s\n' '$prev' > $BASE/.previous-release"
}

pm2_start() {
  if rq "pm2 describe $APP >/dev/null 2>&1"; then
    rr "pm2 delete $APP"
  fi
  log "pm2 启动 $APP (端口 $PORT)"
  rr "pm2 start $BASE/start.sh --name $APP --cwd $BASE --time"
}

pm2_reload() {
  if ! rq "pm2 describe $APP >/dev/null 2>&1"; then
    log "pm2 中还没有 ${APP}（首跑服务器），执行首次启动"
    pm2_start
    return 0
  fi
  log "pm2 重启 $APP"
  rr "pm2 reload $APP --update-env || pm2 restart $APP --update-env"
  # 防御：确认进程 cwd 已落到新版本目录（start.sh 每次重新解析 current，正常必然成立）
  sleep 2
  local pid cwd
  pid="$(rq "pm2 pid $APP" | tr -dc '0-9')"
  if [ -n "$pid" ]; then
    cwd="$(rq "readlink /proc/$pid/cwd 2>/dev/null || true")"
    if [ -n "$cwd" ] && [ "$cwd" != "$REL" ]; then
      warn "pm2 进程 cwd 仍指向旧目录 ($cwd)，用 delete+start 强制重建"
      rr "pm2 delete $APP"
      rr "pm2 start $BASE/start.sh --name $APP --cwd $BASE --time"
    fi
  fi
}

wait_health() {
  if [ "$DRY" = "1" ]; then
    log "(dry-run) 跳过健康检查"
    return 0
  fi
  log "健康检查 http://127.0.0.1:$PORT/ （最长 90s）"
  local i code
  for i in $(seq 1 30); do
    code="$(rq "curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:$PORT/ 2>/dev/null || true")"
    case "$code" in
      200 | 204 | 301 | 302 | 303 | 307 | 308)
        log "健康检查通过 (HTTP $code)"
        return 0
        ;;
    esac
    sleep 3
  done
  warn "健康检查失败（最后状态: ${code:-无响应}）"
  return 1
}

setup_nginx() {
  if rq "[ -f $NGX_CONF ]" && [ "$FORCE_NGINX" != "1" ]; then
    log "nginx 配置已存在: ${NGX_CONF}（--force-nginx 可覆盖）"
    return 0
  fi
  log "写入 nginx 配置 ${NGX_CONF}（HTTP；HTTPS 升级步骤见技能 references/server.md）"
  cat <<EOF | rr "cat > $NGX_CONF"
# piwork.net —— 由 piwork-deploy 技能生成，参考 /usr/local/nginx/vhosts/bjjxysbz.com.conf
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # 上传体积上限（与平台 20MB/文件限制一致）
    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        # 聊天为流式响应：关闭缓冲、放宽读超时
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_buffering off;
    }

    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/local/nginx/html;
    }
}
EOF
  log "校验并重载 nginx"
  rr "$NGX_BIN -t && $NGX_BIN -s reload"
  local code
  code="$(rq "curl -s -o /dev/null -w '%{http_code}' -H 'Host: $DOMAIN' http://127.0.0.1/ 2>/dev/null || true")"
  log "nginx 反代健康检查 (Host: $DOMAIN): HTTP $code"
}

pm2_save() { rr "pm2 save"; }

prune_releases() {
  local current old r
  current="$(rq "basename \$(readlink $BASE/current) 2>/dev/null || true")"
  old="$(rq "cd $BASE/releases 2>/dev/null && ls -1 | grep -E '^[0-9]{14}$' | sort | head -n -$KEEP || true")"
  for r in $old; do
    [ "$r" = "$current" ] && continue
    log "清理旧版本 $r"
    rr "rm -rf $BASE/releases/$r"
  done
}

# ---------- 汇总 ----------
summary() {
  cat <<EOF

================ 部署完成 ================
  应用:     $APP  端口: $PORT
  版本目录: $REL
  健康地址: http://$DOMAIN/  （需 DNS 已指向 ${HOST}，未生效前可用: curl -H 'Host: $DOMAIN' http://123.56.79.62/）
  日志:     ssh $HOST "pm2 logs $APP --lines 50 --nostream"
  状态:     ssh $HOST "pm2 status"
==========================================
EOF
}

# ---------- 命令 ----------
cmd_first() {
  precheck_local
  precheck_server_first
  ensure_shared_dirs
  ensure_pg
  ensure_env_file
  build_local
  upload_release
  link_shared
  install_deps
  run_migrations
  write_start_sh
  flip_current
  pm2_start
  wait_health || {
    rq "pm2 logs $APP --lines 30 --nostream" || true
    die "首次部署健康检查未通过，请按上面的日志排查后重跑 deploy.sh first（幂等）"
  }
  setup_nginx
  pm2_save
  prune_releases
  summary
  warn "首次部署后还需人工完成: 1) DNS 把 $DOMAIN 指到服务器  2) 浏览器打开 /register 注册账号并在库中提升为 admin（见 references/server.md）  3) 管理后台配置模型供应商"
}

cmd_daily() {
  precheck_local
  build_local
  upload_release
  link_shared
  install_deps
  run_migrations
  flip_current
  pm2_reload
  if ! wait_health; then
    local prev
    prev="$(rq "cat $BASE/.previous-release 2>/dev/null | tr -d '[:space:]'")"
    if [ -n "$prev" ] && rq "[ -d $prev ]"; then
      warn "健康检查失败 → 自动回滚到 $prev"
      rr "ln -sfn $prev $BASE/current"
      rr "printf '%s\n' '$REL' > $BASE/.previous-release"
      rr "pm2 reload $APP"
      if wait_health; then
        die "已回滚到上一版本，服务恢复。新版本失败原因: ssh $HOST \"pm2 logs $APP --lines 50 --nostream\""
      else
        die "回滚后仍不健康，需要人工介入: ssh $HOST \"pm2 logs $APP\""
      fi
    fi
    die "健康检查失败且没有可回滚版本: ssh $HOST \"pm2 logs $APP --lines 50 --nostream\""
  fi
  prune_releases
  summary
}

cmd_ci() {
  precheck_local
  precheck_server_ci
  upload_artifact
  link_shared
  install_deps
  run_migrations
  write_start_sh
  flip_current
  pm2_reload
  if ! wait_health; then
    local prev
    prev="$(rq "cat $BASE/.previous-release 2>/dev/null | tr -d '[:space:]'")"
    if [ -n "$prev" ] && rq "[ -d $prev ]"; then
      warn "健康检查失败 → 自动回滚到 $prev"
      rr "ln -sfn $prev $BASE/current"
      rr "printf '%s\n' '$REL' > $BASE/.previous-release"
      rr "pm2 reload $APP"
      if wait_health; then
        die "已回滚到上一版本，服务恢复。新版本失败原因: ssh $HOST \"pm2 logs $APP --lines 50 --nostream\""
      else
        die "回滚后仍不健康，需要人工介入: ssh $HOST \"pm2 logs $APP\""
      fi
    fi
    die "健康检查失败且没有可回滚版本: ssh $HOST \"pm2 logs $APP --lines 50 --nostream\""
  fi
  setup_nginx
  pm2_save
  prune_releases
  summary
}

cmd_rollback() {
  precheck_local
  local prev cur
  prev="$(rq "cat $BASE/.previous-release 2>/dev/null | tr -d '[:space:]'")"
  [ -n "$prev" ] || die "没有记录上一个版本"
  rq "[ -d $prev ]" || die "上一版本目录不存在: $prev"
  cur="$(rq "readlink $BASE/current")"
  log "回滚: $cur → $prev"
  rr "ln -sfn $prev $BASE/current"
  rr "printf '%s\n' '$cur' > $BASE/.previous-release"
  rr "pm2 reload $APP"
  wait_health || die "回滚后健康检查未通过，人工介入: ssh $HOST \"pm2 logs $APP\""
  log "回滚完成，当前版本: $prev"
}

cmd_status() {
  precheck_local
  echo "== pm2 =="
  rq "pm2 list" || true
  echo "== 当前版本 =="
  rq "readlink $BASE/current && cat $BASE/current/.release-info 2>/dev/null" || true
  echo "== 健康检查 =="
  echo "直连:   HTTP $(rq "curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:$PORT/ 2>/dev/null || true")"
  echo "nginx:  HTTP $(rq "curl -s -o /dev/null -w '%{http_code}' --max-time 5 -H 'Host: $DOMAIN' http://127.0.0.1/ 2>/dev/null || true")"
  echo "== 最近日志 =="
  rq "pm2 logs $APP --lines 15 --nostream" || true
}

# ---------- 参数解析 ----------
while [ $# -gt 0 ]; do
  case "$1" in
    first | daily | rollback | status) CMD="$1" ;;
    ci)
      CMD="ci"
      shift
      ARTIFACT="${1:-}"
      [ -n "$ARTIFACT" ] || die "ci 模式需要 CI 产物路径（piwork.tar.gz）"
      ;;
    --dry-run) DRY=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    --force-nginx) FORCE_NGINX=1 ;;
    --keep)
      [ $# -ge 2 ] || die "--keep 需要一个数字"
      KEEP="$2"
      shift
      ;;
    *) usage ;;
  esac
  shift
done
[ -n "$CMD" ] || usage

case "$CMD" in
  first) cmd_first ;;
  daily) cmd_daily ;;
  ci) cmd_ci ;;
  rollback) cmd_rollback ;;
  status) cmd_status ;;
esac
