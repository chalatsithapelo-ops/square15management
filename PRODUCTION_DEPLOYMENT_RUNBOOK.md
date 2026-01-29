# Production Deployment Runbook (www.square15management.co.za)

This repo is deployed to production by pulling from GitHub `main` on the server and restarting a PM2-managed Node process.

## What “making commits live” means
Pushing code to GitHub **does not** automatically update the running website. Production updates only after the server:
1) pulls the new commit (`git pull`)
2) installs/builds the app
3) restarts the PM2 process

## Production Host (current)
- SSH host: `161.35.30.169`
- SSH user: `root`
- Repo path on server: `/root/square15management`
- Process manager: PM2
- PM2 process name: `square15management`
- Health URL (on server): `http://127.0.0.1:3000/health/health`

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

## Standard deployment (safe)
Run these commands on the **production server** from the repo folder:

```bash
cd /root/square15management

# Pull latest main
git pull --ff-only

# Install deps (runs postinstall: prisma generate + route generation)
pnpm install --frozen-lockfile

# Apply schema changes to Postgres (project convention)
pnpm exec prisma db push

# Optional: run setup only if you explicitly want it
# (By default, avoid any demo seeding on production.)
# RUN_SETUP=true SEED_DEMO_DATA=false SKIP_MINIO_SETUP=true pnpm exec tsx src/server/scripts/setup.ts

# Build the production output (.output/*)
pnpm build

# Restart the live process
pm2 restart square15management

# Verify health (startup can take a few seconds after restart)
for i in 1 2 3 4 5; do
  curl -fsS --max-time 10 http://127.0.0.1:3000/health/health && break || true
  sleep 3
done

## Post-deploy verification (quick)
- Verify uploads via nginx MinIO proxy: upload a file (artisan before pictures / supplier slip) and confirm it succeeds.
- Verify PayFast ITN endpoint is reachable publicly: `POST https://www.square15management.co.za/api/payments/payfast/notify/payfast-notify`.
- Verify quotation review/approval works in admin portal.
```

## Critical production configuration checks
- Ensure `BASE_URL` is set to the real production domain (e.g. `https://www.square15management.co.za`). Uploads and PayFast ITN callbacks rely on it.
- MinIO uploads must be reachable from browsers via the nginx `/minio` proxy in production.
- PayFast live requires the correct `PAYFAST_*` env vars (`PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, and optionally `PAYFAST_PASSPHRASE`).

## If uploads fail (MinIO quick checks)
Uploads across all portals depend on MinIO being reachable from the app on `127.0.0.1:9000`.

On the production server:

```bash
# MinIO should respond with "OK"
curl -sS --max-time 3 http://127.0.0.1:9000/minio/health/live

# Confirm something is listening on 9000
ss -ltnp | grep ':9000' || true
```

If MinIO is down and you're using the repo's Docker Compose stack, restart it with the correct env file:

```bash
cd /root/square15management

# IMPORTANT: compose variable substitution uses the current working directory's .env.
# Use the explicit env file so MINIO_ROOT_PASSWORD is set.
docker compose --env-file docker/.env -f docker/compose.yaml up -d minio
```

If MinIO is crash-looping, check logs:

```bash
docker logs --tail 200 docker-minio-1
```


## Notes about TypeScript checks
- This repo can currently build successfully via `pnpm build` even if `pnpm typecheck` fails. Do not add `pnpm typecheck` as a production deployment gate unless you intend to fix the existing strict-TS issues first.

## Verify it’s live
On the server:

```bash
pm2 status
curl -fsS --max-time 10 http://127.0.0.1:3000/health/health
```

From your own machine:
- Open https://www.square15management.co.za

## If deployment fails
### 1) Check logs
```bash
pm2 logs square15management --lines 200
```

### 2) Common causes
- **App not ready yet**: `pm2 restart` returns immediately; wait a few seconds and re-try the health endpoint.
- **Build/dependency failure**: re-run `pnpm install --frozen-lockfile` then `pnpm build`.
- **DB mismatch**: re-run `pnpm exec prisma db push`.

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
- Latest shipped commit (as of 2026-01-19): `134e686`

## Notes
- Avoid destructive scripts (anything that says “purge” or “wipe”) unless you explicitly want to delete production data.
- Do **not** use `./scripts/rebuild` on production unless you explicitly migrate production to a Docker-based deployment.
