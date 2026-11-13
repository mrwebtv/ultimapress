#!/usr/bin/env bash
# Restore a backup made by backup.sh:  ./scripts/restore.sh backups/2026-11-11_120000
# This REPLACES the current database and media.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="${1:-}"
if [ -z "$SRC" ] || [ ! -f "$SRC/database.dump" ]; then
  echo "Usage: ./scripts/restore.sh backups/<date>" >&2
  ls -1dt backups/*/ 2>/dev/null | head -5
  exit 1
fi

read -rp "This replaces the current site content with $SRC. Type RESTORE to continue: " OK
[ "$OK" = "RESTORE" ] || { echo "Cancelled."; exit 1; }

echo "Restoring database..."
docker compose exec -T db pg_restore -U ultimapress -d ultimapress --clean --if-exists --no-owner < "$SRC/database.dump"

if [ -f "$SRC/media.tar.gz" ]; then
  echo "Restoring media..."
  docker compose exec -T app sh -c 'find /app/media -mindepth 1 -delete && tar -xzf - -C /app/media' < "$SRC/media.tar.gz"
fi

docker compose restart app
echo "Restored from $SRC"
