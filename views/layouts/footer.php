<?php
$info = View::info();
$teamName = $info['team_name'] ?? SITE_NAME;
$copyright = $info['site_copyright'] ?? '&copy; ' . date('Y') . ' ' . $teamName;
try {
    $platforms = Db::fetchAll('SELECT * FROM platform_links WHERE status = 1 ORDER BY sort_order ASC, id ASC');
} catch (Exception $e) { $platforms = []; }
?>
<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-col">
        <h4>关于 <?php echo htmlspecialchars($teamName, ENT_QUOTES, 'UTF-8'); ?></h4>
        <p><?php echo htmlspecialchars($info['team_slogan'] ?? '', ENT_QUOTES, 'UTF-8'); ?></p>
      </div>
      <div class="footer-col">
        <h4>联系方式</h4>
        <p>邮箱: <?php echo htmlspecialchars($info['contact_email'] ?? '', ENT_QUOTES, 'UTF-8'); ?></p>
        <?php if (!empty($info['contact_address'])): ?><p>地址: <?php echo htmlspecialchars($info['contact_address'], ENT_QUOTES, 'UTF-8'); ?></p><?php endif; ?>
        <?php if (!empty($info['contact_worktime'])): ?><p>时间: <?php echo htmlspecialchars($info['contact_worktime'], ENT_QUOTES, 'UTF-8'); ?></p><?php endif; ?>
      </div>
      <div class="footer-col">
        <h4>发布平台</h4>
        <?php foreach ($platforms as $p): ?>
          <p><a href="<?php echo htmlspecialchars($p['platform_url'], ENT_QUOTES, 'UTF-8'); ?>" target="_blank" rel="noopener"><?php echo htmlspecialchars($p['platform_name'], ENT_QUOTES, 'UTF-8'); ?> &rarr;</a></p>
        <?php endforeach; ?>
      </div>
    </div>
    <div class="footer-bottom">
      <span><?php echo $copyright; ?></span>
      <span class="footer-admin"><a href="admin/login.php" style="color:#a0aec0;">后台管理</a></span>
    </div>
  </div>
</footer>
<script src="assets/js/main.js"></script>
</body>
</html>
