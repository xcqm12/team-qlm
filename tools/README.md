# 七零喵团队站点 · Python 工具链

> 设计原则：**默认零第三方依赖**。除缩略图生成外，其余脚本只需系统自带的 `python3`（3.8+）即可运行，
> 因此在宝塔面板、CentOS 7、Ubuntu、Debian、Alpine 等环境都不需要 `pip install`。

## 工具一览

| 脚本 | 作用 | 依赖 |
| --- | --- | --- |
| `healthcheck.py` | 站点健康检查（API / 接口 / 文件 / 磁盘），可挂计划任务 | 标准库 |
| `backup.py` | 数据库一致性快照 + 上传目录打包 + JSON 导出 + 保留策略 | 标准库 |
| `upload_files.py` | 按目录批量上传文件，自动分类与去重 | 标准库 |
| `check_links.py` | 第三方下载链接体检（连通性 + 跳转链，区分风控与失效） | 标准库 |
| `anticc.py` | 防 CC 状态查看与解封（配合 nginx limit_req） | 标准库 |
| `import_legacy.py` | 从 JSON 导入项目/动态/成员/设置/**第三方下载链接**（旧站迁移） | 标准库 |
| `make_thumbnails.py` | 生成/清理图片缩略图 | `Pillow`（可选） |
| `qlm_common.py` | 公共库：读 `.env`、HTTP 客户端（含 multipart 上传）、SQLite 帮助 | 标准库 |

> **第三方下载**：`import_legacy.py` 的 `external_files` 段落用于批量登记网盘 / CurseForge / Modrinth 等外链，
> 写入 `files` 表并标记 `source=external`，前台与本站文件一起展示，点击「前往下载」经站内链接 302 跳转并计数。

## 快速开始

```bash
cd /www/wwwroot/team-site

# 1) 健康检查（返回码 0 正常 / 1 异常，方便接入监控）
python3 tools/healthcheck.py

# 2) 备份（默认写入 ./backups，保留最近 10 组）
python3 tools/backup.py --keep 14 --json

# 3) 批量上传发布包
python3 tools/upload_files.py ./releases --category 工具软件 --version v1.5.0 \
        --username admin --password '你的后台密码'

# 4) 从旧站迁移内容（含第三方下载链接）
python3 tools/import_legacy.py tools/legacy-content.sample.json --dry-run
python3 tools/import_legacy.py tools/legacy-content.sample.json

#    示例 JSON 中的 external_files 段落用于登记网盘/平台外链，字段全部可自定义：
#    { "original_name": "团队站点源码 · GitHub Releases",
#      "external_url": "https://github.com/xxxx/xxxxx/releases",   # 任意 http(s) 地址
#      "provider": "GitHub Releases", "provider_icon": "🐙", "button_label": "去 Release 页",
#      "tags": "官方,开源,MIT", "category": "第三方下载", "version": "v1.0.0",
#      "sort_order": 100, "open_in_new_tab": 1, "show_url": 1,
#      "access_code": "", "size_hint": "不定",
#      "extras": { "授权": "MIT", "附件数": "3" } }               # 也支持 "键=值" 多行文本
#    也支持 --mode api 远端导入（自动判重，已存在则更新）

# 5) 图片缩略图（可选）
pip3 install Pillow
python3 tools/make_thumbnails.py --check
python3 tools/make_thumbnails.py

# 6) 第三方下载链接体检（连通性 + 跳转链）
python3 tools/check_links.py             # 只检测缓存过期的
python3 tools/check_links.py --all       # 强制全部重新检测
python3 tools/check_links.py --json      # JSON 输出，便于接入告警
#   返回码：0 = 没有失效链接（风控类不计），1 = 存在失效链接

# 7) 防 CC 状态与解封
python3 tools/anticc.py                  # 查看封禁列表与累计拦截次数
python3 tools/anticc.py --unban 1.2.3.4  # 解封指定 IP
python3 tools/anticc.py --clear          # 清空全部封禁
```

## 宝塔计划任务建议

宝塔面板 → 计划任务 → Shell 脚本：

```bash
# 每天 03:10 备份
cd /www/wwwroot/team-site && /usr/bin/python3 tools/backup.py --keep 14

# 每 5 分钟健康检查，异常时写日志（可再配合告警）
cd /www/wwwroot/team-site && /usr/bin/python3 tools/healthcheck.py --quiet >> logs/healthcheck.log 2>&1

# 每天 09:00 第三方下载链接体检（失效链接返回码 1，可配合告警）
cd /www/wwwroot/team-site && /usr/bin/python3 tools/check_links.py >> logs/links.log 2>&1
```

## 环境变量

以下环境变量可覆盖默认行为（便于容器/CI 使用）：

| 变量 | 说明 | 默认 |
| --- | --- | --- |
| `QLM_API_BASE` | API 基地址 | 由 `backend/.env` 的 `HOST`/`PORT` 推导 |
| `QLM_USER` | 登录用户名 | `admin` |
| `QLM_PASSWORD` | 登录密码 | 空 |
| `NO_COLOR` | 设为任意值可关闭彩色输出 | 未设置 |

## 说明

- `make_thumbnails.py` 只影响列表页图片的加载速度：缩略图缺失时前端会自动回退到原图，功能不受影响。
- `import_legacy.py --mode sqlite` 直连数据库，建议在低峰期执行；`--mode api` 通过接口写入，可远端执行。
- `backup.py` 使用 SQLite 官方在线备份 API，因此**在后端运行中也能得到一致的备份**（WAL 模式安全）。
