<?php
require_once '../includes/bootstrap.php';
Auth::requireLogin();

$action = $_GET['action'] ?? '';
$id = (int)($_GET['id'] ?? 0);

if ($action === 'delete' && $id > 0) {
    Db::delete('team_members', 'id = ?', [$id]);
    View::setFlash('删除成功', 'success');
    header('Location: members.php');
    exit;
}

$item = null;
if ($id > 0) $item = Db::fetchOne('SELECT * FROM team_members WHERE id = ?', [$id]);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = [
        'name' => trim($_POST['name'] ?? ''),
        'position' => trim($_POST['position'] ?? ''),
        'avatar' => trim($_POST['avatar'] ?? ''),
        'bio' => trim($_POST['bio'] ?? ''),
        'github' => trim($_POST['github'] ?? ''),
        'email' => trim($_POST['email'] ?? ''),
        'sort_order' => (int)($_POST['sort_order'] ?? 0),
        'status' => (int)($_POST['status'] ?? 1),
    ];
    if ($id > 0) Db::update('team_members', $data, 'id = ?', [$id]);
    else Db::insert('team_members', $data);
    View::setFlash('保存成功', 'success');
    header('Location: members.php');
    exit;
}

$list = Db::fetchAll('SELECT * FROM team_members ORDER BY sort_order ASC, id DESC');
?>
<?php include 'admin-header.php'; ?>
<div class="admin-page-title"><h1>团队成员</h1><div><a href="members.php?action=edit" class="btn btn-primary">+ 新建成员</a></div></div>
<?php echo View::flash(); ?>

<?php if ($action === 'edit' || $id > 0): ?>
<div class="card">
  <form method="post" class="form-vertical">
    <div class="form-row">
      <div class="form-group"><label>姓名 *</label><input type="text" name="name" class="form-input" value="<?php echo htmlspecialchars($item['name'] ?? '', ENT_QUOTES, 'UTF-8'); ?>" required></div>
      <div class="form-group"><label>职位</label><input type="text" name="position" class="form-input" value="<?php echo htmlspecialchars($item['position'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"></div>
    </div>
    <div class="form-group"><label>头像 URL</label><input type="text" name="avatar" class="form-input" value="<?php echo htmlspecialchars($item['avatar'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"></div>
    <div class="form-group"><label>个人简介</label><textarea name="bio" class="form-input" rows="3"><?php echo htmlspecialchars($item['bio'] ?? '', ENT_QUOTES, 'UTF-8'); ?></textarea></div>
    <div class="form-row">
      <div class="form-group"><label>GitHub</label><input type="text" name="github" class="form-input" value="<?php echo htmlspecialchars($item['github'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"></div>
      <div class="form-group"><label>邮箱</label><input type="email" name="email" class="form-input" value="<?php echo htmlspecialchars($item['email'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>排序</label><input type="number" name="sort_order" class="form-input" value="<?php echo $item['sort_order'] ?? 0; ?>"></div>
      <div class="form-group"><label>状态</label><select name="status" class="form-input"><option value="1" <?php echo ($item['status'] ?? 1) == 1 ? 'selected' : ''; ?>>启用</option><option value="0" <?php echo ($item['status'] ?? 1) == 0 ? 'selected' : ''; ?>>停用</option></select></div>
    </div>
    <div class="form-actions"><button type="submit" class="btn btn-primary">保存</button><a href="members.php" class="btn btn-secondary">取消</a></div>
  </form>
</div>
<?php else: ?>
<div class="card">
  <table class="admin-table">
    <thead><tr><th>ID</th><th>姓名</th><th>职位</th><th>邮箱</th><th>GitHub</th><th>排序</th><th>状态</th><th>操作</th></tr></thead>
    <tbody>
      <?php foreach ($list as $row): ?>
      <tr>
        <td><?php echo $row['id']; ?></td>
        <td><?php echo htmlspecialchars($row['name'], ENT_QUOTES, 'UTF-8'); ?></td>
        <td><?php echo htmlspecialchars($row['position'] ?? '-', ENT_QUOTES, 'UTF-8'); ?></td>
        <td><?php echo htmlspecialchars($row['email'] ?? '-', ENT_QUOTES, 'UTF-8'); ?></td>
        <td><?php echo htmlspecialchars($row['github'] ?? '-', ENT_QUOTES, 'UTF-8'); ?></td>
        <td><?php echo $row['sort_order']; ?></td>
        <td><?php echo $row['status'] ? '<span class="badge badge-active">启用</span>' : '<span class="badge badge-inactive">停用</span>'; ?></td>
        <td><a href="members.php?action=edit&id=<?php echo $row['id']; ?>" class="btn btn-sm btn-link">编辑</a><a href="members.php?action=delete&id=<?php echo $row['id']; ?>" class="btn btn-sm btn-danger" onclick="return confirm('确定删除?');">删除</a></td>
      </tr>
      <?php endforeach; ?>
      <?php if (empty($list)): ?><tr><td colspan="8" class="empty-cell">暂无数据</td></tr><?php endif; ?>
    </tbody>
  </table>
</div>
<?php endif; ?>
<?php include 'admin-footer.php'; ?>
