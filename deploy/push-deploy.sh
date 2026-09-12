#!/usr/bin/env bash
#
# 发布包部署：把上传到服务器的 tar.gz 覆盖到安装目录并完成更新
#
# 典型用法（本地打包 → 上传 → 服务器执行本脚本）：
#   # 本地
#   node scripts/pack-release.mjs
#   scp release/team-site-1.0.0.tar.gz root@<服务器>:/tmp/
#
#   # 服务器
#   bash /www/wwwroot/<域名>/deploy/push-deploy.sh /tmp/team-site-1.0.0.tar.gz
#
# 参数：
#   <包路径>          必填，.tar.gz / .tgz
#   --skip-build      只更新后端，不重建前端
#   --slim            构建后清理前端 node_modules
#   --yes             非交互（默认就是）
#   --dry-run         只校验并列出将被覆盖的文件，不落盘、不重启
#
# 安全设计：
#   · 解压时强制排除 backend/.env 与 backend/data/* —— 运行配置与数据库/上传文件
#     永远以服务器上的为准，避免本地配置（端口、JWT_SECRET）或空数据覆盖线上
#   · 落盘前先跑一次 tools/backup.py 备份（update.sh 里也会再备一次）
#   · 全部动作都在"安装目录 = 本脚本的上一级"内进行，不需要额外传路径
#
if [ -z "${BASH_VERSION:-}" ]; then
  command -v bash >/dev/null 2>&1 && exec bash "$0" "$@" || { echo "需要 bash" >&2; exit 1; }
fi

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=lib/common.sh
. "${SCRIPT_DIR}/lib/common.sh"

PKG=""
DRY_RUN=0
PASSTHRU=()

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --skip-build|--slim) PASSTHRU+=("$1"); shift ;;
    --yes|-y|--noninteractive) PASSTHRU+=("--yes"); shift ;;
    -h|--help) sed -n '2,26p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) die "未知参数: $1（--help 查看用法）" ;;
    *) [ -z "$PKG" ] || die "只接受一个发布包路径"; PKG="$1"; shift ;;
  esac
done

[ -n "$PKG" ] || die "请给出发布包路径，例如：bash deploy/push-deploy.sh /tmp/team-site-1.0.0.tar.gz"
[ -f "$PKG" ] || die "发布包不存在: $PKG"

case "$PKG" in
  *.tar.gz|*.tgz) ;;
  *) die "只支持 .tar.gz / .tgz（Windows 直接压缩常带 CRLF 且丢可执行位，请用 node scripts/pack-release.mjs 打包）" ;;
esac

require_root
banner
log "安装目录: ${INSTALL_DIR}"
log "发布包  : ${PKG}"

# ---------------------------------------------------------------- 1. 校验发布包
step "1/4 校验发布包完整性"
if [ -f "${PKG}.sha256" ]; then
  EXPECT="$(awk '{print $1}' "${PKG}.sha256" | head -1)"
  ACTUAL="$(sha256sum "$PKG" | awk '{print $1}')"
  if [ "$EXPECT" = "$ACTUAL" ]; then
    ok "SHA256 一致: ${ACTUAL:0:16}…"
  else
    die "SHA256 不匹配（期望 $EXPECT，实际 $ACTUAL），包可能损坏"
  fi
else
  warn "未找到 ${PKG}.sha256，跳过校验和比对"
fi

# 归档条目必须在根层级（deploy/、backend/…），否则解压会多套一层目录
if tar -tzf "$PKG" 2>/dev/null | head -50 | grep -qE '^(team-site|\./)'; then
  warn "归档内含顶层目录前缀，解压后可能多一层；建议用 node scripts/pack-release.mjs 重新打包"
fi

# ---------------------------------------------------------------- 2. 预览
step "2/4 预览将被覆盖的条目"
tar -tzf "$PKG" | wc -l | awk '{print "  归档条目数: " $1}'
tar -tzf "$PKG" | grep -E '^(backend/|frontend/src|deploy/|tools/)' | head -12 | sed 's/^/    /'
echo "    …"

if [ "$DRY_RUN" = "1" ]; then
  warn "--dry-run：未做任何修改即退出"
  exit 0
fi

# ---------------------------------------------------------------- 3. 备份 + 解压
step "3/4 备份并解压覆盖"
if [ -f "${INSTALL_DIR}/tools/backup.py" ] && has_cmd python3; then
  ( cd "$INSTALL_DIR" && python3 tools/backup.py --keep 14 --json ) || warn "备份失败，继续（请谨慎）"
else
  warn "跳过备份（缺 python3 或 tools/backup.py）"
fi

# 关键：排除运行配置与数据，线上状态永远优先
tar -xzf "$PKG" -C "$INSTALL_DIR" \
  --exclude='backend/.env' \
  --exclude='backend/data' \
  --exclude='backend/data/*' \
  --exclude='backend/node_modules' \
  --exclude='frontend/node_modules' \
  --exclude='logs' \
  --exclude='backups'

# 解压后确保脚本仍有执行位（某些 tar 实现会丢）
find "${INSTALL_DIR}/deploy" "${INSTALL_DIR}/tools" -type f \( -name '*.sh' -o -name '*.py' \) -exec chmod +x {} + 2>/dev/null || true
ok "代码已覆盖到 ${INSTALL_DIR}"

echo "  备份文件:"
ls -1t "${INSTALL_DIR}/backups" 2>/dev/null | head -3 | sed 's/^/    /' || echo "    （无 backups 目录）"

# ---------------------------------------------------------------- 4. 更新
step "4/4 执行更新流程（依赖 → 迁移 → 构建 → 重启 → 自检）"
if [ "${#PASSTHRU[@]}" -eq 0 ]; then
  bash "${INSTALL_DIR}/deploy/update.sh" --yes
else
  bash "${INSTALL_DIR}/deploy/update.sh" "${PASSTHRU[@]}"
fi

printf '\n%b\n' "${C_GREEN}部署完成${C_RESET}"
