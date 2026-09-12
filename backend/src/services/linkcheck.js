/**
 * 第三方下载链接检测（跳转前连通性 + 跳转链检测）
 *
 * 很多外链（网盘、Release 页）会经过多次 302 跳转，也可能已经失效。
 * 这里在真正把访客"跳过去"之前先做一次探测：
 *   · 逐跳跟随（manual redirect）拿到真实终点、跳转次数、是否存在跳转环
 *   · HEAD 优先，遇到 405/501/403 或异常时回退 GET（带 Range: bytes=0-0，只取 1 字节）
 *   · 全程超时控制，绝不长时间挂住请求
 */
import { isValidExternalUrl } from './storage.js'

const DEFAULT_UA = 'QLM-TeamSite-LinkChecker/1.0 (+https://team.qlm.org.cn)'
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308])
/**
 * 常见"风控/防盗链"状态码：服务器探测会被拒，但浏览器里正常访问。
 * 这类结果标记为 suspicious，只记录不拦截，避免把可用链接误判成失效。
 */
const SUSPICIOUS_STATUS = new Set([401, 403, 405, 406, 429, 503])

/** 单跳请求（manual redirect，便于自己追踪跳转链） */
const singleRequest = async (target, method, { timeoutMs, userAgent }) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const headers = {
      'User-Agent': userAgent,
      Accept: '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    }
    // GET 只取首字节，避免把大文件拖下来
    if (method === 'GET') headers.Range = 'bytes=0-0'
    return await fetch(target, { method, redirect: 'manual', headers, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const resolveLocation = (location, base) => {
  try {
    return new URL(location, base).href
  } catch {
    return null
  }
}

/**
 * 检测一个外链
 * @returns {Promise<{ok:boolean,status:number,method:string,finalUrl:string,hops:string[],
 *   hopCount:number,latencyMs:number,contentType:string,contentLength:number,error:string,
 *   loop:boolean,tooManyHops:boolean,checkedAt:string}>}
 */
export const checkLink = async (url, options = {}) => {
  const {
    timeoutMs = 8000,
    maxHops = 6,
    userAgent = DEFAULT_UA
  } = options

  const startedAt = Date.now()
  const checkedAt = new Date().toISOString()
  const result = {
    ok: false,
    status: 0,
    method: 'HEAD',
    finalUrl: String(url || ''),
    hops: [],
    hopCount: 0,
    latencyMs: 0,
    contentType: '',
    contentLength: 0,
    error: '',
    loop: false,
    tooManyHops: false,
    /** 疑似被平台风控/防盗链拦截（浏览器访问通常仍正常，不应据此拦截跳转） */
    suspicious: false,
    checkedAt
  }

  if (!isValidExternalUrl(url)) {
    result.error = '链接格式不合法（必须是 http/https 完整地址）'
    result.latencyMs = Date.now() - startedAt
    return result
  }

  let current = String(url)
  const seen = new Set()
  let method = 'HEAD'

  try {
    for (let hop = 0; hop <= maxHops; hop += 1) {
      if (seen.has(current)) {
        result.loop = true
        result.error = `检测到跳转环：${current}`
        break
      }
      seen.add(current)
      if (hop > 0) result.hops.push(current)

      let response
      try {
        response = await singleRequest(current, method, { timeoutMs, userAgent })
      } catch (err) {
        // HEAD 被拒或网络异常时回退 GET 再试一次
        if (method === 'HEAD') {
          method = 'GET'
          response = await singleRequest(current, method, { timeoutMs, userAgent })
        } else {
          throw err
        }
      }

      // 部分服务器不支持 HEAD（405/501）或直接 403，回退 GET 判断
      if (method === 'HEAD' && [403, 405, 501].includes(response.status)) {
        method = 'GET'
        response = await singleRequest(current, method, { timeoutMs, userAgent })
      }

      result.status = response.status
      result.method = method
      result.contentType = response.headers.get('content-type') || ''
      const length = Number(response.headers.get('content-length') || 0)
      result.contentLength = Number.isFinite(length) ? length : 0

      if (REDIRECT_STATUS.has(response.status)) {
        const location = response.headers.get('location') || ''
        const next = resolveLocation(location, current)
        if (!next) {
          result.error = `跳转地址无法解析：${location || '(空 Location)'}`
          break
        }
        // 跳转目标是新的一跳，方法回到 HEAD 重新探测
        method = 'HEAD'
        current = next
        if (hop === maxHops) {
          result.tooManyHops = true
          result.error = `跳转次数超过上限（${maxHops} 次）`
          break
        }
        continue
      }

      result.finalUrl = current
      result.ok = response.status >= 200 && response.status < 400
      // 401/403/429 等通常是平台风控：记录为"疑似拦截"，而不是判定链接失效
      if (!result.ok && SUSPICIOUS_STATUS.has(response.status)) {
        result.suspicious = true
        result.error = `平台返回 HTTP ${response.status}（疑似风控 / 防盗链，浏览器访问通常正常）`
      }
      // 尽力释放连接
      try {
        if (response.body) await response.body.cancel()
      } catch {
        /* 忽略 */
      }
      break
    }
  } catch (err) {
    result.error = describeFetchError(err, timeoutMs)
    result.ok = false
  }

  result.hopCount = result.hops.length
  result.finalUrl = result.finalUrl || current
  result.latencyMs = Date.now() - startedAt
  return result
}

/** 把底层网络错误翻译成人能看懂的中文原因 */
const ERROR_CODE_TEXT = {
  ENOTFOUND: '域名无法解析',
  EAI_AGAIN: 'DNS 解析超时',
  ECONNREFUSED: '连接被拒绝（服务未监听或端口不通）',
  ECONNRESET: '连接被对端重置',
  EHOSTUNREACH: '主机不可达',
  ENETUNREACH: '网络不可达',
  ETIMEDOUT: '连接超时',
  EPROTO: '协议错误（可能是 HTTPS 握手失败）',
  CERT_HAS_EXPIRED: 'HTTPS 证书已过期',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'HTTPS 证书无法验证',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'HTTPS 使用自签名证书',
  ERR_TLS_CERT_ALTNAME_INVALID: 'HTTPS 证书域名不匹配'
}

const describeFetchError = (err, timeoutMs) => {
  if (!err) return '网络异常'
  if (err.name === 'AbortError' || err.name === 'TimeoutError') return `请求超时（>${timeoutMs}ms）`

  const codes = []
  const collect = (e) => {
    if (!e || typeof e !== 'object') return
    if (e.code) codes.push(e.code)
    if (e.cause) collect(e.cause)
    if (Array.isArray(e.errors)) e.errors.forEach(collect)
  }
  collect(err)

  const matched = codes.find((code) => ERROR_CODE_TEXT[code])
  if (matched) return ERROR_CODE_TEXT[matched]
  if (/fetch failed/i.test(err.message || '')) return '请求失败（网络不可达或被对端拒绝）'
  return err.message || '网络异常'
}
export const checkLinksBatch = async (items, { concurrency = 3, ...options } = {}) => {
  const results = []
  const queue = [...items]
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, queue.length || 1)) }, async () => {
    for (;;) {
      const item = queue.shift()
      if (!item) return
      const check = await checkLink(item.url, options)
      results.push({ ...item, check })
    }
  })
  await Promise.all(workers)
  return results
}

/** 供前端展示的简短状态文案 */
export const describeCheck = (check) => {
  if (!check) return '未检测'
  if (check.ok) return `可达（HTTP ${check.status}${check.hopCount ? `，${check.hopCount} 次跳转` : ''}）`
  if (check.loop) return '跳转成环'
  if (check.tooManyHops) return '跳转次数过多'
  if (check.suspicious) return `疑似风控（HTTP ${check.status}，浏览器访问通常正常）`
  if (check.status) return `异常（HTTP ${check.status}）`
  return check.error || '不可达'
}

/** 是否达到"应当拦截跳转"的程度：真失效才拦，风控类放行 */
export const shouldBlockRedirect = (check) => {
  if (!check) return false
  if (check.ok) return false
  if (check.suspicious) return false // 401/403/429 等风控：浏览器可访问，放行
  return true // 超时、DNS 失败、连接被拒、跳转环、跳转次数过多、5xx 等
}
