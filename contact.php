<?php
require_once 'includes/bootstrap.php';
$info = View::info();
$banner = $info['contact_banner'] ?? '';

$msg = '';
$msgType = 'info';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name = trim($_POST['name'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $message = trim($_POST['message'] ?? '');
    if (empty($name) || empty($email) || empty($message)) {
        $msg = '请完整填写所有必填项';
        $msgType = 'error';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $msg = '邮箱格式不正确';
        $msgType = 'error';
    } else {
        $msg = '感谢您的留言！我们会尽快回复您。';
        $msgType = 'success';
    }
}

$page_title = '联系我们';
$active_page = 'contact.php';
include 'views/layouts/header.php';
?>
<?php include 'views/layouts/nav.php'; ?>

<section class="page-hero <?php if (!empty($banner)) echo 'with-banner'; ?>" <?php if (!empty($banner)) echo "style=\"background-image:url('" . htmlspecialchars($banner, ENT_QUOTES, 'UTF-8') . "');\""; ?>>
  <div class="container"><h1>联系我们</h1><p>欢迎与我们交流合作</p></div>
</section>

<section class="page-content">
  <div class="container">
    <?php if (!empty($msg)): ?>
      <div style="padding:14px 18px; background:<?php echo $msgType === 'error' ? '#fef2f2' : '#f0fdf4'; ?>; border-left:4px solid <?php echo $msgType === 'error' ? '#ef4444' : '#22c55e'; ?>; border-radius:8px; margin-bottom:20px; color:#4a5568; font-size:14px;"><?php echo htmlspecialchars($msg, ENT_QUOTES, 'UTF-8'); ?></div>
    <?php endif; ?>

    <div class="contact-wrap">
      <div class="contact-info" <?php if (!empty($banner)) echo "style=\"background-image:url('" . htmlspecialchars($banner, ENT_QUOTES, 'UTF-8') . "');\""; ?>>
        <h3>联系方式</h3>
        <div class="subtitle" style="color:rgba(255,255,255,0.85); margin-bottom:20px;">期待与您的合作</div>
        <?php if (!empty($info['contact_email'])): ?>
          <div class="contact-item"><div class="label">EMAIL</div><div class="value"><a href="mailto:<?php echo htmlspecialchars($info['contact_email'], ENT_QUOTES, 'UTF-8'); ?>" style="color:#fff;"><?php echo htmlspecialchars($info['contact_email'], ENT_QUOTES, 'UTF-8'); ?></a></div></div>
        <?php endif; ?>
        <?php if (!empty($info['contact_qq'])): ?>
          <div class="contact-item"><div class="label">QQ</div><div class="value"><?php echo htmlspecialchars($info['contact_qq'], ENT_QUOTES, 'UTF-8'); ?></div></div>
        <?php endif; ?>
        <?php if (!empty($info['contact_wechat'])): ?>
          <div class="contact-item"><div class="label">微信</div><div class="value"><?php echo htmlspecialchars($info['contact_wechat'], ENT_QUOTES, 'UTF-8'); ?></div></div>
        <?php endif; ?>
        <?php if (!empty($info['contact_address'])): ?>
          <div class="contact-item"><div class="label">地址</div><div class="value"><?php echo htmlspecialchars($info['contact_address'], ENT_QUOTES, 'UTF-8'); ?></div></div>
        <?php endif; ?>
        <?php if (!empty($info['contact_worktime'])): ?>
          <div class="contact-item"><div class="label">工作时间</div><div class="value"><?php echo htmlspecialchars($info['contact_worktime'], ENT_QUOTES, 'UTF-8'); ?></div></div>
        <?php endif; ?>
      </div>

      <div class="contact-form">
        <h3>给我们留言</h3>
        <p style="color:#718096; font-size:14px; margin-bottom:20px;">有任何问题或建议，欢迎留言告诉我们</p>
        <form method="post" class="form-vertical">
          <div class="form-group">
            <label>您的称呼 *</label>
            <input type="text" name="name" class="form-control" value="<?php echo htmlspecialchars($_POST['name'] ?? '', ENT_QUOTES, 'UTF-8'); ?>" required>
          </div>
          <div class="form-group">
            <label>邮箱地址 *</label>
            <input type="email" name="email" class="form-control" value="<?php echo htmlspecialchars($_POST['email'] ?? '', ENT_QUOTES, 'UTF-8'); ?>" required>
          </div>
          <div class="form-group">
            <label>留言内容 *</label>
            <textarea name="message" class="form-control" rows="6" required><?php echo htmlspecialchars($_POST['message'] ?? '', ENT_QUOTES, 'UTF-8'); ?></textarea>
          </div>
          <div class="form-actions"><button type="submit" class="btn-primary">发送留言</button></div>
        </form>
      </div>
    </div>
  </div>
</section>

<?php include 'views/layouts/footer.php'; ?>
