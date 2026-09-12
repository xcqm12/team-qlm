#!/usr/bin/env bash
#
# 宝塔面板插件入口（卸载）
#
# 默认保留数据（数据库与上传文件），仅移除服务与 nginx 配置。
# 需要彻底删除时：bash uninstall.sh --purge
#
if [ -z "${BASH_VERSION:-}" ]; then
  command -v bash >/dev/null 2>&1 && exec bash "$0" "$@" || { echo "需要 bash" >&2; exit 1; }
fi

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

: "${INSTALL_DIR:=${install_dir:-${install_path:-/www/wwwroot/team-site}}}"
: "${SERVICE_NAME:=${service_name:-team-site}}"
export INSTALL_DIR SERVICE_NAME
export NONINTERACTIVE=1

args=(--yes --service "$SERVICE_NAME")
[ "${1:-}" = "--purge" ] && args+=(--purge --remove-dir)

exec bash "${DEPLOY_DIR}/uninstall.sh" "${args[@]}"
