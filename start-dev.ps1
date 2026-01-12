Set-Location $PSScriptRoot

# Load all environment variables from .env file (if present)
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*#') { return }
        if ($_ -match '^\s*$') { return }
        if ($_ -match '^\s*([^=\s]+)\s*=\s*(.*)\s*$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
            Write-Host "Set $key"
        }
    }
} else {
    Write-Host ".env not found in repo root; continuing with existing environment." -ForegroundColor Yellow
}

# Ensure DATABASE_URL exists (Prisma requires it). If it's missing, default to the local Docker Postgres.
if (-not [Environment]::GetEnvironmentVariable('DATABASE_URL', 'Process')) {
    $defaultDbUrl = 'postgresql://postgres:postgres@localhost:5432/app'
    [Environment]::SetEnvironmentVariable('DATABASE_URL', $defaultDbUrl, 'Process')
    Write-Host "DATABASE_URL was missing; using local default (Docker Postgres on localhost:5432)."
}

# Start local infrastructure (Postgres/Redis/MinIO) via Docker if available.
try {
    $dockerCmd = Get-Command docker -ErrorAction Stop
    Write-Host "Starting Docker services (postgres, redis, minio)..."
    docker compose -f docker/compose.yaml up -d postgres redis minio | Out-Null
} catch {
    Write-Host "Docker not found or not available; skipping docker compose startup."
}

Write-Host "`nEnvironment variables loaded. Starting dev server...`n"

# Start the dev server
pnpm dev
