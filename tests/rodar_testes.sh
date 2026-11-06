#!/bin/sh
# Roda os testes em uma cópia temporária, sem alterar o catálogo de exemplo.
set -e
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
PORTA=8791
cp -R "$RAIZ/public" "$TMP/site"
php "$RAIZ/scripts/criar-senha.php" "$TMP/site/data/auth.php" "teste@exemplo.test" "senha-de-teste-123"
(cd "$TMP/site" && exec php -S "127.0.0.1:$PORTA" >/dev/null 2>&1) &
SERVIDOR=$!
trap 'kill "$SERVIDOR" 2>/dev/null; rm -rf "$TMP"' EXIT
sleep 1
FOTO="$(ls "$TMP"/site/fotos/*.jpg | head -1)"
python3 "$RAIZ/tests/test_api.py" "http://127.0.0.1:$PORTA/" "$TMP/site" "$FOTO"
