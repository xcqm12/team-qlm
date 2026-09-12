#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
一体化备份：SQLite 数据库（一致性快照）+ 上传目录（tar.gz）+ 可选 JSON 导出

用法示例：
    python3 tools/backup.py                          # 备份到 backups/
    python3 tools/backup.py --out /www/backup        # 指定备份目录
    python3 tools/backup.py --keep 14                # 仅保留最近 14 份
    python3 tools/backup.py --no-uploads             # 只备份数据库
    python3 tools/backup.py --list                   # 列出已有备份

建议在宝塔面板「计划任务」中每天执行一次：
    0 3 * * * cd /www/wwwroot/team-site && /usr/bin/python3 tools/backup.py --keep 14
"""
from __future__ import annotations

import argparse
import json
import shutil
import sqlite3
import sys
import tarfile
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from qlm_common import (  # noqa: E402
    BACKEND_DIR,
    PROJECT_ROOT,
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

DEFAULT_OUT_DIR = PROJECT_ROOT / "backups"


def stamp() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def backup_database(db_file: Path, out_dir: Path, tag: str) -> Path:
    """使用 sqlite3 在线备份 API，保证 WAL 模式下数据一致"""
    target = out_dir / f"team-site-{tag}.db"
    source = sqlite3.connect(f"file:{db_file}?mode=ro", uri=True)
    try:
        dest = sqlite3.connect(str(target))
        try:
            source.backup(dest)
        finally:
            dest.close()
    finally:
        source.close()
    return target


def backup_uploads(upload_dir: Path, out_dir: Path, tag: str) -> Path | None:
    if not upload_dir.exists():
        warn(f"上传目录不存在，跳过：{upload_dir}")
        return None
    target = out_dir / f"uploads-{tag}.tar.gz"
    with tarfile.open(target, "w:gz") as tar:
        tar.add(upload_dir, arcname="uploads")
    return target


def export_json(db_file: Path, out_dir: Path, tag: str) -> Path:
    """把核心内容导出为 JSON，便于迁移到其他系统/人工查看"""
    conn = sqlite3.connect(str(db_file))
    conn.row_factory = sqlite3.Row
    dump: dict[str, list[dict]] = {}
    try:
        for table in ("settings", "projects", "news", "members", "files", "messages"):
            try:
                rows = conn.execute(f"SELECT * FROM {table}").fetchall()
            except sqlite3.Error:
                continue
            dump[table] = [dict(row) for row in rows]
    finally:
        conn.close()
    target = out_dir / f"content-{tag}.json"
    target.write_text(json.dumps(dump, ensure_ascii=False, indent=2), encoding="utf-8")
    return target


def prune(out_dir: Path, keep: int) -> list[Path]:
    """按时间保留最近 keep 组备份（每组 = 同一时间戳的 db/tar.gz/json）"""
    groups: dict[str, int] = {}
    for item in out_dir.iterdir():
        if not item.is_file():
            continue
        parts = item.stem.split("-")
        if len(parts) >= 4:
            key = "-".join(parts[-2:]) if parts[-2].isdigit() else item.stem
        else:
            key = item.stem
        # 以文件名中的时间戳为组键：xxx-YYYYmmdd-HHMMSS
        key = "-".join(item.name.split("-")[-2:]).split(".")[0]
        groups[key] = groups.get(key, 0) + 1

    ordered = sorted(groups.keys())
    removed: list[Path] = []
    if keep > 0 and len(ordered) > keep:
        for key in ordered[: len(ordered) - keep]:
            for item in out_dir.iterdir():
                if key in item.name:
                    item.unlink()
                    removed.append(item)
    return removed


def list_backups(out_dir: Path) -> None:
    if not out_dir.exists():
        warn(f"备份目录不存在：{out_dir}")
        return
    items = sorted(out_dir.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
    if not items:
        info("暂无备份")
        return
    print(f"备份目录：{out_dir}")
    total = 0
    for item in items:
        size = item.stat().st_size
        total += size
        print(f"  {item.name.ljust(40)} {human_size(size).rjust(10)}  {datetime.fromtimestamp(item.stat().st_mtime):%Y-%m-%d %H:%M}")
    print(f"  共 {len(items)} 个文件，合计 {human_size(total)}")


def main() -> int:
    parser = argparse.ArgumentParser(description="七零喵团队站点备份工具")
    parser.add_argument("--out", default=str(DEFAULT_OUT_DIR), help="备份输出目录")
    parser.add_argument("--keep", type=int, default=10, help="保留最近 N 组备份（0 表示不清理）")
    parser.add_argument("--no-uploads", action="store_true", help="不打包上传目录（仅数据库+JSON）")
    parser.add_argument("--json", action="store_true", help="额外导出内容 JSON")
    parser.add_argument("--list", action="store_true", help="列出已有备份后退出")
    args = parser.parse_args()

    out_dir = Path(args.out).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.list:
        list_backups(out_dir)
        return 0

    config = load_env()
    db_file = resolve_db_file(config)
    upload_dir = resolve_upload_dir(config)

    if not db_file.exists():
        fail(f"数据库不存在：{db_file}")
        return 1

    tag = stamp()
    created: list[Path] = []
    try:
        created.append(backup_database(db_file, out_dir, tag))
        if not args.no_uploads:
            archive = backup_uploads(upload_dir, out_dir, tag)
            if archive:
                created.append(archive)
        if args.json:
            created.append(export_json(db_file, out_dir, tag))
    except Exception as err:  # noqa: BLE001
        fail(f"备份失败：{err}")
        return 1

    print(f"{Color.BOLD}备份完成{Color.END}")
    for item in created:
        ok(f"{item.name}  ({human_size(item.stat().st_size)})")
    info(f"输出目录：{out_dir}")

    removed = prune(out_dir, args.keep)
    if removed:
        info(f"已清理 {len(removed)} 个过期备份（保留最近 {args.keep} 组）")

    print("\n恢复方法：")
    print("  1) 停止后端：systemctl stop team-site   （或宝塔「Node 项目」中停止）")
    print(f"  2) 覆盖数据库：cp {created[0].name} backend/data/team-site.db")
    print("  3) 解包上传目录：tar -xzf uploads-*.tar.gz -C backend/data/")
    print("  4) 重新启动后端")
    return 0


if __name__ == "__main__":
    sys.exit(main())
