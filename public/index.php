<?php
// Página pública: entrega o catálogo já embutido, sem exigir nenhum login do visitante.
declare(strict_types=1);
ini_set('display_errors', '0');
header('Cache-Control: no-cache');

$state = json_decode((string)@file_get_contents(__DIR__ . '/data/state.json'), true);
if (!is_array($state)) {
  http_response_code(503);
  exit('Site em manutenção. Volte em instantes.');
}

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
$dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
$base = ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? '') . $dir . '/';
$cover = $state['items'][0]['photos'][0] ?? '';
$title = 'Família Vende Tudo';
$about = 'Bazar da mudança: móveis, eletrodomésticos e muito mais. ' . ($state['config']['where'] ?? '') . '.';
$e = fn(string $s): string => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
$v = fn(string $f): string => (string)@filemtime(__DIR__ . '/' . $f);
$json = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP);
?><!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title><?= $e($title) ?></title>
<meta name="description" content="<?= $e($about) ?>">
<meta property="og:type" content="website">
<meta property="og:title" content="<?= $e($title) ?>">
<meta property="og:description" content="<?= $e($about) ?>">
<meta property="og:url" content="<?= $e($base) ?>">
<?php if ($cover): ?><meta property="og:image" content="<?= $e($base . $cover) ?>">
<?php endif; ?>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Young+Serif&family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap">
<link rel="stylesheet" href="app.css?v=<?= $v('app.css') ?>">
</head>
<body>
<div id="root"></div>
<script type="application/json" id="state"><?= $json ?></script>
<script src="app.js?v=<?= $v('app.js') ?>"></script>
</body>
</html>
