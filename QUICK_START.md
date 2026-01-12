# Quick Start Guide

Get the Square 15 Property Management System running in 5 minutes.

## Local Development

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd sqr15-prop-management-system

# Copy environment file
cp .env.example .env

# Edit .env with your configuration (at minimum, set secure passwords)
nano .env
```

### 2. Start the Application

```bash
# Start all services with Docker
./scripts/run
```

That's it! The application will be available at http://localhost:8000

### 3. Login

Default credentials:
- **Admin**: admin@example.com / password
- **Artisan**: artisan@example.com / password
- **Customer**: customer@example.com / password

## Preview Deployment (Test a PR)

### Option 1: Local Preview Test

```bash
# Build the preview image
./scripts/preview-deploy build

# Start the preview
./scripts/preview-deploy start

# Access at http://localhost:8000
```

### Option 2: Deploy to Cloud (Railway Example)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project and add services
railway init
railway add --database postgres
railway add --database redis

# Set environment variables (copy from .env.example)
railway variables set NODE_ENV=production
railway variables set ADMIN_PASSWORD=$(openssl rand -base64 32)
railway variables set JWT_SECRET=$(openssl rand -base64 32)
# ... set all other required variables

# Deploy from GitHub Container Registry image
railway up --image ghcr.io/your-org/your-repo:pr-123

# Get your URL
railway open
```

## Essential Environment Variables

The minimum required variables to get started:

```bash
# Security (generate with: openssl rand -base64 32)
ADMIN_PASSWORD=your-secure-password
JWT_SECRET=your-secure-jwt-secret

# AI Features (get from https://openrouter.ai/keys)
OPENROUTER_API_KEY=sk-or-v1-your-key

# Company Info (used in PDFs and invoices)
COMPANY_NAME="Your Company"
COMPANY_EMAIL=contact@company.com
COMPANY_PHONE=+1234567890

# Email (optional for testing)
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

See `.env.example` for all available options.

## Troubleshooting

### App won't start?

```bash
# Check logs
docker compose logs app

# Try a clean restart
docker compose down -v
docker compose up
```

### Permanent "no login errors" setup (Windows/Docker)

If you see intermittent login failures like "Authentication failed against database server" after a reboot, it usually means PostgreSQL wasn't running yet.

This repo's [docker/compose.yaml](docker/compose.yaml) is configured so core services (Postgres/Redis/MinIO) automatically restart after reboots **as long as Docker Desktop is running**.

One-time setup on Windows:
- Enable Docker Desktop to start on login.
- Start the services once:

```powershell
docker compose -f docker/compose.yaml up -d
```

Optional helper scripts (repo root):
- `start-dev.ps1` starts infra + the dev server
- `diagnose-db.ps1` checks DATABASE_URL + port 5432 + container status
- `fix-local-postgres.ps1` resets local dev DB volume (deletes local dev data)

### Health check fails?

```bash
# Test the health endpoint
curl http://localhost:8000/health

# Should return: {"status":"ok","timestamp":"..."}
```

### Need demo data?

```bash
# Add to .env
echo "SEED_DEMO_DATA=true" >> .env

# Restart
docker compose restart app
```

## Next Steps

- 📖 Read the [full README](./README.md) for detailed information
- 🚀 Learn about [Preview Deployments](./PREVIEW_DEPLOYMENT.md)
- 🐛 Check [Troubleshooting Guide](./DEPLOYMENT_TROUBLESHOOTING.md) if you have issues
- ✉️ Set up [Email Configuration](./EMAIL_CONFIGURATION_GUIDE.md)

## Useful Commands

```bash
# View all logs
docker compose logs -f

# Access database
docker compose exec postgres psql -U postgres -d app

# Stop everything
docker compose down

# Clean restart (removes all data)
docker compose down -v && docker compose up

# Update dependencies
pnpm update

# Generate Prisma client
pnpm exec prisma generate

# Apply database changes
pnpm exec prisma db push
```

## Getting Help

1. Check the documentation files in this repository
2. Review the logs: `docker compose logs app`
3. Verify your `.env` file has all required variables
4. See [DEPLOYMENT_TROUBLESHOOTING.md](./DEPLOYMENT_TROUBLESHOOTING.md)

---

**Ready to contribute?** Open a PR and get an automatic preview deployment! 🚀
