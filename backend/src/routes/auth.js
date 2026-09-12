/** 登录 / 当前用户 / 修改密码 */
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { config } from '../config.js'
import { get, run } from '../db/index.js'
import { hashPassword, publicUser, recordAudit, requireAuth, signToken, verifyPassword } from '../middleware/auth.js'
import { trustIp } from '../middleware/anticc.js'
import { ApiError, asyncHandler, ok } from '../middleware/errors.js'

const router = Router()

// 登录接口限流，防止暴力破解
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '尝试次数过多，请 10 分钟后再试' }
})

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {}
    if (!username || !password) throw ApiError.badRequest('请填写用户名与密码')

    const user = get('SELECT * FROM users WHERE username = ?', [String(username).trim()])
    if (!user || !verifyPassword(String(password), user.password_hash)) {
      recordAudit({
        action: 'login.failed',
        target: String(username),
        detail: '用户名或密码错误',
        ip: req.ip
      })
      throw ApiError.unauthorized('用户名或密码错误')
    }

    run(`UPDATE users SET last_login_at = datetime('now','localtime') WHERE id = ?`, [user.id])
    const token = signToken(user)
    // 登录成功的 IP 进入信任名单：避免管理员正常操作被 CC 误封后无法自救
    trustIp(req.ip)
    recordAudit({ userId: user.id, action: 'login.success', target: user.username, ip: req.ip })

    ok(res, { token, user: publicUser({ ...user, last_login_at: new Date().toISOString() }) }, '登录成功')
  })
)

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = get('SELECT * FROM users WHERE id = ?', [req.user.sub])
    if (!user) throw ApiError.unauthorized()
    ok(res, { user: publicUser(user), jwtSecretIsDefault: config.jwt.secret.includes('please-change') })
  })
)

router.post(
  '/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body || {}
    if (!oldPassword || !newPassword) throw ApiError.badRequest('请填写原密码与新密码')
    if (String(newPassword).length < 6) throw ApiError.badRequest('新密码至少 6 位')

    const user = get('SELECT * FROM users WHERE id = ?', [req.user.sub])
    if (!user || !verifyPassword(String(oldPassword), user.password_hash)) {
      throw ApiError.badRequest('原密码不正确')
    }
    run('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(String(newPassword)), user.id])
    recordAudit({ userId: user.id, action: 'password.change', target: user.username, ip: req.ip })
    ok(res, null, '密码已更新')
  })
)

export default router
