# 更新日志

本项目遵循[语义化版本](https://semver.org/lang/zh-CN/)。发布包由 GitHub Actions 在推送 `v*` 标签时
自动测试、打包并创建 Release，产物为 `team-site-<版本>.tar.gz` 与 `.sha256`。

## [1.1.1] - 2026-09-12

安全加固版。修复一个**静默失效**的配置加载问题——它不会报任何错，但会让站点以公开默认密钥运行。

### 安全问题（重要）

- **`.env` 读不到时会静默回落到代码默认值，导致 JWT_SECRET 变成公开字符串。**
  `install.sh` 以 root 运行、生成 `backend/.env` 时设的是 `chmod 600`，属主仍是 `root`；
  而服务以 `www` 运行，`dotenv` 读不到文件**不会报错**，于是端口、上传上限、`JWT_SECRET`
  全部回落到代码内置默认值。后果是任何人都能用仓库里公开的默认密钥**伪造管理员令牌**，
  且站点看起来完全正常，没有任何迹象。
  - `install.sh` 现在把 `.env` 属主设为「服务运行用户」并保持 600（同时修好已存在的 .env）
  - 新增 `assertSecureConfig()`：生产环境若仍在用内置默认 `JWT_SECRET`，**服务拒绝启动**，
    并把原因、期望路径、修复命令直接打出来（不再"静默地不安全"）
  - 该断言放在 `server.js` 而不是 `config.js` 顶层，避免连带阻断
    `scripts/reset-password.js` 这类救场工具；临时排障可用 `ALLOW_INSECURE_JWT=1` 越过

### 修复

- **`/api/health` 被应用层防 CC 限流/封禁**：存活探针被拦后，`update.sh` 的部署会报
  "健康检查失败"、监控会误报宕机，而服务其实好着。已把 `/health` 加入防 CC 免统计名单
  （与 `/auth/login` 同理：探针必须永远可达）。
- **健康检查失败时没有可排查信息**：`wait_for_http` 现在记录最后一次的 HTTP 状态码与失败原因，
  `update.sh` 会打印目标 URL、诊断结论、以及"429 时如何用 SIGUSR1 清空封禁"的提示。

## [1.1.0] - 2026-09-12

「宝塔原生部署」版本。核心是**让自定义规则与宝塔面板和平共处**，并把部署/更新/排障做成可复现的脚本。

### 新增

- **宝塔原生部署 `deploy/bt-native.sh`**：站点主配置交回面板管理（保留 `#SSL-START` /
  `#error_page 404/404.html;` / `#REWRITE-START` / `#CERT-APPLY-CHECK` 等锚点），业务规则写入
  宝塔官方扩展目录 `vhost/nginx/extension/<域名>/`，防 CC 限流区写入 http 级 `0.qlm-anticc.conf`。
  自动对齐面板「站点路径 + 运行目录」与 nginx `root`，`nginx -t` 失败回滚，并做一次
  「写入 token → 请求回读 → 清理」的证书验证往返测试。
- **SSL 自动沿用与启用**：重写站点配置前先读出 `listen 443` 与证书路径，不再把面板刚签发的证书
  静默抹掉；新增 `--enable-ssl` / `--disable-ssl` / `--ssl-cert` / `--ssl-key`。
- **强制 HTTPS `--force-https`**：只对 `$scheme = http` 跳转并放行 `/.well-known/`，
  避免"HTTPS 被自己 301"的死循环，也避免 ACME 文件验证被重定向导致证书无法续签。
- **发布包部署 `deploy/push-deploy.sh`**：校验 SHA256 → 备份 → 解压覆盖（**强制排除
  `backend/.env` 与 `backend/data`**）→ 调用 `update.sh`。支持 `--dry-run` / `--skip-build` / `--slim`。
- **口令重置 `backend/scripts/reset-password.js`**：`node scripts/reset-password.js '新密码'`，
  不必再直接改数据库。
- **`deploy-to-server.ps1`**（工作区脚本）：Windows 上一条命令完成打包 → scp → 远程部署 → 验证。

### 修复

- **申请 SSL 报「站点配置文件中未找到标识信息【#error_page 404/404.html;】」**：
  自定义模板覆盖 vhost 时丢掉了面板锚点。
- **申请 SSL 报「配置文件被修改不支持文件验证」**：面板除锚点外还要求
  `location ~ \.well-known`（或在锚点前 include 面板的 `well-known/<域名>.conf` 并被
  `#CERT-APPLY-CHECK` 包裹），且证书验证文件写入路径必须等于 nginx `root`。
- **面板显示证书已签发但 https 打不开**：站点配置里没有 `listen 443 ssl` / `ssl_certificate`。
- **`bt-deploy.sh` 的 SSL 注入会破坏 ACME 续签**：原实现用 awk 注入并追加一个
  `return 301` 的 server 块，会把 `/.well-known/` 重定向走；现统一交给 `bt-native.sh`。
- **默认安装目录与面板站点目录不一致**：`install.sh` / `bt-deploy.sh` 在宝塔下的默认目录
  改为 `/www/wwwroot/<域名>`，避免重跑部署把服务注册到另一个目录而出现"两个目录各跑一份"。
- **登录页硬编码默认口令**：`install.sh` 会随机生成初始密码，登录页却提示固定口令，
  已在随机口令的部署上误导操作者；改为提示口令来源并给出重置命令。
- **版本号漂移**：后端 `config.version` 改为从根 `package.json` 读取，不再写死。

### 变更

- 站点配置目录约定：**systemd `WorkingDirectory`/`ExecStart`、nginx `root`、宝塔站点路径
  三者必须指向同一目录**；换目录请用 `bt-native.sh --app-dir`，不要用面板「文件」移动旧目录。

## [1.0.0] - 2026-09-12

首个版本。Vue 3 + Vite 前端、Express + `node:sqlite` 后端（零原生模块），
支持文件上传与展示、第三方下载外链（自定义展示字段）、跳转前连通性检测、
应用层与 nginx 双层防 CC、备份/健康检查/链接体检等 Python 运维工具，
以及适配 apt/dnf/yum/zypper/apk/pacman 的多发行版一键部署脚本。
