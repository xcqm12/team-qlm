#!/usr/bin/env bash
#
# 卸载站点：停止服务 → 移除 nginx 配置 → （可选）删除数据 → 删除目录
#
# 用法：
#   bash deploy/uninstall.sh                  # 交互式，默认保留数据目录
#   bash deploy/uninstall.sh --keep-data      # 保留数据库与上传文件
#   bash deploy/uninstall.sh --purge          # 彻底删除（含数据，不可恢复）
#   bash deploy/uninstall.sh --yes --purge    # 全自动彻底卸载
#
# 允许被 `sh deploy/uninstall.sh` 调用：自动切换回 bash
if [ -z "${BASH_VERSION:-}" ]; then
  command -v bash >/dev/null 2>&1 && exec bash "$0" "$@" || { echo "需要 bash" >&2; exit 1; }
fi

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=lib/common.sh
. "${SCRIPT_DIR}/lib/common.sh"
# shellcheck source=lib/detect-os.sh
. "${SCRIPT_DIR}/lib/detect-os.sh"

SERVICE_NAME="${SERVICE_NAME:-team-site}"
NONINTERACTIVE="${NONINTERACTIVE:-0}"
KEEP_DATA=1
REMOVE_DIR=0

while [ $# -gt 0 ]; do
  case "$1" in
    --keep-data) KEEP_DATA=1; shift ;;
    --purge) KEEP_DATA=0; REMOVE_DIR=1; shift ;;
    --remove-dir) REMOVE_DIR=1; shift ;;
    --service) require_arg_value "$1" "${2:-}"; SERVICE_NAME="$2"; shift 2 ;;
    --yes|-y|--noninteractive) NONINTERACTIVE=1; shift ;;
    -h|--help) sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "未知参数: $1" ;;
  esac
done

main() {
  banner
  require_root
  detect_os

  warn "即将卸载站点：${INSTALL_DIR}（服务名 ${SERVICE_NAME}）"
  if [ "$KEEP_DATA" = "0" ]; then
    warn "！--purge 模式会删除数据库与全部上传文件，且不可恢复！"
  fi
  confirm "确认继续？" n || { log "已取消"; exit 0; }

  # 1) 卸载前备份
  if [ "$KEEP_DATA" = "1" ] && has_cmd python3 && [ -f "${INSTALL_DIR}/tools/backup.py" ]; then
    step "卸载前备份数据"
    ( cd "$INSTALL_DIR" && python3 tools/backup.py --keep 0 --json ) || warn "备份失败"
  fi

  # 2) 停止并移除服务
  step "停止并移除系统服务"
  if has_cmd systemctl && systemctl list-unit-files "${SERVICE_NAME}.service" >/dev/null 2>&1; then
    systemctl stop "${SERVICE_NAME}" 2>/dev/null || true
    systemctl disable "${SERVICE_NAME}" 2>/dev/null || true
    rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
    systemctl daemon-reload
    ok "systemd 服务已移除"
  elif [ -f "/etc/init.d/${SERVICE_NAME}" ]; then
    "/etc/init.d/${SERVICE_NAME}" stop 2>/dev/null || true
    if has_cmd update-rc.d; then update-rc.d -f "$SERVICE_NAME" remove >/dev/null 2>&1 || true; fi
    if has_cmd chkconfig; then chkconfig --del "$SERVICE_NAME" >/dev/null 2>&1 || true; fi
    if has_cmd rc-update; then rc-update del "$SERVICE_NAME" >/dev/null 2>&1 || true; fi
    rm -f "/etc/init.d/${SERVICE_NAME}"
    ok "init.d 脚本已移除"
  else
    dim "未发现注册的服务"
  fi

  # 3) 移除 nginx 配置
  step "移除 nginx 站点配置"
  local removed=0
  for dir in /www/server/panel/vhost/nginx /etc/nginx/conf.d /etc/nginx/sites-available /etc/nginx/sites-enabled /usr/local/nginx/conf/vhost; do
    [ -d "$dir" ] || continue
    for name in "${SERVICE_NAME}.conf"; do
      if [ -f "${dir}/${name}" ]; then
        backup_file "${dir}/${name}"
        rm -f "${dir}/${name}"
        removed=$((removed + 1))
      fi
    done
    # 域名命名的配置（逐个匹配 server_name 指向本项目的文件）
    for file in "${dir}"/*.conf; do
      [ -f "$file" ] || continue
      if grep -q "${INSTALL_DIR}/frontend/dist" "$file" 2>/dev/null; then
        backup_file "$file"
        rm -f "$file"
        removed=$((removed + 1))
      fi
    done
  done
  if [ "$removed" -gt 0 ]; then
    reload_nginx >/dev/null 2>&1 || true
    ok "已移除 ${removed} 个 nginx 配置并重载"
  else
    dim "未发现站点配置"
  fi

  # 4) 处理数据与目录
  if [ "$KEEP_DATA" = "0" ]; then
    step "删除数据（数据库 / 上传文件 / 备份）"
    rm -rf "${INSTALL_DIR}/backend/data" "${INSTALL_DIR}/backups"
    ok "数据已删除"
  else
    local keep="${INSTALL_DIR}/data-backup-$(date +%Y%m%d%H%M%S)"
    step "保留数据到 ${keep}"
    mkdir -p "$keep"
    [ -d "${INSTALL_DIR}/backend/data" ] && cp -a "${INSTALL_DIR}/backend/data" "$keep/" 2>/dev/null || true
    [ -d "${INSTALL_DIR}/backups" ] && cp -a "${INSTALL_DIR}/backups" "$keep/" 2>/dev/null || true
    [ -f "${INSTALL_DIR}/backend/.env" ] && cp -a "${INSTALL_DIR}/backend/.env" "$keep/" 2>/dev/null || true
    ok "数据已保留（重新部署时把它复制回 backend/data 即可恢复）"
  fi

  if [ "$REMOVE_DIR" = "1" ]; then
    step "删除安装目录"
    confirm "确认删除整个目录 ${INSTALL_DIR}？" n || { log "保留目录，仅完成卸载"; print_done; return 0; }
    cd /
    rm -rf "$INSTALL_DIR"
    ok "目录已删除"
  fi

  print_done
}

print_done() {
  printf '\n%b\n' "${C_GREEN}卸载完成${C_RESET}"
  local data_state="已删除"
  [ "$KEEP_DATA" = "1" ] && data_state="已保留"
  cat <<EOF

  已完成的清理：
    · 后端服务已停止并移除
    · nginx 站点配置已移除（原文件保留为 .bak.*）
    · 数据：${data_state}

  如需恢复数据：把保留目录中的数据复制回 backend/data 后重新执行
    bash deploy/install.sh

EOF
}

main "$@"
