#!/usr/bin/env node
/** 打印数据库概览：npm run db:stats */
import { get, driverInfo, query } from '../src/db/index.js'
import { humanSize } from '../src/services/storage.js'

const stats = get('SELECT * FROM v_site_stats') || {}
const tables = ['settings', 'users', 'files', 'projects', 'project_files', 'news', 'members', 'messages', 'audit_logs']

console.log(`SQLite 驱动 : ${driverInfo.name} (${driverInfo.version})`)
console.log(`数据库文件  : ${driverInfo.file}`)
console.log('')
console.log('表行数:')
for (const table of tables) {
  const row = get(`SELECT COUNT(*) AS c FROM ${table}`)
  console.log(`  ${table.padEnd(16)} ${row?.c ?? 0}`)
}
console.log('')
console.log('站点概览:')
console.log(`  项目作品      ${stats.project_count ?? 0}`)
console.log(`  新闻动态      ${stats.news_count ?? 0}`)
console.log(`  文件条目      ${stats.file_count ?? 0}（第三方 ${stats.external_file_count ?? 0} / 本站 ${stats.local_file_count ?? 0}）`)
console.log(`  文件占用      ${humanSize(stats.file_bytes ?? 0)}`)
console.log(`  累计下载      ${stats.download_count ?? 0}`)
console.log(`  团队成员      ${stats.member_count ?? 0}`)
console.log(`  未读留言      ${stats.unread_message_count ?? 0}`)
console.log('')

const dupMembers = query('SELECT name, COUNT(*) AS c FROM members GROUP BY name HAVING c > 1')
console.log(dupMembers.length ? `⚠️ 存在重复成员: ${dupMembers.map((r) => r.name).join(', ')}` : '成员数据无重复 ✅')

const checked = query(
  `SELECT COUNT(*) AS total,
          SUM(CASE WHEN last_check_status >= 200 AND last_check_status < 400 THEN 1 ELSE 0 END) AS ok,
          SUM(CASE WHEN last_check_status > 0 AND (last_check_status < 200 OR last_check_status >= 400) THEN 1 ELSE 0 END) AS failed
   FROM files WHERE source = 'external' AND last_check_at <> ''`
)[0]
const externalTotal = get("SELECT COUNT(*) AS c FROM files WHERE source = 'external'")?.c ?? 0
if (externalTotal) {
  console.log(
    `第三方链接检测: 共 ${externalTotal} 条，已检测 ${checked?.total ?? 0} 条（可达 ${checked?.ok ?? 0} · 异常 ${checked?.failed ?? 0}）`
  )
}
