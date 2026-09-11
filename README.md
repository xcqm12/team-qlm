# 七零喵团队 V2 · 官网系统

> 一个基于 PHP + MySQL 的团队官网系统，支持项目展示、新闻动态、团队介绍、文件下载等功能。  
> 可爱风格主题，现代化后台管理界面。  
> 最新版本: **V2.0.1** (2026-07-14)

---

## ✨ 功能特点

- 🎨 **可爱主题 UI** - 渐变背景、悬停动画、回到顶部等精美动效
- 📦 **项目作品展示** - 支持分类筛选、分页浏览、详情页下载链接
- 📰 **新闻动态系统** - 新闻发布、浏览记录、图文并茂
- 👥 **团队成员介绍** - 成员照片/职位/简介
- 🔗 **发布平台链接** - 网易我的世界 / CurseForge / Modrinth / GitHub
- 📎 **文件下载中心** - 文件上传管理、下载次数统计
- 🧭 **自定义导航菜单**
- ⚙️ **站点设置** - 团队名称、Logo、横幅图片、联系方式均可配置
- 🔐 **多级权限管理** - 普通管理员 / 超级管理员
- 🚀 **一键安装向导** - 3步完成部署
- 🌐 **动态域名适配** - 自动适配服务器域名、无需硬编码
- 📱 **响应式布局** - 完美兼容桌面与移动端

---

## 📁 目录结构

`
team-v2/
├── config/                  # 配置目录
│   └── config.php          # 数据库配置 + 路径配置 (核心文件)
├── core/                    # 核心类库
│   ├── Db.php             # PDO 数据库操作类 (单例)
│   ├── Auth.php           # 管理员认证类
│   └── View.php           # 视图/工具类 (转义/分页/消息)
├── includes/
│   └── bootstrap.php      # 启动文件（所有页面引入，加载 config + core）
├── views/layouts/          # 视图模板片段
│   ├── header.php        # HTML 头部
│   ├── nav.php           # 导航栏
│   └── footer.php        # 页脚
├── admin/                  # 后台管理
│   ├── login.php         # 登录页
│   ├── logout.php        # 安全退出
│   ├── index.php         # 仪表盘 (统计 + 快速操作)
│   ├── admin-header.php  # 后台头部（侧边栏 + 顶栏）
│   ├── admin-footer.php  # 后台底部
│   ├── admin.css         # 后台样式
│   ├── projects.php      # 项目列表管理
│   ├── project-edit.php  # 项目编辑
│   ├── news.php          # 新闻列表
│   ├── news-edit.php     # 新闻编辑
│   ├── members.php       # 团队成员管理
│   ├── platforms.php     # 发布平台
│   ├── navigation.php    # 导航菜单
│   ├── files.php         # 文件管理
│   ├── settings.php      # 站点设置 (⭐重要: 所有图片配置)
│   ├── users.php         # 用户管理 (仅超级管理员)
│   └── user-edit.php     # 用户编辑
├── assets/                 # 静态资源
│   ├── css/main.css      # 前台主样式
│   ├── css/theme.css     # 可爱主题样式
│   └── js/main.js        # JS 交互 (回到顶部等)
├── sql/install.sql        # 数据库初始化脚本（8 张表 + 默认数据）
├── uploads/               # 文件上传目录（需可写）
│   └── index.html        # 禁止目录浏览
├── index.php             # 前台首页
├── about.php             # 关于我们
├── projects.php          # 项目作品列表
├── project-detail.php    # 项目详情
├── news.php              # 新闻列表
├── news-detail.php       # 新闻详情
├── files.php             # 文件下载中心
├── download.php          # 文件下载处理（自动记录下载次数）
├── contact.php           # 联系我们
├── install.php           # 安装向导（3 步）
├── installed.lock        # 安装完成后自动生成（防止重复安装）
└── README.md             # 本文件
`

---

## 🖥 环境要求

| 组件 | 要求版本 | 推荐版本 |
|------|---------|---------|
| **PHP** | >= 7.0 | 7.4 或 8.1+ |
| **MySQL** | >= 5.6 | 5.7 或 8.0 |
| **Web Server** | Apache / Nginx / IIS | Nginx 1.18+ 或 Apache 2.4+ |
| **PHP 扩展** | PDO, pdo_mysql | mbstring, fileinfo, openssl |

### 扩展检查（在 phpinfo 中查看）

`
pdo_mysql       ✓ 必须启用（用于数据库连接）
mbstring         推荐启用（用于多字节字符串处理）
fileinfo         推荐启用（用于文件类型检测）
openssl          推荐启用（用于 HTTPS）
`

### PHP 版本兼容性

本系统已在以下环境测试通过：
- ✅ PHP 7.0 - 7.4（推荐）
- ✅ PHP 8.0 - 8.3（推荐）

> 💡 **注意**：PHP 5.x 不再支持。

---

## 🚀 快速安装（3 步）

### 步骤 1：上传文件

将整个 	eam-v2/ 目录上传到 Web 服务器根目录或子目录下。例如：

`
# 部署到子目录
/www/wwwroot/team.qlm.org.cn/
└── team-v2/           ← 本系统所在目录（也可以直接把内容放到根目录）
    ├── index.php
    ├── install.php
    ├── config/
    ├── core/
    └── ...

# 或直接部署到根目录
/www/wwwroot/team.qlm.org.cn/
├── index.php
├── install.php
├── config/
└── ...
`

**确保以下目录/文件可写**（权限建议设置为 755，若遇到问题可临时设为 777 测试）：

`
config/config.php       ← 安装时写入数据库配置（必须可写）
uploads/                ← 文件上传目录（必须可写）
team-v2/                ← 安装完成后自动写入 installed.lock（必须可写）
`

### 步骤 2：创建 MySQL 数据库

登录到您的 MySQL 管理工具（phpMyAdmin、Navicat、MySQL 命令行等），创建一个新的数据库：

`sql
CREATE DATABASE IF NOT EXISTS qiling_team
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
`

如果您的服务器使用的是其他数据库名也没关系，安装向导中可以自定义数据库名。

> 💡 **温馨提示**：如果您没有权限创建数据库，也可以使用已有的数据库，系统将自动在库内创建数据表。

### 步骤 3：运行安装向导

在浏览器中访问：

`
http://您的域名/install.php
`

按页面提示完成以下 3 个步骤：

1. **环境检测** - 检查 PHP 版本、扩展、目录权限
2. **数据库配置** - 填写数据库主机、端口、库名、用户名、密码，并设置后台管理员账号密码
3. **完成** - 系统自动创建数据库表并写入初始数据

安装完成后系统会自动生成 installed.lock 文件，防止重复安装。

### 默认测试账号

`
用户名: admin
密码:   admin123
`

> ⚠️ **重要！** 生产环境请务必在首次登录后修改默认密码！

---

## 📖 使用指南

### 1. 访问前台

| 页面 | 访问地址 | 功能 |
|-----|---------|-----|
| 首页 | index.php | 首页横幅 + 精选项目 + 最新新闻 |
| 关于我们 | bout.php | 团队介绍 + 成员展示 |
| 项目作品 | projects.php | 项目列表（按分类筛选、分页） |
| 项目详情 | project-detail.php?id=项目ID | 项目详细介绍 + 下载链接 |
| 新闻动态 | 
ews.php | 新闻列表 + 分类筛选 |
| 新闻详情 | 
ews-detail.php?id=新闻ID | 新闻正文 |
| 文件下载 | iles.php | 文件下载中心 |
| 联系我们 | contact.php | 联系方式展示 |
| 安装向导 | install.php | 首次安装使用（完成后自动失效） |

### 2. 访问后台

| 页面 | 访问地址 | 功能 |
|-----|---------|-----|
| 登录 | dmin/login.php | 管理员登录 |
| 仪表盘 | dmin/index.php | 数据统计 + 最近项目/新闻 + 快速操作 |
| 项目管理 | dmin/projects.php | 项目增删改查 |
| 项目编辑 | dmin/project-edit.php | 新建/编辑项目 |
| 新闻管理 | dmin/news.php | 新闻列表 |
| 新闻编辑 | dmin/news-edit.php | 新建/编辑新闻 |
| 团队成员 | dmin/members.php | 成员管理 |
| 发布平台 | dmin/platforms.php | 外部平台链接管理 |
| 导航菜单 | dmin/navigation.php | 自定义前台导航 |
| 文件管理 | dmin/files.php | 文件上传/编辑/删除 |
| **站点设置** | dmin/settings.php | ⭐ **核心配置**（所有图片、团队信息、SEO） |
| 用户管理 | dmin/users.php | 管理员用户（仅超级管理员可见） |
| 退出登录 | dmin/logout.php | 安全退出 |

---

## 🎯 功能详解

### 站点设置（重要！⭐）

dmin/settings.php 是配置整个站点的核心页面，可以设置以下内容：

| 设置项 | 说明 |
|--------|-----|
| 团队名称 | 显示在导航栏、首页、页面标题 |
| 团队英文名 | 辅助显示 |
| **Logo URL** | 导航栏 LOGO 图片（支持上传或外部链接） |
| 团队口号 | 首页 Hero 区域副标题 |
| 团队简介 | 首页/关于我们页使用 |
| 团队详情 | 关于我们详细介绍 |
| 成立日期 | 显示在关于我们页 |
| 联系邮箱/QQ/微信/地址/工作时间 | contact.php 展示 |
| **首页横幅图 (hero_banner)** | 首页大图背景 |
| **关于我们横幅图 (about_banner)** | 关于我们页面背景 |
| **项目作品横幅图 (projects_banner)** | 项目列表页面背景 |
| **新闻动态横幅图 (news_banner)** | 新闻列表页面背景 |
| **文件下载横幅图 (files_banner)** | 文件下载页面背景 |
| **联系我们横幅图 (contact_banner)** | 联系我们页面背景 |
| 默认项目封面图 | 项目无封面时的默认图片 |
| 默认新闻封面图 | 新闻无封面时的默认图片 |
| 站点关键词 | SEO 优化 (META keywords) |
| 站点描述 | SEO 优化 (META description) |
| 网站图标 (favicon) | 浏览器标签页图标 |
| 版权信息 | 页脚版权文字 |

> 🔥 **所有图片均可配置**：Banner、Logo、默认封面图都可以在后台配置并保存！

### 项目管理

- **项目字段**：标题、英文名、封面图、简介、详情、分类、版本、平台、下载链接、GitHub 链接、是否精选、状态
- **精选项目**：标记为"精选"的项目会优先在首页展示
- **分类筛选**：在前台 projects.php 可按分类快速筛选

### 新闻管理

- **新闻字段**：标题、封面图、摘要、正文、分类、状态、浏览次数
- **自动统计浏览量**：用户每次打开新闻详情自动 +1
- **分类**：动态 / 公告 / 新闻 / 活动（可自定义）

### 文件下载中心

- **支持**：本地文件上传 + 填写外部下载链接
- **自动统计下载次数**：每次点击下载自动记录
- **分类浏览**：按文件分类快速筛选
- **公开/私有**：私有文件仅后台可见，不展示给前台用户

### 导航菜单管理

- 自由添加/修改导航项，支持外部链接（https:// 开头）
- 设置排序编号自定义导航顺序
- 前台导航动态渲染，按编号自动排序

---

## 🛠 常见问题 FAQ

### Q1：安装后无法连接数据库（Database Connect Error）

**可能原因**：
1. config.php 中的数据库参数不正确
2. MySQL 服务未启动
3. 数据库用户名/密码错误
4. 用户权限不足

**解决方法**：

1. 检查 config/config.php 中数据库配置：
   `php
   define('DB_HOST', '127.0.0.1');  // 数据库主机
   define('DB_PORT', '3306');       // 端口（通常为 3306）
   define('DB_NAME', 'qiling_team'); // 数据库名
   define('DB_USER', 'root');       // 用户名
   define('DB_PASS', 'password');    // 密码（如有）
   `
2. 用 MySQL 客户端手动测试连接
3. 确认 MySQL 用户有访问该数据库的权限

### Q2：页面样式不显示 / CSS 404

**问题**：页面打开后无样式，只有文字，浏览器控制台显示 CSS 文件 404

**解决方法**：
1. 检查 ssets/ 目录是否完整上传到服务器
2. 检查文件/目录权限（目录 755，文件 644）
3. 如使用 CDN 或反向代理，确认 ssets/ 路径正确
4. 文件路径通过 SITE_URL 自动计算，如部署目录位置变更，确保 SITE_URL 正确

### Q3：图片不显示

**问题**：横幅图/封面图/Logo 无法显示

**解决方法**：
1. 图片 URL 需填写**可访问的完整 URL**（http:// 或 https:// 开头）
2. 也可将图片上传至 uploads/ 目录，然后填写 uploads/文件名.jpg 这样的相对路径
3. 图片 URL 需在站点设置中正确保存后才生效
4. 检查文件权限（需可读，权限 644 或 755）

### Q4：忘记管理员密码

**方法一：重新运行安装向导（推荐）**
1. 删除服务器上的 installed.lock 文件
2. 重新访问 install.php
3. 填入新的管理员账号密码
4. 完成后系统会更新管理员账号（数据表保留，不影响已有数据）

**方法二：直接在数据库中重置**
`sql
-- 将 admin 密码重置为 'admin123'
UPDATE dmin_users 
SET password = PASSWORD('admin123') 
WHERE username = 'admin';
`

> 💡 注意：某些 MySQL 版本不支持 PASSWORD() 函数，请改为手动插入已知密码 hash。

### Q5：如何修改默认的数据库配置

**方法一**：重新安装（推荐，最稳妥）
1. 删除 installed.lock 文件
2. 重新访问 install.php
3. 填写新的数据库配置

**方法二**：手动编辑文件
用文本编辑器（如 Notepad++、VS Code、vi）打开 config/config.php，修改以下常量：
`php
define('DB_HOST', '127.0.0.1');  // 数据库主机
define('DB_PORT', '3306');      // 端口
define('DB_NAME', 'qiling_team'); // 库名
define('DB_USER', 'root');       // 用户名
define('DB_PASS', '');           // 密码
`

### Q6：页面显示中文乱码

**可能原因**：数据库字符集不匹配或 HTML 编码问题

**解决方法**：
1. 检查数据库字符集：SHOW CREATE DATABASE qiling_team;，确认是 utf8mb4
2. 检查浏览器 HTML 源代码，确认 <meta charset="UTF-8"> 存在
3. 确认 PHP 文件本身以 UTF-8 编码保存（本项目已统一使用 UTF-8）
4. Apache/Nginx 的 AddDefaultCharset 设置不应覆盖为 GB2312 或其他编码

### Q7：文件上传失败

**检查清单**：
1. uploads/ 目录是否存在且**可写**（权限 755 或 777）
2. PHP php.ini 中的配置：
   - upload_max_filesize（默认为 2MB，可改为 100M）
   - post_max_size（需大于 upload_max_filesize）
   - ile_uploads = On
3. 文件大小是否超过限制
4. 查看服务器 error_log 查看具体错误信息

### Q8：PHP 解析错误 / 语法错误

**常见错误**：

`
Parse error: syntax error, unexpected identifier...
`

**可能原因**：
1. 文件上传不完整或损坏
2. 文件编码问题（需 UTF-8 无 BOM）
3. PHP 版本过低导致语法不兼容（如短数组 [] 在 PHP 5.3 以下不支持）
4. 代码中的转义字符问题（本项目已统一修复）

**解决方法**：
1. **重新上传文件**：确保所有 PHP 文件完整上传
2. **检查文件权限**：目录 755，文件 644
3. **检查 PHP 版本**：运行 php -v 或 phpinfo() 查看版本，需 >= 7.0
4. **查看详细错误日志**：服务器错误日志通常能给出更精确的错误位置
5. **语法检查**：在服务器上运行 php -l /path/to/file.php 检查语法

---

## 📊 数据库表结构

| 表名 | 用途 | 主要字段 |
|------|-----|---------|
| 	eam_info | 团队信息（所有图片配置） | id, team_name, team_logo, hero_banner, about_banner, projects_banner, news_banner, files_banner, contact_banner, default_project_cover, default_news_cover, team_slogan, team_description, contact_email, contact_address, contact_worktime, site_keywords, site_description, site_ico, site_copyright, created_at, updated_at |
| dmin_users | 后台管理员 | id, username, password, nickname, email, avatar, role (1=普通, 2=超级), status, last_login_time, last_login_ip |
| projects | 项目作品 | id, title, title_en, cover_image, summary, content, category, version, download_url, github_url, platform, views, is_featured, status |
| 
ews | 新闻动态 | id, title, cover_image, summary, content, category, views, status, created_at |
| 	eam_members | 团队成员 | id, name, position, avatar, bio, github, email, sort_order |
| platform_links | 发布平台链接 | id, platform_name, platform_icon, platform_url, platform_desc, sort_order |
| 
avigation | 导航菜单 | id, title, url, target, sort_order, status |
| ile_manager | 文件管理 | id, file_name, file_path, file_size, file_type, file_ext, category, uploader_id, downloads, description, is_public |

---

## 🔒 安全建议

1. **修改默认管理员密码**：dmin/admin123 必须在首次登录后修改
2. **删除 install.php**：安装完成后可删除或重命名 install.php（可选）
3. **数据库账号权限最小化**：生产环境建议 MySQL 账号只授予 SELECT/INSERT/UPDATE/DELETE 权限，避免授予 ALL PRIVILEGES
4. **文件上传安全**：
   - 定期检查 uploads/ 目录中的文件
   - 避免上传可执行文件（.php, .exe, .sh 等）
   - 设置 uploads/ 目录不可执行 PHP（Nginx/Apache 配置）
5. **HTTPS**：生产环境强烈建议启用 HTTPS
6. **错误信息**：config.php 中 define('DEBUG', false); 可关闭错误信息显示
7. **定期备份**：定期备份数据库和重要文件

---

## 📝 更新日志

### V2.0.1 (2026-07-14)
- 🐛 修复 config.php 反斜杠转义导致的 PHP 解析错误
- 🔧 使用 DIRECTORY_SEPARATOR 替代 str_replace('\\', ...) 避免跨平台转义问题
- 🔧 将数组短语法 [...] 改为 rray(...) 以提高 PHP 版本兼容性
- ✅ 全部 33 个 PHP 文件通过 php -l 语法检查

### V2.0 (2026-07-14)
- ✨ 全新 MVC 架构重构
- 🎨 可爱主题 UI 全面升级
- ⚙️ 站点设置支持所有图片配置
- 📦 项目/新闻/文件全功能 CRUD
- 🔐 多级管理员权限
- 🚀 一键安装向导（3 步完成）
- 🌐 动态域名适配（SITE_URL 自动检测）
- 📱 响应式布局（完美兼容移动端）

---

## 📧 技术支持

如有问题或建议，欢迎联系：

- 团队邮箱：qlm@qlm.org.cn
- 发布平台：网易我的世界 / CurseForge / Modrinth / GitHub

---

## 📜 版权声明

&copy; 2026 七零喵团队。保留所有权利。  
Seven Zero Meow Team. All Rights Reserved.

> 本项目使用 PHP + MySQL + HTML5 + CSS3 + JavaScript 构建
