#!/usr/bin/env node
/**
 * 重置管理员密码
 *
 *   node scripts/reset-password.js                       # 重置为 .env 里的 ADMIN_PASSWORD（缺省 qlm@2019）
 *   node scripts/reset-password.js '新密码'               # 直接指定新密码
 *   node scripts/reset-password.js --password '新密码'
 *   node scripts/reset-password.js --username other --password '新密码'
 *
 * 为什么需要它：install.sh 在未指定 --password 时会随机生成初始密码，
 * 而这个密码只出现一次（打印在安装输出里）；忘了就只能改库，很麻烦。
 */
import { config } from '../src/config.js'
import { get, migrate, run } from '../src/db/index.js'
import { hashPassword } from '../src/middleware/auth.js'

const argv = process.argv.slice(2)
const flag = (name) => {
  const i = argv.indexOf(name)
  return i > -1 ? argv[i + 1] : undefined
}

const username = flag('--username') || config.admin.username
const positional = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--username' && argv[i - 1] !== '--password')
const password = flag('--password') ?? positional[0] ?? config.admin.password

if (!password || String(password).length < 6) {
  console.error('[reset-password] 新密码至少 6 位')
  console.error('用法: node scripts/reset-password.js [新密码] | --password <新密码> [--username admin]')
  process.exit(1)
}

migrate()

const user = get('SELECT id, username FROM users WHERE username = ?', [username])
if (!user) {
  const all = get('SELECT group_concat(username) AS names FROM users')?.names || '（空）'
  console.error(`[reset-password] 未找到用户「${username}」，现有用户：${all}`)
  process.exit(1)
}

run('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(String(password)), user.id])
run(
  `INSERT INTO audit_logs (user_id, action, target, detail, ip) VALUES (?, 'password.reset', ?, ?, ?)`,
  [user.id, user.username, 'CLI 重置密码', 'cli']
)

console.log(`[reset-password] 已重置「${user.username}」的密码（${String(password).length} 位）`)
console.log('[reset-password] 请登录后台后立即在「修改密码」中更换')
