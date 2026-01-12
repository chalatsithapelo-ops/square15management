#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="/var/log/square15/monitor.log"
APP_HEALTH_URL="http://127.0.0.1:3000/health/health"

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" >> "$LOG_FILE"
}

# Ensure postgres container is running and healthy
if ! docker ps --format "{{.Names}}" | grep -qx docker-postgres-1; then
  log "postgres container missing -> docker start"
  docker start docker-postgres-1 >/dev/null 2>&1 || true
fi

pgHealth="$(docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}" docker-postgres-1 2>/dev/null || echo unknown)"
if [ "$pgHealth" != "healthy" ]; then
  log "postgres health=$pgHealth -> docker restart"
  docker restart docker-postgres-1 >/dev/null 2>&1 || true
fi

# If app health fails, restart pm2-root (resurrects the app)
if ! curl -fsS --max-time 5 "$APP_HEALTH_URL" >/dev/null; then
  log "app health failed -> restarting pm2-root"
  systemctl restart pm2-root >/dev/null 2>&1 || true
  sleep 2
  if curl -fsS --max-time 5 "$APP_HEALTH_URL" >/dev/null; then
    log "app health recovered"
  else
    log "app still unhealthy after restart"
  fi
fi
