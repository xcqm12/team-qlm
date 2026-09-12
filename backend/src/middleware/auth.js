/** 鉴权：JWT 签发 / 校验 / 管理员初始化 / 操作审计 */
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { get, run } from '../db/index.js'
import { ApiError } from './errors.js'

// 口令散列使用 Node 内置 scrypt，零第三方依赖，避免服务器编译原生模块
const SCRYPT_KEYLEN = 64

export const hashPassword = (plain) => {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(String(plain), salt, SCRYPT_KEYLEN).toString('hex')
  return `scrypt$${salt}$${hash}`
}

export const verifyPassword = (plain, stored) => {
  if (!stored) return false
  if (stored.startsWith('scrypt$')) {
    const [, salt, hash] = stored.split('$')
    if (!salt || !hash) return false
    const computed = crypto.scryptSync(String(plain), salt, SCRYPT_KEYLEN).toString('hex')
    const a = Buffer.from(computed, 'hex')
    const b = Buffer.from(hash, 'hex')
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  }
  return false
}

export const signToken = (user) =>
  jwt.sign(
    { sub: user.id, username: user.username, role: user.role, name: user.display_name },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  )

export const publicUser = (user) =>
  user && {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at
  }

/** 首次运行创建默认管理员 */
export const ensureAdminUser = () => {
  const count = get('SELECT COUNT(*) AS c FROM users')?.c ?? 0
  if (count > 0) return { created: false }

  run(
    `INSERT INTO users (username, password_hash, display_name, role)
     VALUES (?, ?, ?, 'admin')`,
    [config.admin.username, hashPassword(config.admin.password), '站点管理员']
  )
  return { created: true, username: config.admin.username, password: config.admin.password }
}

export const recordAudit = ({ userId = null, action, target = '', detail = '', ip = '' }) => {
  try {
    run(
      `INSERT INTO audit_logs (user_id, action, target, detail, ip) VALUES (?, ?, ?, ?, ?)`,
      [userId, action, target, typeof detail === 'string' ? detail : JSON.stringify(detail), ip]
    )
  } catch (err) {
    console.warn('[audit] 写入失败:', err.message)
  }
}

const extractToken = (req) => {
  const header = req.headers.authorization || ''
  if (header.startsWith('Bearer ')) return header.slice(7).trim()
  if (req.query && typeof req.query.token === 'string' && req.query.token) return req.query.token
  return null
}

/** 解析 token（不强制登录） */
export const optionalAuth = (req, res, next) => {
  const token = extractToken(req)
  if (!token) return next()
  try {
    req.user = jwt.verify(token, config.jwt.secret)
  } catch {
    /* 忽略无效 token，按游客处理 */
  }
  next()
}

/** 必须登录 */
export const requireAuth = (req, res, next) => {
  const token = extractToken(req)
  if (!token) return next(ApiError.unauthorized())
  try {
    req.user = jwt.verify(token, config.jwt.secret)
  } catch {
    return next(ApiError.unauthorized())
  }
  const exists = get('SELECT id FROM users WHERE id = ?', [req.user.sub])
  if (!exists) return next(ApiError.unauthorized('账号不存在或已被删除'))
  next()
}
