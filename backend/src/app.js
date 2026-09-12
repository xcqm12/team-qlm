/** Express 应用装配 */
import fs from 'node:fs'
import path from 'node:path'
import compression from 'compression'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import { ROOT_DIR, config, isProd } from './config.js'
import { anticc } from './middleware/anticc.js'
import { errorHandler, notFoundHandler } from './middleware/errors.js'
import apiRouter from './routes/index.js'

export const createApp = () => {
  const app = express()

  app.set('trust proxy', config.trustProxy)
  app.disable('x-powered-by')

  app.use(
    helmet({
      // 前后端可能分域部署，图片/文件需被其他域引用
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false
    })
  )

  app.use(compression())
  app.use(
    cors({
      origin: config.allowedOrigins.length ? config.allowedOrigins : true,
      credentials: true
    })
  )
  app.use(express.json({ limit: '2mb' }))
  app.use(express.urlencoded({ extended: true, limit: '2mb' }))
  if (!isProd) app.use(morgan('dev'))

  // 静态资源：上传的文件与缩略图（下载走 /api/files/:id/download 以便计数）
  app.use(
    '/uploads',
    express.static(config.uploadDir, {
      index: false,
      dotfiles: 'deny',
      maxAge: '7d',
      setHeaders: (res, filePath) => {
        res.setHeader('X-Content-Type-Options', 'nosniff')
        // 可执行/脚本类一律强制下载，避免被浏览器内联执行
        const risky = /\.(exe|msi|dmg|apk|ipa|zip|rar|7z|jar|deb|rpm|appimage|bin)$/i.test(filePath)
        res.setHeader(
          'Content-Disposition',
          `${risky ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(path.basename(filePath))}`
        )
        if (!risky) res.setHeader('Cache-Control', 'public, max-age=604800')
      }
    })
  )

  app.use('/api', anticc, apiRouter)

  // 可选：直接托管前端构建产物（单进程部署，宝塔只反代一个端口时更方便）
  const distDir = path.resolve(ROOT_DIR, '../frontend/dist')
  if (fs.existsSync(path.join(distDir, 'index.html'))) {
    app.use(
      express.static(distDir, {
        index: false,
        setHeaders: (res, filePath) => {
          if (/\.(js|css|woff2?|png|jpg|svg)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
          }
        }
      })
    )
    app.get(/^(?!\/api|\/uploads).*/, (req, res, next) => {
      if (req.method !== 'GET') return next()
      res.sendFile(path.join(distDir, 'index.html'))
    })
  } else {
    app.get('/', (req, res) => {
      res.json({
        success: true,
        message: '七零喵团队站点 API 运行中',
        data: { api: '/api/health', docs: '/api/site/settings', hint: '前端未构建，请运行 pnpm/npm run build' }
      })
    })
  }

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
