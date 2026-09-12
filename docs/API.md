# API 参考

后端基地址：`http://127.0.0.1:8787/api`（生产环境经 nginx 反代为 `https://你的域名/api`）

---

## 一、通用约定

### 响应结构

成功：

```json
{ "success": true, "message": "ok", "data": { } }
```

失败：

```json
{ "success": false, "message": "文件超出大小限制", "details": null }
```

分页接口的统一结构：

```json
{
  "success": true,
  "data": {
    "items": [],
    "total": 42,
    "page": 1,
    "pageSize": 12,
    "totalPages": 4
  }
}
```

### 鉴权

登录后拿到 `token`，在请求头携带：

```
Authorization: Bearer <token>
```

也支持 `?token=<token>` 查询参数（方便 `window.open` 直接下载，不推荐用于普通请求）。
需要鉴权的接口在下方标注 **🔒**。

### 媒体类型

- JSON 接口：`Content-Type: application/json`
- 上传接口：`multipart/form-data`

### 限流

| 接口 | 限制 |
| --- | --- |
| `POST /auth/login` | 每 IP 10 分钟 20 次 |
| `POST /messages` | 每 IP 1 小时 10 条 |

### 状态码

| 码 | 含义 |
| --- | --- |
| 200 / 201 | 成功 / 创建成功 |
| 400 | 参数错误 |
| 401 | 未登录或 Token 失效 |
| 403 | 无权限（如私有文件） |
| 404 | 资源不存在 |
| 409 | 唯一字段冲突 |
| 413 | 文件超出大小限制 |
| 429 | 触发限流 |
| 500 | 服务器内部错误 |

---

## 二、健康检查

### `GET /health`

```json
{ "success": true, "message": "ok", "data": { "status": "healthy", "time": "2026-01-01T00:00:00.000Z" } }
```

---

## 三、认证 `/auth`

### `POST /auth/login`

```json
// 请求
{ "username": "admin", "password": "qlm@2019" }

// 响应
{
  "success": true,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOi...",
    "user": { "id": 1, "username": "admin", "displayName": "站点管理员", "role": "admin", "lastLoginAt": "..." }
  }
}
```

### `GET /auth/me` 🔒

```json
{ "data": { "user": { "id": 1, "username": "admin", "displayName": "站点管理员", "role": "admin" }, "jwtSecretIsDefault": false } }
```

`jwtSecretIsDefault` 为 `true` 说明服务器仍在使用占位密钥，应当尽快修改。

### `POST /auth/password` 🔒

```json
{ "oldPassword": "qlm@2019", "newPassword": "新的强密码" }
```

---

## 四、文件 `/files`

### 文件对象

文件分两类，字段结构一致（前端据 `isExternal` / `kind` 区分展示）：

**本站上传（`source: "local"`）**

```json
{
  "id": 12,
  "originalName": "Super_Hi_Vision_v1.5.0.zip",
  "storedName": "20260101-mabc123-9f2c1d3e4f5a.zip",
  "ext": "zip",
  "mime": "application/zip",
  "size": 48234021,
  "sizeText": "46.0 MB",
  "sha256": "9f2c...",
  "category": "工具软件",
  "description": "超高清录屏工具安装包",
  "version": "v1.5.0",
  "isPublic": true,
  "downloadCount": 37,
  "kind": "other",
  "createdAt": "2026-01-01 10:00:00",
  "url": "/uploads/20260101-mabc123-9f2c1d3e4f5a.zip",
  "downloadUrl": "/api/files/12/download",
  "thumbnailUrl": null,
  "source": "local",
  "isExternal": false,
  "provider": "",
  "externalUrl": "",
  "accessCode": "",
  "sizeHint": ""
}
```

**第三方下载（`source: "external"`，文件不在本站，展示样式全部可自定义）**

```json
{
  "id": 21,
  "originalName": "团队站点源码 · GitHub Releases",
  "storedName": "",
  "ext": "",
  "mime": "text/html",
  "size": 0,
  "sizeText": "不定",
  "category": "第三方下载",
  "version": "v1.0.0",
  "isPublic": true,
  "downloadCount": 12,
  "kind": "link",
  "source": "external",
  "isExternal": true,
  "provider": "GitHub Releases",
  "providerIcon": "🐙",
  "externalUrl": "https://github.com/xxxx/xxxxx/releases",
  "buttonLabel": "去 Release 页",
  "tags": ["官方", "开源", "MIT"],
  "accessCode": "",
  "sizeHint": "不定",
  "sortOrder": 100,
  "openInNewTab": true,
  "showUrl": true,
  "extras": { "授权": "MIT", "附件数": "3", "校验": "SHA256 见 Release 说明" },
  "url": "https://github.com/xxxx/xxxxx/releases",
  "downloadUrl": "/api/files/21/download",
  "thumbnailUrl": null
}
```

- `kind` 取值：`image` / `video` / `audio` / `pdf` / `text` / `other`，第三方条目恒为 `link`
- `sizeText`：本站文件由字节数格式化；第三方条目取 `sizeHint`（未填则为「第三方」）
- 第三方条目的 `downloadUrl` 是站内地址，访问后 **302 跳转**到 `externalUrl` 并计数（便于统计下载量、避免链接被直接爬取）
- `providerIcon`：自定义图标（emoji 或图片 URL）；未配置时用内置平台图标，再回退对方站点 favicon
- `tags`：数组（后端按逗号拆分）；`extras`：任意自定义键值对，原样展示在卡片上
- `sortOrder`：置顶权重，配合 `sort=pinned` 使用；`openInNewTab` / `showUrl`：行为开关
- `linkCheck`：最近一次跳转前检测结果（未检测为 `null`）

```json
{
  "linkCheck": {
    "ok": false,
    "status": 403,
    "finalUrl": "https://www.curseforge.com/",
    "hops": 0,
    "latencyMs": 231,
    "error": "平台返回 HTTP 403（疑似风控 / 防盗链，浏览器访问通常正常）",
    "checkedAt": "2026-01-01 10:05:00",
    "failCount": 0,
    "suspicious": true
  }
}
```

| 字段 | 说明 |
| --- | --- |
| `ok` | HTTP 2xx/3xx 视为可达 |
| `suspicious` | 401/403/405/429/503 等**平台风控**结果：只提示、不判失效、不拦截跳转 |
| `hops` | 跳转次数（探测时逐跳跟随） |
| `finalUrl` | 跳转链的真实终点 |
| `latencyMs` / `checkedAt` | 耗时与检测时间 |
| `failCount` | 连续失败次数（成功后清零），便于运维判断是偶发还是长期失效 |

### `GET /files`

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `category` | — | 分类精确匹配 |
| `kind` | — | `image` / `video` / `archive` / `document` / `link`（`link` = 只看第三方） |
| `source` | — | `local` 只看本站文件 / `external` 只看第三方下载 |
| `q` | — | 关键词（文件名 / 说明 / 版本 / 平台名） |
| `sort` | `newest` | `newest` / `oldest` / `downloads` / `size` / `name` / **`pinned`**（置顶权重优先） |
| `page` / `pageSize` | 1 / 12 | 最大 100 |
| `scope` | — | 🔒 传 `all` 可包含私有文件（需登录） |

响应在分页结构外额外附带汇总：

```json
{
  "data": {
    "items": [],
    "total": 3,
    "summary": {
      "count": 3,
      "bytes": 127949,
      "sizeText": "124.9 KB",
      "downloads": 5,
      "localCount": 2,
      "externalCount": 1
    }
  }
}
```

### `GET /files/categories`

```json
{
  "data": {
    "categories": [ { "name": "图片素材", "count": 3, "bytes": 127949, "externalCount": 0 } ],
    "kinds": ["image", "video", "archive", "document", "link"],
    "sources": { "all": 4, "local": 3, "external": 1 }
  }
}
```

### `POST /files/external` 🔒

新增第三方（外链）下载条目，文件不落本站，`JSON` 请求体。**除名称与链接外全部字段可选，且都可自定义**：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `originalName` | ✅ | 展示名称（也接受 `title`） |
| `externalUrl` | ✅ | 任意 `http(s)` 地址（也接受 `url`）：GitHub Releases、CurseForge、网盘、自有直链均可；`javascript:`/`file:`/`data:` 一律 400 |
| `provider` | — | 平台名称，**自由填写**；留空则按域名自动识别（GitHub Releases / GitHub Tags / CurseForge / Modrinth / 百度网盘 / 蓝奏云 / 阿里云盘 / 夸克网盘 / OneDrive / Google Drive / MediaFire…） |
| `providerIcon` | — | 平台图标：emoji（`🐙`）或图片地址（`https://…/icon.png`）；留空用内置映射，再回退对方 favicon |
| `buttonLabel` | — | 下载按钮文案，如「去 Release 页」「获取」（≤12 字）；留空用「前往下载」 |
| `tags` | — | 展示标签，逗号分隔（`官方,开源,MIT`），最多 8 个 |
| `sortOrder` | — | 置顶权重，整数，越大越靠前（配合 `sort=pinned`），`0` 表示不置顶 |
| `openInNewTab` | — | 是否新窗口打开，默认 `true` |
| `showUrl` | — | 是否在卡片上显示原始链接，默认 `true` |
| `extras` | — | 任意自定义字段：JSON 对象（`{"授权":"MIT"}`）或 `键=值` 多行文本，前台原样展示（最多 6 条） |
| `accessCode` | — | 提取码 / 访问密码，前台展示并提供一键复制 |
| `sizeHint` | — | 显示用大小，如 `1.2 GB`、`不定`；不填前台显示「第三方」 |
| `category` | — | 分类，默认「第三方下载」；**可填任意自定义分类名**（后台界面支持一键新增分类） |
| `description` / `version` | — | 说明与版本号 |
| `isPublic` | — | `1` 公开（默认）/ `0` 私有 |

```bash
# GitHub Releases（深层地址）+ 全套自定义
curl -X POST http://127.0.0.1:8787/api/files/external \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{
        "originalName": "团队站点源码 · GitHub Releases",
        "externalUrl": "https://github.com/xxxx/xxxxx/releases",
        "providerIcon": "🐙",
        "buttonLabel": "去 Release 页",
        "tags": "官方,开源,MIT",
        "sortOrder": 100,
        "showUrl": true,
        "extras": {"授权": "MIT", "附件数": "3"},
        "sizeHint": "不定"
      }'
```

返回 `201` 与序列化后的文件对象（`isExternal: true`、`kind: "link"`）。

### `POST /files/:id/make-external` 🔒

把已上传的**本站文件**改为第三方外链（会删除本地文件，不可恢复）：

```json
{ "externalUrl": "https://pan.baidu.com/s/abcdef", "provider": "百度网盘", "accessCode": "qlm1", "sizeHint": "1.2 GB" }
```

字段均可选（除 `externalUrl`）；`provider` 留空则自动识别。已经是外链的条目会返回 `400`。

### `POST /files` 🔒

`multipart/form-data`

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `file` 或 `files` | ✅ | 单个或多个文件（最多 20 个） |
| `category` | — | 分类，默认「其他」 |
| `description` | — | 说明 |
| `version` | — | 版本号 |
| `isPublic` | — | `1` 公开（默认）/ `0` 私有 |

```bash
curl -X POST http://127.0.0.1:8787/api/files \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@Super_Hi_Vision_v1.5.0.zip" \
  -F "category=工具软件" -F "version=v1.5.0" -F "description=超高清录屏工具安装包"
```

返回 `201`，`data` 为单个文件对象（多文件时为数组）。

### `GET /files/:id`

```json
{ "data": { "file": { }, "previewKind": "image" } }
```

### `GET /files/:id/download`

- 本站文件：下发文件流，`Content-Disposition` 使用原始文件名
- 第三方条目：
  1. **跳转前检测**（`link_check_mode=before-redirect` 时）：复用/刷新检测结果，记录审计 `link.precheck`
  2. 若为「真失效」且 `link_check_block=1`：返回 `503` + 可读提示页（含「仍然尝试前往」链接，即 `?force=1`）
  3. 否则 `302` 跳转到 `external_url`
- 两种情况都累加 `download_count` 并写审计日志（`file.download` / `file.download.external`）
- 查询参数 `force=1` 可跳过拦截判定（供提示页的"仍然前往"使用）

### `POST /files/check-url` 🔒

检测任意链接（不落库），后台表单「检测链接」按钮使用：

```json
// 请求
{ "url": "https://github.com/xxxx/xxxxx/releases", "timeoutMs": 8000 }

// 响应
{
  "data": {
    "check": {
      "ok": true, "status": 200, "method": "GET", "hopCount": 1,
      "finalUrl": "https://github.com/xxxx/xxxxx/releases/tag/v1.0.0",
      "hops": ["https://github.com/xxxx/xxxxx/releases"],
      "latencyMs": 412, "suspicious": false, "loop": false, "tooManyHops": false,
      "contentType": "text/html; charset=utf-8", "checkedAt": "2026-01-01T10:00:00.000Z"
    },
    "summary": "可达（HTTP 200，1 次跳转）"
  }
}
```

判定规则：`HEAD` 优先，遇 `403/405/501` 或网络异常自动回退 `GET`（带 `Range: bytes=0-0` 只取 1 字节）；
逐跳跟随 3xx 并检测**跳转环**与**跳转次数上限**；`401/403/405/429/503` 标记 `suspicious`（不判失效）。

### `POST /files/:id/check` 🔒

检测并写入该条目（更新 `linkCheck` 字段 + `files.last_check_*` 列 + 审计日志 `link.check`）。

### `POST /files/check-all` 🔒

批量检测全部第三方条目（并发数由 `link_check_concurrency` 控制，单次最多 200 条）：

```json
// 请求：onlyStale 默认 true（跳过缓存仍在有效期内的）
{ "onlyStale": false }

// 响应
{
  "data": {
    "checked": 4,
    "skipped": 0,
    "summary": { "ok": 2, "failed": 1, "suspicious": 1 },
    "results": [
      { "id": 5, "name": "制作死者 · CurseForge 发布页",
        "url": "https://www.curseforge.com/",
        "summary": "疑似风控（HTTP 403，浏览器访问通常正常）",
        "check": { } }
    ]
  }
}
```

`summary.failed` 只统计**真失效**（超时 / DNS 失败 / 连接被拒 / 跳转环 / 5xx / 404），
风控类单列为 `suspicious`，便于定时任务精确告警。

### `GET /files/:id/preview`

- 本站文件：图片优先返回缩略图，文本 / PDF 内联显示，其他类型 `302` 到下载接口
- 第三方条目：`302` 跳转到 `externalUrl`

### `PATCH /files/:id` 🔒

```json
{ "originalName": "新名称.zip", "category": "工具软件", "description": "说明", "version": "v1.5.1", "isPublic": false }
```

第三方条目还可更新外链相关字段（`externalUrl` 变化且未显式传 `provider` 时会重新识别平台）：

```json
{
  "externalUrl": "https://github.com/xxxx/xxxxx/releases",
  "provider": "GitHub Releases",
  "providerIcon": "🐙",
  "buttonLabel": "去 Release 页",
  "tags": "官方,开源",
  "accessCode": "new1",
  "sizeHint": "2.0 GB",
  "sortOrder": 50,
  "openInNewTab": false,
  "showUrl": false,
  "extras": { "授权": "MIT" }
}
```

以上字段在编辑接口中均可单独传（未传的不变）；`extras` 传对象或 `键=值` 文本皆可。

### `DELETE /files/:id` 🔒

本站文件：删除数据库记录 + 磁盘文件（含缩略图）；
第三方条目：仅删除记录（无本地文件）。

### `POST /files/batch-delete` 🔒

```json
{ "ids": [1, 2, 3] }
```

### `GET /files/storage-usage` 🔒

```json
{ "data": { "count": 3, "bytes": 127949, "sizeText": "124.9 KB", "orphanFiles": [], "uploadDir": "/www/wwwroot/team-site/backend/data/uploads", "maxUploadSize": 209715200 } }
```

---

## 五、项目 `/projects`

### 项目对象

```json
{
  "id": 1,
  "slug": "super-hi-vision",
  "title": "高级超高清屏幕录制工具",
  "category": "Super_Hi_Vision",
  "version": "v1.5.0",
  "summary": "……",
  "content": "## 项目简介\n……",
  "tags": "录屏,PyQt5,工具",
  "repo_url": "https://github.com/",
  "external_url": "",
  "status": "published",
  "sort_order": 1,
  "views": 12,
  "created_at": "…",
  "updated_at": "…",
  "cover": null
}
```

### 接口

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| GET | `/projects` | — | 列表，支持 `category` `q` `page` `pageSize` `featured=1`，🔒 `scope=all` 含草稿；响应含 `categories` |
| GET | `/projects/:key` | — | 详情，`key` 为 `slug` 或数字 `id`；响应含 `files`（关联文件），会累加浏览量 |
| POST | `/projects` | 🔒 | 新建，`slug` 可省略（自动由标题生成并去重） |
| PUT | `/projects/:id` | 🔒 | 更新（字段可选传） |
| DELETE | `/projects/:id` | 🔒 | 删除 |
| POST | `/projects/:id/files` | 🔒 | 绑定下载文件 `{ "fileIds": [1,2] }` |

新建 / 更新的可写字段：`title` `slug` `category` `version` `summary` `content` `tags` `repoUrl` `externalUrl` `status`（`published`/`draft`）`sortOrder` `coverFileId`。

---

## 六、新闻 `/news`

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| GET | `/news` | — | 列表，支持 `category` `q` `page` `pageSize`，🔒 `scope=all` 含草稿 |
| GET | `/news/:key` | — | 详情（`slug` 或 `id`），累加浏览量 |
| POST | `/news` | 🔒 | 发布，字段：`title` `slug` `category` `summary` `content` `status` `publishedAt` `coverFileId` |
| PUT | `/news/:id` | 🔒 | 更新 |
| DELETE | `/news/:id` | 🔒 | 删除 |

---

## 七、成员 `/members`

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| GET | `/members` | — | 全部成员（按 `sort_order` 排序） |
| POST | `/members` | 🔒 | 新增：`name` `role` `skills` `bio` `joinedAt` `sortOrder` `avatarFileId` |
| PUT | `/members/:id` | 🔒 | 更新 |
| DELETE | `/members/:id` | 🔒 | 删除 |

---

## 八、留言 `/messages`

### `POST /messages`（公开，限流）

```json
{ "name": "访客", "email": "guest@example.com", "subject": "合作咨询", "content": "你好，我们想……" }
```

校验：`name`/`email`/`content` 必填，邮箱格式校验，`content` 5~2000 字。

### 管理接口

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| GET | `/messages` | 🔒 | 列表，支持 `status`（`new`/`read`/`replied`/`archived`）`page` `pageSize`，响应含 `unread` |
| PATCH | `/messages/:id` | 🔒 | `{ "status": "read" }` |
| DELETE | `/messages/:id` | 🔒 | 删除 |

---

## 九、站点 `/site`

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| GET | `/site/settings` | — | 公开设置 + 文件分类 + 版本号 |
| PUT | `/site/settings` | 🔒 | 批量更新设置（键值对象，可含 `file_categories`） |
| GET | `/site/stats` | — | 公开统计（项目/动态/文件/下载/成员数） |
| GET | `/site/dashboard` | 🔒 | 控制台数据：统计 + 最近文件/留言/审计 + 运行环境 |
| GET | `/site/search?q=` | — | 一次搜索项目、动态、文件 |
| POST | `/site/backup` | 🔒 | 导出 SQL 文本备份（`application/sql`） |
| POST | `/site/cleanup-orphans` | 🔒 | 删除磁盘上无数据库记录的无主文件 |

### 可配置的设置键

`site_name`、`site_short_name`、`site_slogan`、`site_description`、`site_keywords`、
`contact_email`、`contact_address`、`contact_hours`、`founded_at`、`icp`、
`platform_mc`、`platform_curseforge`、`platform_modrinth`、`platform_github`、
`footer_note`、`file_categories`（JSON 数组字符串）。

**第三方链接检测**（后台「站点设置」可改）：

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `link_check_mode` | `before-redirect` | `before-redirect` 跳转前检测 / `manual` 仅后台手动检测 |
| `link_check_ttl` | `600` | 检测结果缓存秒数（0 = 每次都重新检测） |
| `link_check_timeout_ms` | `8000` | 单次探测超时 |
| `link_check_max_hops` | `6` | 最大跳转次数，超过判为异常跳转链 |
| `link_check_concurrency` | `3` | 批量检测并发数 |
| `link_check_block` | `0` | 不可达时是否拦截跳转（`1` 拦截并显示提示页；风控类永不拦截） |

---

## 十、静态资源

| 路径 | 说明 |
| --- | --- |
| `/uploads/<storedName>` | 上传的文件（图片内联、可执行/压缩类强制下载） |
| `/uploads/thumbnails/<storedName>` | 缩略图（由 `tools/make_thumbnails.py` 生成，可选） |

> 下载计数只在走 `/api/files/:id/download` 时累加；直接访问 `/uploads/...` 不计入。

---

## 十一、调用示例

```bash
BASE=http://127.0.0.1:8787/api

# 登录
TOKEN=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"qlm@2019"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# 上传
curl -s -X POST "$BASE/files" -H "Authorization: Bearer $TOKEN" \
  -F "file=@./logo.png" -F "category=图片素材" | head -c 300

# 新增第三方下载（外链，不落盘）
curl -s -X POST "$BASE/files/external" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"originalName":"制作死者 · 百度网盘","externalUrl":"https://pan.baidu.com/s/abcdef","accessCode":"qlm1","sizeHint":"1.2 GB"}'

# 只看第三方下载
curl -s "$BASE/files?source=external"

# 列表
curl -s "$BASE/files?pageSize=5" | head -c 300

# 新建项目
curl -s -X POST "$BASE/projects" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"新项目","category":"其他","version":"v1.0.0","summary":"简介","content":"## 正文"}'

# 搜索
curl -s "$BASE/site/search?q=模组"
```

Python 侧已封装好客户端（含 multipart 上传），可直接复用：`tools/qlm_common.py` 的 `ApiClient`。
