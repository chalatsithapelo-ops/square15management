# Quick diagnostics for recurring Prisma/Postgres auth failures on Windows.
# Prints:
# - DATABASE_URL from .env (if present)
# - Current process DATABASE_URL
# - docker compose status for postgres
# - what is listening on port 5432

$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

Write-Host "=== DATABASE_URL (.env) ===" -ForegroundColor Cyan
if (Test-Path .env) {
  $line = (Get-Content .env | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1)
  if ($line) { Write-Host $line } else { Write-Host "DATABASE_URL not found in .env" -ForegroundColor Yellow }
} else {
  Write-Host ".env not found in repo root" -ForegroundColor Yellow
}

Write-Host "\n=== DATABASE_URL (current process) ===" -ForegroundColor Cyan
$procDbUrl = [Environment]::GetEnvironmentVariable('DATABASE_URL', 'Process')
if ($procDbUrl) { Write-Host $procDbUrl } else { Write-Host "DATABASE_URL not set in current process" -ForegroundColor Yellow }

Write-Host "\n=== Docker Compose (postgres) ===" -ForegroundColor Cyan
try {
  docker compose -f docker/compose.yaml ps postgres
} catch {
  Write-Host "Docker not available." -ForegroundColor Yellow
}

Write-Host "\n=== Port 5432 listeners ===" -ForegroundColor Cyan
try {
  Get-NetTCPConnection -LocalPort 5432 -ErrorAction Stop | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
} catch {
  Write-Host "No listeners found on 5432 (or insufficient permissions)." -ForegroundColor Yellow
}

Write-Host "\nTip: If something OTHER than Docker is using 5432, your app may be connecting to the wrong Postgres instance." -ForegroundColor Yellow
