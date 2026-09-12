/** 项目作品 */
import { Router } from 'express'
import { get, paginate, query, run } from '../db/index.js'
import { optionalAuth, recordAudit, requireAuth } from '../middleware/auth.js'
import { ApiError, asyncHandler, ok } from '../middleware/errors.js'
import { serializeFile } from '../services/storage.js'

const router = Router()

const slugify = (input, fallback = 'item') => {
  const base = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
  return base || `${fallback}-${Date.now().toString(36)}`
}

const withCover = (row) => {
  if (!row) return null
  const cover = row.cover_file_id
    ? get('SELECT * FROM files WHERE id = ?', [row.cover_file_id])
    : null
  return { ...row, cover: serializeFile(cover) }
}

const ensureUniqueSlug = (slug, excludeId = null) => {
  let candidate = slug
  let i = 2
  for (;;) {
    const row = get('SELECT id FROM projects WHERE slug = ?', [candidate])
    if (!row || (excludeId && row.id === Number(excludeId))) return candidate
    candidate = `${slug}-${i++}`
  }
}

/** 列表（公开只返回已发布；登录后可带 scope=all） */
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { category = '', q = '', page = 1, pageSize = 12, scope, featured } = req.query
    const where = []
    const params = []
    if (!(scope === 'all' && req.user)) where.push("status = 'published'")
    if (category) {
      where.push('category = ?')
      params.push(String(category))
    }
    if (q) {
      where.push('(title LIKE ? OR summary LIKE ? OR tags LIKE ?)')
      const like = `%${String(q).trim()}%`
      params.push(like, like, like)
    }
    if (featured === '1') where.push('sort_order > 0')

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const result = paginate(
      `SELECT * FROM projects ${whereSql} ORDER BY sort_order ASC, created_at DESC`,
      `SELECT COUNT(*) AS total FROM projects ${whereSql}`,
      params,
      { page, pageSize }
    )
    const categories = query(
      `SELECT category AS name, COUNT(*) AS count FROM projects WHERE status = 'published' GROUP BY category`
    )
    ok(res, { ...result, items: result.items.map(withCover), categories })
  })
)

/** 详情（slug 或数字 id） */
router.get(
  '/:key',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const key = req.params.key
    const row = /^\d+$/.test(key)
      ? get('SELECT * FROM projects WHERE id = ?', [key])
      : get('SELECT * FROM projects WHERE slug = ?', [key])
    if (!row) throw ApiError.notFound('项目不存在')
    if (row.status !== 'published' && !req.user) throw ApiError.forbidden('该项目尚未发布')

    run('UPDATE projects SET views = views + 1 WHERE id = ?', [row.id])
    const files = query(
      `SELECT f.* FROM files f
       JOIN project_files pf ON pf.file_id = f.id
       WHERE pf.project_id = ? ORDER BY pf.sort_order ASC, f.created_at DESC`,
      [row.id]
    )
    ok(res, { project: { ...withCover(row), views: row.views + 1 }, files: files.map(serializeFile) })
  })
)

/** 新建 */
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = req.body || {}
    if (!body.title) throw ApiError.badRequest('请填写项目标题')
    const slug = ensureUniqueSlug(body.slug ? slugify(body.slug) : slugify(body.title, 'project'))

    const info = run(
      `INSERT INTO projects (slug, title, category, version, summary, content, cover_file_id, tags, repo_url, external_url, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        slug,
        String(body.title).slice(0, 120),
        String(body.category || '其他').slice(0, 60),
        String(body.version || '').slice(0, 60),
        String(body.summary || '').slice(0, 400),
        String(body.content || ''),
        body.coverFileId || null,
        String(body.tags || '').slice(0, 200),
        String(body.repoUrl || '').slice(0, 300),
        String(body.externalUrl || '').slice(0, 300),
        body.status === 'draft' ? 'draft' : 'published',
        Number(body.sortOrder || 0)
      ]
    )
    const row = get('SELECT * FROM projects WHERE id = ?', [info.lastInsertRowid])
    recordAudit({ userId: req.user.sub, action: 'project.create', target: row.title, ip: req.ip })
    res.status(201).json({ success: true, message: '项目已创建', data: withCover(row) })
  })
)

/** 更新 */
router.put(
  '/:id(\\d+)',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = get('SELECT * FROM projects WHERE id = ?', [req.params.id])
    if (!row) throw ApiError.notFound('项目不存在')
    const body = req.body || {}

    const map = [
      ['title', 'title', (v) => String(v).slice(0, 120)],
      ['category', 'category', (v) => String(v).slice(0, 60)],
      ['version', 'version', (v) => String(v).slice(0, 60)],
      ['summary', 'summary', (v) => String(v).slice(0, 400)],
      ['content', 'content', (v) => String(v)],
      ['tags', 'tags', (v) => String(v).slice(0, 200)],
      ['repoUrl', 'repo_url', (v) => String(v).slice(0, 300)],
      ['externalUrl', 'external_url', (v) => String(v).slice(0, 300)],
      ['status', 'status', (v) => (v === 'draft' ? 'draft' : 'published')],
      ['sortOrder', 'sort_order', (v) => Number(v) || 0],
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
    run(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`, params)
    const updated = get('SELECT * FROM projects WHERE id = ?', [row.id])
    recordAudit({ userId: req.user.sub, action: 'project.update', target: row.title, ip: req.ip })
    ok(res, withCover(updated), '项目已更新')
  })
)

/** 删除 */
router.delete(
  '/:id(\\d+)',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = get('SELECT * FROM projects WHERE id = ?', [req.params.id])
    if (!row) throw ApiError.notFound('项目不存在')
    run('DELETE FROM projects WHERE id = ?', [row.id])
    recordAudit({ userId: req.user.sub, action: 'project.delete', target: row.title, ip: req.ip })
    ok(res, { id: row.id }, '项目已删除')
  })
)

/** 绑定/解绑项目文件 */
router.post(
  '/:id(\\d+)/files',
  requireAuth,
  asyncHandler(async (req, res) => {
    const project = get('SELECT * FROM projects WHERE id = ?', [req.params.id])
    if (!project) throw ApiError.notFound('项目不存在')
    const fileIds = Array.isArray(req.body?.fileIds) ? req.body.fileIds.map(Number).filter(Boolean) : []
    run('DELETE FROM project_files WHERE project_id = ?', [project.id])
    fileIds.forEach((fileId, index) => {
      run('INSERT OR IGNORE INTO project_files (project_id, file_id, sort_order) VALUES (?, ?, ?)', [
        project.id,
        fileId,
        index
      ])
    })
    recordAudit({
      userId: req.user.sub,
      action: 'project.bind-files',
      target: project.title,
      detail: fileIds.join(','),
      ip: req.ip
    })
    ok(res, { projectId: project.id, fileIds }, '项目文件已更新')
  })
)

export default router
