<?php
require_once '../includes/bootstrap.php';
Auth::requireLogin();
if (!Auth::isSuper()) { header('Location: index.php'); exit; }

$id = (int)($_GET['id'] ?? 0);
$item = $id > 0 ? Db::fetchOne('SELECT * FROM admin_users WHERE id = ?', [$id]) : null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = [
        'username' => trim($_POST['username'] ?? ''),
        'nickname' => trim($_POST['nickname'] ?? ''),
        'email' => trim($_POST['email'] ?? ''),
        'role' => (int)($_POST['role'] ?? 1),
        'status' => (int)($_POST['status'] ?? 1),
    ];
    if (!empty($_POST['password'])) {
        $data['password'] = password_hash(trim($_POST['password']), PASSWORD_DEFAULT);
    }
    try {
        if ($id > 0) {
            Db::update('admin_users', $data, 'id = ?', [$id]);
            $msg = '更新成功';
        } else {
            if (empty($_POST['password'])) { $msg = '请输入密码'; $msgType = 'error'; }
            else {
                Db::insert('admin_users', $data);
                $msg = '创建成功';
            }
        }
        View::setFlash($msg, $msgType ?? 'success');
        header('Location: users.php'); exit;
    } catch (Exception $e) {
        $msg = '操作失败: ' . $e->getMessage();
    }
}
?>
<?php include 'admin-header.php'; ?>
<div class="admin-page-title">
  <a href="users.php" class="back-btn">&larr; 返回</a>
  <h1><?php echo $id > 0 ? '编辑用户' : '新建用户'; ?></h1>
</div>
<?php if (!empty($msg)): ?><div class="alert alert-error"><?php echo htmlspecialchars($msg, ENT_QUOTES, 'UTF-8'); ?></div><?php endif; ?>
<div class="card">
  <form method="post" class="form-vertical">
    <div class="form-row">
      <div class="form-group"><label>用户名 *</label><input type="text" name="username" class="form-input" value="<?php echo htmlspecialchars($item['username'] ?? '', ENT_QUOTES, 'UTF-8'); ?>" required></div>
      <div class="form-group"><label>昵称</label><input type="text" name="nickname" class="form-input" value="<?php echo htmlspecialchars($item['nickname'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"></div>
    </div>
    <div class="form-group"><label>邮箱</label><input type="email" name="email" class="form-input" value="<?php echo htmlspecialchars($item['email'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"></div>
    <div class="form-row">
      <div class="form-group"><label>密码 <?php echo $id > 0 ? '(留空则不修改)' : '*'; ?></label><input type="password" name="password" class="form-input" placeholder="至少6位"></div>
      <div class="form-group"><label>角色</label>
        <select name="role" class="form-input">
          <option value="1" <?php echo ($item['role'] ?? 1) == 1 ? 'selected' : ''; ?>>普通管理员</option>
          <option value="2" <?php echo ($item['role'] ?? 1) == 2 ? 'selected' : ''; ?>>超级管理员</option>
        </select>
      </div>
      <div class="form-group"><label>状态</label>
        <select name="status" class="form-input">
          <option value="1" <?php echo ($item['status'] ?? 1) == 1 ? 'selected' : ''; ?>>启用</option>
          <option value="0" <?php echo ($item['status'] ?? 1) == 0 ? 'selected' : ''; ?>>停用</option>
        </select>
      </div>
    </div>
    <div class="form-actions">
      <button type="submit" class="btn btn-primary">保存</button>
      <a href="users.php" class="btn btn-secondary">取消</a>
    </div>
  </form>
</div>
<?php include 'admin-footer.php'; ?>
