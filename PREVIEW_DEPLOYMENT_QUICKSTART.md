# Preview Deployment Quick Start - Fixing "Failed to Deploy"

This guide helps you quickly fix the most common preview deployment issue: **incorrect BASE_URL configuration**.

## The Problem

When you see "preview failed to deploy" or the preview loads but shows connection errors, it's almost always because the `BASE_URL` environment variable is set to `http://localhost:8000`, which doesn't work for external access.

### Why This Matters

The application uses `BASE_URL` to:
- Generate MinIO (file storage) URLs for uploads/downloads
- Create links in emails and PDFs
- Configure the tRPC client-server communication

If `BASE_URL` points to `localhost`, external clients can't access these resources, causing the app to fail.

## Quick Fix

### For Local Testing (Same Machine)

If you're testing on the same machine where the app is running:

```bash
# No changes needed - localhost works fine
./scripts/preview-deploy start
```

### For VM/Cloud Deployment (External Access)

If you're deploying on a VM or cloud server and accessing from a different machine:

**Step 1: Find your server's IP or domain**
```bash
# On the server, get your external IP
curl ifconfig.me

# Or if you have a domain
echo "your-domain.com"
```

**Step 2: Set BASE_URL before starting**
```bash
# Replace YOUR_VM_IP with your actual IP address
export BASE_URL=http://YOUR_VM_IP:8000

# Or if using a domain
export BASE_URL=https://your-domain.com

# Now start the preview
./scripts/preview-deploy start
```

**Step 3: Verify the configuration**
```bash
./scripts/preview-deploy config
```

### For Docker Compose Directly

If you're using `docker compose` directly:

```bash
# Set BASE_URL in your environment
export BASE_URL=http://YOUR_VM_IP:8000

# Start with the preview compose file
cd docker
docker compose -f compose.preview.yaml up -d
```

### For Already Running Deployments

If your preview is already running with the wrong BASE_URL:

```bash
# Stop the preview
./scripts/preview-deploy stop

# Set the correct BASE_URL
export BASE_URL=http://YOUR_VM_IP:8000

# Start again
./scripts/preview-deploy start
```

## Verification Steps

### 1. Check Health Endpoint

```bash
# Should return JSON with status "ok"
curl http://YOUR_VM_IP:8000/health
```

Expected response:
```json
{"status":"ok"}
```

### 2. Check BASE_URL Configuration

```bash
# View current configuration
./scripts/preview-deploy config
```

Look for:
```
BASE_URL: http://YOUR_VM_IP:8000
```

### 3. Test the Application

Open your browser and navigate to:
```
http://YOUR_VM_IP:8000
```

You should see the login page. If you see a connection error, check the browser console for specific error messages.

### 4. Check Logs

If the app still isn't working:

```bash
# View all logs
./scripts/preview-deploy logs

# View just the app logs
./scripts/preview-deploy logs app

# View nginx logs (for connection issues)
./scripts/preview-deploy logs nginx
```

## Common Scenarios

### Scenario 1: Local Development

**Configuration:**
```bash
BASE_URL=http://localhost:8000
```

**Access URL:**
```
http://localhost:8000
```

**Use case:** Testing on your local machine

### Scenario 2: VM with IP Address

**Configuration:**
```bash
export BASE_URL=http://203.0.113.42:8000
```

**Access URL:**
```
http://203.0.113.42:8000
```

**Use case:** Deploying on a cloud VM (AWS, DigitalOcean, etc.)

### Scenario 3: VM with Domain Name

**Configuration:**
```bash
export BASE_URL=https://preview.yourdomain.com
```

**Access URL:**
```
https://preview.yourdomain.com
```

**Use case:** Production-like preview with SSL

### Scenario 4: Custom Port

**Configuration:**
```bash
export PREVIEW_PORT=8001
export BASE_URL=http://YOUR_VM_IP:8001
```

**Access URL:**
```
http://YOUR_VM_IP:8001
```

**Use case:** Running multiple previews on different ports

## Troubleshooting

### Issue: "Connection Error" in Browser

**Symptoms:**
- Page loads but shows "Unable to connect to the server"
- Browser console shows JSON parse errors
- Network tab shows 502/503 errors

**Solution:**
1. Check BASE_URL is set to the external URL (not localhost)
2. Verify the app is healthy: `./scripts/preview-deploy status`
3. Check nginx is running: `docker compose -f docker/compose.preview.yaml ps nginx`

### Issue: File Uploads Fail

**Symptoms:**
- Can log in but file uploads don't work
- MinIO URLs in browser console point to localhost

**Solution:**
This is a BASE_URL issue. The app is generating MinIO URLs with localhost instead of your external URL.

```bash
# Stop and restart with correct BASE_URL
./scripts/preview-deploy stop
export BASE_URL=http://YOUR_VM_IP:8000
./scripts/preview-deploy start
```

### Issue: App Shows "Service Temporarily Unavailable"

**Symptoms:**
- Browser shows JSON error message
- Nginx returns 502/503

**Solution:**
The app isn't healthy yet. Check the logs:

```bash
./scripts/preview-deploy logs app
```

Common causes:
- Database connection failed (check postgres logs)
- Prisma migration failed (check app logs for "prisma" errors)
- Setup script failed (check app logs for "setup" errors)

### Issue: Preview Works Locally But Not Externally

**Symptoms:**
- `curl http://localhost:8000/health` works on the server
- `curl http://YOUR_VM_IP:8000/health` fails from another machine

**Solution:**
This is usually a firewall issue, not a BASE_URL issue.

1. Check if the port is open:
   ```bash
   # On the server
   sudo netstat -tlnp | grep 8000
   ```

2. Check firewall rules:
   ```bash
   # Ubuntu/Debian
   sudo ufw status
   sudo ufw allow 8000/tcp
   
   # CentOS/RHEL
   sudo firewall-cmd --list-all
   sudo firewall-cmd --add-port=8000/tcp --permanent
   sudo firewall-cmd --reload
   ```

3. Check cloud provider security groups (AWS, GCP, Azure, etc.)

## Environment Variable Reference

### Required for External Access

| Variable | Example | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://203.0.113.42:8000` | External URL for the preview (CRITICAL) |

### Optional Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PREVIEW_PORT` | `8000` | Port to expose the preview on |
| `PREVIEW_NAME` | `local-preview` | Name for the Docker Compose project |
| `IMAGE_TAG` | `preview-local` | Docker image tag to use |

## Best Practices

### 1. Always Set BASE_URL for Non-Local Deployments

```bash
# Add to your shell profile for convenience
echo 'export BASE_URL=http://YOUR_VM_IP:8000' >> ~/.bashrc
source ~/.bashrc
```

### 2. Use a Domain Name for Production Previews

Instead of IP addresses, use a domain:

```bash
# Set up a wildcard DNS record: *.preview.yourdomain.com → YOUR_VM_IP
export BASE_URL=https://pr-123.preview.yourdomain.com
```

### 3. Document Your Preview URLs

When creating a PR, add a comment with:
- The preview URL
- The BASE_URL setting used
- Any special configuration

### 4. Clean Up Old Previews

```bash
# List all previews
docker ps --filter "name=preview"

# Clean up a specific preview
./scripts/preview-deploy cleanup

# Clean up all preview resources
docker system prune -af --filter "label=preview"
```

## Additional Resources

- [Full Preview Deployment Guide](./PREVIEW_DEPLOYMENT.md)
- [Deployment Troubleshooting](./DEPLOYMENT_TROUBLESHOOTING.md)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

## Getting Help

If you're still having issues:

1. Check the logs: `./scripts/preview-deploy logs`
2. Verify configuration: `./scripts/preview-deploy config`
3. Check health: `./scripts/preview-deploy status`
4. Review the full deployment guide: [PREVIEW_DEPLOYMENT.md](./PREVIEW_DEPLOYMENT.md)

## Summary

**The #1 rule for preview deployments:**

> Always set `BASE_URL` to the actual external URL where the preview will be accessed.

```bash
# ❌ WRONG - Don't use localhost for external access
BASE_URL=http://localhost:8000

# ✅ CORRECT - Use the actual external URL
BASE_URL=http://YOUR_VM_IP:8000
# or
BASE_URL=https://your-preview-domain.com
```

This single configuration change fixes 90% of preview deployment issues!
