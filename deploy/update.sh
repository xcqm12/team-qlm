#!/usr/bin/env bash
#
# 更新站点：拉取/同步最新代码 → 安装依赖 → 重建前端 → 迁移数据库 → 重启服务
#
# 用法：
#   bash deploy/update.sh                 # 交互式
#   bash deploy/update.sh --yes           # 全自动
#   bash deploy/update.sh --skip-build    # 只更新后端
#   bash deploy/update.sh --slim          # 构建后清理前端 node_modules
#   bash deploy/update.sh --backup-only   # 仅执行一次备份后退出
#
# 允许被 `sh deploy/update.sh` 调用：自动切换回 bash
if [ -z "${BASH_VERSION:-}" ]; then
  command -v bash >/dev/null 2>&1 && exec bash "$0" "$@" || { echo "需要 bash" >&2; exit 1; }
fi

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=lib/common.sh
. "${SCRIPT_DIR}/lib/common.sh"

SERVICE_NAME="${SERVICE_NAME:-team-site}"
NONINTERACTIVE="${NONINTERACTIVE:-0}"
SKIP_BUILD=0
SLIM=0

while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y|--noninteractive) NONINTERACTIVE=1; shift ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    --slim) SLIM=1; shift ;;
    --service) require_arg_value "$1" "${2:-}"; SERVICE_NAME="$2"; shift 2 ;;
    --backup-only)
      require_root
      python3 "${INSTALL_DIR}/tools/backup.py" --keep 14 --json
      exit $? ;;
    -h|--help) sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "未知参数: $1" ;;
  esac
done

main() {
  banner
  require_root
  log "安装目录: ${INSTALL_DIR}"

  step "1/6 更新前备份（数据库 + 上传文件）"
  if has_cmd python3 && [ -f "${INSTALL_DIR}/tools/backup.py" ]; then
    ( cd "$INSTALL_DIR" && python3 tools/backup.py --keep 14 --json ) || warn "备份失败，继续更新（请谨慎）"
  else
    warn "未找到 python3 或备份脚本，跳过备份"
  fi

  step "2/6 更新后端依赖"
  ( cd "${INSTALL_DIR}/backend" && npm install --no-audit --no-fund --omit=optional --loglevel=error )

  step "3/6 数据库结构迁移（幂等建表 + 补齐种子数据）"
  ( cd "${INSTALL_DIR}/backend" && node scripts/init-db.js >/dev/null && node scripts/seed.js )

  if [ "$SKIP_BUILD" = "1" ]; then
    warn "4/6 已跳过前端构建"
  else
    step "4/6 重新构建前端"
    ( cd "${INSTALL_DIR}/frontend" && npm install --no-audit --no-fund --loglevel=error && npm run build:only )
    if [ "$SLIM" = "1" ]; then
      rm -rf "${INSTALL_DIR}/frontend/node_modules"
      dim "已清理前端 node_modules"
    fi
  fi

  step "5/6 重启后端服务"
  if has_cmd systemctl && systemctl list-unit-files "${SERVICE_NAME}.service" >/dev/null 2>&1; then
    systemctl restart "${SERVICE_NAME}"
    ok "systemctl restart ${SERVICE_NAME}"
  elif [ -x "/etc/init.d/${SERVICE_NAME}" ]; then
    "/etc/init.d/${SERVICE_NAME}" restart
    ok "init.d ${SERVICE_NAME} restart"
  else
    warn "未找到服务 ${SERVICE_NAME}，请手动重启后端"
  fi

  step "6/6 健康检查"
  local port
  port="$(grep -E '^PORT=' "${INSTALL_DIR}/backend/.env" 2>/dev/null | head -n1 | cut -d= -f2 | tr -d ' ')"
  port="${port:-8787}"
  if has_cmd curl && wait_for_http "http://127.0.0.1:${port}/api/health" 40; then
    ok "服务已恢复，健康检查通过"
  else
    err "健康检查失败：$(describe_http_failure)"
    err "  目标 http://127.0.0.1:${port}/api/health（端口取自 backend/.env 的 PORT）"
    err "  若状态码是 429：说明反 CC 把本机也拦了，可执行 systemctl kill -s SIGUSR1 ${SERVICE_NAME} 清空封禁"
    err "  服务日志：journalctl -u ${SERVICE_NAME} -n 80 --no-pager"
    err "  应用日志：tail -50 ${INSTALL_DIR}/logs/team-site.log"
    exit 1
  fi

  if has_cmd python3; then
    ( cd "$INSTALL_DIR" && python3 tools/healthcheck.py ) || warn "自检存在异常项"
  fi
  printf '\n%b\n' "${C_GREEN}更新完成${C_RESET}"
}

main "$@"
