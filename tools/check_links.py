#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
第三方下载链接批量体检（跳转前检测）

对站点里所有 source=external 的下载条目做连通性检测，输出可达性、HTTP 状态、
跳转次数、真实终点与耗时；发现失效链接时退出码为 1，方便挂到宝塔计划任务做告警。

依赖：无（标准库）

用法：
    python3 tools/check_links.py                    # 体检全部第三方链接
    python3 tools/check_links.py --username admin --password 'xxx'
    python3 tools/check_links.py --only-stale       # 只检测缓存过期的（默认行为）
    python3 tools/check_links.py --all              # 强制全部重新检测
    python3 tools/check_links.py --json             # 输出 JSON，便于接入告警系统
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from qlm_common import ApiClient, Color, fail, info, load_env, ok, warn  # noqa: E402


def status_icon(check: dict) -> str:
    if check.get("ok"):
        return "✅"
    if check.get("suspicious"):
        return "⚠️ "
    if check.get("loop"):
        return "🔁"
    if check.get("tooManyHops"):
        return "🔀"
    return "❌"


def describe(check: dict) -> str:
    if not check:
        return "未检测"
    if check.get("ok"):
        hops = check.get("hopCount") or 0
        return f"可达 HTTP {check.get('status')}" + (f" · {hops} 次跳转" if hops else "")
    if check.get("suspicious"):
        return f"疑似风控 HTTP {check.get('status')}（浏览器访问通常正常，不计为失效）"
    if check.get("loop"):
        return "跳转成环"
    if check.get("tooManyHops"):
        return "跳转次数过多"
    if check.get("status"):
        return f"异常 HTTP {check['status']}"
    return check.get("error") or "不可达"


def main() -> int:
    parser = argparse.ArgumentParser(description="第三方下载链接体检")
    parser.add_argument("--base", help="API 基地址，默认读取 backend/.env")
    parser.add_argument("--username", default="admin")
    parser.add_argument("--password", default="")
    parser.add_argument("--only-stale", action="store_true", default=True, help="仅检测缓存过期的（默认）")
    parser.add_argument("--all", action="store_true", help="强制全部重新检测（忽略缓存）")
    parser.add_argument("--json", action="store_true", help="以 JSON 输出结果")
    args = parser.parse_args()

    load_env()
    client = ApiClient(base=args.base)
    if not args.password:
        import os

        args.password = os.environ.get("QLM_PASSWORD", "")
    if not args.password:
        fail("请通过 --password 或环境变量 QLM_PASSWORD 提供管理员密码")
        return 1

    try:
        client.login(args.username, args.password)
    except Exception as err:  # noqa: BLE001
        fail(f"登录失败：{err}")
        return 1

    try:
        result = client.post("/files/check-all", {"onlyStale": not args.all})
    except Exception as err:  # noqa: BLE001
        fail(f"检测请求失败：{err}")
        return 1

    data = result.get("data", {})
    checked = data.get("checked", 0)
    skipped = data.get("skipped", 0)
    summary = data.get("summary", {})
    items = data.get("results", [])

    if args.json:
        print(json.dumps(data, ensure_ascii=False, indent=2))
    else:
        print(f"{Color.BOLD}第三方下载链接体检{Color.END}")
        print(f"检测 {checked} 条，跳过 {skipped} 条（结果仍在有效期内）\n")
        width = max((len(i.get("name", "")) for i in items), default=10)
        for item in items:
            check = item.get("check", {})
            print(f"  {status_icon(check)} {item.get('name', '').ljust(width)}  {describe(check)}")
            if not check.get("ok"):
                print(f"      ↳ {item.get('url')}")
                if check.get("finalUrl") and check.get("finalUrl") != item.get("url"):
                    print(f"      ↳ 重定向至 {check['finalUrl']}")
                if check.get("error"):
                    print(f"      ↳ 原因：{check['error']}")

    failed = summary.get("failed", 0)
    suspicious = summary.get("suspicious", 0)
    if checked == 0:
        info("没有需要检测的链接（可能全部在缓存有效期内，可用 --all 强制检测）")
        return 0
    print()
    if suspicious:
        warn(f"{suspicious} 条链接被平台风控拦截（HTTP 401/403/429 等），浏览器访问通常正常，未计入异常")
    if failed:
        fail(f"发现 {failed} 条链接异常，请到后台「文件管理」中更新或删除对应条目")
        return 1
    ok(f"没有失效链接（可达 {summary.get('ok', 0)} 条" + (f"，风控 {suspicious} 条" if suspicious else "") + "）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
