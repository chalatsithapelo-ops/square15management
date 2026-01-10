# Preview Deployment BASE_URL Configuration Guide

## Overview

The `BASE_URL` environment variable is **critical** for preview deployments to function correctly. This guide explains why it's important and how to configure it properly.

## Why BASE_URL is Critical

The `BASE_URL` environment variable is used throughout the application for:

1. **Email Links**: All emails sent by the system (invoices, notifications, reports) contain links back to the application. These links use `BASE_URL`.
2. **PDF Generation**: PDFs (invoices, reports, statements) may contain QR codes or links that use `BASE_URL`.
3. **File Storage URLs**: MinIO (object storage) URLs are constructed using `BASE_URL` to provide external access to uploaded files.
4. **Push Notifications**: Web push notification configuration uses `BASE_URL` for the service worker.
5. **Customer Portal Links**: Links to the customer portal in emails and notifications use `BASE_URL`.

## Current Preview Deployment

Your preview deployment is available at:
```
https://preview-1z2ej1y9mvgh2n609ri4sy.codapt.app/
```

## Configuration Steps

### Option 1: Environment Variable (Recommended for Cloud Deployments)

If you're deploying to a cloud platform (DigitalOcean, Railway, Render, Fly.io, etc.), set the `BASE_URL` environment variable in your platform's dashboard:

```bash
BASE_URL=https://preview-1z2ej1y9mvgh2n609ri4sy.codapt.app
```

**Important**: 
- Do NOT include a trailing slash
- Use `https://` (not `http://`) for secure deployments
- Use the exact URL where your application is accessible

### Option 2: Docker Compose (For Manual VM Deployments)

If you're using `docker/compose.preview.yaml` directly on a VM:

1. Set the environment variable before running docker compose:
   ```bash
   export BASE_URL=https://preview-1z2ej1y9mvgh2n609ri4sy.codapt.app
   cd docker
   docker compose -f compose.preview.yaml up -d
   ```

2. Or create a `.env` file in the project root with:
   ```bash
   BASE_URL=https://preview-1z2ej1y9mvgh2n609ri4sy.codapt.app
   ```

### Option 3: Using the Preview Deploy Script

The `scripts/preview-deploy` script includes BASE_URL validation:

```bash
# Set BASE_URL
export BASE_URL=https://preview-1z2ej1y9mvgh2n609ri4sy.codapt.app

# Run the preview deploy script
./scripts/preview-deploy start
```

The script will:
- Check if BASE_URL is set
- Warn if it's using localhost (which won't work for external access)
- Show the current configuration

## Verification

After deploying with the correct BASE_URL, verify it's working:

### 1. Check Application Health
```bash
curl https://preview-1z2ej1y9mvgh2n609ri4sy.codapt.app/health
```

Should return:
```json
{"status":"ok"}
```

### 2. Check MinIO Base URL (via tRPC)

The application exposes the MinIO base URL through the `getMinioBaseUrl` tRPC procedure. You can verify this is correct by:

1. Log into the application
2. Open browser DevTools → Network tab
3. Look for tRPC calls to `getMinioBaseUrl`
4. Verify the response shows the correct preview URL

Expected response:
```json
{
  "baseUrl": "https://preview-1z2ej1y9mvgh2n609ri4sy9000.codapt.app"
}
```

### 3. Test Email Links

If you have email notifications enabled:

1. Trigger a test email (e.g., create an order)
2. Check that links in the email point to `https://preview-1z2ej1y9mvgh2n609ri4sy.codapt.app`

### 4. Test File Uploads

1. Upload a file (e.g., company logo, expense receipt)
2. Verify the file URL starts with the correct preview domain

## Common Issues

### Issue: Links in emails point to localhost

**Cause**: BASE_URL is not set or is set to `http://localhost:8000`

**Solution**: Set BASE_URL to your preview URL before starting the application:
```bash
export BASE_URL=https://preview-1z2ej1y9mvgh2n609ri4sy.codapt.app
```

### Issue: File uploads return 404 errors

**Cause**: MinIO base URL is incorrect (derived from BASE_URL)

**Solution**: 
1. Ensure BASE_URL is set correctly
2. Restart the application to pick up the new BASE_URL
3. Check that MinIO is accessible at port 9000

### Issue: Application shows localhost in logs

**Cause**: BASE_URL was not set when the application started

**Solution**: 
1. Stop the application
2. Set BASE_URL environment variable
3. Restart the application

## How BASE_URL is Used Internally

### Server-Side (`src/server/utils/base-url.ts`)

The `getBaseUrl()` function is the single source of truth for the application's base URL:

```typescript
export function getBaseUrl({ port }: { port?: number } = {}): string {
  if (port === undefined || port === 8000) {
    return env.BASE_URL ?? "http://localhost:8000";
  }
  // ... handles other ports like MinIO (9000)
}
```

### MinIO Configuration (`src/server/minio.ts`)

MinIO URLs are constructed using `getBaseUrl({ port: 9000 })`:

```typescript
function getMinioBaseUrl(): string {
  return getBaseUrl({ port: 9000 });
}
```

For the preview URL `https://preview-1z2ej1y9mvgh2n609ri4sy.codapt.app`, this becomes:
```
https://preview-1z2ej1y9mvgh2n609ri4sy9000.codapt.app
```

### Email Templates (`src/server/utils/email.ts`)

Email templates use `getBaseUrl()` to construct links:

```typescript
const portalLink = `${getBaseUrl()}/customer/dashboard`;
```

### Client-Side (`src/trpc/react.tsx`)

The client-side tRPC configuration automatically uses `window.location.origin`, so it will work correctly when accessed through the preview URL.

## Environment-Specific Configuration

### Local Development
```bash
BASE_URL=http://localhost:8000
```

### Preview Deployment (Current)
```bash
BASE_URL=https://preview-1z2ej1y9mvgh2n609ri4sy.codapt.app
```

### Production Deployment
```bash
BASE_URL=https://your-production-domain.com
```

## Deployment Checklist

Before deploying a preview, ensure:

- [ ] `BASE_URL` environment variable is set to the correct preview URL
- [ ] BASE_URL does not have a trailing slash
- [ ] BASE_URL uses `https://` for secure deployments
- [ ] All required environment variables are set (see `.env.example`)
- [ ] Database is accessible from the application
- [ ] MinIO port (9000) is properly configured
- [ ] Email SMTP settings are configured (if email features are needed)

## Testing Checklist

After deployment, verify:

- [ ] Application health endpoint returns 200 OK
- [ ] Can log in to the application
- [ ] MinIO base URL is correct (check via browser DevTools)
- [ ] File uploads work correctly
- [ ] Email links point to the correct preview URL (if applicable)
- [ ] Customer portal links work correctly
- [ ] PDF generation works (if applicable)

## Getting Help

If you encounter issues with BASE_URL configuration:

1. Check the application logs for BASE_URL-related messages
2. Verify the environment variable is set in your deployment platform
3. Restart the application after changing BASE_URL
4. See `DEPLOYMENT_TROUBLESHOOTING.md` for additional help

## Related Documentation

- `.env.example` - Environment variable reference
- `PREVIEW_DEPLOYMENT.md` - General preview deployment guide
- `PREVIEW_DEPLOYMENT_QUICKSTART.md` - Quick start guide
- `DEPLOYMENT_TROUBLESHOOTING.md` - Troubleshooting guide
- `docker/compose.preview.yaml` - Docker Compose configuration
