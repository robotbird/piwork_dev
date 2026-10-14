#!/usr/bin/env bash
# 启动本地 OpenSandbox server 前，自动把 .env.local 的 PIWORK_INFERENCE_URL
# 同步为宿主机当前局域网 IP（沙箱容器回连宿主 Inference Proxy 用）。
# 端口取 PIWORK_INFERENCE_PROXY_PORT（缺省 3210），仅 host 部分会变化。
#
# 用法：
#   scripts/start-opensandbox.sh             # 同步 IP 并启动 opensandbox-server
#   scripts/start-opensandbox.sh --env-only  # 只同步 .env.local，不启动 server
#
# 注意：piwork 应用在装配时读取 PIWORK_INFERENCE_URL（HMR 保留旧 manager），
# IP 变化后需重启 npm run dev 才会用新地址生成沙箱 models.json。
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.local"
INFERENCE_PORT="${PIWORK_INFERENCE_PROXY_PORT:-3210}"
ONLY_ENV=0
[[ "${1:-}" == "--env-only" ]] && ONLY_ENV=1

# --- 1. 探测宿主机当前局域网 IP -------------------------------------------
detect_host_ip() {
  local iface ip
  # 优先：默认路由所在网卡（Colima VM 出宿主的路径也是它）
  iface="$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')"
  if [[ -n "$iface" ]]; then
    ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
    if [[ -n "$ip" ]]; then
      printf '%s' "$ip"
      return 0
    fi
  fi
  # 兜底 1：en0
  ip="$(ipconfig getifaddr en0 2>/dev/null || true)"
  if [[ -n "$ip" ]]; then
    printf '%s' "$ip"
    return 0
  fi
  # 兜底 2：扫描所有 IPv4，排除 loopback / link-local / 198.18.0.0/15（代理 TUN）
  ip="$(ifconfig 2>/dev/null | awk '/inet /{print $2}' |
    grep -v -e '^127\.' -e '^169\.254\.' -e '^198\.1[89]\.' |
    head -n 1 || true)"
  if [[ -n "$ip" ]]; then
    printf '%s' "$ip"
    return 0
  fi
  return 1
}

HOST_IP="$(detect_host_ip)" || {
  echo "[start-opensandbox] 错误：未能探测到宿主机局域网 IP，保持 .env.local 不变" >&2
  exit 1
}
NEW_URL="http://${HOST_IP}:${INFERENCE_PORT}"

# --- 2. 原子更新 .env.local（仅在值变化时写入） ----------------------------
OLD_URL="$(grep -E '^PIWORK_INFERENCE_URL=' "$ENV_FILE" 2>/dev/null | tail -n 1 | cut -d= -f2- || true)"

# 若端口上已有 inference proxy 监听（即某个 dev server 在跑），且它启动早于
# 本次 .env.local 修改，则它仍持有旧地址，沙箱 models.json 会继续拿到死 IP。
warn_stale_listener() {
  local pids pid lstart start_epoch env_mtime
  pids="$(lsof -nP -tiTCP:"$INFERENCE_PORT" -sTCP:LISTEN 2>/dev/null || true)"
  [[ -z "$pids" ]] && return 0
  env_mtime="$(stat -f %m "$ENV_FILE" 2>/dev/null || echo 0)"
  for pid in $pids; do
    lstart="$(ps -p "$pid" -o lstart= 2>/dev/null || true)"
    [[ -z "$lstart" ]] && continue
    start_epoch="$(date -j -f '%a %b %d %H:%M:%S %Y' "$lstart" +%s 2>/dev/null || echo 0)"
    if [[ "$start_epoch" -gt 0 && "$start_epoch" -lt "$env_mtime" ]]; then
      echo "[start-opensandbox] 警告：dev server (PID $pid, 启动于 $lstart) 早于本次配置更新，" >&2
      echo "[start-opensandbox] 仍持有旧 PIWORK_INFERENCE_URL，必须重启 npm run dev，否则沙箱内模型请求会 fetch failed！" >&2
    fi
  done
  return 0
}

if [[ "$OLD_URL" == "$NEW_URL" ]]; then
  echo "[start-opensandbox] PIWORK_INFERENCE_URL 已是最新：$NEW_URL"
else
  touch "$ENV_FILE"
  tmp="$(mktemp "${ENV_FILE}.XXXXXX")"
  if grep -qE '^PIWORK_INFERENCE_URL=' "$ENV_FILE"; then
    sed "s|^PIWORK_INFERENCE_URL=.*|PIWORK_INFERENCE_URL=${NEW_URL}|" "$ENV_FILE" > "$tmp"
  else
    { cat "$ENV_FILE"; printf '\nPIWORK_INFERENCE_URL=%s\n' "$NEW_URL"; } > "$tmp"
  fi
  mv "$tmp" "$ENV_FILE"
  echo "[start-opensandbox] PIWORK_INFERENCE_URL: ${OLD_URL:-<未配置>} -> ${NEW_URL}"
  echo "[start-opensandbox] 提醒：请重启 npm run dev，让 RunManager 用新地址装配 Inference Proxy。"
fi
warn_stale_listener

# --- 3. 启动 OpenSandbox server（或仅同步后退出） --------------------------
if [[ "$ONLY_ENV" -eq 1 ]]; then
  exit 0
fi

echo "[start-opensandbox] 启动 opensandbox-server ..."
exec env \
  DOCKER_HOST="unix://$HOME/.colima/default/docker.sock" \
  NO_PROXY='*' no_proxy='*' \
  uv tool run --from opensandbox-server==1.1.1 \
    opensandbox-server --config "$HOME/.sandbox.toml"
