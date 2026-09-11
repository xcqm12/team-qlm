<?php
require_once '../includes/bootstrap.php';
Auth::requireLogin();

$action = $_GET['action'] ?? '';
$id = (int)($_GET['id'] ?? 0);

if ($action === 'delete' && $id > 0) {
    Db::delete('file_manager', 'id = ?', [$id]);
    View::setFlash('删除成功', 'success');
    header('Location: files.php');
    exit;
}

$item = null;
if ($id > 0) $item = Db::fetchOne('SELECT * FROM file_manager WHERE id = ?', [$id]);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $file_url = trim($_POST['file_url'] ?? '');
    $file_name = trim($_POST['file_name'] ?? '');
    $file_size = (int)($_POST['file_size'] ?? 0);
    $file_ext = trim($_POST['file_ext'] ?? '');
    $file_type = trim($_POST['file_type'] ?? 'other');
    $category = trim($_POST['category'] ?? 'other');
    $description = trim($_POST['description'] ?? '');
    $is_public = (int)($_POST['is_public'] ?? 1);

    if (!empty($_FILES['file_upload']['name'])) {
        $uploadDir = __DIR__ . '/../uploads/';
        if (!is_dir($uploadDir)) @mkdir($uploadDir, 0755, true);
        $fileName = $_FILES['file_upload']['name'];
        $fileExt = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        $safeName = 'file_' . date('YmdHis') . '_' . mt_rand(1000, 9999) . '.' . $fileExt;
        $filePath = $uploadDir . $safeName;
        if (move_uploaded_file($_FILES['file_upload']['tmp_name'], $filePath)) {
            $file_url = 'uploads/' . $safeName;
            $file_size = $_FILES['file_upload']['size'];
            $file_ext = $fileExt;
            if (empty($file_name)) $file_name = $fileName;
        }
    }

    if (empty($file_name)) $file_name = '未命名文件';
    $data = [
        'file_name' => $file_name,
        'file_path' => $file_url,
        'file_size' => $file_size > 0 ? $file_size : 1024,
        'file_ext' => $file_ext,
        'file_type' => $file_type,
        'category' => $category,
        'description' => $description,
        'is_public' => $is_public,
        'uploader_id' => Auth::id(),
    ];

    if ($id > 0) Db::update('file_manager', $data, 'id = ?', [$id]);
    else Db::insert('file_manager', $data);
    View::setFlash('保存成功', 'success');
    header('Location: files.php');
    exit;
}

$list = Db::fetchAll('SELECT * FROM file_manager ORDER BY id DESC');
?>
<?php include 'admin-header.php'; ?>
<div class="admin-page-title"><h1>文件管理</h1><div><a href="files.php?action=edit" class="btn btn-primary">+ 上传/添加文件</a></div></div>
<?php echo View::flash(); ?>

<?php if ($action === 'edit' || $id > 0): ?>
<div class="card">
  <form method="post" enctype="multipart/form-data" class="form-vertical">
    <div class="form-group">
      <label>上传文件 (可选)</label>
      <input type="file" name="file_upload" class="form-input" style="padding:8px;">
      <small style="color:#718096; font-size:12px;">或在下方手动填写外部链接</small>
    </div>
    <div class="form-row">
      <div class="form-group"><label>文件名 *</label><input type="text" name="file_name" class="form-input" value="<?php echo htmlspecialchars($item['file_name'] ?? '', ENT_QUOTES, 'UTF-8'); ?>" required></div>
      <div class="form-group"><label>文件扩展名</label><input type="text" name="file_ext" class="form-input" value="<?php echo htmlspecialchars($item['file_ext'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"></div>
    </div>
    <div class="form-group"><label>文件 URL (外部链接或上传后的路径)</label><input type="text" name="file_url" class="form-input" value="<?php echo htmlspecialchars($item['file_path'] ?? '', ENT_QUOTES, 'UTF-8'); ?>" placeholder="https://example.com/file.zip 或 uploads/xxx.zip"></div>
    <div class="form-row">
      <div class="form-group"><label>文件大小 (字节)</label><input type="number" name="file_size" class="form-input" value="<?php echo $item['file_size'] ?? 0; ?>"></div>
      <div class="form-group"><label>分类</label><input type="text" name="category" class="form-input" value="<?php echo htmlspecialchars($item['category'] ?? '其他', ENT_QUOTES, 'UTF-8'); ?>"></div>
      <div class="form-group"><label>公开</label><select name="is_public" class="form-input"><option value="1" <?php echo ($item['is_public'] ?? 1) == 1 ? 'selected' : ''; ?>>公开</option><option value="0" <?php echo ($item['is_public'] ?? 1) == 0 ? 'selected' : ''; ?>>仅后台</option></select></div>
    </div>
    <div class="form-group"><label>描述</label><textarea name="description" class="form-input" rows="2"><?php echo htmlspecialchars($item['description'] ?? '', ENT_QUOTES, 'UTF-8'); ?></textarea></div>
    <div class="form-actions"><button type="submit" class="btn btn-primary">保存</button><a href="files.php" class="btn btn-secondary">取消</a></div>
  </form>
</div>
<?php else: ?>
<div class="card">
  <table class="admin-table">
    <thead><tr><th>ID</th><th>文件名</th><th>分类</th><th>大小</th><th>下载次数</th><th>公开</th><th>更新时间</th><th>操作</th></tr></thead>
    <tbody>
      <?php foreach ($list as $row): ?>
      <tr>
        <td><?php echo $row['id']; ?></td>
        <td><?php echo htmlspecialchars($row['file_name'], ENT_QUOTES, 'UTF-8'); ?> <small style="color:#a0aec0;">.<?php echo htmlspecialchars($row['file_ext'], ENT_QUOTES, 'UTF-8'); ?></small></td>
        <td><?php echo htmlspecialchars($row['category'], ENT_QUOTES, 'UTF-8'); ?></td>
        <td><?php echo round($row['file_size']/1024/1024, 2); ?> MB</td>
        <td><?php echo (int)$row['downloads']; ?></td>
        <td><?php echo $row['is_public'] ? '<span class="badge badge-active">公开</span>' : '<span class="badge badge-inactive">私有</span>'; ?></td>
        <td><?php echo htmlspecialchars($row['updated_at'], ENT_QUOTES, 'UTF-8'); ?></td>
        <td><a href="../download.php?id=<?php echo $row['id']; ?>" class="btn btn-sm btn-link" target="_blank">下载</a><a href="files.php?action=edit&id=<?php echo $row['id']; ?>" class="btn btn-sm btn-link">编辑</a><a href="files.php?action=delete&id=<?php echo $row['id']; ?>" class="btn btn-sm btn-danger" onclick="return confirm('确定删除?');">删除</a></td>
      </tr>
      <?php endforeach; ?>
      <?php if (empty($list)): ?><tr><td colspan="8" class="empty-cell">暂无文件</td></tr><?php endif; ?>
    </tbody>
  </table>
</div>
<?php endif; ?>
<?php include 'admin-footer.php'; ?>
