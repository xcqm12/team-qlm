# 安全与防 CC 指南

本文覆盖：防 CC（两层限流）、上传安全、鉴权、审计、备份、被攻击时的应急操作。

---

## 一、防 CC 总体设计

```
攻击流量
   │
   ▼
① 宝塔防火墙 / Cloudflare（可选，最外层，清洗流量）
   │
   ▼
② nginx 限流层（deploy/nginx/team-site.conf，部署脚本自动写入）
     · limit_req_zone  $binary_remote_addr  zone=qlm_req      rate=15r/s
     · limit_conn_zone $binary_remote_addr  zone=qlm_conn     并发 20（API 10）
     · 触发后返回 JSON 429/503 + Retry-After（前端可直接提示）
   │
   ▼
③ 应用层（backend/src/middleware/anticc.js）
     · 单 IP 滑动窗口计数 → 超阈值自动封禁（默认 10 分钟）
     · 并发保护：全局 200 / 单 IP 16，超限快速失败，不排队堆积
     · 豁免：白名单 IP、携带有效 JWT 的请求、/uploads 静态资源
   │
   ▼
④ 业务级限流
     · 登录：每 IP 10 分钟 20 次（防爆破）
     · 留言：每 IP 1 小时 10 条（防灌水）
```

设计取舍：**nginx 挡洪峰，应用层做精细封禁**。nginx 层的 `limit_req` 在极端流量下最省资源；
应用层能识别"已登录用户"、能按窗口封禁并与后台可视化解封联动。

---

## 二、应用层防 CC 配置

优先级：**环境变量 > 后台「站点设置 → 防 CC」> 内置默认值**。
（环境变量最高，便于运维应急时强制压到某个阈值，后台改不动。）

| 环境变量 | 后台设置键 | 默认 | 说明 |
| --- | --- | --- | --- |
| `ANTICC_ENABLED` | `anticc_enabled` | `1` | 总开关 |
| `ANTICC_WINDOW_MS` | `anticc_window_ms` | `60000` | 统计窗口（毫秒） |
| `ANTICC_MAX_REQUESTS` | `anticc_max_requests` | `240` | 单 IP 每窗口请求上限，超出即封禁 |
| `ANTICC_BAN_SECONDS` | `anticc_ban_seconds` | `600` | 封禁时长（秒） |
| `ANTICC_MAX_CONCURRENT` | `anticc_max_concurrent` | `200` | 全局并发上限（超出 503） |
| `ANTICC_MAX_PER_IP` | `anticc_max_per_ip` | `16` | 单 IP 并发上限（超出 429） |
| `ANTICC_WHITELIST` | `anticc_whitelist` | 空 | 白名单 IP，逗号分隔，支持前缀（`10.0.`） |
| `ANTICC_SKIP_TOKEN` | `anticc_skip_token` | `1` | 已登录请求豁免（避免误伤后台/脚本） |

响应约定：

| 场景 | 状态码 | 响应头 | JSON |
| --- | --- | --- | --- |
| 触发频率封禁 | `429` | `Retry-After`、`X-CC-Protection: banned` | `{ success:false, message, retryAfter }` |
| 单 IP 并发超限 | `429` | `X-CC-Protection: too-many-concurrent` | 同上 |
| 全站并发过载 | `503` | `X-CC-Protection: busy` | `{ success:false, message:"服务器繁忙" }` |
| nginx 层限流 | `429`/`503` | `X-CC-Protection: nginx` | 由 `@too_many_requests` / `@server_busy` 返回 JSON |

### 三条"防误杀"设计（避免把自己锁在门外）

1. **登录接口不参与 CC 统计**：`POST /api/auth/login` 由独立的严格限流保护（10 分钟 20 次防爆破），
   但不被 CC 封禁影响 —— 否则管理员 IP 被封后连登录都做不到。
2. **登录成功的 IP 进入信任名单**（默认 30 分钟）：管理员/编辑登录一次后，其 IP 不会被限流与封禁。
3. **不需要 HTTP 的应急解封**：服务器上执行
   ```bash
   systemctl kill -s SIGUSR1 team-site      # 或 kill -USR1 <pid>
   ```
   立即清空所有封禁与信任记录（日志会记录次数），无需重启服务、也无需能访问接口。

> 三者叠加后，"自己被封死"这种情况基本不可能发生；即便发生，SIGUSR1 是最终保险。

### 调优建议

| 站点形态 | 建议值 |
| --- | --- |
| 纯展示站（访客浏览为主） | nginx `rate=10r/s`、应用上限 `120`/分钟 |
| 常规团队站（默认） | nginx `rate=15r/s`、应用上限 `240`/分钟 |
| 有批量下载/接口对接 | 把对接方 IP 加入 `ANTICC_WHITELIST`，或让其使用 Token（自动豁免） |
| 正在被 CC 攻击 | 临时把环境变量压到 `ANTICC_MAX_REQUESTS=60`、`ANTICC_BAN_SECONDS=3600`，并在宝塔/Cloudflare 开启加强防护 |

> **务必注意**：站点前面若有 Cloudflare / CDN / 宝塔反代，必须配置真实 IP 获取，
> 否则所有访客会被算成同一个 IP 而互相牵连。见下一节。

### CDN 后取真实客户端 IP（关键）

`deploy/nginx/team-site.conf` 顶部已给出注释模板，取消注释并补全网段即可：

```nginx
set_real_ip_from 173.245.48.0/20;      # Cloudflare 官方网段（按需补全）
real_ip_header CF-Connecting-IP;       # Cloudflare；宝塔反代用 X-Forwarded-For
real_ip_recursive on;
```

后端通过 `TRUST_PROXY=1`（`.env`）信任一层代理，`req.ip` 即为真实客户端 IP，
限流与封禁都以它为准。

---

## 三、查看状态与解封

### 后台（推荐）

后台 → 站点设置 → **防 CC**：实时显示跟踪 IP 数、封禁中数量、累计拦截/封禁次数、当前并发，
并可对单个 IP 或全部执行解封；控制台也会展示同样的统计。

### 接口

```bash
# 查看状态（需管理员 Token）
curl -s http://127.0.0.1:8787/api/site/anticc -H "Authorization: Bearer $TOKEN"

# 解封单个 IP
curl -s -X POST http://127.0.0.1:8787/api/site/anticc/unban \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"ip":"1.2.3.4"}'

# 清空全部封禁与计数
curl -s -X POST http://127.0.0.1:8787/api/site/anticc/unban \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"ip":""}'
```

### 命令行（服务器上，Python 标准库）

```bash
python3 tools/anticc.py                 # 查看状态（含封禁中的 IP 与剩余时间）
python3 tools/anticc.py --unban 1.2.3.4
python3 tools/anticc.py --clear
python3 tools/anticc.py --json          # 接监控
```

### 应急解封（连登录都被拦时）

```bash
# 不需要 HTTP、不需要 Token，立即清空全部封禁
systemctl kill -s SIGUSR1 team-site
tail -n 5 /www/wwwroot/12/logs/team-site.log   # 会看到 [anticc] 收到 SIGUSR1：已解封 N 个 IP
```

> 自己把自己封了怎么办？优先级：① 等封禁到期（默认 10 分钟）→ ② 登录一次（登录接口不受 CC 限制，
> 成功后该 IP 自动信任）→ ③ `SIGUSR1` 一键清空 → ④ 把出口 IP 加入 `ANTICC_WHITELIST`。

---

## 四、其他安全措施

| 面向 | 措施 | 位置 |
| --- | --- | --- |
| 口令 | scrypt + 16 字节随机盐，`timingSafeEqual` 比较 | `middleware/auth.js` |
| 会话 | JWT（默认 7 天），每次校验用户存在性 | `middleware/auth.js` |
| 暴力破解 | 登录 10 分钟 20 次；留言 1 小时 10 条 | `routes/auth.js`、`routes/messages.js` |
| 上传 | 扩展名白名单 + 危险类型硬拦截（php/jsp/sh/html/svg…）+ 随机存储名 + 大小/数量上限 | `middleware/upload.js`、`services/storage.js` |
| 上传目录 | nginx 层禁止脚本解析与隐藏文件访问；可执行/压缩类强制 `attachment` | `deploy/nginx/team-site.conf` |
| 响应头 | helmet（`nosniff`、`SAMEORIGIN`、`Referrer-Policy`…） | `src/app.js` |
| XSS | Markdown 先转义再解析；外链仅放行 `http(s)` | `frontend/src/utils/markdown.ts` |
| 外链安全 | 仅接受 `http(s)` 完整地址；跳转经站内中转并检测；`noopener noreferrer` | `services/linkcheck.js` |
| 审计 | 登录成功/失败、上传、删除、改密、设置变更、链接检测、解封等写 `audit_logs` | `middleware/auth.js` |
| 进程加固 | systemd `NoNewPrivileges`、`ProtectSystem=full`、`ReadWritePaths` 白名单、`MemoryMax=1G` | `deploy/systemd/team-site.service` |

---

## 五、被攻击时的应急步骤

1. **确认是 CC 还是带宽型攻击**
   `tail -f /www/wwwlogs/team-site.log`（看请求量）、`systemctl status team-site`（看内存/CPU）、
   后台控制台看「防 CC」统计与「操作日志」。
2. **压紧阈值**（立即生效，无需重启，二选一）：
   - 后台：站点设置 → 防 CC，把「单 IP 请求上限」调到 60、「封禁时长」调到 3600
   - 或 `.env` 加 `ANTICC_MAX_REQUESTS=60`、`ANTICC_BAN_SECONDS=3600` 后 `systemctl restart team-site`
3. **收紧 nginx**：把 `limit_req ... rate=15r/s` 改为 `5r/s`，`limit_conn qlm_conn 20` 改为 `10`，`nginx -s reload`
4. **开启外层防护**：宝塔面板 → 网站 → 该站点 → 防火墙/Nginx 防火墙；若有 Cloudflare，开启 "Under Attack Mode"
5. **放行自己**：把办公/家庭出口 IP 加入白名单，或使用管理员 Token（自动豁免）
6. **保留证据**：`python3 tools/backup.py --keep 0`（连同日志一起留档），必要时保留 nginx access log

---

## 六、定期检查清单

- [ ] 后台「站点设置」确认 `JWT_SECRET` 非默认值（部署脚本已随机生成）
- [ ] 已开启 HTTPS 并强制跳转，防火墙仅放行 80/443
- [ ] `python3 tools/healthcheck.py` 四项通过
- [ ] `python3 tools/check_links.py` 无失效外链（风控类不算）
- [ ] `python3 tools/anticc.py` 封禁列表符合预期（无长期误封）
- [ ] `python3 tools/backup.py --keep 14 --json` 已配置为计划任务，并异地留存
- [ ] 每月 `bash deploy/update.sh` 更新依赖（会先自动备份）
