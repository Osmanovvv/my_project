#!/bin/sh
set -eu

DATA_DIR="${DATA_DIR:-/var/lib/itagent}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/itagent}"
stamp=$(date +%F-%H%M%S)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

[ -f "$DATA_DIR/content.db" ] || { echo "нет базы: $DATA_DIR/content.db" >&2; exit 1; }
mkdir -p "$BACKUP_DIR"
umask 027
sqlite3 "$DATA_DIR/content.db" "VACUUM INTO '$tmp/content.db'"
tar czf "$BACKUP_DIR/before-migration-$stamp.tar.gz" -C "$tmp" content.db -C "$DATA_DIR" media
echo "backup перед миграцией: $BACKUP_DIR/before-migration-$stamp.tar.gz"
