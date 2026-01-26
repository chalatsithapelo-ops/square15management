#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PM2_APP_NAME="${PM2_APP_NAME:-square15management}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/health/health}"
RUN_SETUP="${RUN_SETUP:-false}"
SEED_DEMO_DATA="${SEED_DEMO_DATA:-false}"
SKIP_MINIO_SETUP="${SKIP_MINIO_SETUP:-true}"

echo "=== Deploy: $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

echo "== git pull =="
git pull --ff-only

echo "== install =="
pnpm install --frozen-lockfile

echo "== prisma db push =="
pnpm exec prisma db push

if [[ "$RUN_SETUP" == "true" ]]; then
  echo "== setup (optional) =="
  echo "RUN_SETUP=true: running setup script (SEED_DEMO_DATA=$SEED_DEMO_DATA, SKIP_MINIO_SETUP=$SKIP_MINIO_SETUP)"
  SEED_DEMO_DATA="$SEED_DEMO_DATA" SKIP_MINIO_SETUP="$SKIP_MINIO_SETUP" pnpm exec tsx src/server/scripts/setup.ts
else
  echo "== setup (skipped) =="
  echo "Tip: set RUN_SETUP=true to run src/server/scripts/setup.ts (use SEED_DEMO_DATA=true only if you really want demo data)"
fi

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
