#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
内容导入：把 JSON 中的项目 / 动态 / 成员 / 站点设置写入站点

用途：
  1. 从旧站（PHP 版 team.qlm.org.cn）批量迁移内容
  2. 从 CSV/Excel 导出的资料整理成 JSON 后一次性导入
  3. 新环境初始化时复用同一份内容底稿

两种模式：
  --mode sqlite （默认，直连数据库，需要先停止后端写入或承担极小的并发风险）
  --mode api    （通过 HTTP API 导入，会自动登录，适合远端站点）

JSON 结构见 tools/legacy-content.sample.json，字段均可选。
相同 slug / 同名成员会自动更新而不是重复插入（幂等）。

用法：
    python3 tools/import_legacy.py tools/legacy-content.sample.json
    python3 tools/import_legacy.py my-content.json --mode api --username admin --password 'xxx'
    python3 tools/import_legacy.py my-content.json --dry-run
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from qlm_common import (  # noqa: E402
    ApiClient,
    fail,
    info,
    load_env,
    ok,
    open_db,
    warn,
)


def load_payload(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("JSON 顶层必须是对象，例如 {\"projects\": [...], \"news\": [...], ...}")
    return data


def slugify(text: str, fallback: str) -> str:
    import re

    slug = re.sub(r"[^\w\u4e00-\u9fa5-]+", "-", str(text).strip().lower()).strip("-")
    return slug or fallback


# --------------------------------------------------------------------------- #
# 第三方（外链）下载条目
# --------------------------------------------------------------------------- #
def normalize_external(item: dict) -> dict:
    """把 JSON 中的一条第三方下载整理成统一结构（所有展示字段都可自定义）"""
    url = str(item.get("external_url") or item.get("url") or "").strip()
    extras = item.get("extras") or ""
    if isinstance(extras, dict):
        extras = "\n".join(f"{k}={v}" for k, v in extras.items())
    elif isinstance(extras, list):
        extras = "\n".join(str(x) for x in extras)
    return {
        "original_name": str(item.get("original_name") or item.get("title") or "").strip(),
        "external_url": url,
        "provider": str(item.get("provider") or "").strip(),
        "provider_icon": str(item.get("provider_icon") or item.get("icon") or "").strip(),
        "button_label": str(item.get("button_label") or item.get("button") or "").strip(),
        "tags": str(item.get("tags") or "").strip(),
        "access_code": str(item.get("access_code") or item.get("code") or "").strip(),
        "size_hint": str(item.get("size_hint") or item.get("size") or "").strip(),
        "category": str(item.get("category") or "第三方下载").strip(),
        "description": str(item.get("description") or "").strip(),
        "version": str(item.get("version") or "").strip(),
        "is_public": 0 if str(item.get("is_public", 1)) in ("0", "false", "False") else 1,
        "sort_order": int(item.get("sort_order") or item.get("pinned") or 0),
        "open_in_new_tab": 0 if str(item.get("open_in_new_tab", 1)) in ("0", "false", "False") else 1,
        "show_url": 0 if str(item.get("show_url", 1)) in ("0", "false", "False") else 1,
        "extras": str(extras).strip(),
    }


def validate_external(entry: dict) -> str | None:
    """返回错误信息；合法则返回 None"""
    if not entry["original_name"]:
        return "缺少文件名称（original_name/title）"
    if not entry["external_url"]:
        return "缺少下载链接（external_url/url）"
    if not re.match(r"^https?://[^\s]+$", entry["external_url"], re.IGNORECASE):
        return f"链接必须以 http:// 或 https:// 开头：{entry['external_url']}"
    return None


def provider_for(entry: dict) -> str:
    """未填平台时按域名粗略识别（与后端 PROVIDER_PATTERNS 保持一致的常见项）"""
    if entry["provider"]:
        return entry["provider"]
    table = [
        (r"curseforge\.com", "CurseForge"),
        (r"modrinth\.com", "Modrinth"),
        (r"github\.com", "GitHub"),
        (r"gitee\.com", "Gitee"),
        (r"pan\.baidu\.com", "百度网盘"),
        (r"lanzou[a-z]?\.com", "蓝奏云"),
        (r"(aliyundrive|alipan)\.com", "阿里云盘"),
        (r"pan\.quark\.cn", "夸克网盘"),
        (r"123pan\.com", "123 云盘"),
        (r"onedrive\.live\.com", "OneDrive"),
        (r"drive\.google\.com", "Google Drive"),
        (r"mega\.nz", "MEGA"),
        (r"mediafire\.com", "MediaFire"),
        (r"sourceforge\.net", "SourceForge"),
        (r"mc\.163\.com", "网易我的世界"),
        (r"weiyun\.com", "腾讯微云"),
        (r"itch\.io", "itch.io"),
    ]
    for pattern, name in table:
        if re.search(pattern, entry["external_url"], re.IGNORECASE):
            return name
    try:
        from urllib.parse import urlparse

        return urlparse(entry["external_url"]).hostname.replace("www.", "") or ""
    except Exception:  # noqa: BLE001
        return ""


# --------------------------------------------------------------------------- #
# sqlite 模式
# --------------------------------------------------------------------------- #
def import_sqlite(payload: dict, dry_run: bool) -> dict:
    conn = open_db()
    stats = {"settings": 0, "projects": 0, "news": 0, "members": 0, "external_files": 0, "skipped": 0}
    try:
        if dry_run:
            info("dry-run：不会写入数据库")

        for key, value in (payload.get("settings") or {}).items():
            stats["settings"] += 1
            if dry_run:
                continue
            conn.execute(
                """INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now','localtime'))
                   ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at""",
                (key, str(value)),
            )

        for item in payload.get("projects") or []:
            slug = item.get("slug") or slugify(item.get("title", ""), "project")
            stats["projects"] += 1
            if dry_run:
                continue
            conn.execute(
                """INSERT INTO projects (slug, title, category, version, summary, content, tags, repo_url, external_url, status, sort_order)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(slug) DO UPDATE SET
                     title = excluded.title, category = excluded.category, version = excluded.version,
                     summary = excluded.summary, content = excluded.content, tags = excluded.tags,
                     repo_url = excluded.repo_url, external_url = excluded.external_url,
                     status = excluded.status, sort_order = excluded.sort_order,
                     updated_at = datetime('now','localtime')""",
                (
                    slug,
                    item.get("title", ""),
                    item.get("category", "其他"),
                    item.get("version", ""),
                    item.get("summary", ""),
                    item.get("content", ""),
                    item.get("tags", ""),
                    item.get("repo_url", ""),
                    item.get("external_url", ""),
                    item.get("status", "published"),
                    int(item.get("sort_order", 0)),
                ),
            )

        for item in payload.get("news") or []:
            slug = item.get("slug") or slugify(item.get("title", ""), "news")
            stats["news"] += 1
            if dry_run:
                continue
            conn.execute(
                """INSERT INTO news (slug, title, category, summary, content, status, published_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(slug) DO UPDATE SET
                     title = excluded.title, category = excluded.category, summary = excluded.summary,
                     content = excluded.content, status = excluded.status, published_at = excluded.published_at,
                     updated_at = datetime('now','localtime')""",
                (
                    slug,
                    item.get("title", ""),
                    item.get("category", "动态"),
                    item.get("summary", ""),
                    item.get("content", ""),
                    item.get("status", "published"),
                    item.get("published_at", ""),
                ),
            )

        for item in payload.get("members") or []:
            stats["members"] += 1
            if dry_run:
                continue
            name = item.get("name", "")
            row = conn.execute("SELECT id FROM members WHERE name = ?", (name,)).fetchone()
            if row:
                conn.execute(
                    """UPDATE members SET role = ?, skills = ?, bio = ?, joined_at = ?, sort_order = ?
                       WHERE id = ?""",
                    (
                        item.get("role", "成员"),
                        item.get("skills", ""),
                        item.get("bio", ""),
                        item.get("joined_at", ""),
                        int(item.get("sort_order", 0)),
                        row["id"],
                    ),
                )
            else:
                conn.execute(
                    """INSERT INTO members (name, role, skills, bio, joined_at, sort_order)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (
                        name,
                        item.get("role", "成员"),
                        item.get("skills", ""),
                        item.get("bio", ""),
                        item.get("joined_at", ""),
                        int(item.get("sort_order", 0)),
                    ),
                )

        # 第三方（外链）下载条目
        for raw in payload.get("external_files") or []:
            entry = normalize_external(raw)
            error = validate_external(entry)
            if error:
                warn(f"跳过第三方条目（{error}）")
                stats["skipped"] += 1
                continue
            stats["external_files"] += 1
            if dry_run:
                continue
            stored_name = "external-import-" + hashlib.md5(entry["external_url"].encode("utf-8")).hexdigest()[:16]
            provider = provider_for(entry)
            existing = conn.execute("SELECT id FROM files WHERE stored_name = ?", (stored_name,)).fetchone()
            if existing:
                conn.execute(
                    """UPDATE files SET original_name = ?, category = ?, description = ?, version = ?,
                                        provider = ?, provider_icon = ?, button_label = ?, tags = ?,
                                        access_code = ?, size_hint = ?, sort_order = ?, open_in_new_tab = ?,
                                        show_url = ?, extras = ?, is_public = ?
                       WHERE id = ?""",
                    (
                        entry["original_name"],
                        entry["category"],
                        entry["description"],
                        entry["version"],
                        provider,
                        entry["provider_icon"],
                        entry["button_label"],
                        entry["tags"],
                        entry["access_code"],
                        entry["size_hint"],
                        entry["sort_order"],
                        entry["open_in_new_tab"],
                        entry["show_url"],
                        entry["extras"],
                        entry["is_public"],
                        existing["id"],
                    ),
                )
            else:
                conn.execute(
                    """INSERT INTO files (original_name, stored_name, ext, mime, size, sha256, category,
                                          description, version, is_public, source, external_url, provider,
                                          provider_icon, button_label, tags, access_code, size_hint,
                                          sort_order, open_in_new_tab, show_url, extras)
                       VALUES (?, ?, '', 'text/html', 0, '', ?, ?, ?, ?, 'external', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        entry["original_name"],
                        stored_name,
                        entry["category"],
                        entry["description"],
                        entry["version"],
                        entry["is_public"],
                        entry["external_url"],
                        provider,
                        entry["provider_icon"],
                        entry["button_label"],
                        entry["tags"],
                        entry["access_code"],
                        entry["size_hint"],
                        entry["sort_order"],
                        entry["open_in_new_tab"],
                        entry["show_url"],
                        entry["extras"],
                    ),
                )

        if not dry_run:
            conn.commit()
    except sqlite3.Error as err:
        conn.rollback()
        raise RuntimeError(f"数据库写入失败：{err}") from err
    finally:
        conn.close()
    return stats


# --------------------------------------------------------------------------- #
# api 模式
# --------------------------------------------------------------------------- #
def import_api(payload: dict, client: ApiClient, dry_run: bool) -> dict:
    stats = {"settings": 0, "projects": 0, "news": 0, "members": 0, "external_files": 0, "skipped": 0}

    if payload.get("settings"):
        stats["settings"] = len(payload["settings"])
        if not dry_run:
            client.put("/site/settings", payload["settings"])

    existing_projects = {}
    existing_news = {}
    existing_members = {}
    if not dry_run:
        try:
            for item in client.get("/projects?scope=all&pageSize=100").get("data", {}).get("items", []):
                existing_projects[item["slug"]] = item["id"]
            for item in client.get("/news?scope=all&pageSize=100").get("data", {}).get("items", []):
                existing_news[item["slug"]] = item["id"]
            for item in client.get("/members").get("data", {}).get("items", []):
                existing_members[item["name"]] = item["id"]
        except Exception as err:  # noqa: BLE001
            warn(f"读取已有内容失败，将全部按新增处理：{err}")

    for item in payload.get("projects") or []:
        stats["projects"] += 1
        if dry_run:
            continue
        slug = item.get("slug") or slugify(item.get("title", ""), "project")
        body = {
            "title": item.get("title", ""),
            "slug": slug,
            "category": item.get("category", "其他"),
            "version": item.get("version", ""),
            "summary": item.get("summary", ""),
            "content": item.get("content", ""),
            "tags": item.get("tags", ""),
            "repoUrl": item.get("repo_url", ""),
            "externalUrl": item.get("external_url", ""),
            "status": item.get("status", "published"),
            "sortOrder": item.get("sort_order", 0),
        }
        if slug in existing_projects:
            client.put(f"/projects/{existing_projects[slug]}", body)
        else:
            client.post("/projects", body)

    for item in payload.get("news") or []:
        stats["news"] += 1
        if dry_run:
            continue
        slug = item.get("slug") or slugify(item.get("title", ""), "news")
        body = {
            "title": item.get("title", ""),
            "slug": slug,
            "category": item.get("category", "动态"),
            "summary": item.get("summary", ""),
            "content": item.get("content", ""),
            "status": item.get("status", "published"),
            "publishedAt": item.get("published_at", ""),
        }
        if slug in existing_news:
            client.put(f"/news/{existing_news[slug]}", body)
        else:
            client.post("/news", body)

    for item in payload.get("members") or []:
        stats["members"] += 1
        if dry_run:
            continue
        name = item.get("name", "")
        body = {
            "name": name,
            "role": item.get("role", "成员"),
            "skills": item.get("skills", ""),
            "bio": item.get("bio", ""),
            "joinedAt": item.get("joined_at", ""),
            "sortOrder": item.get("sort_order", 0),
        }
        if name in existing_members:
            client.put(f"/members/{existing_members[name]}", body)
        else:
            client.post("/members", body)

    # 第三方（外链）下载条目：按「名称 + 链接」判重，已存在则更新
    external_list = payload.get("external_files") or []
    if external_list and not dry_run:
        existing_external = {}
        try:
            page = 1
            while True:
                res = client.get(f"/files?scope=all&pageSize=100&page={page}")
                data = res.get("data", {})
                for item in data.get("items", []):
                    if item.get("isExternal"):
                        existing_external[(item["originalName"], item.get("externalUrl", ""))] = item["id"]
                if page >= data.get("totalPages", 1):
                    break
                page += 1
        except Exception as err:  # noqa: BLE001
            warn(f"读取已有第三方条目失败，将全部按新增处理：{err}")

    for raw in external_list:
        entry = normalize_external(raw)
        error = validate_external(entry)
        if error:
            warn(f"跳过第三方条目（{error}）")
            stats["skipped"] += 1
            continue
        stats["external_files"] += 1
        if dry_run:
            continue
        provider = provider_for(entry)
        key = (entry["original_name"], entry["external_url"])
        payload = {
            "provider": provider,
            "providerIcon": entry["provider_icon"],
            "buttonLabel": entry["button_label"],
            "tags": entry["tags"],
            "accessCode": entry["access_code"],
            "sizeHint": entry["size_hint"],
            "category": entry["category"],
            "description": entry["description"],
            "version": entry["version"],
            "isPublic": bool(entry["is_public"]),
            "sortOrder": entry["sort_order"],
            "openInNewTab": bool(entry["open_in_new_tab"]),
            "showUrl": bool(entry["show_url"]),
            "extras": entry["extras"],
        }
        if key in existing_external:
            client.patch(f"/files/{existing_external[key]}", payload)
        else:
            client.post(
                "/files/external",
                {
                    "originalName": entry["original_name"],
                    "externalUrl": entry["external_url"],
                    **payload,
                },
            )

    return stats


def main() -> int:
    parser = argparse.ArgumentParser(description="导入项目/动态/成员/第三方下载内容到站点")
    parser.add_argument("file", help="JSON 内容文件路径")
    parser.add_argument("--mode", choices=["sqlite", "api"], default="sqlite", help="导入方式，默认 sqlite")
    parser.add_argument("--base", help="api 模式下的 API 基地址")
    parser.add_argument("--username", default="admin")
    parser.add_argument("--password", default="")
    parser.add_argument("--dry-run", action="store_true", help="只统计不写入")
    args = parser.parse_args()

    path = Path(args.file).expanduser().resolve()
    if not path.exists():
        fail(f"文件不存在：{path}")
        return 1

    try:
        payload = load_payload(path)
    except (json.JSONDecodeError, ValueError) as err:
        fail(f"JSON 解析失败：{err}")
        return 1

    counts = {k: len(payload.get(k) or []) for k in ("projects", "news", "members", "external_files")}
    info(
        f"读取 {path.name}：项目 {counts['projects']} · 动态 {counts['news']} · "
        f"成员 {counts['members']} · 第三方下载 {counts['external_files']}"
    )

    try:
        if args.mode == "sqlite":
            load_env()
            stats = import_sqlite(payload, args.dry_run)
        else:
            if not args.password:
                fail("api 模式需要 --password 或环境变量 QLM_PASSWORD")
                return 1
            client = ApiClient(base=args.base)
            client.login(args.username, args.password)
            stats = import_api(payload, client, args.dry_run)
    except Exception as err:  # noqa: BLE001
        fail(f"导入失败：{err}")
        return 1

    ok(f"导入完成：{stats}")
    if args.dry_run:
        warn("dry-run 模式，未实际写入")
    return 0


if __name__ == "__main__":
    sys.exit(main())
