# 架构说明

## 一、总体结构

```
                        ┌──────────────────────────────────────────┐
   浏览器 ──HTTPS──▶    │  Nginx（宝塔 / 系统 nginx）               │
                        │  · /              → frontend/dist 静态   │
                        │  · /assets/*      → 长缓存            │
                        │  · /uploads/*     → 上传目录(禁执行)     │
                        │  · /api/*         → 反向代理 127.0.0.1   │
                        └───────────────┬──────────────────────────┘
                                        │
                        ┌───────────────▼──────────────────────────┐
                        │  Node.js 进程（systemd: team-site）      │
                        │                                          │
                        │  Express 应用                            │
                        │   ├─ helmet / cors / compression         │
                        │   ├─ /api/auth      登录·改密            │
                        │   ├─ /api/files     上传·下载·预览·管理  │
                        │   ├─ /api/projects  项目 CRUD            │
                        │   ├─ /api/news      动态 CRUD            │
                        │   ├─ /api/members   成员 CRUD            │
                        │   ├─ /api/messages  留言（限流）         │
                        │   └─ /api/site      设置·统计·搜索·备份  │
                        │                                          │
                        │  服务层 services/{storage,settings}      │
                        │  数据层 db/index.js（双驱动适配）        │
                        └───────────────┬──────────────────────────┘
                                        │
                 ┌──────────────────────┴───────────────────────┐
                 ▼                                              ▼
      backend/data/team-site.db                  backend/data/uploads/
      SQLite（WAL）                              ├─ 原始文件（随机名）
      settings/users/files/projects/news/...      └─ thumbnails/（可选）
```

前端是纯静态 SPA：构建产物 `frontend/dist` 由 nginx（或后端 `express.static`）直接分发，
所有动态数据通过 `/api` 获取，因此前后端可以分开部署，也可以单机单端口部署。

---

## 二、请求链路示例

### 1）浏览文件列表

```
GET /api/files?category=图片素材
  → Express 路由 routes/files.js
  → optionalAuth：有 Token 且 scope=all 时可见私有文件
  → db.paginate()：拼 WHERE + LIMIT/OFFSET，另查汇总（数量/体积/下载次数）
  → services/storage.serializeFile()：补齐 sizeText / kind / url / downloadUrl
  → 返回 { items, total, page, pageSize, totalPages, summary }
```

### 2）上传文件

```
POST /api/files (multipart)
  → requireAuth：校验 JWT 与用户存在性
  → middleware/upload.js（multer）
      · 还原 UTF-8 文件名 → 清理危险字符
      · 白名单校验扩展名（BLOCKED_EXTENSIONS 硬拦截脚本类）
      · 磁盘写入：uploads/<日期>-<时间戳36进制>-<随机>.ext
  → 计算 SHA256（流式，不占内存）
  → 写 files 表，记录上传者与可见性
  → 写审计日志 audit_logs
  → 返回文件对象（含 sizeText / kind / downloadUrl）
```

### 3）新增第三方下载条目

```
POST /api/files/external (JSON)
  → requireAuth
  → isValidExternalUrl：必须是 http(s) + 有主机名（拦截 javascript:/file: 等）
  → 未填 provider 时 guessProvider() 按域名识别（百度网盘/蓝奏云/CurseForge/Modrinth/GitHub…）
  → stored_name = external-<随机 hex>（满足 UNIQUE，不落盘）
  → 写 files 表（source='external'）
  → 前端列表按 kind='link' 渲染「第三方」标识、平台名、提取码复制按钮
  → 用户点击「前往下载」→ /api/files/:id/download → 计数 + 302 跳转外部地址
```

### 4）点击第三方下载：跳转前检测

```
GET /api/files/:id/download
  → isExternalRow(row) 命中
  → getLinkCheckConfig()：mode / ttl / timeout / maxHops / block
  → mode=before-redirect 时 ensureLinkChecked(row)：
        · 缓存仍在 TTL 内 → 直接复用（不为每次点击都打扰第三方）
        · 否则 checkLink()：
            逐跳 fetch(redirect:'manual') 记录 301/302/303/307/308 链
            HEAD 优先；403/405/501 或网络异常 → 回退 GET + Range: bytes=0-0
            检测跳转环、跳转次数上限、超时
            HTTP 401/403/405/429/503 → suspicious（风控，浏览器可访问，不判失效）
        · persistLinkCheck() 写入 files.last_check_*
  → 真失效 + block=1 + 不是 force=1：
       返回 503 + HTML 提示页（含原因、跳转链、耗时、目标地址、以及「仍然尝试前往」→ ?force=1）
  → 否则 download_count +1，审计后 302 跳转到 external_url
```

设计取舍：

- **默认只检测不拦截**（`link_check_block=0`）：外链失效原因很多，误拦会直接影响访客下载；
  检测结果先记录、前台温和提示，管理员确认后再打开拦截。
- **风控与失效分开**：实测 `curseforge.com` 对服务器探测返回 403，但浏览器访问正常；
  若把 403 当失效会导致大面积误判，因此风控类只提示、永不拦截。
- **TTL 缓存**：避免每次点击都去打第三方（既慢又容易被封），默认 10 分钟。

### 5）生产环境静态分发

```
GET /uploads/xxx.png        → nginx alias → 直接读磁盘（Node 不参与）
GET /api/files/1/download   → 本站：Node 流式响应 + 计数 +1
                            → 第三方：计数 +1 后 302 跳转到外部平台
GET /projects/super-hi-vision（刷新页面）→ nginx try_files → index.html → 前端路由接管
```

---

## 三、数据库

### 驱动适配（关键设计）

`backend/src/db/index.js` 优先尝试 `better-sqlite3`，不可用时回退到 Node 内置 `node:sqlite`，
两者 API 高度一致，因此业务代码无需区分：

```js
const driver = await loadDriver()      // better-sqlite3 → node:sqlite
export const db = driver.open(config.dbFile)
export const query = (sql, params) => db.prepare(sql).all(...params)
export const get   = (sql, params) => db.prepare(sql).get(...params)
export const run   = (sql, params) => db.prepare(sql).run(...params)
export const tx    = (fn) => { /* BEGIN / COMMIT / ROLLBACK */ }
```

好处：服务器不需要编译器与构建工具链，`npm install` 不会因原生模块失败而中断。

### 表结构

| 表 | 作用 | 关键字段 |
| --- | --- | --- |
| `settings` | 键值配置 | `key`(PK) `value` |
| `users` | 后台账号 | `username`(UNIQUE) `password_hash`(scrypt) `role` `last_login_at` |
| `files` | 文件与第三方下载条目 | `original_name` `stored_name`(UNIQUE) `ext` `mime` `size` `sha256` `category` `version` `is_public` `download_count` `uploader_id` `source`(local/external) `external_url` `provider` `provider_icon` `button_label` `tags` `access_code` `size_hint` `sort_order` `open_in_new_tab` `show_url` `extras` |
| `projects` | 项目作品 | `slug`(UNIQUE) `title` `category` `version` `summary` `content` `cover_file_id` `tags` `status` `sort_order` `views` |
| `project_files` | 项目↔文件 | `project_id` `file_id`(联合主键) `sort_order` |
| `news` | 新闻动态 | `slug`(UNIQUE) `title` `category` `summary` `content` `status` `views` `published_at` |
| `members` | 团队成员 | `name` `role` `skills` `bio` `joined_at` `sort_order` `avatar_file_id` |
| `messages` | 联系留言 | `name` `email` `subject` `content` `ip` `status` |
| `audit_logs` | 操作审计 | `user_id` `action` `target` `detail` `ip` `created_at` |
| `v_site_stats` | 统计视图 | 项目/动态/文件/第三方数/本站数/体积/下载/成员/未读留言 汇总 |

约束与索引：外键 `ON DELETE SET NULL/CASCADE`、按 `category`/`created_at`/`status`/`source` 建索引、
`project_files` 用联合主键防重复绑定。

### 文件的双来源设计

同一张 `files` 表承载两种来源，靠 `source` 区分，前端与接口口径统一：

| | 本站上传 `local` | 第三方下载 `external` |
| --- | --- | --- |
| 实体文件 | 存在 `backend/data/uploads/` | 不存在（只登记地址） |
| `stored_name` | 随机文件名 | `external-<随机/哈希>` 占位（`UNIQUE` 约束要求非空） |
| 体积 | `size` 字节数，展示 `sizeText` | `size = 0`，展示 `sizeHint`（默认「第三方」） |
| `kind` | 按扩展名推断（image/video/…） | 固定 `link` |
| 下载行为 | 下发文件流 | `302` 跳转 `external_url` |
| 平台名/图标 | — | `provider` + `provider_icon`：完全自定义；留空则按域名识别，再回退对方 favicon |
| 按钮文案 | 固定「下载 / 预览」 | `button_label`，如「去 Release 页」 |
| 标签 | — | `tags`，逗号分隔，最多展示 8 个 |
| 置顶 | — | `sort_order`，配合列表 `sort=pinned` |
| 行为开关 | — | `open_in_new_tab`、`show_url` |
| 附加字段 | — | `extras`：JSON 或 `键=值` 文本，前台最多展示 6 条 |
| 提取码 | — | `access_code`，前台展示 + 一键复制 |
| 跳转前检测 | — | `last_check_at` / `last_check_status` / `last_check_final_url` / `last_check_error` / `last_check_ms` / `last_check_hops` / `check_fail_count` |

这样设计的好处：统计（数量/下载量）、筛选、搜索、后台管理、项目关联文件全部只需一套逻辑；
`POST /files/:id/make-external` 还能把已上传文件平滑转换为外链（删除本地文件并保留统计）。

> 后台的「添加第三方下载」表单覆盖以上全部字段；分类支持现场新增（写回 `settings.file_categories`）。
> 平台与图标的自动识别只是**建议值**，用户填写的自定义值永远优先，不会被覆盖。

### 迁移策略

`src/db/schema.sql` 全部使用 `CREATE TABLE IF NOT EXISTS`，但 SQLite 不会给**已有表**补列，
因此 `db/index.js` 额外做了两件事（都在 `migrate()` 中，幂等）：

1. **自动补列**：`COLUMN_MIGRATIONS` 登记新增字段，用 `pragma_table_info` 检查缺失后 `ALTER TABLE ADD COLUMN`
2. **视图重建**：先 `DROP VIEW IF EXISTS v_site_stats` 再由 schema 重建，保证统计口径随版本更新
3. **索引后置**：依赖新列的索引（如 `idx_files_source`）放在补列之后再创建

> 踩坑记录：最初把 `idx_files_source` 写在 `schema.sql` 里，导致**老库升级时索引先于补列执行而启动失败**。
> 现在有 `npm run test:migration` 专门复现"旧表结构 + 新代码"的场景来防回归（9 项断言）。

`seed.js` 对每个条目先查后写（或 `ON CONFLICT ... DO UPDATE`），并且会在老库里
自动把「第三方下载」补进文件分类，因此**升级时重复执行不会破坏已有数据**。

---

## 四、安全模型

| 面向 | 措施 |
| --- | --- |
| 口令 | `node:crypto` 的 scrypt + 16 字节随机盐，格式 `scrypt$salt$hash`，比较使用 `timingSafeEqual` |
| 会话 | JWT（默认 7 天），每次请求校验用户仍存在；前端 Token 存 localStorage，401 自动登出 |
| 暴力破解 | 登录 10 分钟 20 次、留言 1 小时 10 条限流 |
| 上传 | 扩展名白名单 + 危险类型硬拦截 + 随机存储名 + 大小上限 + 数量上限（20） |
| 第三方链接 | 仅接受 `http(s)` 且带主机名的完整地址（`javascript:`、`file:`、`data:` 一律 400）；前台跳转使用 `noopener noreferrer`；下载经站内 `/api/files/:id/download` 中转，链接不直接暴露在页面上 |
| 文件分发 | nginx 层禁止脚本解析与隐藏文件访问；可执行/压缩类强制 `attachment`；`X-Content-Type-Options: nosniff` |
| 响应头 | helmet（`crossOriginResourcePolicy: cross-origin` 以支持图片外链），CSP 交给 nginx/面板按需配置 |
| XSS | Markdown 先 HTML 转义再解析；链接仅放行 `http(s)/mailto/#/相对路径` |
| 审计 | 登录成功/失败、上传、删除、改密、设置变更等写 `audit_logs` |
| 进程 | systemd 单元启用 `NoNewPrivileges`、`ProtectSystem=full`、`ReadWritePaths` 白名单、`MemoryMax=1G` |

---

## 五、前端结构

```
src/
├── api/            client.ts（axios 实例 + Token 注入 + 错误归一化）/ index.ts（接口与类型）
├── components/     SiteHeader/SiteFooter/PublicLayout/FileCard/ProjectCard/NewsCard/
│                   FileUploader/ImageLightbox/MarkdownContent/Pagination/ToastHost/EmptyState/LoadingBlock
├── composables/    useToast（全局轻量通知）/ useTheme（深浅色并持久化）
├── stores/         auth（登录态）/ site（站点设置与统计缓存）
├── utils/          markdown.ts（无依赖且防 XSS 的渲染器）/ format.ts（日期、体积、图标）
├── router/         路由 + 鉴权守卫 + 标题设置
└── views/          前台 7 个页面 + 后台 8 个页面（按路由懒加载）
```

要点：

- **无重型 UI 库**：设计系统在 `assets/styles/main.css` 中以 CSS 变量实现（品牌色取自 Logo 的蓝/青渐变），
  `[data-theme=dark]` 提供深色主题，包体积小、加载快。
- **按需加载**：路由级 `import()` 代码分割，构建结果中每个页面为独立 chunk。
- **统一错误处理**：axios 响应拦截器把后端 `{message}` 归一化为 `ApiError`，视图层只需 `toast.error(err.message)`。
- **预览能力**：`ImageLightbox` 按 `file.kind` 渲染图片 / 视频 / 音频 / PDF / 文本，其他类型引导下载。

---

## 六、扩展点

| 想做的事 | 建议位置 |
| --- | --- |
| 新增内容类型（如「插件商店」） | 仿 `routes/projects.js` + `schema.sql` 建表 + 前端 `views/` 页面 |
| 上传时自动生成缩略图（服务端） | `routes/files.js` 上传成功后调用外部命令，或部署后跑 `tools/make_thumbnails.py` |
| 接入对象存储 | 改写 `services/storage.js` 的落盘与 URL 生成，替换为 S3/OSS SDK |
| 换成 MySQL/PostgreSQL | 只需替换 `db/index.js` 的驱动层，SQL 使用较通用的语法 |
| 邮件通知留言 | 在 `routes/messages.js` 写入成功后向 SMTP/webhook 发送 |
| 权限分级 | `users.role` 已预留，在 `middleware/auth.js` 增加 `requireRole('admin')` |
| 接入 CDN | 前端产物上传 CDN；`/uploads` 配置回源或同步到对象存储 |
