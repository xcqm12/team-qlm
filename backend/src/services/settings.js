/** 站点设置读写 */
import { query, run } from '../db/index.js'

export const getSettings = () => {
  const rows = query('SELECT key, value FROM settings')
  const map = {}
  for (const row of rows) map[row.key] = row.value
  return map
}

export const getSetting = (key, fallback = '') => {
  const row = query('SELECT value FROM settings WHERE key = ?', [key])[0]
  return row ? row.value : fallback
}

export const setSetting = (key, value) => {
  run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now','localtime'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value == null ? '' : String(value)]
  )
}

export const setSettings = (obj = {}) => {
  let count = 0
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'file_categories') {
      setSetting(key, typeof value === 'string' ? value : JSON.stringify(value))
    } else {
      setSetting(key, value)
    }
    count++
  }
  return count
}

export const getFileCategories = () => {
  try {
    const parsed = JSON.parse(getSetting('file_categories', '[]'))
    if (Array.isArray(parsed) && parsed.length) return parsed
  } catch {
    /* 使用默认值 */
  }
  return ['工具软件', '模组资源', '文档资料', '图片素材', '其他']
}

/* ------------------------------------------------------------------ 外链检测配置 */
const clamp = (value, min, max, fallback) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(max, Math.max(min, num))
}

/**
 * 第三方链接检测配置
 *   mode  = 'before-redirect'（跳转前检测，默认）| 'manual'（只在后台手动检测）
 *   ttlSeconds = 检测结果缓存时长，避免每次点击都去打第三方
 *   block = 检测不可达时是否拦截跳转（默认 0，仅记录并提示，不影响用户下载）
 */
export const getLinkCheckConfig = () => {
  const s = getSettings()
  return {
    mode: s.link_check_mode === 'manual' ? 'manual' : 'before-redirect',
    ttlSeconds: clamp(s.link_check_ttl, 0, 86400, 600),
    timeoutMs: clamp(s.link_check_timeout_ms, 1000, 30000, 8000),
    maxHops: clamp(s.link_check_max_hops, 1, 15, 6),
    concurrency: clamp(s.link_check_concurrency, 1, 8, 3),
    block: String(s.link_check_block ?? '0') === '1'
  }
}

/** 后台设置页用：可编辑的默认值 */
export const LINK_CHECK_DEFAULTS = {
  link_check_mode: 'before-redirect',
  link_check_ttl: '600',
  link_check_timeout_ms: '8000',
  link_check_max_hops: '6',
  link_check_concurrency: '3',
  link_check_block: '0'
}
