#!/usr/bin/env bash
#
# 宝塔面板插件入口（安装）
#
# 宝塔的「一键部署」/插件体系会调用本脚本。它只做参数适配，实际部署逻辑复用
# deploy/bt-deploy.sh，保证与命令行部署完全一致。
#
# 宝塔可能以如下方式调用：
#   bash install.sh                        # 面板传入环境变量
#   bash install.sh --domain x.com --port 8787
#
# 可识别的面板环境变量：domain / DOMAIN / site_name / port / PORT / install_dir / INSTALL_DIR
#
# 允许被 sh 调用：自动切换回 bash
if [ -z "${BASH_VERSION:-}" ]; then
  command -v bash >/dev/null 2>&1 && exec bash "$0" "$@" || { echo "需要 bash" >&2; exit 1; }
fi

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# 把宝塔可能传入的小写变量归一化
: "${DOMAIN:=${domain:-_}}"
: "${PORT:=${port:-}}"
: "${INSTALL_DIR:=${install_dir:-${install_path:-/www/wwwroot/team-site}}}"
: "${SERVICE_NAME:=${service_name:-team-site}}"
: "${ADMIN_USERNAME:=${admin_username:-admin}}"
: "${ADMIN_PASSWORD:=${admin_password:-}}"
: "${SSL_CERT:=${ssl_cert:-}}"
: "${SSL_KEY:=${ssl_key:-}}"
export DOMAIN PORT INSTALL_DIR SERVICE_NAME ADMIN_USERNAME ADMIN_PASSWORD SSL_CERT SSL_KEY

args=(--dir "$INSTALL_DIR" --service "$SERVICE_NAME" --username "$ADMIN_USERNAME")
[ -n "$PORT" ] && args+=(--port "$PORT")
[ -n "$ADMIN_PASSWORD" ] && args+=(--password "$ADMIN_PASSWORD")
[ "$DOMAIN" != "_" ] && args+=(--domain "$DOMAIN")
[ -n "$SSL_CERT" ] && args+=(--ssl-cert "$SSL_CERT")
[ -n "$SSL_KEY" ] && args+=(--ssl-key "$SSL_KEY")

# 面板调用时无交互
export NONINTERACTIVE=1

exec bash "${DEPLOY_DIR}/bt-deploy.sh" "${args[@]}"
