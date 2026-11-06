<?php
// API da Área da dona: login, salvar o catálogo, enviar fotos e trocar a senha.
declare(strict_types=1);
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const DATA_DIR = __DIR__ . '/data';
const STATE_FILE = DATA_DIR . '/state.json';
const AUTH_FILE = DATA_DIR . '/auth.php';
const ATTEMPTS_FILE = DATA_DIR . '/attempts.json';
const LOCK_FILE = DATA_DIR . '/.lock';
const BACKUP_DIR = DATA_DIR . '/backups';
const SESSION_DIR = DATA_DIR . '/sessions';
const PHOTO_DIR = __DIR__ . '/fotos';
const SESSION_NAME = 'fvt_dona';
const SESSION_DAYS = 7;
const MAX_FAILS = 5;
const LOCK_SECONDS = 900;
const MAX_UPLOAD = 15 * 1024 * 1024;
const CATS = ['sala', 'cozinha', 'quarto', 'banheiro', 'variedades', 'roupas'];
const STATUSES = ['disponivel', 'reservado', 'vendido'];

function out(int $code, array $body): void {
  http_response_code($code);
  echo json_encode($body, JSON_UNESCAPED_UNICODE);
  exit;
}

function is_https(): bool {
  return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

function begin_session(): void {
  if (!is_dir(SESSION_DIR)) mkdir(SESSION_DIR, 0750, true);
  $life = SESSION_DAYS * 86400;
  session_save_path(SESSION_DIR);
  ini_set('session.gc_maxlifetime', (string)$life);
  ini_set('session.use_strict_mode', '1');
  session_name(SESSION_NAME);
  session_set_cookie_params([
    'lifetime' => $life,
    'path' => '/',
    'secure' => is_https(),
    'httponly' => true,
    'samesite' => 'Strict',
  ]);
  session_start();
}

function require_login(): void {
  begin_session();
  if (empty($_SESSION['dona'])) out(401, ['ok' => false, 'error' => 'login']);
}

function json_body(): array {
  $body = json_decode((string)file_get_contents('php://input'), true);
  return is_array($body) ? $body : [];
}

function with_lock(callable $fn) {
  $h = fopen(LOCK_FILE, 'c');
  if (!$h) out(500, ['ok' => false, 'error' => 'lock']);
  flock($h, LOCK_EX);
  try {
    return $fn();
  } finally {
    flock($h, LOCK_UN);
    fclose($h);
  }
}

function write_atomic(string $path, string $content): void {
  $tmp = $path . '.tmp' . bin2hex(random_bytes(4));
  if (file_put_contents($tmp, $content) === false || !rename($tmp, $path)) {
    @unlink($tmp);
    out(500, ['ok' => false, 'error' => 'write']);
  }
}

function read_state(): array {
  $state = json_decode((string)file_get_contents(STATE_FILE), true);
  if (!is_array($state)) out(500, ['ok' => false, 'error' => 'state']);
  return $state;
}

function backup_state(): void {
  if (!is_dir(BACKUP_DIR)) mkdir(BACKUP_DIR, 0750, true);
  copy(STATE_FILE, BACKUP_DIR . '/state-' . date('Ymd-His') . '-' . bin2hex(random_bytes(2)) . '.json');
  $files = glob(BACKUP_DIR . '/state-*.json') ?: [];
  sort($files);
  foreach (array_slice($files, 0, max(0, count($files) - 30)) as $old) @unlink($old);
}

function clean_text($value, int $max): ?string {
  if (!is_string($value)) return null;
  $value = trim($value);
  if (mb_strlen($value) > $max) return null;
  return $value;
}

function bad(string $why): void {
  out(422, ['ok' => false, 'error' => 'invalid', 'detail' => $why]);
}

function validate_state(array $in, array $current): array {
  if (!is_array($in['config'] ?? null) || !is_array($in['items'] ?? null)) bad('estrutura');
  if (count($in['items']) > 1000) bad('itens demais');
  $config = $current['config'];
  foreach (['whatsapp' => 40, 'where' => 200, 'payment' => 200, 'sinal' => 500] as $key => $max) {
    if (array_key_exists($key, $in['config'])) {
      $v = clean_text($in['config'][$key], $max);
      if ($v === null) bad('config ' . $key);
      $config[$key] = $v;
    }
  }
  $items = [];
  $seen = [];
  foreach ($in['items'] as $raw) {
    if (!is_array($raw)) bad('item');
    $id = $raw['id'] ?? '';
    if (!is_string($id) || !preg_match('/^[a-z0-9-]{1,80}$/', $id) || isset($seen[$id])) bad('id');
    $seen[$id] = true;
    $name = clean_text($raw['name'] ?? null, 200);
    $desc = clean_text($raw['desc'] ?? null, 2000);
    if ($name === null || $name === '' || $desc === null) bad('texto de ' . $id);
    if (!in_array($raw['cat'] ?? '', CATS, true)) bad('categoria de ' . $id);
    if (!in_array($raw['status'] ?? '', STATUSES, true)) bad('status de ' . $id);
    $price = $raw['price'] ?? null;
    if (!is_int($price) || $price < 0 || $price > 1000000) bad('preço de ' . $id);
    $photos = $raw['photos'] ?? null;
    if (!is_array($photos) || !$photos || count($photos) > 30) bad('fotos de ' . $id);
    foreach ($photos as $p) {
      if (!is_string($p) || !preg_match('#^fotos/[A-Za-z0-9_-]+\.jpe?g$#', $p) || !is_file(__DIR__ . '/' . $p)) {
        bad('foto de ' . $id);
      }
    }
    $items[] = [
      'id' => $id, 'cat' => $raw['cat'], 'name' => $name, 'desc' => $desc, 'price' => $price,
      'status' => $raw['status'], 'late' => !empty($raw['late']), 'photos' => array_values($photos),
    ];
  }
  return ['config' => $config, 'items' => $items];
}

$action = $_GET['a'] ?? '';

if ($action === 'me') {
  // Visitantes não recebem cookie: a sessão só abre se o cookie já existir.
  if (empty($_COOKIE[SESSION_NAME])) out(200, ['ok' => true, 'logged' => false]);
  begin_session();
  out(200, ['ok' => true, 'logged' => !empty($_SESSION['dona'])]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || ($_SERVER['HTTP_X_DONA'] ?? '') !== '1') {
  out(403, ['ok' => false, 'error' => 'forbidden']);
}

switch ($action) {
  case 'login':
    $ip = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? '');
    $locked = with_lock(function () use ($ip) {
      $all = is_file(ATTEMPTS_FILE) ? (json_decode((string)file_get_contents(ATTEMPTS_FILE), true) ?: []) : [];
      $now = time();
      foreach ($all as $k => $a) if ($a['t'] < $now - LOCK_SECONDS) unset($all[$k]);
      write_atomic(ATTEMPTS_FILE, json_encode($all));
      return ($all[$ip]['n'] ?? 0) >= MAX_FAILS;
    });
    if ($locked) out(429, ['ok' => false, 'error' => 'locked']);
    $body = json_body();
    $auth = require AUTH_FILE;
    $email = strtolower(trim((string)($body['email'] ?? '')));
    $good = hash_equals($auth['email'], $email) && password_verify((string)($body['password'] ?? ''), $auth['hash']);
    with_lock(function () use ($ip, $good) {
      $all = is_file(ATTEMPTS_FILE) ? (json_decode((string)file_get_contents(ATTEMPTS_FILE), true) ?: []) : [];
      if ($good) unset($all[$ip]);
      else $all[$ip] = ['n' => ($all[$ip]['n'] ?? 0) + 1, 't' => time()];
      write_atomic(ATTEMPTS_FILE, json_encode($all));
    });
    if (!$good) out(401, ['ok' => false, 'error' => 'credentials']);
    begin_session();
    session_regenerate_id(true);
    $_SESSION['dona'] = true;
    out(200, ['ok' => true]);

  case 'logout':
    begin_session();
    $_SESSION = [];
    setcookie(SESSION_NAME, '', ['expires' => time() - 3600, 'path' => '/', 'secure' => is_https(), 'httponly' => true, 'samesite' => 'Strict']);
    session_destroy();
    out(200, ['ok' => true]);

  case 'save':
    require_login();
    $body = json_body();
    $result = with_lock(function () use ($body) {
      $current = read_state();
      if (($body['version'] ?? null) !== ($current['version'] ?? 0)) return ['conflict' => true];
      $next = validate_state(is_array($body['state'] ?? null) ? $body['state'] : [], $current);
      $next['version'] = ($current['version'] ?? 0) + 1;
      $next['updated'] = gmdate('c');
      backup_state();
      write_atomic(STATE_FILE, json_encode($next, JSON_UNESCAPED_UNICODE));
      return ['version' => $next['version']];
    });
    if (!empty($result['conflict'])) out(409, ['ok' => false, 'error' => 'conflict']);
    out(200, ['ok' => true, 'version' => $result['version']]);

  case 'upload':
    require_login();
    $file = $_FILES['foto'] ?? null;
    if (!$file || ($file['error'] ?? 1) !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) {
      out(422, ['ok' => false, 'error' => 'upload']);
    }
    if ($file['size'] > MAX_UPLOAD) out(422, ['ok' => false, 'error' => 'too_big']);
    $info = @getimagesize($file['tmp_name']);
    if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) {
      out(422, ['ok' => false, 'error' => 'not_image']);
    }
    $name = 'u' . bin2hex(random_bytes(8)) . '.jpg';
    $target = PHOTO_DIR . '/' . $name;
    if (function_exists('imagecreatefromstring')) {
      // Regravar a imagem remove metadados e qualquer conteúdo escondido no arquivo.
      $im = @imagecreatefromstring((string)file_get_contents($file['tmp_name']));
      if (!$im) out(422, ['ok' => false, 'error' => 'not_image']);
      $w = imagesx($im);
      $h = imagesy($im);
      $scale = min(1, 1200 / max($w, $h));
      $canvas = imagecreatetruecolor((int)round($w * $scale), (int)round($h * $scale));
      imagefill($canvas, 0, 0, imagecolorallocate($canvas, 255, 255, 255));
      imagecopyresampled($canvas, $im, 0, 0, 0, 0, imagesx($canvas), imagesy($canvas), $w, $h);
      if (!imagejpeg($canvas, $target, 82)) out(500, ['ok' => false, 'error' => 'write']);
    } elseif ($info[2] !== IMAGETYPE_JPEG || !move_uploaded_file($file['tmp_name'], $target)) {
      out(422, ['ok' => false, 'error' => 'not_image']);
    }
    out(200, ['ok' => true, 'path' => 'fotos/' . $name]);

  case 'password':
    require_login();
    $body = json_body();
    $auth = require AUTH_FILE;
    if (!password_verify((string)($body['current'] ?? ''), $auth['hash'])) out(401, ['ok' => false, 'error' => 'credentials']);
    $new = (string)($body['next'] ?? '');
    if (mb_strlen($new) < 10) out(422, ['ok' => false, 'error' => 'weak']);
    $auth['hash'] = password_hash($new, PASSWORD_DEFAULT);
    write_atomic(AUTH_FILE, "<?php\nreturn " . var_export($auth, true) . ";\n");
    if (function_exists('opcache_invalidate')) @opcache_invalidate(AUTH_FILE, true);
    out(200, ['ok' => true]);
}

out(404, ['ok' => false, 'error' => 'unknown']);
