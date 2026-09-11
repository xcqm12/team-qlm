<?php
$info = View::info();
$teamLogo = $info['team_logo'] ?? '';
$teamName = $info['team_name'] ?? SITE_NAME;
$active = $active_page ?? basename($_SERVER['PHP_SELF'] ?? '');
try {
    $navs = Db::fetchAll('SELECT * FROM navigation WHERE status = 1 ORDER BY sort_order ASC, id ASC');
} catch (Exception $e) { $navs = []; }
if (empty($navs)) {
    $navs = [
        ['title'=>'首页','url'=>'index.php'],
        ['title'=>'关于我们','url'=>'about.php'],
        ['title'=>'项目作品','url'=>'projects.php'],
        ['title'=>'新闻动态','url'=>'news.php'],
        ['title'=>'文件下载','url'=>'files.php'],
        ['title'=>'联系我们','url'=>'contact.php'],
    ];
}
?>
<nav class="navbar">
  <div class="container nav-inner">
    <a href="index.php" class="nav-brand">
      <?php if (!empty($teamLogo)): ?>
        <img src="<?php echo htmlspecialchars($teamLogo, ENT_QUOTES, 'UTF-8'); ?>" alt="logo" class="nav-logo">
      <?php else: ?>
        <span class="nav-emoji">🐾</span>
      <?php endif; ?>
      <span class="nav-brand-text"><?php echo htmlspecialchars($teamName, ENT_QUOTES, 'UTF-8'); ?></span>
    </a>
    <div class="nav-toggle" onclick="document.getElementById('navMenu').classList.toggle('show');">
      <span></span><span></span><span></span>
    </div>
    <ul class="nav-menu" id="navMenu">
      <?php foreach ($navs as $n): ?>
        <li><a href="<?php echo htmlspecialchars($n['url'], ENT_QUOTES, 'UTF-8'); ?>" class="<?php if (basename($n['url']) === $active) echo 'active'; ?>"><?php echo htmlspecialchars($n['title'], ENT_QUOTES, 'UTF-8'); ?></a></li>
      <?php endforeach; ?>
    </ul>
  </div>
</nav>
