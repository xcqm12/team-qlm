/** 文件管理：上传、列表、详情、下载、删除、元数据更新、分类统计 */
import { Router } from 'express'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config.js'
import { get, paginate, query, run } from '../db/index.js'
import { optionalAuth, recordAudit, requireAuth } from '../middleware/auth.js'
import { ApiError, asyncHandler, ok } from '../middleware/errors.js'
import { uploadAny } from '../middleware/upload.js'
import { checkLink, checkLinksBatch, describeCheck, shouldBlockRedirect } from '../services/linkcheck.js'
import { getFileCategories, getLinkCheckConfig } from '../services/settings.js'
import {
  filePathOf,
  guessProvider,
  humanSize,
  isValidExternalUrl,
  previewKind,
  removeStoredFile,
  serializeFile,
  sha256File,
  stringifyExtras,
  thumbnailPathOf
} from '../services/storage.js'

const router = Router()

const SORTS = {
  newest: 'created_at DESC',
  oldest: 'created_at ASC',
  downloads: 'download_count DESC, created_at DESC',
  size: 'size DESC',
  name: 'original_name ASC',
  // 置顶优先：sort_order 越大越靠前（第三方条目可在后台自定义排序）
  pinned: 'COALESCE(sort_order, 0) DESC, created_at DESC'
}

/** 第三方条目的可自定义字段（同名字段在新增与编辑时通用） */
const EXTERNAL_TEXT_FIELDS = [
  ['provider', 'provider', 60],
  ['providerIcon', 'provider_icon', 200],
  ['buttonLabel', 'button_label', 24],
  ['accessCode', 'access_code', 60],
  ['sizeHint', 'size_hint', 40],
  ['tags', 'tags', 200]
]

/** 是否为第三方（外链）条目：没有本地文件，下载按钮跳转到外部地址 */
const isExternalRow = (row) => !!row && ((row.source || 'local') === 'external' || (!row.stored_name && !!row.external_url))

/* ---------------------------------------------------------------- 链接检测 */

const escapeHtml = (input = '') =>
  String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const parseTime = (value) => {
  if (!value) return 0
  const normalized = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T')
  const time = Date.parse(normalized)
  return Number.isNaN(time) ? 0 : time
}

/** 把检测结果写入 files 表 */
const persistLinkCheck = (id, check) => {
  const ok = check.ok ? 1 : 0
  run(
    `UPDATE files SET last_check_at = datetime('now','localtime'), last_check_status = ?,
                      last_check_final_url = ?, last_check_error = ?, last_check_ms = ?, last_check_hops = ?,
                      check_fail_count = CASE WHEN ? = 1 THEN 0 ELSE check_fail_count + 1 END
     WHERE id = ?`,
    [check.status || 0, check.finalUrl || '', (check.error || '').slice(0, 300), check.latencyMs || 0, check.hopCount || 0, ok, id]
  )
  return get('SELECT * FROM files WHERE id = ?', [id])
}

/** 需要时执行（或复用缓存的）检测结果 */
const ensureLinkChecked = async (row, { force = false } = {}) => {
  const cfg = getLinkCheckConfig()
  const lastAt = parseTime(row.last_check_at)
  const ageSeconds = lastAt ? (Date.now() - lastAt) / 1000 : Number.POSITIVE_INFINITY
  const cached = lastAt > 0 && ageSeconds < cfg.ttlSeconds

  if (cached && !force) {
    return {
      ok: (row.last_check_status || 0) >= 200 && (row.last_check_status || 0) < 400,
      status: row.last_check_status || 0,
      finalUrl: row.last_check_final_url || row.external_url,
      hopCount: row.last_check_hops || 0,
      latencyMs: row.last_check_ms || 0,
      error: row.last_check_error || '',
      checkedAt: row.last_check_at,
      cached: true,
      config: cfg
    }
  }

  const check = await checkLink(row.external_url, { timeoutMs: cfg.timeoutMs, maxHops: cfg.maxHops })
  persistLinkCheck(row.id, check)
  return { ...check, cached: false, config: cfg }
}

/** 链接不可达且开启了拦截时，返回一个可读的提示页（带"仍然前往"逃生通道） */
const renderUnavailablePage = (row, check) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>链接暂时无法访问 · ${escapeHtml(row.original_name)}</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f5f9fd;
       font-family:'PingFang SC','Microsoft YaHei',system-ui,sans-serif;color:#0f1b2d}
  .card{width:min(560px,92vw);background:#fff;border:1px solid #e3ebf5;border-radius:18px;padding:28px;
        box-shadow:0 18px 48px rgba(15,27,45,.14)}
  h1{font-size:20px;margin:0 0 6px}
  .muted{color:#6b7c93;font-size:14px}
  .meta{margin:18px 0;padding:14px;background:#f8fbff;border-radius:12px;font-size:13.5px;line-height:1.9;
        word-break:break-all}
  .meta b{color:#35455c;font-weight:600}
  .bad{color:#e5484d;font-weight:700}
  .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}
  a.btn{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border-radius:999px;text-decoration:none;
        font-weight:600;font-size:14.5px}
  .primary{background:linear-gradient(135deg,#1288f0,#23c3ae);color:#fff}
  .ghost{border:1px solid #e3ebf5;color:#35455c}
</style>
</head>
<body>
  <div class="card">
    <h1>⚠️ 该下载链接暂时无法访问</h1>
    <p class="muted">系统在跳转前做了连通性检测，第三方地址当前不可达，已阻止直接跳转。</p>
    <div class="meta">
      <div><b>文件：</b>${escapeHtml(row.original_name)}</div>
      <div><b>平台：</b>${escapeHtml(row.provider || '第三方')}</div>
      <div><b>检测结果：</b><span class="bad">${escapeHtml(describeCheck(check))}</span></div>
      <div><b>目标地址：</b>${escapeHtml(row.external_url)}</div>
      ${check.finalUrl && check.finalUrl !== row.external_url ? `<div><b>重定向至：</b>${escapeHtml(check.finalUrl)}</div>` : ''}
      <div><b>耗时：</b>${check.latencyMs} ms${check.hopCount ? ` · 跳转 ${check.hopCount} 次` : ''}</div>
      ${check.error ? `<div><b>错误：</b>${escapeHtml(check.error)}</div>` : ''}
    </div>
    <div class="actions">
      <a class="btn primary" href="/api/files/${row.id}/download?force=1" rel="noopener">仍然尝试前往 ↗</a>
      <a class="btn ghost" href="/files">返回文件下载</a>
    </div>
    <p class="muted" style="margin-top:16px;font-size:12.5px">
      提示：第三方平台可能临时限制访问，稍后可重试；如果长期失效，请联系管理员更新链接。
    </p>
  </div>
</body>
</html>`

/** 上传（支持字段 file / files，可一次多个） */
router.post(
  '/',
  requireAuth,
  uploadAny,
  asyncHandler(async (req, res) => {
    const uploaded = Array.isArray(req.files) ? req.files : req.file ? [req.file] : []
    if (!uploaded.length) throw ApiError.badRequest('未接收到文件')

    const category = (req.body?.category || '其他').toString().slice(0, 40)
    const description = (req.body?.description || '').toString().slice(0, 500)
    const version = (req.body?.version || '').toString().slice(0, 40)
    const isPublic = String(req.body?.isPublic ?? '1') === '0' ? 0 : 1

    const created = []
    for (const file of uploaded) {
      const absPath = file.path
      const sha256 = await sha256File(absPath).catch(() => '')
      const info = run(
        `INSERT INTO files (original_name, stored_name, ext, mime, size, sha256, category, description, version, is_public, uploader_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          file.originalname,
          file.filename,
          path.extname(file.filename).replace('.', '').toLowerCase(),
          file.mimetype || 'application/octet-stream',
          file.size,
          sha256,
          category,
          description,
          version,
          isPublic,
          req.user.sub
        ]
      )
      const row = get('SELECT * FROM files WHERE id = ?', [info.lastInsertRowid])
      created.push(serializeFile(row))
    }

    recordAudit({
      userId: req.user.sub,
      action: 'file.upload',
      target: created.map((f) => f.originalName).join(', '),
      detail: `${created.length} 个文件，分类 ${category}`,
      ip: req.ip
    })

    res.status(201).json({
      success: true,
      message: `成功上传 ${created.length} 个文件`,
      data: created.length === 1 ? created[0] : created,
      files: created
    })
  })
)

/** 检测任意链接（后台表单里"检测链接"按钮用，不落库） */
router.post(
  '/check-url',
  requireAuth,
  asyncHandler(async (req, res) => {
    const url = String(req.body?.url || '').trim()
    if (!url) throw ApiError.badRequest('请提供要检测的链接')
    const cfg = getLinkCheckConfig()
    const check = await checkLink(url, {
      timeoutMs: Number(req.body?.timeoutMs) || cfg.timeoutMs,
      maxHops: cfg.maxHops
    })
    ok(res, { check, summary: describeCheck(check) }, describeCheck(check))
  })
)

/** 批量检测所有第三方条目（运维/定时任务用） */
router.post(
  '/check-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    const cfg = getLinkCheckConfig()
    const rows = query(
      `SELECT * FROM files WHERE source = 'external' ORDER BY sort_order DESC, id ASC LIMIT 200`
    )
    if (!rows.length) return ok(res, { checked: 0, results: [], summary: { ok: 0, failed: 0 } })

    const onlyStale = req.body?.onlyStale !== false
    const targets = onlyStale
      ? rows.filter((row) => {
          const lastAt = parseTime(row.last_check_at)
          if (!lastAt) return true
          return (Date.now() - lastAt) / 1000 >= cfg.ttlSeconds
        })
      : rows

    if (!targets.length) {
      return ok(res, { checked: 0, skipped: rows.length, results: [], summary: { ok: 0, failed: 0 } }, '全部链接检测结果仍在有效期内')
    }

    const results = await checkLinksBatch(
      targets.map((row) => ({ id: row.id, url: row.external_url, name: row.original_name })),
      { concurrency: cfg.concurrency, timeoutMs: cfg.timeoutMs, maxHops: cfg.maxHops }
    )

    for (const item of results) persistLinkCheck(item.id, item.check)

    // 真失效与"疑似风控"分开统计：风控类在浏览器里通常可访问，不应触发告警
    const failedItems = results.filter((item) => shouldBlockRedirect(item.check))
    const suspiciousItems = results.filter((item) => item.check.suspicious)
    const okItems = results.filter((item) => item.check.ok)

    recordAudit({
      userId: req.user.sub,
      action: 'link.check-all',
      detail: `检测 ${results.length} 条，可达 ${okItems.length}，疑似风控 ${suspiciousItems.length}，异常 ${failedItems.length}`,
      ip: req.ip
    })

    ok(
      res,
      {
        checked: results.length,
        skipped: rows.length - results.length,
        summary: { ok: okItems.length, failed: failedItems.length, suspicious: suspiciousItems.length },
        results: results.map((item) => ({
          id: item.id,
          name: item.name,
          url: item.url,
          summary: describeCheck(item.check),
          check: item.check
        }))
      },
      `已检测 ${results.length} 条链接，异常 ${failedItems.length} 条`
    )
  })
)

/** 检测并记录单条第三方链接 */
router.post(
  '/:id(\\d+)/check',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = get('SELECT * FROM files WHERE id = ?', [req.params.id])
    if (!row) throw ApiError.notFound('文件不存在')
    if (!isExternalRow(row)) throw ApiError.badRequest('只有第三方下载条目需要检测链接')

    const cfg = getLinkCheckConfig()
    const check = await checkLink(row.external_url, { timeoutMs: cfg.timeoutMs, maxHops: cfg.maxHops })
    const updated = persistLinkCheck(row.id, check)
    recordAudit({
      userId: req.user.sub,
      action: 'link.check',
      target: row.original_name,
      detail: describeCheck(check),
      ip: req.ip
    })
    ok(
      res,
      { file: serializeFile(updated), check, summary: describeCheck(check) },
      `检测完成：${describeCheck(check)}`
    )
  })
)

/** 文件列表（本地上传 + 第三方链接统一返回） */
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { category = '', kind = '', q = '', sort = 'newest', page = 1, pageSize = 12, scope, source = '' } = req.query
    const wantsAll = scope === 'all' && !!req.user
    const where = []
    const params = []

    if (!req.user || !wantsAll) where.push('is_public = 1')
    if (category) {
      where.push('category = ?')
      params.push(String(category))
    }
    if (q) {
      where.push('(original_name LIKE ? OR description LIKE ? OR version LIKE ? OR provider LIKE ?)')
      const like = `%${String(q).trim()}%`
      params.push(like, like, like, like)
    }
    // 来源筛选：local 本站文件 / external 第三方链接
    if (source === 'local') where.push("COALESCE(source, 'local') = 'local'")
    if (source === 'external' || source === 'third') where.push("source = 'external'")

    if (kind === 'link') {
      where.push("source = 'external'")
    } else if (kind && kind !== 'all') {
      where.push("COALESCE(source, 'local') = 'local'")
      if (kind === 'image') where.push("ext IN ('png','jpg','jpeg','gif','webp','bmp','ico','tif','tiff')")
      if (kind === 'video') where.push("ext IN ('mp4','webm','mov','mkv','avi')")
      if (kind === 'archive') where.push("ext IN ('zip','rar','7z','tar','gz','tgz','jar')")
      if (kind === 'document') where.push("ext IN ('pdf','doc','docx','xls','xlsx','ppt','pptx','txt','md')")
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const orderBy = SORTS[String(sort)] || SORTS.newest
    const result = paginate(
      `SELECT * FROM files ${whereSql} ORDER BY ${orderBy}`,
      `SELECT COUNT(*) AS total FROM files ${whereSql}`,
      params,
      { page, pageSize }
    )

    const totals = get(
      `SELECT COUNT(*) AS count, COALESCE(SUM(size),0) AS bytes, COALESCE(SUM(download_count),0) AS downloads,
              SUM(CASE WHEN source = 'external' THEN 1 ELSE 0 END) AS external_count,
              SUM(CASE WHEN COALESCE(source,'local') = 'local' THEN 1 ELSE 0 END) AS local_count
       FROM files ${whereSql}`,
      params
    )

    ok(res, {
      ...result,
      items: result.items.map(serializeFile),
      summary: {
        count: totals?.count ?? 0,
        bytes: totals?.bytes ?? 0,
        sizeText: humanSize(totals?.bytes ?? 0),
        downloads: totals?.downloads ?? 0,
        localCount: totals?.local_count ?? 0,
        externalCount: totals?.external_count ?? 0
      }
    })
  })
)

/** 新增第三方下载条目（文件不落本站，仅登记外部链接） */
router.post(
  '/external',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = req.body || {}
    const title = String(body.originalName || body.title || '').trim()
    const externalUrl = String(body.externalUrl || body.url || '').trim()

    if (!title) throw ApiError.badRequest('请填写文件名称')
    if (!externalUrl) throw ApiError.badRequest('请填写第三方下载链接')
    if (!isValidExternalUrl(externalUrl)) throw ApiError.badRequest('下载链接必须是完整的 http(s) 地址')

    const provider = String(body.provider || '').trim() || guessProvider(externalUrl)
    const ext = (() => {
      try {
        const pathname = new URL(externalUrl).pathname
        const name = pathname.split('/').filter(Boolean).pop() || ''
        const index = name.lastIndexOf('.')
        return index > 0 ? name.slice(index + 1).toLowerCase().slice(0, 12) : ''
      } catch {
        return ''
      }
    })()

    const info = run(
      `INSERT INTO files (original_name, stored_name, ext, mime, size, sha256, category, description, version,
                          is_public, uploader_id, source, external_url, provider, provider_icon, button_label,
                          tags, access_code, size_hint, sort_order, open_in_new_tab, show_url, extras)
       VALUES (?, ?, ?, 'text/html', 0, '', ?, ?, ?, ?, ?, 'external', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title.slice(0, 180),
        // stored_name 有 UNIQUE 约束：第三方条目用占位名占位（不落盘），保证可多条并存
        `external-${crypto.randomBytes(8).toString('hex')}`,
        ext,
        String(body.category || '第三方下载').slice(0, 40),
        String(body.description || '').slice(0, 500),
        String(body.version || '').slice(0, 40),
        String(body.isPublic ?? '1') === '0' ? 0 : 1,
        req.user.sub,
        externalUrl.slice(0, 800),
        provider.slice(0, 60),
        String(body.providerIcon || '').slice(0, 200),
        String(body.buttonLabel || '').slice(0, 24),
        String(body.tags || '').slice(0, 200),
        String(body.accessCode || '').slice(0, 60),
        String(body.sizeHint || '').slice(0, 40),
        Number(body.sortOrder || 0),
        body.openInNewTab === false || String(body.openInNewTab) === '0' ? 0 : 1,
        body.showUrl === false || String(body.showUrl) === '0' ? 0 : 1,
        stringifyExtras(body.extras)
      ]
    )

    const row = get('SELECT * FROM files WHERE id = ?', [info.lastInsertRowid])
    recordAudit({
      userId: req.user.sub,
      action: 'file.external.create',
      target: row.original_name,
      detail: `${provider} → ${externalUrl}`,
      ip: req.ip
    })
    res.status(201).json({ success: true, message: '第三方下载已添加', data: serializeFile(row) })
  })
)

/** 分类统计（含数量） */
router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const configured = getFileCategories()
    const rows = query(
      `SELECT category, COUNT(*) AS count, COALESCE(SUM(size),0) AS bytes,
              SUM(CASE WHEN source = 'external' THEN 1 ELSE 0 END) AS external_count
       FROM files WHERE is_public = 1 GROUP BY category ORDER BY count DESC`
    )
    const map = new Map(rows.map((r) => [r.category, r]))
    const list = configured.map((name) => ({
      name,
      count: map.get(name)?.count ?? 0,
      bytes: map.get(name)?.bytes ?? 0,
      externalCount: map.get(name)?.external_count ?? 0
    }))
    for (const row of rows) {
      if (!configured.includes(row.category)) {
        list.push({ name: row.category, count: row.count, bytes: row.bytes, externalCount: row.external_count })
      }
    }
    const totals = get(
      `SELECT COUNT(*) AS count,
              SUM(CASE WHEN source = 'external' THEN 1 ELSE 0 END) AS external_count,
              SUM(CASE WHEN COALESCE(source,'local') = 'local' THEN 1 ELSE 0 END) AS local_count
       FROM files WHERE is_public = 1`
    )
    ok(res, {
      categories: list,
      kinds: ['image', 'video', 'archive', 'document', 'link'],
      sources: {
        all: totals?.count ?? 0,
        local: totals?.local_count ?? 0,
        external: totals?.external_count ?? 0
      }
    })
  })
)

/** 文件详情 */
router.get(
  '/:id(\\d+)',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const row = get('SELECT * FROM files WHERE id = ?', [req.params.id])
    if (!row) throw ApiError.notFound('文件不存在')
    if (!row.is_public && !req.user) throw ApiError.forbidden('该文件未公开')
    ok(res, { file: serializeFile(row), previewKind: previewKind(row.ext) })
  })
)

/** 下载：本地下发文件流，第三方条目跳转到外部链接（两者都计数） */
router.get(
  '/:id(\\d+)/download',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const row = get('SELECT * FROM files WHERE id = ?', [req.params.id])
    if (!row) throw ApiError.notFound('文件不存在')
    if (!row.is_public && !req.user) throw ApiError.forbidden('该文件未公开')

    const isExternal = isExternalRow(row)
    if (isExternal) {
      if (!isValidExternalUrl(row.external_url)) throw ApiError.internal('该第三方链接配置有误，请联系管理员')

      const cfg = getLinkCheckConfig()
      const force = String(req.query.force || '') === '1'

      // 跳转前连接检测：确认第三方地址可达（结果按 TTL 缓存，避免每次点击都探测）
      if (cfg.mode === 'before-redirect') {
        const check = await ensureLinkChecked(row, { force: false })
        recordAudit({
          userId: req.user?.sub ?? null,
          action: 'link.precheck',
          target: row.original_name,
          detail: `${describeCheck(check)}${check.cached ? '（缓存）' : ''}`,
          ip: req.ip
        })

        if (!check.ok && cfg.block && !force && shouldBlockRedirect(check)) {
          // 真失效且开启了拦截：返回可读提示页（页面内有"仍然前往"链接）
          return res.status(503).type('html').send(renderUnavailablePage(row, check))
        }
      }

      run('UPDATE files SET download_count = download_count + 1 WHERE id = ?', [row.id])
      recordAudit({
        userId: req.user?.sub ?? null,
        action: 'file.download.external',
        target: row.original_name,
        detail: row.external_url,
        ip: req.ip
      })
      // 站内链接统一走这里，302 跳到第三方平台（同时完成计数与审计）
      return res.redirect(302, row.external_url)
    }

    const absPath = filePathOf(row.stored_name)
    if (!fs.existsSync(absPath)) throw ApiError.notFound('文件已从磁盘丢失，请联系管理员重新上传')

    run('UPDATE files SET download_count = download_count + 1 WHERE id = ?', [row.id])
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.download(absPath, row.original_name, (err) => {
      if (err && !res.headersSent) {
        console.error('[files] 下载失败', err.message)
      }
    })
  })
)

/** 在线预览：第三方条目直接跳外部链接 */
router.get(
  '/:id(\\d+)/preview',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const row = get('SELECT * FROM files WHERE id = ?', [req.params.id])
    if (!row) throw ApiError.notFound('文件不存在')
    if (!row.is_public && !req.user) throw ApiError.forbidden('该文件未公开')

    if (isExternalRow(row) && row.external_url) {
      return res.redirect(302, row.external_url)
    }

    const absPath = filePathOf(row.stored_name)
    if (!fs.existsSync(absPath)) throw ApiError.notFound('文件已从磁盘丢失')

    const kind = previewKind(row.ext)
    if (kind === 'other') return res.redirect(`/api/files/${row.id}/download`)
    if (kind === 'image') {
      const thumb = thumbnailPathOf(row.stored_name)
      if (fs.existsSync(thumb)) return res.sendFile(thumb)
    }
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(row.original_name)}`)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.type(row.mime || 'application/octet-stream')
    res.sendFile(absPath)
  })
)

/** 更新元数据（本地上传与第三方条目通用） */
router.patch(
  '/:id(\\d+)',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = get('SELECT * FROM files WHERE id = ?', [req.params.id])
    if (!row) throw ApiError.notFound('文件不存在')

    const fields = []
    const params = []
    for (const [bodyKey, column] of [
      ['originalName', 'original_name'],
      ['category', 'category'],
      ['description', 'description'],
      ['version', 'version'],
      ...EXTERNAL_TEXT_FIELDS.map(([bodyKey, column]) => [bodyKey, column])
    ]) {
      if (req.body?.[bodyKey] !== undefined) {
        fields.push(`${column} = ?`)
        params.push(String(req.body[bodyKey]).slice(0, 500))
      }
    }
    // 数字 / 布尔型自定义字段
    if (req.body?.sortOrder !== undefined) {
      fields.push('sort_order = ?')
      params.push(Number(req.body.sortOrder) || 0)
    }
    for (const [bodyKey, column] of [
      ['openInNewTab', 'open_in_new_tab'],
      ['showUrl', 'show_url']
    ]) {
      if (req.body?.[bodyKey] !== undefined) {
        const value = req.body[bodyKey]
        fields.push(`${column} = ?`)
        params.push(value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0)
      }
    }
    if (req.body?.extras !== undefined) {
      fields.push('extras = ?')
      params.push(stringifyExtras(req.body.extras))
    }
    if (req.body?.externalUrl !== undefined) {
      const url = String(req.body.externalUrl).trim()
      if (url && !isValidExternalUrl(url)) throw ApiError.badRequest('下载链接必须是完整的 http(s) 地址')
      fields.push('external_url = ?')
      params.push(url.slice(0, 800))
      // 未手动指定平台时，按新链接重新识别
      if (url && req.body?.provider === undefined) {
        fields.push('provider = ?')
        params.push(guessProvider(url).slice(0, 60))
      }
    }
    if (req.body?.isPublic !== undefined) {
      fields.push('is_public = ?')
      params.push(req.body.isPublic ? 1 : 0)
    }
    if (!fields.length) throw ApiError.badRequest('没有需要更新的字段')

    params.push(row.id)
    run(`UPDATE files SET ${fields.join(', ')} WHERE id = ?`, params)
    const updated = get('SELECT * FROM files WHERE id = ?', [row.id])
    recordAudit({ userId: req.user.sub, action: 'file.update', target: row.original_name, ip: req.ip })
    ok(res, serializeFile(updated), '文件信息已更新')
  })
)

/** 把第三方条目一键转为本地上传不可行（无文件），但可把本地文件转为第三方链接 */
router.post(
  '/:id(\\d+)/make-external',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = get('SELECT * FROM files WHERE id = ?', [req.params.id])
    if (!row) throw ApiError.notFound('文件不存在')
    if (isExternalRow(row)) throw ApiError.badRequest('该条目已经是第三方链接')

    const externalUrl = String(req.body?.externalUrl || '').trim()
    if (!isValidExternalUrl(externalUrl)) throw ApiError.badRequest('请提供有效的 http(s) 下载链接')

    await removeStoredFile(row.stored_name)
    run(
      `UPDATE files SET source = 'external', external_url = ?, provider = ?, access_code = ?, size_hint = ?,
                        stored_name = ?, ext = ?, mime = 'text/html', size = 0, sha256 = '', thumbnail = NULL
       WHERE id = ?`,
      [
        externalUrl.slice(0, 800),
        (String(req.body?.provider || '').trim() || guessProvider(externalUrl)).slice(0, 60),
        String(req.body?.accessCode || '').slice(0, 60),
        String(req.body?.sizeHint || '').slice(0, 40),
        `external-${crypto.randomBytes(8).toString('hex')}`,
        row.ext,
        row.id
      ]
    )
    recordAudit({
      userId: req.user.sub,
      action: 'file.to-external',
      target: row.original_name,
      detail: externalUrl,
      ip: req.ip
    })
    ok(res, serializeFile(get('SELECT * FROM files WHERE id = ?', [row.id])), '已改为第三方下载链接')
  })
)

/** 删除单个文件 */
router.delete(
  '/:id(\\d+)',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = get('SELECT * FROM files WHERE id = ?', [req.params.id])
    if (!row) throw ApiError.notFound('文件不存在')
    if (isExternalRow(row)) {
      // 第三方条目没有本地文件，直接删记录
      run('DELETE FROM files WHERE id = ?', [row.id])
    } else {
      await removeStoredFile(row.stored_name)
      run('DELETE FROM files WHERE id = ?', [row.id])
    }
    recordAudit({
      userId: req.user.sub,
      action: isExternalRow(row) ? 'file.external.delete' : 'file.delete',
      target: row.original_name,
      ip: req.ip
    })
    ok(res, { id: row.id }, '文件已删除')
  })
)

/** 批量删除 */
router.post(
  '/batch-delete',
  requireAuth,
  asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : []
    if (!ids.length) throw ApiError.badRequest('请提供要删除的文件 id 列表')

    const placeholders = ids.map(() => '?').join(',')
    const rows = query(`SELECT * FROM files WHERE id IN (${placeholders})`, ids)
    for (const row of rows) {
      if (!isExternalRow(row) && row.stored_name) await removeStoredFile(row.stored_name)
    }
    const info = run(`DELETE FROM files WHERE id IN (${placeholders})`, ids)

    recordAudit({
      userId: req.user.sub,
      action: 'file.batch-delete',
      target: rows.map((r) => r.original_name).join(', '),
      ip: req.ip
    })
    ok(res, { deleted: info.changes }, `已删除 ${info.changes} 个文件`)
  })
)

/** 重新统计存储占用（后台维护用） */
router.get(
  '/storage-usage',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = get('SELECT COUNT(*) AS count, COALESCE(SUM(size),0) AS bytes FROM files')
    const orphan = []
    const known = new Set(query('SELECT stored_name FROM files').map((r) => r.stored_name))
    if (fs.existsSync(config.uploadDir)) {
      for (const name of fs.readdirSync(config.uploadDir)) {
        const full = path.join(config.uploadDir, name)
        if (fs.statSync(full).isFile() && !known.has(name)) orphan.push(name)
      }
    }
    ok(res, {
      count: row.count,
      bytes: row.bytes,
      sizeText: humanSize(row.bytes),
      orphanFiles: orphan,
      uploadDir: config.uploadDir,
      maxUploadSize: config.maxUploadSize
    })
  })
)

export default router
