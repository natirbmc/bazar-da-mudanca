<?php
// Cria o arquivo de login da Área da dona. Uso: php scripts/criar-senha.php public/data/auth.php email senha
if ($argc !== 4) {
  fwrite(STDERR, "Uso: php scripts/criar-senha.php <caminho/auth.php> <email> <senha>\n");
  exit(1);
}
[, $path, $email, $password] = $argv;
$auth = ['email' => strtolower(trim($email)), 'hash' => password_hash($password, PASSWORD_DEFAULT)];
file_put_contents($path, "<?php\nreturn " . var_export($auth, true) . ";\n");
echo "Login criado em $path\n";
