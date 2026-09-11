<?php
require_once '../includes/bootstrap.php';
Auth::requireLogin();

$page = max(1, (int)($_GET['page'] ?? 1));
$perPage = 20;
$total = Db::rowCount('news', '1=1');
$offset = ($page - 1) * $perPage;
$list = Db::fetchAll('SELECT * FROM news ORDER BY id DESC LIMIT ' . $perPage . ' OFFSET ' . $offset);
$totalPages = ceil($total / $perPage);
?>
<?php include 'admin-header.php'; ?>
<div class="admin-page-title">
  <h1>新闻动态</h1>
  <div>
    <a href="news-edit.php" class="btn btn-primary">+ 新建新闻</a>
  </div>
</div>

<?php echo View::flash(); ?>

<div class="card">
  <table class="admin-table">
    <thead>
      <tr>
        <th>ID</th>
        <th>标题</th>
        <th>分类</th>
        <th>状态</th>
        <th>浏览</th>
        <th>创建时间</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      <?php foreach ($list as $row): ?>
      <tr>
        <td><?php echo $row['id']; ?></td>
        <td><?php echo htmlspecialchars($row['title'], ENT_QUOTES, 'UTF-8'); ?></td>
        <td><?php echo htmlspecialchars($row['category'] ?? '-', ENT_QUOTES, 'UTF-8'); ?></td>
        <td><?php echo $row['status'] ? '<span class="badge badge-active">启用</span>' : '<span class="badge badge-inactive">停用</span>'; ?></td>
        <td><?php echo (int)$row['views']; ?></td>
        <td><?php echo htmlspecialchars($row['created_at'], ENT_QUOTES, 'UTF-8'); ?></td>
        <td>
          <a href="news-edit.php?id=<?php echo $row['id']; ?>" class="btn btn-sm btn-link">编辑</a>
          <a href="news.php?action=delete&id=<?php echo $row['id']; ?>" class="btn btn-sm btn-danger" onclick="return confirm('确定删除?');">删除</a>
        </td>
      </tr>
      <?php endforeach; ?>
      <?php if (empty($list)): ?>
      <tr><td colspan="7" class="empty-cell">暂无数据</td></tr>
      <?php endif; ?>
    </tbody>
  </table>
</div>

<?php echo View::pagination($page, $totalPages, 'news.php'); ?>

<?php include 'admin-footer.php'; ?>
