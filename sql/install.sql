-- 七零喵团队 V2 数据库初始化脚本
-- 注意：此文件由 install.php 自动执行，数据库由安装脚本在运行时动态创建和选择
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS admin_users;
CREATE TABLE admin_users (
  id int(11) NOT NULL AUTO_INCREMENT,
  username varchar(50) NOT NULL,
  password varchar(255) NOT NULL,
  nickname varchar(100) DEFAULT NULL,
  email varchar(100) DEFAULT NULL,
  avatar varchar(255) DEFAULT NULL,
  role tinyint(1) NOT NULL DEFAULT '1' COMMENT '1普通 2超级',
  status tinyint(1) NOT NULL DEFAULT '1',
  last_login_time datetime DEFAULT NULL,
  last_login_ip varchar(50) DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS team_info;
CREATE TABLE team_info (
  id int(11) NOT NULL AUTO_INCREMENT,
  team_name varchar(100) NOT NULL DEFAULT '七零喵团队',
  team_name_en varchar(100) DEFAULT 'Seven Zero Meow Team',
  team_logo varchar(255) DEFAULT NULL,
  team_slogan varchar(255) DEFAULT NULL,
  team_description text,
  team_content text,
  founded_date date DEFAULT NULL,
  contact_email varchar(100) DEFAULT NULL,
  contact_qq varchar(50) DEFAULT NULL,
  contact_wechat varchar(100) DEFAULT NULL,
  contact_address varchar(255) DEFAULT NULL,
  contact_worktime varchar(100) DEFAULT NULL,
  contact_banner varchar(255) DEFAULT NULL,
  hero_banner varchar(255) DEFAULT NULL,
  about_banner varchar(255) DEFAULT NULL,
  projects_banner varchar(255) DEFAULT NULL,
  news_banner varchar(255) DEFAULT NULL,
  files_banner varchar(255) DEFAULT NULL,
  default_project_cover varchar(255) DEFAULT NULL,
  default_news_cover varchar(255) DEFAULT NULL,
  site_keywords varchar(255) DEFAULT NULL,
  site_description varchar(500) DEFAULT NULL,
  site_ico varchar(255) DEFAULT NULL,
  site_copyright varchar(255) DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS platform_links;
CREATE TABLE platform_links (
  id int(11) NOT NULL AUTO_INCREMENT,
  platform_name varchar(100) NOT NULL,
  platform_icon varchar(255) DEFAULT NULL,
  platform_url varchar(500) NOT NULL,
  platform_desc varchar(500) DEFAULT NULL,
  sort_order int(11) NOT NULL DEFAULT '0',
  status tinyint(1) NOT NULL DEFAULT '1',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS projects;
CREATE TABLE projects (
  id int(11) NOT NULL AUTO_INCREMENT,
  title varchar(200) NOT NULL,
  title_en varchar(200) DEFAULT NULL,
  cover_image varchar(255) DEFAULT NULL,
  summary varchar(500) DEFAULT NULL,
  content text,
  category varchar(50) DEFAULT NULL,
  version varchar(50) DEFAULT NULL,
  download_url varchar(500) DEFAULT NULL,
  github_url varchar(500) DEFAULT NULL,
  platform varchar(100) DEFAULT NULL,
  views int(11) NOT NULL DEFAULT '0',
  is_featured tinyint(1) NOT NULL DEFAULT '0',
  status tinyint(1) NOT NULL DEFAULT '1',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_category (category),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS news;
CREATE TABLE news (
  id int(11) NOT NULL AUTO_INCREMENT,
  title varchar(200) NOT NULL,
  cover_image varchar(255) DEFAULT NULL,
  summary varchar(500) DEFAULT NULL,
  content text,
  views int(11) NOT NULL DEFAULT '0',
  status tinyint(1) NOT NULL DEFAULT '1',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS team_members;
CREATE TABLE team_members (
  id int(11) NOT NULL AUTO_INCREMENT,
  name varchar(100) NOT NULL,
  position varchar(100) DEFAULT NULL,
  avatar varchar(255) DEFAULT NULL,
  bio varchar(500) DEFAULT NULL,
  github varchar(255) DEFAULT NULL,
  email varchar(100) DEFAULT NULL,
  sort_order int(11) NOT NULL DEFAULT '0',
  status tinyint(1) NOT NULL DEFAULT '1',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS file_manager;
CREATE TABLE file_manager (
  id int(11) NOT NULL AUTO_INCREMENT,
  file_name varchar(255) NOT NULL,
  file_path varchar(500) NOT NULL,
  file_size bigint(20) NOT NULL,
  file_type varchar(100) DEFAULT NULL,
  file_ext varchar(20) DEFAULT NULL,
  category varchar(50) DEFAULT 'other',
  uploader_id int(11) DEFAULT NULL,
  downloads int(11) NOT NULL DEFAULT '0',
  description varchar(500) DEFAULT NULL,
  is_public tinyint(1) NOT NULL DEFAULT '1',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS navigation;
CREATE TABLE navigation (
  id int(11) NOT NULL AUTO_INCREMENT,
  title varchar(100) NOT NULL,
  url varchar(255) NOT NULL,
  target varchar(20) DEFAULT '_self',
  sort_order int(11) NOT NULL DEFAULT '0',
  status tinyint(1) NOT NULL DEFAULT '1',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO admin_users (username, password, nickname, email, role, status) VALUES
('admin', 'admin123', '超级管理员', 'admin@qiling.team', 2, 1);

INSERT INTO team_info (team_name, team_name_en, team_slogan, team_description, team_content, founded_date, contact_email, contact_address, contact_worktime, site_keywords, site_description, site_copyright) VALUES
('七零喵团队', 'Seven Zero Meow Team', '由一群游戏爱好者与开发者所组建的团队',
'七零喵团队是由一群游戏爱好者与独立开发者所组建的一个团队。我们热爱创造，热爱分享，致力于为玩家带来优质的游戏内容与体验。',
'团队内容主要发布于网易我的世界、CurseForge、Modrinth以及个人站点上，部分代码开源于GitHub。',
'2019-11-11', 'qlm@qlm.org.cn', '线上团队 · 全球合作', '工作日 10:00 - 19:00',
'七零喵,七零喵团队,我的世界,Minecraft,mod,CurseForge,Modrinth,游戏开发',
'七零喵团队官方网站',
'&copy; 2019-2026 七零喵团队');

INSERT INTO platform_links (platform_name, platform_url, platform_desc, sort_order) VALUES
('网易我的世界', 'https://mc.163.com/', '团队内容主要发布平台', 1),
('CurseForge', 'https://www.curseforge.com/', 'Mod发布平台', 2),
('Modrinth', 'https://modrinth.com/', 'Mod发布平台', 3),
('GitHub', 'https://github.com/', '部分代码开源', 4);

INSERT INTO navigation (title, url, target, sort_order) VALUES
('首页', 'index.php', '_self', 1),
('关于我们', 'about.php', '_self', 2),
('项目作品', 'projects.php', '_self', 3),
('新闻动态', 'news.php', '_self', 4),
('文件下载', 'files.php', '_self', 5),
('联系我们', 'contact.php', '_self', 6);

SET FOREIGN_KEY_CHECKS = 1;