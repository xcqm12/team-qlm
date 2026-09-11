<?php
require_once 'includes/bootstrap.php';
$info = View::info();
$heroBanner = $info['hero_banner'] ?? '';
$defaultProjectCover = $info['default_project_cover'] ?? '';

$featuredProjects = [];
$latestNews = [];
try {
    $featuredProjects = Db::fetchAll('SELECT * FROM projects WHERE status = 1 AND is_featured = 1 ORDER BY id DESC LIMIT 6');
    if (empty($featuredProjects)) {
        $featuredProjects = Db::fetchAll('SELECT * FROM projects WHERE status = 1 ORDER BY id DESC LIMIT 6');
    }
    $latestNews = Db::fetchAll('SELECT * FROM news WHERE status = 1 ORDER BY id DESC LIMIT 4');
} catch (Exception $e) {}
$page_title = '首页';
include 'views/layouts/header.php';
?>
<?php include 'views/layouts/nav.php'; ?>

<section class="hero <?php if (!empty($heroBanner)) echo 'with-banner'; ?>" <?php if (!empty($heroBanner)) echo "style=\"background-image:url('" . htmlspecialchars($heroBanner, ENT_QUOTES, 'UTF-8') . "');\""; ?>>
  <div class="hero-content">
    <h1><?php echo htmlspecialchars($info['team_name'] ?? SITE_NAME, ENT_QUOTES, 'UTF-8'); ?></h1>
    <div class="slogan"><?php echo htmlspecialchars($info['team_slogan'] ?? '由一群游戏爱好者与开发者所组建的团队', ENT_QUOTES, 'UTF-8'); ?></div>
    <div class="hero-actions">
      <a href="projects.php" class="hero-btn">浏览项目</a>
      <a href="about.php" class="hero-btn hero-btn-outline">了解团队</a>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="section-title"><h2>精选项目</h2><p>团队发布的优秀作品</p></div>
    <div class="grid">
      <?php foreach ($featuredProjects as $p): ?>
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
    <?php if (empty($featuredProjects)): ?>
      <div class="empty"><div class="icon">📦</div><h3>暂无项目</h3><p>请先登录后台添加项目</p></div>
    <?php endif; ?>
  </div>
</section>

<section class="section" style="background:#f7fafc;">
  <div class="container">
    <div class="section-title"><h2>最新动态</h2><p>团队最新新闻与资讯</p></div>
    <div class="news-list">
      <?php foreach ($latestNews as $n): ?>
        <?php $cover = !empty($n['cover_image']) ? $n['cover_image'] : ($info['default_news_cover'] ?? ''); ?>
        <div class="news-item" onclick="location.href='news-detail.php?id=<?php echo $n['id']; ?>'" style="cursor:pointer;">
          <?php if (!empty($cover)): ?>
            <div class="news-cover" style="background-image:url('<?php echo htmlspecialchars($cover, ENT_QUOTES, 'UTF-8'); ?>');"></div>
          <?php else: ?>
            <div class="news-cover">📰</div>
          <?php endif; ?>
          <div class="news-content">
            <h3><a href="news-detail.php?id=<?php echo $n['id']; ?>"><?php echo htmlspecialchars($n['title'], ENT_QUOTES, 'UTF-8'); ?></a></h3>
            <div class="meta"><?php echo htmlspecialchars($n['category'] ?? '动态', ENT_QUOTES, 'UTF-8'); ?> · <?php echo htmlspecialchars($n['created_at'], ENT_QUOTES, 'UTF-8'); ?> · 浏览 <?php echo (int)$n['views']; ?></div>
            <div class="summary"><?php echo htmlspecialchars($n['summary'] ?? mb_substr(strip_tags($n['content'] ?? ''), 0, 100) . '...', ENT_QUOTES, 'UTF-8'); ?></div>
            <a href="news-detail.php?id=<?php echo $n['id']; ?>" class="read-more">阅读全文 &rarr;</a>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
    <?php if (empty($latestNews)): ?>
      <div class="empty"><div class="icon">📰</div><h3>暂无新闻</h3></div>
    <?php endif; ?>
  </div>
</section>

<?php include 'views/layouts/footer.php'; ?>
