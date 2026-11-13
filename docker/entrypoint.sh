#!/bin/sh
# Generates any missing secret once and keeps it on the data volume,
# so UltimaPress works with zero configuration and survives restarts.
# Database migrations run automatically when the app starts.
set -e
mkdir -p /app/data
SECRETS=/app/data/secrets.env
[ -f "$SECRETS" ] || touch "$SECRETS"
for v in PAYLOAD_SECRET CRON_SECRET PREVIEW_SECRET; do
  eval cur=\${$v:-}
  [ -n "$cur" ] && continue
  grep -q "^$v=" "$SECRETS" || echo "$v=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')" >> "$SECRETS"
  export "$(grep "^$v=" "$SECRETS")"
done

# Public address used in sitemaps, feeds, social previews and emails.
if [ -z "$SITE_URL" ] && [ -n "$DOMAIN" ]; then
  export SITE_URL="https://$DOMAIN"
fi

# The supervisor runs the site and handles updates from Build > Site code.
exec node /app/docker/supervisor.mjs
