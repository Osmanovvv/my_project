#!/bin/sh
# Резервная копия базы и фотографий — вызывается из itagent-backup.service.
#
# Копировать content.db простым cp нельзя: файл может быть в середине
# записи. VACUUM INTO делает целостный снимок средствами самой SQLite.
# Копии старше 30 дней удаляются — ровно столько обещает политика на сайте.
set -eu

DATA_DIR="${DATA_DIR:-/var/lib/itagent}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/itagent}"
KEEP_DAYS="${KEEP_DAYS:-30}"

stamp=$(date +%F)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

sqlite3 "$DATA_DIR/content.db" "VACUUM INTO '$tmp/content.db'"
tar czf "$BACKUP_DIR/itagent-$stamp.tar.gz" -C "$tmp" content.db -C "$DATA_DIR" media

find "$BACKUP_DIR" -name 'itagent-*.tar.gz' -mtime +"$KEEP_DAYS" -delete

echo "копия сохранена: $BACKUP_DIR/itagent-$stamp.tar.gz"
