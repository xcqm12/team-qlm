#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
站点健康检查（可挂到宝塔计划任务，每分钟执行）

检查项：
  1. 后端 API /api/health 是否存活
  2. 站点设置与统计接口是否正常返回
  3. 数据库文件 / 上传目录是否存在且可写
  4. 磁盘剩余空间是否高于阈值

退出码：0 正常，1 存在异常（便于监控系统告警）
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from qlm_common import (  # noqa: E402
    ApiClient,
    BACKEND_DIR,
    Color,
    fail,
    human_size,
    info,
    load_env,
    ok,
    resolve_db_file,
    resolve_upload_dir,
    warn,
)

DEFAULT_MIN_FREE_GB = 1.0


def check_api(base: str | None, timeout: int) -> tuple[bool, str]:
    client = ApiClient(base=base, timeout=timeout)
    try:
        health = client.get("/health")
    except Exception as err:  # noqa: BLE001
        return False, f"API 不可用：{err}"
    if not (isinstance(health, dict) and health.get("success")):
        return False, f"API 返回异常：{health}"
    return True, f"API 正常（{base or client.base}）"


def check_settings(client: ApiClient) -> tuple[bool, str]:
    try:
        data = client.get("/site/settings")
        site = data.get("data", {}).get("settings", {})
        stats = client.get("/site/stats").get("data", {}).get("stats", {})
    except Exception as err:  # noqa: BLE001
        return False, f"接口异常：{err}"
    return True, (
        f"{site.get('site_name', '?')} · 项目 {stats.get('project_count', 0)} · "
        f"动态 {stats.get('news_count', 0)} · 文件 {stats.get('file_count', 0)} · "
        f"占用 {stats.get('fileSizeText', '0 B')}"
    )


def check_paths(config: dict) -> tuple[bool, str]:
    db_file = resolve_db_file(config)
    upload_dir = resolve_upload_dir(config)
    problems = []
    if not db_file.exists():
        problems.append(f"数据库不存在：{db_file}")
    if not upload_dir.exists():
        problems.append(f"上传目录不存在：{upload_dir}")
    else:
        probe = upload_dir / ".healthcheck.tmp"
        try:
            probe.write_text("ok", encoding="utf-8")
            probe.unlink()
        except OSError as err:
            problems.append(f"上传目录不可写：{err}")
    if problems:
        return False, "；".join(problems)
    return True, f"数据库 {human_size(db_file.stat().st_size)} / 上传目录 {upload_dir}"


def check_disk(path: Path, min_free_gb: float) -> tuple[bool, str]:
    usage = shutil.disk_usage(str(path))
    free_gb = usage.free / (1024**3)
    text = f"剩余 {free_gb:.2f} GB / 共 {usage.total / (1024**3):.2f} GB"
    if free_gb < min_free_gb:
        return False, f"磁盘空间不足（{text}，阈值 {min_free_gb} GB）"
    return True, text


def main() -> int:
    parser = argparse.ArgumentParser(description="七零喵团队站点健康检查")
    parser.add_argument("--base", help="API 基地址，如 http://127.0.0.1:8787/api")
    parser.add_argument("--timeout", type=int, default=10, help="请求超时秒数")
    parser.add_argument("--min-free-gb", type=float, default=DEFAULT_MIN_FREE_GB, help="磁盘剩余空间告警阈值(GB)")
    parser.add_argument("--quiet", action="store_true", help="仅输出异常")
    args = parser.parse_args()

    config = load_env()
    client = ApiClient(base=args.base, timeout=args.timeout)
    results: list[tuple[str, bool, str]] = []

    results.append(("API 服务", *check_api(args.base, args.timeout)))
    results.append(("站点接口", *check_settings(client)))
    results.append(("文件与数据库", *check_paths(config)))
    results.append(("磁盘空间", *check_disk(BACKEND_DIR, args.min_free_gb)))

    if not args.quiet:
        print(f"{Color.BOLD}七零喵团队站点 · 健康检查{Color.END}")
    failed = 0
    for name, passed, message in results:
        if passed:
            if not args.quiet:
                ok(f"{name}：{message}")
        else:
            failed += 1
            fail(f"{name}：{message}")

    if failed:
        print(f"\n{Color.RED}检查未通过：{failed} 项异常{Color.END}")
        return 1
    if not args.quiet:
        info("全部检查通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
