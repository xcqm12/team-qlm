<?php
/**
 * 启动文件 - 在所有页面顶部引入
 * 顺序：配置 -> 核心类 -> 公共
 */
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../core/Db.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/View.php';
