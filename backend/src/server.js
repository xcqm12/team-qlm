/** 服务入口：建表 → 初始化管理员 → 种子数据 → 启动 HTTP 服务 */
import { createApp } from './app.js'
import { config } from './config.js'
import { closeDb, get, migrate } from './db/index.js'
import { seedDatabase } from './db/seed.js'
import { clearAllBans, clearTrusted, getAntiCcStats } from './middleware/anticc.js'
import { ensureAdminUser } from './middleware/auth.js'
import { humanSize } from './services/storage.js'

const bootstrap = () => {
  migrate()

  const admin = ensureAdminUser()
  if (admin.created) {
    console.log('─'.repeat(64))
    console.log('  已创建初始管理员账号')
    console.log(`  用户名: ${admin.username}`)
    console.log(`  密  码: ${admin.password}`)
    console.log('  请登录后立即在「后台 → 修改密码」中更换！')
    console.log('─'.repeat(64))
  }

  const isEmpty = (get('SELECT COUNT(*) AS c FROM settings')?.c ?? 0) === 0
  if (isEmpty) {
    const result = seedDatabase()
    console.log('[seed] 已写入站点初始化数据:', result)
  }
}

bootstrap()

const app = createApp()
const server = app.listen(config.port, config.host, () => {
  const shown = config.host === '0.0.0.0' ? '127.0.0.1' : config.host
  console.log(`[server] 七零喵团队站点 API 已启动 http://${shown}:${config.port}`)
  console.log(`[server] 环境: ${config.env} | Node ${process.version}`)
  console.log(`[server] 数据库: ${config.dbFile}`)
  console.log(`[server] 上传目录: ${config.uploadDir} | 单文件上限 ${humanSize(config.maxUploadSize)}`)
})

const shutdown = (signal) => {
  console.log(`\n[server] 收到 ${signal}，正在优雅退出...`)
  server.close(() => {
    closeDb()
    console.log('[server] 已关闭')
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 8000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

// 防 CC 应急出口：被封禁且无法登录时，在服务器上执行
//   systemctl kill -s SIGUSR1 team-site      （或 kill -USR1 <pid>）
// 即可清空全部封禁与信任名单，无需重启、无需 HTTP 访问
process.on('SIGUSR1', () => {
  const cleared = clearAllBans()
  const trusted = clearTrusted()
  const stats = getAntiCcStats()
  console.log(`[anticc] 收到 SIGUSR1：已解封 ${cleared} 个 IP、清空 ${trusted} 条信任记录（累计拦截 ${stats.blockedTotal} 次）`)
})

process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason))
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err)
  process.exit(1)
})
