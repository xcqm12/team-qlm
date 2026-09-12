# 部署目录说明

本目录承载「一键部署」能力，支持普通 Linux 服务器与宝塔面板。

```
deploy/
├── install.sh            # 通用一键部署（推荐入口，自动识别发行版）
├── remote-install.sh     # 远程引导：下载/克隆 → 校验 → 修权限与换行 → 调用 install.sh
├── bt-deploy.sh          # 宝塔面板专用：写入 vhost、可选 HTTPS、日志切割
├── fix-bt-anchors.sh     # 修复宝塔 SSL 报错：给已有 vhost 补齐面板锚点注释
├── update.sh             # 更新：备份 → 依赖 → 迁移 → 重建 → 重启
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

## 宝塔面板兼容性（重要）

宝塔面板在给站点 **申请 SSL / 修改伪静态** 时，会在 vhost 配置里查找它约定的锚点注释：

```nginx
#SSL-START SSL相关配置，请勿删除或修改下一行带注释的404规则
#error_page 404/404.html;
#SSL-END
#ERROR-PAGE-START … #ERROR-PAGE-END
#REWRITE-START … include /www/server/panel/vhost/rewrite/<域名>.conf; … #REWRITE-END
```

缺少这些锚点时，面板会报：**「站点配置文件中未找到标识信息【#error_page 404/404.html;】，无法确定 SSL 配置添加位置」**。

本项目的 `nginx/team-site.conf` 模板已经内置这些锚点，并且 `install.sh` 会预先创建
`/www/server/panel/vhost/rewrite/<域名>.conf`（否则 `include` 会让 `nginx -t` 失败）。

**已经用旧模板部署过、现在面板报错的站点**，执行一次修复即可（幂等、带备份与校验回滚）：

```bash
bash deploy/fix-bt-anchors.sh --domain team.qlm.org.cn     # 按域名
bash deploy/fix-bt-anchors.sh --root   /www/wwwroot/team-site  # 按站点目录自动匹配
bash deploy/fix-bt-anchors.sh --check --domain team.qlm.org.cn # 只体检
```

修完后回到面板：网站 → 该站点 → 设置 → SSL → 申请证书并开启「强制 HTTPS」。

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
