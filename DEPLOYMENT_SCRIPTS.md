# Deployment Scripts Guide

This document explains the various deployment and operational scripts available in this project.

## Quick Reference

| Script | Data Preserved | Use Case |
|--------|---------------|----------|
| `./scripts/run` | ✅ Yes | Normal startup |
| `./scripts/stop` | ✅ Yes | Normal shutdown |
| `./scripts/rebuild` | ✅ Yes | Fix build issues, update dependencies |
| `./scripts/purge-and-redeploy` | ❌ **NO** | Complete fresh start |

## Detailed Script Descriptions

### `./scripts/run`

**Purpose**: Normal application startup

**What it does**:
- Starts all Docker containers
- Uses existing data volumes (database, uploads, cache)
- Runs database migrations if needed
- Seeds default data if database is empty

**When to use**:
- Starting the application normally
- After stopping with `./scripts/stop`
- Daily development work

**Data impact**: None - all data is preserved

---

### `./scripts/stop`

**Purpose**: Normal application shutdown

**What it does**:
- Gracefully stops all Docker containers
- Preserves all data volumes

**When to use**:
- When you're done working and want to free up resources
- Before system shutdown or restart

**Data impact**: None - all data is preserved

---

### `./scripts/rebuild`

**Purpose**: Rebuild containers without cache, but preserve data

**What it does**:
1. Stops and removes containers
2. Cleans up dangling Docker images
3. Rebuilds all containers from scratch (no cache)
4. Starts containers with existing data

**When to use**:
- After updating Dockerfile or dependencies
- When experiencing build-related issues
- When Docker build cache might be causing problems
- After pulling major code changes

**Data impact**: None - all data volumes are preserved:
- ✅ Database data (PostgreSQL)
- ✅ Uploaded files (MinIO)
- ✅ Cache data (Redis)
- ✅ Node modules cache

**Example output**:
```
==========================================
Rebuilding Docker containers without cache
==========================================

Stopping and removing containers...
Cleaning up dangling images...
Rebuilding containers without cache...
Starting containers...

==========================================
Rebuild complete!
==========================================
```

---

### `./scripts/purge-and-redeploy`

**Purpose**: Complete purge and fresh start

**⚠️ WARNING**: This script **DELETES ALL DATA**. Use with caution!

**What it does**:
1. Stops and removes all containers
2. **Removes all data volumes** (complete data wipe)
3. Cleans up Docker images and build cache
4. Rebuilds all containers from scratch
5. Starts fresh with empty database

**When to use**:
- Starting completely fresh
- Clearing corrupted data
- Testing initial setup/seeding
- Resetting to clean state for testing

**Data impact**: **COMPLETE DATA LOSS**:
- ❌ All database data deleted
- ❌ All uploaded files deleted
- ❌ All cache data deleted
- ❌ All application state reset

**Safety feature**: Requires confirmation before proceeding

**What gets recreated**:
- Fresh empty database (with schema)
- Default admin user (from setup script)
- Empty MinIO buckets
- Fresh Redis cache

**Example output**:
```
==========================================
COMPLETE PURGE AND REDEPLOY
==========================================

WARNING: This will delete:
  - All containers
  - All data volumes (database, MinIO, Redis)
  - All Docker images and build cache
  - All application data will be lost

Press Ctrl+C now to cancel, or Enter to continue...
```

---

## Common Scenarios

### "The app won't start after pulling changes"
```bash
./scripts/rebuild
```

### "I want to test the initial setup process"
```bash
./scripts/purge-and-redeploy
```

### "I need to clear all data and start fresh"
```bash
./scripts/purge-and-redeploy
```

### "Dependencies aren't updating"
```bash
./scripts/rebuild
```

### "I'm getting weird Docker errors"
```bash
# First try rebuild
./scripts/rebuild

# If that doesn't work, try purge (backs up data first if needed!)
./scripts/purge-and-redeploy
```

---

## Environment Variables

All scripts respect the `.env` file in the project root. Key variables:

- `APP_NAME`: Docker Compose project name (default: directory name)
- `NODE_ENV`: Environment mode (development/production)
- `ADMIN_PASSWORD`: Default admin password
- `DATABASE_URL`: PostgreSQL connection string
- `SEED_DEMO_DATA`: Whether to seed demo data (true/false)

### MinIO (Uploads)

By default, the app connects to MinIO with:
- access key: `admin`
- secret key: `ADMIN_PASSWORD`

If your MinIO credentials or internal URL differ (common in non-Docker setups), set:
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_INTERNAL_URL` (example: `http://minio:9000` in Docker, or `http://127.0.0.1:9000` if port-mapped)

---

## Viewing Logs

After starting the application with any script, view logs:

```bash
# All services
./scripts/docker-compose logs -f

# Specific service
./scripts/docker-compose logs -f app
./scripts/docker-compose logs -f postgres
./scripts/docker-compose logs -f nginx
```

---

## Accessing Services

After successful startup:

- **Application**: http://localhost:8000
- **Database Admin (Adminer)**: http://localhost:8000/adminer
- **MinIO Console**: http://localhost:9001

Default credentials:
- **Application Admin**: `admin@example.com` / `$ADMIN_PASSWORD`
- **MinIO Console**: `admin` / `$ADMIN_PASSWORD`
- **Adminer**: Auto-login configured

---

## Troubleshooting

### "Port already in use"
```bash
./scripts/stop
# Wait a few seconds
./scripts/run
```

### "Container name conflict"
```bash
./scripts/docker-compose down --remove-orphans
./scripts/run
```

### "Database migration errors"
```bash
./scripts/rebuild
```

### "Everything is broken"
```bash
# Nuclear option - fresh start
./scripts/purge-and-redeploy
```

---

## Data Backup

Before running `./scripts/purge-and-redeploy`, consider backing up:

### Database Backup
```bash
./scripts/docker-compose exec postgres pg_dump -U postgres app > backup.sql
```

### Restore Database
```bash
./scripts/docker-compose exec -T postgres psql -U postgres app < backup.sql
```

### MinIO Backup
Use the MinIO console (http://localhost:9001) to download buckets, or use the MinIO client (`mc`).

---

## See Also

- [QUICK_START.md](./QUICK_START.md) - Getting started guide
- [DEPLOYMENT_TROUBLESHOOTING.md](./DEPLOYMENT_TROUBLESHOOTING.md) - Common deployment issues
- [README.md](./README.md) - Project overview
