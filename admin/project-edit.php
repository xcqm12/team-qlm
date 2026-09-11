<?php
require_once '../includes/bootstrap.php';
Auth::requireLogin();

$id = (int)($_GET['id'] ?? 0);
$item = null;
if ($id > 0) {
    $item = Db::fetchOne('SELECT * FROM projects WHERE id = ?', [$id]);
}

$msg = '';
$msgType = 'info';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = [
        'title' => trim($_POST['title'] ?? ''),
        'title_en' => trim($_POST['title_en'] ?? ''),
        'cover_image' => trim($_POST['cover_image'] ?? ''),
        'summary' => trim($_POST['summary'] ?? ''),
        'content' => $_POST['content'] ?? '',
        'category' => trim($_POST['category'] ?? ''),
        'version' => trim($_POST['version'] ?? ''),
        'download_url' => trim($_POST['download_url'] ?? ''),
        'github_url' => trim($_POST['github_url'] ?? ''),
        'platform' => trim($_POST['platform'] ?? ''),
        'is_featured' => (int)($_POST['is_featured'] ?? 0),
        'status' => (int)($_POST['status'] ?? 1),
    ];
    if (empty($data['title'])) {
        $msg = '标题不能为空';
        $msgType = 'error';
    } else {
        try {
            if ($id > 0) {
                Db::update('projects', $data, 'id = ?', [$id]);
                $msg = '更新成功';
                $msgType = 'success';
            } else {
                $newId = Db::insert('projects', $data);
                $msg = '创建成功';
                $msgType = 'success';
                header('Location: project-edit.php?id=' . $newId . '&msg=' . urlencode($msg));
                exit;
            }
        } catch (Exception $e) {
            $msg = '操作失败: ' . $e->getMessage();
            $msgType = 'error';
        }
    }
    $item = Db::fetchOne('SELECT * FROM projects WHERE id = ?', [$id > 0 ? $id : ($newId ?? 0)]);
}
?>
<?php include 'admin-header.php'; ?>
<div class="admin-page-title">
  <a href="projects.php" class="back-btn">&larr; 返回项目列表</a>
  <h1><?php echo $id > 0 ? '编辑项目' : '新建项目'; ?></h1>
</div>

<?php if (!empty($msg)): ?>
<div class="alert alert-<?php echo $msgType; ?>"><?php echo htmlspecialchars($msg, ENT_QUOTES, 'UTF-8'); ?></div>
<?php endif; ?>

<div class="card">
  <form method="post" class="form-vertical">
    <div class="form-row">
      <div class="form-group" style="flex: 2;">
        <label>项目名称 *</label>
        <input type="text" name="title" class="form-input" value="<?php echo htmlspecialchars($item['title'] ?? '', ENT_QUOTES, 'UTF-8'); ?>" required>
      </div>
      <div class="form-group">
        <label>英文名</label>
        <input type="text" name="title_en" class="form-input" value="<?php echo htmlspecialchars($item['title_en'] ?? '', ENT_QUOTES, 'UTF-8'); ?>">
      </div>
    </div>
    <div class="form-group">
      <label>封面图 URL</label>
      <input type="text" name="cover_image" class="form-input" value="<?php echo htmlspecialchars($item['cover_image'] ?? '', ENT_QUOTES, 'UTF-8'); ?>" placeholder="https://example.com/cover.jpg">
    </div>
    <div class="form-group">
      <label>项目简介</label>
      <textarea name="summary" class="form-input" rows="2"><?php echo htmlspecialchars($item['summary'] ?? '', ENT_QUOTES, 'UTF-8'); ?></textarea>
    </div>
    <div class="form-group">
      <label>项目详情</label>
      <textarea name="content" class="form-input" rows="8"><?php echo htmlspecialchars($item['content'] ?? '', ENT_QUOTES, 'UTF-8'); ?></textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>分类</label>
        <input type="text" name="category" class="form-input" value="<?php echo htmlspecialchars($item['category'] ?? '', ENT_QUOTES, 'UTF-8'); ?>">
      </div>
      <div class="form-group">
        <label>版本</label>
        <input type="text" name="version" class="form-input" value="<?php echo htmlspecialchars($item['version'] ?? '', ENT_QUOTES, 'UTF-8'); ?>">
      </div>
      <div class="form-group">
        <label>平台</label>
        <input type="text" name="platform" class="form-input" value="<?php echo htmlspecialchars($item['platform'] ?? '', ENT_QUOTES, 'UTF-8'); ?>">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>下载链接</label>
        <input type="text" name="download_url" class="form-input" value="<?php echo htmlspecialchars($item['download_url'] ?? '', ENT_QUOTES, 'UTF-8'); ?>">
      </div>
      <div class="form-group">
        <label>GitHub 链接</label>
        <input type="text" name="github_url" class="form-input" value="<?php echo htmlspecialchars($item['github_url'] ?? '', ENT_QUOTES, 'UTF-8'); ?>">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>是否精选</label>
        <select name="is_featured" class="form-input">
          <option value="0" <?php echo ($item['is_featured'] ?? 0) == 0 ? 'selected' : ''; ?>>否</option>
          <option value="1" <?php echo ($item['is_featured'] ?? 0) == 1 ? 'selected' : ''; ?>>是</option>
        </select>
      </div>
      <div class="form-group">
        <label>状态</label>
        <select name="status" class="form-input">
          <option value="1" <?php echo ($item['status'] ?? 1) == 1 ? 'selected' : ''; ?>>启用</option>
          <option value="0" <?php echo ($item['status'] ?? 1) == 0 ? 'selected' : ''; ?>>停用</option>
        </select>
      </div>
    </div>
    <div class="form-actions">
      <button type="submit" class="btn btn-primary">保存</button>
      <a href="projects.php" class="btn btn-secondary">取消</a>
    </div>
  </form>
</div>
<?php include 'admin-footer.php'; ?>
