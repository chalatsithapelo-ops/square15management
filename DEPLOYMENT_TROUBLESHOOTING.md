# Deployment & Preview Troubleshooting Guide

This guide documents common deployment and preview issues and their solutions.

## Recent Fixes (2024)

### Issue: App Failing to Preview and Deploy

**Symptoms:**
- Docker container fails to start or become healthy
- Health check continuously fails
- App times out during startup
- 502 Bad Gateway errors from Nginx

**Root Causes Identified:**

1. **Prisma Client Not Generated**
   - The `--frozen-lockfile` flag was preventing the `postinstall` script from running
   - The app couldn't start without the generated Prisma client

2. **Setup Script Taking Too Long**
   - Demo data seeding was running on every startup
   - Extensive demo data creation could take 2-3 minutes
   - This exceeded the health check timeout window

3. **Missing Error Logging**
   - Setup script errors weren't providing enough detail for debugging

4. **Nginx Timeout Too Short**
   - Nginx was only waiting 60 seconds (30 attempts × 2 seconds) for the app to become healthy
   - In slower environments or during initial deployment, the app could take longer to initialize
   - This caused premature timeout failures even though the app eventually became healthy

**Solutions Applied:**

1. **Explicit Prisma Client Generation** (`docker/compose.yaml`)
   ```bash
   pnpm exec prisma generate
   ```
   Added before running the setup script to ensure Prisma client is always available.

2. **Optional Demo Data Seeding** (`src/server/scripts/setup.ts`)
   - Demo data seeding now only runs if `SEED_DEMO_DATA=true` is set
   - Default startup now only:
     - Applies database schema
     - Tests database connection
     - Syncs company details
     - Sets up MinIO buckets
     - Seeds essential user accounts (admin, artisan, customer)
   - This reduces startup time from 2-3 minutes to 10-30 seconds

3. **Enhanced Error Logging** (`src/server/scripts/setup.ts`)
   - Added detailed error logging with stack traces
   - Added timing information for setup operations
   - Added better retry logging with attempt counts

4. **Increased Nginx Wait Time** (`docker/compose.yaml` and `docker/compose.preview.yaml`)
   - Increased `max_attempts` from 30 to 60 (60 seconds to 120 seconds)
   - Provides more buffer time for application initialization
   - Reduces false timeout failures in slower deployment environments

## Common Issues & Solutions

### 1. Database Connection Failures

**Symptoms:**
- Health check fails with database errors
- Setup script fails with "database connection timeout"

**Solutions:**
- Verify PostgreSQL container is running: `docker compose ps postgres`
- Check database credentials in `.env` match `docker/compose.yaml`
- Ensure database URL in `prisma/schema.prisma` is correct
- Wait longer for database to initialize (especially on first run)

### 2. MinIO Connection Issues

**Symptoms:**
- Setup script fails at "MinIO bucket setup"
- File uploads fail in the application

**Solutions:**
- Verify MinIO container is running: `docker compose ps minio`
- Check `ADMIN_PASSWORD` in `.env` matches MinIO credentials
- Verify MinIO is accessible at `http://minio:9000` from within Docker network
- Check MinIO console at `http://localhost:9001` (login: admin / ADMIN_PASSWORD)

### 3. Health Check Timeout

**Symptoms:**
- Container starts but never becomes "healthy"
- Nginx shows "Service temporarily unavailable"

**Current Configuration:**

App service health check:
```yaml
healthcheck:
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 60s
```

Nginx wait loop:
```bash
max_attempts=60  # 120 seconds total (60 attempts × 2 seconds)
```

This allows:
- 60 seconds for initial app startup (start_period)
- 5 retries × 10 seconds = 50 more seconds for app health check
- 120 seconds for nginx to wait for app to become responsive
- Total: Up to 2-3 minutes for full startup

**Solutions:**
- Check app logs: `docker compose logs app`
- Verify setup script completes successfully
- If needed, increase `start_period` or `retries` in the app healthcheck
- Ensure `SEED_DEMO_DATA` is not set to `true` (unless intentional)
- The nginx wait time has been increased to 120 seconds to accommodate slower environments

### 4. Environment Variable Issues

**Symptoms:**
- App crashes immediately on startup
- Error: "Environment variable validation failed"

**Solutions:**
- Verify all required variables are set in `.env`
- Check for typos in variable names
- Ensure color values are valid hex codes (e.g., `#2D5016`)
- Verify SMTP settings are correct
- See `src/server/env.ts` for full list of required variables

### 5. Prisma Client Errors

**Symptoms:**
- Error: "Cannot find module '@prisma/client'"
- Error: "Prisma Client is not generated"

**Solutions:**
- Run `pnpm exec prisma generate` manually
- Delete `node_modules` and reinstall: `pnpm install`
- Verify `prisma/schema.prisma` is valid
- Check that `postinstall` script in `package.json` includes `prisma generate`

## Debugging Steps

### 1. Check Container Status
```bash
docker compose ps
```

All services should show "healthy" or "running" status.

### 2. View Application Logs
```bash
# All services
docker compose logs

# Specific service
docker compose logs app
docker compose logs postgres
docker compose logs minio
docker compose logs nginx

# Follow logs in real-time
docker compose logs -f app
```

### 3. Access Health Endpoint Directly
```bash
# From host machine
curl http://localhost:8000/health

# From inside app container
docker compose exec app curl http://localhost:3000/health
```

### 4. Check Database Connection
```bash
# Access database via Adminer
# Navigate to: http://localhost:8000/codapt/db/
# Credentials: admin / ADMIN_PASSWORD

# Or use psql directly
docker compose exec postgres psql -U postgres -d app
```

### 5. Verify MinIO
```bash
# Access MinIO console
# Navigate to: http://localhost:9001
# Login: admin / ADMIN_PASSWORD

# Check buckets exist
docker compose exec app pnpm exec tsx -e "
  import { minioClient } from './src/server/minio.ts';
  minioClient.listBuckets().then(console.log);
"
```

## Environment Variables Reference

### Required Variables
- `NODE_ENV`: `development` or `production`
- `ADMIN_PASSWORD`: Admin password for MinIO and Adminer
- `JWT_SECRET`: Secret for JWT token signing
- `GEMINI_API_KEY`: API key for AI features (Google Gemini)
- `GOOGLE_GENERATIVE_AI_API_KEY`: Should be set to the same value as GEMINI_API_KEY
- `COMPANY_*`: Company information (name, address, phone, email, VAT, bank details)
- `BRAND_*`: Brand colors (must be valid hex codes)
- `SMTP_*`: Email server configuration

### Optional Variables
- `BASE_URL`: Base URL for the application (default: `http://localhost:8000`)
- `BASE_URL_OTHER_PORT`: Template for other ports (default: `http://localhost:[PORT]`)
- `SEED_DEMO_DATA`: Set to `true` to seed demo data on startup (default: not set)

## Performance Tips

### Fast Development Startup
1. Don't set `SEED_DEMO_DATA=true` unless you need demo data
2. Use Docker volume caching for `node_modules`
3. Keep PostgreSQL and MinIO containers running between restarts

### Production Deployment
1. Set `NODE_ENV=production`
2. Use `pnpm build` before `pnpm start`
3. Consider using a managed PostgreSQL service for better reliability
4. Set up proper monitoring and alerting for health checks

## Getting Help

If you encounter issues not covered here:

1. Check the main troubleshooting guides:
   - `AI_TROUBLESHOOTING.md`
   - `TROUBLESHOOTING_502_ERRORS.md`
   - `EMAIL_TESTING_GUIDE.md`

2. Review recent changes in git history

3. Check Docker Compose logs for detailed error messages

4. Verify all environment variables are correctly set

5. Try a clean rebuild:
   ```bash
   docker compose down -v
   docker compose build --no-cache
   docker compose up
   ```
