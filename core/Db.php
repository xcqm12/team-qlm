<?php
/**
 * 数据库封装类 - PDO 单例
 * 提供 query / fetchAll / fetchOne / insert / update / delete / rowCount
 */
class Db {
    private static $pdo = null;

    public static function conn() {
        if (self::$pdo === null) {
            try {
                $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
                self::$pdo = new PDO($dsn, DB_USER, DB_PASS, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]);
            } catch (PDOException $e) {
                throw new Exception('Database Connect Error: ' . $e->getMessage());
            }
        }
        return self::$pdo;
    }

    public static function query($sql, $params = []) {
        $stmt = self::conn()->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    public static function fetchAll($sql, $params = []) {
        return self::query($sql, $params)->fetchAll();
    }

    public static function fetchOne($sql, $params = []) {
        $row = self::query($sql, $params)->fetch();
        return $row ?: null;
    }

    public static function insert($table, $data) {
        $fields = array_keys($data);
        $placeholders = array_map(function($f) { return ':' . $f; }, $fields);
        $sql = 'INSERT INTO ' . $table . ' (' . implode(',', $fields) . ') VALUES (' . implode(',', $placeholders) . ')';
        $params = [];
        foreach ($data as $k => $v) $params[':' . $k] = $v;
        $pdo = self::conn();
        $pdo->prepare($sql)->execute($params);
        return $pdo->lastInsertId();
    }

    public static function update($table, $data, $where, $whereParams = []) {
        $set = []; $params = [];
        foreach ($data as $k => $v) {
            $set[] = "$k = :$k";
            $params[':' . $k] = $v;
        }
        // 将 WHERE 中的 ? 占位符 + 数字索引参数 转换为命名参数，避免混合参数错误
        $wpi = 0;
        $whereConverted = preg_replace_callback('/\?/', function($m) use (&$wpi, &$whereParams, &$params) {
            $key = ':_w' . $wpi;
            if (isset($whereParams[$wpi])) {
                $params[$key] = $whereParams[$wpi];
            }
            $wpi++;
            return $key;
        }, $where);
        // 同时处理 whereParams 中可能已经是命名参数的部分（字符串键）
        foreach ($whereParams as $k => $v) {
            if (is_string($k)) $params[$k] = $v;
        }
        $sql = 'UPDATE ' . $table . ' SET ' . implode(',', $set) . ' WHERE ' . $whereConverted;
        return self::conn()->prepare($sql)->execute($params);
    }

    public static function delete($table, $where, $params = []) {
        // 同样处理：避免 delete 中混合使用命名参数
        $hasNamed = false;
        foreach ($params as $k => $v) {
            if (is_string($k)) { $hasNamed = true; break; }
        }
        $finalParams = [];
        $whereConverted = $where;
        if ($hasNamed) {
            $wpi = 0;
            $whereConverted = preg_replace_callback('/\?/', function($m) use (&$wpi, &$params, &$finalParams) {
                $key = ':_w' . $wpi;
                if (isset($params[$wpi])) {
                    $finalParams[$key] = $params[$wpi];
                }
                $wpi++;
                return $key;
            }, $where);
            foreach ($params as $k => $v) {
                if (is_string($k)) $finalParams[$k] = $v;
            }
        } else {
            $finalParams = $params;
        }
        $sql = 'DELETE FROM ' . $table . ' WHERE ' . $whereConverted;
        return self::conn()->prepare($sql)->execute($finalParams);
    }

    public static function rowCount($table, $where = '1=1', $params = []) {
        $row = self::fetchOne('SELECT COUNT(*) as cnt FROM ' . $table . ' WHERE ' . $where, $params);
        return $row ? (int)$row['cnt'] : 0;
    }
}