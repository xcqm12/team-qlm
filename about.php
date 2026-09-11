<?php
require_once 'includes/bootstrap.php';
$info = View::info();
$banner = $info['about_banner'] ?? '';
try {
    $members = Db::fetchAll('SELECT * FROM team_members WHERE status = 1 ORDER BY sort_order ASC, id DESC');
} catch (Exception $e) { $members = []; }
$page_title = '关于我们';
$active_page = 'about.php';
include 'views/layouts/header.php';
?>
<?php include 'views/layouts/nav.php'; ?>

<section class="page-hero <?php if (!empty($banner)) echo 'with-banner'; ?>" <?php if (!empty($banner)) echo "style=\"background-image:url('" . htmlspecialchars($banner, ENT_QUOTES, 'UTF-8') . "');\""; ?>>
  <div class="container"><h1>关于我们</h1><p>了解七零喵团队</p></div>
</section>

<section class="page-content">
  <div class="container">
    <?php echo View::flash(); ?>
    <div class="about-grid">
      <div class="about-card">
        <h2><?php echo htmlspecialchars($info['team_name'] ?? SITE_NAME, ENT_QUOTES, 'UTF-8'); ?></h2>
        <p style="line-height:1.9; color:#4a5568; font-size:15px;"><?php echo $info['team_description'] ?? '七零喵团队是由一群游戏爱好者与独立开发者所组建的一个团队。我们热爱创造，热爱分享，致力于为玩家带来优质的游戏内容与体验。'; ?></p>
        <?php if (!empty($info['founded_date'])): ?><p style="margin-top:14px; color:#718096; font-size:14px;">成立日期：<?php echo htmlspecialchars($info['founded_date'], ENT_QUOTES, 'UTF-8'); ?></p><?php endif; ?>
      </div>
      <div class="about-card">
        <h2>团队介绍</h2>
        <p style="line-height:1.9; color:#4a5568; font-size:15px;"><?php echo $info['team_content'] ?? '团队内容主要发布于网易我的世界、CurseForge、Modrinth以及个人站点上，部分代码开源于GitHub。'; ?></p>
      </div>
    </div>

    <?php if (!empty($members)): ?>
    <div class="section-title" style="margin-top:40px;"><h2>团队成员</h2></div>
    <div class="members-grid">
      <?php foreach ($members as $m): ?>
        <div class="member-card">
          <div class="member-avatar" <?php if (!empty($m['avatar'])) echo "style=\"background-image:url('" . htmlspecialchars($m['avatar'], ENT_QUOTES, 'UTF-8') . "');\""; ?>>
            <?php if (empty($m['avatar'])) echo '👤'; ?>
          </div>
          <h4><?php echo htmlspecialchars($m['name'], ENT_QUOTES, 'UTF-8'); ?></h4>
          <div class="position"><?php echo htmlspecialchars($m['position'], ENT_QUOTES, 'UTF-8'); ?></div>
          <div class="bio"><?php echo htmlspecialchars($m['bio'], ENT_QUOTES, 'UTF-8'); ?></div>
        </div>
      <?php endforeach; ?>
    </div>
    <?php endif; ?>
  </div>
</section>

<?php include 'views/layouts/footer.php'; ?>
