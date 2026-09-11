<?php
require_once '../includes/bootstrap.php';
Auth::requireLogin();

$id = (int)($_GET['id'] ?? 0);
$item = null;
if ($id > 0) {
    $item = Db::fetchOne('SELECT * FROM news WHERE id = ?', [$id]);
}

$msg = '';
$msgType = 'info';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = [
        'title' => trim($_POST['title'] ?? ''),
        'cover_image' => trim($_POST['cover_image'] ?? ''),
        'summary' => trim($_POST['summary'] ?? ''),
        'content' => $_POST['content'] ?? '',
        'category' => trim($_POST['category'] ?? '动态'),
        'status' => (int)($_POST['status'] ?? 1),
    ];
    if (empty($data['title'])) {
        $msg = '标题不能为空';
        $msgType = 'error';
    } else {
        try {
            if ($id > 0) {
                Db::update('news', $data, 'id = ?', [$id]);
                $msg = '更新成功';
                $msgType = 'success';
            } else {
                $newId = Db::insert('news', $data);
                $msg = '创建成功';
                $msgType = 'success';
                header('Location: news-edit.php?id=' . $newId . '&msg=' . urlencode($msg));
                exit;
            }
        } catch (Exception $e) {
            $msg = '操作失败: ' . $e->getMessage();
            $msgType = 'error';
        }
    }
}
?>
<?php include 'admin-header.php'; ?>
<div class="admin-page-title">
  <a href="news.php" class="back-btn">&larr; 返回新闻列表</a>
  <h1><?php echo $id > 0 ? '编辑新闻' : '新建新闻'; ?></h1>
</div>

<?php if (!empty($msg)): ?>
<div class="alert alert-<?php echo $msgType; ?>"><?php echo htmlspecialchars($msg, ENT_QUOTES, 'UTF-8'); ?></div>
<?php endif; ?>

<div class="card">
  <form method="post" class="form-vertical">
    <div class="form-group">
      <label>标题 *</label>
      <input type="text" name="title" class="form-input" value="<?php echo htmlspecialchars($item['title'] ?? '', ENT_QUOTES, 'UTF-8'); ?>" required>
    </div>
    <div class="form-group">
      <label>封面图 URL</label>
      <input type="text" name="cover_image" class="form-input" value="<?php echo htmlspecialchars($item['cover_image'] ?? '', ENT_QUOTES, 'UTF-8'); ?>">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>分类</label>
        <input type="text" name="category" class="form-input" value="<?php echo htmlspecialchars($item['category'] ?? '动态', ENT_QUOTES, 'UTF-8'); ?>">
      </div>
      <div class="form-group">
        <label>状态</label>
        <select name="status" class="form-input">
          <option value="1" <?php echo ($item['status'] ?? 1) == 1 ? 'selected' : ''; ?>>启用</option>
          <option value="0" <?php echo ($item['status'] ?? 1) == 0 ? 'selected' : ''; ?>>停用</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>摘要</label>
      <textarea name="summary" class="form-input" rows="2"><?php echo htmlspecialchars($item['summary'] ?? '', ENT_QUOTES, 'UTF-8'); ?></textarea>
    </div>
    <div class="form-group">
      <label>正文内容</label>
      <textarea name="content" class="form-input" rows="12"><?php echo htmlspecialchars($item['content'] ?? '', ENT_QUOTES, 'UTF-8'); ?></textarea>
    </div>
    <div class="form-actions">
      <button type="submit" class="btn btn-primary">保存</button>
      <a href="news.php" class="btn btn-secondary">取消</a>
    </div>
  </form>
</div>
<?php include 'admin-footer.php'; ?>
