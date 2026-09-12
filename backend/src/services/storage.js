/** 文件存储工具：扩展名校验、安全命名、校验和、缩略图路径 */
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { config } from '../config.js'

/** 允许上传的扩展名白名单（可通过环境变量 ALLOWED_EXTENSIONS 覆盖，逗号分隔，不带点） */
export const DEFAULT_ALLOWED_EXTENSIONS = [
  // 压缩包 / 程序包
  'zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'jar', 'war',
  'exe', 'msi', 'dmg', 'pkg', 'apk', 'ipa', 'deb', 'rpm', 'appimage', 'snap',
  // 文档
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'rtf', 'csv', 'log',
  'json', 'xml', 'yml', 'yaml', 'ini', 'conf', 'toml', 'properties',
  // 图片
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'tif', 'tiff', 'psd', 'ai', 'sketch',
  // 音视频
  'mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a',
  // 游戏资源
  'mcaddon', 'mcpack', 'mcworld', 'mctemplate', 'litemod', 'schematic', 'nbt', 'dat',
  // 3D / 设计
  'blend', 'obj', 'fbx', 'stl', 'glb', 'gltf'
]

/** 严格禁止的扩展名（即使白名单误配也不放行） */
export const BLOCKED_EXTENSIONS = [
  'php', 'php3', 'php4', 'php5', 'php7', 'php8', 'phtml', 'phar', 'pht',
  'jsp', 'jspx', 'jspf', 'asp', 'aspx', 'ashx', 'asmx', 'cgi', 'fcgi',
  'pl', 'pm', 'rb', 'py', 'pyc', 'sh', 'bash', 'zsh', 'ksh', 'bat', 'cmd', 'ps1', 'vbs', 'vbe',
  'html', 'htm', 'xhtml', 'shtml', 'svg', 'htaccess', 'htpasswd', 'so', 'dll', 'dylib'
]

const envAllowed = (process.env.ALLOWED_EXTENSIONS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase().replace(/^\./, ''))
  .filter(Boolean)

export const allowedExtensions = envAllowed.length ? envAllowed : DEFAULT_ALLOWED_EXTENSIONS

export const extOf = (filename = '') => {
  const base = path.basename(String(filename))
  const idx = base.lastIndexOf('.')
  if (idx <= 0 || idx === base.length - 1) return ''
  return base.slice(idx + 1).toLowerCase()
}

/** 去掉路径、控制字符与危险字符，仅保留展示用原始名 */
export const sanitizeOriginalName = (filename = '') => {
  const base = path.basename(String(filename).replace(/\\/g, '/'))
  return (
    base
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .replace(/[<>:"|?*]/g, '_')
      .trim()
      .slice(0, 180) || 'unnamed'
  )
}

export const isAllowedFile = (filename) => {
  const ext = extOf(filename)
  if (!ext) return { ok: false, reason: '文件缺少扩展名' }
  if (BLOCKED_EXTENSIONS.includes(ext)) return { ok: false, reason: `出于安全考虑，禁止上传 .${ext} 文件` }
  if (!allowedExtensions.includes(ext)) return { ok: false, reason: `不支持的文件类型: .${ext}` }
  return { ok: true, ext }
}

/** 生成唯一存储名：20260101-abcdef123456-随机.ext */
export const generateStoredName = (originalName) => {
  const now = new Date()
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('')
  const ext = extOf(originalName)
  const rand = crypto.randomBytes(6).toString('hex')
  return `${stamp}-${Date.now().toString(36)}-${rand}${ext ? '.' + ext : ''}`
}

/** 流式计算 sha256，避免大文件占用内存 */
export const sha256File = (filePath) =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })

export const filePathOf = (storedName) => path.join(config.uploadDir, path.basename(storedName))
export const thumbnailPathOf = (storedName) => path.join(config.thumbDir, path.basename(storedName))

/** 删除存储文件及其缩略图，返回是否删除成功（第三方条目的占位名会被忽略） */
export const removeStoredFile = async (storedName) => {
  if (!storedName || storedName.startsWith('external-')) return false
  const targets = [filePathOf(storedName), thumbnailPathOf(storedName)]
  let removed = false
  for (const target of targets) {
    try {
      await fsp.unlink(target)
      removed = true
    } catch (err) {
      if (err.code !== 'ENOENT') console.warn('[storage] 删除失败', target, err.message)
    }
  }
  return removed
}

export const humanSize = (bytes = 0) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'tif', 'tiff']
export const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'mkv', 'avi']
export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a']

/** 根据扩展名推断前端预览类型 */
export const previewKind = (ext = '') => {
  const e = ext.toLowerCase()
  if (IMAGE_EXTENSIONS.includes(e)) return 'image'
  if (VIDEO_EXTENSIONS.includes(e)) return 'video'
  if (AUDIO_EXTENSIONS.includes(e)) return 'audio'
  if (e === 'pdf') return 'pdf'
  if (['txt', 'md', 'json', 'xml', 'yml', 'yaml', 'csv', 'log', 'ini', 'conf'].includes(e)) return 'text'
  return 'other'
}

/** 常见第三方下载平台的展示名（用于自动识别，可在后台完全自定义覆盖） */
export const PROVIDER_PATTERNS = [
  { pattern: /(^|\.)curseforge\.com$/i, name: 'CurseForge' },
  { pattern: /(^|\.)modrinth\.com$/i, name: 'Modrinth' },
  { pattern: /(^|\.)github\.com$/i, name: 'GitHub' },
  { pattern: /(^|\.)githubusercontent\.com$/i, name: 'GitHub' },
  { pattern: /(^|\.)gitee\.com$/i, name: 'Gitee' },
  { pattern: /(^|\.)gitlab\.com$/i, name: 'GitLab' },
  { pattern: /(^|\.)pan\.baidu\.com$/i, name: '百度网盘' },
  { pattern: /(^|\.)lanzou[a-z]?\.com$/i, name: '蓝奏云' },
  { pattern: /(^|\.)lan[z]?ou[a-z]*\.(com|cn)$/i, name: '蓝奏云' },
  { pattern: /(^|\.)aliyundrive\.com$/i, name: '阿里云盘' },
  { pattern: /(^|\.)alipan\.com$/i, name: '阿里云盘' },
  { pattern: /(^|\.)pan\.quark\.cn$/i, name: '夸克网盘' },
  { pattern: /(^|\.)123pan\.com$/i, name: '123 云盘' },
  { pattern: /(^|\.)onedrive\.live\.com$/i, name: 'OneDrive' },
  { pattern: /(^|\.)sharepoint\.com$/i, name: 'SharePoint' },
  { pattern: /(^|\.)drive\.google\.com$/i, name: 'Google Drive' },
  { pattern: /(^|\.)mega\.nz$/i, name: 'MEGA' },
  { pattern: /(^|\.)mediafire\.com$/i, name: 'MediaFire' },
  { pattern: /(^|\.)dropbox\.com$/i, name: 'Dropbox' },
  { pattern: /(^|\.)sourceforge\.net$/i, name: 'SourceForge' },
  { pattern: /(^|\.)mc\.163\.com$/i, name: '网易我的世界' },
  { pattern: /(^|\.)qq\.com$/i, name: '腾讯微云' },
  { pattern: /(^|\.)weiyun\.com$/i, name: '腾讯微云' },
  { pattern: /(^|\.)microsoft\.com$/i, name: 'Microsoft' },
  { pattern: /(^|\.)apple\.com$/i, name: 'Apple' },
  { pattern: /(^|\.)steamcommunity\.com$/i, name: 'Steam' },
  { pattern: /(^|\.)itch\.io$/i, name: 'itch.io' }
]

/** 平台名 → 展示图标（emoji），未命中时前台会回退到站点 favicon 或 🔗 */
export const PROVIDER_ICONS = {
  GitHub: '🐙',
  'GitHub Releases': '🐙',
  GitLab: '🦊',
  Gitee: '🅶',
  CurseForge: '🔥',
  Modrinth: '🧩',
  百度网盘: '☁️',
  蓝奏云: '📦',
  阿里云盘: '☁️',
  夸克网盘: '⚡',
  '123 云盘': '🔢',
  OneDrive: '🗂️',
  'Google Drive': '🟢',
  MEGA: 'Ⓜ️',
  MediaFire: '💠',
  Dropbox: '📘',
  SourceForge: '🧰',
  网易我的世界: '🎮',
  腾讯微云: '🐧',
  Steam: '🎮',
  'itch.io': '🎲'
}

/** 由链接自动推断第三方平台名（识别不了则回退为域名） */
export const guessProvider = (url = '') => {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname
    const pathname = parsed.pathname || ''
    // GitHub 的深层地址（releases / tags / packages）单独识别，更贴近真实语义
    if (/(^|\.)github\.com$/i.test(host)) {
      if (/\/releases(\/|$)/i.test(pathname)) return 'GitHub Releases'
      if (/\/tags(\/|$)/i.test(pathname)) return 'GitHub Tags'
      if (/\/packages(\/|$)/i.test(pathname)) return 'GitHub Packages'
      return 'GitHub'
    }
    for (const item of PROVIDER_PATTERNS) {
      if (item.pattern.test(host)) return item.name
    }
    return host.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** 校验第三方下载链接，必须是 http(s) 且带主机名 */
export const isValidExternalUrl = (url = '') => {
  try {
    const parsed = new URL(String(url))
    return ['http:', 'https:'].includes(parsed.protocol) && !!parsed.hostname
  } catch {
    return false
  }
}

/** 解析「任意自定义字段」：支持 JSON 对象或 "键=值" 多行文本 */
export const parseExtras = (input) => {
  if (!input) return {}
  if (typeof input === 'object') {
    const out = {}
    for (const [key, value] of Object.entries(input)) {
      const k = String(key).trim().slice(0, 40)
      if (k) out[k] = String(value ?? '').slice(0, 200)
    }
    return out
  }
  const text = String(input).trim()
  if (!text) return {}
  if (text.startsWith('{')) {
    try {
      return parseExtras(JSON.parse(text))
    } catch {
      return {}
    }
  }
  const out = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim().slice(0, 40)
    if (key) out[key] = trimmed.slice(index + 1).trim().slice(0, 200)
  }
  return out
}

export const stringifyExtras = (input) => {
  const obj = parseExtras(input)
  return Object.keys(obj).length ? JSON.stringify(obj) : ''
}

/** 图标解析：自定义 > 内置映射（前台在为空时还会尝试站点 favicon） */
export const resolveProviderIcon = (provider, customIcon) => {
  if (customIcon) return customIcon
  if (provider && PROVIDER_ICONS[provider]) return PROVIDER_ICONS[provider]
  return ''
}

/** 序列化给前端的文件对象（同时覆盖本地上传与第三方链接两类） */
export const serializeFile = (row) => {
  if (!row) return null
  const stored = row.stored_name
  const isExternal = (row.source || 'local') === 'external' || (!stored && !!row.external_url)
  const base = {
    id: row.id,
    originalName: row.original_name,
    ext: row.ext,
    mime: row.mime,
    size: row.size,
    sha256: row.sha256,
    category: row.category,
    description: row.description,
    version: row.version,
    isPublic: !!row.is_public,
    downloadCount: row.download_count,
    createdAt: row.created_at
  }

  if (isExternal) {
    const provider = row.provider || guessProvider(row.external_url)
    const hasCheck = !!row.last_check_at
    return {
      ...base,
      source: 'external',
      isExternal: true,
      kind: 'link',
      storedName: '',
      provider,
      providerIcon: resolveProviderIcon(provider, row.provider_icon),
      externalUrl: row.external_url,
      buttonLabel: row.button_label || '',
      tags: (row.tags || '')
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 8),
      accessCode: row.access_code || '',
      sizeHint: row.size_hint || '',
      sizeText: row.size_hint || '第三方',
      sortOrder: row.sort_order ?? 0,
      openInNewTab: row.open_in_new_tab === 0 ? false : true,
      showUrl: row.show_url === 0 ? false : true,
      extras: parseExtras(row.extras),
      // 跳转前检测结果（未检测过则为 null）
      linkCheck: hasCheck
        ? {
            ok: (row.last_check_status || 0) >= 200 && (row.last_check_status || 0) < 400,
            status: row.last_check_status || 0,
            finalUrl: row.last_check_final_url || row.external_url,
            hops: row.last_check_hops || 0,
            latencyMs: row.last_check_ms || 0,
            error: row.last_check_error || '',
            checkedAt: row.last_check_at,
            failCount: row.check_fail_count || 0,
            // 401/403/429 等风控类结果：不代表链接失效，前端只做温和提示
            suspicious: /疑似风控|防盗链/.test(row.last_check_error || '') || [401, 403, 405, 406, 429, 503].includes(row.last_check_status || 0)
          }
        : null,
      url: row.external_url,
      downloadUrl: `/api/files/${row.id}/download`,
      thumbnailUrl: null
    }
  }

  return {
    ...base,
    source: 'local',
    isExternal: false,
    storedName: stored,
    kind: previewKind(row.ext),
    provider: '',
    providerIcon: '',
    externalUrl: '',
    buttonLabel: '',
    tags: [],
    accessCode: '',
    sizeHint: '',
    sortOrder: row.sort_order ?? 0,
    openInNewTab: true,
    showUrl: false,
    extras: {},
    sizeText: humanSize(row.size),
    url: `/uploads/${stored}`,
    downloadUrl: `/api/files/${row.id}/download`,
    thumbnailUrl: row.thumbnail ? `/uploads/thumbnails/${row.thumbnail}` : null
  }
}
