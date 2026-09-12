#!/usr/bin/env bash
# 公共函数库：日志、权限、交互、文件操作
# 被 install.sh / bt-deploy.sh / update.sh / uninstall.sh 共同 source

set -o pipefail

# ---------------------------------------------------------------- 颜色与日志
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_RESET='\033[0m'; C_RED='\033[31m'; C_GREEN='\033[32m'
  C_YELLOW='\033[33m'; C_BLUE='\033[34m'; C_BOLD='\033[1m'; C_DIM='\033[2m'
else
  C_RESET=''; C_RED=''; C_GREEN=''; C_YELLOW=''; C_BLUE=''; C_BOLD=''; C_DIM=''
fi

log()   { printf '%b\n' "${C_BLUE}[信息]${C_RESET} $*"; }
ok()    { printf '%b\n' "${C_GREEN}[成功]${C_RESET} $*"; }
warn()  { printf '%b\n' "${C_YELLOW}[警告]${C_RESET} $*"; }
err()   { printf '%b\n' "${C_RED}[错误]${C_RESET} $*" >&2; }
die()   { err "$*"; exit 1; }
step()  { printf '\n%b\n' "${C_BOLD}==> $*${C_RESET}"; }
dim()   { printf '%b\n' "${C_DIM}$*${C_RESET}"; }

banner() {
  printf '\n%b' "${C_BOLD}"
  cat <<'EOF'
   ____                              ____
  / __ \__  ______ ___  ____  ____  / __/___  _____ ___  ____ ___  ____
 / /_/ / / / / __ `__ \/ __ \/ __ \/ /_/ __ \/ ___/ _ \/ __ `__ \/ __ \
/ ____/ /_/ / / / / / / /_/ / / / / __/ /_/ / /  /  __/ / / / / / /_/ /
\/    \__, /_/ /_/ /_/\____/_/ /_/_/  \____/_/   \___/_/ /_/ /_/\____/
      /____/            七零喵团队站点 · 一键部署
EOF
  printf '%b\n' "${C_RESET}"
}

# ---------------------------------------------------------------- 基础判断
require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    die "请使用 root 权限运行（宝塔面板终端默认就是 root）：sudo bash $0"
  fi
}

has_cmd() { command -v "$1" >/dev/null 2>&1; }

# 参数取值校验：避免 `bash install.sh --domain` 这类漏写取值时
# 因 set -u 抛出 "unbound variable" 这种难以理解的报错
require_arg_value() {
  # require_arg_value "--domain" "${2:-}"
  if [ -z "${2:-}" ]; then
    die "参数 $1 缺少取值（用法示例：$1 <值>）；执行 --help 查看全部参数"
  fi
}

confirm() {
  # confirm "提示" [默认值 y|n]
  local prompt="$1" default="${2:-n}" answer
  if [ "${NONINTERACTIVE:-0}" = "1" ]; then
    [ "$default" = "y" ]
    return $?
  fi
  if [ "$default" = "y" ]; then
    read -r -p "$(printf '%b' "${C_YELLOW}$prompt [Y/n] ${C_RESET}")" answer || answer=""
    case "${answer:-y}" in [Yy]*) return 0 ;; *) return 1 ;; esac
  else
    read -r -p "$(printf '%b' "${C_YELLOW}$prompt [y/N] ${C_RESET}")" answer || answer=""
    case "${answer:-n}" in [Yy]*) return 0 ;; *) return 1 ;; esac
  fi
}

prompt_default() {
  # prompt_default "提示" "默认值"
  local prompt="$1" default="$2" answer
  if [ "${NONINTERACTIVE:-0}" = "1" ]; then
    printf '%s' "$default"
    return
  fi
  read -r -p "$(printf '%b' "${C_BOLD}$prompt${C_RESET} [${default}]: ")" answer || answer=""
  printf '%s' "${answer:-$default}"
}

# ---------------------------------------------------------------- 文件与备份
backup_file() {
  local file="$1"
  if [ -f "$file" ]; then
    local backup="${file}.bak.$(date +%Y%m%d%H%M%S)"
    cp -p "$file" "$backup" && dim "已备份 $file → $backup"
  fi
}

random_secret() {
  if has_cmd openssl; then
    openssl rand -hex 32
  else
    od -An -tx1 -N32 /dev/urandom | tr -d ' \n'
  fi
}

ensure_dir() { mkdir -p "$1"; }

# 复制项目文件（排除构建产物、运行数据与密钥），用于把当前目录同步到安装目录
# 【重要】backend/.env 与 backend/data 必须排除：前者含密钥、后者是线上数据，
# 一旦被 --delete 清掉就是事故。logs/backups/release 同理。
sync_project() {
  local src="$1" dest="$2"
  ensure_dir "$dest"
  local excludes=(
    --exclude 'node_modules' --exclude 'dist' --exclude 'backups'
    --exclude 'release' --exclude 'logs' --exclude '*.log'
    --exclude 'backend/data' --exclude 'backend/.env' --exclude '.env'
    --exclude '.git' --exclude '__pycache__'
  )
  if has_cmd rsync; then
    rsync -a --delete "${excludes[@]}" "$src"/ "$dest"/
  else
    # 无 rsync 时的兜底：tar 管道复制（不删除目标多余文件，避免误删数据）
    ( cd "$src" && tar \
        --exclude='node_modules' --exclude='dist' --exclude='backups' \
        --exclude='release' --exclude='logs' --exclude='*.log' \
        --exclude='backend/data' --exclude='backend/.env' --exclude='.env' \
        --exclude='.git' --exclude='__pycache__' -cf - . ) | ( cd "$dest" && tar -xf - )
  fi
  # 兜底：即使 rsync 误删，也从备份语义上保证数据目录存在
  ensure_dir "${dest}/backend/data/uploads"
}

port_is_free() {
  local port="$1"
  if has_cmd ss; then
    ! ss -ltn 2>/dev/null | awk '{print $4}' | grep -q "[:.]${port}$"
  elif has_cmd netstat; then
    ! netstat -ltn 2>/dev/null | awk '{print $4}' | grep -q "[:.]${port}$"
  else
    return 0
  fi
}

find_free_port() {
  local port="${1:-8787}"
  while ! port_is_free "$port"; do
    port=$((port + 1))
    [ "$port" -gt 9999 ] && die "找不到可用端口"
  done
  printf '%s' "$port"
}

wait_for_http() {
  # wait_for_http URL 超时秒数
  local url="$1" timeout="${2:-30}" i=0
  while [ "$i" -lt "$timeout" ]; do
    if has_cmd curl && curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

render_template() {
  # render_template 模板文件 目标文件 KEY=VALUE ...
  local template="$1" target="$2"; shift 2
  [ -f "$template" ] || die "模板不存在: $template"
  cp "$template" "$target"
  local pair key value
  for pair in "$@"; do
    key="${pair%%=*}"
    value="${pair#*=}"
    # 用 | 作为分隔符，避免路径中的 / 破坏 sed 表达式
    sed -i "s|__${key}__|${value}|g" "$target"
  done
}

# ---------------------------------------------------------------- 远程部署可用性
# Windows/编辑器保存过的脚本可能带 CRLF 或缺少可执行位，导致远程服务器上
# 直接执行 ./deploy/install.sh 时报 "bad interpreter" 或 "Permission denied"。
# 下面两个函数负责自愈与自检。

# 把 CRLF 换成 LF（只处理脚本类文件），并补齐可执行位
ensure_script_hygiene() {
  local root="$1"
  [ -d "$root" ] || return 0
  local fixed_crlf=0 fixed_mode=0 file

  # 1) 去掉行尾 CR
  while IFS= read -r file; do
    [ -f "$file" ] || continue
    if grep -q $'\r' "$file" 2>/dev/null; then
      sed -i 's/\r$//' "$file" && fixed_crlf=$((fixed_crlf + 1))
    fi
  done <<EOF
$(find "$root" -type f \( -name '*.sh' -o -name '*.py' -o -path '*/deploy/initd/*' \) 2>/dev/null)
EOF

  # 2) 补齐可执行位（脚本 + 运维工具）
  for pattern in \
    "$root"/deploy/*.sh \
    "$root"/deploy/lib/*.sh \
    "$root"/deploy/tests/*.sh \
    "$root"/deploy/bt-plugin/*.sh \
    "$root"/deploy/initd/* \
    "$root"/tools/*.py
  do
    [ -f "$pattern" ] || continue
    if [ ! -x "$pattern" ]; then
      chmod +x "$pattern" 2>/dev/null && fixed_mode=$((fixed_mode + 1))
    fi
  done

  [ "$fixed_crlf" -gt 0 ] && warn "已修正 $fixed_crlf 个脚本的 CRLF 换行（Windows 编辑器常见问题）"
  [ "$fixed_mode" -gt 0 ] && log "已为 $fixed_mode 个脚本补齐可执行权限"
  return 0
}

# 检测目标目录所在挂载点是否 noexec（容器/加固系统常见），noexec 时脚本无法直接执行
check_exec_allowed() {
  local path="$1"
  [ -d "$path" ] || path="$(dirname "$path")"
  local opts=""
  if has_cmd findmnt; then
    opts="$(findmnt -no OPTIONS --target "$path" 2>/dev/null || true)"
  elif [ -r /proc/mounts ]; then
    opts="$(awk -v p="$path" '$2 != "" { print $4 }' /proc/mounts 2>/dev/null | head -n1 || true)"
  fi
  case ",${opts}," in
    *,noexec,*)
      warn "目录 $path 所在挂载点带有 noexec 选项，脚本无法在此直接执行。"
      dim "解决办法：把项目移到 /opt、/www/wwwroot 等可执行目录，或让运维重新挂载去掉 noexec。"
      return 1
      ;;
  esac
  return 0
}

# 以 bash 重新执行自身（应对 sh→dash、以及被 `sh install.sh` 调用的情况）
ensure_bash() {
  if [ -z "${BASH_VERSION:-}" ]; then
    if has_cmd bash; then
      exec bash "$0" "$@"
    fi
    err "当前 shell 不是 bash，且系统中找不到 bash。请安装 bash 后执行：bash $0"
    exit 1
  fi
}
