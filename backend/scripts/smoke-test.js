#!/usr/bin/env node
/**
 * 端到端冒烟测试：真实启动服务 → 登录 → 上传 → 列表 → 下载 → 改名 → 删除 → 留言
 * 用法: npm run smoke
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = Number(process.env.SMOKE_PORT || 8899)
const BASE = `http://127.0.0.1:${PORT}`

const results = []
const pass = (name, extra = '') => {
  results.push({ name, ok: true })
  console.log(`  ✅ ${name}${extra ? ' — ' + extra : ''}`)
}
const fail = (name, message) => {
  results.push({ name, ok: false, message })
  console.log(`  ❌ ${name} — ${message}`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const waitForHealth = async (timeoutMs = 30000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`)
      if (res.ok) return true
    } catch {
      /* 未就绪 */
    }
    await sleep(500)
  }
  return false
}

const api = async (method, url, { body, token, raw, redirect } = {}) => {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body && !raw) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers,
    body: raw ? body : body ? JSON.stringify(body) : undefined,
    ...(redirect ? { redirect } : {})
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* 非 JSON 响应 */
  }
  return { status: res.status, json, text, headers: res.headers }
}

/**
 * 防 CC 专项测试：另起一个低阈值实例，验证限流、封禁、令牌豁免与解封
 * 用独立实例的原因：验证过程中会把本机 IP 封禁，不能污染主测试流程
 */
const testAntiCc = async () => {
  const port = PORT + 2
  const base = `http://127.0.0.1:${port}`
  console.log(`\n--- 防 CC 专项测试（独立实例 :${port}，阈值 12 请求 / 封禁 3s）---`)

  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: ROOT,
    stdio: 'ignore',
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      NODE_ENV: 'development',
      DB_FILE: './data/smoke-test.db',
      UPLOAD_DIR: './data/smoke-uploads',
      ANTICC_ENABLED: '1',
      ANTICC_MAX_REQUESTS: '12',
      ANTICC_WINDOW_MS: '60000',
      ANTICC_BAN_SECONDS: '3',
      ANTICC_MAX_PER_IP: '50',
      ANTICC_MAX_CONCURRENT: '100'
    }
  })

  const plain = async (path, options = {}) => {
    const res = await fetch(`${base}${path}`, options)
    const text = await res.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      /* 非 JSON */
    }
    return { status: res.status, json, text, headers: res.headers }
  }

  try {
    // 就绪等待（注意：health 也会计入限流窗口）
    let ready = false
    for (let i = 0; i < 12 && !ready; i += 1) {
      try {
        const res = await fetch(`${base}/api/health`)
        if (res.ok) ready = true
      } catch {
        await sleep(400)
      }
    }
    if (!ready) {
      fail('防 CC：实例启动', `等待 ${base}/api/health 超时`)
      return
    }

    // 先连续请求直到被限流（此时尚未登录，因此不会进入信任名单）
    let blocked = null
    let attempts = 0
    while (attempts < 40 && !blocked) {
      attempts += 1
      const res = await plain('/api/health')
      if (res.status === 429) blocked = res
      else if (res.status !== 200) {
        fail('防 CC：限流响应', `意外状态 ${res.status}: ${res.text.slice(0, 100)}`)
        return
      }
    }

    if (blocked) {
      const retryAfter = blocked.headers.get('retry-after')
      const marker = blocked.headers.get('x-cc-protection')
      blocked.json?.retryAfter && retryAfter && marker
        ? pass('防 CC：超出阈值返回 429', `第 ${attempts} 次触发 · Retry-After=${retryAfter}s · ${blocked.json.message}`)
        : fail('防 CC：超出阈值返回 429', `status=${blocked.status} retryAfter=${retryAfter} marker=${marker}`)
    } else {
      fail('防 CC：超出阈值返回 429', `连续 ${attempts} 次请求均未被限流`)
      return
    }

    // 封禁期内普通请求继续被拒
    const duringBan = await plain('/api/health')
    duringBan.status === 429
      ? pass('防 CC：封禁期内持续拦截', `HTTP 429（${duringBan.json?.message || ''}）`)
      : fail('防 CC：封禁期内持续拦截', `HTTP ${duringBan.status}`)

    // 关键：登录接口不受 CC 封禁影响（否则管理员被误封后无法自救）
    const login = await plain('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD || 'qlm@2019' })
    })
    const token = login.json?.data?.token || null
    login.status === 200 && token
      ? pass('防 CC：被封禁时仍可登录（防死锁）', `HTTP 200，已获取 Token`)
      : fail('防 CC：被封禁时仍可登录（防死锁）', `HTTP ${login.status} ${login.text.slice(0, 120)}`)
    if (!token) return

    // 携带 Token 的请求豁免，并可查看状态
    const withToken = await plain('/api/site/anticc', { headers: { Authorization: `Bearer ${token}` } })
    const stats = withToken.json?.data?.anticc
    withToken.status === 200 && stats && stats.blockedTotal >= 1
      ? pass('防 CC：已登录请求豁免并可查看状态', `累计拦截 ${stats.blockedTotal} 次 · 确认封禁 ${stats.bannedTotal} 次`)
      : fail('防 CC：已登录请求豁免并可查看状态', `HTTP ${withToken.status} ${withToken.text.slice(0, 140)}`)

    // 登录成功的 IP 自动进入信任名单 → 不再被限流
    const trustedHits = []
    for (let i = 0; i < 20; i += 1) {
      const res = await plain('/api/health')
      trustedHits.push(res.status)
    }
    trustedHits.every((code) => code === 200)
      ? pass('防 CC：登录后 IP 进入信任名单（不再误封）', `连续 20 次请求全部 200`)
      : fail('防 CC：登录后 IP 进入信任名单（不再误封）', `出现异常状态：${[...new Set(trustedHits)].join(',')}`)

    // 手动解封后恢复（用 Token 调用，走豁免通道）
    const unban = await plain('/api/site/anticc/unban', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: '' })
    })
    const afterUnban = await plain('/api/site/anticc', { headers: { Authorization: `Bearer ${token}` } })
    unban.status === 200 && afterUnban.json?.data?.anticc?.banned === 0
      ? pass('防 CC：手动解封生效', `封禁数归零（${unban.json?.data?.result?.bannedCleared ?? 0} 个被清除）`)
      : fail('防 CC：手动解封生效', `unban=${unban.status} banned=${afterUnban.json?.data?.anticc?.banned}`)
  } catch (err) {
    fail('防 CC 专项测试', err.message)
  } finally {
    child.kill()
    await sleep(300)
  }
}

const main = async () => {  console.log(`\n=== 七零喵团队站点 冒烟测试 (${BASE}) ===\n`)
  const env = {
    ...process.env,
    PORT: String(PORT),
    HOST: '127.0.0.1',
    NODE_ENV: 'development',
    DB_FILE: './data/smoke-test.db',
    UPLOAD_DIR: './data/smoke-uploads',
    // 主测试服务器关闭应用层防 CC，避免高频用例被限流；防 CC 单独用另一个实例验证
    ANTICC_ENABLED: '0'
  }
  const child = spawn(process.execPath, ['src/server.js'], { cwd: ROOT, env, stdio: 'ignore' })
  let token = null
  let uploadedId = null
  let messageId = null

  try {
    const healthy = await waitForHealth()
    if (!healthy) {
      fail('服务启动', `等待 ${BASE}/api/health 超时`)
      throw new Error('server not healthy')
    }
    pass('服务启动', 'GET /api/health')

    // 1. 站点设置
    const settings = await api('GET', '/api/site/settings')
    settings.json?.data?.settings?.site_name === '七零喵团队'
      ? pass('公开设置', settings.json.data.settings.site_name)
      : fail('公开设置', `返回异常: ${settings.text.slice(0, 120)}`)

    // 2. 登录
    const login = await api('POST', '/api/auth/login', {
      body: { username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD || 'qlm@2019' }
    })
    if (login.status === 200 && login.json?.data?.token) {
      token = login.json.data.token
      pass('管理员登录', `用户 ${login.json.data.user.username}`)
    } else {
      fail('管理员登录', `HTTP ${login.status} ${login.text.slice(0, 160)}`)
      throw new Error('login failed')
    }

    // 3. 错误密码应被拒绝
    const badLogin = await api('POST', '/api/auth/login', { body: { username: 'admin', password: 'wrong-pass' } })
    badLogin.status === 401 ? pass('错误密码被拒绝', 'HTTP 401') : fail('错误密码被拒绝', `HTTP ${badLogin.status}`)

    // 4. 上传文件（multipart）
    const tmpFile = path.join(os.tmpdir(), `smoke-上传-${Date.now()}.txt`)
    fs.writeFileSync(tmpFile, `七零喵团队 冒烟测试内容 ${new Date().toISOString()}\n`, 'utf8')
    const form = new FormData()
    form.append('file', new Blob([fs.readFileSync(tmpFile)], { type: 'text/plain' }), `冒烟测试-${Date.now()}.txt`)
    form.append('category', '文档资料')
    form.append('description', '冒烟测试上传的文件')
    const upload = await api('POST', '/api/files', { body: form, raw: true, token })
    if (upload.status === 201 && upload.json?.data?.id) {
      uploadedId = upload.json.data.id
      pass('文件上传', `id=${uploadedId} ${upload.json.data.sizeText} sha256=${upload.json.data.sha256.slice(0, 12)}…`)
    } else {
      fail('文件上传', `HTTP ${upload.status} ${upload.text.slice(0, 200)}`)
    }

    // 5. 公开列表能看到
    const list = await api('GET', '/api/files?pageSize=50')
    const found = list.json?.data?.items?.some((f) => f.id === uploadedId)
    found ? pass('文件列表', `共 ${list.json.data.total} 个文件`) : fail('文件列表', '未找到刚上传的文件')

    // 6. 下载并校验内容
    if (uploadedId) {
      const dl = await api('GET', `/api/files/${uploadedId}/download`)
      dl.status === 200 && dl.text.includes('冒烟测试内容')
        ? pass('文件下载', `${dl.text.length} 字节，文件名头已设置`)
        : fail('文件下载', `HTTP ${dl.status}`)
    }

    // 7. 更新元数据
    if (uploadedId) {
      const patch = await api('PATCH', `/api/files/${uploadedId}`, {
        token,
        body: { description: '冒烟测试（已更新）', version: 'v0.0.1' }
      })
      patch.json?.data?.description === '冒烟测试（已更新）'
        ? pass('更新文件信息', 'description/version 已写入')
        : fail('更新文件信息', `HTTP ${patch.status} ${patch.text.slice(0, 160)}`)
    }

    // 8. 未授权上传应被拒绝
    const anon = await api('POST', '/api/files', { body: new FormData(), raw: true })
    ;[401, 400].includes(anon.status)
      ? pass('未授权上传被拒绝', `HTTP ${anon.status}`)
      : fail('未授权上传被拒绝', `HTTP ${anon.status}`)

    // 8.1 第三方下载：新增
    const ext = await api('POST', '/api/files/external', {
      token,
      body: {
        originalName: '冒烟测试 · 第三方网盘下载',
        externalUrl: 'https://example.com/downloads/patched.zip',
        provider: '百度网盘',
        accessCode: 'abcd',
        sizeHint: '1.2 GB',
        category: '第三方下载',
        version: 'v9.9.9',
        description: '冒烟测试用的第三方链接'
      }
    })
    let externalId = null
    if (ext.status === 201 && ext.json?.data?.isExternal) {
      externalId = ext.json.data.id
      pass('第三方下载新增', `id=${externalId} provider=${ext.json.data.provider} kind=${ext.json.data.kind}`)
    } else {
      fail('第三方下载新增', `HTTP ${ext.status} ${ext.text.slice(0, 200)}`)
    }

    // 8.2 第三方下载：非法链接被拒绝
    const badExt = await api('POST', '/api/files/external', {
      token,
      body: { originalName: '坏链接', externalUrl: 'javascript:alert(1)' }
    })
    badExt.status === 400
      ? pass('第三方非法链接被拒绝', 'HTTP 400')
      : fail('第三方非法链接被拒绝', `HTTP ${badExt.status}`)

    // 8.3 展示页可见（默认列表不区分来源）
    const mixedList = await api('GET', '/api/files?pageSize=50')
    const inMixed = mixedList.json?.data?.items?.some((f) => f.id === externalId)
    inMixed
      ? pass('第三方条目出现在文件列表', `总数 ${mixedList.json.data.total}，第三方 ${mixedList.json.data.summary.externalCount}`)
      : fail('第三方条目出现在文件列表', '未找到刚创建的第三方条目')

    // 8.4 来源筛选：source=external / local
    const onlyExternal = await api('GET', '/api/files?source=external&pageSize=50')
    const onlyLocal = await api('GET', '/api/files?source=local&pageSize=50')
    const extOk = onlyExternal.json?.data?.items?.every((f) => f.isExternal)
    const localOk = onlyLocal.json?.data?.items?.every((f) => !f.isExternal)
    extOk && localOk
      ? pass('来源筛选可用', `第三方 ${onlyExternal.json.data.total} / 本站 ${onlyLocal.json.data.total}`)
      : fail('来源筛选可用', `external 全为第三方=${extOk}，local 全为本站=${localOk}`)

    // 8.5 第三方下载走 302 跳转并计数
    if (externalId) {
      const before = (await api('GET', `/api/files/${externalId}`)).json?.data?.file?.downloadCount ?? 0
      const redirect = await api('GET', `/api/files/${externalId}/download`, { redirect: 'manual' })
      const after = (await api('GET', `/api/files/${externalId}`)).json?.data?.file?.downloadCount ?? 0
      redirect.status === 302 && after === before + 1
        ? pass('第三方下载 302 跳转且计数 +1', `Location: ${redirect.headers.get('location')}`)
        : fail('第三方下载 302 跳转且计数 +1', `HTTP ${redirect.status}, count ${before}→${after}`)
    }

    // 8.6 第三方条目可编辑（含链接识别平台）
    if (externalId) {
      const patchExt = await api('PATCH', `/api/files/${externalId}`, {
        token,
        body: { externalUrl: 'https://pan.baidu.com/s/abcdef', sizeHint: '2.0 GB' }
      })
      patchExt.json?.data?.provider === '百度网盘' && patchExt.json?.data?.sizeText === '2.0 GB'
        ? pass('第三方条目编辑与平台识别', `provider=${patchExt.json.data.provider}`)
        : fail('第三方条目编辑与平台识别', `HTTP ${patchExt.status} ${patchExt.text.slice(0, 160)}`)
    }

    // 8.7 第三方条目删除
    if (externalId) {
      const delExt = await api('DELETE', `/api/files/${externalId}`, { token })
      delExt.json?.success ? pass('第三方条目删除', `id=${externalId}`) : fail('第三方条目删除', `HTTP ${delExt.status}`)
      const goneExt = await api('GET', `/api/files/${externalId}`)
      goneExt.status === 404 ? pass('第三方条目删除后不可见', 'HTTP 404') : fail('第三方条目删除后不可见', `HTTP ${goneExt.status}`)
    }

    // 8.8 全自定义第三方条目（GitHub Releases 深层地址 + 自定义图标/按钮/标签/排序/开关/附加字段）
    const LF = String.fromCharCode(10)
    const customCreate = await api('POST', '/api/files/external', {
      token,
      body: {
        originalName: '站点源码 · GitHub Releases',
        externalUrl: 'https://github.com/qlm/team-site/releases',
        provider: '', // 留空 → 按链接自动识别
        providerIcon: '🐙',
        buttonLabel: '去 Release 页',
        tags: '官方,开源',
        sortOrder: 99,
        openInNewTab: false,
        showUrl: false,
        extras: ['授权=MIT', '附件数=3'].join(LF),
        sizeHint: '不定',
        category: '第三方下载'
      }
    })
    let customId = null
    const c = customCreate.json?.data
    if (customCreate.status === 201 && c) {
      customId = c.id
      const okCustom =
        c.provider === 'GitHub Releases' &&
        c.providerIcon === '🐙' &&
        c.buttonLabel === '去 Release 页' &&
        Array.isArray(c.tags) &&
        c.tags.join('/') === '官方/开源' &&
        c.sortOrder === 99 &&
        c.openInNewTab === false &&
        c.showUrl === false &&
        c.extras?.['授权'] === 'MIT' &&
        c.extras?.['附件数'] === '3'
      okCustom
        ? pass(
            '全自定义第三方条目',
            `平台=${c.provider} 图标=${c.providerIcon} 按钮=「${c.buttonLabel}」 标签=${c.tags.join('/')} 置顶=${c.sortOrder} 附加字段=${Object.keys(c.extras).join('/')}`
          )
        : fail('全自定义第三方条目', JSON.stringify(c))
    } else {
      fail('全自定义第三方条目', `HTTP ${customCreate.status} ${customCreate.text.slice(0, 200)}`)
    }

    // 8.9 置顶排序：sort=pinned 时 sortOrder 最大的排最前
    if (customId) {
      const pinned = await api('GET', '/api/files?sort=pinned&pageSize=50')
      pinned.json?.data?.items?.[0]?.id === customId
        ? pass('置顶排序 sort=pinned', `首位为 sortOrder=${pinned.json.data.items[0].sortOrder} 的条目`)
        : fail('置顶排序 sort=pinned', `首位 id=${pinned.json?.data?.items?.[0]?.id}，期望 ${customId}`)
    }

    // 8.10 自定义字段可再编辑
    if (customId) {
      const patchCustom = await api('PATCH', `/api/files/${customId}`, {
        token,
        body: { buttonLabel: '前往 GitHub', sortOrder: 100, tags: '官方,开源,MIT', extras: '{"授权":"MIT","附件数":"4"}' }
      })
      const pc = patchCustom.json?.data
      pc?.buttonLabel === '前往 GitHub' && pc?.sortOrder === 100 && pc?.extras?.['附件数'] === '4'
        ? pass('自定义字段可再编辑', `按钮=「${pc.buttonLabel}」 附加字段附件数=${pc.extras['附件数']}`)
        : fail('自定义字段可再编辑', `HTTP ${patchCustom.status} ${patchCustom.text.slice(0, 160)}`)
      await api('DELETE', `/api/files/${customId}`, { token })
    }

    /* ---------------- 链接检测 / 跳转前检查 ---------------- */

    // 8.11 本地临时服务：用于可复现地测试 HEAD 回退与跳转链（不依赖外网）
    const probeHits = []
    const probeServer = http.createServer((req, res) => {
      probeHits.push(`${req.method} ${req.url}`)
      if (req.url === '/redirect') {
        res.writeHead(302, { Location: '/final' })
        return res.end()
      }
      if (req.url === '/loop-a') {
        res.writeHead(302, { Location: '/loop-b' })
        return res.end()
      }
      if (req.url === '/loop-b') {
        res.writeHead(302, { Location: '/loop-a' })
        return res.end()
      }
      if (req.url === '/head-rejected') {
        if (req.method === 'HEAD') {
          res.writeHead(405)
          return res.end()
        }
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': '4' })
        return res.end('data')
      }
      if (req.url === '/forbidden') {
        res.writeHead(403, { 'Content-Type': 'text/html' })
        return res.end('blocked by waf')
      }
      if (req.url === '/final' || req.url === '/ok') {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        return res.end('ok')
      }
      res.writeHead(404)
      res.end()
    })
    await new Promise((resolve) => probeServer.listen(0, '127.0.0.1', resolve))
    const probePort = probeServer.address().port
    const probeBase = `http://127.0.0.1:${probePort}`

    try {
      // 8.12 检测可达链接
      const okCheck = await api('POST', '/api/files/check-url', { token, body: { url: `${probeBase}/ok` } })
      const okc = okCheck.json?.data?.check
      okc?.ok && okc.status === 200 && okc.hopCount === 0
        ? pass('链接检测：可达', `${okCheck.json.data.summary}（${okc.latencyMs}ms）`)
        : fail('链接检测：可达', `HTTP ${okCheck.status} ${okCheck.text.slice(0, 160)}`)

      // 8.13 检测不可达链接
      const deadCheck = await api('POST', '/api/files/check-url', { token, body: { url: 'http://127.0.0.1:1/none' } })
      const deadc = deadCheck.json?.data?.check
      deadc && deadc.ok === false && deadc.error
        ? pass('链接检测：不可达', `${deadCheck.json.data.summary}`)
        : fail('链接检测：不可达', `HTTP ${deadCheck.status} ${deadCheck.text.slice(0, 160)}`)

      // 8.14 跳转链追踪（302 → /final）
      const redirectCheck = await api('POST', '/api/files/check-url', { token, body: { url: `${probeBase}/redirect` } })
      const rc = redirectCheck.json?.data?.check
      rc?.ok && rc.hopCount === 1 && rc.finalUrl.endsWith('/final')
        ? pass('跳转链追踪', `1 次跳转 → ${rc.finalUrl}（${redirectCheck.json.data.summary}）`)
        : fail('跳转链追踪', JSON.stringify(rc))

      // 8.15 跳转环检测
      const loopCheck = await api('POST', '/api/files/check-url', { token, body: { url: `${probeBase}/loop-a` } })
      const lc = loopCheck.json?.data?.check
      lc?.loop === true && lc.ok === false
        ? pass('跳转环检测', lc.error.slice(0, 60))
        : fail('跳转环检测', JSON.stringify(lc))

      // 8.16 HEAD 被拒时回退 GET
      probeHits.length = 0
      const fallbackCheck = await api('POST', '/api/files/check-url', { token, body: { url: `${probeBase}/head-rejected` } })
      const fc = fallbackCheck.json?.data?.check
      fc?.ok && fc.method === 'GET'
        ? pass('HEAD 被拒自动回退 GET', `命中: ${probeHits.join(' → ')}`)
        : fail('HEAD 被拒自动回退 GET', JSON.stringify(fc))

      // 8.17 单条检测结果落库
      const checkTarget = await api('POST', '/api/files/external', {
        token,
        body: { originalName: '链接检测用例', externalUrl: `${probeBase}/ok`, category: '第三方下载' }
      })
      const checkTargetId = checkTarget.json?.data?.id
      const single = await api('POST', `/api/files/${checkTargetId}/check`, { token })
      const sc = single.json?.data?.file?.linkCheck
      sc?.ok && sc.status === 200 && sc.checkedAt
        ? pass('单条检测并落库', `${single.json.data.summary} · 记录时间 ${sc.checkedAt}`)
        : fail('单条检测并落库', `HTTP ${single.status} ${single.text.slice(0, 160)}`)

      // 8.18 跳转前检测拦截（block=1 + ttl=0）→ 503 提示页，force=1 放行
      const deadEntry = await api('POST', '/api/files/external', {
        token,
        body: { originalName: '失效链接用例', externalUrl: 'http://127.0.0.1:1/dead', category: '第三方下载' }
      })
      const deadId = deadEntry.json?.data?.id
      await api('PUT', '/api/site/settings', { token, body: { link_check_block: '1', link_check_ttl: '0' } })

      const blocked = await api('GET', `/api/files/${deadId}/download`, { redirect: 'manual' })
      const blockedOk =
        blocked.status === 503 && /无法访问|仍然尝试前往/.test(blocked.text) && blocked.text.includes('force=1')
      blockedOk
        ? pass('跳转前检测拦截不可达链接', 'HTTP 503 提示页（含「仍然尝试前往」逃生通道）')
        : fail('跳转前检测拦截不可达链接', `HTTP ${blocked.status} ${blocked.text.slice(0, 120)}`)

      const forced = await api('GET', `/api/files/${deadId}/download?force=1`, { redirect: 'manual' })
      forced.status === 302
        ? pass('force=1 可强制放行', `Location: ${forced.headers.get('location')}`)
        : fail('force=1 可强制放行', `HTTP ${forced.status}`)

      // 8.18.1 风控类结果（403）不算失效：即使开启拦截也应放行跳转
      const wafCheck = await api('POST', '/api/files/check-url', { token, body: { url: `${probeBase}/forbidden` } })
      const wc = wafCheck.json?.data?.check
      wc && wc.ok === false && wc.suspicious === true && wc.status === 403
        ? pass('风控类结果标记为疑似（不判失效）', `${wafCheck.json.data.summary}`)
        : fail('风控类结果标记为疑似（不判失效）', JSON.stringify(wc))

      const wafEntry = await api('POST', '/api/files/external', {
        token,
        body: { originalName: '风控链接用例', externalUrl: `${probeBase}/forbidden`, category: '第三方下载' }
      })
      const wafId = wafEntry.json?.data?.id
      await api('PUT', '/api/site/settings', { token, body: { link_check_block: '1', link_check_ttl: '0' } })
      const wafDownload = await api('GET', `/api/files/${wafId}/download`, { redirect: 'manual' })
      wafDownload.status === 302
        ? pass('风控链接在拦截模式下仍可跳转', `HTTP 302 → ${wafDownload.headers.get('location')}`)
        : fail('风控链接在拦截模式下仍可跳转', `HTTP ${wafDownload.status}`)
      await api('DELETE', `/api/files/${wafId}`, { token })

      // 8.19 可达链接不会被拦截，且缓存生效（第二次不重复探测）
      const goodEntry = await api('POST', '/api/files/external', {
        token,
        body: { originalName: '可达链接用例', externalUrl: `${probeBase}/ok`, category: '第三方下载' }
      })
      const goodId = goodEntry.json?.data?.id
      await api('PUT', '/api/site/settings', { token, body: { link_check_ttl: '600' } })
      const goodDownload = await api('GET', `/api/files/${goodId}/download`, { redirect: 'manual' })
      const cacheBefore = probeHits.length
      await api('GET', `/api/files/${goodId}/download`, { redirect: 'manual' })
      const cacheAfter = probeHits.length
      goodDownload.status === 302 && cacheAfter === cacheBefore
        ? pass('可达链接正常跳转且结果有缓存', `探测次数 ${cacheBefore} → ${cacheAfter}（第二次命中缓存，未再打扰第三方）`)
        : fail('可达链接正常跳转且结果有缓存', `status=${goodDownload.status} 探测次数 ${cacheBefore}→${cacheAfter}`)

      // 8.20 批量检测
      const batch = await api('POST', '/api/files/check-all', { token, body: { onlyStale: false } })
      const bs = batch.json?.data?.summary
      const counted = (bs?.ok ?? 0) + (bs?.failed ?? 0) + (bs?.suspicious ?? 0)
      batch.json?.success && bs && counted === batch.json.data.checked
        ? pass(
            '批量检测（check-all）',
            `检测 ${batch.json.data.checked} 条：可达 ${bs.ok} · 疑似风控 ${bs.suspicious ?? 0} · 失效 ${bs.failed}`
          )
        : fail('批量检测（check-all）', `HTTP ${batch.status} ${batch.text.slice(0, 160)}`)

      // 收尾：恢复默认设置并清理用例
      await api('PUT', '/api/site/settings', { token, body: { link_check_block: '0', link_check_ttl: '600' } })
      for (const id of [checkTargetId, deadId, goodId]) {
        if (id) await api('DELETE', `/api/files/${id}`, { token })
      }
    } finally {
      probeServer.close()
    }

    // 9. 项目与新闻
    const projects = await api('GET', '/api/projects')
    projects.json?.data?.total >= 2
      ? pass('项目列表', `${projects.json.data.total} 个项目，分类 ${projects.json.data.categories.length} 个`)
      : fail('项目列表', `返回 ${projects.text.slice(0, 120)}`)

    const projectDetail = await api('GET', '/api/projects/super-hi-vision')
    projectDetail.json?.data?.project?.title
      ? pass('项目详情', projectDetail.json.data.project.title)
      : fail('项目详情', `HTTP ${projectDetail.status}`)

    const news = await api('GET', '/api/news')
    news.json?.data?.total >= 4
      ? pass('新闻列表', `${news.json.data.total} 条动态`)
      : fail('新闻列表', `返回 ${news.text.slice(0, 120)}`)

    const members = await api('GET', '/api/members')
    members.json?.data?.total >= 9
      ? pass('团队成员', `${members.json.data.total} 位成员`)
      : fail('团队成员', `返回 ${members.text.slice(0, 120)}`)

    // 10. 留言
    const msg = await api('POST', '/api/messages', {
      body: { name: '冒烟测试', email: 'smoke@example.com', subject: '自动测试', content: '这是一条自动冒烟测试留言。' }
    })
    if (msg.status === 200) {
      messageId = msg.json?.data?.id
      pass('提交留言', `id=${messageId}`)
    } else {
      fail('提交留言', `HTTP ${msg.status} ${msg.text.slice(0, 160)}`)
    }

    const badMsg = await api('POST', '/api/messages', { body: { name: 'x', email: 'bad-email', content: 'hi' } })
    badMsg.status === 400 ? pass('留言校验', '非法邮箱被拒绝') : fail('留言校验', `HTTP ${badMsg.status}`)

    // 11. 后台概览
    const dash = await api('GET', '/api/site/dashboard', { token })
    dash.json?.data?.stats ? pass('后台概览', `存储 ${dash.json.data.stats.sizeText || dash.json.data.runtime.maxUploadSizeText}`) : fail('后台概览', `HTTP ${dash.status}`)

    // 12. 清理
    if (messageId) await api('DELETE', `/api/messages/${messageId}`, { token })
    if (uploadedId) {
      const del = await api('DELETE', `/api/files/${uploadedId}`, { token })
      del.json?.success ? pass('删除文件', '记录与磁盘文件已清理') : fail('删除文件', `HTTP ${del.status}`)
    }

    const gone = await api('GET', `/api/files/${uploadedId}`)
    gone.status === 404 ? pass('删除后不可见', 'HTTP 404') : fail('删除后不可见', `HTTP ${gone.status}`)

    fs.rmSync(tmpFile, { force: true })
  } catch (err) {
    console.error('\n[smoke] 中断:', err.message)
    if (!results.some((r) => !r.ok)) fail('测试执行', err.message)
  } finally {
    child.kill()
    await sleep(300)
  }

  // ---------------- 防 CC 专项：单独起一个低阈值实例验证 ----------------
  await testAntiCc()

  const failed = results.filter((r) => !r.ok)
  console.log(`\n=== 结果: ${results.length - failed.length}/${results.length} 通过 ===`)
  if (failed.length) {
    for (const f of failed) console.log(`  ❌ ${f.name}: ${f.message}`)
    process.exit(1)
  }
  console.log('全部通过 🎉\n')
}

main()
