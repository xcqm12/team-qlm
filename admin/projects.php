<?php
require_once '../includes/bootstrap.php';
Auth::requireLogin();

$page = max(1, (int)View::get('page', 1));
$perPage = 20;
$offset = ($page - 1) * $perPage;

$total = Db::rowCount('projects');
$totalPages = ceil($total / $perPage);
$projects = Db::fetchAll('SELECT * FROM projects ORDER BY id DESC LIMIT ' . (int)$offset . ', ' . (int)$perPage);

$msg = '';
$msgType = 'info';
if (!empty($_SESSION['flash_msg'])) {
    $msg = $_SESSION['flash_msg'];
    $msgType = $_SESSION['flash_type'] ?? 'info';
    unset($_SESSION['flash_msg'], $_SESSION['flash_type']);
}
include 'admin-header.php';
?>

<div class="page-header">
  <h2>项目作品管理 <small style="font-size:14px;color:#718096;">共 <?php echo $total; ?> 个项目</small></h2>
  <a href="project-edit.php" class="btn btn-primary">+ 添加项目</a>
</div>

<?php if (!empty($msg)): ?>
<div class="alert alert-<?php echo $msgType; ?>"><?php echo htmlspecialchars($msg, ENT_QUOTES, 'UTF-8'); ?></div>
<?php endif; ?>

<div class="card">
  <table class="table">
    <thead>
      <tr>
        <th width="60">ID</th>
        <th>标题</th>
        <th width="120">分类</th>
        <th width="100">精选</th>
        <th width="100">状态</th>
        <th width="160">操作</th>
      </tr>
    </thead>
    <tbody>
      <?php if (empty($projects)): ?>
      <tr><td colspan="6" style="text-align:center;padding:40px;color:#718096;">暂无项目，点击右上角添加</td></tr>
      <?php else: foreach ($projects as $p): ?>
      <tr>
        <td><?php echo $p['id']; ?></td>
        <td>
          <strong><?php echo htmlspecialchars($p['title'], ENT_QUOTES, 'UTF-8'); ?></strong>
          <?php if (!empty($p['title_en'])): ?><small style="color:#718096;"> / <?php echo htmlspecialchars($p['title_en'], ENT_QUOTES, 'UTF-8'); ?></small><?php endif; ?>
          <?php if (!empty($p['summary'])): ?><div style="color:#718096;font-size:12px;margin-top:4px;"><?php echo htmlspecialchars(mb_substr($p['summary'], 0, 80), ENT_QUOTES, 'UTF-8'); ?>...</div><?php endif; ?>
        </td>
        <td><?php echo htmlspecialchars($p['category'] ?? '-', ENT_QUOTES, 'UTF-8'); ?></td>
        <td><?php echo !empty($p['is_featured']) ? '<span style="color:#f56565;">★ 是</span>' : '否'; ?></td>
        <td><?php echo !empty($p['status']) ? '<span style="color:#48bb78;">启用</span>' : '<span style="color:#718096;">停用</span>'; ?></td>
        <td>
          <a href="project-edit.php?id=<?php echo $p['id']; ?>" class="btn btn-sm">编辑</a>
          <a href="project-detail.php?id=<?php echo $p['id']; ?>" target="_blank" class="btn btn-sm">查看</a>
        </td>
      </tr>
      <?php endforeach; endif; ?>
    </tbody>
  </table>

  <?php if ($totalPages > 1): ?>
  <div class="pagination">
    <?php for ($i = 1; $i <= $totalPages; $i++): ?>
      <?php if ($i == $page): ?>
        <span class="pg-cur"><?php echo $i; ?></span>
      <?php else: ?>
        <a class="pg-link" href="projects.php?page=<?php echo $i; ?>"><?php echo $i; ?></a>
      <?php endif; ?>
    <?php endfor; ?>
  </div>
  <?php endif; ?>
</div>

<?php include 'admin-footer.php'; ?>