#!/usr/bin/env bash
#
# 宝塔面板 SSL 锚点修复工具
#
# 解决面板报错：站点配置文件中未找到标识信息【#error_page 404/404.html;】，
# 无法确定 SSL 配置添加位置。
#
# 原因：宝塔面板给站点加 SSL 时，会在 vhost 配置里查找它约定的锚点注释
#       （#SSL-START / #error_page 404/404.html; / #ERROR-PAGE-START / #REWRITE-START …）
#       并据此插入 SSL 指令。如果 vhost 是自定义模板（例如本项目的 nginx 模板）
#       且没有这些锚点，面板就会报上述错误。
#
# 本脚本会：备份 → 幂等补齐锚点（含 .well-known 验证目录与伪静态引用）→ nginx -t
#          → 校验失败自动回滚 → 重载 nginx
#
# 用法：
#   bash deploy/fix-bt-anchors.sh --domain team.qlm.org.cn      # 按域名修复（推荐）
#   bash deploy/fix-bt-anchors.sh --file /www/server/panel/vhost/nginx/xxx.conf
#   bash deploy/fix-bt-anchors.sh --root /www/wwwroot/team-site  # 按站点根目录自动匹配
#   bash deploy/fix-bt-anchors.sh --check                       # 只体检，不改动
#   bash deploy/fix-bt-anchors.sh --domain x.com --dry-run       # 只打印将要插入的内容
#
set -o pipefail

if [ -z "${BASH_VERSION:-}" ]; then
  if command -v bash >/dev/null 2>&1; then exec bash "$0" "$@"; fi
  echo "需要 bash 才能运行本脚本" >&2; exit 1
fi

VHOST_DIR="/www/server/panel/vhost/nginx"
REWRITE_DIR="/www/server/panel/vhost/rewrite"
DOMAIN=""
TARGET_FILE=""
ROOT_DIR=""
CHECK_ONLY=0
DRY_RUN=0

log()  { printf '\033[34m[信息]\033[0m %s\n' "$*"; }
ok()   { printf '\033[32m[成功]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[警告]\033[0m %s\n' "$*"; }
err()  { printf '\033[31m[错误]\033[0m %s\n' "$*" >&2; }
die()  { err "$*"; exit 1; }
step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --domain) [ -n "${2:-}" ] || die "--domain 缺少取值"; DOMAIN="$2"; shift 2 ;;
    --file)   [ -n "${2:-}" ] || die "--file 缺少取值"; TARGET_FILE="$2"; shift 2 ;;
    --root)   [ -n "${2:-}" ] || die "--root 缺少取值"; ROOT_DIR="$2"; shift 2 ;;
    --check)  CHECK_ONLY=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) sed -n '2,28p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "未知参数: $1（--help 查看用法）" ;;
  esac
done

[ "$(id -u)" -eq 0 ] || die "请用 root 运行（宝塔终端默认就是 root）"
[ -d "$VHOST_DIR" ] || die "未找到宝塔 vhost 目录：$VHOST_DIR"

nginx_bin() {
  if [ -x /www/server/nginx/sbin/nginx ]; then printf '%s' /www/server/nginx/sbin/nginx
  else command -v nginx; fi
}

reload_nginx() {
  local bin; bin="$(nginx_bin)"
  if [ -x /etc/init.d/nginx ]; then /etc/init.d/nginx reload >/dev/null 2>&1 && return 0; fi
  if command -v systemctl >/dev/null 2>&1; then systemctl reload nginx >/dev/null 2>&1 && return 0; fi
  [ -x "$bin" ] && "$bin" -s reload >/dev/null 2>&1 && return 0
  return 1
}

resolve_target() {
  if [ -n "$TARGET_FILE" ]; then
    [ -f "$TARGET_FILE" ] || die "文件不存在：$TARGET_FILE"
    printf '%s' "$TARGET_FILE"; return
  fi
  if [ -n "$DOMAIN" ]; then
    local f="$VHOST_DIR/${DOMAIN}.conf"
    [ -f "$f" ] || die "未找到配置：$f（请在面板确认站点域名）"
    printf '%s' "$f"; return
  fi
  if [ -n "$ROOT_DIR" ]; then
    local found
    found="$(grep -rl "root[[:space:]]\+${ROOT_DIR}" "$VHOST_DIR" 2>/dev/null | head -n1)"
    [ -n "$found" ] || die "未找到 root 指向 $ROOT_DIR 的 vhost"
    printf '%s' "$found"; return
  fi
  die "请指定 --domain 或 --file 或 --root（--help 查看用法）"
}

# 锚点状态检查：返回缺失项数量（0 = 齐全）
check_anchors() {
  local f="$1" missing=0
  for pat in '#SSL-START' '#error_page 404/404.html;' '#SSL-END' '#ERROR-PAGE-START' '#REWRITE-START' '#REWRITE-END' 'location ~ \.well-known'; do
    if grep -qF "$pat" "$f"; then
      printf '  %-34s 有\n' "$pat"
    else
      printf '  %-34s 缺失\n' "$pat"
      missing=$((missing + 1))
    fi
  done
  return "$missing"
}

TARGET="$(resolve_target)"
DOMAIN_NAME="$(basename "$TARGET" .conf)"

step "目标配置：$TARGET"
step "锚点现状"
if check_anchors "$TARGET"; then
  ok "锚点齐全，无需修复"
  exit 0
fi
warn "存在缺失锚点（这就是面板报错的原因）"
[ "$CHECK_ONLY" = "1" ] && exit 1

grep -qE '^[[:space:]]*server[[:space:]]*\{' "$TARGET" || die "该文件里没有 server 块，不是站点配置？"

# ---------------------------------------------------------------- 组装插入块
# 全部锚点一次性插在 server 块内第一条 root/index 指令之后：
# 该位置一定位于 server 层级，避免"插到 server 外"导致 nginx 报
# "location directive is not allowed here"。
REWRITE_FILE="$REWRITE_DIR/${DOMAIN_NAME}.conf"
BLOCK="$(mktemp)"
trap 'rm -f "$BLOCK"' EXIT

{
  grep -qF '#SSL-START' "$TARGET" || cat <<'EOF'
    #SSL-START SSL相关配置，请勿删除或修改下一行带注释的404规则
    #error_page 404/404.html;
    #SSL-END
EOF
  grep -qF '#ERROR-PAGE-START' "$TARGET" || cat <<'EOF'

    #ERROR-PAGE-START 错误页配置，可以注释、删除或修改
    #error_page 404 /404.html;
    #ERROR-PAGE-END
EOF
  grep -qF '#PHP-INFO-START' "$TARGET" || cat <<'EOF'

    #PHP-INFO-START PHP引用配置，可以注释或修改
    #PHP-INFO-END
EOF
  if ! grep -qF '#REWRITE-START' "$TARGET"; then
    cat <<EOF

    #REWRITE-START URL重写规则引用，修改后将导致面板设置的伪静态规则失效
    include ${REWRITE_FILE};
    #REWRITE-END
EOF
  fi
  if ! grep -qF 'location ~ \.well-known' "$TARGET"; then
    cat <<'EOF'

    #一键申请SSL证书验证目录相关设置（宝塔申请 Let's Encrypt 时使用）
    location ~ \.well-known {
        allow all;
    }
EOF
  fi
} > "$BLOCK"

if [ ! -s "$BLOCK" ]; then
  ok "没有需要补的内容"
  exit 0
fi

step "将要插入的内容"
sed 's/^/    + /' "$BLOCK"

if [ "$DRY_RUN" = "1" ]; then
  step "dry-run 结束（未写盘）"
  exit 0
fi

# 伪静态文件必须先存在，否则 include 会让 nginx -t 失败
if [ ! -f "$REWRITE_FILE" ]; then
  mkdir -p "$REWRITE_DIR"
  printf '# 由 deploy/fix-bt-anchors.sh 创建：宝塔面板「伪静态」规则写在这里\n# 本站为前端 SPA，路由回退已在 vhost 中通过 try_files 处理\n' > "$REWRITE_FILE"
  ok "已创建伪静态文件：$REWRITE_FILE"
fi

step "备份原配置"
BACKUP="${TARGET}.bak.$(date +%Y%m%d%H%M%S)"
cp -p "$TARGET" "$BACKUP"
ok "已备份：$BACKUP"

step "写入"
TMP_OUT="$(mktemp)"
awk -v blockfile="$BLOCK" '
  BEGIN {
    while ((getline line < blockfile) > 0) block = block line "\n"
    close(blockfile)
    inserted = 0; in_server = 0
  }
  {
    print
    if (!in_server && $0 ~ /^[[:space:]]*server[[:space:]]*\{/) in_server = 1
  }
  in_server && !inserted && $0 ~ /^[[:space:]]*(root|index)[[:space:]]/ {
    printf "%s", block
    inserted = 1
  }
  END {
    if (!inserted) exit 3
  }
' "$TARGET" > "$TMP_OUT"

if [ $? -ne 0 ]; then
  rm -f "$TMP_OUT"
  die "未找到插入位置（server 块内没有 root/index 指令），原配置未改动"
fi

if ! grep -qF '#error_page 404/404.html;' "$TMP_OUT"; then
  rm -f "$TMP_OUT"
  die "插入结果校验失败，原配置未改动"
fi

cp "$TMP_OUT" "$TARGET"
rm -f "$TMP_OUT"

BIN="$(nginx_bin)"
if [ -x "$BIN" ] && ! "$BIN" -t >/dev/null 2>&1; then
  err "nginx 配置校验失败，正在回滚"
  "$BIN" -t || true
  cp -p "$BACKUP" "$TARGET"
  "$BIN" -t >/dev/null 2>&1 && warn "已回滚到修复前状态"
  exit 1
fi
ok "nginx 配置校验通过"

if reload_nginx; then
  ok "nginx 已重载"
else
  warn "自动重载失败，请手动执行：nginx -s reload 或 systemctl reload nginx"
fi

step "修复结果"
check_anchors "$TARGET" || true
if check_anchors "$TARGET" >/dev/null 2>&1; then
  ok "全部锚点已就位，现在可以在宝塔面板给该站点申请/部署 SSL 了"
else
  warn "仍有缺失项，请查看上方列表"
fi

cat <<EOF

下一步（宝塔面板）：
  1) 网站 → ${DOMAIN_NAME} → 设置 → SSL → Let's Encrypt，勾选域名后申请
  2) 申请成功后开启「强制 HTTPS」
  3) 若之前面板提示过错误，刷新页面再操作一次即可

回滚方式（如需）：
  cp -p ${BACKUP} ${TARGET} && nginx -t && nginx -s reload
EOF
