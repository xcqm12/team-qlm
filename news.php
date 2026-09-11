<?php
require_once 'includes/bootstrap.php';
$info = View::info();
$banner = $info['news_banner'] ?? '';

$page = max(1, (int)($_GET['page'] ?? 1));
$perPage = 10;
$total = Db::rowCount('news', 'status = 1');
$offset = ($page - 1) * $perPage;
$list = Db::fetchAll('SELECT * FROM news WHERE status = 1 ORDER BY id DESC LIMIT ' . $perPage . ' OFFSET ' . $offset);
$totalPages = ceil($total / $perPage);
$page_title = '新闻动态';
$active_page = 'news.php';
include 'views/layouts/header.php';
?>
<?php include 'views/layouts/nav.php'; ?>

<section class="page-hero <?php if (!empty($banner)) echo 'with-banner'; ?>" <?php if (!empty($banner)) echo "style=\"background-image:url('" . htmlspecialchars($banner, ENT_QUOTES, 'UTF-8') . "');\""; ?>>
  <div class="container"><h1>新闻动态</h1><p>团队最新资讯与动态</p></div>
</section>

<section class="page-content">
  <div class="container">
    <?php echo View::flash(); ?>
    <div class="news-list">
      <?php foreach ($list as $n): ?>
        <?php $cover = !empty($n['cover_image']) ? $n['cover_image'] : ''; ?>
        <div class="news-item" onclick="location.href='news-detail.php?id=<?php echo $n['id']; ?>'" style="cursor:pointer;">
          <?php if (!empty($cover)): ?>
            <div class="news-cover" style="background-image:url('<?php echo htmlspecialchars($cover, ENT_QUOTES, 'UTF-8'); ?>');"></div>
          <?php else: ?>
            <div class="news-cover">📰</div>
          <?php endif; ?>
          <div class="news-content">
            <h3><a href="news-detail.php?id=<?php echo $n['id']; ?>"><?php echo htmlspecialchars($n['title'], ENT_QUOTES, 'UTF-8'); ?></a></h3>
            <div class="meta">
              <?php echo htmlspecialchars($n['category'] ?? '动态', ENT_QUOTES, 'UTF-8'); ?> ·
              <?php echo htmlspecialchars($n['created_at'], ENT_QUOTES, 'UTF-8'); ?> ·
              浏览 <?php echo (int)$n['views']; ?>
            </div>
            <div class="summary"><?php echo htmlspecialchars($n['summary'] ?? mb_substr(strip_tags($n['content'] ?? ''), 0, 120) . '...', ENT_QUOTES, 'UTF-8'); ?></div>
            <a href="news-detail.php?id=<?php echo $n['id']; ?>" class="read-more">阅读全文 &rarr;</a>
          </div>
        </div>
      <?php endforeach; ?>
      <?php if (empty($list)): ?>
        <div class="empty"><div class="icon">📰</div><h3>暂无新闻</h3><p>敬请期待团队的最新动态</p></div>
      <?php endif; ?>
    </div>
    <?php echo View::pagination($page, $totalPages, 'news.php'); ?>
  </div>
</section>

<?php include 'views/layouts/footer.php'; ?>
