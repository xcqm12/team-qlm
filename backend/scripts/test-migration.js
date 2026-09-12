#!/usr/bin/env node
/**
 * 老库升级测试：模拟"旧版本数据库 + 新版本代码"，验证 migrate() 能无损补齐字段
 *
 * 背景：SQLite 的 CREATE TABLE IF NOT EXISTS 不会给已有表补列，
 * 而新版本又给 files 表加了 source/external_url 等字段。
 * 一旦迁移顺序写错（例如索引建在补列之前），线上老站升级就会启动失败。
 * 本脚本用真实的旧表结构复现，并断言升级后可正常读写。
 *
 * 用法: npm run test:migration
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'node:sqlite'

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qlm-migrate-'))
const dbFile = path.join(tmpDir, 'legacy.db')
const uploadDir = path.join(tmpDir, 'uploads')
fs.mkdirSync(uploadDir, { recursive: true })

const results = []
const pass = (name, extra = '') => {
  results.push(true)
  console.log(`  ✅ ${name}${extra ? ' — ' + extra : ''}`)
}
const fail = (name, message) => {
  results.push(false)
  console.log(`  ❌ ${name} — ${message}`)
}

/** 1) 构造"旧版本"数据库：files 表没有 source/external_url/provider/access_code/size_hint */
const createLegacyDb = () => {
  const { DatabaseSync } = Database
  const db = new DatabaseSync(dbFile)
  db.exec(`
    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'admin',
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE files (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      original_name  TEXT NOT NULL,
      stored_name    TEXT NOT NULL UNIQUE,
      ext            TEXT NOT NULL DEFAULT '',
      mime           TEXT NOT NULL DEFAULT 'application/octet-stream',
      size           INTEGER NOT NULL DEFAULT 0,
      sha256         TEXT NOT NULL DEFAULT '',
      category       TEXT NOT NULL DEFAULT '其他',
      description    TEXT NOT NULL DEFAULT '',
      version        TEXT NOT NULL DEFAULT '',
      thumbnail      TEXT,
      is_public      INTEGER NOT NULL DEFAULT 1,
      download_count INTEGER NOT NULL DEFAULT 0,
      uploader_id    INTEGER,
      created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX idx_files_category ON files (category);
    CREATE INDEX idx_files_created ON files (created_at DESC);
    INSERT INTO settings (key, value) VALUES ('site_name', '七零喵团队');
    INSERT INTO files (original_name, stored_name, ext, mime, size, category)
      VALUES ('旧版遗留文件.zip', '20200101-legacy-aaaaaaaaaaaa.zip', 'zip', 'application/zip', 2048, '工具软件');
  `)
  db.close()
}

const main = async () => {
  console.log(`\n=== 老库升级测试 (${dbFile}) ===\n`)
  createLegacyDb()
  pass('已构造旧版本数据库', 'files 表缺少 source/external_url 等字段')

  // 2) 指向这个老库，加载新代码的数据层并执行迁移
  process.env.DB_FILE = dbFile
  process.env.UPLOAD_DIR = uploadDir
  process.env.NODE_ENV = 'test'

  const { migrate, get, query, run, closeDb, driverInfo } = await import('../src/db/index.js')
  const { serializeFile, guessProvider, isValidExternalUrl, parseExtras, resolveProviderIcon } = await import(
    '../src/services/storage.js'
  )

  try {
    migrate()
    pass('migrate() 在旧库上执行成功', `驱动 ${driverInfo.name}`)
  } catch (err) {
    fail('migrate() 在旧库上执行成功', err.message)
    closeDb()
    process.exit(1)
  }

  // 3) 断言新字段全部补齐
  const columns = new Set(query(`SELECT name FROM pragma_table_info('files')`).map((r) => r.name))
  const expected = [
    'source',
    'external_url',
    'provider',
    'access_code',
    'size_hint',
    // 第三方下载「全部自定义」字段
    'provider_icon',
    'button_label',
    'tags',
    'sort_order',
    'open_in_new_tab',
    'show_url',
    'extras',
    // 第三方链接检测字段
    'last_check_at',
    'last_check_status',
    'last_check_final_url',
    'last_check_error',
    'last_check_ms',
    'last_check_hops',
    'check_fail_count'
  ]
  const missing = expected.filter((c) => !columns.has(c))
  missing.length === 0
    ? pass('新增字段已补齐', expected.join(', '))
    : fail('新增字段已补齐', `缺少 ${missing.join(', ')}`)

  // 4) 断言索引已建立
  const index = get(`SELECT name FROM sqlite_master WHERE type='index' AND name='idx_files_source'`)
  index ? pass('source 索引已创建') : fail('source 索引已创建', '未找到 idx_files_source')

  // 5) 断言老数据完好，且默认视为本站文件
  const legacy = get(`SELECT * FROM files WHERE stored_name = ?`, ['20200101-legacy-aaaaaaaaaaaa.zip'])
  if (!legacy) {
    fail('旧数据保留', '旧文件记录丢失')
  } else {
    const serialized = serializeFile(legacy)
    serialized.source === 'local' && !serialized.isExternal && serialized.sizeText === '2.0 KB'
      ? pass('旧数据保留且标记为本站文件', `${serialized.originalName} · ${serialized.sizeText}`)
      : fail('旧数据保留且标记为本站文件', JSON.stringify({ source: serialized.source, sizeText: serialized.sizeText }))
  }

  // 6) 断言迁移后可正常写入第三方条目
  run(
    `INSERT INTO files (original_name, stored_name, ext, mime, size, category, source, external_url, provider, access_code, size_hint, is_public)
     VALUES (?, '', 'zip', 'text/html', 0, '第三方下载', 'external', ?, ?, ?, ?, 1)`,
    ['云盘文件.zip', 'https://pan.baidu.com/s/xyz', '百度网盘', '1234', '1.5 GB']
  )
  const external = get(`SELECT * FROM files WHERE source = 'external'`)
  const extSerialized = serializeFile(external)
  extSerialized.isExternal && extSerialized.kind === 'link' && extSerialized.sizeText === '1.5 GB'
    ? pass('迁移后可写入第三方条目', `${extSerialized.provider} · ${extSerialized.downloadUrl}`)
    : fail('迁移后可写入第三方条目', JSON.stringify(extSerialized))

  // 6.1 迁移后可写入「全部自定义」字段
  const LF = String.fromCharCode(10)
  run(
    `UPDATE files SET provider_icon = ?, button_label = ?, tags = ?, sort_order = ?, open_in_new_tab = 0,
                      show_url = 0, extras = ? WHERE id = ?`,
    ['📦', '去网盘下载', '官方,镜像', 9, ['网盘=百度网盘', '语言=简体中文'].join(LF), external.id]
  )
  const custom = serializeFile(get('SELECT * FROM files WHERE id = ?', [external.id]))
  const customOk =
    custom.providerIcon === '📦' &&
    custom.buttonLabel === '去网盘下载' &&
    custom.tags.join(',') === '官方,镜像' &&
    custom.sortOrder === 9 &&
    custom.openInNewTab === false &&
    custom.showUrl === false &&
    custom.extras['网盘'] === '百度网盘' &&
    custom.extras['语言'] === '简体中文'
  customOk
    ? pass('自定义字段全部可存取', `图标 ${custom.providerIcon} · 按钮「${custom.buttonLabel}」· 标签 ${custom.tags.join('/')} · 置顶 ${custom.sortOrder}`)
    : fail('自定义字段全部可存取', JSON.stringify(custom))

  // 6.2 平台识别（含 GitHub Releases 深层地址）与图标回退
  const cases = [
    ['https://github.com/qlm/team-site/releases/tag/v1.0.0', 'GitHub Releases'],
    ['https://github.com/qlm/team-site/tags', 'GitHub Tags'],
    ['https://github.com/qlm/team-site', 'GitHub'],
    ['https://www.curseforge.com/minecraft/mc-mods', 'CurseForge'],
    ['https://pan.baidu.com/s/1abc', '百度网盘'],
    ['https://example.org/dl/file.zip', 'example.org']
  ]
  const wrong = cases.filter(([url, want]) => guessProvider(url) !== want)
  wrong.length === 0
    ? pass('平台自动识别（含 GitHub Releases / Tags 深层地址）', `${cases.length} 个用例全对`)
    : fail('平台自动识别', wrong.map(([url, want]) => `${url} → 期望 ${want} 实得 ${guessProvider(url)}`).join('; '))

  resolveProviderIcon('GitHub Releases', '') === '🐙' && resolveProviderIcon('任意平台', '🎯') === '🎯'
    ? pass('平台图标：内置映射 + 自定义优先')
    : fail('平台图标：内置映射 + 自定义优先', `${resolveProviderIcon('GitHub Releases', '')} / ${resolveProviderIcon('任意平台', '🎯')}`)

  // 6.3 自定义字段解析：JSON 与 "键=值" 两种写法等价
  const fromText = parseExtras(['授权=MIT', '附件数=3'].join(LF))
  const fromJson = parseExtras('{"授权":"MIT","附件数":"3"}')
  JSON.stringify(fromText) === JSON.stringify(fromJson)
    ? pass('自定义字段解析（键=值 与 JSON 等价）', JSON.stringify(fromText))
    : fail('自定义字段解析', `${JSON.stringify(fromText)} vs ${JSON.stringify(fromJson)}`)

  // 6.4 链接检测结果可落库并被序列化（老库升级后即可用）
  const { checkLink, describeCheck, shouldBlockRedirect } = await import('../src/services/linkcheck.js')
  run(
    `UPDATE files SET last_check_at = datetime('now','localtime'), last_check_status = 403,
                      last_check_final_url = external_url, last_check_error = ?, last_check_ms = 123
     WHERE id = ?`,
    ['平台返回 HTTP 403（疑似风控 / 防盗链，浏览器访问通常正常）', external.id]
  )
  const checked = serializeFile(get('SELECT * FROM files WHERE id = ?', [external.id]))
  const checkOk =
    checked.linkCheck?.status === 403 &&
    checked.linkCheck.suspicious === true &&
    checked.linkCheck.ok === false &&
    checked.linkCheck.latencyMs === 123
  checkOk
    ? pass('链接检测结果可落库与序列化', `HTTP 403 标记为疑似风控（不判失效）`)
    : fail('链接检测结果可落库与序列化', JSON.stringify(checked.linkCheck))

  // 6.5 拦截判定：风控放行、真失效拦截
  const fakeSuspicious = { ok: false, suspicious: true, status: 403 }
  const fakeDead = { ok: false, suspicious: false, status: 0, error: '域名无法解析' }
  const fakeAlive = { ok: true, suspicious: false, status: 200 }
  !shouldBlockRedirect(fakeSuspicious) && shouldBlockRedirect(fakeDead) && !shouldBlockRedirect(fakeAlive)
    ? pass('拦截判定：风控放行 / 真失效拦截 / 可达放行')
    : fail('拦截判定', `suspicious=${shouldBlockRedirect(fakeSuspicious)} dead=${shouldBlockRedirect(fakeDead)} alive=${shouldBlockRedirect(fakeAlive)}`)

  // 6.6 不可达链接的错误文案可读（而非 fetch failed）
  const deadCheck = await checkLink('http://127.0.0.1:1/none', { timeoutMs: 3000 })
  deadCheck.ok === false && deadCheck.error && !/fetch failed/i.test(deadCheck.error)
    ? pass('不可达链接返回可读原因', `${deadCheck.error}（${describeCheck(deadCheck)}）`)
    : fail('不可达链接返回可读原因', JSON.stringify(deadCheck))

  // 7) 幂等：再跑一次迁移不应报错、不应重复加列
  try {
    migrate()
    const after = new Set(query(`SELECT name FROM pragma_table_info('files')`).map((r) => r.name))
    after.size === columns.size ? pass('migrate() 幂等，可重复执行') : fail('migrate() 幂等，可重复执行', '字段数变化')
  } catch (err) {
    fail('migrate() 幂等，可重复执行', err.message)
  }

  // 8) 链接识别工具
  guessProvider('https://www.curseforge.com/minecraft/mc-mods') === 'CurseForge'
    ? pass('第三方平台自动识别', 'CurseForge')
    : fail('第三方平台自动识别', guessProvider('https://www.curseforge.com/minecraft/mc-mods'))
  isValidExternalUrl('https://example.com/a.zip') && !isValidExternalUrl('javascript:alert(1)')
    ? pass('外链校验（拦截 javascript: 等危险协议）')
    : fail('外链校验（拦截 javascript: 等危险协议）', '校验结果不符合预期')

  closeDb()
  fs.rmSync(tmpDir, { recursive: true, force: true })

  const failed = results.filter((r) => !r).length
  console.log(`\n=== 结果: ${results.length - failed}/${results.length} 通过 ===`)
  if (failed) process.exit(1)
  console.log('老库升级安全 ✅\n')
}

main().catch((err) => {
  console.error('[test-migration] 异常:', err)
  process.exit(1)
})
