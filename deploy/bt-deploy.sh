#!/usr/bin/env bash
#
# 宝塔面板专用一键部署：在宝塔环境中完成「建站 + 反向代理 + 服务守护 + 备份任务」
#
# 与 install.sh 的区别：
#   install.sh  → 通用一键部署（任意 Linux + systemd/init.d）
#   bt-deploy.sh→ 面向宝塔面板：
#                 · 自动识别宝塔的 nginx / PHP 站点目录 / 面板路径
#                 · 把 nginx vhost 写入 /www/server/panel/vhost/nginx 并在面板可见
#                 · 优先使用面板自带 Nginx，按宝塔规范设置日志与权限
#                 · 自动生成宝塔「计划任务」所需的 Shell 命令
#                 · 可选：用面板的 SSL 证书目录自动开启 HTTPS
#
# 用法（宝塔面板 → 终端）：
#   bash deploy/bt-deploy.sh --domain team.example.com
#   bash deploy/bt-deploy.sh --domain team.example.com --password 'StrongPass' --ssl-cert /www/server/panel/vhost/cert/team.example.com/fullchain.pem --ssl-key /www/server/panel/vhost/cert/team.example.com/privkey.pem
#   bash deploy/bt-deploy.sh --check        # 仅检查宝塔环境与依赖
#
# 允许被 `sh deploy/bt-deploy.sh` 调用：自动切换回 bash
if [ -z "${BASH_VERSION:-}" ]; then
  command -v bash >/dev/null 2>&1 && exec bash "$0" "$@" || { echo "需要 bash" >&2; exit 1; }
fi

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_SRC="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=lib/common.sh
. "${SCRIPT_DIR}/lib/common.sh"
# shellcheck source=lib/detect-os.sh
. "${SCRIPT_DIR}/lib/detect-os.sh"

DOMAIN="${DOMAIN:-_}"
PORT="${PORT:-}"
INSTALL_DIR="${INSTALL_DIR:-/www/wwwroot/team-site}"
SERVICE_NAME="${SERVICE_NAME:-team-site}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
SSL_CERT="${SSL_CERT:-}"
SSL_KEY="${SSL_KEY:-}"
BT_ONLY_CHECK=0
NONINTERACTIVE="${NONINTERACTIVE:-0}"

while [ $# -gt 0 ]; do
  case "$1" in
    --domain) require_arg_value "$1" "${2:-}"; DOMAIN="$2"; shift 2 ;;
    --port) require_arg_value "$1" "${2:-}"; PORT="$2"; shift 2 ;;
    --dir) require_arg_value "$1" "${2:-}"; INSTALL_DIR="$2"; shift 2 ;;
    --service) require_arg_value "$1" "${2:-}"; SERVICE_NAME="$2"; shift 2 ;;
    --username) require_arg_value "$1" "${2:-}"; ADMIN_USERNAME="$2"; shift 2 ;;
    --password) require_arg_value "$1" "${2:-}"; ADMIN_PASSWORD="$2"; shift 2 ;;
    --ssl-cert) require_arg_value "$1" "${2:-}"; SSL_CERT="$2"; shift 2 ;;
    --ssl-key) require_arg_value "$1" "${2:-}"; SSL_KEY="$2"; shift 2 ;;
    --check) BT_ONLY_CHECK=1; shift ;;
    --yes|-y|--noninteractive) NONINTERACTIVE=1; shift ;;
    -h|--help) sed -n '2,34p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "未知参数: $1" ;;
  esac
done

BT_PANEL_DIR="/www/server/panel"
BT_NGINX_DIR="/www/server/nginx"
BT_VHOST_DIR="${BT_PANEL_DIR}/vhost/nginx"
BT_LOG_DIR="/www/wwwlogs"
BT_PHP_DIR="/www/server/php"

preflight() {
  banner
  require_root
  detect_os
  print_os_info

  step "脚本可执行性检查"
  ensure_script_hygiene "$PROJECT_SRC"
  chmod +x "$0" 2>/dev/null || true
  check_exec_allowed "$PROJECT_SRC" || true

  step "宝塔环境检查"
  local problems=0
  if [ -d "$BT_PANEL_DIR" ]; then ok "宝塔面板目录: ${BT_PANEL_DIR}"; else warn "未找到 ${BT_PANEL_DIR}（可能不是宝塔环境）"; problems=$((problems+1)); fi
  if [ -x "${BT_NGINX_DIR}/sbin/nginx" ]; then
    ok "宝塔 Nginx: $("${BT_NGINX_DIR}/sbin/nginx" -v 2>&1 | head -n1)"
  elif has_cmd nginx; then
    ok "系统 Nginx: $(nginx -v 2>&1 | head -n1)"
  else
    warn "未检测到 Nginx —— 宝塔面板「软件商店」中安装 Nginx 后即可自动配置站点"; problems=$((problems+1))
  fi
  if [ -d "$BT_VHOST_DIR" ]; then ok "vhost 目录: ${BT_VHOST_DIR}"; else warn "未找到 ${BT_VHOST_DIR}"; fi
  if [ -d "$BT_LOG_DIR" ]; then ok "日志目录: ${BT_LOG_DIR}"; else warn "未找到 ${BT_LOG_DIR}（将使用 /var/log/nginx）"; fi
  if has_cmd python3; then ok "Python: $(python3 --version 2>&1)"; else warn "未安装 python3（运维脚本需要）"; problems=$((problems+1)); fi
  has_cmd curl && ok "curl 已安装" || warn "缺少 curl"

  [ "$problems" -gt 0 ] && warn "有 ${problems} 项环境提示，脚本会尽量兼容处理"
  return 0
}

main() {
  preflight
  if [ "$BT_ONLY_CHECK" = "1" ]; then
    step "仅检查模式结束"
    dim "执行完整部署： bash deploy/bt-deploy.sh --domain 你的域名"
    return 0
  fi

  if [ "$NONINTERACTIVE" != "1" ] && [ "$DOMAIN" = "_" ]; then
    echo
    DOMAIN="$(prompt_default "请输入要绑定的域名（回车表示仅 IP 访问）" "")"
    [ -z "$DOMAIN" ] && DOMAIN="_"
  fi
  [ -n "$PORT" ] || PORT="$(find_free_port 8787)"
  [ -n "$ADMIN_PASSWORD" ] || ADMIN_PASSWORD="$(random_secret | cut -c1-16)"

  step "调用通用安装流程（宝塔目录规范）"
  # 复用 install.sh 的全部逻辑，只覆盖宝塔相关路径
  local args=(--noninteractive --dir "$INSTALL_DIR" --service "$SERVICE_NAME"
              --username "$ADMIN_USERNAME" --password "$ADMIN_PASSWORD" --port "$PORT")
  if [ "$DOMAIN" != "_" ]; then args+=(--domain "$DOMAIN"); fi
  DOMAIN="$DOMAIN" PORT="$PORT" INSTALL_DIR="$INSTALL_DIR" SERVICE_NAME="$SERVICE_NAME" \
  ADMIN_USERNAME="$ADMIN_USERNAME" ADMIN_PASSWORD="$ADMIN_PASSWORD" \
    bash "${SCRIPT_DIR}/install.sh" "${args[@]}"

  step "宝塔面板收尾配置"
  configure_bt_logrotate
  configure_bt_ssl
  print_bt_tasks
}

configure_bt_logrotate() {
  # 宝塔自身会切割面板日志，这里保证本项目日志不会无限增长
  if [ -d "$BT_PANEL_DIR" ] && [ -d /etc/logrotate.d ]; then
    cat > "/etc/logrotate.d/${SERVICE_NAME}" <<EOF
${INSTALL_DIR}/logs/*.log {
    daily
    rotate 14
    missingok
    notifempty
    compress
    delaycompress
    copytruncate
}
EOF
    ok "已安装日志切割策略: /etc/logrotate.d/${SERVICE_NAME}"
  else
    dim "未启用 logrotate 策略（非宝塔环境或缺少 /etc/logrotate.d）"
  fi
}

configure_bt_ssl() {
  [ -n "$SSL_CERT" ] && [ -n "$SSL_KEY" ] || {
    dim "未指定 --ssl-cert/--ssl-key，跳过 HTTPS 配置（可在宝塔面板「SSL」中一键申请 Let's Encrypt 证书）"
    return 0
  }
  [ -f "$SSL_CERT" ] || { warn "证书文件不存在: $SSL_CERT"; return 0; }
  [ -f "$SSL_KEY" ] || { warn "私钥文件不存在: $SSL_KEY"; return 0; }

  local conf
  for candidate in "${BT_VHOST_DIR}/${DOMAIN}.conf" "${BT_VHOST_DIR}/${SERVICE_NAME}.conf"; do
    [ -f "$candidate" ] && { conf="$candidate"; break; }
  done
  [ -n "${conf:-}" ] || { warn "未找到 vhost 配置文件，无法注入 SSL"; return 0; }

  step "启用 HTTPS（${DOMAIN}）"
  backup_file "$conf"
  local tmp="${conf}.ssl.tmp"
  awk -v cert="$SSL_CERT" -v key="$SSL_KEY" '
    BEGIN { inserted = 0 }
    /^server \{/ && inserted == 0 {
      print
      print "    listen 443 ssl http2;"
      print "    listen [::]:443 ssl http2;"
      print "    ssl_certificate     " cert ";"
      print "    ssl_certificate_key " key ";"
      print "    ssl_protocols TLSv1.2 TLSv1.3;"
      print "    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;"
      print "    ssl_prefer_server_ciphers on;"
      print "    ssl_session_cache shared:SSL:10m;"
      print "    ssl_session_timeout 10m;"
      print "    add_header Strict-Transport-Security \"max-age=31536000\" always;"
      inserted = 1
      next
    }
    { print }
  ' "$conf" > "$tmp"

  # 追加 HTTP 跳转 HTTPS 的 server 块
  cat >> "$tmp" <<EOF

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}
EOF
  mv "$tmp" "$conf"

  local bin; bin="$(nginx_bin)"
  if [ -x "$bin" ] && "$bin" -t >/dev/null 2>&1; then
    reload_nginx && ok "HTTPS 已启用并重载 Nginx"
  else
    err "HTTPS 配置校验失败，正在回滚"
    local latest_backup
    latest_backup="$(ls -t "${conf}".bak.* 2>/dev/null | head -n1 || true)"
    if [ -n "$latest_backup" ]; then
      cp "$latest_backup" "$conf"
      dim "已回滚到 ${latest_backup}"
    fi
    "$bin" -t || true
    return 1
  fi
}

print_bt_tasks() {
  cat <<EOF

${C_BOLD}宝塔面板推荐的计划任务（面板 → 计划任务 → Shell 脚本）${C_RESET}

  1) 每日备份（建议 03:10 执行）
     cd ${INSTALL_DIR} && /usr/bin/python3 tools/backup.py --keep 14 --json

  2) 站点健康检查（建议每 5 分钟，异常写日志便于告警）
     cd ${INSTALL_DIR} && /usr/bin/python3 tools/healthcheck.py --quiet >> logs/healthcheck.log 2>&1

  3) 图片缩略图维护（可选，需先 pip3 install Pillow）
     cd ${INSTALL_DIR} && /usr/bin/python3 tools/make_thumbnails.py --clean

  宝塔面板安全建议：
     · 网站 → ${DOMAIN} → SSL：申请证书并开启「强制 HTTPS」
     · 安全 → 防火墙：仅放行 80 / 443，${PORT} 端口无需对外开放
     · 网站 → 反向代理：本脚本已直接写入 vhost，无需再手动添加反代

EOF
}

main "$@"
