# 部署指南

本文覆盖：宝塔面板一键部署、通用 Linux 部署、Docker 部署、HTTPS、备份恢复、更新卸载与故障排查。

- 部署脚本目录：[`deploy/`](../deploy/)（含 `README.md` 速查）
- 部署前自检：`bash deploy/tests/check-syntax.sh && bash deploy/tests/lib-test.sh`
- 环境体检（不做任何修改）：`bash deploy/bt-deploy.sh --check`

---

## 一、环境要求

| 项目 | 要求 | 说明 |
| --- | --- | --- |
| 操作系统 | Debian/Ubuntu、RHEL 系（CentOS/Rocky/Alma/Fedora/openEuler…）、openSUSE、Alpine、Arch | 由 `deploy/lib/detect-os.sh` 自动识别 |
| Node.js | **≥ 22.5**（后端使用内置 `node:sqlite`） | 脚本会自动安装/升级（5 级回退策略） |
| 内存 | ≥ 512 MB | 后端常驻内存约 60~100 MB |
| 磁盘 | ≥ 1 GB 可用 | 上传文件与备份另计 |
| 权限 | root（宝塔面板终端默认满足） | 安装 Node、写 nginx 配置、注册服务 |
| 其他 | curl / tar / rsync（可选）/ python3（可选） | 脚本自动安装 |

> 不需要 MySQL、Redis、Docker；数据库是单个 SQLite 文件，随站点数据目录一起备份即可。

---

## 二、宝塔面板部署（推荐）

### 步骤

1. **上传代码**到 `/www/wwwroot/<域名>`（推荐与面板「网站」里的站点目录同名，
   例如 `/www/wwwroot/team.example.com`）
   （面板「文件」→ 上传压缩包 → 解压，或用 Git 克隆）
2. 面板左侧「终端」中执行：

```bash
cd /www/wwwroot/team.example.com
bash deploy/bt-deploy.sh --domain team.example.com
```

3. 按提示查看输出：脚本会打印前台地址、后台地址、管理员账号密码。

> ⚠️ **部署目录一旦确定，不要再换，也不要用面板「文件」把旧目录删掉/移走。**
> systemd 单元、`bt-native.sh` 写入的 nginx `root`、宝塔站点路径三者必须指向同一个目录；
> 旧目录被移走后服务会起不来（502）。换目录请用 `bt-native.sh --app-dir`
> 让脚本同时更新三处，不要手工操作。

### 脚本做了什么

| 步骤 | 说明 |
| --- | --- |
| 1 | 探测宝塔环境：`/www/server/panel`、宝塔 Nginx、`/www/wwwlogs`、python3 |
| 2 | 安装 Node.js ≥ 22.5（已满足则跳过） |
| 3 | 安装后端依赖 `npm install --omit=optional`（不编译原生模块，几十秒完成） |
| 4 | 生成 `backend/.env`（随机 `JWT_SECRET`，端口自动避让占用） |
| 5 | 初始化 SQLite 数据库并写入站点初始内容 |
| 6 | 构建前端 `frontend/dist` |
| 7 | 注册并启动 `team-site` 服务（systemd，安全加固 + 内存上限 1G） |
| 8 | 调 `bt-native.sh` 写入**宝塔原生三层配置**并重载 Nginx（站点主配置 + extension 扩展规则 + http 级限流区） |
| 9 | 对齐面板「站点路径/运行目录」与 nginx `root`，做 ACME 证书验证往返测试 |
| 10 | 安装 `/etc/logrotate.d/team-site` 日志切割 |
| 11 | 打印宝塔「计划任务」推荐命令 |

> 第 8~9 步是**面板申请 SSL 能否成功的关键**，详见下方「面板报 SSL 相关错误怎么办」。

### 可选：直接启用 HTTPS

```bash
bash deploy/bt-deploy.sh --domain team.example.com \
  --ssl-cert /www/server/panel/vhost/cert/team.example.com/fullchain.pem \
  --ssl-key  /www/server/panel/vhost/cert/team.example.com/privkey.pem
```

更简单的做法：面板「网站 → 设置 → SSL → Let's Encrypt」申请证书并打开「强制 HTTPS」。

### 宝塔面板后续建议

```bash
# 计划任务（面板 → 计划任务 → Shell 脚本）

# 1) 每天 03:10 备份（数据库 + 上传文件 + JSON 导出，保留 14 组）
cd /www/wwwroot/team-site && /usr/bin/python3 tools/backup.py --keep 14 --json

# 2) 每 5 分钟健康检查（异常写日志，可配合告警插件）
cd /www/wwwroot/team-site && /usr/bin/python3 tools/healthcheck.py --quiet >> logs/healthcheck.log 2>&1

# 3) 每天 09:00 第三方下载链接体检（失效链接返回码 1，可配合告警）
cd /www/wwwroot/team-site && /usr/bin/python3 tools/check_links.py >> logs/links.log 2>&1
```

### 面板报 SSL 相关错误怎么办

宝塔申请证书时会做两类校验，**两种报错对应两个不同原因**：

| 面板报错 | 真正原因 |
| --- | --- |
| 未找到标识信息【`#error_page 404/404.html;`】，无法确定 SSL 配置添加位置 | vhost 里缺面板锚点注释（`#SSL-START` / `#error_page 404/404.html;` / `#REWRITE-START` …） |
| **配置文件被修改不支持文件验证**，请选择其他方式或还原配置文件 | 面板 `acme_v2.can_use_base_file_check()` 还要求配置里有 `location ~ \.well-known{`，或在其 `#error_page 404/404.html;` **之前** include 面板的 `well-known/<域名>.conf`（并被 `#CERT-APPLY-CHECK--START/END` 包裹）；此外证书验证文件写入路径 = **站点路径 + 运行目录**，必须与 nginx `root` 完全一致，否则文件写进去了但 URL 取不到 |
| 面板里证书显示已签发，但 **https 打不开**（443 拒绝连接） | 站点配置里没有 `listen 443 ssl` / `ssl_certificate`——证书文件在，只是没挂上（自定义模板整体覆盖配置时最常见） |

> 只补锚点能治好第一种报错，**治不好第二种**。第二种必须让面板承认「这是它自己管的配置」。

#### 正确做法：宝塔原生接法（推荐）

```bash
bash deploy/bt-native.sh --domain team.qlm.org.cn --app-dir /www/wwwroot/team.qlm.org.cn
bash deploy/bt-native.sh --domain team.qlm.org.cn --check           # 只体检
bash deploy/bt-native.sh --domain team.qlm.org.cn --no-align-path   # 不改面板站点路径
bash deploy/bt-native.sh --domain team.qlm.org.cn --enable-ssl      # 启用已签发的证书
bash deploy/bt-native.sh --domain team.qlm.org.cn --disable-ssl     # 关闭 443
bash deploy/bt-native.sh --domain team.qlm.org.cn --force-https     # 强制 HTTPS（80 → 443）
bash deploy/bt-native.sh --domain team.qlm.org.cn --no-force-https  # 取消强制 HTTPS
```

它把配置拆成**三层**，各归其位：

```
/www/server/panel/vhost/nginx/<域名>.conf                             ← 宝塔标准结构（锚点齐全，交回面板管理）
/www/server/panel/vhost/nginx/extension/<域名>/10-qlm-node-site.conf  ← 我们的规则：/api 反代、/uploads、SPA 回退、限流
/www/server/panel/vhost/nginx/0.qlm-anticc.conf                       ← http 级 limit_req_zone / limit_conn_zone
```

执行流程：

1. 按宝塔标准结构重写站点配置（保留全部锚点、`location ~ \.well-known` 与 `#CERT-APPLY-CHECK--START/END` 段）
2. **保留已启用的 SSL** —— 重写前先读出 `listen 443` / `ssl_certificate`，避免把面板刚签发的证书配置整体抹掉
3. 业务规则写入宝塔**官方扩展目录** —— 扩展文件里**不能写 `root`**，与站点配置重复会报 `"root" directive is duplicate`
4. 防 CC 的 `limit_req_zone` 只写在 http 级文件里 —— 站点配置里再声明同名 zone 会报 `is already bound`
5. 通过面板 API 把「站点路径 + 运行目录」对齐到 nginx `root`（**文件验证能通过的关键**）
6. `nginx -t` 失败自动回滚；成功后做「写入 token → 请求回读 → 清理」往返测试 + HTTPS 探活
7. 调用面板自身的 `can_use_base_file_check` / `can_use_if_for_file_check` 给出结论

**SSL 策略默认为 auto**：现有配置已启用 443 就沿用；没启用但
`/www/server/panel/vhost/cert/<域名>/{fullchain,privkey}.pem` 已存在，也会自动挂上。
面板里显示"证书已签发"却打不开 https，通常就是缺这一步。

**强制 HTTPS 同样默认 auto**，用 `--force-https` 开启。它只对 `$scheme = http` 跳转并放行
`/.well-known/`：站点块同时监听 80/443，不加 `$scheme` 判断会让 HTTPS 请求自己 301 自己
（死循环）；而全量 `return 301`（面板自带实现的做法）会把 ACME 文件验证重定向走，
导致证书永远无法自动续签。

**安装目录建议直接用 `/www/wwwroot/<域名>`**，与面板站点目录一致，文件验证路径与 nginx
`root` 天然对齐。更换目录时脚本会通过面板 API 同步站点路径与运行目录，无需手工改面板。

`bt-deploy.sh --domain <域名>` 已内置这套流程（内部为 `install.sh --no-nginx` + `bt-native.sh`），全新部署无需单独执行。

修完后回面板：**网站 → 该站点 → 设置 → SSL**。证书已挂上就直接开「强制 HTTPS」；
尚未申请则点 **Let's Encrypt → 申请证书**，之后 `--enable-ssl` 或面板开启。

#### 轻量兜底：只补齐锚点

如果只是缺锚点、不想动配置结构（幂等、自动备份、`nginx -t` 失败回滚）：

```bash
bash deploy/fix-bt-anchors.sh --domain team.qlm.org.cn           # 按域名修复
bash deploy/fix-bt-anchors.sh --root   /www/wwwroot/team-site    # 按站点目录自动匹配
bash deploy/fix-bt-anchors.sh --check  --domain team.qlm.org.cn  # 只体检不改动
```

补齐的锚点及作用：

| 锚点 | 作用 |
| --- | --- |
| `#SSL-START` … `#error_page 404/404.html;` … `#SSL-END` | 面板写入 SSL 证书配置的位置（**第一种报错就是缺这个**） |
| `#ERROR-PAGE-START/END` | 面板「错误页」设置写入位置 |
| `#PHP-INFO-START/END` | 面板 PHP 引用位置（本站为 Node，占位保留） |
| `#REWRITE-START/END`（含 include） | 面板「伪静态」写入位置，脚本会顺便创建被 include 的文件 |
| `location ~ \.well-known { allow all; }` | Let's Encrypt 域名验证目录，缺了会导致证书申请失败 |

### 忘记后台密码怎么办

`install.sh` 在未指定 `--password` 时会**随机生成**初始密码，只打印一次（不再像早期版本那样固定 `qlm@2019`）。
忘了用自带的 CLI 重置，不需要改库：

```bash
cd /www/wwwroot/<域名>/backend
node scripts/reset-password.js '新密码'          # 直接指定
node scripts/reset-password.js                   # 重置为 .env 里的 ADMIN_PASSWORD
node scripts/reset-password.js --username admin --password '新密码'
```

重置后请登录后台在「修改密码」中更换，并把 `backend/.env` 的 `ADMIN_PASSWORD` 同步成新值。

> 登录页**不再硬编码提示默认密码**（那会在随机口令的部署上误导操作者）。
> 若你希望整站用一个固定初始口令，部署时显式传入：
> `bash deploy/install.sh --domain x.com --password 'YourPass'`

#### 已实测结论（team.qlm.org.cn）

```
安装目录     : /www/wwwroot/team.qlm.org.cn      面板站点路径: 同左，运行目录 /frontend/dist
站点配置     : 有        SSL 锚点     : 有        ACME 验证块  : 有（#CERT-APPLY-CHECK）
443 监听     : 已启用    强制 HTTPS   : 已开启    证书         : .../cert/team.qlm.org.cn/fullchain.pem
基础文件验证 : 可用       if 文件验证 : 可用       PANEL_CHECK_RESULT: OK
验证文件可回读: OK（强制 HTTPS 下未被 301）        清理后状态码: 404（期望 404）
nginx: configuration file /www/server/nginx/conf/nginx.conf test is successful

公网实测：
  http://team.qlm.org.cn/   -> HTTP 301  Location: https://team.qlm.org.cn/
  跟随跳转                  -> HTTP 200  重定向 1 次（无死循环）
  https://team.qlm.org.cn/  -> HTTP 200  证书校验通过（ssl_verify_result=0），HSTS 已下发
  https://.../api/health    -> HTTP 200
```

- 安全 → 防火墙：只放行 80/443，后端 8787 端口无需对外
- 若要在面板「网站」列表里管理该站点：新建同名站点并指向 `frontend/dist`，或直接在面板中改反向代理

---

## 三、通用 Linux 部署
```bash
# 上传代码后（例如 /opt/team-site）
cd /opt/team-site
sudo bash deploy/install.sh --domain team.example.com
```

常见发行版实际执行差异：
| 发行版 | 包管理器 | Node 安装路径 | 服务方式 |
| --- | --- | --- | --- |
| Ubuntu / Debian | apt | NodeSource apt 源 | systemd |
| CentOS 7 | yum | NodeSource rpm 源 | systemd |
| Rocky / Alma / Fedora / openEuler | dnf（自动 `module enable nodejs:22`） | NodeSource rpm 源 | systemd |
| openSUSE / SLES | zypper | zypper / 官方 tar 包 | systemd |
| Alpine | apk | apk（≥22.5 时）否则 unofficial musl tar 包 | init.d + rc-update |
| Arch / Manjaro | pacman | pacman | systemd |

完全非交互（自动化/CI）：

```bash
NONINTERACTIVE=1 INSTALL_DIR=/opt/team-site DOMAIN=team.example.com \
  ADMIN_PASSWORD='StrongPass' bash deploy/install.sh --noninteractive
```

### 远程服务器部署（三种方式）

**为什么需要专门处理**：在 Windows 上直接压缩项目再上传，常出现两个问题——换行符变成 CRLF（`bad interpreter`）、
可执行位丢失（`Permission denied`）。下面三种方式都已规避这两点。

```bash
# 1) 本地打包（自动统一 LF 换行 + 给 *.sh/*.py 设置 0755 权限），并生成 sha256
node scripts/pack-release.mjs                 # → release/team-site-1.0.0.tar.gz (+ .sha256)
node scripts/pack-release.mjs --with-dist     # 连前端构建产物一起打包（服务器可 --skip-build 离线部署）
node scripts/pack-release.mjs --verify release/team-site-1.0.0.tar.gz   # 校验权限位与换行

# 2) 上传并在服务器执行
scp release/team-site-1.0.0.tar.gz root@<IP>:/tmp/
ssh root@<IP> "tar -xzf /tmp/team-site-1.0.0.tar.gz -C /www/wwwroot/ && \
    bash /www/wwwroot/team-site/deploy/install.sh --domain team.example.com --noninteractive"

# 3) 服务器上直接跑引导脚本（支持 http 下载 / git 拉取 / SHA256 校验 / 自动修权限与换行）
bash deploy/remote-install.sh --tarball https://your.cdn/team-site-1.0.0.tar.gz --domain team.example.com
bash deploy/remote-install.sh --tarball <URL> --sha256 <校验值> --domain team.example.com
bash deploy/remote-install.sh --git https://github.com/xxxx/xxxxx.git --branch main --domain team.example.com
bash deploy/remote-install.sh --local /tmp/team-site-1.0.0.tar.gz --dir /www/wwwroot/team-site

# 4) 一行命令（把 remote-install.sh 放到任意可访问地址，例如对象存储/CDN/Gist）
curl -fsSL https://your.cdn/remote-install.sh | bash -s -- \
  --tarball https://your.cdn/team-site-1.0.0.tar.gz --domain team.example.com --noninteractive
```

引导脚本会依次完成：下载 → SHA256 校验 → 解压 → **修正 CRLF 与可执行位** → 同步到安装目录 → 调用 `deploy/install.sh`。
它不依赖 `lib/*.sh`，所以可以被 `curl | bash` 管道执行。

**脚本自检**（服务器上随时可跑，检查语法 / LF / shebang / 权限位 / noexec 挂载）：

```bash
bash deploy/tests/check-syntax.sh     # 全部脚本体检
bash deploy/tests/lib-test.sh         # 部署库函数单元测试
```

> 若上传后仍提示 `Permission denied`，手工执行：`chmod +x deploy/*.sh deploy/lib/*.sh tools/*.py`
> 若提示 `bad interpreter: /usr/bin/env bash^M`，说明文件仍是 CRLF：
> `sed -i 's/\r$//' deploy/*.sh deploy/lib/*.sh`（install.sh 启动时也会自动修复）

### 参数表

| 参数 | 环境变量 | 默认 | 说明 |
| --- | --- | --- | --- |
| `--domain` | `DOMAIN` | `_` | 绑定域名，`_` 表示仅 IP 访问 |
| `--port` | `PORT` | 8787（占用则 +1） | 后端监听端口 |
| `--dir` | `INSTALL_DIR` | 宝塔 `/www/wwwroot/<域名>`（无域名时 `/www/wwwroot/team-site`），否则 `/opt/team-site` | 安装目录 |
| `--service` | `SERVICE_NAME` | `team-site` | 服务名 |
| `--username` | `ADMIN_USERNAME` | `admin` | 初始管理员 |
| `--password` | `ADMIN_PASSWORD` | 随机 | 初始密码，脚本会打印 |
| `--no-nginx` / `--no-service` | — | — | 跳过 nginx 配置 / 服务注册 |
| `--slim` | — | — | 构建后删除前端 `node_modules` |
| `--skip-build` | — | — | 跳过前端构建（使用已有 dist） |
| `--noninteractive` | `NONINTERACTIVE=1` | — | 全自动 |
| — | `MAX_UPLOAD_SIZE` | 209715200 | 单文件上限（字节），同时换算为 nginx 的 `client_max_body_size` |
| — | `NODE_BIN` | 自动探测 | 指定 Node 可执行文件路径 |
| — | `JWT_SECRET` | 随机生成 | 覆盖生成的密钥 |

---

## 四、Docker 部署

```bash
cd deploy/docker
HTTP_PORT=8080 DOMAIN=team.example.com JWT_SECRET=$(openssl rand -hex 32) \
  docker compose up -d --build

docker compose logs -f backend
docker compose exec backend node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>r.json()).then(console.log)"
```

- 数据持久化在命名卷 `team-site-data`（数据库 + 上传文件）
- 镜像基于 `node:22-alpine`，内置 Python3 便于在容器内跑运维脚本
- 备份：`docker compose exec backend python3 tools/backup.py --keep 7`
- 容器内时区已设为 `Asia/Shanghai`

---

## 五、部署后验证清单

```bash
# 1) 服务状态
systemctl status team-site            # 或 rc-service team-site status

# 2) 后端健康
curl -s http://127.0.0.1:8787/api/health

# 3) 站点自检（API / 接口 / 文件 / 磁盘）
python3 tools/healthcheck.py

# 4) 上传能力（用真实文件验证一遍）
python3 tools/upload_files.py ./frontend/public --category 图片素材 \
  --username admin --password '你的密码'

# 5) 第三方下载（外链）验证：新增 → 前台可见 → 跳转计数
curl -s -X POST http://127.0.0.1:8787/api/files/external \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"originalName":"测试外链","externalUrl":"https://www.curseforge.com/","sizeHint":"第三方平台"}'
curl -s "http://127.0.0.1:8787/api/files?source=external"      # 应包含该条目
curl -sI "http://127.0.0.1:8787/api/files/<上一步返回的id>/download" | head -n1   # 期望 302

# 6) 站点可访问
curl -I http://team.example.com/

# 7) 第三方下载链接体检（连通性 + 跳转链，失效链接返回码 1）
python3 tools/check_links.py --all
```

预期：健康检查四项全部通过；上传后前端「文件下载」页能看到文件并支持在线预览与下载；
第三方条目在「第三方下载」来源页签中显示，点击「前往下载」会先做连通性检测再跳转，且下载计数 +1。

---

## 六、HTTPS 与反向代理

脚本生成的 nginx 配置（`deploy/nginx/team-site.conf`）已经包含：

- 静态资源直接分发 + SPA 路由回退
- `/api` 与 `/uploads` 反向代理（`proxy_request_buffering off` 提升大文件上传体验）
- 上传目录禁止脚本解析（`php/jsp/asp/cgi/py/sh` 等一律 `deny`）与隐藏文件访问
- 安全响应头（`nosniff`、`SAMEORIGIN`、`Referrer-Policy`）
- gzip 压缩

手动开启 HTTPS 时的关键片段：

```nginx
listen 443 ssl http2;
ssl_certificate     /path/fullchain.pem;
ssl_certificate_key /path/privkey.pem;
ssl_protocols TLSv1.2 TLSv1.3;
add_header Strict-Transport-Security "max-age=31536000" always;
```

```nginx
server {                       # 80 跳转 443
    listen 80;
    server_name team.example.com;
    return 301 https://$host$request_uri;
}
```

---

## 七、备份与恢复

### 备份

```bash
python3 tools/backup.py --keep 14 --json
```

输出（默认 `backups/`）：

| 文件 | 内容 |
| --- | --- |
| `team-site-YYYYmmdd-HHMMSS.db` | 数据库一致性快照（SQLite 在线备份 API，**服务运行中安全**） |
| `uploads-YYYYmmdd-HHMMSS.tar.gz` | 上传目录整包 |
| `content-YYYYmmdd-HHMMSS.json` | 项目/动态/成员/文件/留言等内容的可读导出 |

后台「控制台 → 下载数据库备份」也可导出 SQL 文本，便于人工检查。

### 恢复

```bash
systemctl stop team-site
cd /www/wwwroot/team-site
cp backups/team-site-20260101-031000.db backend/data/team-site.db
rm -f backend/data/team-site.db-wal backend/data/team-site.db-shm
tar -xzf backups/uploads-20260101-031000.tar.gz -C backend/data/
chown -R www:www backend/data
systemctl start team-site
python3 tools/healthcheck.py
```

---

## 八、更新

```bash
bash deploy/update.sh              # 自动：备份 → 依赖 → 迁移 → 重建 → 重启 → 自检
bash deploy/update.sh --skip-build # 只更新后端
bash deploy/update.sh --backup-only
```

更新是幂等的：`scripts/init-db.js` 只补建缺失的表/列（例如第三方下载需要的
`files.source`/`external_url`/`provider`/`access_code`/`size_hint`，
以及重建统计视图），`scripts/seed.js` 不会覆盖已有内容，并会把「第三方下载」补进文件分类。

> 升级前建议先跑一次老库迁移测试（用真实的旧表结构复现升级过程）：
>
> ```bash
> cd backend && npm run test:migration     # 9 项断言：补列、索引、老数据保留、外链写入、幂等
> ```
>
> 本项目已修复"新索引写在 schema.sql 导致老库启动失败"的问题，该测试用于防止此类回归。

---

## 九、卸载

```bash
bash deploy/uninstall.sh                # 停服务、清 nginx 配置，保留数据
bash deploy/uninstall.sh --purge        # 连同数据一起彻底删除
bash deploy/uninstall.sh --yes --purge  # 全自动
```

卸载前会自动备份（除非 `--purge`），nginx 原配置保留为 `.bak.<时间戳>`。

---

## 十、故障排查

| 现象 | 排查与解决 |
| --- | --- |
| 安装时提示 Node 版本过低 | 脚本会自动升级；若网络受限，可手动安装 Node ≥ 22.5 后加 `--skip-build` 重跑，或用 `NODE_BIN=/path/to/node` |
| `npm install` 卡住/超时 | `npm config set registry https://registry.npmmirror.com` 后重跑 |
| 服务起不来 | `journalctl -u team-site -n 80 --no-pager` 与 `logs/team-site.error.log` |
| 502 Bad Gateway | 后端没起来或端口不符：`curl 127.0.0.1:8787/api/health`，检查 `.env` 的 `PORT` 与 nginx 配置是否一致 |
| 上传 413 | 同时调大 `.env` 的 `MAX_UPLOAD_SIZE` 与 nginx `client_max_body_size`，重载服务 |
| 上传成功但前台看不到 | 该文件可能是「私有」，在后台文件管理中改为公开 |
| 中文文件名乱码 | 现代浏览器按 UTF-8 处理，正常；下载时会还原原始文件名 |
| 前端刷新 404 | nginx 缺少 SPA 回退：`try_files $uri $uri/ /index.html;` |
| 无法登录后台 | 忘记密码时执行 `cd backend && node -e "import('./src/middleware/auth.js').then(async m=>{const {run}=await import('./src/db/index.js');run('UPDATE users SET password_hash=? WHERE username=?',[m.hashPassword('新密码'),'admin']);console.log('done')})"` |
| 磁盘被上传文件占满 | 后台「控制台 → 清理无主文件」，或 `python3 tools/make_thumbnails.py --clean`，并清理 `backups/` |
| 部署脚本报错想回滚 | 脚本只在 `nginx -t` 通过后才重载；HTTPS 注入失败会自动回滚到 `.bak` 文件 |

排查通用入口：`python3 tools/healthcheck.py`（会一次性检查 API、接口、文件、磁盘）。

---

## 十一、安全加固清单

- [ ] 修改后台默认密码（后台 → 站点设置 → 修改登录密码）
- [ ] 确认 `backend/.env` 中 `JWT_SECRET` 是随机值（部署脚本已生成，权限 600）
- [ ] 开启 HTTPS 并强制跳转
- [ ] 防火墙只放行 80/443
- [ ] 后台账号仅在必要时使用，定期查看「操作日志」
- [ ] 定期备份并把 `backups/` 同步到异地（对象存储 / 另一台机器）
- [ ] 关注 Node.js 安全更新：`bash deploy/update.sh` 前先备份
