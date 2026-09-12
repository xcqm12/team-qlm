#!/usr/bin/env bash
#
# 七零喵团队站点 · 远程服务器引导安装脚本（Bootstrap）
#
# 作用：让「远程 Linux 服务器」能直接执行部署，自动完成
#   下载安装包 → 校验 → 解压 → 修复权限与换行符 → 交给 deploy/install.sh
#
# 三种典型用法：
#
#  1) 已经有打包好的 tar.gz（推荐，权限/换行都已正确）
#     bash deploy/remote-install.sh --tarball https://your.cdn/team-site-1.0.0.tar.gz --domain team.example.com
#
#  2) 从 Git 仓库拉取
#     bash deploy/remote-install.sh --git https://github.com/xxxx/xxxxx.git --branch main --domain team.example.com
#
#  3) 一行命令（把本文件放到任意可访问地址，或直接在服务器上执行本脚本）
#     curl -fsSL https://your.cdn/remote-install.sh | bash -s -- \
#       --tarball https://your.cdn/team-site-1.0.0.tar.gz --domain team.example.com --noninteractive
#
# 说明：
#   · 本脚本不依赖 lib/*.sh，可被 curl | bash 管道执行
#   · 会自动给所有 .sh 补可执行位、把 CRLF 换成 LF（Windows 上传的常见坑）
#   · install.sh 支持的参数可原样透传（--port/--dir/--service/--password/--no-nginx…）
#
if [ -z "${BASH_VERSION:-}" ]; then
  if command -v bash >/dev/null 2>&1; then
    exec bash "$0" "$@"
  fi
  echo "需要 bash 才能运行本脚本，请先安装 bash" >&2
  exit 1
fi

set -euo pipefail

TARBALL=""
GIT_URL=""
GIT_BRANCH=""
LOCAL_FILE=""
SRC_DIR=""
EXPECTED_SHA=""
KEEP_TMP=0
WORK_ROOT="${WORK_ROOT:-/www/wwwroot}"
INSTALL_ARGS=()

log()  { printf '\033[34m[引导]\033[0m %s\n' "$*"; }
ok()   { printf '\033[32m[成功]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[警告]\033[0m %s\n' "$*"; }
err()  { printf '\033[31m[错误]\033[0m %s\n' "$*" >&2; }
die()  { err "$*"; exit 1; }
has()  { command -v "$1" >/dev/null 2>&1; }

# 参数取值校验：漏写取值时给出可读报错，而不是 set -u 的 unbound variable
need() { [ -n "${2:-}" ] || die "参数 $1 缺少取值（用法示例：$1 <值>）；执行 --help 查看全部参数"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --tarball) need "$1" "${2:-}"; TARBALL="$2"; shift 2 ;;
    --git) need "$1" "${2:-}"; GIT_URL="$2"; shift 2 ;;
    --branch) need "$1" "${2:-}"; GIT_BRANCH="$2"; shift 2 ;;
    --local) need "$1" "${2:-}"; LOCAL_FILE="$2"; shift 2 ;;
    --dir) need "$1" "${2:-}"; SRC_DIR="$2"; shift 2 ;;
    --sha256) need "$1" "${2:-}"; EXPECTED_SHA="$2"; shift 2 ;;
    --work-root) need "$1" "${2:-}"; WORK_ROOT="$2"; shift 2 ;;
    --keep) KEEP_TMP=1; shift ;;
    -h|--help)
      sed -n '2,32p' "$0" | sed 's/^# \{0,1\}//'
      echo
      echo "透传给 install.sh 的参数（示例）：--domain <域名> --port <端口> --password <密码> --noninteractive"
      exit 0 ;;
    --) shift; INSTALL_ARGS+=("$@"); break ;;
    *) INSTALL_ARGS+=("$1"); shift ;;
  esac
done

require_root() {
  [ "$(id -u)" -eq 0 ] || die "请使用 root 运行：sudo bash $0"
}

fetch() {
  # fetch URL 输出文件
  local url="$1" out="$2"
  if has curl; then
    curl -fL --retry 3 --connect-timeout 15 --progress-bar "$url" -o "$out"
  elif has wget; then
    wget -q --show-progress -O "$out" "$url"
  else
    die "系统缺少 curl / wget，请先安装其中一个"
  fi
}

sha256_of() {
  if has sha256sum; then sha256sum "$1" | awk '{print $1}'
  elif has shasum; then shasum -a 256 "$1" | awk '{print $1}'
  else openssl dgst -sha256 "$1" | awk '{print $NF}'
  fi
}

# 修复换行符与可执行位（远程上传的 Windows 文件尤其需要）
normalize_tree() {
  local root="$1" crlf=0 modes=0 f
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    if grep -q $'\r' "$f" 2>/dev/null; then
      sed -i 's/\r$//' "$f"
      crlf=$((crlf + 1))
    fi
  done <<EOF
$(find "$root" -type f \( -name '*.sh' -o -name '*.py' -o -path '*/deploy/initd/*' \) 2>/dev/null)
EOF

  for f in "$root"/deploy/*.sh "$root"/deploy/lib/*.sh "$root"/deploy/tests/*.sh \
           "$root"/deploy/bt-plugin/*.sh "$root"/deploy/initd/* "$root"/tools/*.py; do
    [ -f "$f" ] || continue
    [ -x "$f" ] || { chmod +x "$f" 2>/dev/null && modes=$((modes + 1)); }
  done

  [ "$crlf" -gt 0 ] && warn "已修正 $crlf 个脚本的 CRLF 换行"
  [ "$modes" -gt 0 ] && log "已为 $modes 个脚本补齐可执行权限"
  return 0
}

# 找到项目根（包含 deploy/install.sh 的那一层）
find_project_root() {
  local base="$1"
  if [ -f "$base/deploy/install.sh" ]; then
    printf '%s' "$base"
    return 0
  fi
  local found
  found="$(find "$base" -maxdepth 3 -type f -path '*/deploy/install.sh' 2>/dev/null | head -n1)"
  [ -n "$found" ] && { printf '%s' "$(dirname "$(dirname "$found")")"; return 0; }
  return 1
}

main() {
  require_root
  log "七零喵团队站点 · 远程部署引导"
  mkdir -p "$WORK_ROOT"

  local work_dir=""
  local source_desc=""

  # 1) 确定来源
  if [ -n "$TARBALL" ]; then
    work_dir="$(mktemp -d /tmp/team-site-bootstrap.XXXXXX)"
    local pkg="$work_dir/$(basename "${TARBALL%%\?*}")"
    log "下载安装包：$TARBALL"
    fetch "$TARBALL" "$pkg" || die "下载失败，请检查地址或网络"
    log "已下载 $(du -h "$pkg" | awk '{print $1}')"

    if [ -n "$EXPECTED_SHA" ]; then
      local actual; actual="$(sha256_of "$pkg")"
      [ "$actual" = "$EXPECTED_SHA" ] || die "SHA256 校验失败：期望 $EXPECTED_SHA 实际 $actual"
      ok "SHA256 校验通过"
    fi

    log "解压安装包…"
    case "$pkg" in
      *.zip) has unzip || die "需要 unzip 解压 zip"; unzip -q "$pkg" -d "$work_dir/src" ;;
      *)     mkdir -p "$work_dir/src"; tar -xzf "$pkg" -C "$work_dir/src" || die "解压失败（是否缺少 gzip/tar？）" ;;
    esac
    SRC_DIR="$work_dir/src"
    source_desc="安装包 $(basename "$pkg")"

  elif [ -n "$GIT_URL" ]; then
    has git || die "需要 git：apt install git / yum install git / apk add git"
    work_dir="$(mktemp -d /tmp/team-site-bootstrap.XXXXXX)"
    log "克隆仓库：$GIT_URL ${GIT_BRANCH:+（分支 $GIT_BRANCH）}"
    if [ -n "$GIT_BRANCH" ]; then
      git clone --depth 1 --branch "$GIT_BRANCH" "$GIT_URL" "$work_dir/src" || die "git clone 失败"
    else
      git clone --depth 1 "$GIT_URL" "$work_dir/src" || die "git clone 失败"
    fi
    SRC_DIR="$work_dir/src"
    source_desc="Git 仓库 $GIT_URL"

  elif [ -n "$LOCAL_FILE" ]; then
    [ -f "$LOCAL_FILE" ] || die "本地安装包不存在：$LOCAL_FILE"
    work_dir="$(mktemp -d /tmp/team-site-bootstrap.XXXXXX)"
    case "$LOCAL_FILE" in
      *.zip) has unzip || die "需要 unzip"; mkdir -p "$work_dir/src"; unzip -q "$LOCAL_FILE" -d "$work_dir/src" ;;
      *)     mkdir -p "$work_dir/src"; tar -xzf "$LOCAL_FILE" -C "$work_dir/src" ;;
    esac
    SRC_DIR="$work_dir/src"
    source_desc="本地安装包 $LOCAL_FILE"

  elif [ -n "$SRC_DIR" ]; then
    source_desc="已解压目录 $SRC_DIR"

  else
    # 没有指定来源：如果本脚本就在项目里，直接使用所在项目
    local self_dir
    self_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [ -f "$self_dir/install.sh" ] && [ -d "$self_dir/../frontend" ]; then
      SRC_DIR="$(cd "$self_dir/.." && pwd)"
      source_desc="当前项目目录 $SRC_DIR"
    elif ls ./team-site-*.tar.gz >/dev/null 2>&1; then
      LOCAL_FILE="$(ls -t ./team-site-*.tar.gz | head -n1)"
      work_dir="$(mktemp -d /tmp/team-site-bootstrap.XXXXXX)"
      mkdir -p "$work_dir/src"
      tar -xzf "$LOCAL_FILE" -C "$work_dir/src"
      SRC_DIR="$work_dir/src"
      source_desc="当前目录安装包 $LOCAL_FILE"
    else
      err "未指定安装来源。可选：--tarball <URL> | --git <仓库URL> | --local <文件> | --dir <已解压目录>"
      exit 1
    fi
  fi

  # 2) 定位项目根
  local project_root
  project_root="$(find_project_root "$SRC_DIR")" || die "在 $SRC_DIR 中找不到 deploy/install.sh，安装包可能不完整"
  log "项目根目录：$project_root（来源：$source_desc）"

  # 3) 修复可执行性与换行
  normalize_tree "$project_root"

  # 4) 把项目放到目标目录（install.sh 自己也会同步，这里先安顿好）
  local target_dir=""
  local i=0
  while [ $i -lt ${#INSTALL_ARGS[@]} ]; do
    case "${INSTALL_ARGS[$i]}" in
      --dir) target_dir="${INSTALL_ARGS[$((i + 1))]:-}" ;;
    esac
    i=$((i + 1))
  done
  target_dir="${target_dir:-${INSTALL_DIR:-$WORK_ROOT/team-site}}"

  if [ "$project_root" != "$target_dir" ]; then
    mkdir -p "$target_dir"
    if has rsync; then
      rsync -a --delete --exclude 'node_modules' --exclude 'dist' --exclude 'backend/data' \
        --exclude 'backend/.env' --exclude '.env' --exclude 'release' --exclude 'logs' \
        --exclude '.git' --exclude 'backups' "$project_root"/ "$target_dir"/
    else
      ( cd "$project_root" && tar --exclude='node_modules' --exclude='dist' --exclude='backend/data' \
          --exclude='backend/.env' --exclude='.env' --exclude='release' --exclude='logs' \
          --exclude='.git' --exclude='backups' -cf - . ) | ( cd "$target_dir" && tar -xf - )
    fi
    ok "项目已就位：$target_dir"
  fi

  normalize_tree "$target_dir"

  # 5) 交给官方安装脚本
  log "开始执行部署（deploy/install.sh）…"
  chmod +x "$target_dir/deploy/install.sh"
  cd "$target_dir"
  bash "$target_dir/deploy/install.sh" "${INSTALL_ARGS[@]}"
  local rc=$?

  if [ "$KEEP_TMP" = "0" ] && [ -n "$work_dir" ] && [ -d "$work_dir" ]; then
    rm -rf "$work_dir"
  elif [ -n "$work_dir" ]; then
    log "临时目录已保留：$work_dir"
  fi
  exit "$rc"
}

main "$@"
