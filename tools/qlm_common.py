#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
七零喵团队站点 · Python 工具公共库（仅依赖标准库）

提供：
  - 读取 backend/.env 配置
  - 极简 HTTP 客户端（含 multipart 文件上传）
  - SQLite 直连帮助函数

这样在宝塔/任意 Linux 上只要系统自带 python3 就能跑运维脚本，无需 pip install。
"""
from __future__ import annotations

import json
import mimetypes
import os
import sqlite3
import ssl
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
DEFAULT_ENV_FILE = BACKEND_DIR / ".env"


# --------------------------------------------------------------------------- #
# 配置
# --------------------------------------------------------------------------- #
def load_env(env_file: Optional[Path] = None) -> Dict[str, str]:
    """解析 backend/.env（KEY=VALUE 形式），缺失时返回空字典"""
    env_file = Path(env_file) if env_file else DEFAULT_ENV_FILE
    config: Dict[str, str] = {}
    if env_file.exists():
        for raw in env_file.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            config[key.strip()] = value.strip().strip('"').strip("'")
    return config


def resolve_path(value: str, base: Path = BACKEND_DIR) -> Path:
    path = Path(value)
    return path if path.is_absolute() else (base / path).resolve()


def resolve_db_file(config: Optional[Dict[str, str]] = None) -> Path:
    config = config or load_env()
    return resolve_path(config.get("DB_FILE", "./data/team-site.db"))


def resolve_upload_dir(config: Optional[Dict[str, str]] = None) -> Path:
    config = config or load_env()
    return resolve_path(config.get("UPLOAD_DIR", "./data/uploads"))


def api_base(config: Optional[Dict[str, str]] = None) -> str:
    config = config or load_env()
    host = config.get("HOST") or "127.0.0.1"
    if host in ("0.0.0.0", "::"):
        host = "127.0.0.1"
    port = config.get("PORT") or "8787"
    return os.environ.get("QLM_API_BASE") or f"http://{host}:{port}/api"


# --------------------------------------------------------------------------- #
# HTTP 客户端
# --------------------------------------------------------------------------- #
class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    """禁止自动跟随 302/301

    站点的第三方下载接口会用 302 跳到外部平台；运维脚本如果自动跟随，
    就会真的去访问第三方（甚至下载文件）。这里统一不跟随，把跳转交给调用方判断。
    """

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: D102
        return None


class ApiClient:
    """标准库实现的 API 客户端，支持 JSON 与 multipart 上传"""

    def __init__(
        self,
        base: Optional[str] = None,
        token: Optional[str] = None,
        timeout: int = 60,
        follow_redirects: bool = False,
    ):
        self.base = (base or api_base()).rstrip("/")
        self.token = token
        self.timeout = timeout
        self.follow_redirects = follow_redirects
        self._ssl_ctx = ssl.create_default_context()
        handlers: List[urllib.request.BaseHandler] = []
        if not follow_redirects:
            handlers.append(_NoRedirectHandler())
        self._opener = urllib.request.build_opener(*handlers)

    # -- 内部 ------------------------------------------------------------- #
    def _headers(self, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        headers = {"Accept": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        if extra:
            headers.update(extra)
        return headers

    def _request(self, method: str, url: str, data: Optional[bytes], headers: Dict[str, str]):
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with self._opener.open(req, timeout=self.timeout) as resp:
                body = resp.read()
                return resp.status, body
        except urllib.error.HTTPError as err:
            # 3xx（未跟随跳转）与 4xx/5xx 都会走到这里，统一返回状态码供调用方判断
            return err.code, err.read()
        except urllib.error.URLError as err:
            raise RuntimeError(f"无法连接 {url}: {err.reason}") from err

    def head_status(self, path: str) -> tuple[int, str]:
        """只取状态码与 Location 头（用于验证跳转行为，不产生下载）"""
        url = f"{self.base}{path}"
        req = urllib.request.Request(url, headers=self._headers(), method="GET")
        try:
            with self._opener.open(req, timeout=self.timeout) as resp:
                return resp.status, resp.headers.get("Location", "")
        except urllib.error.HTTPError as err:
            return err.code, err.headers.get("Location", "") if err.headers else ""
        except urllib.error.URLError as err:
            raise RuntimeError(f"无法连接 {url}: {err.reason}") from err

    @staticmethod
    def _decode(body: bytes) -> Any:
        if not body:
            return None
        try:
            return json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return body.decode("utf-8", errors="replace")

    # -- 公开方法 --------------------------------------------------------- #
    def request(self, method: str, path: str, payload: Optional[dict] = None) -> Any:
        url = f"{self.base}{path}"
        headers = self._headers({"Content-Type": "application/json"} if payload is not None else None)
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        status, body = self._request(method, url, data, headers)
        parsed = self._decode(body)
        if status >= 400:
            message = parsed.get("message") if isinstance(parsed, dict) else parsed
            raise RuntimeError(f"HTTP {status}: {message}")
        return parsed

    def get(self, path: str) -> Any:
        return self.request("GET", path)

    def post(self, path: str, payload: Optional[dict] = None) -> Any:
        return self.request("POST", path, payload)

    def put(self, path: str, payload: Optional[dict] = None) -> Any:
        return self.request("PUT", path, payload)

    def patch(self, path: str, payload: Optional[dict] = None) -> Any:
        return self.request("PATCH", path, payload)

    def delete(self, path: str) -> Any:
        return self.request("DELETE", path)

    def login(self, username: str, password: str) -> str:
        result = self.post("/auth/login", {"username": username, "password": password})
        self.token = result["data"]["token"]
        return self.token

    def upload(
        self,
        file_path: Path,
        category: str = "其他",
        description: str = "",
        version: str = "",
        is_public: bool = True,
    ) -> Any:
        """multipart/form-data 上传单个文件"""
        file_path = Path(file_path)
        if not file_path.is_file():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        boundary = f"----qlm{uuid.uuid4().hex}"
        mime = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        parts: List[bytes] = []

        def add_field(name: str, value: str) -> None:
            parts.append(
                f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode("utf-8")
            )

        add_field("category", category)
        add_field("description", description)
        add_field("version", version)
        add_field("isPublic", "1" if is_public else "0")
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{file_path.name}"\r\n'
            f"Content-Type: {mime}\r\n\r\n".encode("utf-8")
        )
        parts.append(file_path.read_bytes())
        parts.append(f"\r\n--{boundary}--\r\n".encode("utf-8"))
        body = b"".join(parts)

        headers = self._headers(
            {
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "Content-Length": str(len(body)),
            }
        )
        status, raw = self._request("POST", f"{self.base}/files", body, headers)
        parsed = self._decode(raw)
        if status >= 400:
            message = parsed.get("message") if isinstance(parsed, dict) else parsed
            raise RuntimeError(f"上传失败 HTTP {status}: {message}")
        return parsed


# --------------------------------------------------------------------------- #
# SQLite
# --------------------------------------------------------------------------- #
def open_db(db_file: Optional[Path] = None) -> sqlite3.Connection:
    db_file = Path(db_file) if db_file else resolve_db_file()
    if not db_file.exists():
        raise FileNotFoundError(f"数据库不存在: {db_file}（请先启动一次后端或执行 npm run db:init）")
    conn = sqlite3.connect(str(db_file))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def ensure_columns(conn: sqlite3.Connection, table: str, columns: Iterable[str]) -> None:
    """若表缺少某列则补齐（便于老库平滑升级）"""
    existing = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}
    for column in columns:
        if column not in existing:
            raise RuntimeError(f"表 {table} 缺少列 {column}，请先升级后端并重启以完成建表")


# --------------------------------------------------------------------------- #
# 输出
# --------------------------------------------------------------------------- #
class Color:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    BOLD = "\033[1m"
    END = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        cls.GREEN = cls.RED = cls.YELLOW = cls.BLUE = cls.BOLD = cls.END = ""


if not sys.stdout.isatty() or os.environ.get("NO_COLOR"):
    Color.disable()


class Symbols:
    """输出标记：UTF-8 终端用表情，非 UTF-8 终端自动降级为 ASCII，避免编码异常"""

    OK = "✅"
    FAIL = "❌"
    WARN = "⚠️ "
    INFO = "ℹ️  "


def _setup_stdio() -> None:
    """把标准输出切到 UTF-8（Windows 默认 GBK 会因中文/表情报错）"""
    for name in ("stdout", "stderr"):
        stream = getattr(sys, name, None)
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except (ValueError, OSError):
                pass
    encoding = (getattr(sys.stdout, "encoding", "") or "").lower()
    if "utf" not in encoding:
        Color.disable()
        Symbols.OK, Symbols.FAIL, Symbols.WARN, Symbols.INFO = "[OK]", "[ERR]", "[WARN]", "[INFO]"


_setup_stdio()


def ok(message: str) -> None:
    print(f"{Color.GREEN}{Symbols.OK} {message}{Color.END}")


def fail(message: str) -> None:
    print(f"{Color.RED}{Symbols.FAIL} {message}{Color.END}")


def warn(message: str) -> None:
    print(f"{Color.YELLOW}{Symbols.WARN} {message}{Color.END}")


def info(message: str) -> None:
    print(f"{Color.BLUE}{Symbols.INFO} {message}{Color.END}")


def human_size(num_bytes: float) -> str:
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(num_bytes)
    for unit in units:
        if size < 1024 or unit == units[-1]:
            return f"{size:.1f} {unit}" if unit != "B" else f"{int(size)} B"
        size /= 1024
    return f"{size:.1f} TB"


def print_table(rows: List[Tuple[str, str]], title: Optional[str] = None) -> None:
    if title:
        print(f"\n{Color.BOLD}{title}{Color.END}")
    width = max((len(str(r[0])) for r in rows), default=0)
    for key, value in rows:
        print(f"  {str(key).ljust(width)}  {value}")
