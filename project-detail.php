<?php
require_once 'includes/bootstrap.php';
$id = (int)($_GET['id'] ?? 0);
if ($id <= 0) { header('Location: projects.php'); exit; }
$item = Db::fetchOne('SELECT * FROM projects WHERE id = ? AND status = 1', [$id]);
if (!$item) { header('Location: projects.php'); exit; }
Db::query('UPDATE projects SET views = views + 1 WHERE id = ?', [$id]);
$info = View::info();
$banner = $info['projects_banner'] ?? '';
$defaultProjectCover = $info['default_project_cover'] ?? '';
$page_title = $item['title'];
$active_page = 'projects.php';
include 'views/layouts/header.php';
?>
<?php include 'views/layouts/nav.php'; ?>

<section class="page-hero <?php if (!empty($banner)) echo 'with-banner'; ?>" <?php if (!empty($banner)) echo "style=\"background-image:url('" . htmlspecialchars($banner, ENT_QUOTES, 'UTF-8') . "');\""; ?>>
  <div class="container"><h1><?php echo htmlspecialchars($item['title'], ENT_QUOTES, 'UTF-8'); ?></h1></div>
</section>

<section class="page-content">
  <div class="container">
    <a href="projects.php" class="back-btn">&larr; 返回项目列表</a>
    <article class="article">
      <?php $cover = !empty($item['cover_image']) ? $item['cover_image'] : $defaultProjectCover; ?>
      <?php if (!empty($cover)): ?>
        <div style="width:100%; height:320px; background-image:url('<?php echo htmlspecialchars($cover, ENT_QUOTES, 'UTF-8'); ?>'); background-size:cover; background-position:center; border-radius:12px; margin-bottom:24px;"></div>
      <?php endif; ?>
      <h1><?php echo htmlspecialchars($item['title'], ENT_QUOTES, 'UTF-8'); ?></h1>
      <?php if (!empty($item['title_en'])): ?><div class="subtitle" style="font-size:18px; color:#718096; margin-top:4px;"><?php echo htmlspecialchars($item['title_en'], ENT_QUOTES, 'UTF-8'); ?></div><?php endif; ?>
      <div class="meta">
        <span>分类: <?php echo htmlspecialchars($item['category'] ?? '未分类', ENT_QUOTES, 'UTF-8'); ?></span>
        <?php if (!empty($item['version'])): ?><span> · 版本: <?php echo htmlspecialchars($item['version'], ENT_QUOTES, 'UTF-8'); ?></span><?php endif; ?>
        <?php if (!empty($item['platform'])): ?><span> · 平台: <?php echo htmlspecialchars($item['platform'], ENT_QUOTES, 'UTF-8'); ?></span><?php endif; ?>
        <span> · 浏览: <?php echo (int)$item['views']; ?></span>
        <span> · 更新于: <?php echo htmlspecialchars($item['updated_at'], ENT_QUOTES, 'UTF-8'); ?></span>
      </div>
      <?php if (!empty($item['summary'])): ?><p style="background:#f7fafc; padding:16px 20px; border-left:4px solid #764ba2; border-radius:0 8px 8px 0; margin:16px 0; color:#4a5568; line-height:1.8;"><?php echo htmlspecialchars($item['summary'], ENT_QUOTES, 'UTF-8'); ?></p><?php endif; ?>
      <div class="content">
        <?php echo $item['content'] ?? ''; ?>
      </div>
      <?php if (!empty($item['download_url']) || !empty($item['github_url'])): ?>
      <div style="margin-top:32px; padding:20px; background:linear-gradient(135deg,#667eea,#764ba2); border-radius:12px; display:flex; gap:12px; flex-wrap:wrap;">
        <?php if (!empty($item['download_url'])): ?>
          <a href="<?php echo htmlspecialchars($item['download_url'], ENT_QUOTES, 'UTF-8'); ?>" target="_blank" rel="noopener" style="display:inline-block; padding:12px 24px; background:#fff; color:#764ba2; border-radius:8px; font-weight:600;">&#128229; 下载</a>
        <?php endif; ?>
        <?php if (!empty($item['github_url'])): ?>
          <a href="<?php echo htmlspecialchars($item['github_url'], ENT_QUOTES, 'UTF-8'); ?>" target="_blank" rel="noopener" style="display:inline-block; padding:12px 24px; background:rgba(255,255,255,0.15); color:#fff; border:2px solid #fff; border-radius:8px; font-weight:600;">&#128187; GitHub</a>
        <?php endif; ?>
      </div>
      <?php endif; ?>
    </article>
  </div>
</section>

<?php include 'views/layouts/footer.php'; ?>
