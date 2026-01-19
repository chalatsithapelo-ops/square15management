# Production Deployment Runbook (www.square15management.co.za)

This project deploys from GitHub `main` to the production server using the repo’s Docker scripts.

## What “making commits live” means
Pushing code to GitHub **does not** automatically update the running website. Production updates only after the server:
1) pulls the new commit (`git pull`)
2) rebuilds/restarts containers (`./scripts/rebuild`)

## One-time: confirm you’re on the right server folder
SSH to the server, then run:

```bash
pwd
ls
```

If you don’t know where the app lives, find it (safe discovery commands):

```bash
# Find the repo folder by searching for files that exist in this project
sudo find / -maxdepth 4 -type f -name "DEPLOYMENT_SCRIPTS.md" 2>/dev/null
sudo find / -maxdepth 4 -type f -name "package.json" 2>/dev/null | head

# If you know the repo name is square15management, this is often enough
sudo find / -maxdepth 4 -type d -name "square15management" 2>/dev/null
```

Once found, `cd` into that folder.

## Standard deployment (safe, keeps data)
Run these commands on the **production server** from the project folder:

```bash
git fetch origin
git checkout main
git pull origin main

# Rebuild and restart without wiping the database
./scripts/rebuild

# Follow logs until healthy
./scripts/docker-compose logs -f
```

## Verify it’s live
On the server:

```bash
./scripts/docker-compose ps

# Health endpoint (adjust port if your nginx/app differs)
curl -i http://localhost:8000/health || true
curl -i http://localhost:3000/health || true
```

From your own machine:
- Open https://www.square15management.co.za

## If deployment fails
### 1) Check logs
```bash
./scripts/docker-compose logs -f
```

### 2) Common causes
- **Prisma not generated**: the build should run this, but if it didn’t:
  ```bash
  pnpm install
  pnpm exec prisma generate
  ```
- **Migrations not applied**: apply DB migrations inside the running app container (exact container name varies):
  ```bash
  ./scripts/docker-compose ps
  ./scripts/docker-compose exec app pnpm exec prisma migrate deploy
  ```

### 3) Quick rollback (go back to previous working commit)
```bash
git log --oneline -n 20
# Pick a previous commit hash that was known-good
git checkout <good_commit_hash>
./scripts/rebuild
```

## Recent deployment source of truth
- GitHub repo: `https://github.com/chalatsithapelo-ops/square15management.git`
- Branch: `main`
- Latest shipped commit (as of 2026-01-19): `78142e5`

## Notes
- Avoid destructive scripts (anything that says “purge” or “wipe”) unless you explicitly want to delete production data.
- If your production server uses a process manager (PM2/systemd) instead of Docker, do **not** run these scripts; capture the alternative process in this file once confirmed.
