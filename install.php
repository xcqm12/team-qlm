<?php
/**
 * 七零喵团队 V2 安装脚本
 * 首次访问时自动初始化数据库
 */
error_reporting(E_ALL);
ini_set('display_errors', 1);

$step = (int)($_GET['step'] ?? 1);
$configFile = __DIR__ . '/config/config.php';
$installedFile = __DIR__ . '/installed.lock';
$allowReinstall = isset($_GET['reinstall']) || isset($_GET['reset']);

// 数据库配置输入 / 保存
$dbHost = $_POST['db_host'] ?? '127.0.0.1';
$dbPort = $_POST['db_port'] ?? '3306';
$dbName = $_POST['db_name'] ?? 'qiling_team';
$dbUser = $_POST['db_user'] ?? 'root';
$dbPass = $_POST['db_pass'] ?? '';
$adminUser = $_POST['admin_user'] ?? 'admin';
$adminPass = $_POST['admin_pass'] ?? 'admin123';

$msg = '';
$msgType = 'info';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // 测试连接
    try {
        $pdo = new PDO('mysql:host=' . $dbHost . ';port=' . $dbPort . ';charset=utf8mb4', $dbUser, $dbPass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);

        // 创建数据库
        $pdo->exec('CREATE DATABASE IF NOT EXISTS `' . $dbName . '` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        $pdo->exec('USE `' . $dbName . '`');

        // 读取并执行 SQL 脚本
        $sqlFile = __DIR__ . '/sql/install.sql';
        if (!file_exists($sqlFile)) {
            throw new Exception('SQL 文件未找到: ' . $sqlFile);
        }
        $sqlContent = file_get_contents($sqlFile);
        // 移除注释
        $sqlContent = preg_replace('/--.*$/m', '', $sqlContent);
        $sqlContent = preg_replace('/\/\*[\s\S]*?\*\//', '', $sqlContent);

        // 按分号拆分语句
        $statements = array_filter(array_map('trim', explode(";\n", $sqlContent)));
        $executed = 0;
        foreach ($statements as $stmt) {
            if (!empty($stmt) && substr($stmt, 0, 2) !== '--') {
                try {
                    $pdo->exec($stmt);
                    $executed++;
                } catch (PDOException $e) {
                    // 忽略表已存在的错误
                    if (strpos($e->getMessage(), 'already exists') === false) {
                        error_log('SQL Error: ' . $e->getMessage() . ' | Statement: ' . substr($stmt, 0, 100));
                    }
                }
            }
        }

        // 更新管理员账号
        $adminPassHash = password_hash($adminPass, PASSWORD_DEFAULT);
        $affected = $pdo->exec('UPDATE admin_users SET username = ' . $pdo->quote($adminUser) . ', password = ' . $pdo->quote($adminPassHash) . ', nickname = ' . $pdo->quote($adminUser) . ' WHERE id = 1');
        if ($affected === 0 || $affected === false) {
            $pdo->exec('INSERT INTO admin_users (username, password, nickname, role, status) VALUES (' . $pdo->quote($adminUser) . ', ' . $pdo->quote($adminPassHash) . ', ' . $pdo->quote($adminUser) . ', 2, 1)');
        }

        // 写入配置文件（更可靠的方式：逐行匹配替换 + 失败检测）
        if (!file_exists($configFile)) {
            throw new Exception('配置文件不存在: ' . $configFile);
        }
        $configContent = @file_get_contents($configFile);
        if ($configContent === false) {
            throw new Exception('无法读取配置文件，请检查文件权限: ' . $configFile);
        }
        if (!is_writable($configFile)) {
            throw new Exception('配置文件不可写，请修改权限: ' . $configFile . ' (建议 0666 或 0644)');
        }

        // 方式一：逐行替换（最可靠，避免正则转义问题）
        $lines = explode("\n", $configContent);
        $newLines = [];
        $replacements = [
            'DB_HOST' => $dbHost,
            'DB_PORT' => $dbPort,
            'DB_NAME' => $dbName,
            'DB_USER' => $dbUser,
            'DB_PASS' => $dbPass,
        ];
        $replacedCount = 0;
        foreach ($lines as $line) {
            $matched = false;
            foreach ($replacements as $const => $val) {
                if (preg_match('/define\s*\(\s*[\'"]' . preg_quote($const, '/') . '[\'"]/', $line)) {
                    $escapedVal = str_replace("'", "\\'", str_replace("\\", "\\\\", $val));
                    $newLines[] = "define('" . $const . "', '" . $escapedVal . "');";
                    $matched = true;
                    $replacedCount++;
                    break;
                }
            }
            if (!$matched) $newLines[] = $line;
        }
        $newContent = implode("\n", $newLines);

        // 确保至少替换了 5 个 DB_* 常量
        if ($replacedCount < 5) {
            throw new Exception('配置文件写入失败：仅替换了 ' . $replacedCount . ' 个常量（预期 5 个），配置文件格式可能不兼容');
        }

        // 原子写入：先写临时文件再替换（避免写入过程中断）
        $tmpFile = $configFile . '.tmp.' . time();
        if (@file_put_contents($tmpFile, $newContent) === false) {
            throw new Exception('无法写入配置文件，请检查目录权限');
        }
        if (!@rename($tmpFile, $configFile)) {
            @unlink($tmpFile);
            // 回退方式：直接写入
            if (@file_put_contents($configFile, $newContent) === false) {
                throw new Exception('无法写入配置文件 ' . $configFile . '，请检查文件和目录权限');
            }
        }
        @chmod($configFile, 0644);

        // 写入已安装标记
        file_put_contents($installedFile, date('Y-m-d H:i:s'));

        $msg = '安装成功！已执行 ' . $executed . ' 条 SQL 语句。请使用您设置的账号登录后台。';
        $msgType = 'success';
        $step = 3;
    } catch (Exception $e) {
        $msg = '安装失败: ' . $e->getMessage();
        $msgType = 'error';
    }
}

// 如果已安装，跳到第3步完成提示（除非通过 ?reinstall=1 请求重新安装）
if (file_exists($installedFile) && !$allowReinstall && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    $step = 3;
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>七零喵团队 V2 - 安装向导</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; color: #2d3748; }
.install-box { background: #fff; border-radius: 16px; padding: 40px; max-width: 600px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.25); }
.logo { text-align: center; font-size: 40px; margin-bottom: 8px; }
.title { text-align: center; font-size: 24px; font-weight: 700; margin-bottom: 6px; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.subtitle { text-align: center; color: #718096; font-size: 14px; margin-bottom: 30px; }
.steps { display: flex; justify-content: center; gap: 8px; margin-bottom: 30px; }
.step-item { flex: 1; padding: 10px; background: #edf2f7; border-radius: 8px; text-align: center; font-size: 13px; color: #718096; font-weight: 500; }
.step-item.active { background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; }
.form-group { margin-bottom: 18px; }
.form-group label { display: block; margin-bottom: 6px; color: #4a5568; font-size: 14px; font-weight: 500; }
.form-control { width: 100%; padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-family: inherit; transition: all 0.2s; }
.form-control:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.15); }
.form-row { display: flex; gap: 12px; }
.form-row .form-group { flex: 1; }
.btn { padding: 12px 28px; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: 600; transition: transform 0.2s; display: inline-block; }
.btn:hover { transform: translateY(-1px); }
.btn-secondary { background: #edf2f7; color: #4a5568; }
.form-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px; }
.alert { padding: 14px 18px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; font-weight: 500; }
.alert-success { background: #f0fdf4; border-left: 4px solid #22c55e; color: #166534; }
.alert-error { background: #fef2f2; border-left: 4px solid #ef4444; color: #991b1b; }
.alert-info { background: #eff6ff; border-left: 4px solid #3b82f6; color: #1e40af; }
.checklist { background: #f7fafc; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
.checklist li { list-style: none; padding: 6px 0; color: #4a5568; font-size: 14px; }
.checklist li::before { content: '\2713'; color: #22c55e; margin-right: 8px; font-weight: 700; }
.success-box { text-align: center; padding: 20px 0; }
.success-emoji { font-size: 80px; margin-bottom: 16px; }
.info-box { background: linear-gradient(135deg, rgba(102,126,234,0.08), rgba(118,75,162,0.08)); padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid rgba(102,126,234,0.2); }
.info-box h4 { color: #4a5568; margin-bottom: 8px; font-size: 15px; }
.info-box p { color: #718096; font-size: 13px; line-height: 1.7; }
</style>
</head>
<body>
<div class="install-box">
  <div class="logo">🐾</div>
  <div class="title">七零喵团队 V2</div>
  <div class="subtitle">团队官网系统安装向导</div>

  <div class="steps">
    <div class="step-item <?php echo $step >= 1 ? 'active' : ''; ?>">1. 环境检测</div>
    <div class="step-item <?php echo $step >= 2 ? 'active' : ''; ?>">2. 数据库配置</div>
    <div class="step-item <?php echo $step >= 3 ? 'active' : ''; ?>">3. 完成</div>
  </div>

  <?php if ($step === 1): ?>
    <?php
    $checks = [
        'PHP 版本 >= 7.3' => version_compare(PHP_VERSION, '7.3.0', '>='),
        'PDO MySQL 扩展' => extension_loaded('pdo_mysql'),
        'config/config.php 可写' => is_writable($configFile),
        'uploads/ 目录可写' => is_writable(__DIR__ . '/uploads'),
    ];
    $allPass = true;
    foreach ($checks as $k => $v) if (!$v) $allPass = false;
    ?>
    <ul class="checklist">
      <?php foreach ($checks as $label => $pass): ?>
        <li><?php echo $label; ?> <?php echo $pass ? '' : '<span style="color:#ef4444;">(未通过)</span>'; ?></li>
      <?php endforeach; ?>
    </ul>
    <div class="info-box">
      <h4>安装说明</h4>
      <p>本系统基于 PHP + MySQL 开发。请确保您已经创建好数据库账号并拥有 CREATE TABLE 权限。安装过程会自动创建所需的数据库表和初始数据。</p>
    </div>
    <div class="form-actions">
      <a href="?step=2" class="btn btn-secondary">重新检测</a>
      <a href="?step=2" class="btn">下一步：配置数据库</a>
    </div>

  <?php elseif ($step === 2): ?>
    <?php if (!empty($msg)): ?><div class="alert alert-<?php echo $msgType; ?>"><?php echo htmlspecialchars($msg, ENT_QUOTES, 'UTF-8'); ?></div><?php endif; ?>
    <form method="post" action="?step=3">
      <div class="info-box">
        <h4>数据库连接信息</h4>
        <p>请填写您的 MySQL 数据库连接信息，系统将自动创建数据库表。</p>
      </div>
      <div class="form-row">
        <div class="form-group"><label>数据库主机</label><input type="text" name="db_host" class="form-control" value="<?php echo htmlspecialchars($dbHost, ENT_QUOTES, 'UTF-8'); ?>" required></div>
        <div class="form-group"><label>端口</label><input type="text" name="db_port" class="form-control" value="<?php echo htmlspecialchars($dbPort, ENT_QUOTES, 'UTF-8'); ?>" required></div>
      </div>
      <div class="form-group"><label>数据库名</label><input type="text" name="db_name" class="form-control" value="<?php echo htmlspecialchars($dbName, ENT_QUOTES, 'UTF-8'); ?>" required></div>
      <div class="form-row">
        <div class="form-group"><label>数据库用户名</label><input type="text" name="db_user" class="form-control" value="<?php echo htmlspecialchars($dbUser, ENT_QUOTES, 'UTF-8'); ?>" required></div>
        <div class="form-group"><label>数据库密码</label><input type="text" name="db_pass" class="form-control" value="<?php echo htmlspecialchars($dbPass, ENT_QUOTES, 'UTF-8'); ?>"></div>
      </div>
      <div class="info-box" style="margin-top:16px;">
        <h4>管理员账号</h4>
        <p>设置后台管理的初始账号和密码。</p>
      </div>
      <div class="form-row">
        <div class="form-group"><label>管理员用户名</label><input type="text" name="admin_user" class="form-control" value="<?php echo htmlspecialchars($adminUser, ENT_QUOTES, 'UTF-8'); ?>" required></div>
        <div class="form-group"><label>管理员密码</label><input type="text" name="admin_pass" class="form-control" value="<?php echo htmlspecialchars($adminPass, ENT_QUOTES, 'UTF-8'); ?>" required></div>
      </div>
      <div class="form-actions">
        <a href="?step=1" class="btn btn-secondary">返回上一步</a>
        <button type="submit" class="btn">开始安装</button>
      </div>
    </form>

  <?php else: ?>
    <div class="success-box">
      <div class="success-emoji">🎉</div>
      <div class="title" style="font-size:20px; margin-bottom:8px; -webkit-text-fill-color: unset; color: #2d3748; background:none;">安装成功！</div>
      <div class="subtitle">七零喵团队 V2 系统已成功安装到您的服务器</div>
      <?php if (!empty($msg)): ?><div class="alert alert-<?php echo $msgType; ?>"><?php echo htmlspecialchars($msg, ENT_QUOTES, 'UTF-8'); ?></div><?php endif; ?>
      <div class="info-box">
        <h4>下一步操作</h4>
        <p style="text-align:left;">
          1. 访问首页查看站点效果<br>
          2. 登录后台管理（admin/login.php）完善团队信息、添加项目和新闻<br>
          3. 在站点设置中配置站点名称、Logo、横幅图等
        </p>
      </div>
      <div class="form-actions" style="justify-content:center;">
        <a href="index.php" class="btn">访问网站首页</a>
        <a href="admin/login.php" class="btn btn-secondary">登录后台管理</a>
      </div>
      <div style="margin-top:20px; padding:12px; background:#fef2f2; border-radius:8px; color:#991b1b; font-size:13px;">
        ⚠️ 安全提示：安装完成后，请考虑删除 install.php 文件或限制其访问权限
      </div>
    </div>
  <?php endif; ?>
</div>
</body>
</html>