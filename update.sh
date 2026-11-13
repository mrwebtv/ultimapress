#!/usr/bin/env bash
# Update UltimaPress: backs up first, pulls the latest code, rebuilds, restarts.
# Database changes are applied automatically when the app starts.
set -euo pipefail
cd "$(dirname "$0")"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.build.yml"

echo "Backing up before updating..."
./scripts/backup.sh

if [ -d .git ]; then
  echo "Pulling the latest version..."
  git pull --ff-only
fi

echo "Rebuilding and restarting..."
$COMPOSE up -d --build
docker image prune -f >/dev/null 2>&1 || true
echo "Updated."
