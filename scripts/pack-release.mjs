#!/usr/bin/env node
/**
 * 跨平台打包发布包：team-site-<版本>.tar.gz
 *
 * 为什么需要它：
 *   在 Windows 上直接压缩项目目录再上传到 Linux，常出现两个致命问题——
 *     1) 换行符变成 CRLF → `./deploy/install.sh` 报 bad interpreter / $'\r'
 *     2) 丢掉可执行位（644）→ 报 Permission denied
 *   本脚本手写 tar 头，强制：
 *     · 文本文件统一 LF 换行
 *     · *.sh / *.py 权限 0755，其余 0644
 *     · 排除 node_modules / dist / 运行数据 / 备份 / .git
 *   生成的包在任意 Linux 上解压后即可直接 `bash deploy/install.sh`。
 *
 * 用法：
 *   node scripts/pack-release.mjs                    # 生成到 release/
 *   node scripts/pack-release.mjs --with-dist        # 连前端构建产物一起打包（服务器可 --skip-build）
 *   node scripts/pack-release.mjs --out /tmp/pkg --name team-site-custom
 *   node scripts/pack-release.mjs --print-commands   # 只打印远程部署命令
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const hasFlag = (flag) => args.includes(flag)
const argValue = (flag, fallback = '') => {
  const index = args.indexOf(flag)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const OUT_DIR = path.resolve(ROOT, argValue('--out', 'release'))
const NAME = argValue('--name', `team-site-${pkg.version}`)
const WITH_DIST = hasFlag('--with-dist')
const PRINT_ONLY = hasFlag('--print-commands')

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'release',
  'backups',
  'logs',
  '__pycache__',
  '.vscode',
  '.idea',
  '.npm-cache'
])
// 相对仓库根的排除路径
const SKIP_PATHS = new Set(['backend/data'])
const TEXT_EXT = new Set([
  '.sh', '.bash', '.py', '.js', '.mjs', '.cjs', '.ts', '.vue', '.json', '.yml', '.yaml',
  '.sql', '.conf', '.service', '.md', '.txt', '.html', '.css', '.example', '.gitignore',
  '.gitattributes', '.dockerignore'
])
const EXEC_EXT = new Set(['.sh', '.bash', '.py'])
const EXEC_NAMES = new Set(['team-site']) // deploy/initd/team-site

const isText = (file) => TEXT_EXT.has(path.extname(file).toLowerCase()) || path.basename(file).startsWith('.')
const isExec = (file) => EXEC_EXT.has(path.extname(file).toLowerCase()) || EXEC_NAMES.has(path.basename(file))

/** 递归收集要打包的文件（相对路径 + 内容 Buffer） */
const collect = (dir, relBase = '') => {
  const entries = []
  for (const name of fs.readdirSync(dir).sort()) {
    const abs = path.join(dir, name)
    const rel = relBase ? `${relBase}/${name}` : name
    const stat = fs.lstatSync(abs)

    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(name) || SKIP_PATHS.has(rel)) continue
      if (!WITH_DIST && rel === 'frontend/dist') continue
      if (!WITH_DIST && rel === 'frontend/dist') continue
      entries.push({ type: 'dir', rel, abs })
      entries.push(...collect(abs, rel))
      continue
    }
    if (!stat.isFile()) continue
    if (rel === 'package-lock.json' && false) continue // 保留 lock 文件
    entries.push({ type: 'file', rel, abs, size: stat.size })
  }
  return entries
}

/** 读取内容并按需规范化换行符 */
const readContent = (entry) => {
  const buffer = fs.readFileSync(entry.abs)
  if (!isText(entry.abs)) return buffer
  const text = buffer.toString('utf8')
  if (!text.includes('\r\n')) return buffer
  // 统一为 LF：Linux 上 CRLF 会让 shell/python 直接失败
  return Buffer.from(text.replace(/\r\n/g, '\n'), 'utf8')
}

/* ------------------------------------------------------------------ tar 写入 */
// 说明：tar 头字段有严格约定，写错会导致 GNU tar / bsdtar / busybox tar 拒绝归档。
// 这里显式构造每个字段的字节，避免"少写一个终止符"这类隐蔽问题。
const BLOCK = 512

/** 数值字段：len-1 位八进制 + 1 个 NUL 终止符 */
const octal = (value, length) => value.toString(8).padStart(length - 1, '0').slice(-(length - 1)) + '\0'

const writeString = (buffer, offset, length, value) => {
  const text = String(value)
  const bytes = Buffer.from(text, 'utf8').subarray(0, length)
  bytes.copy(buffer, offset)
}

const tarHeader = ({ name, mode, size, mtime, type }) => {
  const header = Buffer.alloc(BLOCK, 0)
  let fileName = name
  let prefix = ''

  // 路径超过 100 字节时拆到 prefix 字段
  if (Buffer.byteLength(fileName) > 100) {
    const index = fileName.lastIndexOf('/', 155)
    if (index > 0) {
      prefix = fileName.slice(0, index)
      fileName = fileName.slice(index + 1)
    }
  }

  writeString(header, 0, 100, fileName)
  writeString(header, 100, 8, octal(mode, 8))
  writeString(header, 108, 8, octal(0, 8)) // uid
  writeString(header, 116, 8, octal(0, 8)) // gid
  writeString(header, 124, 12, octal(size, 12))
  writeString(header, 136, 12, octal(mtime, 12))
  writeString(header, 148, 8, '        ') // checksum 先留 8 个空格
  writeString(header, 156, 1, type)
  writeString(header, 257, 6, 'ustar\0')
  writeString(header, 263, 2, '00')
  writeString(header, 265, 32, 'root')
  writeString(header, 297, 32, 'root')
  writeString(header, 329, 8, octal(0, 8)) // devmajor
  writeString(header, 337, 8, octal(0, 8)) // devminor
  writeString(header, 345, 155, prefix)

  // 校验和：按"checksum 字段视为 8 个空格"计算，写成 6 位八进制 + NUL + 空格
  let checksum = 0
  for (const byte of header) checksum += byte
  writeString(header, 148, 8, `${checksum.toString(8).padStart(6, '0')}\0 `)
  return header
}

const pad = (size) => Buffer.alloc((BLOCK - (size % BLOCK)) % BLOCK, 0)

const buildTar = (entries) => {
  const chunks = []
  const mtime = Math.floor(Date.now() / 1000)
  const manifest = []

  for (const entry of entries) {
    if (entry.type === 'dir') {
      chunks.push(tarHeader({ name: `${entry.rel}/`, mode: 0o755, size: 0, mtime, type: '5' }))
      continue
    }
    const content = readContent(entry)
    const mode = isExec(entry.abs) ? 0o755 : 0o644
    chunks.push(tarHeader({ name: entry.rel, mode, size: content.length, mtime, type: '0' }))
    chunks.push(content)
    chunks.push(pad(content.length))
    manifest.push({
      rel: entry.rel,
      mode,
      size: content.length,
      crlf: isText(entry.abs) && content.includes(Buffer.from('\r\n'))
    })
  }

  chunks.push(Buffer.alloc(BLOCK * 2, 0)) // tar 结束标记
  return { buffer: Buffer.concat(chunks), manifest }
}

/* ------------------------------------------------------------------ 校验模式 */
/** 解析 tar(.gz)，逐条校验权限位与换行符，确保发布包在远程服务器上可直接执行 */
const verifyArchive = (file) => {
  const raw = fs.readFileSync(file)
  const buffer = file.endsWith('.gz') ? zlib.gunzipSync(raw) : raw
  const entries = []
  let offset = 0

  const readString = (start, length) => buffer.toString('utf8', start, start + length).replace(/\0.*$/, '').trim()

  while (offset + BLOCK <= buffer.length) {
    const name = readString(offset, 100)
    const prefix = readString(offset + 345, 155)
    if (!name) break // 结束块
    const mode = parseInt(readString(offset + 100, 8) || '0', 8)
    const size = parseInt(readString(offset + 124, 12) || '0', 8)
    const type = buffer.toString('utf8', offset + 156, offset + 157)
    const fullName = prefix ? `${prefix}/${name}` : name
    const contentStart = offset + BLOCK
    if (type === '0') {
      entries.push({ name: fullName, mode, size, content: buffer.subarray(contentStart, contentStart + size) })
    } else {
      entries.push({ name: fullName, mode, size: 0, content: Buffer.alloc(0) })
    }
    offset = contentStart + size + ((BLOCK - (size % BLOCK)) % BLOCK)
  }

  const problems = []
  const isExecName = (name) =>
    /\.(sh|bash|py)$/i.test(name) || /(^|\/)deploy\/initd\//.test(name)
  const isTextName = (name) => /\.(sh|bash|py|js|mjs|ts|vue|json|md|yml|yaml|sql|conf|service)$/i.test(name)

  const execs = entries.filter((e) => e.mode & 0o111)
  for (const entry of entries.filter((e) => e.mode & 0o100 || isExecName(e.name))) {
    if (isExecName(entry.name) && !(entry.mode & 0o100)) {
      problems.push(`可执行位缺失（${entry.mode.toString(8)}）: ${entry.name}`)
    }
  }
  for (const entry of entries.filter((e) => isTextName(e.name) && e.size > 0)) {
    if (entry.content.includes(Buffer.from('\r\n'))) problems.push(`包含 CRLF: ${entry.name}`)
  }

  const required = [
    'deploy/install.sh',
    'deploy/bt-deploy.sh',
    'deploy/remote-install.sh',
    'deploy/lib/common.sh',
    'deploy/lib/detect-os.sh',
    'deploy/lib/install-node.sh',
    'deploy/tests/check-syntax.sh',
    'tools/qlm_common.py',
    'backend/src/server.js',
    'backend/package.json',
    'frontend/package.json',
    'README.md'
  ]
  const names = new Set(entries.map((e) => e.name))
  for (const item of required) {
    if (!names.has(item)) problems.push(`缺少必需文件: ${item}`)
  }

  console.log(`\n=== 发布包校验: ${path.basename(file)} ===`)
  console.log(`  条目总数     : ${entries.length}`)
  console.log(`  可执行条目   : ${execs.length}`)
  console.log(`  未压缩体积   : ${(buffer.length / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  压缩后体积   : ${(raw.length / 1024 / 1024).toFixed(2)} MB`)
  const shellCount = entries.filter((e) => isExecName(e.name)).length
  console.log(`  脚本/工具数  : ${shellCount}`)

  if (problems.length) {
    console.log('\n  ❌ 校验未通过：')
    for (const item of problems.slice(0, 20)) console.log(`     - ${item}`)
    if (problems.length > 20) console.log(`     … 另有 ${problems.length - 20} 项`)
    process.exitCode = 1
    return
  }
  console.log('\n  ✅ 全部 .sh / .py 具备 0755 可执行位，文本文件均为 LF 换行，必需文件齐全')
  console.log('     → 远程服务器解压后可直接执行 bash deploy/install.sh\n')
}

/* ------------------------------------------------------------------ 主流程 */
const printCommands = (fileName) => {
  console.log(`
把发布包上传并在远程服务器执行（任选其一）：

  # A. 打包后 scp 上传 + 远程解压执行（最直观）
  scp ${path.relative(ROOT, path.join(OUT_DIR, fileName)).replace(/\\/g, '/')} root@<服务器IP>:/tmp/
  ssh root@<服务器IP> "tar -xzf /tmp/${fileName} -C /www/wwwroot/ && \\
      bash /www/wwwroot/team-site/deploy/install.sh --domain <你的域名> --noninteractive"

  # B. 服务器上直接跑引导脚本（支持 http 下载 / git 拉取）
  bash deploy/remote-install.sh --tarball <发布包URL> --domain <你的域名>
  bash deploy/remote-install.sh --git <仓库地址> --branch main --domain <你的域名>

  # C. 一行命令（把 remote-install.sh 放到可访问地址）
  curl -fsSL <remote-install.sh 地址> | bash -s -- --tarball <发布包URL> --domain <你的域名>

  # D. 宝塔面板：面板「文件」上传发布包 → 终端执行
  cd /www/wwwroot && tar -xzf /tmp/${fileName} && bash team-site/deploy/bt-deploy.sh --domain <你的域名>
`)
}

const main = () => {
  const verifyTarget = argValue('--verify', '')
  if (verifyTarget) {
    verifyArchive(path.resolve(ROOT, verifyTarget))
    return
  }

  if (PRINT_ONLY) {
    printCommands(`${NAME}.tar.gz`)
    return
  }

  console.log(`[pack] 源目录: ${ROOT}`)
  const entries = collect(ROOT)
  const files = entries.filter((e) => e.type === 'file')
  const { buffer, manifest } = buildTar(entries)
  const gz = zlib.gzipSync(buffer, { level: 9 })

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const tarPath = path.join(OUT_DIR, `${NAME}.tar.gz`)
  fs.writeFileSync(tarPath, gz)
  const sha = crypto.createHash('sha256').update(gz).digest('hex')
  fs.writeFileSync(`${tarPath}.sha256`, `${sha}  ${NAME}.tar.gz\n`)

  const crlfLeft = manifest.filter((m) => m.crlf).length
  const execCount = manifest.filter((m) => m.mode === 0o755).length

  console.log(`[pack] 文件数: ${files.length}（其中可执行 ${execCount} 个）`)
  console.log(`[pack] 产物: ${path.relative(ROOT, tarPath)}  ${(gz.length / 1024 / 1024).toFixed(2)} MB`)
  console.log(`[pack] SHA256: ${sha}`)
  console.log(crlfLeft === 0 ? '[pack] 换行符检查: 全部 LF ✅' : `[pack] ⚠️ 仍有 ${crlfLeft} 个文本文件包含 CRLF`)
  if (!WITH_DIST) console.log('[pack] 未包含 frontend/dist（服务器会自行构建；如需离线部署请加 --with-dist）')

  printCommands(`${NAME}.tar.gz`)
  if (crlfLeft > 0) process.exitCode = 1
}

main()
