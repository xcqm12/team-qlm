/**
 * 种子数据：来自七零喵团队原站 https://team.qlm.org.cn/ 的公开内容
 * 仅在数据库为空时写入，可安全重复执行
 */
import { db, get, query, run, tx } from './index.js'

export const settings = {
  site_name: '七零喵团队',
  site_short_name: '七零喵',
  site_slogan: '你们的支持，我们的努力。',
  site_description:
    '七零喵团队是由一群游戏爱好者与独立开发者所组建的团队。我们热爱创造，热爱分享，致力于为玩家带来优质的游戏内容与体验。',
  site_keywords: '七零喵团队,SevenZeroMeow,我的世界,Minecraft,模组,独立开发,Super_Hi_Vision',
  contact_email: 'qlm@qlm.org.cn',
  contact_address: '线上团队 · 全球合作',
  contact_hours: '工作日 10:00 - 19:00',
  founded_at: '2019-11-11',
  platform_mc: 'https://mc.163.com/',
  platform_curseforge: 'https://www.curseforge.com/',
  platform_modrinth: 'https://modrinth.com/',
  platform_github: 'https://github.com/',
  footer_note: '你们的支持，我们的努力。',
  icp: '',
  // 第三方链接检测（跳转前连通性检查）默认值，可在后台「站点设置」中调整
  link_check_mode: 'before-redirect',
  link_check_ttl: '600',
  link_check_timeout_ms: '8000',
  link_check_max_hops: '6',
  link_check_concurrency: '3',
  link_check_block: '0',
  // 防 CC（应用层）默认值，可在后台「站点设置」中调整
  anticc_enabled: '1',
  anticc_window_ms: '60000',
  anticc_max_requests: '240',
  anticc_max_concurrent: '200',
  anticc_max_per_ip: '16',
  anticc_ban_seconds: '600',
  anticc_whitelist: '',
  anticc_skip_token: '1'
}

export const projects = [
  {
    slug: 'super-hi-vision',
    title: '高级超高清屏幕录制工具',
    category: 'Super_Hi_Vision',
    version: 'v1.5.0',
    summary: '高级超高清屏幕录制工具 —— 基于 PyQt5 构建的现代化界面屏幕录制软件。',
    content: `## 项目简介

**Super_Hi_Vision** 是七零喵团队自研的高级超高清屏幕录制工具，使用 Python + PyQt5 构建了现代化的图形界面，面向需要高质量录屏的创作者与开发者。

## 核心特性

- 超高清录制：支持高分辨率、高码率输出，画质损失小
- 现代化界面：基于 PyQt5 的深色主题界面，操作直观
- 灵活区域选择：全屏 / 窗口 / 自定义区域录制
- 轻量易用：开箱即用，无需复杂配置

## 适用场景

- 游戏过程录制与精彩片段留存
- 软件演示、教程与课程素材制作
- 产品演示视频与 Bug 复现录屏

## 获取方式

请前往「文件下载」页面下载最新版本，安装包与更新日志随文件一并提供。`,
    tags: '录屏,PyQt5,工具,超高清',
    repo_url: 'https://github.com/',
    external_url: '',
    status: 'published',
    sort_order: 1
  },
  {
    slug: 'the-dead-craft',
    title: '制作死者',
    category: '其他',
    version: 'v1.19.x-1.21.x',
    summary: '一个为 Minecraft 带来丧尸末日生存体验的 Forge 模组。',
    content: `## 项目简介

**制作死者** 是一个为 Minecraft 带来丧尸末日生存体验的 Forge 模组，支持 1.19.x ~ 1.21.x 版本。

## 模组特色

- 末日氛围：感染蔓延、资源稀缺，夜晚变得格外危险
- 感染机制：被感染者攻击可能带来持续性威胁
- 生存循环：搜集物资、建立据点、抵御尸潮
- 平衡设计：兼顾原版手感与末日压迫感

## 版本支持

| 游戏版本 | 加载器 | 状态 |
| --- | --- | --- |
| 1.21.x | Forge | 支持 |
| 1.20.x | Forge | 支持 |
| 1.19.x | Forge | 支持 |

## 获取方式

模组文件发布在「文件下载」页面，同时也同步发布至 CurseForge 与 Modrinth。`,
    tags: 'Minecraft,Forge,模组,末日生存',
    repo_url: 'https://github.com/',
    external_url: 'https://www.curseforge.com/',
    status: 'published',
    sort_order: 2
  }
]

export const news = [
  {
    slug: 'studio-renamed-2022',
    title: '工作室更名公告 · 2022年7月',
    category: '动态',
    summary: '工作室更名，详见微信公众号公告。由星辰工作室更名为七零喵团队。',
    content: `## 更名公告

自 2022 年 7 月起，原「星辰工作室」正式更名为「**七零喵团队**」（Seven Zero Meow）。

更名后：

- 团队原有作品、版权与协作关系保持不变
- 新的品牌标识（Logo）同步启用
- 各发布平台的团队名称将陆续更新

感谢大家一直以来的支持，你们的支持，我们的努力。

*详细说明请见微信公众号公告。*`,
    published_at: '2022-07-01 10:00:00'
  },
  {
    slug: 'forum-online-2022',
    title: '工作室论坛上线 · 2022年1月',
    category: '动态',
    summary: '工作室新的论坛已上线，欢迎大家前来交流。',
    content: `## 论坛上线

工作室新的论坛已正式上线，用于发布作品预告、收集玩家反馈与团队内部交流。

欢迎各位玩家与开发者前来交流讨论。`,
    published_at: '2022-01-01 10:00:00'
  },
  {
    slug: 'second-anniversary-2021',
    title: '工作室两周年 · 2021年1月',
    category: '动态',
    summary:
      '我的世界星辰工作室正式创建两周年，新发布多个作品，突破了一段时间无作品的历史。',
    content: `## 两周年

我的世界星辰工作室正式创建两周年。

这一年我们新发布了多个作品，突破了一段时间无作品的历史，也迎来了更多志同道合的伙伴。

感谢每一位成员的付出与每一位玩家的支持。`,
    published_at: '2021-01-01 10:00:00'
  },
  {
    slug: 'difficult-times-2020',
    title: '工作室遭遇困难 · 2020年8月',
    category: '动态',
    summary: '因副室长的失误遭遇了攻击与网络暴力，使工作室艰难发展；工作室 logo 再次更新。',
    content: `## 情况说明

2020 年 8 月，因副室长的失误，工作室遭遇了攻击与网络暴力，发展一度陷入困难。

我们从中吸取了教训，重新梳理了账号与权限管理流程，并再次更新了工作室 Logo。

感谢在那段时间里依然支持我们的朋友。`,
    published_at: '2020-08-01 10:00:00'
  }
]

export const members = [
  {
    name: 'zasta',
    role: '室长 / 创始人',
    skills: '地图制作，测试',
    bio: '2018 年 7 月以个人身份发布作品，2019 年 1 月创立工作室，现任室长。',
    joined_at: '2019-01',
    sort_order: 1
  },
  {
    name: '妙行',
    role: '副室长',
    skills: '地图制作，测试，审核，内部运营',
    bio: '2019 年 1 月加入，现任副室长。',
    joined_at: '2019-01',
    sort_order: 2
  },
  {
    name: '浅若安兮',
    role: '成员',
    skills: '皮肤制作',
    bio: '2019 年 1 月加入。',
    joined_at: '2019-01',
    sort_order: 3
  },
  {
    name: 'mc小男孩',
    role: '成员',
    skills: '指令，地图制作，皮肤制作',
    bio: '2019 年 6 月加入。',
    joined_at: '2019-06',
    sort_order: 4
  },
  {
    name: '露露杏仁露',
    role: '成员',
    skills: '地图制作，视频发布',
    bio: '2019 年 11 月加入。',
    joined_at: '2019-11',
    sort_order: 5
  },
  {
    name: '话唠者',
    role: '成员',
    skills: '地图，皮肤制作',
    bio: '2020 年 1 月加入。',
    joined_at: '2020-01',
    sort_order: 6
  },
  {
    name: '小整天玩',
    role: '成员',
    skills: '地图，皮肤，光影，材质制作',
    bio: '2020 年 2 月加入。',
    joined_at: '2020-02',
    sort_order: 7
  },
  {
    name: 'ILaLiLuLaLa',
    role: '成员',
    skills: '地图，建筑，皮肤制作，测试',
    bio: '2020 年 6 月加入。',
    joined_at: '2020-06',
    sort_order: 8
  },
  {
    name: '蔡哥',
    role: '成员',
    skills: '皮肤制作，服务器运营',
    bio: '2020 年 6 月加入。',
    joined_at: '2020-06',
    sort_order: 9
  }
]

/** 写入种子数据；若已存在同名记录则跳过 */
export const seedDatabase = ({ force = false } = {}) => {
  const result = { settings: 0, projects: 0, news: 0, members: 0, skipped: 0 }

  tx(() => {
    for (const [key, value] of Object.entries(settings)) {
      const exists = get('SELECT 1 AS ok FROM settings WHERE key = ?', [key])
      if (exists && !force) {
        result.skipped++
        continue
      }
      run(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now','localtime'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [key, value]
      )
      result.settings++
    }

    for (const p of projects) {
      const exists = get('SELECT 1 AS ok FROM projects WHERE slug = ?', [p.slug])
      if (exists && !force) {
        result.skipped++
        continue
      }
      run(
        `INSERT INTO projects (slug, title, category, version, summary, content, tags, repo_url, external_url, status, sort_order)
         VALUES (@slug, @title, @category, @version, @summary, @content, @tags, @repo_url, @external_url, @status, @sort_order)
         ON CONFLICT(slug) DO UPDATE SET
           title = excluded.title, category = excluded.category, version = excluded.version,
           summary = excluded.summary, content = excluded.content, tags = excluded.tags,
           repo_url = excluded.repo_url, external_url = excluded.external_url,
           status = excluded.status, sort_order = excluded.sort_order,
           updated_at = datetime('now','localtime')`,
        p
      )
      result.projects++
    }

    for (const n of news) {
      const exists = get('SELECT 1 AS ok FROM news WHERE slug = ?', [n.slug])
      if (exists && !force) {
        result.skipped++
        continue
      }
      run(
        `INSERT INTO news (slug, title, category, summary, content, status, published_at)
         VALUES (@slug, @title, @category, @summary, @content, 'published', @published_at)
         ON CONFLICT(slug) DO UPDATE SET
           title = excluded.title, category = excluded.category, summary = excluded.summary,
           content = excluded.content, published_at = excluded.published_at,
           updated_at = datetime('now','localtime')`,
        n
      )
      result.news++
    }

    // 成员按 name 幂等写入：存在则更新，避免 --force 时重复插入
    for (const m of members) {
      const existing = get('SELECT id FROM members WHERE name = ?', [m.name])
      if (existing) {
        if (!force) {
          result.skipped++
          continue
        }
        run(
          `UPDATE members SET role = @role, skills = @skills, bio = @bio, joined_at = @joined_at,
                              sort_order = @sort_order
           WHERE id = @id`,
          {
            role: m.role,
            skills: m.skills,
            bio: m.bio,
            joined_at: m.joined_at,
            sort_order: m.sort_order,
            id: existing.id
          }
        )
        result.membersUpdated = (result.membersUpdated || 0) + 1
        continue
      }
      run(
        `INSERT INTO members (name, role, skills, bio, joined_at, sort_order)
         VALUES (@name, @role, @skills, @bio, @joined_at, @sort_order)`,
        m
      )
      result.members++
    }

    // 清理历史遗留的同名重复成员（例如早期版本 --force 重复插入造成的）
    const duplicates = query(
      `SELECT id FROM members WHERE id NOT IN (SELECT MIN(id) FROM members GROUP BY name)`
    )
    if (duplicates.length) {
      const ids = duplicates.map((row) => row.id)
      run(`DELETE FROM members WHERE id IN (${ids.map(() => '?').join(',')})`, ids)
      result.duplicatesRemoved = ids.length
    }

    // 一级文件分类，方便后台上传时直接选择；老库缺少「第三方下载」时自动补齐
    const DEFAULT_FILE_CATEGORIES = ['工具软件', '模组资源', '文档资料', '图片素材', '第三方下载', '其他']
    const existingCategories = get("SELECT value FROM settings WHERE key = 'file_categories'")?.value
    if (!existingCategories) {
      run(`INSERT INTO settings (key, value) VALUES ('file_categories', ?)`, [
        JSON.stringify(DEFAULT_FILE_CATEGORIES)
      ])
    } else {
      try {
        const parsed = JSON.parse(existingCategories)
        if (Array.isArray(parsed) && !parsed.includes('第三方下载')) {
          parsed.push('第三方下载')
          run(`UPDATE settings SET value = ? WHERE key = 'file_categories'`, [JSON.stringify(parsed)])
        }
      } catch {
        /* 用户自定义格式，保持原样 */
      }
    }

    // 第三方下载示例：登记团队在 CurseForge 的发布入口（后台可编辑或删除）
    const hasExternal = (get("SELECT COUNT(*) AS c FROM files WHERE source = 'external'")?.c ?? 0) > 0
    const curseforgeUrl = get("SELECT value FROM settings WHERE key = 'platform_curseforge'")?.value || ''
    if (!hasExternal && curseforgeUrl) {
      run(
        `INSERT INTO files (original_name, stored_name, ext, mime, size, sha256, category, description, version,
                            is_public, source, external_url, provider, access_code, size_hint)
         VALUES (?, ?, '', 'text/html', 0, '', '第三方下载', ?, '', 1, 'external', ?, 'CurseForge', '', '第三方平台')`,
        [
          '制作死者 · CurseForge 发布页',
          'external-seed-curseforge',
          '模组文件发布在 CurseForge 平台，点击「前往下载」跳转到第三方页面获取最新版本。',
          curseforgeUrl
        ]
      )
      result.externalFiles = 1
    }
  })

  return result
}

export const isDatabaseEmpty = () =>
  (get('SELECT COUNT(*) AS c FROM settings')?.c ?? 0) === 0 && (db.open === true)
