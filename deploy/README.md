# 部署目录说明

本目录承载「一键部署」能力，支持普通 Linux 服务器与宝塔面板。

```
deploy/
├── install.sh            # 通用一键部署（推荐入口，自动识别发行版）
├── remote-install.sh     # 远程引导：下载/克隆 → 校验 → 修权限与换行 → 调用 install.sh
├── bt-deploy.sh          # 宝塔面板专用：安装 → 调 bt-native.sh 落配置 → 可选 HTTPS、日志切割
├── bt-native.sh          # 宝塔原生部署：站点主配置交回面板 + extension 扩展规则 + http 级限流区，修复申请 SSL 报错
├── fix-bt-anchors.sh     # 轻量兜底：只给已有 vhost 补齐面板锚点注释
├── update.sh             # 更新：备份 → 依赖 → 迁移 → 重建 → 重启 → 自检
├── push-deploy.sh        # 发布包部署：校验 SHA256 → 备份 → 解压覆盖（排除 .env/data）→ 调 update.sh
├── uninstall.sh          # 卸载：停服务 → 清 nginx → 可选删数据
├── lib/
│   ├── common.sh         # 日志、交互、模板渲染、脚本自愈（CRLF/权限/noexec）
│   ├── detect-os.sh      # 发行版/包管理器/服务管理器探测（核心适配层）
│   └── install-node.sh   # Node.js >= 22.5 自动安装（5 级回退策略）
├── systemd/              # systemd 服务模板（端口由 .env 决定，不在此硬编码）
├── initd/                # SysV init 模板（无 systemd 的系统，如 Alpine）
├── nginx/                # nginx 站点模板（宝塔锚点 + 防 CC + 上传目录防执行）
├── docker/               # Dockerfile + compose + 容器版 nginx
├── bt-plugin/            # 宝塔插件式入口（info.json + install/uninstall）
└── tests/                # 脚本自检：语法 / LF / shebang / 权限位 + 库函数单元测试
```

## 部署与更新流程

分两个脚本，各管一半：

| 脚本 | 在哪跑 | 干什么 |
| --- | --- | --- |
| `scripts/pack-release.mjs` | **本地** | 打包发布包：强制 LF 换行、`*.sh`/`*.py` 置 0755、排除 `node_modules`/`dist`/`data`/`logs`/`.git` |
| `deploy/push-deploy.sh` | **服务器** | 校验 SHA256 → 备份 → 解压覆盖（**排除 `.env` 与 `data`**）→ 调 `update.sh` |
| `deploy/update.sh` | **服务器** | 备份 → 装依赖 → 数据库迁移 → 重建前端 → 重启服务 → 健康检查 |

### 标准用法

```bash
# 1) 本地打包
node scripts/pack-release.mjs

# 2) 上传
scp release/team-site-1.0.0.tar.gz <用户>@<服务器>:/tmp/

# 3) 服务器上覆盖更新（安装目录 = push-deploy.sh 的上一级，无需额外传路径）
bash /www/wwwroot/<域名>/deploy/push-deploy.sh /tmp/team-site-1.0.0.tar.gz

# 常用开关
#   --dry-run     只校验 + 预览会覆盖哪些文件，不落盘、不重启
#   --skip-build  只更新后端
#   --slim        构建后清理前端 node_modules
```

> Windows 上可以一条命令完成（打包 → scp → 远程部署 → 验证）：
> `powershell -ExecutionPolicy Bypass -File F:\tuandui\deploy-to-server.ps1`
> 加 `-DryRun` 可先空跑。

### 为什么解压时要排除 `.env` 与 `data`

线上运行状态（端口 / `JWT_SECRET` / 管理员口令 / 数据库 / 上传文件）**永远以服务器为准**。
若把本地配置或空数据库覆盖上去，会出现"改端口不生效""登录密码莫名其妙变了""文件全没了"。
`push-deploy.sh` 里对 tar 显式加了 `--exclude`，属于硬性保护。

### 目录一致性（务必遵守）

systemd 单元、nginx `root`、宝塔「站点路径」三者**必须指向同一个安装目录**：

```
systemd WorkingDirectory / ExecStart  →  /www/wwwroot/<域名>/backend
nginx root                            →  /www/wwwroot/<域名>/frontend/dist
宝塔「网站 → 站点路径 + 运行目录」      →  /www/wwwroot/<域名> + /frontend/dist
```

`install.sh` / `bt-deploy.sh` 在宝塔环境下的默认安装目录就是 `/www/wwwroot/<域名>`，
与面板站点目录天然一致。要换目录请用 `bt-native.sh --app-dir <新目录>` 让脚本同时更新三处，
**不要**用面板「文件」去移动或删除旧目录 —— 服务会起不来（502）。

全新安装（目录还不存在）时：

```bash
mkdir -p /www/wwwroot/<域名>
tar -xzf /tmp/team-site-1.0.0.tar.gz -C /www/wwwroot/<域名>
bash /www/wwwroot/<域名>/deploy/bt-deploy.sh --domain <域名>
```

## 宝塔面板兼容性（重要）

宝塔面板对站点配置有**自己的校验规则**，直接用自定义 nginx 模板覆盖 `vhost/nginx/<域名>.conf` 会踩两个坑：

| 现象 | 原因 |
| --- | --- |
| 申请 SSL 报「未找到标识信息【#error_page 404/404.html;】」 | 缺少面板锚点注释（`#SSL-START` / `#error_page 404/404.html;` / `#REWRITE-START`） |
| 补上锚点后仍报「配置文件被修改不支持文件验证」 | 面板 `acme_v2.can_use_base_file_check()` 还要求配置里有 `location ~ \.well-known{`，或在其 `#error_page 404/404.html;` **之前** include 面板的 `well-known/<域名>.conf`；且证书验证文件写入位置（**站点路径 + 运行目录**）必须与 nginx `root` 一致 |

### 正确做法：宝塔原生接法（`deploy/bt-native.sh`）

```
/www/server/panel/vhost/nginx/<域名>.conf                        ← 宝塔标准结构（含锚点，交回面板管理）
/www/server/panel/vhost/nginx/extension/<域名>/10-qlm-node-site.conf ← 我们的规则：/api 反代、/uploads、SPA 回退、限流
/www/server/panel/vhost/nginx/0.qlm-anticc.conf                  ← http 级 limit_req_zone / limit_conn_zone
```

`bt-deploy.sh --domain <域名>` 会自动走这套流程（内部调用 `install.sh --no-nginx` + `bt-native.sh`），它会：

1. 按宝塔标准结构重写站点配置（保留全部锚点与 `#CERT-APPLY-CHECK` 段，供面板 SSL / 伪静态 / 错误页使用）
2. **保留已启用的 SSL**：重写前先读出 `listen 443`、证书路径等，否则面板刚签发的证书会被静默抹掉
3. 把 Node 业务规则写入宝塔官方扩展目录（**注意不能写 `root`**，与站点配置重复会报 `root directive is duplicate`）
4. 把防 CC 的 `limit_req_zone` 写入 http 级文件（**站点配置里不能再声明同名 zone**，否则报 `already bound`）
5. 通过面板 API 对齐「站点路径 + 运行目录」与 nginx `root`（这是文件验证能通过的关键）
6. `nginx -t` 失败自动回滚；成功后做一次「写入 token → 请求 → 清理」的证书验证往返测试 + HTTPS 探活
7. 调用面板自身的 `can_use_base_file_check` / `can_use_if_for_file_check` 给出结论

```bash
bash deploy/bt-native.sh --domain team.qlm.org.cn --app-dir /www/wwwroot/team.qlm.org.cn
bash deploy/bt-native.sh --domain team.qlm.org.cn --check           # 只体检（含面板检查）
bash deploy/bt-native.sh --domain team.qlm.org.cn --no-align-path   # 不改面板站点路径
bash deploy/bt-native.sh --domain team.qlm.org.cn --enable-ssl      # 启用已签发的证书（宝塔标准路径）
bash deploy/bt-native.sh --domain team.qlm.org.cn --disable-ssl     # 关闭 443 监听
bash deploy/bt-native.sh --domain team.qlm.org.cn --force-https     # 强制 HTTPS（80 → 443）
bash deploy/bt-native.sh --domain team.qlm.org.cn --no-force-https  # 取消强制 HTTPS
bash deploy/bt-native.sh --domain team.qlm.org.cn \
  --ssl-cert /path/fullchain.pem --ssl-key /path/privkey.pem        # 指定证书路径
```

> **推荐安装目录就用 `/www/wwwroot/<域名>`**：与面板「网站」列表里的站点目录一致，
> 面板的文件验证路径与 nginx `root` 天然对齐，少一层搬弄。
> 换目录时 `bt-native.sh` 会通过面板 API 同步更新站点路径与运行目录。

> **SSL 与强制 HTTPS 默认都是「自动」**：现有配置已启用就沿用；没启用但
> `/www/server/panel/vhost/cert/<域名>/{fullchain,privkey}.pem` 已存在，也会自动挂上
> （证书已签发却没生效，是漏了这一步最常见的表现）。
> 重写配置**不会**抹掉面板签发的证书，续签所需的 `#CERT-APPLY-CHECK` 段也会保留。

> **强制 HTTPS 的写法**：只对 `$scheme = http` 跳转，并放行 `/.well-known/`。
> 站点块同时监听 80/443，若不加 `$scheme` 判断，HTTPS 请求会被自己 301 成 HTTPS ——
> 死循环；不问青红皂白地全量 `return 301`（面板自带实现的做法）则会让 ACME
> 文件验证被重定向走，证书永远续不上。

> 若是**已经用旧模板部署过**的站点（现在面板报错），直接跑一次 `bt-native.sh` 即可修复；
> 仅想补齐锚点而不改结构时，也可用轻量工具 `bash deploy/fix-bt-anchors.sh --domain <域名>`。

修完后回面板：**网站 → 该站点 → 设置 → SSL**。证书已挂上时直接开「强制 HTTPS」即可；
还没申请就点 **Let's Encrypt → 申请证书**，随后 `--enable-ssl` 或面板上开启。

> 配套的发布打包器在仓库根目录：`node scripts/pack-release.mjs`（生成带 0755 权限与 LF 换行的 tar.gz，
> 并提供 `--verify` 自检），远程部署用它会省去换行与权限的坑。

## 最短路径

```bash
# 通用 Linux（Debian/Ubuntu/CentOS/Rocky/Alma/Fedora/openEuler/Alpine/openSUSE/Arch…）
sudo bash deploy/install.sh --domain team.example.com
./deploy/install.sh --domain team.example.com     # 有可执行位时可直接执行
sh deploy/install.sh --domain team.example.com    # 用 sh 调用也会自动切到 bash

# 远程服务器（先打包再上传，或让服务器自己拉取）
node scripts/pack-release.mjs                     # 本地打包
scp release/team-site-1.0.0.tar.gz root@IP:/tmp/  # 上传
ssh root@IP "tar -xzf /tmp/team-site-1.0.0.tar.gz -C /www/wwwroot/ && \
    bash /www/wwwroot/team-site/deploy/install.sh --domain team.example.com"
bash deploy/remote-install.sh --tarball <发布包URL> --domain team.example.com   # 或服务器直接引导

# 宝塔面板
bash deploy/bt-deploy.sh --domain team.example.com

# 仅体检部署环境，不做任何修改
bash deploy/bt-deploy.sh --check
bash deploy/tests/check-syntax.sh && bash deploy/tests/lib-test.sh
```

## 支持的发行版

所有需要安装的软件（Node.js、curl、rsync 等）都由脚本按发行版自动选择安装方式：

| 家族 | 发行版示例 | 包管理器 | 服务管理 |
| --- | --- | --- | --- |
| debian | Debian 10-12、Ubuntu 18.04-24.04、Deepin、UOS、麒麟、Raspbian | apt | systemd |
| rhel | CentOS 7/8、Rocky、AlmaLinux、Fedora、Oracle Linux、Anolis、openEuler、Amazon Linux | dnf / yum | systemd |
| suse | openSUSE Leap、SLES | zypper | systemd |
| alpine | Alpine 3.17+ | apk | OpenRC（自动改用 init.d 模板） |
| arch | Arch、Manjaro、EndeavourOS | pacman | systemd |

Node.js 安装采用 5 级回退，任一环节成功即继续：
环境变量 `NODE_BIN` → 系统已有且版本达标 → NodeSource 官方源 → 发行版仓库 → Node 官方预编译包（Alpine 用 musl 版）。

> 后端使用 Node.js **内置** `node:sqlite`，所以**不需要**编译任何原生模块，
> 也不需要安装 MySQL/Redis，这一点让它在各种精简系统上都能装成功。

## 主要参数

```bash
bash deploy/install.sh \
  --domain team.example.com \   # 绑定域名（默认 _ 仅 IP 访问）
  --port 8787 \                 # 后端端口（被占用自动 +1）
  --dir /www/wwwroot/team-site \# 安装目录（宝塔默认路径）
  --service team-site \         # 服务名
  --username admin \            # 初始管理员
  --password 'StrongPass' \     # 初始密码（不填则随机生成并打印）
  --no-nginx --no-service \     # 跳过 nginx / 跳过服务注册
  --slim --skip-build \         # 构建后清理前端依赖 / 跳过前端构建
  --noninteractive              # 全自动，无交互
```

## 部署后目录

```
<安装目录>/
├── frontend/dist/            # 前端静态产物（由 nginx 直接分发）
├── backend/data/team-site.db # SQLite 数据库
├── backend/data/uploads/     # 上传的文件与缩略图
├── backend/.env              # 配置（含随机 JWT 密钥，权限 600）
├── logs/                     # 运行日志
└── backups/                  # 备份输出（tools/backup.py）
```

详细步骤、HTTPS、备份恢复与故障排查见 [`../docs/DEPLOY.md`](../docs/DEPLOY.md)。
