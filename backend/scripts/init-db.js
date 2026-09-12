#!/usr/bin/env node
/** 初始化数据库（建表 + 管理员），--force 会删除已有数据库文件 */
import fs from 'node:fs'
import { config } from '../src/config.js'
import { get, migrate } from '../src/db/index.js'
import { ensureAdminUser } from '../src/middleware/auth.js'

const force = process.argv.includes('--force')

if (force) {
  for (const suffix of ['', '-wal', '-shm']) {
    const file = config.dbFile + suffix
    if (fs.existsSync(file)) {
      fs.unlinkSync(file)
      console.log('[init-db] 已删除', file)
    }
  }
}

migrate()
console.log('[init-db] 表结构已就绪 ->', config.dbFile)

const admin = ensureAdminUser()
if (admin.created) {
  console.log(`[init-db] 初始管理员: ${admin.username} / ${admin.password}`)
} else {
  console.log('[init-db] 已存在管理员账号，跳过创建')
}

const tables = ['settings', 'users', 'files', 'projects', 'news', 'members', 'messages', 'audit_logs']
for (const table of tables) {
  console.log(`  - ${table}: ${get(`SELECT COUNT(*) AS c FROM ${table}`).c} 行`)
}
