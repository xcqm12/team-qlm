<?php
require_once '../includes/bootstrap.php';
Auth::logout();
header('Location: login.php');
exit;
?>
