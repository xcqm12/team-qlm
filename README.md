# 七零喵团队 V2 · 官网系统

一个基于 **PHP + MySQL** 的团队官网系统，提供项目展示、新闻动态、团队成员、平台链接、文件管理和后台运营能力。

- 前台风格：可爱主题、响应式布局
- 后台能力：项目 / 新闻 / 成员 / 文件 / 导航 / 站点设置管理
- 配置策略：仓库保留模板配置，真实数据库凭据写入本地私有配置

## 功能概览

- 🎨 现代化前台界面与响应式布局
- 📦 项目作品展示，支持分类、详情、下载链接
- 📰 新闻动态发布与浏览统计
- 👥 团队成员介绍与排序管理
- 🔗 外部平台链接管理
- 📎 后台文件上传与下载次数统计
- 🧭 自定义导航菜单
- ⚙️ 站点设置集中管理（Logo、Banner、SEO、联系方式等）
- 🔐 管理员登录与角色权限区分
- 🚀 浏览器安装向导，自动初始化数据库

## 运行环境

| 组件 | 最低要求 | 推荐版本 |
| --- | --- | --- |
| PHP | 7.3+ | 7.4 / 8.1 / 8.2 / 8.3 |
| MySQL | 5.6+ | 5.7 / 8.0 |
| Web Server | Apache / Nginx / IIS | Nginx 1.18+ 或 Apache 2.4+ |
| PHP 扩展 | `PDO`、`pdo_mysql` | `mbstring`、`fileinfo`、`openssl` |

> 当前安装向导会检查 `PHP >= 7.3` 和 `pdo_mysql` 扩展。

## 快速开始

### 1. 部署代码

将项目上传到网站根目录或子目录，例如：

```text
/www/wwwroot/team.qlm.org.cn/
├── index.php
├── install.php
├── config/
├── core/
├── admin/
└── ...
```

### 2. 确保目录可写

安装前请确认以下位置可写：

- `config/`：安装时会在此生成 `config/config.local.php`
- `uploads/`：后台上传文件使用
- 项目根目录：安装完成后会生成 `installed.lock`

Linux 常见权限建议：

- 目录：`755`
- 文件：`644`
- 如果宿主环境限制较严，可按面板或容器规则额外调整

### 3. 创建数据库

可手动创建数据库，也可以让安装向导使用已有账号自动建库。示例：

```sql
CREATE DATABASE IF NOT EXISTS qiling_team
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
```

### 4. 运行安装向导

浏览器访问：

```text
http://你的域名/install.php
```

安装流程会完成以下工作：

1. 检查 PHP 版本与扩展
2. 测试数据库连接
3. 初始化数据表与默认数据
4. 写入本地私有配置 `config/config.local.php`
5. 生成 `installed.lock`，防止重复安装

### 5. 登录后台

- 后台入口：`admin/login.php`
- 默认管理员用户名：`admin`
- 管理员密码：**由安装时手动设置，不在仓库中提供默认弱口令**

## 配置说明

项目当前采用 **模板配置 + 本地私有覆盖** 的方式，避免将真实凭据提交到仓库。

| 文件 | 作用 |
| --- | --- |
| `config/config.php` | 仓库内模板配置，包含默认值、路径常量、运行参数 |
| `config/config.local.php` | 安装后生成的本地私有配置，保存真实数据库连接信息 |
| `config/config.local.example.php` | 本地配置示例文件，可用于手动部署参考 |

说明：

- `config/config.local.php` 已被 `.gitignore` 忽略
- 请只在服务器本地保存真实数据库密码
- 生产环境建议保持 `DEBUG = false`

## 目录结构

```text
team-qlm/
├── admin/                     # 后台管理页面
│   ├── login.php              # 后台登录
│   ├── index.php              # 仪表盘
│   ├── projects.php           # 项目管理
│   ├── project-edit.php       # 项目编辑
│   ├── news.php               # 新闻管理
│   ├── news-edit.php          # 新闻编辑
│   ├── members.php            # 成员管理
│   ├── platforms.php          # 平台链接管理
│   ├── navigation.php         # 导航菜单管理
│   ├── files.php              # 文件管理
│   ├── settings.php           # 站点设置
│   ├── users.php              # 管理员用户管理
│   ├── user-edit.php          # 用户编辑
│   ├── admin-header.php       # 后台头部模板
│   ├── admin-footer.php       # 后台底部模板
│   └── admin.css              # 后台样式
├── assets/
│   ├── css/
│   │   ├── main.css           # 前台主样式
│   │   └── theme.css          # 主题样式
│   └── js/
│       └── main.js            # 前台交互脚本
├── config/
│   ├── config.php             # 模板配置
│   └── config.local.example.php
├── core/
│   ├── Auth.php               # 认证逻辑
│   ├── Db.php                 # PDO 数据访问
│   └── View.php               # 视图辅助
├── includes/
│   └── bootstrap.php          # 全局引导
├── sql/
│   ├── install.sql            # 初始化建表与默认数据
│   └── team_data.sql          # 团队历史与演示数据
├── uploads/
│   └── index.html             # 防止目录浏览
├── views/layouts/
│   ├── header.php
│   ├── nav.php
│   └── footer.php
├── about.php                  # 关于我们
├── contact.php                # 联系我们
├── download.php               # 公共下载处理与计数
├── index.php                  # 前台首页
├── install.php                # 安装向导
├── news.php                   # 新闻列表
├── news-detail.php            # 新闻详情
├── project-detail.php         # 项目详情
├── projects.php               # 项目列表
├── cae2.2.php                 # 仓库附带的独立页面
└── README.md
```

## 页面入口

### 前台页面

| 页面 | 路径 | 说明 |
| --- | --- | --- |
| 首页 | `index.php` | 首页横幅、精选项目、最新新闻 |
| 关于我们 | `about.php` | 团队介绍与成员展示 |
| 项目列表 | `projects.php` | 项目分页与分类筛选 |
| 项目详情 | `project-detail.php?id=ID` | 项目介绍与下载信息 |
| 新闻列表 | `news.php` | 新闻列表 |
| 新闻详情 | `news-detail.php?id=ID` | 新闻正文与浏览量统计 |
| 联系我们 | `contact.php` | 联系方式与团队信息 |
| 下载处理 | `download.php?id=ID` | 文件下载与下载次数累加 |
| 安装向导 | `install.php` | 首次部署时使用 |

> 说明：当前仓库中公共下载处理为 `download.php`。如果你需要单独的“文件下载中心”前台页面，可根据 `navigation` 表和业务需求自行补充入口页。

### 后台页面

| 页面 | 路径 | 说明 |
| --- | --- | --- |
| 登录 | `admin/login.php` | 管理员登录 |
| 仪表盘 | `admin/index.php` | 统计概览与快捷入口 |
| 项目管理 | `admin/projects.php` | 项目增删改查 |
| 新闻管理 | `admin/news.php` | 新闻列表与编辑入口 |
| 成员管理 | `admin/members.php` | 团队成员维护 |
| 平台管理 | `admin/platforms.php` | 发布平台链接维护 |
| 导航管理 | `admin/navigation.php` | 前台导航维护 |
| 文件管理 | `admin/files.php` | 文件上传、外链、下载统计 |
| 站点设置 | `admin/settings.php` | Logo、Banner、SEO、联系方式等 |
| 用户管理 | `admin/users.php` | 管理员用户维护 |

## 核心数据表

| 表名 | 用途 |
| --- | --- |
| `admin_users` | 后台管理员账号 |
| `team_info` | 团队信息、站点配置、Banner、SEO |
| `projects` | 项目作品 |
| `news` | 新闻动态 |
| `team_members` | 团队成员 |
| `platform_links` | 外部平台链接 |
| `navigation` | 前台导航菜单 |
| `file_manager` | 上传文件与下载统计 |

## 安全与部署建议

1. 安装完成后，建议删除或限制访问 `install.php`
2. 使用强密码作为后台管理员密码
3. 将真实数据库配置仅保留在 `config/config.local.php`
4. 生产环境使用最小权限数据库账号
5. 为 `uploads/` 目录配置不可执行策略，避免上传脚本被执行
6. 启用 HTTPS，并关闭不必要的调试输出
7. 定期备份数据库与上传文件

## 常见问题

### 数据库连接失败

可按以下顺序检查：

1. `config/config.local.php` 是否存在且参数正确
2. MySQL 服务是否正常运行
3. 数据库用户是否具备连接和建表权限
4. 数据库字符集是否为 `utf8mb4`

### 页面样式不加载

通常需要检查：

1. `assets/` 目录是否完整上传
2. 站点是否部署在预期目录
3. `SITE_URL` 自动识别是否正确
4. Web Server 是否拦截了静态资源访问

### 中文乱码

建议检查：

1. PHP 文件编码是否为 UTF-8
2. 数据库与连接字符集是否为 `utf8mb4`
3. 页面是否输出 `UTF-8` 头信息
4. Web Server 是否强制覆盖为其他字符集

### 忘记管理员密码

可选择以下方式之一：

1. 删除 `installed.lock` 后重新运行安装向导，设置新密码
2. 直接在数据库中将 `admin_users.password` 更新为新的 PHP `password_hash()` 结果

## 更新说明

### V2.0.1 · 2026-07-14

- 修复配置文件转义问题
- 提升跨平台路径兼容性
- 补充安全配置分离与运行时文件忽略策略

### V2.0 · 2026-07-14

- 全新站点结构与后台界面
- 项目、新闻、成员、平台、导航等后台功能完善
- 支持安装向导与动态站点地址识别

## 技术支持

- 邮箱：`qlm@qlm.org.cn`
- 平台：网易我的世界 / CurseForge / Modrinth / GitHub

## 版权说明

© 2026 七零喵团队 / Seven Zero Meow Team. All Rights Reserved.

本项目使用 `PHP + MySQL + HTML5 + CSS3 + JavaScript` 构建。
