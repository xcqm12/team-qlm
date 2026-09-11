<?php
/**
 * 视图 / 工具类
 * 提供模板渲染、转义、分页、消息等常用功能
 */
class View {
    public static function e($str) {
        $out = htmlspecialchars((string)($str ?? ''), ENT_QUOTES, 'UTF-8');
        echo $out;
        return $out;
    }

    public static function siteName() {
        static $name = null;
        if ($name === null) {
            try { $row = Db::fetchOne('SELECT team_name FROM team_info ORDER BY id LIMIT 1'); if ($row) $name = $row['team_name']; } catch (Exception $e) {}
            if (!$name) $name = SITE_NAME;
        }
        return $name;
    }

    public static function info() {
        static $info = null;
        if ($info === null) {
            try { $info = Db::fetchOne('SELECT * FROM team_info ORDER BY id LIMIT 1'); } catch (Exception $e) { $info = []; }
            if (!$info) $info = [];
        }
        return $info;
    }

    public static function setFlash($msg, $type = 'info') {
        $_SESSION['flash_msg'] = $msg;
        $_SESSION['flash_type'] = $type;
    }

    public static function flash() {
        if (empty($_SESSION['flash_msg'])) return '';
        $msg = $_SESSION['flash_msg'];
        $type = $_SESSION['flash_type'] ?? 'info';
        unset($_SESSION['flash_msg'], $_SESSION['flash_type']);
        $colors = array('info' => '#667eea', 'success' => '#48bb78', 'error' => '#f56565', 'warning' => '#ed8936');
        $color = $colors[$type] ?? $colors['info'];
        return '<div style="padding:12px 18px; background:' . $color . '20; border-left:4px solid ' . $color . '; border-radius:6px; margin-bottom:16px; font-size:14px;">' . self::e($msg) . '</div>';
    }

    public static function render($path, $data = array()) {
        extract($data, EXTR_SKIP);
        include VIEWS_PATH . '/' . $path . '.php';
    }

    public static function pagination($page, $totalPages, $baseUrl = '') {
        if ($totalPages <= 1) return '';
        $qs = $_GET; unset($qs['page']);
        $query = http_build_query($qs);
        $sep = strpos($baseUrl, '?') === false ? '?' : '&';
        $html = '<div class="pagination" style="text-align:center; margin:24px 0;">';
        for ($i = 1; $i <= $totalPages; $i++) {
            $url = $baseUrl . $sep . 'page=' . $i . ($query ? '&' . $query : '');
            if ($i == $page) {
                $html .= '<span class="pg-cur">' . $i . '</span>';
            } else {
                $html .= '<a class="pg-link" href="' . $url . '">' . $i . '</a>';
            }
        }
        $html .= '</div>';
        return $html;
    }

    public static function formatDate($date, $format = 'Y-m-d H:i') {
        if (empty($date)) return '-';
        return date($format, is_numeric($date) ? $date : strtotime($date));
    }

    public static function formatSize($bytes) {
        $units = array('B','KB','MB','GB','TB');
        $bytes = max((int)$bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        $bytes /= pow(1024, $pow);
        return round($bytes, 2) . ' ' . $units[$pow];
    }

    public static function post($key, $default = '') { return $_POST[$key] ?? $default; }
    public static function get($key, $default = '') { return $_GET[$key] ?? $default; }

    public static function redirect($url, $msg = '') {
        if ($msg) self::setFlash($msg);
        header('Location: ' . $url);
        exit;
    }
}
?>
