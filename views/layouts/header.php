<?php
$info = View::info();
$title = $page_title ?? '';
$fullTitle = $title ? $title . ' - ' . View::siteName() : View::siteName();
$keywords = $info['site_keywords'] ?? '';
$description = $info['site_description'] ?? View::siteName();
$favicon = $info['site_ico'] ?? '';
$teamLogo = $info['team_logo'] ?? '';
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?php echo $fullTitle; ?></title>
<?php if (!empty($keywords)): ?><meta name="keywords" content="<?php echo htmlspecialchars($keywords, ENT_QUOTES, 'UTF-8'); ?>"><?php endif; ?>
<?php if (!empty($description)): ?><meta name="description" content="<?php echo htmlspecialchars($description, ENT_QUOTES, 'UTF-8'); ?>"><?php endif; ?>
<?php if (!empty($favicon)): ?><link rel="shortcut icon" href="<?php echo htmlspecialchars($favicon, ENT_QUOTES, 'UTF-8'); ?>"><?php endif; ?>
<link rel="stylesheet" href="assets/css/main.css">
<link rel="stylesheet" href="assets/css/theme.css">
</head>
<body>
