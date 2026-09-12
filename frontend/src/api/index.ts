import { request, requestFull, uploadWithProgress } from './client'

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type FileSource = 'local' | 'external'

/** 跳转前链接检测结果 */
export interface LinkCheckResult {
  ok: boolean
  status: number
  finalUrl: string
  /** 跳转次数（落库字段） */
  hops: number
  /** 跳转次数（接口即时探测返回的原始字段，与 hops 等价） */
  hopCount?: number
  latencyMs: number
  error: string
  checkedAt: string
  failCount: number
  /** 是否来自缓存（仅接口即时返回时存在） */
  cached?: boolean
  /** 跳转成环 / 跳转次数过多（原始探测结果会带） */
  loop?: boolean
  tooManyHops?: boolean
  /** 疑似平台风控（401/403/429 等）：浏览器访问通常正常，不视为失效 */
  suspicious?: boolean
}

export interface FileItem {
  id: number
  originalName: string
  storedName: string
  ext: string
  mime: string
  size: number
  sizeText: string
  sha256: string
  category: string
  description: string
  version: string
  isPublic: boolean
  downloadCount: number
  /** link 表示第三方外链条目 */
  kind: 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'other' | 'link'
  createdAt: string
  url: string
  downloadUrl: string
  thumbnailUrl: string | null
  /** 来源：本站上传 / 第三方链接 */
  source: FileSource
  isExternal: boolean
  /** 第三方平台名，如 百度网盘、GitHub Releases */
  provider: string
  /** 平台图标：emoji 或图片地址（为空时前端用站点 favicon 兜底） */
  providerIcon: string
  externalUrl: string
  /** 自定义下载按钮文案，为空时用「前往下载 / 下载」 */
  buttonLabel: string
  /** 展示标签，如 官方 / 镜像 / 开源 */
  tags: string[]
  /** 网盘提取码（可为空） */
  accessCode: string
  sizeHint: string
  /** 置顶权重，越大越靠前（配合 sort=pinned） */
  sortOrder: number
  openInNewTab: boolean
  showUrl: boolean
  /** 任意自定义字段（键值对） */
  extras: Record<string, string>
  /** 最近一次链接检测结果（未检测过为 null） */
  linkCheck: LinkCheckResult | null
}

export interface ExternalFilePayload {
  originalName: string
  externalUrl: string
  provider?: string
  providerIcon?: string
  buttonLabel?: string
  tags?: string
  accessCode?: string
  sizeHint?: string
  category?: string
  description?: string
  version?: string
  isPublic?: boolean | string
  sortOrder?: number
  openInNewTab?: boolean | string
  showUrl?: boolean | string
  /** 支持 JSON 对象或 "键=值" 多行文本 */
  extras?: string | Record<string, string>
}

export interface Project {
  id: number
  slug: string
  title: string
  category: string
  version: string
  summary: string
  content: string
  tags: string
  repo_url: string
  external_url: string
  status: string
  sort_order: number
  views: number
  created_at: string
  updated_at: string
  cover: FileItem | null
}

export interface NewsItem {
  id: number
  slug: string
  title: string
  category: string
  summary: string
  content: string
  status: string
  views: number
  published_at: string
  cover: FileItem | null
}

export interface Member {
  id: number
  name: string
  role: string
  skills: string
  bio: string
  joined_at: string
  sort_order: number
  avatar: FileItem | null
}

export interface Message {
  id: number
  name: string
  email: string
  subject: string
  content: string
  status: 'new' | 'read' | 'replied' | 'archived'
  created_at: string
}

export interface SiteStats {
  project_count: number
  news_count: number
  /** 全部公开条目（含第三方） */
  file_count: number
  /** 其中第三方外链条目数 */
  external_file_count: number
  /** 其中本站上传文件数 */
  local_file_count: number
  file_bytes: number
  fileSizeText?: string
  download_count: number
  member_count: number
  unread_message_count: number
}

/* ---------- 站点 ---------- */
export const siteApi = {
  settings: () =>
    request<{ settings: Record<string, string>; fileCategories: string[]; version: string }>({
      url: '/site/settings'
    }),
  stats: () => request<{ stats: SiteStats }>({ url: '/site/stats' }),
  dashboard: () => request<any>({ url: '/site/dashboard' }),
  search: (q: string) => request<any>({ url: '/site/search', params: { q } }),
  updateSettings: (payload: Record<string, any>) =>
    request<{ updated: number }>({ url: '/site/settings', method: 'PUT', data: payload }),
  cleanupOrphans: () => request<{ removed: string[]; count: number }>({ url: '/site/cleanup-orphans', method: 'POST' }),
  /** 防 CC 运行时状态 */
  anticc: () => request<{ anticc: AntiCcStats }>({ url: '/site/anticc' }),
  anticcUnban: (ip = '') =>
    request<{ result: any; anticc: AntiCcStats }>({ url: '/site/anticc/unban', method: 'POST', data: { ip } })
}

export interface AntiCcStats {
  config: {
    enabled: boolean
    windowMs: number
    maxRequests: number
    maxConcurrent: number
    maxPerIp: number
    banSeconds: number
    skipToken: boolean
    whitelist: string[]
  }
  tracked: number
  banned: number
  bannedList: { ip: string; remainingSeconds: number; requests: number }[]
  blockedTotal: number
  bannedTotal: number
  concurrencyRejected: number
  inFlight: number
  lastBlockedAt: string
}

/* ---------- 认证 ---------- */
export const authApi = {
  login: (username: string, password: string) =>
    request<{ token: string; user: any }>({ url: '/auth/login', method: 'POST', data: { username, password } }),
  me: () => request<{ user: any; jwtSecretIsDefault: boolean }>({ url: '/auth/me' }),
  changePassword: (oldPassword: string, newPassword: string) =>
    request({ url: '/auth/password', method: 'POST', data: { oldPassword, newPassword } })
}

/* ---------- 文件 ---------- */
export const fileApi = {
  list: (params: Record<string, any> = {}) =>
    requestFull<Paged<FileItem> & { summary: any }>({ url: '/files', params }),
  categories: () =>
    request<{
      categories: { name: string; count: number; bytes: number; externalCount?: number }[]
      kinds: string[]
      sources: { all: number; local: number; external: number }
    }>({
      url: '/files/categories'
    }),
  detail: (id: number) => request<{ file: FileItem; previewKind: string }>({ url: `/files/${id}` }),
  update: (id: number, payload: Record<string, any>) =>
    request<FileItem>({ url: `/files/${id}`, method: 'PATCH', data: payload }),
  remove: (id: number) => request({ url: `/files/${id}`, method: 'DELETE' }),
  batchRemove: (ids: number[]) => request({ url: '/files/batch-delete', method: 'POST', data: { ids } }),
  storageUsage: () => request<any>({ url: '/files/storage-usage' }),
  upload: (formData: FormData, onProgress?: (p: number) => void) =>
    uploadWithProgress('/files', formData, onProgress),
  /** 新增第三方（外链）下载条目 */
  createExternal: (payload: ExternalFilePayload) =>
    request<FileItem>({ url: '/files/external', method: 'POST', data: payload }),
  /** 把已上传的本地文件改为第三方链接（会删除本地文件） */
  makeExternal: (id: number, payload: { externalUrl: string; provider?: string; accessCode?: string; sizeHint?: string }) =>
    request<FileItem>({ url: `/files/${id}/make-external`, method: 'POST', data: payload }),
  /** 检测任意链接（不落库，后台表单用） */
  checkUrl: (url: string, timeoutMs?: number) =>
    request<{ check: LinkCheckResult; summary: string }>({
      url: '/files/check-url',
      method: 'POST',
      data: { url, timeoutMs },
      timeout: 40000
    }),
  /** 检测并记录单条第三方链接 */
  checkOne: (id: number) =>
    request<{ file: FileItem; check: LinkCheckResult; summary: string }>({
      url: `/files/${id}/check`,
      method: 'POST',
      timeout: 40000
    }),
  /** 批量检测第三方链接 */
  checkAll: (onlyStale = true) =>
    request<{
      checked: number
      skipped: number
      summary: { ok: number; failed: number; suspicious?: number }
      results: { id: number; name: string; url: string; summary: string; check: LinkCheckResult }[]
    }>({ url: '/files/check-all', method: 'POST', data: { onlyStale }, timeout: 120000 })
}

/* ---------- 项目 ---------- */
export const projectApi = {
  list: (params: Record<string, any> = {}) => requestFull<Paged<Project> & { categories: any[] }>({ url: '/projects', params }),
  detail: (key: string | number) => request<{ project: Project; files: FileItem[] }>({ url: `/projects/${key}` }),
  create: (payload: Record<string, any>) => request<Project>({ url: '/projects', method: 'POST', data: payload }),
  update: (id: number, payload: Record<string, any>) =>
    request<Project>({ url: `/projects/${id}`, method: 'PUT', data: payload }),
  remove: (id: number) => request({ url: `/projects/${id}`, method: 'DELETE' }),
  bindFiles: (id: number, fileIds: number[]) =>
    request({ url: `/projects/${id}/files`, method: 'POST', data: { fileIds } })
}

/* ---------- 新闻 ---------- */
export const newsApi = {
  list: (params: Record<string, any> = {}) => requestFull<Paged<NewsItem>>({ url: '/news', params }),
  detail: (key: string | number) => request<{ news: NewsItem }>({ url: `/news/${key}` }),
  create: (payload: Record<string, any>) => request<NewsItem>({ url: '/news', method: 'POST', data: payload }),
  update: (id: number, payload: Record<string, any>) =>
    request<NewsItem>({ url: `/news/${id}`, method: 'PUT', data: payload }),
  remove: (id: number) => request({ url: `/news/${id}`, method: 'DELETE' })
}

/* ---------- 成员 ---------- */
export const memberApi = {
  list: () => request<{ items: Member[]; total: number }>({ url: '/members' }),
  create: (payload: Record<string, any>) => request<Member>({ url: '/members', method: 'POST', data: payload }),
  update: (id: number, payload: Record<string, any>) =>
    request<Member>({ url: `/members/${id}`, method: 'PUT', data: payload }),
  remove: (id: number) => request({ url: `/members/${id}`, method: 'DELETE' })
}

/* ---------- 留言 ---------- */
export const messageApi = {
  create: (payload: { name: string; email: string; subject?: string; content: string }) =>
    request<{ id: number }>({ url: '/messages', method: 'POST', data: payload }),
  list: (params: Record<string, any> = {}) => requestFull<Paged<Message> & { unread: number }>({ url: '/messages', params }),
  updateStatus: (id: number, status: string) =>
    request<Message>({ url: `/messages/${id}`, method: 'PATCH', data: { status } }),
  remove: (id: number) => request({ url: `/messages/${id}`, method: 'DELETE' })
}
