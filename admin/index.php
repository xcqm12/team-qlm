<?php
require_once '../includes/bootstrap.php';
Auth::requireLogin();

$stats = [
    'projects' => Db::rowCount('projects', '1=1'),
    'news' => Db::rowCount('news', '1=1'),
    'members' => Db::rowCount('team_members', 'status = 1'),
    'files' => Db::rowCount('file_manager', '1=1'),
    'platforms' => Db::rowCount('platform_links', 'status = 1'),
    'nav' => Db::rowCount('navigation', 'status = 1'),
];

$recentProjects = Db::fetchAll('SELECT * FROM projects ORDER BY id DESC LIMIT 5');
$recentNews = Db::fetchAll('SELECT * FROM news ORDER BY id DESC LIMIT 5');
?>
<?php include 'admin-header.php'; ?>
<div class="admin-page-title"><h1>仪表盘</h1></div>

<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-icon">📦</div>
    <div class="stat-content">
      <div class="stat-value"><?php echo $stats['projects']; ?></div>
      <div class="stat-label">项目作品</div>
    </div>
    <a href="projects.php" class="stat-link">管理 &rarr;</a>
  </div>
  <div class="stat-card">
    <div class="stat-icon">📰</div>
    <div class="stat-content">
      <div class="stat-value"><?php echo $stats['news']; ?></div>
      <div class="stat-label">新闻动态</div>
    </div>
    <a href="news.php" class="stat-link">管理 &rarr;</a>
  </div>
  <div class="stat-card">
    <div class="stat-icon">👥</div>
    <div class="stat-content">
      <div class="stat-value"><?php echo $stats['members']; ?></div>
      <div class="stat-label">团队成员</div>
    </div>
    <a href="members.php" class="stat-link">管理 &rarr;</a>
  </div>
  <div class="stat-card">
    <div class="stat-icon">📎</div>
    <div class="stat-content">
      <div class="stat-value"><?php echo $stats['files']; ?></div>
      <div class="stat-label">下载文件</div>
    </div>
    <a href="files.php" class="stat-link">管理 &rarr;</a>
  </div>
  <div class="stat-card">
    <div class="stat-icon">🔗</div>
    <div class="stat-content">
      <div class="stat-value"><?php echo $stats['platforms']; ?></div>
      <div class="stat-label">发布平台</div>
    </div>
    <a href="platforms.php" class="stat-link">管理 &rarr;</a>
  </div>
  <div class="stat-card">
    <div class="stat-icon">🧭</div>
    <div class="stat-content">
      <div class="stat-value"><?php echo $stats['nav']; ?></div>
      <div class="stat-label">导航项目</div>
    </div>
    <a href="navigation.php" class="stat-link">管理 &rarr;</a>
  </div>
</div>

<div class="dashboard-grid">
  <div class="card">
    <div class="card-header"><h3>最近项目</h3><a href="projects.php" class="btn btn-sm btn-secondary">全部</a></div>
    <table class="admin-table">
      <thead><tr><th>标题</th><th>分类</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead>
      <tbody>
        <?php foreach ($recentProjects as $p): ?>
        <tr>
          <td><?php echo htmlspecialchars($p['title'], ENT_QUOTES, 'UTF-8'); ?></td>
          <td><?php echo htmlspecialchars($p['category'] ?? '-', ENT_QUOTES, 'UTF-8'); ?></td>
          <td><?php echo $p['status'] ? '<span class="badge badge-active">启用</span>' : '<span class="badge badge-inactive">停用</span>'; ?></td>
          <td><?php echo htmlspecialchars($p['created_at'], ENT_QUOTES, 'UTF-8'); ?></td>
          <td><a href="project-edit.php?id=<?php echo $p['id']; ?>" class="btn btn-sm btn-link">编辑</a></td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <div class="card">
    <div class="card-header"><h3>最近新闻</h3><a href="news.php" class="btn btn-sm btn-secondary">全部</a></div>
    <table class="admin-table">
      <thead><tr><th>标题</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead>
      <tbody>
        <?php foreach ($recentNews as $n): ?>
        <tr>
          <td><?php echo htmlspecialchars($n['title'], ENT_QUOTES, 'UTF-8'); ?></td>
          <td><?php echo $n['status'] ? '<span class="badge badge-active">启用</span>' : '<span class="badge badge-inactive">停用</span>'; ?></td>
          <td><?php echo htmlspecialchars($n['created_at'], ENT_QUOTES, 'UTF-8'); ?></td>
          <td><a href="news-edit.php?id=<?php echo $n['id']; ?>" class="btn btn-sm btn-link">编辑</a></td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>

<div class="card" style="margin-top:20px;">
  <div class="card-header"><h3>快速操作</h3></div>
  <div style="display:flex; gap:12px; flex-wrap:wrap; padding:20px;">
    <a href="project-edit.php" class="btn btn-primary">+ 新建项目</a>
    <a href="news-edit.php" class="btn btn-primary">+ 新建新闻</a>
    <a href="members.php?action=edit" class="btn btn-primary">+ 新增成员</a>
    <a href="platforms.php?action=edit" class="btn btn-primary">+ 新增平台</a>
    <a href="navigation.php?action=edit" class="btn btn-primary">+ 新增导航</a>
    <a href="files.php?action=edit" class="btn btn-primary">+ 上传文件</a>
    <a href="settings.php" class="btn btn-secondary">站点设置</a>
    <a href="../index.php" class="btn btn-secondary" target="_blank">查看网站</a>
  </div>
</div>

<?php include 'admin-footer.php'; ?>
