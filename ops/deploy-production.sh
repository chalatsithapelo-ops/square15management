#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PM2_APP_NAME="${PM2_APP_NAME:-square15management}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/health/health}"

echo "=== Deploy: $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

echo "== git pull =="
git pull --ff-only

echo "== install =="
pnpm install --frozen-lockfile

echo "== prisma db push =="
pnpm exec prisma db push

echo "== setup (demo seed) =="
SEED_DEMO_DATA=true SKIP_MINIO_SETUP=true pnpm exec tsx src/server/scripts/setup.ts

echo "== build =="
pnpm build

echo "== pm2 restart ($PM2_APP_NAME) =="
pm2 restart "$PM2_APP_NAME"

echo "== health check =="
for i in {1..30}; do
  if curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then
    echo "HEALTH_OK"
    echo "=== Deploy complete ==="
    exit 0
  fi
  sleep 1
done

echo "HEALTH_FAIL: $HEALTH_URL" >&2
pm2 status "$PM2_APP_NAME" || true
exit 1
