#!/usr/bin/env bash
# Build apps/web and deploy it as a static Caddy site, by subdomain, on a given host.
# No secrets in this file. Run it ON the target host (it does not SSH anywhere itself).
#
# Usage: scripts/deploy-web.sh <domain> <webroot> [caddyfile]
# Example: scripts/deploy-web.sh forge.fanside.xyz /var/www/forge /etc/caddy/Caddyfile
set -euo pipefail

DOMAIN="${1:?usage: deploy-web.sh <domain> <webroot> [caddyfile]}"
WEBROOT="${2:?usage: deploy-web.sh <domain> <webroot> [caddyfile]}"
CADDYFILE="${3:-/etc/caddy/Caddyfile}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "== 1. build =="
pnpm install
pnpm --filter @forgeout/web build

echo "== 2. backup Caddyfile =="
TS="$(date +%Y%m%d-%H%M%S)"
cp "$CADDYFILE" "$CADDYFILE.bak-$TS"
echo "backup: $CADDYFILE.bak-$TS"

echo "== 3. copy build output =="
mkdir -p "$WEBROOT"
rsync -a --delete "$REPO_ROOT/apps/web/dist/" "$WEBROOT/"

echo "== 4. add site block (only if not already present) =="
if ! grep -q "^${DOMAIN} {" "$CADDYFILE"; then
  cat >> "$CADDYFILE" << EOF

${DOMAIN} {
	root * ${WEBROOT}
	encode zstd gzip
	file_server
	try_files {path} /index.html
}
EOF
fi

echo "== 5. validate =="
if ! caddy validate --config "$CADDYFILE"; then
  echo "validation FAILED, restoring backup" >&2
  cp "$CADDYFILE.bak-$TS" "$CADDYFILE"
  exit 1
fi

echo "== 6. DNS check (must resolve to this host's public IP before reload) =="
RESOLVED="$(dig +short "$DOMAIN" | tail -1)"
PUBLIC_IP="$(curl -s4 ifconfig.me || true)"
echo "resolved: $RESOLVED   this host: $PUBLIC_IP"
if [ -z "$RESOLVED" ] || [ "$RESOLVED" != "$PUBLIC_IP" ]; then
  echo "DNS does not yet point here. Stopping before reload. Caddy config is valid and staged, but not active for $DOMAIN." >&2
  exit 2
fi

echo "== 7. reload =="
systemctl reload caddy

echo "== 8. verify =="
sleep 2
curl -sI "https://$DOMAIN" || true
echo "done: https://$DOMAIN"
