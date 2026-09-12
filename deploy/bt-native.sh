#!/usr/bin/env bash
#
# 宝塔面板「原生接法」部署脚本
#
# 为什么需要它：
#   直接把自定义 nginx 模板写进 /www/server/panel/vhost/nginx/<域名>.conf 会带来两个问题：
#     1) 面板申请 SSL 时报「未找到标识信息【#error_page 404/404.html;】」——缺少面板锚点
#     2) 补上锚点后仍可能报「配置文件被修改不支持文件验证」——面板还要求：
#        · 站点配置里存在 location ~ \.well-known{ ... }（或在 #error_page 404/404.html; 之前
#          include 面板的 well-known/<域名>.conf）
#        · 证书验证文件写入位置（站点路径 + 运行目录）与 nginx root 一致
#
#   正确做法是「站点配置交回宝塔，业务规则放进宝塔官方扩展目录」：
#     /www/server/panel/vhost/nginx/<域名>.conf                       ← 宝塔标准结构（含锚点）
#     /www/server/panel/vhost/nginx/extension/<域名>/10-qlm-node-site.conf  ← 我们的代理/SPA/限流规则
#     /www/server/panel/vhost/nginx/0.qlm-anticc.conf                 ← http 级限流区（limit_req/limit_conn）
#
# 用法：
#   bash deploy/bt-native.sh --domain team.qlm.org.cn --app-dir /www/wwwroot/team-site
#   bash deploy/bt-native.sh --domain x.com --app-dir /www/wwwroot/x --port 8787
#   bash deploy/bt-native.sh --domain x.com --check          # 只体检（含面板自身检查）
#   bash deploy/bt-native.sh --domain x.com --no-align-path  # 不改动面板站点路径/运行目录
#
set -o pipefail

if [ -z "${BASH_VERSION:-}" ]; then
  command -v bash >/dev/null 2>&1 && exec bash "$0" "$@" || { echo "需要 bash" >&2; exit 1; }
fi

PANEL_DIR="/www/server/panel"
VHOST_DIR="$PANEL_DIR/vhost/nginx"
EXT_BASE="$VHOST_DIR/extension"
REWRITE_DIR="$PANEL_DIR/vhost/rewrite"
ZONE_FILE="$VHOST_DIR/0.qlm-anticc.conf"
DOMAIN=""
APP_DIR=""
PORT="8787"
ALIGN_PATH=1
CHECK_ONLY=0
STAMP="$(date +%Y%m%d%H%M%S)"

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
log()  { printf '\033[34m[信息]\033[0m %s\n' "$*"; }
ok()   { printf '\033[32m[成功]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[警告]\033[0m %s\n' "$*"; }
err()  { printf '\033[31m[错误]\033[0m %s\n' "$*" >&2; }
die()  { err "$*"; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --domain)  [ -n "${2:-}" ] || die "--domain 缺少取值"; DOMAIN="$2"; shift 2 ;;
    --app-dir) [ -n "${2:-}" ] || die "--app-dir 缺少取值"; APP_DIR="$2"; shift 2 ;;
    --port)    [ -n "${2:-}" ] || die "--port 缺少取值"; PORT="$2"; shift 2 ;;
    --no-align-path) ALIGN_PATH=0; shift ;;
    --check)   CHECK_ONLY=1; shift ;;
    -h|--help) sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "未知参数: $1（--help 查看用法）" ;;
  esac
done

[ "$(id -u)" -eq 0 ] || die "请用 root 运行（宝塔终端默认就是 root）"
[ -d "$PANEL_DIR" ] || die "未检测到宝塔面板：$PANEL_DIR"
[ -n "$DOMAIN" ] || die "必须指定 --domain（例如 --domain team.qlm.org.cn）"
: "${APP_DIR:=/www/wwwroot/$DOMAIN}"

CONF="$VHOST_DIR/$DOMAIN.conf"
EXT_DIR="$EXT_BASE/$DOMAIN"
EXT_FILE="$EXT_DIR/10-qlm-node-site.conf"
DIST_DIR="$APP_DIR/frontend/dist"
UPLOAD_DIR="$APP_DIR/backend/data/uploads"
REWRITE_FILE="$REWRITE_DIR/$DOMAIN.conf"
BT_PY="$PANEL_DIR/pyenv/bin/python3"

nginx_bin() {
  if [ -x /www/server/nginx/sbin/nginx ]; then printf '%s' /www/server/nginx/sbin/nginx
  else command -v nginx; fi
}

reload_nginx() {
  if [ -x /etc/init.d/nginx ]; then /etc/init.d/nginx reload >/dev/null 2>&1 && return 0; fi
  if command -v systemctl >/dev/null 2>&1; then systemctl reload nginx >/dev/null 2>&1 && return 0; fi
  local bin; bin="$(nginx_bin)"; [ -x "$bin" ] && "$bin" -s reload >/dev/null 2>&1
}

# ---------------------------------------------------------------- 体检
bt_checks() {
  [ -x "$BT_PY" ] || { warn "未找到宝塔 Python（$BT_PY），跳过面板检查"; return 1; }
  ( cd "$PANEL_DIR" && "$BT_PY" - "$DOMAIN" <<'PY' 2>/dev/null
import sys
sys.path.insert(0, '/www/server/panel')
sys.path.insert(0, '/www/server/panel/class')
import public
from acme_v2 import acme_v2
domain = sys.argv[1]
site = public.M('sites').where('name=?', (domain,)).find()
if not site:
    print("  未找到面板站点记录:", domain)
    raise SystemExit(0)
site = dict(site)
name, ptype = site['name'], site.get('project_type') or 'PHP'
base = bool(acme_v2.can_use_base_file_check(name, ptype))
cond = bool(acme_v2.can_use_if_for_file_check(name, ptype))
print("  站点路径 :", site.get('path'))
print("  站点类型 :", ptype)
print("  基础文件验证 :", "可用" if base else "不可用")
print("  if 文件验证  :", "可用" if cond else "不可用")
print("  PANEL_CHECK_RESULT:", "OK" if (base or cond) else "FAIL")
PY
  ) | tee /tmp/bt-check.log
  grep -q 'PANEL_CHECK_RESULT: OK' /tmp/bt-check.log
}

check_state() {
  step "当前状态体检"
  local problems=0
  [ -f "$CONF" ] && echo "  站点配置     : $CONF" || { echo "  站点配置     : 缺失"; problems=$((problems+1)); }
  grep -qF '#error_page 404/404.html;' "$CONF" 2>/dev/null && echo "  SSL 锚点     : 有" || { echo "  SSL 锚点     : 缺失"; problems=$((problems+1)); }
  grep -qE 'location[[:space:]]+([=~^]*[[:space:]]*)?/?\\?\.well-known[[:space:]]*\{' "$CONF" 2>/dev/null \
    && echo "  .well-known  : 有" || { echo "  .well-known  : 缺失"; problems=$((problems+1)); }
  [ -f "$EXT_FILE" ] && echo "  扩展规则     : 有" || { echo "  扩展规则     : 缺失"; problems=$((problems+1)); }
  [ -f "$ZONE_FILE" ] && echo "  限流区文件   : 有" || { echo "  限流区文件   : 缺失"; problems=$((problems+1)); }
  [ -d "$DIST_DIR" ] && echo "  前端产物     : 有（$DIST_DIR）" || { echo "  前端产物     : 缺失"; problems=$((problems+1)); }
  echo
  bt_checks || problems=$((problems+1))
  echo
  if [ "$problems" -eq 0 ]; then ok "状态正常"; else warn "存在 $problems 项待处理"; fi
  return "$problems"
}

if [ "$CHECK_ONLY" = "1" ]; then
  check_state && exit 0 || exit 1
fi

check_state || true

# ---------------------------------------------------------------- 写入
step "备份现有文件"
BACKUP_LIST=()
for f in "$CONF" "$EXT_FILE" "$ZONE_FILE"; do
  if [ -f "$f" ]; then
    cp -p "$f" "$f.bak.$STAMP"
    BACKUP_LIST+=("$f:$f.bak.$STAMP")
    log "已备份 $f"
  fi
done

mkdir -p "$EXT_DIR" "$REWRITE_DIR"
[ -f "$DIST_DIR/index.html" ] || warn "未找到 $DIST_DIR/index.html，请确认前端已构建"

# 宝塔伪静态文件（#REWRITE-START 段 include 指向它，缺了会让 nginx -t 失败）
if [ ! -f "$REWRITE_FILE" ]; then
  printf '# 由 deploy/bt-native.sh 创建：面板「伪静态」规则写在这里\n# 本站为前端 SPA，路由回退由扩展目录中的规则处理\n' > "$REWRITE_FILE"
  ok "已创建伪静态文件：$REWRITE_FILE"
fi

step "1/3 写入宝塔标准结构的站点配置（含锚点）"
cat > "$CONF" <<EOF
server
{
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    index index.html index.htm default.html default.htm;
    root $DIST_DIR;

    include $VHOST_DIR/well-known/$DOMAIN.conf;
    include $EXT_BASE/$DOMAIN/*.conf;

    #SSL-START SSL相关配置，请勿删除或修改下一行带注释的404规则
    #error_page 404/404.html;
    #SSL-END

    #ERROR-PAGE-START 错误页配置，可以注释、删除或修改
    #error_page 404 /404.html;
    #ERROR-PAGE-END

    #PHP-INFO-START PHP引用配置，可以注释或修改
    #PHP-INFO-END

    #REWRITE-START URL重写规则引用,修改后将导致面板设置的伪静态规则失效
    include $REWRITE_FILE;
    #REWRITE-END

    access_log /www/wwwlogs/$DOMAIN.log;
    error_log /www/wwwlogs/$DOMAIN.error.log;

    #禁止访问的文件或目录
    location ~* (\.user\.ini|\.htaccess|\.env.*|\.project|\.bashrc|\.DS_Store|\.gitignore|\.gitattributes|LICENSE|README\.md|composer\.json|composer\.lock|package(-lock)?\.json|yarn\.lock|pnpm-lock\.yaml|\.swp|\.bak(up)?|\.old|\.tmp|\.log|\.sql(\.gz)?|docker-compose\.yml|Dockerfile|requirements\.txt)\$
    {
        return 404;
    }
    location ~* /(\.git|\.svn|\.hg|\.vscode|\.idea|\.ssh|\.github|\.npm|\.yarn|\.cache|node_modules|runtime)/ {
        return 404;
    }

    #一键申请SSL证书验证目录相关设置
    location ~ \.well-known{
        allow all;
    }
    if ( \$uri ~ "^/\.well-known/.*\.(php|jsp|py|js|css|lua|ts|go|zip|tar\.gz|rar|7z|sql|bak)\$" ) {
        return 403;
    }
}
EOF
ok "站点配置已写入（root=$DIST_DIR）"

step "2/3 写入扩展规则（Node 代理 / SPA / 上传目录 / 限流）"
cat > "$EXT_FILE" <<EOF
# 七零喵团队站点 · Node 站点规则（宝塔扩展目录，站点配置保持宝塔原生）
# 由 deploy/bt-native.sh 生成，可重复执行
# 注意：不要在此写 root（与站点配置重复会导致 nginx 报 "root directive is duplicate"）

add_header X-Content-Type-Options nosniff always;
add_header X-Frame-Options SAMEORIGIN always;
add_header Referrer-Policy strict-origin-when-cross-origin always;

client_max_body_size 201m;
client_body_timeout 300s;
send_timeout 300s;

gzip on;
gzip_min_length 1k;
gzip_comp_level 5;
gzip_types text/plain text/css application/json application/javascript application/xml image/svg+xml;
gzip_vary on;

# ---------- 后端 API ----------
location /api/ {
    proxy_pass http://127.0.0.1:$PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "";
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    proxy_request_buffering off;

    # API 额外收紧：单 IP 并发 10、速率 10r/s（突发 20）
    limit_conn qlm_api_conn 10;
    limit_req zone=qlm_req burst=20 nodelay;
}

# ---------- 上传文件（脚本类一律拒绝执行） ----------
location /uploads/ {
    alias $UPLOAD_DIR/;
    autoindex off;
    location ~* \.(php|php[0-9]|phtml|phar|jsp|jspx|asp|aspx|ashx|cgi|pl|py|rb|sh|lua)\$ { deny all; }
    location ~* /\. { deny all; }
}

# ---------- 静态资源 ----------
location /assets/ {
    expires 30d;
    add_header Cache-Control "public, immutable";
    try_files \$uri =404;
}
location ~* \.(?:png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot)\$ {
    expires 7d;
    add_header Cache-Control "public";
    try_files \$uri =404;
}

# ---------- 源码目录 ----------
location ~* ^/(backend|deploy|tools|docs|scripts|node_modules)/ { deny all; }

# ---------- SPA 回退（本站唯一 location /）----------
location / {
    try_files \$uri \$uri/ /index.html;
}

# ---------- 全站防 CC（单 IP 并发 20、速率 15r/s 突发 30）----------
limit_conn qlm_conn 20;
limit_req zone=qlm_req burst=30 nodelay;

# ---------- 限流/繁忙时的 JSON 响应 ----------
location @too_many_requests {
    default_type application/json;
    add_header Retry-After 10 always;
    add_header X-CC-Protection nginx always;
    return 429 '{"success":false,"message":"请求过于频繁，请稍后重试","retryAfter":10}';
}
location @server_busy {
    default_type application/json;
    add_header Retry-After 5 always;
    add_header X-CC-Protection nginx always;
    return 503 '{"success":false,"message":"服务器繁忙，请稍后重试","retryAfter":5}';
}
EOF
ok "扩展规则已写入：$EXT_FILE"

step "3/3 写入 http 级防 CC 限流区"
cat > "$ZONE_FILE" <<'EOF'
# 七零喵团队站点 · 防 CC 限流区（http 级，由 deploy/bt-native.sh 生成）
# 站点内通过 limit_req zone=qlm_req / limit_conn qlm_conn / qlm_api_conn 使用
# 注意：这些指令只能在 http 上下文声明一次，站点配置里不要重复声明
limit_req_zone $binary_remote_addr zone=qlm_req:10m rate=15r/s;
limit_conn_zone $binary_remote_addr zone=qlm_conn:10m;
limit_conn_zone $binary_remote_addr zone=qlm_api_conn:10m;
limit_req_status 429;
limit_conn_status 429;
limit_req_log_level warn;
limit_conn_log_level warn;
recursive_error_pages off;
error_page 429 = @too_many_requests;
error_page 503 = @server_busy;
EOF
ok "限流区已写入：$ZONE_FILE"

# ---------------------------------------------------------------- 校验
step "校验并重载 nginx"
BIN="$(nginx_bin)"
if [ -x "$BIN" ] && ! "$BIN" -t >/tmp/bt-native-ngt.log 2>&1; then
  cat /tmp/bt-native-ngt.log
  err "nginx 配置校验失败，正在回滚"
  for pair in "${BACKUP_LIST[@]}"; do
    cp -p "${pair#*:}" "${pair%%:*}"
  done
  "$BIN" -t >/dev/null 2>&1 && warn "已回滚到修改前状态"
  exit 1
fi
tail -1 /tmp/bt-native-ngt.log 2>/dev/null
reload_nginx && ok "nginx 已重载" || warn "自动重载失败，请手动 nginx -s reload"

# ---------------------------------------------------------------- 对齐站点路径（文件验证关键）
if [ "$ALIGN_PATH" = "1" ] && [ -x "$BT_PY" ]; then
  step "对齐面板站点路径与运行目录（保证证书文件验证可用）"
  ( cd "$PANEL_DIR" && "$BT_PY" - "$DOMAIN" "$APP_DIR" "$DIST_DIR" <<'PY' 2>&1 | tail -8
import sys
sys.path.insert(0, '/www/server/panel')
sys.path.insert(0, '/www/server/panel/class')
import public
import panelSite

domain, app_dir, dist_dir = sys.argv[1], sys.argv[2], sys.argv[3]
site = public.M('sites').where('name=?', (domain,)).find()
if not site:
    print("  未找到站点记录，跳过（可先在面板创建站点）")
    raise SystemExit(0)
site = dict(site)
sid = str(site['id'])
p = panelSite.panelSite()
path = site.get('path') or ''
if path.rstrip('/') != app_dir.rstrip('/'):
    print("  SetPath:", p.SetPath(public.to_dict_obj({'id': sid, 'path': app_dir})))
run_path = dist_dir[len(app_dir):] if dist_dir.startswith(app_dir) else '/' + dist_dir.lstrip('/')
if p.GetRunPath(public.to_dict_obj({'id': sid})) != run_path:
    print("  SetSiteRunPath:", p.SetSiteRunPath(public.to_dict_obj({'id': sid, 'runPath': run_path})))
print("  站点路径:", public.M('sites').where('id=?', (sid,)).getField('path'))
print("  运行目录:", p.GetRunPath(public.to_dict_obj({'id': sid})))
PY
  ) || warn "路径对齐失败，可手动在面板「网站 → 设置 → 网站目录/运行目录」中设置"
  reload_nginx >/dev/null 2>&1 || true
fi

# ---------------------------------------------------------------- 验证
step "功能验证"
PY_CHECK=""
if command -v python3 >/dev/null 2>&1; then PY_CHECK="python3"; fi
code_of() { curl -s -o /dev/null -w '%{http_code}' -H "Host: $DOMAIN" "http://127.0.0.1$1"; }
echo "  首页            : $(code_of /)"
echo "  SPA 深链接      : $(code_of /admin/login)"
echo -n "  API 健康检查    : "; curl -s -H "Host: $DOMAIN" http://127.0.0.1/api/health | head -c 120; echo
echo "  源码目录保护    : $(code_of /backend/src/server.js)"

# 文件验证往返测试：写入 token → 请求 → 清理
TOKEN="qlm-native-$STAMP"
mkdir -p "$DIST_DIR/.well-known/acme-challenge"
echo "acme-token-$STAMP" > "$DIST_DIR/.well-known/acme-challenge/$TOKEN"
SERVED="$(curl -s -H "Host: $DOMAIN" "http://127.0.0.1/.well-known/acme-challenge/$TOKEN")"
rm -rf "$DIST_DIR/.well-known"
if [ "$SERVED" = "acme-token-$STAMP" ]; then
  ok "证书文件验证往返正常（写入 token 能被 nginx 正确返回）"
else
  warn "证书文件验证往返异常（返回：$SERVED），请检查 root 与站点路径/运行目录是否一致"
fi

step "面板自身检查（决定能否用「文件验证」申请证书）"
if bt_checks; then
  ok "面板「文件验证」可用 —— 现在可以在 网站 → 该站点 → SSL 中申请证书"
else
  warn "面板检查未通过：请确认站点路径/运行目录与 nginx root 一致（见上方输出）"
fi

cat <<EOF

下一步（宝塔面板）：
  1) 网站 → $DOMAIN → 设置 → SSL → Let's Encrypt → 勾选域名 → 申请证书
  2) 申请成功后开启「强制 HTTPS」

回滚（如需）：
$(for pair in "${BACKUP_LIST[@]}"; do echo "  cp -p ${pair#*:} ${pair%%:*}"; done)
  然后 nginx -t && nginx -s reload

EOF
