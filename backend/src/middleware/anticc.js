/**
 * 防 CC 中间件（应用层）
 *
 * 与 nginx 的 limit_req / limit_conn 形成两层防护：
 *   · nginx 层挡掉洪峰（连接数、每秒请求数）
 *   · 应用层做「滑动窗口计数 + 并发保护 + 超限自动封禁」，并能识别已登录用户放行
 *
 * 特性：
 *   · 按 IP 统计固定窗口请求数，超过阈值即封禁一段可配置时间（默认 10 分钟）
 *   · 并发保护：全局与单 IP 的 in-flight 请求数上限，超限快速返回 503（不排队堆积）
 *   · 豁免：白名单 IP、携带有效 JWT 的请求、以及 /uploads 静态资源
 *   · 全部状态在内存中（单进程足够；多进程可用 nginx 层兜底），定时清理避免内存增长
 *   · 可运行时查看统计、手动解封（后台接口）
 *
 * 环境变量（也可由后台「站点设置」覆盖同名键）：
 *   ANTICC_ENABLED=1
 *   ANTICC_WINDOW_MS=60000          统计窗口
 *   ANTICC_MAX_REQUESTS=240         单 IP 每窗口最大请求数
 *   ANTICC_MAX_CONCURRENT=200       全局并发上限
 *   ANTICC_MAX_PER_IP=16            单 IP 并发上限
 *   ANTICC_BAN_SECONDS=600          超限封禁时长（秒）
 *   ANTICC_WHITELIST=               白名单 IP，逗号分隔（支持前缀匹配，如 10.0.）
 *   ANTICC_SKIP_TOKEN=1             携带有效 JWT 时跳过 CC 限制
 */
import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { getSettings } from '../services/settings.js'

const num = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const bool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())
}

/**
 * 读取配置，优先级：环境变量 > 数据库设置 > 内置默认值
 *
 *   · 环境变量最高：运维可在 .env 中强制限制（例如临时把上限压到 60），后台改不动
 *   · 未设置环境变量时用数据库设置：后台「站点设置 → 防 CC」可实时调整，无需重启
 *   · 都没有则用默认值
 */
export const getAntiCcConfig = () => {
  let settings = {}
  try {
    settings = getSettings()
  } catch {
    settings = {}
  }
  const pick = (key, envKey, fallback) => {
    const envValue = process.env[envKey]
    if (envValue !== undefined && envValue !== '') return envValue
    const dbValue = settings[key]
    if (dbValue !== undefined && dbValue !== '') return dbValue
    return fallback
  }
  const whitelistRaw = String(pick('anticc_whitelist', 'ANTICC_WHITELIST', '') || '')
  return {
    enabled: bool(pick('anticc_enabled', 'ANTICC_ENABLED', '1'), true),
    windowMs: Math.max(1000, num(pick('anticc_window_ms', 'ANTICC_WINDOW_MS', 60000), 60000)),
    maxRequests: Math.max(5, num(pick('anticc_max_requests', 'ANTICC_MAX_REQUESTS', 240), 240)),
    maxConcurrent: Math.max(10, num(pick('anticc_max_concurrent', 'ANTICC_MAX_CONCURRENT', 200), 200)),
    maxPerIp: Math.max(2, num(pick('anticc_max_per_ip', 'ANTICC_MAX_PER_IP', 16), 16)),
    banSeconds: Math.max(1, num(pick('anticc_ban_seconds', 'ANTICC_BAN_SECONDS', 600), 600)),
    skipToken: bool(pick('anticc_skip_token', 'ANTICC_SKIP_TOKEN', '1'), true),
    whitelist: whitelistRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
}

/* ------------------------------------------------------------------ 运行时状态 */
const state = {
  /** ip -> { count, windowStart, bannedUntil, perIpActive, lastSeen } */
  clients: new Map(),
  /** ip -> 信任到期时间戳（登录成功的 IP 短期免检，避免管理员把自己封在门外） */
  trusted: new Map(),
  inFlight: 0,
  blockedTotal: 0,
  bannedTotal: 0,
  concurrencyRejected: 0,
  lastBlockedAt: '',
  /** 便于日志节流：ip -> 上次打印时间 */
  lastLog: new Map()
}

const now = () => Date.now()

const isWhitelisted = (ip, whitelist) => whitelist.some((entry) => ip === entry || (entry.endsWith('.') && ip.startsWith(entry)))

/**
 * 把某个 IP 加入短期信任名单（登录成功后调用）
 * 作用：管理员/编辑登录一次后，其 IP 在 TTL 内不会被 CC 限流与封禁，
 * 避免出现"把自己封在门外、又因为登录接口被拦而无法解封"的死锁。
 */
export const trustIp = (ip, ttlMs = 30 * 60 * 1000) => {
  if (!ip) return
  const normalized = String(ip).replace(/^::ffff:/, '')
  state.trusted.set(normalized, now() + ttlMs)
  // 顺带解掉可能已存在的封禁
  const client = state.clients.get(normalized)
  if (client) {
    client.bannedUntil = 0
    client.count = 0
    client.windowStart = now()
  }
}

const isTrusted = (ip) => {
  const until = state.trusted.get(ip)
  if (!until) return false
  if (until < now()) {
    state.trusted.delete(ip)
    return false
  }
  return true
}

/** 解析有效 IP（配合 app.set('trust proxy') 使用） */
const clientIpOf = (req) => (req.ip || req.socket?.remoteAddress || 'unknown').replace(/^::ffff:/, '')

/** 是否携带有效 JWT（管理员/接口调用方豁免，避免误伤自动化脚本） */
const hasValidToken = (req) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return false
  try {
    jwt.verify(token, config.jwt.secret)
    return true
  } catch {
    return false
  }
}

const releaseSlot = (req) => {
  if (req.__anticcCounted) {
    if (state.inFlight > 0) state.inFlight -= 1
    const ip = req.__anticcIp
    const client = ip ? state.clients.get(ip) : null
    if (client && client.perIpActive > 0) client.perIpActive -= 1
    req.__anticcCounted = false
  }
}

/** 清理长时间不活跃的条目，避免 Map 无限增长 */
export const cleanupAntiCcState = () => {
  const cutoff = now() - Math.max(300000, getAntiCcConfig().windowMs * 5)
  let removed = 0
  for (const [ip, client] of state.clients) {
    const banned = (client.bannedUntil || 0) > now()
    if (!banned && (client.lastSeen || 0) < cutoff && (client.perIpActive || 0) === 0) {
      state.clients.delete(ip)
      removed += 1
    }
  }
  for (const [ip, at] of state.lastLog) {
    if (at < cutoff) state.lastLog.delete(ip)
  }
  return removed
}

const cleanupTimer = setInterval(cleanupAntiCcState, 120000)
if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref()

/* ------------------------------------------------------------------ 中间件 */
/**
 * CC 中间件不参与统计的路径（相对 /api 挂载点）
 *   · /auth/login：有独立的严格限流（10 分钟 20 次）防爆破，且必须保证管理员
 *     在被封禁时仍能登录（登录成功后该 IP 会自动进入信任名单）——否则会出现
 *     "把自己封在门外、登录接口也被拦、无法解封"的死锁
 *   · /health：存活探针，`deploy/update.sh`、`tools/healthcheck.py`、外部监控都靠它。
 *     它本身无副作用、不碰数据库；一旦被限流或封禁，部署会报"健康检查失败"、
 *     监控会误报宕机，而真正的服务其实好着——排查成本极高。
 */
const SKIP_PATHS = new Set(['/auth/login', '/health'])

export const anticc = (req, res, next) => {
  const cfg = getAntiCcConfig()

  // 静态资源、预检请求与登录接口不做 CC 统计
  if (!cfg.enabled || req.method === 'OPTIONS' || req.path.startsWith('/uploads') || SKIP_PATHS.has(req.path)) {
    return next()
  }

  const ip = clientIpOf(req)

  if (isWhitelisted(ip, cfg.whitelist)) return next()
  if (isTrusted(ip)) return next()
  if (cfg.skipToken && hasValidToken(req)) return next()

  const ts = now()
  let client = state.clients.get(ip)
  if (!client) {
    client = { count: 0, windowStart: ts, bannedUntil: 0, perIpActive: 0, lastSeen: ts }
    state.clients.set(ip, client)
  }
  client.lastSeen = ts

  // 1) 封禁中：直接 429
  if (client.bannedUntil > ts) {
    const retryAfter = Math.ceil((client.bannedUntil - ts) / 1000)
    state.blockedTotal += 1
    state.lastBlockedAt = new Date().toISOString()
    res.setHeader('Retry-After', String(retryAfter))
    res.setHeader('X-CC-Protection', 'banned')
    return res.status(429).json({
      success: false,
      message: `请求过于频繁，已被临时限制，请 ${retryAfter} 秒后重试`,
      retryAfter
    })
  }

  // 2) 窗口计数
  if (ts - client.windowStart >= cfg.windowMs) {
    client.windowStart = ts
    client.count = 0
  }
  client.count += 1

  if (client.count > cfg.maxRequests) {
    client.bannedUntil = ts + cfg.banSeconds * 1000
    state.bannedTotal += 1
    state.blockedTotal += 1
    state.lastBlockedAt = new Date().toISOString()
    // 日志节流：同一 IP 60 秒最多打一次
    const lastLog = state.lastLog.get(ip) || 0
    if (ts - lastLog > 60000) {
      state.lastLog.set(ip, ts)
      console.warn(`[anticc] ${ip} 触发频率限制（${client.count}/${cfg.maxRequests} per ${cfg.windowMs}ms），封禁 ${cfg.banSeconds}s`)
    }
    res.setHeader('Retry-After', String(cfg.banSeconds))
    res.setHeader('X-CC-Protection', 'banned')
    return res.status(429).json({
      success: false,
      message: `请求过于频繁，已被临时限制，请 ${cfg.banSeconds} 秒后重试`,
      retryAfter: cfg.banSeconds
    })
  }

  // 3) 并发保护
  if (state.inFlight >= cfg.maxConcurrent) {
    state.concurrencyRejected += 1
    res.setHeader('Retry-After', '1')
    res.setHeader('X-CC-Protection', 'busy')
    return res.status(503).json({ success: false, message: '服务器繁忙，请稍后重试' })
  }
  if (client.perIpActive >= cfg.maxPerIp) {
    state.concurrencyRejected += 1
    res.setHeader('Retry-After', '1')
    res.setHeader('X-CC-Protection', 'too-many-concurrent')
    return res.status(429).json({ success: false, message: '同一来源并发请求过多，请稍后重试' })
  }

  state.inFlight += 1
  client.perIpActive += 1
  req.__anticcCounted = true
  req.__anticcIp = ip
  res.setHeader('X-CC-Protection', 'active')

  // 无论如何都要归还并发计数（含客户端中断）
  res.on('finish', () => releaseSlot(req))
  res.on('close', () => releaseSlot(req))
  next()
}

/* ------------------------------------------------------------------ 统计与运维 */
export const getAntiCcStats = () => {
  const cfg = getAntiCcConfig()
  const ts = now()
  let banned = 0
  for (const client of state.clients.values()) {
    if ((client.bannedUntil || 0) > ts) banned += 1
  }
  const top = [...state.clients.entries()]
    .filter(([, client]) => (client.bannedUntil || 0) > ts)
    .sort((a, b) => (b[1].bannedUntil || 0) - (a[1].bannedUntil || 0))
    .slice(0, 10)
    .map(([ip, client]) => ({
      ip,
      remainingSeconds: Math.ceil(((client.bannedUntil || 0) - ts) / 1000),
      requests: client.count
    }))

  return {
    config: cfg,
    tracked: state.clients.size,
    trusted: [...state.trusted.entries()]
      .filter(([, until]) => until > ts)
      .map(([ip, until]) => ({ ip, remainingSeconds: Math.ceil((until - ts) / 1000) })),
    banned,
    bannedList: top,
    blockedTotal: state.blockedTotal,
    bannedTotal: state.bannedTotal,
    concurrencyRejected: state.concurrencyRejected,
    inFlight: state.inFlight,
    lastBlockedAt: state.lastBlockedAt
  }
}

/** 清空全部封禁与计数（SIGUSR1 或后台"清空"按钮触发） */
export const clearAllBans = () => {
  let cleared = 0
  for (const client of state.clients.values()) {
    if ((client.bannedUntil || 0) > now()) cleared += 1
    client.bannedUntil = 0
    client.count = 0
    client.windowStart = now()
  }
  return cleared
}

/** 清空信任名单（排查用） */
export const clearTrusted = () => {
  const size = state.trusted.size
  state.trusted.clear()
  return size
}

/** 手动解封（传 IP 只解封该 IP；不传则清空全部封禁与计数） */
export const unbanIp = (ip) => {
  if (!ip) {
    const cleared = clearAllBans()
    return { cleared: 'all', bannedCleared: cleared }
  }
  const normalized = String(ip).replace(/^::ffff:/, '')
  const client = state.clients.get(normalized)
  if (!client) {
    // 即使没有计数记录，也把这个 IP 加入信任名单，避免"解封了却仍被拦"
    trustIp(normalized)
    return { cleared: 0, ip: normalized, found: false, trusted: true }
  }
  const wasBanned = (client.bannedUntil || 0) > now()
  client.bannedUntil = 0
  client.count = 0
  client.windowStart = now()
  trustIp(normalized)
  return { cleared: 1, ip: normalized, found: true, wasBanned }
}
