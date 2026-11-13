#!/usr/bin/env bash
# UltimaPress installer for a VPS where you have uploaded this folder
# (for example from ultimapress.zip or a git clone you customised with Claude).
# Builds from this folder. For a one-click install with no files at all, use
# Deploy on Hostinger (Docker Manager > Compose from URL) as shown in README.md.
set -euo pipefail
cd "$(dirname "$0")"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.build.yml"

bold "UltimaPress installer"
echo

if ! command -v docker >/dev/null 2>&1; then
  bold "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required. Install the docker-compose-plugin package and run again." >&2
  exit 1
fi

if [ -f .env ]; then
  bold "Found an existing .env, keeping your settings."
else
  read -rp "Your domain (e.g. mysite.com, DNS already pointing here; leave empty to use the IP): " DOMAIN
  DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN%/}"
  PASS=$(openssl rand -hex 24 2>/dev/null || head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')
  cp .env.example .env
  sed -i -e "s|^DOMAIN=.*|DOMAIN=${DOMAIN}|" -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${PASS}|" .env
  chmod 600 .env
  info "Settings saved to .env"
fi

bold "Building and starting UltimaPress (the first build takes a few minutes)..."
$COMPOSE up -d --build

bold "Waiting for the site to come online..."
for _ in $(seq 1 90); do
  if $COMPOSE exec -T app wget -qO- http://127.0.0.1:3000/robots.txt >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

DOMAIN=$(grep '^DOMAIN=' .env | cut -d= -f2-)
if [ -n "$DOMAIN" ]; then URL="https://${DOMAIN}"; else URL="http://$(hostname -I 2>/dev/null | awk '{print $1}')"; fi
echo
bold "UltimaPress is live."
info "Create your admin account:  ${URL}/admin"
info "Your website:               ${URL}"
info "Back up:   ./scripts/backup.sh"
info "Update:    ./update.sh"
