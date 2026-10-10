#!/usr/bin/env bash
#
# piwork-release —— CI 发版部署：打 v* tag 触发 GitHub Actions 自动构建打包，
# 等 Release 产物就绪后下载并推送部署到生产服务器（pm2 重启生效，失败自动回滚）。
# 前置：当前分支代码已提交（工作区不干净时脚本拒绝）；分支/tag 推送由本脚本完成，HTTPS 失败自动走 SSH。
#
# 用法:
#   release-deploy.sh                    默认 patch 自增版本号发版并部署
#   release-deploy.sh patch|minor|major  指定自增位
#   release-deploy.sh vX.Y.Z             显式版本号
# 选项:
#   --skip-deploy      只发版（tag → CI → 下载产物），不部署服务器（产物目录保留）
#   --keep-dir         部署后也保留下载的产物临时目录
# 环境变量:
#   PIWORK_RELEASE_REPO / PIWORK_RELEASE_TAG / PIWORK_RELEASE_TIMEOUT(默认1800s)
#   PIWORK_DEPLOY_HOST / PIWORK_DEPLOY_RATE 等透传给 deploy.sh
# 产物链路: tag push → release.yml 构建 → GitHub Release 附件 piwork.tar.gz
#           → 本机下载 → deploy.sh ci 上传解包/装依赖/迁移/切软链 → pm2 reload + 健康检查

set -euo pipefail

WORKFLOW="release.yml"
ASSET="piwork.tar.gz"
TIMEOUT="${PIWORK_RELEASE_TIMEOUT:-1800}"
SKIP_DEPLOY=0
KEEP_ART=0
EXPLICIT_TAG="${PIWORK_RELEASE_TAG:-}"

PROJECT_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
DEPLOY_SH="$PROJECT_ROOT/.agents/skills/piwork-deploy/scripts/deploy.sh"

log()  { printf '\033[1;36m[release]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[失败]\033[0m %s\n' "$*" >&2; exit 1; }

usage() { sed -n '2,18p' "$0"; exit 1; }

bump_version() { # $1=基准版本(vX.Y.Z) $2=patch|minor|major → 新版本号
  local base="${1#v}" kind="$2" major minor patch
  IFS='.' read -r major minor patch <<<"$base"
  major=${major:-0}; minor=${minor:-0}; patch=${patch:-0}
  case "$kind" in
    major) major=$((major + 1)); minor=0; patch=0 ;;
    minor) minor=$((minor + 1)); patch=0 ;;
    *) patch=$((patch + 1)) ;;
  esac
  printf 'v%s.%s.%s\n' "$major" "$minor" "$patch"
}

push_with_fallback() { # $1=ref（HEAD 或 tag 名）；origin HTTPS 被断时自动走 SSH
  local ref="$1" ssh_url
  ssh_url="$(printf '%s\n' "$ORIGIN_URL" | sed -E 's#^https://github.com/#git@github.com:#')"
  ssh_url="git@github.com:${ssh_url#git@github.com:}"
  ssh_url="${ssh_url%.git}.git"
  if GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=10" git push "$ssh_url" "$ref" 2>/dev/null; then
    log "已推送 $ref → $ssh_url"
  else
    warn "SSH 推送失败，改走 origin ($ORIGIN_URL)"
    git push origin "$ref"
    log "已推送 $ref → origin"
  fi
}

# ---------- 参数 ----------
BUMP="patch"
while [ $# -gt 0 ]; do
  case "$1" in
    patch | minor | major) BUMP="$1" ;;
    --skip-deploy) SKIP_DEPLOY=1 ;;
    --keep-dir) KEEP_ART=1 ;;
    -h | --help) usage ;;
    v*) EXPLICIT_TAG="$1" ;;
    *) usage ;;
  esac
  shift
done

command -v git >/dev/null || die "本机缺少 git"
command -v gh >/dev/null || die "本机缺少 gh CLI（brew install gh && gh auth login）"
gh auth status >/dev/null 2>&1 || die "gh 未登录: gh auth login"
[ -x "$DEPLOY_SH" ] || die "找不到 deploy.sh: $DEPLOY_SH"

ORIGIN_URL="$(git -C "$PROJECT_ROOT" remote get-url origin)"
REPO="${PIWORK_RELEASE_REPO:-$(printf '%s\n' "$ORIGIN_URL" | sed -E 's#^(https://github.com/|git@github.com:)##; s#\.git$##')}"
[ "$REPO" = "robotbird/piwork_dev" ] || warn "origin 解析为 ${REPO}（预期 robotbird/piwork_dev）"

[ -z "$(git -C "$PROJECT_ROOT" status --porcelain)" ] || die "工作区有未提交变更，先提交并 push 再发版（按 git 技能流程）"

# ---------- 计算版本号 ----------
if [ -n "$EXPLICIT_TAG" ]; then
  [[ "$EXPLICIT_TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "版本号格式应为 vX.Y.Z: $EXPLICIT_TAG"
  TAG="$EXPLICIT_TAG"
else
  LAST="$(git -C "$PROJECT_ROOT" describe --tags --abbrev=0 --match 'v*' 2>/dev/null || true)"
  if [ -z "$LAST" ]; then
    LAST="v$(node -p "require('$PROJECT_ROOT/package.json').version" 2>/dev/null || echo 0.0.0)"
    log "仓库还没有 tag，以 package.json 版本 $LAST 为基准"
  fi
  TAG="$(bump_version "$LAST" "$BUMP")"
fi
git -C "$PROJECT_ROOT" rev-parse -q --verify "refs/tags/$TAG" >/dev/null 2>&1 && die "tag $TAG 已存在，换一个版本号"
SHA="$(git -C "$PROJECT_ROOT" rev-parse HEAD)"
SHORT_SHA="${SHA:0:7}"
log "发版 ${TAG}（${SHORT_SHA}），版本模式: ${EXPLICIT_TAG:-$BUMP 自增}"

# ---------- 推送分支 + tag（触发 CI）----------
cd "$PROJECT_ROOT"
log "推送当前分支 ($(git branch --show-current))"
push_with_fallback "HEAD"
log "打 tag 并推送，触发 $WORKFLOW"
git tag -a "$TAG" -m "release $TAG"
push_with_fallback "$TAG"

# ---------- 等 CI 构建 ----------
log "等待 CI run 出现..."
RUN_ID=""
DEADLINE=$(( $(date +%s) + TIMEOUT ))
for _ in $(seq 1 18); do
  RUN_ID="$(gh run list -R "$REPO" --workflow "$WORKFLOW" --limit 20 \
    --json databaseId,headSha \
    --jq "[.[] | select(.headSha==\"$SHA\")] | first | .databaseId // empty" 2>/dev/null || true)"
  [ -n "$RUN_ID" ] && break
  [ "$(date +%s)" -ge "$DEADLINE" ] && die "超时：没等到 $TAG 触发的 $WORKFLOW run（确认仓库 Actions 已启用）"
  sleep 10
done
[ -n "$RUN_ID" ] || die "没找到 $TAG 触发的 $WORKFLOW run"
log "CI run $RUN_ID 构建中（最长 $((TIMEOUT / 60)) 分钟）..."
while :; do
  INFO="$(gh run view "$RUN_ID" -R "$REPO" --json status,conclusion --jq '.status + " " + (.conclusion // "running")' 2>/dev/null || echo "poll running")"
  STATUS="${INFO%% *}"; CONCLUSION="${INFO#* }"
  if [ "$STATUS" = "completed" ]; then
    if [ "$CONCLUSION" = "success" ]; then
      log "CI 构建成功"
    else
      gh run view "$RUN_ID" -R "$REPO" --log-failed 2>/dev/null | tail -80 || true
      die "CI 失败（${CONCLUSION}），发版终止。排查: gh run view $RUN_ID -R $REPO --log-failed"
    fi
    break
  fi
  [ "$(date +%s)" -ge "$DEADLINE" ] && die "等待 CI 超时（>${TIMEOUT}s）: gh run view $RUN_ID -R $REPO"
  sleep 20
done

# ---------- 下载 Release 产物 ----------
ARTDIR="$(mktemp -d /tmp/piwork-release.XXXXXX)"
cleanup() { [ "$KEEP_ART" = "1" ] || rm -rf "$ARTDIR"; }
trap cleanup EXIT
log "从 GitHub Release 下载 $ASSET"
ARTIFACT="$ARTDIR/$ASSET"
OK=0
for ATTEMPT in 1 2 3; do
  if gh release download "$TAG" -R "$REPO" --pattern "$ASSET" --dir "$ARTDIR" --clobber >/dev/null 2>&1 && [ -s "$ARTIFACT" ]; then
    OK=1
    break
  fi
  warn "第 ${ATTEMPT} 次下载失败，重试..."
  sleep 10
done
if [ "$OK" != "1" ]; then
  die "下载 $ASSET 失败（Release 附件 CDN 可能被墙）。手动方案：浏览器打开 https://github.com/$REPO/releases/tag/$TAG 下载后执行: bash $DEPLOY_SH ci <文件路径>"
fi
log "产物就绪: $ARTIFACT ($(du -h "$ARTIFACT" | cut -f1))"

# ---------- 部署到服务器 ----------
if [ "$SKIP_DEPLOY" = "1" ]; then
  KEEP_ART=1
  log "--skip-deploy: 仅发版完成，产物保留在 ${ARTDIR}（部署时执行: bash $DEPLOY_SH ci ${ARTIFACT}）"
  exit 0
fi
bash "$DEPLOY_SH" ci "$ARTIFACT"

RUN_URL="$(gh run view "$RUN_ID" -R "$REPO" --json url --jq .url 2>/dev/null || echo "https://github.com/$REPO/actions")"
cat <<EOF

================ 发版部署完成 ================
  版本:     $TAG (${SHORT_SHA})
  CI run:   $RUN_URL
  Release:  https://github.com/$REPO/releases/tag/$TAG
  服务器:   ${PIWORK_DEPLOY_HOST:-root@123.56.79.62}:/yepeng/web/piwork.net
  健康地址: http://piwork.net/
=============================================
EOF
