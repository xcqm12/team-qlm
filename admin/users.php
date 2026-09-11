<?php
require_once '../includes/bootstrap.php';
Auth::requireLogin();
if (!Auth::isSuper()) {
    View::setFlash('无权限访问', 'error');
    header('Location: index.php');
    exit;
}

$list = Db::fetchAll('SELECT * FROM admin_users ORDER BY id');
?>
<?php include 'admin-header.php'; ?>
<div class="admin-page-title"><h1>管理员用户</h1></div>
<?php echo View::flash(); ?>
<div class="card">
  <table class="admin-table">
    <thead>
      <tr><th>ID</th><th>用户名</th><th>昵称</th><th>邮箱</th><th>角色</th><th>状态</th><th>最后登录</th><th>操作</th></tr>
    </thead>
    <tbody>
      <?php foreach ($list as $u): ?>
      <tr>
        <td><?php echo $u['id']; ?></td>
        <td><?php echo htmlspecialchars($u['username'], ENT_QUOTES, 'UTF-8'); ?></td>
        <td><?php echo htmlspecialchars($u['nickname'] ?? '-', ENT_QUOTES, 'UTF-8'); ?></td>
        <td><?php echo htmlspecialchars($u['email'] ?? '-', ENT_QUOTES, 'UTF-8'); ?></td>
        <td><?php echo $u['role'] == 2 ? '<span class="badge badge-active">超级管理员</span>' : '<span class="badge badge-inactive">普通</span>'; ?></td>
        <td><?php echo $u['status'] ? '<span class="badge badge-active">启用</span>' : '<span class="badge badge-inactive">停用</span>'; ?></td>
        <td><?php echo htmlspecialchars($u['last_login_time'] ?? '-', ENT_QUOTES, 'UTF-8'); ?></td>
        <td><a href="user-edit.php?id=<?php echo $u['id']; ?>" class="btn btn-sm btn-link">编辑</a></td>
      </tr>
      <?php endforeach; ?>
    </tbody>
  </table>
  <div style="margin-top: 16px; text-align: right;">
    <a href="user-edit.php" class="btn btn-primary">+ 新建用户</a>
  </div>
</div>
<?php include 'admin-footer.php'; ?>
