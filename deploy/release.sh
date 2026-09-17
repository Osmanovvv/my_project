#!/bin/bash
# Выкладка новой версии сайта. Запускать С НОУТБУКА из корня проекта:
#
#   bash deploy/release.sh root@itagent.ru
#
# Собирает сайт под адрес https://itagent.ru, переносит каталог .output
# на сервер, делает снимок базы на случай отката, подменяет версию
# и перезапускает сервис. Секреты и данные не трогает: они на сервере
# в /etc/itagent/env и /var/lib/itagent.
#
# Собирать нужно именно здесь, а не на сервере: сборке нужны bun и полный
# node_modules, а серверу — только готовый .output (5 МБ).
set -euo pipefail

HOST="${1:-}"
[ -n "$HOST" ] || { echo "Использование: bash deploy/release.sh root@itagent.ru"; exit 1; }

SITE_URL="${SITE_URL:-https://itagent.ru}"
APP_DIR=/srv/itagent
DATA_DIR=/var/lib/itagent

cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "==> Сборка под $SITE_URL"
VITE_SITE_URL="$SITE_URL" NITRO_PRESET=node-server bun run build
[ -f .output/server/index.mjs ] || { echo "Сборка не дала .output/server/index.mjs"; exit 1; }

echo "==> Перенос на $HOST и перезапуск"
# tar через ssh: один поток, Windows-scp не нужен, структура сохраняется.
# На сервере: распаковать рядом, снять снимок базы, подменить каталог
# целиком (mv атомарен), перезапустить. Старая версия остаётся в .output.old.
tar -czf - .output | ssh "$HOST" "set -e
  cd $APP_DIR
  rm -rf .output.new && mkdir .output.new
  tar -xzf - -C .output.new --strip-components=1
  chown -R root:itagent .output.new && chmod -R g+rX,o-rwx .output.new
  if [ -f $DATA_DIR/content.db ]; then
    sqlite3 $DATA_DIR/content.db \"VACUUM INTO '/var/backups/itagent/before-release-\$(date +%F-%H%M%S).db'\"
  fi
  rm -rf .output.old
  [ -d .output ] && mv .output .output.old
  mv .output.new .output
  systemctl restart itagent
  sleep 2
  systemctl is-active --quiet itagent && echo 'itagent: работает' || { journalctl -u itagent -n 30 --no-pager; exit 1; }
"

echo "==> Проверка"
curl -sS -o /dev/null -w "главная: %{http_code}\n" "$SITE_URL/"
curl -sS -o /dev/null -w "sitemap: %{http_code}\n" "$SITE_URL/sitemap.xml"
echo "Лог настроек на сервере: ssh $HOST journalctl -u itagent -n 20 --no-pager"
