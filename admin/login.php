<?php
require_once '../includes/bootstrap.php';

$msg = '';
$msgType = 'info';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';
    if (Auth::login($username, $password)) {
        header('Location: index.php');
        exit;
    } else {
        $msg = '用户名或密码错误';
        $msgType = 'error';
    }
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>后台登录 - 七零喵团队</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; color: #2d3748; }
.login-box { background: #fff; border-radius: 16px; padding: 40px; width: 100%; max-width: 400px; box-shadow: 0 20px 60px rgba(0,0,0,0.25); }
.logo { text-align: center; font-size: 48px; margin-bottom: 10px; }
.title { text-align: center; font-size: 22px; font-weight: 700; margin-bottom: 6px; color: #2d3748; }
.subtitle { text-align: center; color: #718096; font-size: 14px; margin-bottom: 30px; }
.form-group { margin-bottom: 18px; }
.form-group label { display: block; margin-bottom: 6px; color: #4a5568; font-size: 14px; font-weight: 500; }
.form-input { width: 100%; padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-family: inherit; transition: all 0.2s; }
.form-input:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.15); }
.btn { width: 100%; padding: 12px; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: 600; transition: all 0.2s; }
.btn:hover { transform: translateY(-1px); }
.alert { padding: 12px 16px; background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 6px; margin-bottom: 20px; color: #991b1b; font-size: 14px; }
.footer { text-align: center; margin-top: 20px; font-size: 12px; color: #a0aec0; }
.footer a { color: #667eea; text-decoration: none; }
</style>
</head>
<body>
<div class="login-box">
  <div class="logo">🐾</div>
  <div class="title">七零喵团队后台</div>
  <div class="subtitle">请登录后继续</div>
  <?php if (!empty($msg)): ?><div class="alert"><?php echo htmlspecialchars($msg, ENT_QUOTES, 'UTF-8'); ?></div><?php endif; ?>
  <form method="post">
    <div class="form-group">
      <label>用户名</label>
      <input type="text" name="username" class="form-input" value="<?php echo htmlspecialchars($username ?? '', ENT_QUOTES, 'UTF-8'); ?>" required autofocus>
    </div>
    <div class="form-group">
      <label>密码</label>
      <input type="password" name="password" class="form-input" required>
    </div>
    <button type="submit" class="btn">登 录</button>
  </form>
  <div class="footer"><a href="../index.php">&larr; 返回网站首页</a></div>
</div>
</body>
</html>
