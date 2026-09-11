<?php
require_once 'includes/bootstrap.php';
$info = View::info();
$banner = $info['projects_banner'] ?? '';
$defaultProjectCover = $info['default_project_cover'] ?? '';

$page = max(1, (int)($_GET['page'] ?? 1));
$perPage = 12;
$category = $_GET['category'] ?? '';
$whereClauses = ['status = 1'];
$params = [];
if (!empty($category)) { $whereClauses[] = 'category = ?'; $params[] = $category; }
$whereStr = implode(' AND ', $whereClauses);
$total = Db::rowCount('projects', $whereStr, $params);
$offset = ($page - 1) * $perPage;
$projects = Db::fetchAll('SELECT * FROM projects WHERE ' . $whereStr . ' ORDER BY is_featured DESC, id DESC LIMIT ' . $perPage . ' OFFSET ' . $offset, $params);
$categories = Db::fetchAll('SELECT DISTINCT category FROM projects WHERE status = 1 AND category IS NOT NULL AND category <> ""');
$totalPages = ceil($total / $perPage);
$page_title = '项目作品';
$active_page = 'projects.php';
include 'views/layouts/header.php';
?>
<?php include 'views/layouts/nav.php'; ?>

<section class="page-hero <?php if (!empty($banner)) echo 'with-banner'; ?>" <?php if (!empty($banner)) echo "style=\"background-image:url('" . htmlspecialchars($banner, ENT_QUOTES, 'UTF-8') . "');\""; ?>>
  <div class="container"><h1>项目作品</h1><p>团队发布的游戏与作品</p></div>
</section>

<section class="page-content">
  <div class="container">
    <?php echo View::flash(); ?>
    <form class="filter-bar">
      <label>分类:</label>
      <select name="category" onchange="this.form.submit();">
        <option value="">全部</option>
        <?php foreach ($categories as $c): ?>
          <option value="<?php echo htmlspecialchars($c['category'], ENT_QUOTES, 'UTF-8'); ?>" <?php if ($category === $c['category']) echo 'selected'; ?>><?php echo htmlspecialchars($c['category'], ENT_QUOTES, 'UTF-8'); ?></option>
        <?php endforeach; ?>
      </select>
      <div class="count">共 <?php echo $total; ?> 个项目</div>
    </form>

    <div class="grid">
      <?php foreach ($projects as $p): ?>
        <?php $cover = !empty($p['cover_image']) ? $p['cover_image'] : $defaultProjectCover; ?>
        <div class="card">
          <div class="card-cover" <?php if (!empty($cover)) echo "style=\"background-image:url('" . htmlspecialchars($cover, ENT_QUOTES, 'UTF-8') . "');\""; ?>>
            <?php if (!empty($p['is_featured'])): ?><span class="feat-badge">精选</span><?php endif; ?>
          </div>
          <div class="card-body">
            <h3><?php echo htmlspecialchars($p['title'], ENT_QUOTES, 'UTF-8'); ?></h3>
            <div class="meta"><?php echo htmlspecialchars($p['category'] ?? '作品', ENT_QUOTES, 'UTF-8'); ?><?php if (!empty($p['version'])) echo ' · v' . htmlspecialchars($p['version'], ENT_QUOTES, 'UTF-8'); ?></div>
            <div class="summary"><?php echo htmlspecialchars($p['summary'], ENT_QUOTES, 'UTF-8'); ?></div>
            <div class="actions"><a href="project-detail.php?id=<?php echo $p['id']; ?>" class="btn-sm primary">查看详情</a></div>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
    <?php if (empty($projects)): ?>
      <div class="empty"><div class="icon">📦</div><h3>暂无项目</h3><p>该分类下暂时没有项目</p></div>
    <?php endif; ?>

    <?php echo View::pagination($page, $totalPages, 'projects.php?category=' . urlencode($category)); ?>
  </div>
</section>

<?php include 'views/layouts/footer.php'; ?>
