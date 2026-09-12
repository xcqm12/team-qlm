<div align="center">

<img src="frontend/public/logo.png" alt="七零喵团队" width="120" />

# 七零喵团队站点

**你们的支持，我们的努力。**

参考 [team.qlm.org.cn](https://team.qlm.org.cn/) 重构的团队官网：Vue 3 前端 + Node.js 后端 + SQLite 文件库，
支持文件上传/展示、后台内容管理，并提供**宝塔面板一键部署**与多 Linux 发行版适配。

![frontend](https://img.shields.io/badge/前端-Vue3%20%2B%20Vite-42b883)
![backend](https://img.shields.io/badge/后端-Node.js%20%2B%20Express-339933)
![db](https://img.shields.io/badge/数据库-SQLite-003b57)
![deploy](https://img.shields.io/badge/部署-宝塔%20%7C%20systemd%20%7C%20Docker-1e88e5)
![security](https://img.shields.io/badge/安全-防CC%20%2B%20限流-e5484d)

</div>

---

## 一、功能一览

### 前台（Vue 3 单页应用）
- **首页**：品牌展示、团队数据统计、精选项目、最新动态、下载入口
- **关于我们**：团队简介、发布平台、9 位成员卡片
- **项目作品 / 详情**：分类筛选、关键词搜索、Markdown 正文、关联文件下载
- **新闻动态 / 详情**：分页列表、浏览量统计
- **文件下载**：分类 / 类型 / 排序 / 关键词筛选，**本站文件**与**第三方下载**统一展示（来源切换），图片·视频·音频·PDF·文本**在线预览**，第三方条目一键跳转并显示提取码，下载计数
- **第三方下载全自定义**：任意 `http(s)` 地址（含 `github.com/xxxx/xxxxx/releases` 这类深层链接）都能直接登记；
  平台名、平台图标（emoji 或图片）、按钮文案、标签、分类、置顶权重、是否新窗口、是否显示原链接、提取码、显示大小、**任意附加字段**都可在后台自己定
- **跳转前链接检测**：点击第三方下载前先探测目标连通性，记录 HTTP 状态、**跳转链（次数与真实终点）**、耗时与失败原因；
  自动区分「真失效」与「平台风控 403」（后者浏览器可访问，不会误拦），结果按 TTL 缓存，可选择拦截不可达链接
- **防 CC 两层防护**：nginx 层 `limit_req`/`limit_conn`（15r/s、并发 20/API 10）+ 应用层滑动窗口计数、并发保护与**超限自动封禁**；
  已登录请求与白名单 IP 自动豁免，后台可视化查看封禁列表并一键解封
- **联系我们**：联系信息 + 留言表单（限流 + 校验）
- **站内搜索**：一次搜索项目、动态、文件
- 响应式布局、深浅色主题、移动端导航（默认遵循系统主题）

### 后台（登录后可用）
- **控制台**：数据概览、最近上传 / 留言 / 操作日志、运行环境、一键备份与无主文件清理
- **文件管理**：拖拽批量上传（带进度）、**添加第三方下载**（表单内可自定义上述全部字段，平台与图标按链接自动识别并提示、分类可一键新增）、**链接检测**（单个 / 批量，显示 HTTP 状态、跳转次数、真实终点）、编辑元数据、公开/私有切换、本地文件一键「转为外链」、置顶排序、单个与批量删除、存储占用统计
- **项目管理 / 动态管理**：新建、编辑、草稿、排序、封面选择、Markdown 正文
- **成员管理 / 留言管理**：成员增删改、留言状态流转（未读/已读/已回复/归档）
- **站点设置**：站点名称、标语、SEO、联系方式、平台链接、文件分类，以及修改登录密码

### 后端能力
- REST API（文件 / 项目 / 动态 / 成员 / 留言 / 设置 / 搜索 / 统计 / 备份）
- **文件来源双模式**：本站上传（落盘 + SHA256）与第三方外链（仅登记，跳转 302 并计数），接口、筛选、统计统一口径
- 文件上传：扩展名白名单 + 危险类型拦截、随机存储名、SHA256 校验、大小限制
- 安全：JWT 鉴权、`scrypt` 口令散列、登录与留言限流、helmet 安全头、操作审计日志
- 数据：SQLite（WAL 模式）+ 自动建表 + **老库自动补列迁移** + 幂等种子数据

### 运维工具（Python，默认零依赖）
- `healthcheck.py` 健康检查（API / 接口 / 文件 / 磁盘，可用于监控告警）
- `backup.py` 一致性备份（数据库快照 + 上传目录打包 + JSON 导出 + 保留策略）
- `upload_files.py` 批量上传（自动分类、去重、限速）
- `import_legacy.py` 旧站内容迁移（JSON → SQLite 或 API）
- `make_thumbnails.py` 图片缩略图生成与清理（可选 Pillow）

---

## 二、技术栈

| 层次 | 选型 | 说明 |
| --- | --- | --- |
| 前端 | Vue 3.5 + Vite 5 + TypeScript + Pinia + Vue Router 4 | Composition API，按路由懒加载 |
| 后端 | Node.js 22+ / Express 4 / multer | 纯 JS 依赖，**无原生模块、无需编译** |
| 数据库 | SQLite（`node:sqlite` 内置驱动，可选 better-sqlite3） | 单文件数据库，WAL 模式，免运维 |
| 文件存储 | 本地磁盘 `backend/data/uploads` | 元数据入库，缩略图可选 |
| 运维脚本 | Python 3（标准库） | 无需 pip 安装即可运行 |

> **为什么用 `node:sqlite`？** 宝塔/精简系统上编译 `better-sqlite3` 经常失败，
> 而 Node 22.5+ 内置了 SQLite 驱动，装完 Node 就能跑——这是本方案能在各种 Linux 变种上"一次装好"的关键。
> 代码里做了双驱动适配：如果服务器上装有 `better-sqlite3` 会自动优先使用。

---

## 三、目录结构

```
team-site/
├── frontend/                 # Vue 3 前端
│   ├── public/logo.png       # 站点 Logo（由 142121728.png 提供）
│   └── src/{api,components,composables,router,stores,utils,views}
├── backend/                  # Node.js 后端
│   ├── src/{app.js,server.js,config.js}
│   ├── src/db/{schema.sql,index.js,seed.js}
│   ├── src/middleware/{auth,upload,errors,anticc}.js
│   ├── src/routes/{auth,files,projects,news,members,messages,site}.js
│   ├── src/services/{storage,settings,linkcheck}.js
│   └── scripts/{init-db,seed,smoke-test,test-migration,stats}.js
├── tools/                    # Python 运维工具链
├── deploy/                   # 一键部署（宝塔 / systemd / init.d / Docker / 测试）
├── scripts/                  # setup.js（本地初始化）+ pack-release.mjs（发布打包）
├── .github/workflows/        # CI（测试）与 Release（自动发布）
├── docs/                     # 部署、API、架构、安全文档
├── backups/  backend/data/   # 运行期数据（已 gitignore）
└── package.json              # 根级便捷脚本
```

### 自动发布（GitHub Actions）

| 工作流 | 触发 | 内容 |
| --- | --- | --- |
| `.github/workflows/ci.yml` | push / PR / 手动 | 后端冒烟与老库升级测试、前端类型检查与构建、部署脚本自检、发布包校验 |
| `.github/workflows/release.yml` | 推送 `v*` tag / 手动 | 先跑测试 → 构建前端 → 打包（含 dist）→ 创建 Release 并附 tar.gz 与 sha256 |

```bash
# 发版：本地打 tag 推上去，Release 自动生成
git tag v1.0.1 && git push origin v1.0.1
# 或在 GitHub Actions 页面手动触发 Release 工作流（可填版本号/预发布）
```

---

## 四、本地开发

```bash
# 0) 环境要求：Node.js >= 22.5（必须，后端使用内置 node:sqlite）
node -v

# 1) 一键初始化（安装依赖 + 建库 + 写入初始内容）
npm run setup

# 2) 启动后端（默认 http://127.0.0.1:8787）
npm run dev:backend

# 3) 另开终端启动前端（默认 http://127.0.0.1:5173，已配置 /api 代理）
npm run dev:frontend
```

后台入口：<http://127.0.0.1:5173/admin/login>，默认账号 `admin` / `qlm@2019`
（可在 `backend/.env` 中修改；**登录后请立即更换密码**）。

### 生产构建与本地预览

```bash
npm run build          # 前端类型检查 + 构建到 frontend/dist
npm start              # 后端会直接托管 frontend/dist（单端口部署）
# 访问 http://127.0.0.1:8787/
```

### 测试与自检

```bash
npm run smoke             # 后端端到端冒烟测试（41 项：登录/上传/下载/外链/链接检测/权限/内容接口…）
npm run typecheck         # 前端 TypeScript 类型检查
npm run test:deploy       # 部署脚本自检（语法 + LF + shebang + 权限位）+ 部署库单元测试
npm run test:migration    # 老库升级测试（旧表结构 → 新版本自动补列，16 项）
npm run pack              # 生成远程发布包（统一 LF + 0755）
npm run pack:verify       # 校验发布包可执行性
npm run healthcheck       # 站点健康检查（需先启动后端）
npm run check-links       # 第三方下载链接体检（失效链接返回码 1）
```

---

## 五、部署（重点）

### 方式 A：宝塔面板一键部署（推荐）

```bash
# 在宝塔面板「终端」中执行（root 权限）
cd /www/wwwroot/team-site
bash deploy/bt-deploy.sh --domain team.example.com
```

> 脚本会自动修正 CRLF 换行、补齐可执行位（Windows/压缩包上传后的常见问题），
> 直接 `./deploy/install.sh` 或 `sh deploy/install.sh` 也都能正常运行。

### 方式 B：远程服务器一条命令部署

```bash
# 0) 先在本地（Windows/macOS/Linux 均可）打出发布包：自动统一 LF 换行 + 0755 权限
node scripts/pack-release.mjs            # 产物 release/team-site-<version>.tar.gz + .sha256
                                         # 版本号取自 package.json，当前为 1.1.0

# 1) 全新安装：上传 → 解压 → 宝塔原生部署（安装目录建议与面板站点目录同名）
scp release/team-site-1.1.0.tar.gz root@<服务器IP>:/tmp/
ssh root@<服务器IP> "mkdir -p /www/wwwroot/team.example.com && \
    tar -xzf /tmp/team-site-1.1.0.tar.gz -C /www/wwwroot/team.example.com && \
    bash /www/wwwroot/team.example.com/deploy/bt-deploy.sh --domain team.example.com"

# 2) 更新已有部署：push-deploy.sh 会校验 SHA256 → 备份 → 覆盖（保留线上 .env 与数据库）→ 更新
ssh root@<服务器IP> "bash /www/wwwroot/team.example.com/deploy/push-deploy.sh /tmp/team-site-1.1.0.tar.gz"
#   先空跑不落盘：加 --dry-run；只更新后端：加 --skip-build

# 或：服务器上直接跑引导脚本（支持 http 下载 / git 拉取 / SHA256 校验）
bash deploy/remote-install.sh --tarball https://your.cdn/team-site-1.1.0.tar.gz --domain team.example.com
bash deploy/remote-install.sh --git https://github.com/xxxx/xxxxx.git --branch main --domain team.example.com

# 或：一行命令（把 remote-install.sh 放到任意可访问地址）
curl -fsSL https://your.cdn/remote-install.sh | bash -s -- --tarball https://your.cdn/team-site-1.1.0.tar.gz

# 发布包自检（校验 0755 权限位、LF 换行、必需文件）；不带路径时按当前版本号找产物
node scripts/pack-release.mjs --verify
```

### 方式 C：通用 Linux 一键部署

```bash
sudo bash deploy/install.sh --domain team.example.com
```

支持 Debian / Ubuntu / CentOS / Rocky / Alma / Fedora / openEuler / openSUSE / Alpine / Arch 等，
会自动选择 `apt`、`dnf`、`yum`、`zypper`、`apk`、`pacman` 并处理 systemd 与 SysV 差异。

### 方式 D：Docker Compose

```bash
cd deploy/docker
DOMAIN=team.example.com docker compose up -d --build
```

### 方式 E：只部署到已有环境

```bash
bash deploy/install.sh --no-nginx --no-service --skip-build
# 然后自行把 frontend/dist 交给 nginx，把 backend 交给 pm2/宝塔 Node 项目
```

### 部署后运维

```bash
bash deploy/update.sh                              # 更新（自动先备份）
bash deploy/tests/check-syntax.sh                  # 脚本自检：语法 / LF / shebang / 权限位
python3 tools/healthcheck.py                       # 健康检查
python3 tools/backup.py --keep 14 --json           # 备份数据库与上传文件
python3 tools/check_links.py                       # 第三方下载链接体检（失效链接返回码 1）
bash deploy/uninstall.sh                           # 卸载（默认保留数据）
```

完整参数、HTTPS、备份恢复、故障排查见 **[docs/DEPLOY.md](docs/DEPLOY.md)**。

---

## 六、配置项（`backend/.env`）

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` / `HOST` | `8787` / `127.0.0.1` | 后端监听地址，生产建议只监听本机由 nginx 反代 |
| `JWT_SECRET` | 随机生成 | 部署脚本会写入随机值，**请勿使用默认占位值** |
| `JWT_EXPIRES_IN` | `7d` | 登录有效期 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `admin` / 随机 | 仅首次建库时用于创建管理员 |
| `DB_FILE` | `./data/team-site.db` | SQLite 数据库路径 |
| `UPLOAD_DIR` | `./data/uploads` | 上传目录（缩略图在其 `thumbnails/` 子目录） |
| `MAX_UPLOAD_SIZE` | `209715200`（200MB） | 单文件上限，需与 nginx `client_max_body_size` 一致 |
| `ALLOWED_ORIGINS` | 空（同源） | 前后端分域部署时填写允许的来源，逗号分隔 |
| `ALLOWED_EXTENSIONS` | 内置白名单 | 覆盖可上传扩展名（逗号分隔，不带点） |
| `PUBLIC_FILE_LIST` | `1` | 是否允许匿名浏览文件列表 |
| `TRUST_PROXY` | `1` | 反向代理层数 |

站点设置（后台可改，存于数据库）：`link_check_mode`（跳转前检测 / 仅手动）、`link_check_ttl`（结果缓存秒数）、
`link_check_timeout_ms`、`link_check_max_hops`、`link_check_concurrency`、`link_check_block`（不可达时是否拦截跳转）。

---

## 七、API 速览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| POST | `/api/auth/login` | 登录获取 Token |
| GET | `/api/files` | 文件列表（分类/类型/排序/来源/分页） |
| POST | `/api/files` | 上传文件（`multipart`，字段 `file`/`files`） |
| POST | `/api/files/external` | **新增第三方下载条目**（外链，不落盘） |
| POST | `/api/files/check-url` | **检测任意链接**（连通性 + 跳转链，不落库） |
| POST | `/api/files/:id/check` | **检测并记录单条外链** |
| POST | `/api/files/check-all` | **批量检测**（区分可达 / 疑似风控 / 失效） |
| GET | `/api/files/:id/download` | 下载（本站下发文件流；第三方先检测再 302 跳转，两者都计数） |
| GET | `/api/files/:id/preview` | 在线预览（图片/文本/PDF内联，外链跳转） |
| GET | `/api/projects` `/api/projects/:slug` | 项目列表与详情 |
| GET | `/api/news` `/api/news/:slug` | 动态列表与详情 |
| GET | `/api/members` | 团队成员 |
| POST | `/api/messages` | 提交留言（公开） |
| GET | `/api/site/settings` `/api/site/stats` `/api/site/search` | 设置/统计/搜索 |

完整接口（含后台写操作、参数与返回结构）见 **[docs/API.md](docs/API.md)**。

---

## 八、安全说明

- **防 CC**：nginx 限速限并发 + 应用层滑动窗口与自动封禁，详见 **[docs/SECURITY.md](docs/SECURITY.md)**
- 口令使用 `scrypt` 加盐散列存储，登录接口 10 分钟 20 次限流
- 上传做扩展名白名单 + 危险类型（php/jsp/asp/sh/html/svg 等）硬拦截
- 上传目录在 nginx 中显式禁止脚本执行与隐藏文件访问
- 可执行/压缩类文件强制 `Content-Disposition: attachment`，配合 `nosniff`
- 所有管理端操作记录审计日志（操作人、动作、目标、IP、时间）
- Markdown 渲染在前端转义后再解析，避免存储型 XSS
- 应急操作（压紧阈值、解封、保留证据）见 [docs/SECURITY.md](docs/SECURITY.md) 第五节

---

## 九、常见问题

**Q：为什么要求 Node ≥ 22.5？**
A：后端使用 Node 内置的 `node:sqlite`，无需编译原生模块，这是多发行版一键部署能成功的关键。
若你的环境已装好 `better-sqlite3`，更低版本 Node（≥18）也能运行。

**Q：上传大文件失败？**
A：同时调整 `.env` 的 `MAX_UPLOAD_SIZE` 与 nginx 的 `client_max_body_size`，然后重载服务。

**Q：图片列表加载慢？**
A：安装 Pillow 后执行 `python3 tools/make_thumbnails.py` 生成缩略图（缺失时前端自动回退原图）。

**Q：怎么迁移旧站内容？**
A：编辑 `tools/legacy-content.sample.json`，然后
`python3 tools/import_legacy.py 你的内容.json`（幂等，可重复执行；同时支持 `external_files` 批量导入第三方下载链接）。

**Q：第三方下载（网盘 / 平台外链）怎么加？**
A：后台 → 文件管理 → 「添加第三方下载」，填名称 + 链接即可；链接可以是任意地址，例如
`https://github.com/xxxx/xxxxx/releases`。平台名与图标会按链接自动识别，你也可以全部自己定：
图标（emoji 或图片地址）、按钮文案（如「去 Release 页」）、标签（官方/开源/MIT）、分类（可现场新增）、
置顶权重、是否新窗口打开、是否显示原链接、提取码、显示用大小，以及**任意附加字段**（`键=值` 多行或 JSON，
例如 `授权=MIT`、`校验=SHA256 …`）。

前台「文件下载」页会把它与本站文件一起展示，并用自定义按钮跳转到第三方页面，点击同样计入下载统计。
批量导入用 `tools/import_legacy.py` 的 `external_files` 字段（支持上述全部字段），
或直接调 `POST /api/files/external`。

**Q：宝塔面板里看不到这个站点？**
A：脚本写入的是 `/www/server/panel/vhost/nginx/*.conf`（等效于面板添加站点）。
若要在面板「网站」列表中管理，可在面板新建同名站点并指向 `frontend/dist`。

---

## 十、许可

MIT License · 团队内容与 Logo 版权归七零喵团队所有。
