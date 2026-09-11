<?php
require_once 'includes/bootstrap.php';
$id = (int)($_GET['id'] ?? 0);
$file = Db::fetchOne('SELECT * FROM file_manager WHERE id = ? AND is_public = 1', [$id]);
if (!$file) {
    View::setFlash('文件不存在', 'error');
    header('Location: files.php');
    exit;
}
Db::query('UPDATE file_manager SET downloads = downloads + 1 WHERE id = ?', [$id]);
$path = $file['file_path'];
if (filter_var($path, FILTER_VALIDATE_URL)) {
    header('Location: ' . $path);
    exit;
}
$fullPath = __DIR__ . '/' . ltrim($path, '/');
if (file_exists($fullPath)) {
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="' . $file['file_name'] . '"');
    header('Content-Length: ' . filesize($fullPath));
    readfile($fullPath);
    exit;
}
header('Location: ' . $path);
exit;
