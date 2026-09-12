#!/usr/bin/env node
/**
 * 本地一键初始化：安装前后端依赖 → 建库 → 写入初始内容
 *
 * 用法：
 *   node scripts/setup.js            # 完整初始化
 *   node scripts/setup.js --skip-frontend
 *   node scripts/setup.js --reset    # 删除已有数据库后重新初始化（会清空数据！）
 *
 * 说明：宝塔/生产环境请使用 deploy/install.sh，本脚本只面向本地开发机。
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const skipFrontend = args.includes('--skip-frontend') || args.includes('--skip-frontend-install')
const reset = args.includes('--reset')

const color = (code, text) => `\u001b[${code}m${text}\u001b[0m`
const log = (msg) => console.log(`${color(34, '[setup]')} ${msg}`)
const ok = (msg) => console.log(`${color(32, '[ok]')} ${msg}`)
const warn = (msg) => console.log(`${color(33, '[warn]')} ${msg}`)

/** 在指定目录运行命令，输出直接透传（stdio: inherit） */
const run = (command, commandArgs, cwd) => {
  const result = spawnSync(command, commandArgs, {
    cwd: path.join(ROOT, cwd),
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })
  if (result.status !== 0) {
    console.error(color(31, `[error] 命令执行失败: ${command} ${commandArgs.join(' ')} (${cwd})`))
    process.exit(result.status ?? 1)
  }
}

const main = () => {
  const nodeMajor = Number(process.versions.node.split('.')[0])
  const nodeMinor = Number(process.versions.node.split('.')[1])
  log(`Node.js ${process.versions.node}`)
  if (nodeMajor < 22 || (nodeMajor === 22 && nodeMinor < 5)) {
    console.error(
      color(31, `[error] 需要 Node.js >= 22.5（后端使用内置 node:sqlite）。当前 ${process.versions.node}`)
    )
    process.exit(1)
  }

  log('安装后端依赖（跳过可选的原生模块 better-sqlite3）…')
  run('npm', ['install', '--omit=optional', '--no-audit', '--no-fund'], 'backend')
  ok('后端依赖安装完成')

  if (!skipFrontend) {
    log('安装前端依赖…')
    run('npm', ['install', '--no-audit', '--no-fund'], 'frontend')
    ok('前端依赖安装完成')
  } else {
    warn('已跳过前端依赖安装')
  }

  const dbFile = path.join(ROOT, 'backend', 'data', 'team-site.db')
  if (reset) {
    for (const suffix of ['', '-wal', '-shm']) {
      const file = dbFile + suffix
      if (fs.existsSync(file)) {
        fs.unlinkSync(file)
        warn(`已删除 ${path.relative(ROOT, file)}`)
      }
    }
  }

  log('初始化数据库结构…')
  run('node', ['scripts/init-db.js'], 'backend')
  log('写入初始内容（站点设置 / 项目 / 动态 / 成员）…')
  run('node', ['scripts/seed.js'], 'backend')

  ok('初始化完成！下一步：')
  console.log(`
  1) 启动后端  : npm run dev:backend     # http://127.0.0.1:8787
  2) 启动前端  : npm run dev:frontend    # http://127.0.0.1:5173
  3) 生产构建  : npm run build           # 产物 frontend/dist，可由后端直接托管
  4) 冒烟测试  : npm run smoke
  5) 默认后台  : admin / qlm@2019（可在 backend/.env 中修改，登录后请立即更换）
`)
}

main()
