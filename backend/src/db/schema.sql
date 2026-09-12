-- 七零喵团队站点 数据库结构 (SQLite)
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'admin',
  last_login_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS files (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  original_name  TEXT NOT NULL,
  stored_name    TEXT NOT NULL UNIQUE,
  ext            TEXT NOT NULL DEFAULT '',
  mime           TEXT NOT NULL DEFAULT 'application/octet-stream',
  size           INTEGER NOT NULL DEFAULT 0,
  sha256         TEXT NOT NULL DEFAULT '',
  category       TEXT NOT NULL DEFAULT '其他',
  description    TEXT NOT NULL DEFAULT '',
  version        TEXT NOT NULL DEFAULT '',
  thumbnail      TEXT,
  is_public      INTEGER NOT NULL DEFAULT 1,
  download_count INTEGER NOT NULL DEFAULT 0,
  uploader_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  -- 第三方式下载：source=external 时文件不落在本站，下载按钮跳转 external_url
  -- 以下字段全部可选，用于前台展示的自由定制
  source         TEXT NOT NULL DEFAULT 'local',
  external_url   TEXT NOT NULL DEFAULT '',
  provider       TEXT NOT NULL DEFAULT '',
  provider_icon  TEXT NOT NULL DEFAULT '',
  button_label   TEXT NOT NULL DEFAULT '',
  tags           TEXT NOT NULL DEFAULT '',
  access_code    TEXT NOT NULL DEFAULT '',
  size_hint      TEXT NOT NULL DEFAULT '',
  sort_order     INTEGER NOT NULL DEFAULT 0,
  open_in_new_tab INTEGER NOT NULL DEFAULT 1,
  show_url       INTEGER NOT NULL DEFAULT 1,
  extras         TEXT NOT NULL DEFAULT '',
  -- 第三方链接检测结果（跳转前连通性 + 跳转链）
  last_check_at       TEXT NOT NULL DEFAULT '',
  last_check_status   INTEGER NOT NULL DEFAULT 0,
  last_check_final_url TEXT NOT NULL DEFAULT '',
  last_check_error    TEXT NOT NULL DEFAULT '',
  last_check_ms       INTEGER NOT NULL DEFAULT 0,
  last_check_hops     INTEGER NOT NULL DEFAULT 0,
  check_fail_count    INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_files_category ON files (category);
CREATE INDEX IF NOT EXISTS idx_files_created ON files (created_at DESC);
-- 注意：idx_files_source 依赖后加的 source 列，必须在列迁移之后创建，
-- 因此它写在 src/db/index.js 的 migrate() 里而不是这里（否则老库升级会启动失败）。

CREATE TABLE IF NOT EXISTS projects (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT '其他',
  version       TEXT NOT NULL DEFAULT '',
  summary       TEXT NOT NULL DEFAULT '',
  content       TEXT NOT NULL DEFAULT '',
  cover_file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
  tags          TEXT NOT NULL DEFAULT '',
  repo_url      TEXT NOT NULL DEFAULT '',
  external_url  TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'published',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  views         INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status);

CREATE TABLE IF NOT EXISTS project_files (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_id    INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, file_id)
);

CREATE TABLE IF NOT EXISTS news (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT '动态',
  summary       TEXT NOT NULL DEFAULT '',
  content       TEXT NOT NULL DEFAULT '',
  cover_file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'published',
  views         INTEGER NOT NULL DEFAULT 0,
  published_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_news_published ON news (published_at DESC);

CREATE TABLE IF NOT EXISTS members (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT '成员',
  skills          TEXT NOT NULL DEFAULT '',
  bio             TEXT NOT NULL DEFAULT '',
  avatar_file_id  INTEGER REFERENCES files(id) ON DELETE SET NULL,
  joined_at       TEXT NOT NULL DEFAULT '',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  subject    TEXT NOT NULL DEFAULT '',
  content    TEXT NOT NULL,
  ip         TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages (status);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  target     TEXT NOT NULL DEFAULT '',
  detail     TEXT NOT NULL DEFAULT '',
  ip         TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at DESC);

-- 统计视图：站点数据概览
CREATE VIEW IF NOT EXISTS v_site_stats AS
SELECT
  (SELECT COUNT(*) FROM projects WHERE status = 'published') AS project_count,
  (SELECT COUNT(*) FROM news WHERE status = 'published')     AS news_count,
  (SELECT COUNT(*) FROM files WHERE is_public = 1)           AS file_count,
  (SELECT COUNT(*) FROM files WHERE is_public = 1 AND source = 'external') AS external_file_count,
  (SELECT COUNT(*) FROM files WHERE is_public = 1 AND COALESCE(source,'local') = 'local') AS local_file_count,
  (SELECT COALESCE(SUM(size), 0) FROM files)                 AS file_bytes,
  (SELECT COALESCE(SUM(download_count), 0) FROM files)       AS download_count,
  (SELECT COUNT(*) FROM members)                             AS member_count,
  (SELECT COUNT(*) FROM messages WHERE status = 'new')       AS unread_message_count;
