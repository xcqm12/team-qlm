#!/usr/bin/env bash
#
# 部署库函数单元测试：验证版本比较、Node 检测、模板渲染、系统探测等关键逻辑
# 部署前执行可避免“脚本在服务器上跑一半才失败”：
#   bash deploy/tests/lib-test.sh
#
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "$ROOT_DIR" || exit 1

# shellcheck source=../lib/common.sh
. deploy/lib/common.sh
# shellcheck source=../lib/detect-os.sh
. deploy/lib/detect-os.sh
# shellcheck source=../lib/install-node.sh
. deploy/lib/install-node.sh

pass=0
fail=0

check() { # check "描述" 期望值 实际值
  if [ "$2" = "$3" ]; then
    printf 'OK    %s\n' "$1"
    pass=$((pass + 1))
  else
    printf 'FAIL  %s (期望 [%s] 实际 [%s])\n' "$1" "$2" "$3"
    fail=$((fail + 1))
  fi
}

echo "== 版本比较 ver_ge =="
ver_ge "22.5.0" "22.5.0" && check "同版本相等" yes yes || check "同版本相等" yes no
ver_ge "18.20.4" "22.5.0" && check "低版本判定" no yes || check "低版本判定" no no
ver_ge "24.20.0" "22.5.0" && check "高版本判定" yes yes || check "高版本判定" yes no
ver_ge "22.4.9" "22.5.0" && check "次版本不足判定" no yes || check "次版本不足判定" no no

echo "== Node 检测 =="
NODE_ABS="$(command -v node || true)"
if [ -n "$NODE_ABS" ]; then
  node_is_ok "$NODE_ABS" && check "本机 Node 通过版本校验（>= ${NODE_MIN_VERSION}）" yes yes \
    || check "本机 Node 通过版本校验（>= ${NODE_MIN_VERSION}）" yes no
  printf '      本机 Node: %s\n' "$(node_version "$NODE_ABS")"
else
  echo "SKIP  未在 PATH 中找到 node"
fi
node_is_ok "/nonexistent/node" && check "不存在的 Node 应判定失败" no yes || check "不存在的 Node 应判定失败" no no

echo "== 随机密钥 =="
S1="$(random_secret)"
S2="$(random_secret)"
check "密钥长度 64 位十六进制" 64 "${#S1}"
[ "$S1" != "$S2" ] && check "两次生成不重复" yes yes || check "两次生成不重复" yes no

echo "== 端口检测 =="
port_is_free 54321 && check "高位端口可用" yes yes || check "高位端口可用" yes no

echo "== 模板渲染 =="
TMPD="$(mktemp -d)"
cat > "$TMPD/tpl.conf" <<'TPL'
server {
  listen __PORT__;
  server_name __DOMAIN__;
  root __ROOT__/frontend/dist;
  client_max_body_size __CLIENT_MAX_BODY__;
}
TPL
render_template "$TMPD/tpl.conf" "$TMPD/out.conf" \
  "PORT=8787" "DOMAIN=team.example.com" "ROOT=/www/wwwroot/team-site" "CLIENT_MAX_BODY=201m"
grep -q "listen 8787;" "$TMPD/out.conf" && check "渲染端口" yes yes || check "渲染端口" yes no
grep -q "server_name team.example.com;" "$TMPD/out.conf" && check "渲染域名" yes yes || check "渲染域名" yes no
grep -q "root /www/wwwroot/team-site/frontend/dist;" "$TMPD/out.conf" \
  && check "渲染含斜杠路径（sed 分隔符安全）" yes yes || check "渲染含斜杠路径（sed 分隔符安全）" yes no
grep -q "client_max_body_size 201m;" "$TMPD/out.conf" && check "渲染上传上限" yes yes || check "渲染上传上限" yes no
grep -q "__" "$TMPD/out.conf" && check "无遗留占位符" yes no || check "无遗留占位符" yes yes
rm -rf "$TMPD"

echo "== 系统探测 =="
detect_os
printf '      OS_ID=%s OS_FAMILY=%s PKG_MGR=%s INIT=%s ARCH=%s NODE_ARCH=%s\n' \
  "$OS_ID" "$OS_FAMILY" "$PKG_MGR" "$INIT_SYSTEM" "$ARCH" "$NODE_ARCH"
[ -n "$OS_FAMILY" ] && check "能识别系统家族" yes yes || check "能识别系统家族" yes no
[ -n "$NODE_ARCH" ] && check "能识别 Node 架构" yes yes || check "能识别 Node 架构" yes no

echo "== 文件备份 =="
TMPD2="$(mktemp -d)"
echo "v1" > "$TMPD2/a.conf"
backup_file "$TMPD2/a.conf" >/dev/null
check "生成 .bak 备份" 1 "$(find "$TMPD2" -name 'a.conf.bak.*' | wc -l | tr -d ' ')"
rm -rf "$TMPD2"

echo "----"
printf '通过 %s 项，失败 %s 项\n' "$pass" "$fail"
[ "$fail" -eq 0 ] && echo "部署库自检通过 ✅" || echo "部署库自检失败 ❌"
exit "$fail"
