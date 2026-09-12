/** 联系留言 */
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { get, paginate, run } from '../db/index.js'
import { recordAudit, requireAuth } from '../middleware/auth.js'
import { ApiError, asyncHandler, ok } from '../middleware/errors.js'

const router = Router()

// 留言限流：同 IP 每小时最多 10 条
const messageLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '留言过于频繁，请稍后再试' }
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

router.post(
  '/',
  messageLimiter,
  asyncHandler(async (req, res) => {
    const { name, email, subject = '', content } = req.body || {}
    if (!name || !email || !content) throw ApiError.badRequest('请填写称呼、邮箱与留言内容')
    if (!EMAIL_RE.test(String(email))) throw ApiError.badRequest('邮箱格式不正确')
    if (String(content).trim().length < 5) throw ApiError.badRequest('留言内容太短')
    if (String(content).length > 2000) throw ApiError.badRequest('留言内容过长（最多 2000 字）')

    const info = run(
      `INSERT INTO messages (name, email, subject, content, ip) VALUES (?, ?, ?, ?, ?)`,
      [
        String(name).slice(0, 60),
        String(email).slice(0, 120),
        String(subject).slice(0, 120),
        String(content).slice(0, 2000),
        String(req.ip || '')
      ]
    )
    ok(res, { id: info.lastInsertRowid }, '留言已提交，我们会尽快回复')
  })
)

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { status = '', page = 1, pageSize = 20 } = req.query
    const where = []
    const params = []
    if (status) {
      where.push('status = ?')
      params.push(String(status))
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const result = paginate(
      `SELECT * FROM messages ${whereSql} ORDER BY created_at DESC`,
      `SELECT COUNT(*) AS total FROM messages ${whereSql}`,
      params,
      { page, pageSize }
    )
    const unread = get("SELECT COUNT(*) AS c FROM messages WHERE status = 'new'")?.c ?? 0
    ok(res, { ...result, unread })
  })
)

router.patch(
  '/:id(\\d+)',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = get('SELECT * FROM messages WHERE id = ?', [req.params.id])
    if (!row) throw ApiError.notFound('留言不存在')
    const status = ['new', 'read', 'replied', 'archived'].includes(req.body?.status)
      ? req.body.status
      : null
    if (!status) throw ApiError.badRequest('status 取值应为 new/read/replied/archived')
    run('UPDATE messages SET status = ? WHERE id = ?', [status, row.id])
    ok(res, get('SELECT * FROM messages WHERE id = ?', [row.id]), '状态已更新')
  })
)

router.delete(
  '/:id(\\d+)',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = get('SELECT * FROM messages WHERE id = ?', [req.params.id])
    if (!row) throw ApiError.notFound('留言不存在')
    run('DELETE FROM messages WHERE id = ?', [row.id])
    recordAudit({ userId: req.user.sub, action: 'message.delete', target: row.email, ip: req.ip })
    ok(res, { id: row.id }, '留言已删除')
  })
)

export default router
