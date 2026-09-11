<?php
/**
 * 七零喵团队 V2 - 核心配置文件
 * 定义所有站点常量：数据库连接、路径、上传配置等
 */

// ---------------- 数据库配置 ----------------
$dbConfig = array(
    'host' => '127.0.0.1',
    'port' => '3306',
    'name' => 'qiling_team',
    'user' => 'root',
    'pass' => '',
    'charset' => 'utf8mb4',
);

$configLocalFile = __DIR__ . '/config.local.php';
if (file_exists($configLocalFile)) {
    $localDbConfig = require $configLocalFile;
    if (is_array($localDbConfig)) {
        $dbConfig = array_merge($dbConfig, $localDbConfig);
    }
}

define('DB_HOST', $dbConfig['host']);
define('DB_PORT', $dbConfig['port']);
define('DB_NAME', $dbConfig['name']);
define('DB_USER', $dbConfig['user']);
define('DB_PASS', $dbConfig['pass']);
define('DB_CHARSET', $dbConfig['charset']);

// ---------------- 路径配置 ----------------
// 使用 PHP 预定义常量 DIRECTORY_SEPARATOR，避免反斜杠转义问题
define('ROOT_PATH', rtrim(str_replace(DIRECTORY_SEPARATOR, '/', dirname(__DIR__)), '/'));
define('CONFIG_PATH', ROOT_PATH . '/config');
define('CORE_PATH',   ROOT_PATH . '/core');
define('VIEWS_PATH',  ROOT_PATH . '/views');
define('UPLOAD_DIR',  ROOT_PATH . '/uploads');

// ---------------- URL 自动检测 ----------------
function get_site_url_v2() {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $scriptDir = dirname($_SERVER['PHP_SELF'] ?? '/');
    $scriptDir = rtrim(str_replace(DIRECTORY_SEPARATOR, '/', $scriptDir), '/');
    if ($scriptDir === '.') $scriptDir = '';
    return rtrim($protocol . '://' . $host . $scriptDir, '/');
}
define('SITE_URL', get_site_url_v2());
define('UPLOAD_URL', SITE_URL . '/uploads');

// ---------------- 站点信息 ----------------
define('SITE_NAME', '七零喵团队');
define('SITE_EN', 'Seven Zero Meow Team');
define('SITE_EMAIL', 'qlm@qlm.org.cn');
define('DEBUG', false);

// ---------------- 上传配置 ----------------
define('MAX_UPLOAD_SIZE', 100 * 1024 * 1024);
define('ALLOWED_EXT', array('jpg','jpeg','png','gif','webp','pdf','doc','docx','xls','xlsx','zip','rar','7z','tar','gz','jar','json','txt','md','js','css','html','php','java','py','cpp','c','h','mp4','avi','mov','wmv','mp3','wav'));
define('IMAGE_EXT', array('jpg','jpeg','png','gif','webp'));

// ---------------- 时区 / 错误报告 ----------------
date_default_timezone_set('Asia/Shanghai');
ini_set('display_errors', DEBUG ? '1' : '0');
error_reporting(DEBUG ? E_ALL : 0);

// ---------------- Session ----------------
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// ---------------- 安装检测 ----------------
$installedLock = ROOT_PATH . '/installed.lock';
$isInstallPage = basename($_SERVER['PHP_SELF'] ?? '') === 'install.php';
if (!$isInstallPage && !file_exists($installedLock)) {
    try {
        $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
        $pdo = new PDO($dsn, DB_USER, DB_PASS, array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION));
        $pdo->query('SELECT 1 FROM team_info LIMIT 1');
        @file_put_contents($installedLock, date('Y-m-d H:i:s'));
    } catch (Exception $e) {
        header('Location: ' . SITE_URL . '/install.php');
        exit;
    }
}
