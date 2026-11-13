#!/usr/bin/env bash
# Back up the database and all uploaded media to ./backups/<date>/
# Keeps the 14 most recent backups. (The server also makes its own nightly
# database backup inside Docker; this one gives you files you can download.)
set -euo pipefail
cd "$(dirname "$0")/.."

STAMP=$(date +%Y-%m-%d_%H%M%S)
DEST="backups/${STAMP}"
mkdir -p "$DEST"

echo "Saving database..."
docker compose exec -T db pg_dump -U ultimapress -d ultimapress -Fc > "$DEST/database.dump"

echo "Saving media..."
docker compose exec -T app tar -czf - -C /app/media . > "$DEST/media.tar.gz"

ls -1dt backups/*/ 2>/dev/null | tail -n +15 | xargs -r rm -rf
echo "Backup saved to $DEST"
