<?php
if (session_status() === PHP_SESSION_NONE) session_start();
$currentPage = basename($_SERVER['PHP_SELF'] ?? '');
$pageTitleMap = [
    'index.php' => '仪表盘',
    'projects.php' => '项目管理',
    'project-edit.php' => '项目编辑',
    'news.php' => '新闻管理',
    'news-edit.php' => '新闻编辑',
    'members.php' => '团队成员',
    'platforms.php' => '发布平台',
    'navigation.php' => '导航管理',
    'files.php' => '文件管理',
    'settings.php' => '站点设置',
    'users.php' => '用户管理',
    'user-edit.php' => '用户编辑',
];
$pageTitle = $pageTitleMap[$currentPage] ?? '管理后台';
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?php echo $pageTitle; ?> - 七零喵团队后台</title>
<link rel="stylesheet" href="admin.css">
</head>
<body class="admin-body">
<aside class="admin-sidebar">
  <div class="sidebar-brand">
    <span style="font-size:28px;">🐾</span>
    <span>七零喵团队</span>
  </div>
  <nav class="sidebar-nav">
    <div class="nav-section">主菜单</div>
    <a href="index.php" class="nav-item <?php if ($currentPage === 'index.php') echo 'active'; ?>">📊 仪表盘</a>
    <a href="projects.php" class="nav-item <?php if (in_array($currentPage, ['projects.php', 'project-edit.php'])) echo 'active'; ?>">📦 项目作品</a>
    <a href="news.php" class="nav-item <?php if (in_array($currentPage, ['news.php', 'news-edit.php'])) echo 'active'; ?>">📰 新闻动态</a>
    <a href="members.php" class="nav-item <?php if ($currentPage === 'members.php') echo 'active'; ?>">👥 团队成员</a>
    <a href="platforms.php" class="nav-item <?php if ($currentPage === 'platforms.php') echo 'active'; ?>">🔗 发布平台</a>
    <a href="navigation.php" class="nav-item <?php if ($currentPage === 'navigation.php') echo 'active'; ?>">🧭 导航菜单</a>
    <a href="files.php" class="nav-item <?php if ($currentPage === 'files.php') echo 'active'; ?>">📎 文件管理</a>
    <div class="nav-section" style="margin-top:16px;">系统</div>
    <a href="settings.php" class="nav-item <?php if ($currentPage === 'settings.php') echo 'active'; ?>">⚙️ 站点设置</a>
    <?php if (Auth::isSuper()): ?><a href="users.php" class="nav-item <?php if (in_array($currentPage, ['users.php', 'user-edit.php'])) echo 'active'; ?>">👤 用户管理</a><?php endif; ?>
  </nav>
</aside>
<main class="admin-main">
  <header class="admin-topbar">
    <div class="topbar-left">
      <span style="color:#718096; font-size:14px;">当前位置:</span>
      <strong><?php echo $pageTitle; ?></strong>
    </div>
    <div class="topbar-right">
      <span style="color:#4a5568; font-size:14px;">👤 <?php echo htmlspecialchars((Auth::nickname() ?: Auth::username()), ENT_QUOTES, 'UTF-8'); ?></span>
      <a href="../index.php" class="btn btn-sm btn-secondary" target="_blank">前台</a>
      <a href="logout.php" class="btn btn-sm btn-secondary" onclick="return confirm('确定退出登录?');">退出</a>
    </div>
  </header>
  <div class="admin-content">
