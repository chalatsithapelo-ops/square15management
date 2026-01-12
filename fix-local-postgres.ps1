# Fixes the most common local Prisma/Postgres auth failure after reboot:
# - ensures Docker Postgres is running
# - resets the dev database volume (DELETES local dev DB data)
# - starts Postgres again with the default credentials used by docker/compose.yaml

$ErrorActionPreference = "Stop"

# Ensure relative paths (like docker/compose.yaml) resolve from repo root
Set-Location $PSScriptRoot

Write-Host "This will DELETE the local dev Postgres data volume." -ForegroundColor Yellow
Write-Host "If you want to keep your local DB, cancel now (Ctrl+C)." -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to continue"

Write-Host "Stopping dev services and removing volumes (this deletes local dev data)..."
docker compose -f docker/compose.yaml down -v --remove-orphans | Out-Null

Write-Host "Starting postgres..."
docker compose -f docker/compose.yaml up -d postgres | Out-Null

Write-Host "Done. Postgres should now accept postgres/postgres on localhost:5432" -ForegroundColor Green
