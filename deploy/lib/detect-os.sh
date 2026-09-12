#!/usr/bin/env bash
# Linux 发行版 / 包管理器 / 服务管理器探测
# 导出：OS_ID OS_LIKE OS_NAME OS_VERSION OS_FAMILY PKG_MGR INIT_SYSTEM ARCH NODE_ARCH
# 覆盖的家族：debian / rhel / suse / alpine / arch / gentoo / 未知

detect_os() {
  OS_ID="unknown"; OS_LIKE=""; OS_NAME="Linux"; OS_VERSION=""; OS_FAMILY="unknown"
  PKG_MGR=""; INIT_SYSTEM="unknown"; ARCH="$(uname -m)"

  if [ -r /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    OS_ID="${ID:-unknown}"
    OS_LIKE="${ID_LIKE:-}"
    OS_NAME="${PRETTY_NAME:-${NAME:-Linux}}"
    OS_VERSION="${VERSION_ID:-}"
  elif [ -r /etc/redhat-release ]; then
    OS_ID="rhel"; OS_NAME="$(cat /etc/redhat-release)"; OS_FAMILY="rhel"
  elif [ -r /etc/debian_version ]; then
    OS_ID="debian"; OS_NAME="Debian $(cat /etc/debian_version)"
  elif [ -r /etc/alpine-release ]; then
    OS_ID="alpine"; OS_NAME="Alpine $(cat /etc/alpine-release)"
  elif [ -r /etc/arch-release ]; then
    OS_ID="arch"; OS_NAME="Arch Linux"
  fi

  # 经典 CentOS 7 的 os-release 里 ID_LIKE 可能为空
  local tokens=" ${OS_ID} ${OS_LIKE} "
  case "$tokens" in
    *" debian "*|*" ubuntu "*|*" linuxmint "*|*" raspbian "*|*" kali "*|*" deepin "*|*" uos "*|*" kylin "*)
      OS_FAMILY="debian" ;;
    *" rhel "*|*" fedora "*|*" centos "*|*" rocky "*|*" alma "*|*" ol "*|*" amzn "*|*" anolis "*|*" opencloudos "*|*" tencentos "*|*" openeuler "*)
      OS_FAMILY="rhel" ;;
    *" suse "*|*" opensuse "*|*" sled "*|*" sles "*)
      OS_FAMILY="suse" ;;
    *" alpine "*)
      OS_FAMILY="alpine" ;;
    *" arch "*|*" manjaro "*|*" endeavouros "*)
      OS_FAMILY="arch" ;;
    *" gentoo "*)
      OS_FAMILY="gentoo" ;;
    *)
      OS_FAMILY="unknown" ;;
  esac

  # 包管理器：优先用已知家族，再按可用命令兜底
  case "$OS_FAMILY" in
    debian) PKG_MGR="apt" ;;
    rhel)
      if has_cmd dnf; then PKG_MGR="dnf"; else PKG_MGR="yum"; fi ;;
    suse)   PKG_MGR="zypper" ;;
    alpine) PKG_MGR="apk" ;;
    arch)   PKG_MGR="pacman" ;;
    gentoo) PKG_MGR="emerge" ;;
  esac

  if [ -z "$PKG_MGR" ] || ! has_cmd "$PKG_MGR"; then
    for candidate in apt-get apt dnf yum microdnf zypper apk pacman emerge; do
      if has_cmd "$candidate"; then PKG_MGR="$candidate"; break; fi
    done
  fi
  [ -n "$PKG_MGR" ] || PKG_MGR="unknown"

  # 服务管理器
  if has_cmd systemctl && [ -d /run/systemd/system ]; then
    INIT_SYSTEM="systemd"
  elif has_cmd rc-service || [ -d /etc/init.d ]; then
    INIT_SYSTEM="sysvinit"
  fi

  # Node 官方预编译包的架构命名
  case "$ARCH" in
    x86_64|amd64) NODE_ARCH="x64" ;;
    aarch64|arm64) NODE_ARCH="arm64" ;;
    armv7l) NODE_ARCH="armv7l" ;;
    *) NODE_ARCH="x64" ;;
  esac
}

print_os_info() {
  log "系统: ${C_BOLD}${OS_NAME}${C_RESET}（ID=${OS_ID} 家族=${OS_FAMILY} 架构=${ARCH}）"
  log "包管理器: ${PKG_MGR} · 服务管理器: ${INIT_SYSTEM}"
}

is_baota() {
  [ -d /www/server/panel ] && { [ -f /etc/init.d/bt ] || [ -d /www/server/nginx ] || has_cmd bt; }
}

have_nginx() {
  has_cmd nginx || [ -x /www/server/nginx/sbin/nginx ]
}

nginx_bin() {
  if has_cmd nginx; then command -v nginx; else printf '%s' /www/server/nginx/sbin/nginx; fi
}

nginx_conf_dir() {
  # 宝塔的 vhost 目录优先级最高
  if [ -d /www/server/panel/vhost/nginx ]; then
    printf '%s' /www/server/panel/vhost/nginx
  elif [ -d /etc/nginx/conf.d ]; then
    printf '%s' /etc/nginx/conf.d
  elif [ -d /etc/nginx/sites-available ]; then
    printf '%s' /etc/nginx/sites-available
  elif [ -d /usr/local/nginx/conf/vhost ]; then
    printf '%s' /usr/local/nginx/conf/vhost
  else
    printf '%s' /etc/nginx/conf.d
  fi
}

reload_nginx() {
  if [ -x /etc/init.d/nginx ]; then
    /etc/init.d/nginx reload >/dev/null 2>&1 && return 0
  fi
  if has_cmd systemctl; then
    systemctl reload nginx >/dev/null 2>&1 && return 0
  fi
  local bin; bin="$(nginx_bin)"
  [ -x "$bin" ] && "$bin" -s reload >/dev/null 2>&1 && return 0
  return 1
}

# 包安装：自动处理 apt 缓存、非交互、Alpine 的 /etc/nsswitch 等差异
pkg_update() {
  case "$PKG_MGR" in
    apt|apt-get) DEBIAN_FRONTEND=noninteractive apt-get update -y >/dev/null 2>&1 || true ;;
    dnf)   dnf makecache -y >/dev/null 2>&1 || true ;;
    yum)   yum makecache -y >/dev/null 2>&1 || true ;;
    zypper) zypper --non-interactive refresh >/dev/null 2>&1 || true ;;
    apk)   apk update >/dev/null 2>&1 || true ;;
    pacman) pacman -Sy --noconfirm >/dev/null 2>&1 || true ;;
  esac
}

pkg_install() {
  # pkg_install pkg1 pkg2 ...
  local packages="$*"
  [ -n "$packages" ] || return 0
  case "$PKG_MGR" in
    apt|apt-get) DEBIAN_FRONTEND=noninteractive apt-get install -y $packages ;;
    dnf)   dnf install -y $packages ;;
    yum)   yum install -y $packages ;;
    zypper) zypper --non-interactive install $packages ;;
    apk)   apk add --no-cache $packages ;;
    pacman) pacman -S --noconfirm --needed $packages ;;
    emerge) emerge -q $packages ;;
    *) die "未知包管理器，请手动安装: $packages" ;;
  esac
}

install_base_deps() {
  local need=()
  has_cmd curl || need+=(curl)
  has_cmd tar  || need+=(tar)
  has_cmd gzip || need+=(gzip)
  has_cmd sed  || need+=(sed)
  has_cmd awk  || need+=(gawk)
  has_cmd python3 || need+=(python3)

  # rsync / openssl 可选，有更好
  has_cmd rsync  || need+=(rsync)
  has_cmd openssl || need+=(openssl)

  if [ "${#need[@]}" -gt 0 ]; then
    step "安装系统基础依赖: ${need[*]}"
    pkg_update
    # awk 在 Alpine 上是 busybox 自带，gawk 名称差异单独处理
    local filtered=()
    for pkg in "${need[@]}"; do
      if [ "$pkg" = "gawk" ] && [ "$OS_FAMILY" = "alpine" ]; then continue; fi
      if [ "$pkg" = "python3" ] && [ "$OS_FAMILY" = "alpine" ]; then filtered+=(python3); continue; fi
      filtered+=("$pkg")
    done
    # python 在部分发行版叫 python3-minimal / python
    pkg_install "${filtered[@]}" || warn "部分依赖安装失败，若后续步骤报错请手动安装: ${filtered[*]}"
  else
    dim "系统基础依赖已满足"
  fi
}
