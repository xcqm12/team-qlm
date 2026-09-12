/** 站点信息：公开设置、统计、搜索、后台维护 */
import { Router } from 'express'
import fs from 'node:fs'
import { config } from '../config.js'
import { get, query, run } from '../db/index.js'
import { recordAudit, requireAuth } from '../middleware/auth.js'
import { getAntiCcStats, unbanIp } from '../middleware/anticc.js'
import { ApiError, asyncHandler, ok } from '../middleware/errors.js'
import { getFileCategories, getSettings, setSettings } from '../services/settings.js'
import { humanSize } from '../services/storage.js'

const router = Router()

// 这些设置键不在公开接口暴露
const PRIVATE_KEYS = new Set(['admin_note', 'smtp_password', 'webhook_secret'])

router.get(
  '/settings',
  asyncHandler(async (req, res) => {
    const all = getSettings()
    const pub = {}
    for (const [key, value] of Object.entries(all)) {
      if (PRIVATE_KEYS.has(key)) continue
      if (key === 'file_categories') continue
      pub[key] = value
    }
    ok(res, { settings: pub, fileCategories: getFileCategories(), version: config.version })
  })
)

router.put(
  '/settings',
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = req.body || {}
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw ApiError.badRequest('设置内容应为键值对象')
    }
    const count = setSettings(payload)
    recordAudit({ userId: req.user.sub, action: 'settings.update', detail: Object.keys(payload).join(','), ip: req.ip })
    ok(res, { updated: count }, `已更新 ${count} 项设置`)
  })
)

/** 公开统计（首页数字展示） */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const stats = get('SELECT * FROM v_site_stats') || {}
    ok(res, {
      stats: {
        ...stats,
        fileSizeText: humanSize(stats.file_bytes || 0)
      }
    })
  })
)

/** 后台概览：最近内容、存储占用、待处理留言 */
router.get(
  '/dashboard',
  requireAuth,
  asyncHandler(async (req, res) => {
    const stats = get('SELECT * FROM v_site_stats') || {}
    ok(res, {
      stats: { ...stats, fileSizeText: humanSize(stats.file_bytes || 0) },
      recentFiles: query('SELECT id, original_name, size, category, created_at FROM files ORDER BY created_at DESC LIMIT 8'),
      recentMessages: query('SELECT id, name, email, subject, status, created_at FROM messages ORDER BY created_at DESC LIMIT 8'),
      recentAudits: query(
        `SELECT a.id, a.action, a.target, a.created_at, u.username
         FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
         ORDER BY a.created_at DESC LIMIT 12`
      ),
      anticc: getAntiCcStats(),
      runtime: {
        version: config.version,
        env: config.env,
        node: process.version,
        uptimeSeconds: Math.round(process.uptime()),
        uploadDir: config.uploadDir,
        dbFile: config.dbFile,
        maxUploadSize: config.maxUploadSize,
        maxUploadSizeText: humanSize(config.maxUploadSize),
        dbSizeBytes: fs.existsSync(config.dbFile) ? fs.statSync(config.dbFile).size : 0
      }
    })
  })
)

/** 站内搜索：项目 + 新闻 + 文件 */
router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const keyword = String(req.query.q || '').trim()
    if (!keyword) return ok(res, { keyword, projects: [], news: [], files: [] })
    const like = `%${keyword}%`
    ok(res, {
      keyword,
      projects: query(
        `SELECT id, slug, title, summary, category, version FROM projects
         WHERE status = 'published' AND (title LIKE ? OR summary LIKE ? OR tags LIKE ?) LIMIT 6`,
        [like, like, like]
      ),
      news: query(
        `SELECT id, slug, title, summary, published_at FROM news
         WHERE status = 'published' AND (title LIKE ? OR summary LIKE ?) LIMIT 6`,
        [like, like]
      ),
      files: query(
        `SELECT id, original_name, size, category, ext FROM files
         WHERE is_public = 1 AND (original_name LIKE ? OR description LIKE ?) LIMIT 6`,
        [like, like]
      )
    })
  })
)

/** 防 CC 状态与手动解封 */
router.get(
  '/anticc',
  requireAuth,
  asyncHandler(async (req, res) => {
    ok(res, { anticc: getAntiCcStats() })
  })
)

router.post(
  '/anticc/unban',
  requireAuth,
  asyncHandler(async (req, res) => {
    const ip = String(req.body?.ip || '').trim()
    const result = unbanIp(ip || null)
    recordAudit({
      userId: req.user.sub,
      action: 'anticc.unban',
      target: ip || '(全部)',
      detail: JSON.stringify(result),
      ip: req.ip
    })
    ok(res, { result, anticc: getAntiCcStats() }, ip ? `已解封 ${ip}` : '已清空全部封禁与计数')
  })
)

/** 数据库备份（导出 SQL 文本，配合运维脚本使用） */
router.post(
  '/backup',
  requireAuth,
  asyncHandler(async (req, res) => {
    const tables = ['settings', 'users', 'files', 'projects', 'project_files', 'news', 'members', 'messages']
    const lines = [`-- 七零喵团队站点备份 ${new Date().toISOString()}`, 'PRAGMA foreign_keys=OFF;', 'BEGIN TRANSACTION;']
    for (const table of tables) {
      const rows = query(`SELECT * FROM ${table}`)
      for (const row of rows) {
        const cols = Object.keys(row)
        const values = cols.map((c) => {
          const v = row[c]
          if (v === null || v === undefined) return 'NULL'
          if (typeof v === 'number') return String(v)
          return `'${String(v).replace(/'/g, "''")}'`
        })
        lines.push(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${values.join(', ')});`)
      }
    }
    lines.push('COMMIT;')
    recordAudit({ userId: req.user.sub, action: 'db.backup', ip: req.ip })
    res.setHeader('Content-Type', 'application/sql; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="team-site-backup-${Date.now()}.sql"`)
    res.send(lines.join('\n'))
  })
)

/** 清理无主文件（磁盘上有、数据库里没有） */
router.post(
  '/cleanup-orphans',
  requireAuth,
  asyncHandler(async (req, res) => {
    const known = new Set(query('SELECT stored_name FROM files').map((r) => r.stored_name))
    const dir = config.uploadDir
    const removed = []
    if (fs.existsSync(dir)) {
      for (const name of fs.readdirSync(dir)) {
        const full = `${dir}/${name}`
        if (fs.statSync(full).isFile() && !known.has(name)) {
          fs.unlinkSync(full)
          removed.push(name)
        }
      }
    }
    recordAudit({ userId: req.user.sub, action: 'storage.cleanup', detail: removed.join(','), ip: req.ip })
    ok(res, { removed, count: removed.length }, `已清理 ${removed.length} 个无主文件`)
  })
)

export default router
