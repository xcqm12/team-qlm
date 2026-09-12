# 更新日志

本项目遵循[语义化版本](https://semver.org/lang/zh-CN/)。发布包由 GitHub Actions 在推送 `v*` 标签时
自动测试、打包并创建 Release，产物为 `team-site-<版本>.tar.gz` 与 `.sha256`。

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
