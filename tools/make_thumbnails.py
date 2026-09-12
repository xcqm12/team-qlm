#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
图片缩略图生成/维护

前端在列表页优先使用缩略图（/uploads/thumbnails/<文件名>），生成后图片列表加载更快。
缩略图不是必需的：缺失时前端会自动回退显示原图。

依赖 Pillow（可选）：
    pip3 install Pillow        # 或在宝塔「Python 项目管理器」中安装
仅标准库的 python3 也能运行本脚本，用于 --check / --clean 等维护操作。

用法：
    python3 tools/make_thumbnails.py --check          # 统计缺失情况
    python3 tools/make_thumbnails.py                  # 生成缺失的缩略图
    python3 tools/make_thumbnails.py --size 480       # 指定最长边像素
    python3 tools/make_thumbnails.py --clean          # 清理没有对应记录的缩略图
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from qlm_common import (  # noqa: E402
    fail,
    human_size,
    info,
    load_env,
    ok,
    open_db,
    resolve_upload_dir,
    warn,
)

IMAGE_EXTS = {"png", "jpg", "jpeg", "gif", "webp", "bmp", "tif", "tiff"}
DEFAULT_MAX_EDGE = 640


def load_pillow():
    try:
        from PIL import Image  # type: ignore

        return Image
    except ImportError:
        return None


def fetch_image_files() -> list[dict]:
    conn = open_db()
    try:
        rows = conn.execute(
            "SELECT id, original_name, stored_name, ext, thumbnail, size FROM files ORDER BY id"
        ).fetchall()
        return [dict(row) for row in rows if (row["ext"] or "").lower() in IMAGE_EXTS]
    finally:
        conn.close()


def update_thumbnail(db_id: int, stored_name: str | None) -> None:
    conn = open_db()
    try:
        conn.execute("UPDATE files SET thumbnail = ? WHERE id = ?", (stored_name, db_id))
        conn.commit()
    finally:
        conn.close()


def generate(image_files: list[dict], upload_dir: Path, thumb_dir: Path, max_edge: int) -> tuple[int, int, int]:
    Image = load_pillow()
    created = skipped = missing = 0

    for record in image_files:
        source = upload_dir / record["stored_name"]
        if not source.exists():
            missing += 1
            warn(f"源文件丢失：{record['original_name']}")
            continue

        target = thumb_dir / record["stored_name"]
        if target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
            skipped += 1
            if record["thumbnail"] != record["stored_name"]:
                update_thumbnail(record["id"], record["stored_name"])
            continue

        if Image is None:
            break

        try:
            with Image.open(source) as img:
                img = img.convert("RGBA") if img.mode in ("P", "LA") else img
                img.thumbnail((max_edge, max_edge))
                if img.mode == "RGBA":
                    background = Image.new("RGB", img.size, (255, 255, 255))
                    background.paste(img, mask=img.split()[-1])
                    img = background
                img.save(target, format="JPEG", quality=82, optimize=True)
            update_thumbnail(record["id"], record["stored_name"])
            created += 1
            ok(f"{record['original_name']} → 缩略图 {human_size(target.stat().st_size)}")
        except Exception as err:  # noqa: BLE001
            fail(f"生成失败 {record['original_name']}：{err}")

    return created, skipped, missing


def clean(thumb_dir: Path, known_names: set[str]) -> int:
    if not thumb_dir.exists():
        info("缩略图目录不存在，无需清理")
        return 0
    removed = 0
    for item in thumb_dir.iterdir():
        if item.is_file() and item.name not in known_names:
            item.unlink()
            removed += 1
            info(f"已删除孤立缩略图：{item.name}")
    return removed


def main() -> int:
    parser = argparse.ArgumentParser(description="生成七零喵团队站点图片缩略图")
    parser.add_argument("--size", type=int, default=DEFAULT_MAX_EDGE, help="缩略图最长边像素（默认 640）")
    parser.add_argument("--check", action="store_true", help="仅统计，不生成")
    parser.add_argument("--clean", action="store_true", help="清理无对应记录的缩略图")
    args = parser.parse_args()

    config = load_env()
    upload_dir = resolve_upload_dir(config)
    thumb_dir = upload_dir / "thumbnails"
    thumb_dir.mkdir(parents=True, exist_ok=True)

    image_files = fetch_image_files()
    if not image_files:
        info("数据库中没有图片类文件")
        return 0

    have = sum(1 for r in image_files if (thumb_dir / r["stored_name"]).exists())
    need = len(image_files) - have
    info(f"图片文件 {len(image_files)} 个：已有缩略图 {have} 个，待生成 {need} 个")

    if args.check:
        for record in image_files:
            mark = "✓" if (thumb_dir / record["stored_name"]).exists() else "✗"
            print(f"  {mark} {record['original_name']}  ({human_size(record['size'])})")
        if need:
            warn("执行 `python3 tools/make_thumbnails.py` 生成缺失的缩略图")
        return 0

    removed = 0
    if args.clean:
        removed = clean(thumb_dir, {r["stored_name"] for r in image_files})

    if load_pillow() is None:
        warn("未安装 Pillow，无法生成缩略图（--check/--clean 仍可用）")
        print("  安装方式： pip3 install Pillow   或   apt install python3-pil")
        return 2 if need else 0

    created, skipped, missing = generate(image_files, upload_dir, thumb_dir, args.size)
    print()
    info(f"完成：新生成 {created} · 已存在 {skipped} · 源文件缺失 {missing} · 清理孤立 {removed}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
