# Preview Deployment Guide

This guide explains how to set up and use preview deployments for the Square 15 Property Management System.

## What are Preview Deployments?

Preview deployments create temporary, isolated instances of your application for testing pull requests and feature branches. Each preview deployment:

- Has its own URL for testing
- Runs independently with its own database and services
- Automatically updates when you push new commits
- Can be shared with team members and stakeholders for review
- Is automatically cleaned up when the PR is closed or merged

## How It Works

### Automated GitHub Actions Workflow

When you open a pull request or push to a feature branch, the GitHub Actions workflow (`.github/workflows/preview-deploy.yml`) automatically:

1. **Builds** the Docker image with your changes
2. **Tests** the application with health checks
3. **Pushes** the image to GitHub Container Registry
4. **Generates** deployment instructions and commands
5. **Comments** on your PR with deployment details

### Manual Deployment

After the workflow completes, you can deploy the preview using several methods:

## Deployment Options

### Option 1: Deploy to Your Own Server (Recommended for Testing)

If you have access to a Linux server with Docker installed:

1. **Create a preview environment directory**:
   ```bash
   mkdir -p ~/previews/pr-123
   cd ~/previews/pr-123
   ```

2. **Download the preview compose file**:
   ```bash
   curl -O https://raw.githubusercontent.com/your-org/your-repo/main/docker/compose.preview.yaml
   ```

3. **Create your `.env` file** (see Environment Variables section below):
   ```bash
   # Copy from your main .env or create a new one
   cp ../../.env .env
   
   # CRITICAL: Update BASE_URL to match your preview URL
   # This MUST be the actual URL where the preview will be accessible
   # For local testing:
   echo "BASE_URL=http://localhost:8000" >> .env
   # For VM deployment:
   echo "BASE_URL=http://YOUR_VM_IP:8000" >> .env
   # For domain deployment:
   echo "BASE_URL=https://pr-123.preview.yourdomain.com" >> .env
   ```

4. **Set the preview image** (from the PR comment):
   ```bash
   export PREVIEW_IMAGE=ghcr.io/your-org/your-repo:pr-123
   ```

5. **Start the preview**:
   ```bash
   docker compose -f compose.preview.yaml up -d
   ```

6. **Monitor the startup** (first start takes 1-2 minutes):
   ```bash
   # Watch the logs
   docker compose -f compose.preview.yaml logs -f
   
   # Check health status
   docker compose -f compose.preview.yaml ps
   ```

7. **Access your preview**:
   - If using a domain: `https://pr-123.preview.yourdomain.com`
   - If using IP: `http://your-server-ip:8000`
   - If local: `http://localhost:8000`

### Option 2: Deploy to DigitalOcean App Platform

DigitalOcean App Platform provides easy deployment with managed databases:

1. **Create a new App** in DigitalOcean
2. **Connect your GitHub repository**
3. **Configure the app**:
   - **Source**: Docker Hub or GitHub Container Registry
   - **Image**: `ghcr.io/your-org/your-repo:pr-123`
   - **HTTP Port**: 3000
   - **Health Check**: `/health`

4. **Add managed services**:
   - PostgreSQL database
   - Redis cache

5. **Configure environment variables** (see section below)

6. **Deploy!**

**Cost**: ~$12-25/month per preview (can be destroyed when not needed)

### Option 3: Deploy to Railway

Railway offers simple deployment with automatic HTTPS:

1. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Create a new project**:
   ```bash
   railway init
   ```

3. **Add services**:
   ```bash
   railway add --database postgres
   railway add --database redis
   ```

4. **Set environment variables**:
   ```bash
   railway variables set NODE_ENV=production
   railway variables set ADMIN_PASSWORD=your-secure-password
   # ... add all other required variables
   ```

5. **Deploy from Docker image**:
   ```bash
   railway up --image ghcr.io/your-org/your-repo:pr-123
   ```

6. **Get your preview URL**:
   ```bash
   railway open
   ```

**Cost**: ~$5-20/month per preview (pay-as-you-go)

### Option 4: Deploy to Render

Render provides free tier options and easy setup:

1. **Create a new Web Service** on Render
2. **Select "Deploy an existing image"**
3. **Image URL**: `ghcr.io/your-org/your-repo:pr-123`
4. **Add PostgreSQL and Redis** from the Render dashboard
5. **Configure environment variables** in the Render dashboard
6. **Deploy**

**Cost**: Free tier available, paid plans start at $7/month

### Option 5: Deploy to Fly.io

Fly.io offers global deployment with excellent performance:

1. **Install Fly CLI**:
   ```bash
   curl -L https://fly.io/install.sh | sh
   fly auth login
   ```

2. **Create a new app**:
   ```bash
   fly apps create pr-123-preview
   ```

3. **Add PostgreSQL**:
   ```bash
   fly postgres create --name pr-123-db
   fly postgres attach pr-123-db
   ```

4. **Deploy from image**:
   ```bash
   fly deploy --image ghcr.io/your-org/your-repo:pr-123
   ```

5. **Set environment variables**:
   ```bash
   fly secrets set ADMIN_PASSWORD=your-secure-password
   fly secrets set JWT_SECRET=your-jwt-secret
   # ... add all other required variables
   ```

**Cost**: Free tier available, paid plans start at $3/month

## ⚠️ CRITICAL: BASE_URL Configuration

**The `BASE_URL` environment variable is the most common cause of preview deployment failures.**

### What is BASE_URL?

`BASE_URL` tells the application what URL it's accessible from. It's used for:
- Generating URLs for file uploads (MinIO object storage)
- Creating links in emails and notifications
- Configuring CORS and security headers

### Common Mistakes

❌ **WRONG** - Using localhost for a remote deployment:
```bash
BASE_URL=http://localhost:8000  # Only works for local testing!
```

❌ **WRONG** - Using internal Docker network names:
```bash
BASE_URL=http://app:3000  # This is internal to Docker!
```

❌ **WRONG** - Missing the protocol:
```bash
BASE_URL=preview.yourdomain.com  # Missing https://
```

### Correct Examples

✅ **Local testing**:
```bash
BASE_URL=http://localhost:8000
```

✅ **VM deployment with IP**:
```bash
BASE_URL=http://203.0.113.42:8000
```

✅ **Domain deployment**:
```bash
BASE_URL=https://pr-123.preview.yourdomain.com
```

✅ **Cloud platform** (Railway, Render, etc.):
```bash
BASE_URL=https://your-app-name.railway.app
```

### How to Check if BASE_URL is Correct

After deploying, open your browser's developer console and check:
1. Network tab - Look at the URLs being requested
2. If you see `localhost` in URLs but you're accessing from a different domain, BASE_URL is wrong
3. If file uploads fail, BASE_URL is almost certainly wrong

### Fixing BASE_URL After Deployment

If you deployed with the wrong BASE_URL:

```bash
# Update .env file
nano .env  # Change BASE_URL to the correct value

# Restart the app
docker compose -f compose.preview.yaml restart app nginx

# Or redeploy completely
docker compose -f compose.preview.yaml down
docker compose -f compose.preview.yaml up -d
```

## Environment Variables

### Required Variables

All preview deployments require these environment variables:

```bash
# Application Configuration
NODE_ENV=production
BASE_URL=https://your-preview-url.com

# Security
ADMIN_PASSWORD=your-secure-admin-password
JWT_SECRET=your-secure-jwt-secret
OPENROUTER_API_KEY=your-openrouter-api-key

# Company Information
COMPANY_NAME="Your Company Name"
COMPANY_ADDRESS_LINE1="Address Line 1"
COMPANY_ADDRESS_LINE2="Address Line 2"
COMPANY_PHONE=+1234567890
COMPANY_EMAIL=contact@company.com
COMPANY_VAT_NUMBER=1234567890

# Brand Colors (hex codes)
BRAND_PRIMARY_COLOR=#2D5016
BRAND_SECONDARY_COLOR=#F4C430
BRAND_ACCENT_COLOR=#5A9A47
BRAND_SUCCESS_COLOR=#10b981
BRAND_WARNING_COLOR=#f59e0b
BRAND_DANGER_COLOR=#dc2626

# Banking Details
COMPANY_BANK_NAME="Bank Name"
COMPANY_BANK_ACCOUNT_NAME="Account Name"
COMPANY_BANK_ACCOUNT_NUMBER=1234567890
COMPANY_BANK_BRANCH_CODE=123456

# Document Prefixes
COMPANY_INVOICE_PREFIX=INV
COMPANY_ORDER_PREFIX=ORD
COMPANY_QUOTATION_PREFIX=QUO

# Email Configuration (optional for previews)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### Optional Variables

```bash
# Demo Data (set to "true" to seed demo data)
SEED_DEMO_DATA=true

# Database URL (if using managed database)
DATABASE_URL=postgresql://user:password@host:5432/database

# Redis URL (if using managed Redis)
REDIS_URL=redis://host:6379
```

### Creating a `.env` file

For manual deployments, create a `.env` file:

```bash
# Copy the template
cp .env.example .env

# Edit with your values
nano .env

# Or generate secure secrets
echo "ADMIN_PASSWORD=$(openssl rand -base64 32)" >> .env
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
```

### Critical: Setting BASE_URL

The `BASE_URL` environment variable **must** be set to the actual preview URL for the application to work correctly:

```bash
# ❌ WRONG - Don't use localhost for preview deployments
BASE_URL=http://localhost:8000

# ✅ CORRECT - Use the actual preview URL
BASE_URL=https://pr-123.preview.yourdomain.com
# or
BASE_URL=https://your-app-name.onrender.com
# or
BASE_URL=https://your-app-name.railway.app
```

**Why this matters:**
- The app uses `BASE_URL` to generate URLs for MinIO (object storage)
- Without the correct URL, file uploads and downloads won't work
- The health check endpoint uses this to determine the correct base URL

**For manual deployments**, set this in your `.env` file before starting the services.

**For cloud platforms**, set this as an environment variable in the platform's dashboard.

## Preview Compose File

The preview deployment uses an optimized compose file with nginx for proper error handling:

```yaml
# docker/compose.preview.yaml
services:
  redis:
    image: redis:7
    volumes:
      - redis-data:/data
    restart: unless-stopped

  postgres:
    image: postgres:16
    volumes:
      - postgres-data:/var/lib/postgresql/data
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_USER: postgres
      POSTGRES_DB: app
    shm_size: 512MB
    restart: unless-stopped

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    volumes:
      - minio-data:/data
    environment:
      MINIO_ROOT_USER: admin
      MINIO_ROOT_PASSWORD: ${ADMIN_PASSWORD}
    restart: unless-stopped

  app:
    image: ${PREVIEW_IMAGE:-ghcr.io/your-org/your-repo:latest}
    depends_on:
      - redis
      - postgres
      - minio
    env_file:
      - .env
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/app
      REDIS_URL: redis://redis:6379
      PORT: 3000
      HOST: 0.0.0.0
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 60s

  nginx:
    image: nginx:latest
    volumes:
      - ./nginx/conf.d/default.conf:/etc/nginx/conf.d/default.conf
      - htpasswd-cache:/etc/nginx/.htpasswd
    ports:
      - "${PREVIEW_PORT:-8000}:8000"
    depends_on:
      app:
        condition: service_healthy
      htpasswd-generator:
        condition: service_completed_successfully
    restart: unless-stopped

  htpasswd-generator:
    image: httpd:alpine
    command: >
      sh -c "htpasswd -bc /htpasswd/htpasswd admin ${ADMIN_PASSWORD} &&
             chmod 644 /htpasswd/htpasswd"
    volumes:
      - htpasswd-cache:/htpasswd

volumes:
  postgres-data:
  redis-data:
  minio-data:
  htpasswd-cache:
```

**Important Notes:**
- **Nginx is required**: The preview deployment includes nginx for proper error handling and request routing. Without it, the app may return raw errors instead of JSON responses, causing the preview to fail to load.
- **Port Configuration**: Nginx listens on port 8000 and proxies requests to the app on port 3000 (internal).
- **Health Check Flow**: PostgreSQL → App → Nginx. Nginx waits for the app to be healthy before starting.
- **BASE_URL**: Must be set to the actual preview URL (not localhost) for proper operation.

## Self-Contained Deployment

The preview compose file (`compose.preview.yaml`) is **completely self-contained**. You don't need any other files from the repository to deploy it.

### What's Included

- ✅ All service definitions (app, postgres, redis, minio, nginx)
- ✅ Nginx configuration (embedded inline)
- ✅ Health checks for all services
- ✅ Automatic startup orchestration
- ✅ Volume management

### What You Need to Provide

- ❌ `.env` file with your environment variables (see Environment Variables section)
- ❌ Docker image (specified via `PREVIEW_IMAGE` environment variable)

### Why This Matters

Previous versions required downloading multiple files (compose file + nginx config). This caused deployment failures when users forgot to download the nginx config file. The new version embeds everything, making deployment foolproof.

## Accessing Your Preview

Once deployed, your preview will be available at:

- **Custom domain**: `https://pr-123.preview.yourdomain.com`
- **Platform domain**: Automatically provided by cloud platforms
- **IP address**: `http://your-server-ip:8000`

### Setting Up Custom Preview Domains

To use custom subdomains for previews (e.g., `pr-123.preview.yourdomain.com`):

1. **Create a wildcard DNS record**:
   ```
   *.preview.yourdomain.com → your-server-ip
   ```

2. **Configure Nginx** to handle multiple subdomains:
   ```nginx
   server {
     listen 80;
     server_name ~^pr-(?<pr_number>\d+)\.preview\.yourdomain\.com$;
     
     location / {
       proxy_pass http://preview-$pr_number:3000;
       # ... other proxy settings
     }
   }
   ```

3. **Use SSL with Let's Encrypt**:
   ```bash
   certbot --nginx -d "*.preview.yourdomain.com"
   ```

## Managing Multiple Previews

### List all running previews:
```bash
docker ps --filter "name=preview"
```

### Stop a specific preview:
```bash
cd ~/previews/pr-123
docker compose -f compose.preview.yaml down
```

### Clean up old previews:
```bash
# Stop and remove all preview containers
docker ps -a --filter "name=preview" -q | xargs docker rm -f

# Remove unused volumes
docker volume prune -f
```

### Automated cleanup script:
```bash
#!/bin/bash
# cleanup-old-previews.sh

# Remove previews older than 7 days
find ~/previews -type d -mtime +7 -exec rm -rf {} \;

# Clean up Docker resources
docker system prune -af --filter "until=168h"
```

## Monitoring and Debugging

### Check preview health:
```bash
curl https://pr-123.preview.yourdomain.com/health
```

### View logs:
```bash
cd ~/previews/pr-123
docker compose -f compose.preview.yaml logs -f app
```

### Access database:
```bash
docker compose -f compose.preview.yaml exec postgres psql -U postgres -d app
```

### Check resource usage:
```bash
docker stats
```

## Troubleshooting

### ❗ Preview shows "Preview failed to load" or blank page

**This is the most common issue with preview deployments.**

**Symptoms:**
- Browser shows a blank page or "Preview failed to load" message
- Browser console shows network errors or CORS errors
- The page loads but immediately shows an error

**Root Causes & Solutions:**

#### 1. BASE_URL is not set correctly (90% of cases)

```bash
# Check what BASE_URL is currently set to
docker compose -f compose.preview.yaml exec app printenv BASE_URL

# It should match the URL you're accessing the preview from
# If it doesn't, update .env and restart:
nano .env  # Update BASE_URL
docker compose -f compose.preview.yaml restart app nginx
```

**How to verify:** Open browser DevTools → Network tab → Look at the URLs being requested. If you see `localhost` but you're accessing from a different URL, BASE_URL is wrong.

#### 2. Services are still starting up

```bash
# Check if all services are healthy
docker compose -f compose.preview.yaml ps

# All services should show "healthy" or "running"
# If app shows "starting" or "unhealthy", wait 1-2 minutes

# Watch the startup logs
docker compose -f compose.preview.yaml logs -f app

# Look for "Server started" or similar message
```

**How to verify:** Run `curl http://localhost:8000/health` (or your preview URL). You should get a JSON response with `"status": "ok"`.

#### 3. Nginx failed to start

```bash
# Check nginx status
docker compose -f compose.preview.yaml ps nginx

# If it's not running, check logs
docker compose -f compose.preview.yaml logs nginx

# Common issue: App not healthy before nginx started
# Solution: Restart nginx after app is healthy
docker compose -f compose.preview.yaml restart nginx
```

**How to verify:** Nginx logs should show "App is healthy, starting nginx..." If it shows "App not healthy yet" repeatedly, the app has a problem.

#### 4. Port is already in use

```bash
# Check if port 8000 is already in use
sudo netstat -tulpn | grep 8000

# If it's in use, either:
# Option A: Stop the conflicting service
# Option B: Use a different port
PREVIEW_PORT=8001 docker compose -f compose.preview.yaml up -d
```

#### 5. Missing or incorrect environment variables

```bash
# Check if .env file exists
ls -la .env

# Verify required variables are set
docker compose -f compose.preview.yaml config | grep -E "(BASE_URL|ADMIN_PASSWORD|JWT_SECRET)"

# If any are missing, add them to .env and restart
docker compose -f compose.preview.yaml restart app
```

### Preview shows "Connection Error" or "Service temporarily unavailable"

This is different from "Preview failed to load" - it means the app is running but having issues.

**Common Causes:**

1. **Database connection failed**
   ```bash
   # Check PostgreSQL is running
   docker compose -f compose.preview.yaml ps postgres
   
   # Check database logs
   docker compose -f compose.preview.yaml logs postgres
   
   # Test database connection
   docker compose -f compose.preview.yaml exec postgres psql -U postgres -d app -c "SELECT 1"
   ```

2. **Redis connection failed**
   ```bash
   # Check Redis is running
   docker compose -f compose.preview.yaml ps redis
   
   # Test Redis connection
   docker compose -f compose.preview.yaml exec redis redis-cli ping
   ```

3. **MinIO not accessible**
   ```bash
   # Check MinIO is running
   docker compose -f compose.preview.yaml ps minio
   
   # Check MinIO health
   docker compose -f compose.preview.yaml exec minio curl -f http://localhost:9000/minio/health/live
   ```

### Preview fails to start

1. **Check logs**:
   ```bash
   docker compose -f compose.preview.yaml logs app
   ```

2. **Verify environment variables**:
   ```bash
   docker compose -f compose.preview.yaml config
   ```

3. **Test database connection**:
   ```bash
   docker compose -f compose.preview.yaml exec app pnpm exec prisma db push
   ```

### Health check fails

1. **Increase startup time** in `compose.preview.yaml`:
   ```yaml
   healthcheck:
     start_period: 120s  # Increase from 60s
   ```

2. **Check resource limits**:
   Ensure your server has enough resources (at least 2GB RAM recommended)

3. **Verify all services are running**:
   ```bash
   docker compose -f compose.preview.yaml ps
   # All services should show "Up" or "healthy"
   ```

### Preview works but file uploads fail

This is usually caused by incorrect `BASE_URL` configuration:

```bash
# The BASE_URL must match your actual preview URL
# Check the browser's network tab to see what URL is being used

# Fix: Update BASE_URL in .env or environment variables
BASE_URL=https://your-actual-preview-url.com

# Restart services
docker compose -f compose.preview.yaml restart app nginx
```

### Out of disk space

1. **Clean up old images**:
   ```bash
   docker image prune -a
   ```

2. **Remove old preview volumes**:
   ```bash
   docker volume ls | grep preview | awk '{print $2}' | xargs docker volume rm
   ```

### Port already in use

Change the port mapping in `compose.preview.yaml`:
```yaml
ports:
  - "8001:3000"  # Use a different port
```

## Security Considerations

### For Production Previews:

1. **Use strong passwords**:
   ```bash
   ADMIN_PASSWORD=$(openssl rand -base64 32)
   JWT_SECRET=$(openssl rand -base64 32)
   ```

2. **Enable HTTPS** with Let's Encrypt or your cloud platform's SSL

3. **Restrict access** with basic authentication or IP whitelisting:
   ```nginx
   location / {
     auth_basic "Preview Access";
     auth_basic_user_file /etc/nginx/.htpasswd;
     # ... proxy settings
   }
   ```

4. **Use separate credentials** for each preview environment

5. **Clean up** previews promptly when no longer needed

## Cost Optimization

### Tips to reduce preview deployment costs:

1. **Destroy previews** when PR is merged or closed
2. **Use smaller instances** for previews (1GB RAM is often sufficient)
3. **Share database** across multiple previews (if isolated data isn't critical)
4. **Use free tiers** for development previews
5. **Schedule automatic cleanup** of old previews
6. **Consider spot instances** on AWS/GCP for cost savings

## Integration with CI/CD

### Automatic deployment on PR creation:

The GitHub Actions workflow automatically builds and tests your preview. To enable automatic deployment:

1. **Add deployment secrets** to your GitHub repository:
   - `DEPLOY_HOST`: Your deployment server
   - `DEPLOY_SSH_KEY`: SSH key for deployment
   - `DEPLOY_USER`: SSH user

2. **Update the workflow** to include deployment steps

3. **Configure webhook** to notify when deployment is complete

### Example deployment step:

```yaml
- name: Deploy to preview server
  uses: appleboy/ssh-action@master
  with:
    host: ${{ secrets.DEPLOY_HOST }}
    username: ${{ secrets.DEPLOY_USER }}
    key: ${{ secrets.DEPLOY_SSH_KEY }}
    script: |
      cd ~/previews/pr-${{ github.event.pull_request.number }}
      docker pull ${{ steps.meta.outputs.tags }}
      docker compose -f compose.preview.yaml up -d
```

## Best Practices

1. **Name previews consistently**: Use PR number or branch name
2. **Tag images properly**: Include PR number and commit SHA
3. **Document preview URLs**: Comment on PRs with preview links
4. **Test before merging**: Always test the preview before merging
5. **Clean up regularly**: Remove old previews to save resources
6. **Monitor costs**: Track spending on preview deployments
7. **Use staging for final testing**: Don't rely solely on previews

## Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Deployment Troubleshooting Guide](./DEPLOYMENT_TROUBLESHOOTING.md)
- [Main README](./README.md)

## Support

If you encounter issues with preview deployments:

1. Check the [Deployment Troubleshooting Guide](./DEPLOYMENT_TROUBLESHOOTING.md)
2. Review GitHub Actions workflow logs
3. Check preview deployment logs
4. Verify all environment variables are set correctly
5. Ensure your server has sufficient resources

For platform-specific issues, consult the respective platform's documentation.
