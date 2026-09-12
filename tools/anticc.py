#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
防 CC 状态查看与解封

配合 nginx 层限流使用：nginx 挡洪峰，应用层做滑动窗口 + 自动封禁，
本脚本用于在服务器上快速查看当前封禁情况并手动解封。

依赖：无（标准库）

用法：
    python3 tools/anticc.py                          # 查看状态
    python3 tools/anticc.py --unban 1.2.3.4           # 解封指定 IP
    python3 tools/anticc.py --clear                   # 清空全部封禁与计数
    python3 tools/anticc.py --json                    # JSON 输出（接监控）
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from qlm_common import ApiClient, Color, fail, info, load_env, ok, warn  # noqa: E402


def print_stats(stats: dict) -> None:
    cfg = stats.get("config", {})
    print(f"{Color.BOLD}防 CC 状态{Color.END}")
    print(f"  开关            : {'开启' if cfg.get('enabled') else '关闭'}")
    print(f"  统计窗口        : {cfg.get('windowMs')} ms")
    print(f"  单 IP 请求上限   : {cfg.get('maxRequests')} / 窗口")
    print(f"  封禁时长        : {cfg.get('banSeconds')} 秒")
    print(f"  并发上限        : 全局 {cfg.get('maxConcurrent')} · 单 IP {cfg.get('maxPerIp')}")
    print(f"  白名单          : {', '.join(cfg.get('whitelist') or []) or '（空）'}")
    print(f"  令牌豁免        : {'是' if cfg.get('skipToken') else '否'}")
    print()
    print(f"  当前跟踪 IP     : {stats.get('tracked', 0)}")
    print(f"  当前封禁中      : {stats.get('banned', 0)}")
    print(f"  处理中请求      : {stats.get('inFlight', 0)}")
    print(f"  累计拦截次数    : {stats.get('blockedTotal', 0)}")
    print(f"  累计封禁次数    : {stats.get('bannedTotal', 0)}")
    print(f"  并发拒绝次数    : {stats.get('concurrencyRejected', 0)}")
    print(f"  最近拦截时间    : {stats.get('lastBlockedAt') or '—'}")

    banned = stats.get("bannedList") or []
    if banned:
        print()
        print(f"{Color.YELLOW}封禁中的 IP：{Color.END}")
        for item in banned:
            print(f"  {item['ip'].ljust(18)} 剩余 {item['remainingSeconds']}s · 窗口内请求 {item['requests']}")
    else:
        print()
        info("当前没有封禁中的 IP")


def main() -> int:
    parser = argparse.ArgumentParser(description="防 CC 状态查看与解封")
    parser.add_argument("--base", help="API 基地址，默认读取 backend/.env")
    parser.add_argument("--username", default="admin")
    parser.add_argument("--password", default="")
    parser.add_argument("--unban", metavar="IP", help="解封指定 IP")
    parser.add_argument("--clear", action="store_true", help="清空全部封禁与计数")
    parser.add_argument("--json", action="store_true", help="JSON 输出")
    args = parser.parse_args()

    load_env()
    client = ApiClient(base=args.base)
    password = args.password or os.environ.get("QLM_PASSWORD", "")
    if not password:
        fail("请通过 --password 或环境变量 QLM_PASSWORD 提供管理员密码")
        return 1
    try:
        client.login(args.username, password)
    except Exception as err:  # noqa: BLE001
        fail(f"登录失败：{err}")
        return 1

    if args.unban or args.clear:
        try:
            result = client.post("/site/anticc/unban", {"ip": args.unban or ""})
        except Exception as err:  # noqa: BLE001
            fail(f"解封失败：{err}")
            return 1
        ok(result.get("message", "已处理"))
        stats = result.get("data", {}).get("anticc")
        if stats and not args.json:
            print()
            print_stats(stats)
        return 0

    try:
        data = client.get("/site/anticc")["data"]["anticc"]
    except Exception as err:  # noqa: BLE001
        fail(f"读取状态失败：{err}")
        return 1

    if args.json:
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return 0

    print_stats(data)
    if data.get("bannedTotal", 0) > 0:
        print()
        warn("如需解封：python3 tools/anticc.py --unban <IP>，或 --clear 清空全部")
    return 0


if __name__ == "__main__":
    sys.exit(main())
