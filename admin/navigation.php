<?php
require_once '../includes/bootstrap.php';
Auth::requireLogin();

$action = $_GET['action'] ?? '';
$id = (int)($_GET['id'] ?? 0);

if ($action === 'delete' && $id > 0) {
    Db::delete('navigation', 'id = ?', [$id]);
    View::setFlash('删除成功', 'success');
    header('Location: navigation.php');
    exit;
}

$item = null;
if ($id > 0) $item = Db::fetchOne('SELECT * FROM navigation WHERE id = ?', [$id]);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = [
        'title' => trim($_POST['title'] ?? ''),
        'url' => trim($_POST['url'] ?? ''),
        'target' => trim($_POST['target'] ?? '_self'),
        'sort_order' => (int)($_POST['sort_order'] ?? 0),
        'status' => (int)($_POST['status'] ?? 1),
    ];
    if ($id > 0) Db::update('navigation', $data, 'id = ?', [$id]);
    else Db::insert('navigation', $data);
    View::setFlash('保存成功', 'success');
    header('Location: navigation.php');
    exit;
}

$list = Db::fetchAll('SELECT * FROM navigation ORDER BY sort_order ASC, id DESC');
?>
<?php include 'admin-header.php'; ?>
<div class="admin-page-title"><h1>导航菜单</h1><div><a href="navigation.php?action=edit" class="btn btn-primary">+ 新建导航项</a></div></div>
<?php echo View::flash(); ?>

<?php if ($action === 'edit' || $id > 0): ?>
<div class="card">
  <form method="post" class="form-vertical">
    <div class="form-row">
      <div class="form-group"><label>菜单标题 *</label><input type="text" name="title" class="form-input" value="<?php echo htmlspecialchars($item['title'] ?? '', ENT_QUOTES, 'UTF-8'); ?>" required></div>
      <div class="form-group"><label>链接地址 *</label><input type="text" name="url" class="form-input" value="<?php echo htmlspecialchars($item['url'] ?? '', ENT_QUOTES, 'UTF-8'); ?>" required placeholder="index.php 或 https://example.com"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>打开方式</label><select name="target" class="form-input"><option value="_self" <?php echo ($item['target'] ?? '_self') === '_self' ? 'selected' : ''; ?>>当前窗口</option><option value="_blank" <?php echo ($item['target'] ?? '_self') === '_blank' ? 'selected' : ''; ?>>新窗口</option></select></div>
      <div class="form-group"><label>排序</label><input type="number" name="sort_order" class="form-input" value="<?php echo $item['sort_order'] ?? 0; ?>"></div>
      <div class="form-group"><label>状态</label><select name="status" class="form-input"><option value="1" <?php echo ($item['status'] ?? 1) == 1 ? 'selected' : ''; ?>>启用</option><option value="0" <?php echo ($item['status'] ?? 1) == 0 ? 'selected' : ''; ?>>停用</option></select></div>
    </div>
    <div class="form-actions"><button type="submit" class="btn btn-primary">保存</button><a href="navigation.php" class="btn btn-secondary">取消</a></div>
  </form>
</div>
<?php else: ?>
<div class="card">
  <table class="admin-table">
    <thead><tr><th>ID</th><th>标题</th><th>链接</th><th>打开方式</th><th>排序</th><th>状态</th><th>操作</th></tr></thead>
    <tbody>
      <?php foreach ($list as $row): ?>
      <tr>
        <td><?php echo $row['id']; ?></td>
        <td><?php echo htmlspecialchars($row['title'], ENT_QUOTES, 'UTF-8'); ?></td>
        <td style="color:#667eea;"><?php echo htmlspecialchars($row['url'], ENT_QUOTES, 'UTF-8'); ?></td>
        <td><?php echo htmlspecialchars($row['target'], ENT_QUOTES, 'UTF-8'); ?></td>
        <td><?php echo $row['sort_order']; ?></td>
        <td><?php echo $row['status'] ? '<span class="badge badge-active">启用</span>' : '<span class="badge badge-inactive">停用</span>'; ?></td>
        <td><a href="navigation.php?action=edit&id=<?php echo $row['id']; ?>" class="btn btn-sm btn-link">编辑</a><a href="navigation.php?action=delete&id=<?php echo $row['id']; ?>" class="btn btn-sm btn-danger" onclick="return confirm('确定删除?');">删除</a></td>
      </tr>
      <?php endforeach; ?>
      <?php if (empty($list)): ?><tr><td colspan="7" class="empty-cell">暂无数据，请创建导航项</td></tr><?php endif; ?>
    </tbody>
  </table>
</div>
<?php endif; ?>
<?php include 'admin-footer.php'; ?>
