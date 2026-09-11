<?php
require_once '../includes/bootstrap.php';
Auth::requireLogin();

$info = Db::fetchOne('SELECT * FROM team_info ORDER BY id LIMIT 1') ?: [];
$hasInfo = !empty($info);
$msg = '';
$msgType = 'info';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = [
        'team_name' => trim($_POST['team_name'] ?? ''),
        'team_name_en' => trim($_POST['team_name_en'] ?? ''),
        'team_logo' => trim($_POST['team_logo'] ?? ''),
        'team_slogan' => trim($_POST['team_slogan'] ?? ''),
        'team_description' => trim($_POST['team_description'] ?? ''),
        'team_content' => trim($_POST['team_content'] ?? ''),
        'founded_date' => trim($_POST['founded_date'] ?? ''),
        'contact_email' => trim($_POST['contact_email'] ?? ''),
        'contact_qq' => trim($_POST['contact_qq'] ?? ''),
        'contact_wechat' => trim($_POST['contact_wechat'] ?? ''),
        'contact_address' => trim($_POST['contact_address'] ?? ''),
        'contact_worktime' => trim($_POST['contact_worktime'] ?? ''),
        'contact_banner' => trim($_POST['contact_banner'] ?? ''),
        'hero_banner' => trim($_POST['hero_banner'] ?? ''),
        'about_banner' => trim($_POST['about_banner'] ?? ''),
        'projects_banner' => trim($_POST['projects_banner'] ?? ''),
        'news_banner' => trim($_POST['news_banner'] ?? ''),
        'files_banner' => trim($_POST['files_banner'] ?? ''),
        'default_project_cover' => trim($_POST['default_project_cover'] ?? ''),
        'default_news_cover' => trim($_POST['default_news_cover'] ?? ''),
        'site_keywords' => trim($_POST['site_keywords'] ?? ''),
        'site_description' => trim($_POST['site_description'] ?? ''),
        'site_ico' => trim($_POST['site_ico'] ?? ''),
        'site_copyright' => trim($_POST['site_copyright'] ?? ''),
    ];
    if (empty($data['team_name'])) { $data['team_name'] = '七零喵团队'; }
    try {
        if ($hasInfo) {
            Db::update('team_info', $data, 'id = ?', [$info['id']]);
        } else {
            Db::insert('team_info', $data);
        }
        $msg = '保存成功！';
        $msgType = 'success';
        $info = Db::fetchOne('SELECT * FROM team_info ORDER BY id LIMIT 1');
    } catch (Exception $e) {
        $msg = '保存失败: ' . $e->getMessage();
        $msgType = 'error';
    }
}
?>
<?php include 'admin-header.php'; ?>
<div class="admin-page-title"><h1>站点设置</h1></div>
<?php if (!empty($msg)): ?><div class="alert alert-<?php echo $msgType; ?>"><?php echo htmlspecialchars($msg, ENT_QUOTES, 'UTF-8'); ?></div><?php endif; ?>

<div class="card">
  <form method="post" class="form-vertical">
    <h3 style="color:#4a5568; margin-bottom:16px; padding-bottom:10px; border-bottom:1px solid #edf2f7;">基本信息</h3>
    <div class="form-row">
      <div class="form-group"><label>团队名称 *</label><input type="text" name="team_name" class="form-input" value="<?php echo htmlspecialchars($info['team_name'] ?? '七零喵团队', ENT_QUOTES, 'UTF-8'); ?>" required></div>
      <div class="form-group"><label>英文名</label><input type="text" name="team_name_en" class="form-input" value="<?php echo htmlspecialchars($info['team_name_en'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"></div>
    </div>
    <div class="form-group"><label>Logo URL</label><input type="text" name="team_logo" class="form-input" value="<?php echo htmlspecialchars($info['team_logo'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"></div>
    <div class="form-group"><label>团队口号 (slogan)</label><input type="text" name="team_slogan" class="form-input" value="<?php echo htmlspecialchars($info['team_slogan'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"></div>
    <div class="form-group"><label>团队简介</label><textarea name="team_description" class="form-input" rows="3"><?php echo htmlspecialchars($info['team_description'] ?? '', ENT_QUOTES, 'UTF-8'); ?></textarea></div>
    <div class="form-group"><label>团队详情 / 关于我们内容</label><textarea name="team_content" class="form-input" rows="5"><?php echo htmlspecialchars($info['team_content'] ?? '', ENT_QUOTES, 'UTF-8'); ?></textarea></div>
    <div class="form-group"><label>成立日期</label><input type="date" name="founded_date" class="form-input" value="<?php echo htmlspecialchars($info['founded_date'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"></div>

    <h3 style="color:#4a5568; margin:24px 0 16px; padding-bottom:10px; border-bottom:1px solid #edf2f7;">联系方式</h3>
    <div class="form-row">
      <div class="form-group"><label>邮箱</label><input type="email" name="contact_email" class="form-input" value="<?php echo htmlspecialchars($info['contact_email'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"></div>
      <div class="form-group"><label>QQ</label><input type="text" name="contact_qq" class="form-input" value="<?php echo htmlspecialchars($info['contact_qq'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"></div>
      <div class="form-group"><label>微信</label><input type="text" name="contact_wechat" class="form-input" value="<?php echo htmlspecialchars($info['contact_wechat'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>地址</label><input type="text" name="contact_address" class="form-input" value="<?php echo htmlspecialchars($info['contact_address'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"></div>
      <div class="form-group"><label>工作时间</label><input type="text" name="contact_worktime" class="form-input" value="<?php echo htmlspecialchars($info['contact_worktime'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"></div>
    </div>

    <h3 style="color:#4a5568; margin:24px 0 16px; padding-bottom:10px; border-bottom:1px solid #edf2f7;">横幅图片配置 (Banner)</h3>
    <div class="form-group"><label>首页横幅图 (hero_banner)</label><input type="text" name="hero_banner" class="form-input" value="<?php echo htmlspecialchars($info['hero_banner'] ?? '', ENT_QUOTES, 'UTF-8'); ?>" placeholder="https://example.com/hero.jpg"></div>
    <div class="form-group"><label>关于我们横幅图 (about_banner)</label><input type="text" name="about_banner" class="form-input" value="<?php echo htmlspecialchars($info['about_banner'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"></div>
    <div class="form-group"><label>项目作品横幅图 (projects_banner)</label><input type="text" name="projects_banner" class="form-input" value="<?php echo htmlspecialchars($info['projects_banner'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"></div>
    <div class="form-group"><label>新闻动态横幅图 (news_banner)</label><input type="text" name="news_banner" class="form-input" value="<?php echo htmlspecialchars($info['news_banner'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"></div>
    <div class="form-group"><label>文件下载横幅图 (files_banner)</label><input type="text" name="files_banner" class="form-input" value="<?php echo htmlspecialchars($info['files_banner'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"></div>
    <div class="form-group"><label>联系我们横幅图 (contact_banner)</label><input type="text" name="contact_banner" class="form-input" value="<?php echo htmlspecialchars($info['contact_banner'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"></div>
    <div class="form-row">
      <div class="form-group"><label>默认项目封面图</label><input type="text" name="default_project_cover" class="form-input" value="<?php echo htmlspecialchars($info['default_project_cover'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"></div>
      <div class="form-group"><label>默认新闻封面图</label><input type="text" name="default_news_cover" class="form-input" value="<?php echo htmlspecialchars($info['default_news_cover'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"></div>
    </div>

    <h3 style="color:#4a5568; margin:24px 0 16px; padding-bottom:10px; border-bottom:1px solid #edf2f7;">SEO 与其他</h3>
    <div class="form-group"><label>站点关键词</label><input type="text" name="site_keywords" class="form-input" value="<?php echo htmlspecialchars($info['site_keywords'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"></div>
    <div class="form-group"><label>站点描述</label><textarea name="site_description" class="form-input" rows="2"><?php echo htmlspecialchars($info['site_description'] ?? '', ENT_QUOTES, 'UTF-8'); ?></textarea></div>
    <div class="form-row">
      <div class="form-group"><label>站点图标 (favicon URL)</label><input type="text" name="site_ico" class="form-input" value="<?php echo htmlspecialchars($info['site_ico'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"></div>
      <div class="form-group"><label>版权信息</label><input type="text" name="site_copyright" class="form-input" value="<?php echo htmlspecialchars($info['site_copyright'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"></div>
    </div>

    <div class="form-actions"><button type="submit" class="btn btn-primary">保存设置</button></div>
  </form>
</div>
<?php include 'admin-footer.php'; ?>
