#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量上传工具：把本地目录里的文件批量上传到站点

特性：
  - 递归扫描目录，按扩展名自动归类（可在 --category 强制指定）
  - 支持 --dry-run 先预览
  - 已上传过的同名同大小文件自动跳过（依据站点文件列表）
  - 频率控制 --delay，避免打满带宽

用法：
    # 先看会传哪些
    python3 tools/upload_files.py ./releases --dry-run

    # 正式上传（需要管理员账号）
    python3 tools/upload_files.py ./releases --username admin --password 'qlm@2019'

    # 指定分类与版本
    python3 tools/upload_files.py ./SuperHiVision --category 工具软件 --version v1.5.0
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from qlm_common import ApiClient, fail, human_size, info, load_env, ok, warn  # noqa: E402

# 扩展名 → 站点分类
EXT_CATEGORY = {
    **{ext: "工具软件" for ext in ("exe", "msi", "dmg", "appimage", "deb", "rpm", "apk")},
    **{ext: "模组资源" for ext in ("jar", "mcaddon", "mcpack", "mcworld", "litemod", "zip", "7z", "rar")},
    **{ext: "文档资料" for ext in ("pdf", "md", "txt", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "csv")},
    **{ext: "图片素材" for ext in ("png", "jpg", "jpeg", "gif", "webp", "bmp", "psd", "ico")},
    **{ext: "其他" for ext in ("mp4", "webm", "mp3", "wav", "flac", "mov", "mkv", "iso")},
}

SKIP_NAMES = {".ds_store", "thumbs.db", "desktop.ini"}


def guess_category(path: Path, override: str | None) -> str:
    if override:
        return override
    return EXT_CATEGORY.get(path.suffix.lower().lstrip("."), "其他")


def collect_files(source: Path, recursive: bool, max_size: int) -> list[Path]:
    if source.is_file():
        return [source]
    pattern = "**/*" if recursive else "*"
    files = []
    for item in sorted(source.glob(pattern)):
        if not item.is_file():
            continue
        if item.name.lower() in SKIP_NAMES or item.name.startswith("."):
            continue
        if item.stat().st_size > max_size:
            warn(f"跳过（超过单文件上限）：{item.name} {human_size(item.stat().st_size)}")
            continue
        files.append(item)
    return files


def fetch_existing(client: ApiClient) -> set[tuple[str, int]]:
    """拉取站点已有文件，返回 (文件名, 大小) 集合用于去重"""
    existing: set[tuple[str, int]] = set()
    page = 1
    while True:
        try:
            res = client.get(f"/files?page={page}&pageSize=100&scope=all")
        except Exception as err:  # noqa: BLE001
            warn(f"读取已有文件列表失败，将不做去重：{err}")
            return existing
        data = res.get("data", {})
        for item in data.get("items", []):
            existing.add((item["originalName"], item["size"]))
        if page >= data.get("totalPages", 1):
            break
        page += 1
    return existing


def main() -> int:
    parser = argparse.ArgumentParser(description="批量上传文件到七零喵团队站点")
    parser.add_argument("source", help="要上传的文件或目录")
    parser.add_argument("--base", help="API 基地址，默认读取 backend/.env")
    parser.add_argument("--username", default=os.environ.get("QLM_USER", "admin"))
    parser.add_argument("--password", default=os.environ.get("QLM_PASSWORD", ""))
    parser.add_argument("--category", help="强制指定分类（默认按扩展名推断）")
    parser.add_argument("--version", default="", help="统一写入版本号")
    parser.add_argument("--description", default="", help="统一写入说明")
    parser.add_argument("--private", action="store_true", help="上传为私有（前台不可见）")
    parser.add_argument("--no-recursive", action="store_true", help="不递归子目录")
    parser.add_argument("--delay", type=float, default=0.3, help="每个文件之间的间隔秒数")
    parser.add_argument("--dry-run", action="store_true", help="仅列出计划，不实际上传")
    parser.add_argument("--no-skip", action="store_true", help="不去重，强制上传")
    args = parser.parse_args()

    source = Path(args.source).expanduser().resolve()
    if not source.exists():
        fail(f"路径不存在：{source}")
        return 1

    config = load_env()
    max_size = int(config.get("MAX_UPLOAD_SIZE", 200 * 1024 * 1024))
    files = collect_files(source, not args.no_recursive, max_size)
    if not files:
        warn("没有找到可上传的文件")
        return 0

    total_bytes = sum(f.stat().st_size for f in files)
    info(f"待处理 {len(files)} 个文件，合计 {human_size(total_bytes)}")

    if args.dry_run:
        print_table = [(f.name, f"{guess_category(f, args.category)} · {human_size(f.stat().st_size)}") for f in files]
        width = max(len(name) for name, _ in print_table)
        for name, meta in print_table:
            print(f"  {name.ljust(width)}  {meta}")
        info("dry-run 模式，未实际上传")
        return 0

    client = ApiClient(base=args.base)
    if not args.password:
        fail("请通过 --password 或环境变量 QLM_PASSWORD 提供管理员密码")
        return 1
    try:
        client.login(args.username, args.password)
        ok(f"登录成功：{args.username}")
    except Exception as err:  # noqa: BLE001
        fail(f"登录失败：{err}")
        return 1

    existing = set() if args.no_skip else fetch_existing(client)
    if existing:
        info(f"站点已有 {len(existing)} 个文件，将自动去重")

    uploaded = skipped = failed = 0
    for file in files:
        category = guess_category(file, args.category)
        key = (file.name, file.stat().st_size)
        if key in existing:
            skipped += 1
            warn(f"跳过（已存在）：{file.name}")
            continue
        try:
            result = client.upload(
                file,
                category=category,
                description=args.description,
                version=args.version,
                is_public=not args.private,
            )
            data = result.get("data")
            name = data.get("originalName") if isinstance(data, dict) else file.name
            ok(f"上传成功：{name} → {category}")
            uploaded += 1
        except Exception as err:  # noqa: BLE001
            fail(f"上传失败：{file.name} — {err}")
            failed += 1
        time.sleep(max(0.0, args.delay))

    print()
    info(f"完成：成功 {uploaded} · 跳过 {skipped} · 失败 {failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
