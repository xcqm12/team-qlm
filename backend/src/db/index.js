/**
 * 数据库访问层：SQLite
 *
 * 驱动优先级：
 *   1. better-sqlite3（若已安装，性能更好）
 *   2. node:sqlite（Node.js 22.5+ 内置，零依赖、无需编译，宝塔部署默认走这条）
 *
 * 两者 API 高度一致，这里做统一适配，业务代码无感知。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config, ensureRuntimeDirs } from '../config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

ensureRuntimeDirs()

const loadDriver = async () => {
  // 1) 优先 better-sqlite3（若服务器上装好了原生模块，性能更好）
  try {
    const mod = await import('better-sqlite3')
    const BetterDatabase = mod.default
    const probe = new BetterDatabase(config.dbFile)
    probe.close()
    return {
      name: 'better-sqlite3',
      version: BetterDatabase.VERSION || 'unknown',
      open: (file) => new BetterDatabase(file)
    }
  } catch (err) {
    if (err?.code !== 'ERR_MODULE_NOT_FOUND' && err?.code !== 'MODULE_NOT_FOUND') {
      console.warn('[db] better-sqlite3 不可用，回退 node:sqlite:', err.message)
    }
  }

  // 2) 回退 Node 内置 SQLite（Node.js 22.5+，零依赖零编译）
  try {
    const { DatabaseSync } = await import('node:sqlite')
    return { name: 'node:sqlite', version: process.version, open: (file) => new DatabaseSync(file) }
  } catch (err) {
    throw new Error(
      `未找到可用的 SQLite 驱动。请安装 better-sqlite3，或升级到 Node.js 22.5+（内置 node:sqlite）。当前 Node ${process.version}。原因: ${err.message}`
    )
  }
}

const driver = await loadDriver()

export const db = driver.open(config.dbFile)
export const driverInfo = { name: driver.name, version: driver.version, file: config.dbFile }

// 关键 PRAGMA：WAL 提升并发读写表现，外键约束保证关联完整性
try {
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA busy_timeout = 5000')
  db.exec('PRAGMA synchronous = NORMAL')
} catch (err) {
  console.warn('[db] PRAGMA 设置失败（可忽略）:', err.message)
}

/**
 * 列迁移：SQLite 的 CREATE TABLE IF NOT EXISTS 不会给已有表补列，
 * 这里按 PRAGMA 检查并 ALTER TABLE 补齐，保证老库升级后也能用新功能（幂等）。
 * 新增字段时，在这里登记即可。
 */
const COLUMN_MIGRATIONS = {
  files: [
    ['source', "TEXT NOT NULL DEFAULT 'local'"],
    ['external_url', "TEXT NOT NULL DEFAULT ''"],
    ['provider', "TEXT NOT NULL DEFAULT ''"],
    ['access_code', "TEXT NOT NULL DEFAULT ''"],
    ['size_hint', "TEXT NOT NULL DEFAULT ''"],
    // 第三方下载的「全部自定义」字段
    ['provider_icon', "TEXT NOT NULL DEFAULT ''"],
    ['button_label', "TEXT NOT NULL DEFAULT ''"],
    ['tags', "TEXT NOT NULL DEFAULT ''"],
    ['sort_order', 'INTEGER NOT NULL DEFAULT 0'],
    ['open_in_new_tab', 'INTEGER NOT NULL DEFAULT 1'],
    ['show_url', 'INTEGER NOT NULL DEFAULT 1'],
    ['extras', "TEXT NOT NULL DEFAULT ''"],
    // 第三方链接检测（跳转前连通性与跳转链记录）
    ['last_check_at', "TEXT NOT NULL DEFAULT ''"],
    ['last_check_status', 'INTEGER NOT NULL DEFAULT 0'],
    ['last_check_final_url', "TEXT NOT NULL DEFAULT ''"],
    ['last_check_error', "TEXT NOT NULL DEFAULT ''"],
    ['last_check_ms', 'INTEGER NOT NULL DEFAULT 0'],
    ['last_check_hops', 'INTEGER NOT NULL DEFAULT 0'],
    ['check_fail_count', 'INTEGER NOT NULL DEFAULT 0']
  ]
}

const applyColumnMigrations = () => {
  const applied = []
  for (const [table, columns] of Object.entries(COLUMN_MIGRATIONS)) {
    const exists = get(`SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?`, [table])
    if (!exists) continue
    const current = new Set(query(`SELECT name FROM pragma_table_info(?)`, [table]).map((row) => row.name))
    for (const [column, definition] of columns) {
      if (current.has(column)) continue
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
      applied.push(`${table}.${column}`)
    }
  }
  if (applied.length) console.log('[db] 已补齐字段:', applied.join(', '))
  return applied
}

/** 执行建表语句（幂等）+ 补齐历史库缺失字段 */
export const migrate = () => {
  // 视图定义可能随版本变化，先删除再由 schema.sql 重建，保证统计口径始终最新
  db.exec('DROP VIEW IF EXISTS v_site_stats')
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
  db.exec(schema)
  applyColumnMigrations()
  // idx_files_source 依赖后加的 source 列，必须在补列之后再创建
  db.exec('CREATE INDEX IF NOT EXISTS idx_files_source ON files (source)')
  return true
}

const stmt = (sql) => db.prepare(sql)

export const query = (sql, params = []) => {
  const s = stmt(sql)
  return Array.isArray(params) ? s.all(...params) : s.all(params)
}

export const get = (sql, params = []) => {
  const s = stmt(sql)
  return Array.isArray(params) ? s.get(...params) : s.get(params)
}

export const run = (sql, params = []) => {
  const s = stmt(sql)
  return Array.isArray(params) ? s.run(...params) : s.run(params)
}

/** 事务包装：任意异常自动回滚 */
export const tx = (fn) => {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (err) {
    try {
      db.exec('ROLLBACK')
    } catch (rollbackErr) {
      console.error('[db] 回滚失败:', rollbackErr.message)
    }
    throw err
  }
}

export const tableExists = (name) =>
  !!get(`SELECT 1 AS ok FROM sqlite_master WHERE type IN ('table','view') AND name = ?`, [name])

/** 分页帮助：返回 { items, total, page, pageSize, totalPages } */
export const paginate = (baseSql, countSql, params, { page = 1, pageSize = 12 } = {}) => {
  const safePage = Math.max(1, Number(page) || 1)
  const safeSize = Math.min(100, Math.max(1, Number(pageSize) || 12))
  const total = get(countSql, params)?.total ?? 0
  const items = query(`${baseSql} LIMIT ? OFFSET ?`, [...params, safeSize, (safePage - 1) * safeSize])
  return {
    items,
    total,
    page: safePage,
    pageSize: safeSize,
    totalPages: Math.max(1, Math.ceil(total / safeSize))
  }
}

export const closeDb = () => {
  try {
    db.close()
  } catch {
    /* 已关闭 */
  }
}
