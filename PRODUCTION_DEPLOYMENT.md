# Production Deployment (square15management.co.za)

This repo is deployed to production by pulling from GitHub on the server and restarting a PM2-managed Node process.

## Production Host

- **SSH host (current production):** `161.35.30.169`
- **SSH user:** `root`
- **Repo path on server:** `/root/square15management`
- **Process manager:** PM2
- **PM2 process name:** `square15management`
- **App health URL (on server):** `http://127.0.0.1:3000/health/health`

## Standard Deploy (safe)

Run these commands on the production server:

```bash
cd /root/square15management

# Pull latest main
git pull --ff-only

# Install deps (runs postinstall: prisma generate + route generation)
pnpm install --frozen-lockfile

# Apply schema changes to Postgres
pnpm exec prisma db push

# Optional: only run setup if you explicitly want it
# (Avoid demo seeding on production by default.)
# RUN_SETUP=true SEED_DEMO_DATA=false SKIP_MINIO_SETUP=true pnpm exec tsx src/server/scripts/setup.ts

# Build the production output (.output/*)
pnpm build

# Restart the live process
pm2 restart square15management

# Verify health
curl -fsS --max-time 10 http://127.0.0.1:3000/health/health
```

## Critical production configuration checks
- Ensure `BASE_URL` is set to the real production domain (uploads + PayFast ITN callbacks rely on it).
- Ensure nginx proxies `/minio` correctly for browser uploads.
- Ensure PayFast env vars are set (`PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, optional `PAYFAST_PASSPHRASE`, and `PAYFAST_SANDBOX=false` for live).

## Note about TypeScript checks
- `pnpm build` is the production gate. `pnpm typecheck` may fail due to existing strict-TS issues in non-critical areas.

## Why these steps

- Production runs the built server entry: `.output/server/index.mjs` (PM2).
- `pnpm install` runs `postinstall` (Prisma client generation + TanStack Router generation).
- `prisma db push` keeps the DB schema in sync without migrations (project convention).

## Rollback (quick)

If something goes wrong:

```bash
cd /root/square15management

# Roll back to previous commit (replace SHA)
git reset --hard <KNOWN_GOOD_SHA>

pnpm install --frozen-lockfile
pnpm exec prisma db push
pnpm build
pm2 restart square15management
curl -fsS --max-time 10 http://127.0.0.1:3000/health/health
```

## Notes

- Do **not** use `./scripts/rebuild` on production unless your production is Docker-based.
  The current production setup uses PM2 + a local Postgres container.
