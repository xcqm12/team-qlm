#!/usr/bin/env bash
#
# 部署脚本自检：语法 + 换行符 + shebang + 可执行位
#
# 远程服务器部署失败的三大原因是：CRLF 换行、缺少可执行位、sh 与 bash 混用。
# 本脚本逐一检查，可在服务器上随时执行：
#   bash deploy/tests/check-syntax.sh
#
set -uo pipefail

if [ -z "${BASH_VERSION:-}" ]; then
  command -v bash >/dev/null 2>&1 && exec bash "$0" "$@" || { echo "需要 bash" >&2; exit 1; }
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "$ROOT_DIR" || exit 1

scripts=(
  deploy/install.sh
  deploy/bt-deploy.sh
  deploy/remote-install.sh
  deploy/fix-bt-anchors.sh
  deploy/update.sh
  deploy/uninstall.sh
  deploy/tests/check-syntax.sh
  deploy/tests/lib-test.sh
  deploy/lib/common.sh
  deploy/lib/detect-os.sh
  deploy/lib/install-node.sh
  deploy/bt-plugin/install.sh
  deploy/bt-plugin/uninstall.sh
  deploy/initd/team-site
)

fail=0
checked=0

printf '%s\n' "== 语法检查（bash -n）=="
for f in "${scripts[@]}"; do
  if [ ! -f "$f" ]; then
    printf 'SKIP  %s (文件不存在)\n' "$f"
    continue
  fi
  checked=$((checked + 1))
  if out="$(bash -n "$f" 2>&1)"; then
    printf 'OK    %s\n' "$f"
  else
    printf 'FAIL  %s\n%s\n' "$f" "$out"
    fail=1
  fi
done

printf '\n%s\n' "== 远程可执行性检查（换行符 / shebang / 权限位）=="
for f in "${scripts[@]}"; do
  [ -f "$f" ] || continue
  # 1) 换行符必须是 LF
  if grep -q $'\r' "$f" 2>/dev/null; then
    printf 'FAIL  %s 含 CRLF 换行（Linux 上会报 bad interpreter）\n' "$f"
    fail=1
  fi
  # 2) 首行必须是 bash shebang（initd 除外）
  first_line="$(head -n1 "$f")"
  case "$f" in
    deploy/initd/team-site)
      case "$first_line" in
        '#!/bin/sh'*) : ;;
        *) printf 'FAIL  %s shebang 应为 #!/bin/sh（当前: %s）\n' "$f" "$first_line"; fail=1 ;;
      esac ;;
    *)
      case "$first_line" in
        '#!/usr/bin/env bash'*) : ;;
        *) printf 'FAIL  %s shebang 应为 #!/usr/bin/env bash（当前: %s）\n' "$f" "$first_line"; fail=1 ;;
      esac ;;
  esac
  # 3) 可执行位（Windows 提交、zip 解压后常丢失）
  if [ ! -x "$f" ]; then
    printf 'WARN  %s 缺少可执行位（尝试自动修复；若在 git 仓库中请执行 git update-index --chmod=+x %s）\n' "$f" "$f"
    if chmod +x "$f" 2>/dev/null; then
      printf 'OK    已修复 %s 的可执行位\n' "$f"
    else
      printf 'FAIL  %s 无法设置可执行位（所在分区可能 noexec 或只读）\n' "$f"
      fail=1
    fi
  fi
done

printf '\n%s\n' "== Python 工具检查（语法 + shebang）=="
if command -v python3 >/dev/null 2>&1; then
  for py in tools/*.py; do
    [ -f "$py" ] || continue
    if python3 -m py_compile "$py" 2>/dev/null; then
      printf 'OK    %s\n' "$py"
    else
      printf 'FAIL  %s 语法错误\n' "$py"
      fail=1
    fi
    grep -q $'\r' "$py" 2>/dev/null && { printf 'FAIL  %s 含 CRLF 换行\n' "$py"; fail=1; }
  done
  rm -rf tools/__pycache__
else
  printf 'SKIP  未安装 python3，跳过 Python 检查\n'
fi

printf '\n%s\n' "== 挂载点可执行性 =="
if command -v findmnt >/dev/null 2>&1; then
  opts="$(findmnt -no OPTIONS --target "$ROOT_DIR" 2>/dev/null || true)"
  case ",${opts}," in
    *,noexec,*) printf 'WARN  当前目录所在挂载点带 noexec，脚本无法直接执行，请移到 /opt 或 /www/wwwroot\n' ;;
    *) printf 'OK    %s 允许执行脚本\n' "$ROOT_DIR" ;;
  esac
else
  printf 'SKIP  无 findmnt\n'
fi

printf '\n----\n'
if [ "$fail" -eq 0 ]; then
  echo "全部检查通过（已检查 $checked 个脚本）✅"
else
  echo "存在未通过项 ❌"
fi
exit "$fail"
