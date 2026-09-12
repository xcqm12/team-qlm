/** 团队成员 */
import { Router } from 'express'
import { get, query, run } from '../db/index.js'
import { recordAudit, requireAuth } from '../middleware/auth.js'
import { ApiError, asyncHandler, ok } from '../middleware/errors.js'
import { serializeFile } from '../services/storage.js'

const router = Router()

const withAvatar = (row) => {
  if (!row) return null
  const avatar = row.avatar_file_id ? get('SELECT * FROM files WHERE id = ?', [row.avatar_file_id]) : null
  return { ...row, avatar: serializeFile(avatar) }
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = query('SELECT * FROM members ORDER BY sort_order ASC, id ASC')
    ok(res, { items: rows.map(withAvatar), total: rows.length })
  })
)

const pick = (body) => ({
  name: String(body.name || '').slice(0, 60),
  role: String(body.role || '成员').slice(0, 60),
  skills: String(body.skills || '').slice(0, 200),
  bio: String(body.bio || '').slice(0, 600),
  joined_at: String(body.joinedAt || '').slice(0, 20),
  sort_order: Number(body.sortOrder || 0),
  avatar_file_id: body.avatarFileId ? Number(body.avatarFileId) : null
})

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = pick(req.body || {})
    if (!data.name) throw ApiError.badRequest('请填写成员名称')
    const info = run(
      `INSERT INTO members (name, role, skills, bio, joined_at, sort_order, avatar_file_id)
       VALUES (@name, @role, @skills, @bio, @joined_at, @sort_order, @avatar_file_id)`,
      data
    )
    recordAudit({ userId: req.user.sub, action: 'member.create', target: data.name, ip: req.ip })
    res.status(201).json({ success: true, message: '成员已添加', data: withAvatar(get('SELECT * FROM members WHERE id = ?', [info.lastInsertRowid])) })
  })
)

router.put(
  '/:id(\\d+)',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = get('SELECT * FROM members WHERE id = ?', [req.params.id])
    if (!row) throw ApiError.notFound('成员不存在')
    const data = pick({ ...row, ...req.body })
    run(
      `UPDATE members SET name = @name, role = @role, skills = @skills, bio = @bio,
        joined_at = @joined_at, sort_order = @sort_order, avatar_file_id = @avatar_file_id
       WHERE id = @id`,
      { ...data, id: row.id }
    )
    recordAudit({ userId: req.user.sub, action: 'member.update', target: data.name, ip: req.ip })
    ok(res, withAvatar(get('SELECT * FROM members WHERE id = ?', [row.id])), '成员信息已更新')
  })
)

router.delete(
  '/:id(\\d+)',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = get('SELECT * FROM members WHERE id = ?', [req.params.id])
    if (!row) throw ApiError.notFound('成员不存在')
    run('DELETE FROM members WHERE id = ?', [row.id])
    recordAudit({ userId: req.user.sub, action: 'member.delete', target: row.name, ip: req.ip })
    ok(res, { id: row.id }, '成员已删除')
  })
)

export default router
