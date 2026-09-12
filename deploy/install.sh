#!/usr/bin/env bash
#
# 七零喵团队站点 · 一键部署脚本
#
# 适配的 Linux 变种：
#   Debian 10/11/12、Ubuntu 18.04~24.04、Linux Mint、Deepin/UOS/麒麟
#   CentOS 7/8、Rocky Linux、AlmaLinux、Fedora、Oracle Linux、Anolis、openEuler、Amazon Linux
#   openSUSE Leap / SLES、Alpine Linux、Arch Linux / Manjaro
#
# 用法（宝塔面板 → 终端，或任意 root shell）：
#   bash deploy/install.sh
#   ./deploy/install.sh                      # 已 chmod +x 时可直接执行
#   sh deploy/install.sh                     # sh 也会自动切到 bash
#   bash deploy/install.sh --domain team.example.com --port 8787
#   bash deploy/install.sh --domain team.example.com --password 'YourStrongPass' --noninteractive
#   DOMAIN=team.example.com bash deploy/install.sh
#
# 远程服务器部署（推荐先打包再上传，权限与换行都已修好）：
#   本地:  node scripts/pack-release.mjs            # 生成 team-site-<版本>.tar.gz
#   远程:  scp team-site-1.0.0.tar.gz root@IP:/tmp/ && ssh root@IP \
#          "tar -xzf /tmp/team-site-1.0.0.tar.gz -C /www/wwwroot/ && bash /www/wwwroot/team-site/deploy/install.sh --domain x.com"
#
# 可选参数（也支持同名环境变量）：
#   --domain <域名>        绑定域名，生成 nginx 站点配置（默认 _ 即仅 IP 访问）
#   --port <端口>          后端监听端口（默认 8787，被占用时自动 +1）
#   --dir <路径>           安装目录（宝塔默认 /www/wwwroot/<域名>，无域名时 /www/wwwroot/team-site）
#   --service <名称>       服务名（默认 team-site）
#   --username <用户名>    初始管理员用户名（默认 admin）
#   --password <密码>      初始管理员密码（默认随机生成并打印）
#   --no-nginx             不生成 nginx 站点配置
#   --no-service           只安装不注册系统服务
#   --slim                 构建后删除前端 node_modules，节省磁盘
#   --skip-build           跳过前端构建（使用已有 dist 或后端托管 API 模式）
#   --noninteractive       全自动模式，不询问
#   --uninstall            调用卸载脚本
#
# 允许被 `sh deploy/install.sh` 调用（部分系统 sh 是 dash）：自动切换回 bash
if [ -z "${BASH_VERSION:-}" ]; then
  if command -v bash >/dev/null 2>&1; then
    exec bash "$0" "$@"
  fi
  echo "需要 bash 才能运行本脚本，请先安装：apt install bash / yum install bash / apk add bash" >&2
  exit 1
fi

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_SRC="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=lib/common.sh
. "${SCRIPT_DIR}/lib/common.sh"
# shellcheck source=lib/detect-os.sh
. "${SCRIPT_DIR}/lib/detect-os.sh"
# shellcheck source=lib/install-node.sh
. "${SCRIPT_DIR}/lib/install-node.sh"

# ------------------------------------------------------------------ 参数解析
DOMAIN="${DOMAIN:-_}"
PORT="${PORT:-}"
INSTALL_DIR="${INSTALL_DIR:-}"
SERVICE_NAME="${SERVICE_NAME:-team-site}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
WITH_NGINX=1
WITH_SERVICE=1
SLIM=0
SKIP_BUILD=0
NONINTERACTIVE="${NONINTERACTIVE:-0}"
JWT_SECRET="${JWT_SECRET:-}"

# 端口是否由调用方显式指定（--port / PORT=xxx）：显式指定才允许改写 .env 里的端口
PORT_EXPLICIT=0
[ -n "${PORT:-}" ] && PORT_EXPLICIT=1
PORT_FROM_ENV=0
# 更新场景标记：安装目录已有 .env 与数据库
EXISTING_INSTALL=0

while [ $# -gt 0 ]; do
  case "$1" in
    --domain) require_arg_value "$1" "${2:-}"; DOMAIN="$2"; shift 2 ;;
    --port) require_arg_value "$1" "${2:-}"; PORT="$2"; shift 2 ;;
    --dir) require_arg_value "$1" "${2:-}"; INSTALL_DIR="$2"; shift 2 ;;
    --service) require_arg_value "$1" "${2:-}"; SERVICE_NAME="$2"; shift 2 ;;
    --username) require_arg_value "$1" "${2:-}"; ADMIN_USERNAME="$2"; shift 2 ;;
    --password) require_arg_value "$1" "${2:-}"; ADMIN_PASSWORD="$2"; shift 2 ;;
    --no-nginx) WITH_NGINX=0; shift ;;
    --no-service) WITH_SERVICE=0; shift ;;
    --slim) SLIM=1; shift ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    --noninteractive|-y) NONINTERACTIVE=1; shift ;;
    --uninstall) exec bash "${SCRIPT_DIR}/uninstall.sh" "$@" ;;
    -h|--help) sed -n '2,46p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "未知参数: $1（使用 --help 查看用法）" ;;
  esac
done

# ------------------------------------------------------------------ 主流程
main() {
  banner
  require_root
  detect_os
  print_os_info

  # 远程服务器常见问题自愈：CRLF 换行、缺可执行位、挂载点 noexec
  step "检查脚本可执行性"
  ensure_script_hygiene "$PROJECT_SRC"
  chmod +x "$0" 2>/dev/null || true
  check_exec_allowed "$PROJECT_SRC" || true

  if is_baota; then
    ok "检测到宝塔面板环境，将按宝塔目录规范部署"
    # 默认装到 /www/wwwroot/<域名>，与面板「网站」列表里的站点目录保持一致：
    #   · 面板申请证书时的文件验证路径 = 站点路径 + 运行目录，目录一致才不会
    #     "文件写进去了但 URL 取不到"
    #   · 避免默认值 /www/wwwroot/team-site 与面板站点目录不是同一个，
    #     重跑一次 install.sh 就会把服务注册到另一个目录，出现"两个目录各跑一份"
    if [ -z "${INSTALL_DIR:-}" ]; then
      if [ -n "${DOMAIN:-}" ] && [ "$DOMAIN" != "_" ]; then
        INSTALL_DIR="/www/wwwroot/$DOMAIN"
      else
        INSTALL_DIR="/www/wwwroot/team-site"
      fi
    fi
    BAOTA=1
  else
    : "${INSTALL_DIR:=/opt/team-site}"
    BAOTA=0
  fi

  # 交互式确认部署参数
  if [ "$NONINTERACTIVE" != "1" ]; then
    echo
    if [ "$BAOTA" = "1" ]; then
      DOMAIN="$(prompt_default "请输入要绑定的域名（直接回车表示仅用 IP 访问）" "$([ "$DOMAIN" = "_" ] && echo "" || echo "$DOMAIN")")"
      [ -z "$DOMAIN" ] && DOMAIN="_"
    fi
    INSTALL_DIR="$(prompt_default "安装目录" "$INSTALL_DIR")"
    if [ -z "$PORT" ]; then
      PORT="$(find_free_port 8787)"
    fi
    PORT="$(prompt_default "后端监听端口" "$PORT")"
    ADMIN_PASSWORD="$(prompt_default "初始管理员密码（留空则随机生成）" "$ADMIN_PASSWORD")"
  fi

  [ -n "$PORT" ] || PORT="$(find_free_port 8787)"

  # ------------------------------------------------------------------
  # 更新场景：安装目录已有 .env 时沿用其端口。
  # 否则端口检测会把"自家服务正在监听"误判为端口被占用，导致端口漂移
  # （线上表现为：更新一次站点，端口从 8787 变成 8788，nginx 反代就断了）。
  # ------------------------------------------------------------------
  local existing_env="${INSTALL_DIR}/backend/.env"
  if [ -f "$existing_env" ] && [ -f "${INSTALL_DIR}/backend/data/team-site.db" ]; then
    EXISTING_INSTALL=1
  fi
  if [ "$PORT_EXPLICIT" = "0" ] && [ -f "$existing_env" ]; then
    local existing_port
    existing_port="$(grep -E '^PORT=' "$existing_env" 2>/dev/null | head -n1 | cut -d= -f2 | tr -d ' ' || true)"
    if [ -n "$existing_port" ]; then
      PORT="$existing_port"
      PORT_FROM_ENV=1
      log "检测到已有安装，沿用配置端口 $PORT（如需更换请显式指定 --port）"
    fi
  fi

  if [ "$PORT_FROM_ENV" = "0" ] && ! port_is_free "$PORT"; then
    warn "端口 $PORT 已被占用"
    PORT="$(find_free_port "$PORT")"
    log "自动改用端口 $PORT"
  fi
  [ -n "$ADMIN_PASSWORD" ] || ADMIN_PASSWORD="$(random_secret | cut -c1-16)"
  [ -n "$JWT_SECRET" ] || JWT_SECRET="$(random_secret)"

  install_base_deps
  ensure_node
  ensure_npm

  prepare_project
  setup_backend
  build_frontend
  setup_service
  setup_nginx
  final_checks
  print_summary
}

# ------------------------------------------------------------------ 各步骤
prepare_project() {
  step "准备项目文件 → $INSTALL_DIR"
  if [ "$(cd "$PROJECT_SRC" && pwd)" = "$(cd "$INSTALL_DIR" 2>/dev/null && pwd || echo '')" ]; then
    dim "已在目标目录中运行，跳过复制"
  else
    sync_project "$PROJECT_SRC" "$INSTALL_DIR"
    ok "项目文件已同步"
  fi
  ensure_dir "${INSTALL_DIR}/backend/data/uploads"
  ensure_dir "${INSTALL_DIR}/backend/data/uploads/thumbnails"
  ensure_dir "${INSTALL_DIR}/logs"
  ensure_dir "${INSTALL_DIR}/backups"
  chmod +x "${INSTALL_DIR}"/deploy/*.sh 2>/dev/null || true
  chmod +x "${INSTALL_DIR}"/tools/*.py 2>/dev/null || true
}

setup_backend() {
  step "配置后端环境 (backend/.env)"
  local env_file="${INSTALL_DIR}/backend/.env"
  # 计算上传上限（字节），用于 nginx client_max_body_size
  MAX_UPLOAD_SIZE="${MAX_UPLOAD_SIZE:-209715200}"

  if [ -f "$env_file" ]; then
    if [ "$EXISTING_INSTALL" = "1" ]; then
      warn "检测到已有安装，保留 .env 原有配置（仅补齐缺失项）"
    else
      warn ".env 已存在，保留原有配置（仅补齐缺失项）"
    fi
    grep -q '^JWT_SECRET=' "$env_file" || echo "JWT_SECRET=${JWT_SECRET}" >> "$env_file"
    # 仅当显式指定端口时才改写；更新场景沿用原端口，避免端口漂移
    if [ "$PORT_EXPLICIT" = "1" ] || [ "$PORT_FROM_ENV" = "0" ]; then
      if grep -q '^PORT=' "$env_file"; then
        sed -i "s|^PORT=.*|PORT=${PORT}|" "$env_file"
      else
        echo "PORT=${PORT}" >> "$env_file"
      fi
    fi
    grep -q '^ADMIN_PASSWORD=' "$env_file" || echo "ADMIN_PASSWORD=${ADMIN_PASSWORD}" >> "$env_file"
  else
    cat > "$env_file" <<EOF
# 由 deploy/install.sh 自动生成于 $(date '+%Y-%m-%d %H:%M:%S')
# 系统: ${OS_NAME}
PORT=${PORT}
HOST=127.0.0.1
NODE_ENV=production

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

# 仅在首次初始化数据库时用于创建管理员
ADMIN_USERNAME=${ADMIN_USERNAME}
ADMIN_PASSWORD=${ADMIN_PASSWORD}

DB_FILE=./data/team-site.db
UPLOAD_DIR=./data/uploads
MAX_UPLOAD_SIZE=${MAX_UPLOAD_SIZE}
ALLOWED_ORIGINS=
PUBLIC_FILE_LIST=1
TRUST_PROXY=1
EOF
  fi

  # .env 必须让「服务运行用户」读得到。
  # 这里踩过一个很隐蔽的坑：脚本以 root 运行，写出的 .env 若保持 root:root 600，
  # 而服务以 www 运行，dotenv 读不到文件会**静默回落到代码默认值**——
  # 表现为端口/上传上限不生效，最严重的是 JWT_SECRET 变成公开的默认字符串，
  # 任何人都能伪造管理员令牌。所以属主必须是运行用户，权限 600。
  local env_owner; env_owner="$(determine_run_user)"
  chown "$env_owner":"$env_owner" "$env_file" 2>/dev/null || true
  chmod 600 "$env_file"
  if [ "$(stat -c '%U' "$env_file" 2>/dev/null)" != "$env_owner" ]; then
    warn "无法把 .env 属主改为 ${env_owner}，请手动执行：chown ${env_owner}:${env_owner} ${env_file}"
  fi
  ok "已生成 ${env_file}（属主 ${env_owner}，权限 600）"

  step "安装后端依赖（无需编译原生模块）"
  ( cd "${INSTALL_DIR}/backend" && npm install --no-audit --no-fund --omit=optional --loglevel=error ) \
    || die "后端依赖安装失败（检查网络或 npm 源：npm config set registry https://registry.npmmirror.com）"

  step "初始化数据库与初始内容"
  ( cd "${INSTALL_DIR}/backend" && node scripts/init-db.js && node scripts/seed.js ) || die "数据库初始化失败"
  ok "数据库就绪"

  # 目录属主
  RUN_USER="$(determine_run_user)"
  chown -R "$RUN_USER":"$RUN_USER" "${INSTALL_DIR}/backend/data" "${INSTALL_DIR}/logs" 2>/dev/null || true
  log "运行用户: ${RUN_USER}"
}

determine_run_user() {
  if [ -n "${RUN_USER:-}" ]; then
    printf '%s' "$RUN_USER"
  elif id www >/dev/null 2>&1; then
    printf 'www'
  elif id nginx >/dev/null 2>&1; then
    printf 'nginx'
  elif id nobody >/dev/null 2>&1; then
    printf 'nobody'
  else
    printf 'root'
  fi
}

build_frontend() {
  if [ "$SKIP_BUILD" = "1" ]; then
    warn "已跳过前端构建（--skip-build）"
    return 0
  fi
  step "构建前端静态资源"
  ( cd "${INSTALL_DIR}/frontend" && npm install --no-audit --no-fund --loglevel=error ) \
    || die "前端依赖安装失败"

  if ( cd "${INSTALL_DIR}/frontend" && npm run build:only ); then
    ok "前端构建完成: ${INSTALL_DIR}/frontend/dist"
  else
    die "前端构建失败，请查看上方日志"
  fi

  if [ "$SLIM" = "1" ]; then
    rm -rf "${INSTALL_DIR}/frontend/node_modules"
    dim "已删除前端 node_modules（--slim）"
  fi
  chown -R "$(determine_run_user)":"$(determine_run_user)" "${INSTALL_DIR}/frontend/dist" 2>/dev/null || true
}

setup_service() {
  if [ "$WITH_SERVICE" != "1" ]; then
    warn "已跳过系统服务注册（--no-service），可手动启动：cd ${INSTALL_DIR}/backend && npm start"
    return 0
  fi

  step "注册后台服务（${SERVICE_NAME}）"
  local node_path; node_path="$(command -v node)"
  local run_user; run_user="$(determine_run_user)"

  case "$INIT_SYSTEM" in
    systemd)
      local unit="/etc/systemd/system/${SERVICE_NAME}.service"
      render_template "${SCRIPT_DIR}/systemd/team-site.service" "$unit" \
        "SERVICE_NAME=${SERVICE_NAME}" \
        "APP_DIR=${INSTALL_DIR}" \
        "NODE_BIN=${node_path}" \
        "PORT=${PORT}" \
        "RUN_USER=${run_user}"
      systemctl daemon-reload
      systemctl enable "${SERVICE_NAME}" >/dev/null 2>&1 || true
      systemctl restart "${SERVICE_NAME}"
      ok "systemd 服务已启动: systemctl status ${SERVICE_NAME}"
      ;;
    *)
      warn "未检测到 systemd，使用 SysV init 脚本方式"
      local initd="/etc/init.d/${SERVICE_NAME}"
      render_template "${SCRIPT_DIR}/initd/team-site" "$initd" \
        "SERVICE_NAME=${SERVICE_NAME}" \
        "APP_DIR=${INSTALL_DIR}" \
        "NODE_BIN=${node_path}" \
        "PORT=${PORT}" \
        "RUN_USER=${run_user}"
      chmod +x "$initd"
      if has_cmd rc-update; then rc-update add "$SERVICE_NAME" default >/dev/null 2>&1 || true; fi
      if has_cmd chkconfig; then chkconfig --add "$SERVICE_NAME" >/dev/null 2>&1 || true; fi
      if has_cmd update-rc.d; then update-rc.d "$SERVICE_NAME" defaults >/dev/null 2>&1 || true; fi
      "$initd" restart
      ok "初始化脚本已安装: ${initd}"
      ;;
  esac

  # 等后端起来
  local base="http://127.0.0.1:${PORT}/api/health"
  if has_cmd curl; then
    if wait_for_http "$base" 40; then
      ok "后端健康检查通过"
    else
      err "后端未在 40 秒内响应，请查看日志：journalctl -u ${SERVICE_NAME} -n 80 --no-pager"
      tail -n 30 "${INSTALL_DIR}/logs/team-site.log" 2>/dev/null || true
      exit 1
    fi
  fi
}

setup_nginx() {
  if [ "$WITH_NGINX" != "1" ]; then
    warn "已跳过 nginx 配置（--no-nginx）"
    return 0
  fi
  if ! have_nginx; then
    warn "未检测到 nginx，跳过站点配置。"
    dim "如需自动配置，请先安装 nginx（宝塔面板 → 软件商店 → Nginx），然后重新运行：bash deploy/install.sh --no-service"
    return 0
  fi

  step "生成 nginx 站点配置"
  local conf_dir conf_name
  conf_dir="$(nginx_conf_dir)"
  ensure_dir "$conf_dir"
  conf_name="${SERVICE_NAME}.conf"
  [ "$DOMAIN" != "_" ] && conf_name="${DOMAIN}.conf"

  local body_limit_mb=$(( MAX_UPLOAD_SIZE / 1024 / 1024 + 1 ))
  local target="${conf_dir}/${conf_name}"

  # ------------------------------------------------------------------
  # 宝塔面板兼容：面板给站点加 SSL / 改伪静态时，会在 vhost 里找锚点注释
  # （#SSL-START、#error_page 404/404.html;、#REWRITE-START…），并根据
  # #REWRITE-START 段里的 include 写入伪静态规则。因此需要：
  #   1) 模板中保留这些锚点（见 deploy/nginx/team-site.conf）
  #   2) 预先创建 include 指向的伪静态文件，否则 nginx -t 会因文件不存在而失败
  # ------------------------------------------------------------------
  local rewrite_include="    # 未绑定域名，跳过宝塔伪静态引用"
  if [ "$DOMAIN" != "_" ]; then
    if [ -d /www/server/panel/vhost ] || [ "${BAOTA:-0}" = "1" ]; then
      local rewrite_dir="/www/server/panel/vhost/rewrite"
      ensure_dir "$rewrite_dir"
      if [ ! -f "${rewrite_dir}/${DOMAIN}.conf" ]; then
        printf '# 由 deploy/install.sh 创建：宝塔面板「伪静态」写入此处\n# 本站为前端 SPA，路由回退已在 vhost 中通过 try_files 处理\n' \
          > "${rewrite_dir}/${DOMAIN}.conf"
        dim "已创建宝塔伪静态文件: ${rewrite_dir}/${DOMAIN}.conf"
      fi
      rewrite_include="    include ${rewrite_dir}/${DOMAIN}.conf;"
    else
      rewrite_include="    # 非宝塔环境，跳过伪静态引用"
    fi
  fi

  cp "${SCRIPT_DIR}/nginx/team-site.conf" "$target"
  sed -i \
    -e "s|__DOMAIN__|${DOMAIN}|g" \
    -e "s|__ROOT__|${INSTALL_DIR}/frontend/dist|g" \
    -e "s|__PORT__|${PORT}|g" \
    -e "s|__UPLOAD_DIR__|${INSTALL_DIR}/backend/data/uploads|g" \
    -e "s|__CLIENT_MAX_BODY__|${body_limit_mb}m|g" \
    -e "s|__SERVICE_NAME__|${SERVICE_NAME}|g" \
    -e "s|__REWRITE_INCLUDE__|${rewrite_include}|g" \
    "$target"
  # 模板必须包含宝塔锚点，否则面板申请 SSL 会报「未找到标识信息」
  if ! grep -qF '#error_page 404/404.html;' "$target"; then
    warn "配置缺少宝塔 SSL 锚点，可用 deploy/fix-bt-anchors.sh --domain ${DOMAIN} 修复"
  fi
  chmod 644 "$target"
  ok "配置文件: ${target}"

  # 语法检查
  local bin; bin="$(nginx_bin)"
  if [ -x "$bin" ] && ! "$bin" -t >/dev/null 2>&1; then
    err "nginx 配置校验失败，已回滚"
    "$bin" -t || true
    rm -f "$target"
    return 1
  fi

  if reload_nginx; then
    ok "nginx 已重载"
  else
    warn "nginx 重载失败，请手动执行：nginx -s reload 或 systemctl reload nginx"
  fi

  if [ "$BAOTA" = "1" ]; then
    dim "若需要在宝塔面板中看到该站点，请在「网站」中确认站点记录（本脚本写入的是 ${conf_dir} 下的 vhost 配置）"
  fi
}

final_checks() {
  step "部署结果自检"
  local python_bin=""
  has_cmd python3 && python_bin="python3"
  if [ -n "$python_bin" ] && [ -f "${INSTALL_DIR}/tools/healthcheck.py" ]; then
    ( cd "$INSTALL_DIR" && "$python_bin" tools/healthcheck.py ) || warn "自检存在异常项，请按提示排查"
  fi

  # 上传目录可写性
  local probe="${INSTALL_DIR}/backend/data/uploads/.write-test"
  if touch "$probe" 2>/dev/null; then rm -f "$probe"; dim "上传目录可写"; else warn "上传目录不可写，请检查权限"; fi
}

print_summary() {
  local run_user; run_user="$(determine_run_user)"
  local access
  if [ "$DOMAIN" != "_" ]; then
    access="http://${DOMAIN}/"
  else
    access="http://$(hostname -I 2>/dev/null | awk '{print $1}'):${PORT}/"
  fi

  printf '\n%b\n' "${C_GREEN}${C_BOLD}🎉 部署完成${C_RESET}"
  cat <<EOF

  前台首页   : ${access}
  后台入口   : ${access}admin/login
  API 健康检查: http://127.0.0.1:${PORT}/api/health

  后台账号   : ${ADMIN_USERNAME}
  后台密码   : ${ADMIN_PASSWORD}
  （登录后请立即在「后台 → 站点设置」中修改密码）

  安装目录   : ${INSTALL_DIR}
  运行用户   : ${run_user}
  后端端口   : ${PORT}
  数据库     : ${INSTALL_DIR}/backend/data/team-site.db
  上传目录   : ${INSTALL_DIR}/backend/data/uploads
  日志       : ${INSTALL_DIR}/logs/team-site.log

EOF

  if [ "$INIT_SYSTEM" = "systemd" ] && [ "$WITH_SERVICE" = "1" ]; then
    cat <<EOF
  常用命令：
    systemctl status ${SERVICE_NAME}      # 查看状态
    systemctl restart ${SERVICE_NAME}     # 重启
    systemctl stop ${SERVICE_NAME}        # 停止
    journalctl -u ${SERVICE_NAME} -f      # 实时日志

EOF
  fi

  cat <<EOF
  运维工具（Python，无需 pip 安装）：
    python3 tools/healthcheck.py                 # 健康检查
    python3 tools/backup.py --keep 14 --json     # 备份数据库与上传文件
    python3 tools/upload_files.py ./releases      # 批量上传文件
    python3 tools/import_legacy.py <内容.json>    # 导入旧站内容

  更新站点：bash deploy/update.sh
  卸载站点：bash deploy/uninstall.sh

EOF

  if [ "$BAOTA" = "1" ]; then
    cat <<EOF
  宝塔面板后续操作建议：
    1) 网站 → 找到该站点 → 设置 → SSL → Let's Encrypt 申请证书并开启「强制 HTTPS」
    2) 安全 → 放行 ${PORT} 端口（若需直接访问后端）或仅保留 80/443
    3) 计划任务 → 添加 Shell 脚本：
         cd ${INSTALL_DIR} && /usr/bin/python3 tools/backup.py --keep 14

EOF
  fi
  printf '%b\n' "${C_DIM}提示：JWT_SECRET 已随机生成并写入 backend/.env（权限 600）。${C_RESET}"
}

main "$@"
