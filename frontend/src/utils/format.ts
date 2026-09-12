/** 日期与体积格式化 */
export const formatDate = (value?: string | null, withTime = true) => {
  if (!value) return '—'
  const normalized = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return String(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  const base = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return withTime ? `${base} ${pad(date.getHours())}:${pad(date.getMinutes())}` : base
}

export const formatDay = (value?: string | null) => formatDate(value, false)

export const relativeTime = (value?: string | null) => {
  if (!value) return ''
  const normalized = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T')
  const time = new Date(normalized).getTime()
  if (Number.isNaN(time)) return ''
  const diff = Date.now() - time
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`
  return formatDay(value)
}

export const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export const fileIcon = (kind: string, ext = '') => {
  const map: Record<string, string> = {
    image: '🖼️',
    video: '🎬',
    audio: '🎵',
    pdf: '📕',
    text: '📄',
    link: '🔗',
    other: '📦'
  }
  if (kind === 'other' && ['zip', 'rar', '7z', 'tar', 'gz', 'jar'].includes(ext)) return '🗜️'
  if (kind === 'other' && ['exe', 'msi', 'dmg', 'apk', 'deb', 'rpm'].includes(ext)) return '⚙️'
  return map[kind] || '📦'
}

/** 复制文本到剪贴板（兼容非安全上下文，如内网 http） */
export const copyText = async (text: string) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* 回落到 execCommand */
  }
  try {
    const input = document.createElement('textarea')
    input.value = text
    input.setAttribute('readonly', 'readonly')
    input.style.position = 'fixed'
    input.style.opacity = '0'
    document.body.appendChild(input)
    input.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(input)
    return ok
  } catch {
    return false
  }
}

/** 判断第三方图标是图片地址还是 emoji/文字 */
export const isImageIcon = (icon = '') => /^https?:\/\//i.test(icon) || icon.startsWith('/')

/** 取链接的主机名（用于展示与 favicon 兜底） */
export const hostOf = (url = '') => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** 站点 favicon 兜底图标：平台未配置图标时使用对方站点图标 */
export const faviconOf = (url = '') => {
  const host = hostOf(url)
  if (!host) return ''
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.host}/favicon.ico`
  } catch {
    return ''
  }
}

export const truncate = (text = '', max = 120) =>
  text.length > max ? `${text.slice(0, max)}…` : text
