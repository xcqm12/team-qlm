<?php
require_once '../includes/bootstrap.php';
Auth::requireLogin();

$action = $_GET['action'] ?? '';
$id = (int)($_GET['id'] ?? 0);

if ($action === 'delete' && $id > 0) {
    Db::delete('platform_links', 'id = ?', [$id]);
    View::setFlash('删除成功', 'success');
    header('Location: platforms.php');
    exit;
}

$item = null;
if ($id > 0) $item = Db::fetchOne('SELECT * FROM platform_links WHERE id = ?', [$id]);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = [
        'platform_name' => trim($_POST['platform_name'] ?? ''),
        'platform_icon' => trim($_POST['platform_icon'] ?? ''),
        'platform_url' => trim($_POST['platform_url'] ?? ''),
        'platform_desc' => trim($_POST['platform_desc'] ?? ''),
        'sort_order' => (int)($_POST['sort_order'] ?? 0),
        'status' => (int)($_POST['status'] ?? 1),
    ];
    if ($id > 0) Db::update('platform_links', $data, 'id = ?', [$id]);
    else Db::insert('platform_links', $data);
    View::setFlash('保存成功', 'success');
    header('Location: platforms.php');
    exit;
}

$list = Db::fetchAll('SELECT * FROM platform_links ORDER BY sort_order ASC, id DESC');
?>
<?php include 'admin-header.php'; ?>
<div class="admin-page-title"><h1>发布平台</h1><div><a href="platforms.php?action=edit" class="btn btn-primary">+ 新建平台</a></div></div>
<?php echo View::flash(); ?>

<?php if ($action === 'edit' || $id > 0): ?>
<div class="card">
  <form method="post" class="form-vertical">
    <div class="form-row">
      <div class="form-group"><label>平台名称 *</label><input type="text" name="platform_name" class="form-input" value="<?php echo htmlspecialchars($item['platform_name'] ?? '', ENT_QUOTES, 'UTF-8'); ?>" required></div>
      <div class="form-group"><label>图标 (URL 或 emoji)</label><input type="text" name="platform_icon" class="form-input" value="<?php echo htmlspecialchars($item['platform_icon'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"></div>
    </div>
    <div class="form-group"><label>平台链接 *</label><input type="text" name="platform_url" class="form-input" value="<?php echo htmlspecialchars($item['platform_url'] ?? '', ENT_QUOTES, 'UTF-8'); ?>" required></div>
    <div class="form-group"><label>平台描述</label><textarea name="platform_desc" class="form-input" rows="2"><?php echo htmlspecialchars($item['platform_desc'] ?? '', ENT_QUOTES, 'UTF-8'); ?></textarea></div>
    <div class="form-row">
      <div class="form-group"><label>排序</label><input type="number" name="sort_order" class="form-input" value="<?php echo $item['sort_order'] ?? 0; ?>"></div>
      <div class="form-group"><label>状态</label><select name="status" class="form-input"><option value="1" <?php echo ($item['status'] ?? 1) == 1 ? 'selected' : ''; ?>>启用</option><option value="0" <?php echo ($item['status'] ?? 1) == 0 ? 'selected' : ''; ?>>停用</option></select></div>
    </div>
    <div class="form-actions"><button type="submit" class="btn btn-primary">保存</button><a href="platforms.php" class="btn btn-secondary">取消</a></div>
  </form>
</div>
<?php else: ?>
<div class="card">
  <table class="admin-table">
    <thead><tr><th>ID</th><th>平台名称</th><th>图标</th><th>链接</th><th>排序</th><th>状态</th><th>操作</th></tr></thead>
    <tbody>
      <?php foreach ($list as $row): ?>
      <tr>
        <td><?php echo $row['id']; ?></td>
        <td><?php echo htmlspecialchars($row['platform_name'], ENT_QUOTES, 'UTF-8'); ?></td>
        <td><?php echo htmlspecialchars($row['platform_icon'] ?? '-', ENT_QUOTES, 'UTF-8'); ?></td>
        <td style="color:#667eea;"><?php echo htmlspecialchars($row['platform_url'], ENT_QUOTES, 'UTF-8'); ?></td>
        <td><?php echo $row['sort_order']; ?></td>
        <td><?php echo $row['status'] ? '<span class="badge badge-active">启用</span>' : '<span class="badge badge-inactive">停用</span>'; ?></td>
        <td><a href="platforms.php?action=edit&id=<?php echo $row['id']; ?>" class="btn btn-sm btn-link">编辑</a><a href="platforms.php?action=delete&id=<?php echo $row['id']; ?>" class="btn btn-sm btn-danger" onclick="return confirm('确定删除?');">删除</a></td>
      </tr>
      <?php endforeach; ?>
      <?php if (empty($list)): ?><tr><td colspan="7" class="empty-cell">暂无数据</td></tr><?php endif; ?>
    </tbody>
  </table>
</div>
<?php endif; ?>
<?php include 'admin-footer.php'; ?>
