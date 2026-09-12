import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
export const ROOT_DIR = path.resolve(path.dirname(__filename), '..')

dotenv.config({ path: path.join(ROOT_DIR, '.env') })

const resolveFromRoot = (value, fallback) => {
  const raw = value && String(value).trim() ? String(value).trim() : fallback
  return path.isAbsolute(raw) ? raw : path.resolve(ROOT_DIR, raw)
}

const DEFAULT_JWT_SECRET = 'please-change-this-secret-in-production'

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 8787),
  host: process.env.HOST || '127.0.0.1',
  trustProxy: Number(process.env.TRUST_PROXY ?? 1),
  jwt: {
    secret: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'qlm@2019'
  },
  dbFile: resolveFromRoot(process.env.DB_FILE, './data/team-site.db'),
  uploadDir: resolveFromRoot(process.env.UPLOAD_DIR, './data/uploads'),
  maxUploadSize: Number(process.env.MAX_UPLOAD_SIZE || 200 * 1024 * 1024),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  publicFileList: String(process.env.PUBLIC_FILE_LIST ?? '1') === '1'
}

config.thumbDir = path.join(config.uploadDir, 'thumbnails')

// 版本号只从项目根的 package.json 读，避免这里写死后与发布版本漂移
// （站点设置接口 / 页脚都用它，写死过一次就再也不会自动更新了）
const readVersion = () => {
  for (const candidate of [
    path.join(ROOT_DIR, '..', 'package.json'),
    path.join(ROOT_DIR, 'package.json')
  ]) {
    try {
      const pkg = JSON.parse(fs.readFileSync(candidate, 'utf8'))
      if (pkg && pkg.version) return String(pkg.version)
    } catch {
      // 忽略，继续找下一个候选
    }
  }
  return '0.0.0'
}
config.version = process.env.APP_VERSION || readVersion()

export const ensureRuntimeDirs = () => {
  for (const dir of [path.dirname(config.dbFile), config.uploadDir, config.thumbDir]) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export const isProd = config.env === 'production'

/**
 * 生产环境用内置默认 JWT 密钥时**拒绝启动**（由 server.js 显式调用）。
 *
 * 为什么必须这么严厉：这个默认字符串写在开源仓库里，等于人人可伪造管理员令牌——
 * 一旦发生，站点看起来一切正常，但实际上是敞开的，没有任何迹象。
 *
 * 最常见的成因不是"忘了改 .env"，而是 **.env 读不到**：install.sh 以 root 运行、
 * 生成 .env 时若保持 root:root 600，而服务以 www 运行，dotenv 会**静默失败**，
 * 于是端口、上传上限、JWT_SECRET 全部回落到代码默认值。
 * 宁可启动失败并把原因打在日志第一行，也不要"静默地不安全"。
 *
 * 放在函数里而不是模块顶层，是为了不阻断 `scripts/reset-password.js` 这类
 * 纯数据库工具——配置有问题时你反而更需要它们来救场。
 * 显式设置 ALLOW_INSECURE_JWT=1 可越过（仅用于本地/临时排障）。
 */
export const assertSecureConfig = () => {
  if (!isProd) return
  if (config.jwt.secret !== DEFAULT_JWT_SECRET) return
  if (String(process.env.ALLOW_INSECURE_JWT || '') === '1') {
    console.warn('[config] 警告：正在使用内置默认 JWT_SECRET（ALLOW_INSECURE_JWT=1），切勿用于生产')
    return
  }

  const envPath = path.join(ROOT_DIR, '.env')
  throw new Error(
    [
      '[config] 拒绝启动：JWT_SECRET 未生效，当前用的是代码内置默认值（公开可查，等于人人可伪造管理员令牌）。',
      `  · 期望读取的配置文件：${envPath}`,
      `  · 该文件是否存在：${fs.existsSync(envPath) ? '存在' : '不存在'}`,
      '  · 最常见原因：.env 读不到。请确认「服务运行用户」对该文件可读，例如：',
      `      chown www:www ${envPath} && chmod 600 ${envPath}`,
      '    随后 systemctl restart team-site',
      '  · 若确实没有配置文件，请先执行 deploy/install.sh 生成（会随机生成 JWT_SECRET）。'
    ].join('\n')
  )
}
