<?php
require_once 'includes/bootstrap.php';
$id = (int)($_GET['id'] ?? 0);
if ($id <= 0) { header('Location: news.php'); exit; }
$item = Db::fetchOne('SELECT * FROM news WHERE id = ? AND status = 1', [$id]);
if (!$item) { header('Location: news.php'); exit; }
Db::query('UPDATE news SET views = views + 1 WHERE id = ?', [$id]);
$info = View::info();
$banner = $info['news_banner'] ?? '';
$page_title = $item['title'];
$active_page = 'news.php';
include 'views/layouts/header.php';
?>
<?php include 'views/layouts/nav.php'; ?>

<section class="page-hero <?php if (!empty($banner)) echo 'with-banner'; ?>" <?php if (!empty($banner)) echo "style=\"background-image:url('" . htmlspecialchars($banner, ENT_QUOTES, 'UTF-8') . "');\""; ?>>
  <div class="container"><h1><?php echo htmlspecialchars($info['team_name'] ?? SITE_NAME, ENT_QUOTES, 'UTF-8'); ?> 动态</h1><p>团队最新新闻与动态</p></div>
</section>

<section class="page-content">
  <div class="container">
    <a href="news.php" class="back-btn">&larr; 返回新闻列表</a>
    <article class="article">
      <?php if (!empty($item['cover_image'])): ?>
        <div style="width:100%; height:320px; background-image:url('<?php echo htmlspecialchars($item['cover_image'], ENT_QUOTES, 'UTF-8'); ?>'); background-size:cover; background-position:center; border-radius:12px; margin-bottom:24px;"></div>
      <?php endif; ?>
      <h1><?php echo htmlspecialchars($item['title'], ENT_QUOTES, 'UTF-8'); ?></h1>
      <div class="meta">
        <span><?php echo htmlspecialchars($item['category'] ?? '动态', ENT_QUOTES, 'UTF-8'); ?></span>
        <span> · 发布: <?php echo htmlspecialchars($item['created_at'], ENT_QUOTES, 'UTF-8'); ?></span>
        <span> · 浏览: <?php echo (int)$item['views']; ?></span>
      </div>
      <?php if (!empty($item['summary'])): ?><p style="background:#f7fafc; padding:16px 20px; border-left:4px solid #764ba2; border-radius:0 8px 8px 0; margin:16px 0; color:#4a5568; line-height:1.8;"><?php echo htmlspecialchars($item['summary'], ENT_QUOTES, 'UTF-8'); ?></p><?php endif; ?>
      <div class="content">
        <?php echo $item['content'] ?? ''; ?>
      </div>
    </article>
  </div>
</section>

<?php include 'views/layouts/footer.php'; ?>
