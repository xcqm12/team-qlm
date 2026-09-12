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

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 8787),
  host: process.env.HOST || '127.0.0.1',
  trustProxy: Number(process.env.TRUST_PROXY ?? 1),
  jwt: {
    secret: process.env.JWT_SECRET || 'please-change-this-secret-in-production',
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
config.version = '1.0.0'

export const ensureRuntimeDirs = () => {
  for (const dir of [path.dirname(config.dbFile), config.uploadDir, config.thumbDir]) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export const isProd = config.env === 'production'
