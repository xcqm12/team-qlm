#!/usr/bin/env bash
# Node.js 安装/校验
#
# 站点后端依赖 Node 内置的 node:sqlite（Node.js >= 22.5），因此对 Node 版本有要求。
# 按以下优先级处理，覆盖 Debian/Ubuntu/CentOS/RHEL/Rocky/Alma/Fedora/openEuler/
# Alpine/openSUSE/Arch 等常见发行版：
#   1) 环境变量 NODE_BIN 指定的可执行文件
#   2) 系统已有且版本满足要求
#   3) NodeSource 官方源（deb/rpm 系）
#   4) 发行版自带包管理器
#   5) Node 官方预编译二进制包（兜底，覆盖 glibc 系统）
#   6) Alpine 用 unofficial-builds 的 musl 版本

NODE_MIN_MAJOR=22
NODE_MIN_MINOR=5
NODE_MIN_VERSION="${NODE_MIN_MAJOR}.${NODE_MIN_MINOR}.0"
NODE_INSTALL_MAJOR="${NODE_INSTALL_MAJOR:-22}"

node_version() {
  local bin="${1:-node}"
  if has_cmd "$bin"; then
    "$bin" --version 2>/dev/null | sed 's/^v//'
  elif [ -x "$bin" ]; then
    "$bin" --version 2>/dev/null | sed 's/^v//'
  fi
}

# ver_ge 1.2.3 1.2.0 → 真
ver_ge() {
  local a="${1%%-*}" b="${2%%-*}"
  [ "$(printf '%s\n%s\n' "$a" "$b" | sort -t. -k1,1n -k2,2n -k3,3n | head -n1)" = "$b" ]
}

node_is_ok() {
  local version; version="$(node_version "${1:-node}")"
  [ -n "$version" ] && ver_ge "$version" "$NODE_MIN_VERSION"
}

ensure_node() {
  if [ -n "${NODE_BIN:-}" ]; then
    if node_is_ok "$NODE_BIN"; then
      ok "使用指定 Node: $NODE_BIN ($(node_version "$NODE_BIN"))"
      export PATH="$(dirname "$(readlink -f "$NODE_BIN")"):$PATH"
      return 0
    fi
    die "NODE_BIN=$NODE_BIN 的版本低于 ${NODE_MIN_VERSION}"
  fi

  if node_is_ok node; then
    ok "已检测到 Node.js $(node_version node)（满足 >= ${NODE_MIN_VERSION}）"
    return 0
  fi

  if has_cmd node; then
    warn "已安装的 Node.js $(node_version node) 低于 ${NODE_MIN_VERSION}，将安装新版本（后端依赖内置 node:sqlite）"
  else
    log "未检测到 Node.js，开始安装 Node.js ${NODE_INSTALL_MAJOR}.x"
  fi

  install_node_from_nodesource && return 0
  install_node_from_distro  && return 0
  install_node_from_tarball && return 0

  die "Node.js 自动安装失败，请手动安装 Node.js >= ${NODE_MIN_VERSION} 后重新运行：
    官方下载: https://nodejs.org/zh-cn/download
    或使用 nvm: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash && nvm install ${NODE_INSTALL_MAJOR}"
}

install_node_from_nodesource() {
  case "$OS_FAMILY" in
    debian|rhel) ;;
    *) return 1 ;;
  esac
  step "通过 NodeSource 官方源安装 Node.js ${NODE_INSTALL_MAJOR}.x"
  pkg_update
  pkg_install curl ca-certificates gnupg >/dev/null 2>&1 || true

  local setup_url
  if [ "$OS_FAMILY" = "debian" ]; then
    setup_url="https://deb.nodesource.com/setup_${NODE_INSTALL_MAJOR}.x"
  else
    setup_url="https://rpm.nodesource.com/setup_${NODE_INSTALL_MAJOR}.x"
  fi

  if ! curl -fsSL "$setup_url" -o /tmp/nodesource_setup.sh; then
    warn "无法下载 NodeSource 安装脚本（网络受限？）"
    return 1
  fi
  if ! bash /tmp/nodesource_setup.sh >/dev/null 2>&1; then
    warn "NodeSource 源配置失败"
    return 1
  fi
  if ! pkg_install nodejs; then
    warn "从 NodeSource 安装 nodejs 失败"
    return 1
  fi
  hash -r 2>/dev/null || true
  node_is_ok node && { ok "Node.js $(node_version node) 安装完成"; return 0; }
  return 1
}

install_node_from_distro() {
  step "尝试使用发行版自带仓库安装 Node.js"
  case "$PKG_MGR" in
    apk) pkg_install nodejs npm || return 1 ;;
    pacman) pkg_install nodejs npm || return 1 ;;
    zypper) pkg_install nodejs npm || return 1 ;;
    apt|apt-get) pkg_install nodejs npm || return 1 ;;
    dnf|yum)
      if ! pkg_install nodejs npm; then
        # RHEL 8+ 走 module 流
        { [ "$PKG_MGR" = "dnf" ] && dnf module reset -y nodejs && dnf module enable -y "nodejs:${NODE_INSTALL_MAJOR}" && pkg_install nodejs npm; } || return 1
      fi ;;
    *) return 1 ;;
  esac
  hash -r 2>/dev/null || true
  node_is_ok node && { ok "Node.js $(node_version node) 安装完成"; return 0; }
  warn "发行版仓库中的 Node.js 版本过低（$(node_version node 2>/dev/null || echo 无)）"
  return 1
}

install_node_from_tarball() {
  step "使用 Node.js 官方预编译包安装（兜底方案）"
  local tmp_dir; tmp_dir="$(mktemp -d)"
  local base_url="https://nodejs.org/dist/latest-v${NODE_INSTALL_MAJOR}.x"

  # Alpine 使用 musl 构建
  if [ "$OS_FAMILY" = "alpine" ]; then
    base_url="https://unofficial-builds.nodejs.org/download/release/latest-v${NODE_INSTALL_MAJOR}.x"
  fi

  local file
  file="$(curl -fsSL "$base_url/" 2>/dev/null | grep -o "node-v[0-9.]*-linux-${NODE_ARCH}\.tar\.xz" | head -n1)"
  if [ -z "$file" ]; then
    warn "无法获取 Node.js 下载文件名（$base_url）"
    rm -rf "$tmp_dir"
    return 1
  fi

  log "下载 $file …"
  if ! curl -fL --progress-bar "$base_url/$file" -o "$tmp_dir/$file"; then
    warn "下载失败：$base_url/$file"
    rm -rf "$tmp_dir"
    return 1
  fi

  tar -xJf "$tmp_dir/$file" -C "$tmp_dir" || { warn "解压失败（是否缺少 xz？）"; rm -rf "$tmp_dir"; return 1; }
  local extracted; extracted="$(find "$tmp_dir" -maxdepth 1 -type d -name 'node-v*' | head -n1)"
  [ -n "$extracted" ] || { warn "解压目录异常"; rm -rf "$tmp_dir"; return 1; }

  ensure_dir /usr/local/lib/nodejs
  rm -rf "/usr/local/lib/nodejs/$(basename "$extracted")"
  cp -r "$extracted" /usr/local/lib/nodejs/
  ln -sf "/usr/local/lib/nodejs/$(basename "$extracted")/bin/node" /usr/local/bin/node
  ln -sf "/usr/local/lib/nodejs/$(basename "$extracted")/bin/npm"  /usr/local/bin/npm
  ln -sf "/usr/local/lib/nodejs/$(basename "$extracted")/bin/npx"  /usr/local/bin/npx 2>/dev/null || true
  rm -rf "$tmp_dir"
  hash -r 2>/dev/null || true

  node_is_ok node && { ok "Node.js $(node_version node) 安装到 /usr/local/bin"; return 0; }
  return 1
}

ensure_npm() {
  has_cmd npm || die "未找到 npm，请检查 Node.js 安装是否完整"
  dim "npm $(npm --version 2>/dev/null || echo '?')"
}
