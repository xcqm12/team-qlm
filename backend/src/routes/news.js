/** 新闻动态 */
import { Router } from 'express'
import { get, paginate, query, run } from '../db/index.js'
import { optionalAuth, recordAudit, requireAuth } from '../middleware/auth.js'
import { ApiError, asyncHandler, ok } from '../middleware/errors.js'
import { serializeFile } from '../services/storage.js'

const router = Router()

const slugify = (input, fallback = 'news') => {
  const base = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
  return base || `${fallback}-${Date.now().toString(36)}`
}

const ensureUniqueSlug = (slug, excludeId = null) => {
  let candidate = slug
  let i = 2
  for (;;) {
    const row = get('SELECT id FROM news WHERE slug = ?', [candidate])
    if (!row || (excludeId && row.id === Number(excludeId))) return candidate
    candidate = `${slug}-${i++}`
  }
}

const withCover = (row) => {
  if (!row) return null
  const cover = row.cover_file_id ? get('SELECT * FROM files WHERE id = ?', [row.cover_file_id]) : null
  return { ...row, cover: serializeFile(cover) }
}

router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { category = '', q = '', page = 1, pageSize = 10, scope } = req.query
    const where = []
    const params = []
    if (!(scope === 'all' && req.user)) where.push("status = 'published'")
    if (category) {
      where.push('category = ?')
      params.push(String(category))
    }
    if (q) {
      where.push('(title LIKE ? OR summary LIKE ?)')
      const like = `%${String(q).trim()}%`
      params.push(like, like)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const result = paginate(
      `SELECT * FROM news ${whereSql} ORDER BY published_at DESC, id DESC`,
      `SELECT COUNT(*) AS total FROM news ${whereSql}`,
      params,
      { page, pageSize }
    )
    ok(res, { ...result, items: result.items.map(withCover) })
  })
)

router.get(
  '/:key',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const key = req.params.key
    const row = /^\d+$/.test(key)
      ? get('SELECT * FROM news WHERE id = ?', [key])
      : get('SELECT * FROM news WHERE slug = ?', [key])
    if (!row) throw ApiError.notFound('新闻不存在')
    if (row.status !== 'published' && !req.user) throw ApiError.forbidden('该新闻尚未发布')

    run('UPDATE news SET views = views + 1 WHERE id = ?', [row.id])
    ok(res, { news: { ...withCover(row), views: row.views + 1 } })
  })
)

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = req.body || {}
    if (!body.title) throw ApiError.badRequest('请填写新闻标题')
    const slug = ensureUniqueSlug(body.slug ? slugify(body.slug) : slugify(body.title))
    const info = run(
      `INSERT INTO news (slug, title, category, summary, content, cover_file_id, status, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        slug,
        String(body.title).slice(0, 160),
        String(body.category || '动态').slice(0, 40),
        String(body.summary || '').slice(0, 400),
        String(body.content || ''),
        body.coverFileId || null,
        body.status === 'draft' ? 'draft' : 'published',
        body.publishedAt ? String(body.publishedAt) : new Date().toISOString().slice(0, 19).replace('T', ' ')
      ]
    )
    const row = get('SELECT * FROM news WHERE id = ?', [info.lastInsertRowid])
    recordAudit({ userId: req.user.sub, action: 'news.create', target: row.title, ip: req.ip })
    res.status(201).json({ success: true, message: '新闻已发布', data: withCover(row) })
  })
)

router.put(
  '/:id(\\d+)',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = get('SELECT * FROM news WHERE id = ?', [req.params.id])
    if (!row) throw ApiError.notFound('新闻不存在')
    const body = req.body || {}
    const map = [
      ['title', 'title', (v) => String(v).slice(0, 160)],
      ['category', 'category', (v) => String(v).slice(0, 40)],
      ['summary', 'summary', (v) => String(v).slice(0, 400)],
      ['content', 'content', (v) => String(v)],
      ['status', 'status', (v) => (v === 'draft' ? 'draft' : 'published')],
      ['publishedAt', 'published_at', (v) => String(v)],
      ['coverFileId', 'cover_file_id', (v) => (v ? Number(v) : null)]
    ]
    const fields = []
    const params = []
    for (const [key, column, cast] of map) {
      if (body[key] !== undefined) {
        fields.push(`${column} = ?`)
        params.push(cast(body[key]))
      }
    }
    if (body.slug) {
      fields.push('slug = ?')
      params.push(ensureUniqueSlug(slugify(body.slug), row.id))
    }
    if (!fields.length) throw ApiError.badRequest('没有需要更新的字段')
    fields.push("updated_at = datetime('now','localtime')")
    params.push(row.id)
    run(`UPDATE news SET ${fields.join(', ')} WHERE id = ?`, params)
    recordAudit({ userId: req.user.sub, action: 'news.update', target: row.title, ip: req.ip })
    ok(res, withCover(get('SELECT * FROM news WHERE id = ?', [row.id])), '新闻已更新')
  })
)

router.delete(
  '/:id(\\d+)',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = get('SELECT * FROM news WHERE id = ?', [req.params.id])
    if (!row) throw ApiError.notFound('新闻不存在')
    run('DELETE FROM news WHERE id = ?', [row.id])
    recordAudit({ userId: req.user.sub, action: 'news.delete', target: row.title, ip: req.ip })
    ok(res, { id: row.id }, '新闻已删除')
  })
)

export default router
