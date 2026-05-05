# Bank Feed Real-Time + Cashbook — Production Rollout

Target: `root@161.35.30.169` · PM2 app: `square15management` · Stage 4 (full real-time)

> Run these from your local machine. Each step is reversible.

---

## 1. Commit & push (local)

```powershell
cd "C:\Users\Thapelo\Downloads\SQR15 Prop Management System (16)\SQR15 Prop Management System 1 12 2025"
git status
git add -A
git commit -m "feat(bank-feed): Cashbook tab + IMAP IDLE + SSE live updates"
git push
```

---

## 2. Pre-flight on prod (read-only — safe)

```powershell
ssh root@161.35.30.169 "cd /var/www/square15management && git status && pm2 status square15management"
```

Make sure the working tree is clean and PM2 shows the app online.

---

## 3. Add the env flags

SSH in and edit `.env`:

```bash
ssh root@161.35.30.169
cd /var/www/square15management
cp .env .env.bak.$(date +%Y%m%d-%H%M%S)
nano .env
```

Add (or update) these three lines:

```
CASHBOOK_ENABLED=1
BANK_FEED_IDLE=1
BANK_FEED_POLL_MS=300000
```

Save and exit nano (Ctrl+O, Enter, Ctrl+X).

> `BANK_FEED_POLL_MS` is only used if `BANK_FEED_IDLE` is off. Keeping
> the value documented makes rollback (set `BANK_FEED_IDLE=` empty)
> deterministic.

---

## 4. Pull + build + restart (still on the server)

```bash
cd /var/www/square15management
git pull
pnpm install --frozen-lockfile

# Schema unchanged this deploy — but generate just in case node_modules
# was wiped by a clean install. This is idempotent.
pnpm prisma generate

# No new migrations this deploy. If you have other pending migrations,
# uncomment the next line. It is forward-only and safe to re-run.
# pnpm prisma migrate deploy

pnpm build

pm2 restart square15management --update-env
pm2 logs square15management --lines 80
```

Watch for these expected lines in the logs:

```
[Bank Feed] IMAP IDLE (push) started for <your finance email>
[BankFeed][IDLE] Connected. Listening for new mail…
```

If you instead see polling-mode logs, the IDLE env var didn't load —
check step 3 and re-restart with `--update-env`.

---

## 5. Smoke test (in a browser)

1. Open https://www.square15management.co.za and log in as an admin.
2. Go to **Admin → Management Accounts**.
3. Click the new **Cashbook (Live)** tab. Confirm the amber Cash-vs-Accrual
   banner is visible.
4. Pick an account from the selector. Confirm KPI cards populate.
5. In a separate tab open **Admin → Bank Feed**. Confirm the page loads
   normally.
6. (Optional) Open browser devtools → Network → filter `stream`. Confirm
   `/api/bank-feed/stream` is connected with status `200` and `eventsource`
   type. You should see periodic `: keep-alive` lines under "Response".
7. (Optional) Trigger a real bank notification email or use the manual
   "Add transaction" path. The Cashbook KPIs should update within 1–2
   seconds without page refresh.

---

## 6. Roll back instantly if anything looks wrong

Hide the Cashbook tab + revert to polling, no redeploy:

```bash
ssh root@161.35.30.169
cd /var/www/square15management
sed -i 's/^CASHBOOK_ENABLED=.*/CASHBOOK_ENABLED=/' .env
sed -i 's/^BANK_FEED_IDLE=.*/BANK_FEED_IDLE=/' .env
pm2 restart square15management --update-env
```

Full code rollback (only if the deploy itself broke something):

```bash
cd /var/www/square15management
git log --oneline -5          # find the previous good commit
git reset --hard <prev-sha>
pnpm install --frozen-lockfile
pnpm build
pm2 restart square15management --update-env
```

---

## 7. After 24 hours of stable IDLE — staff training

- Send [docs/STAFF_CASHBOOK_GUIDE.md](STAFF_CASHBOOK_GUIDE.md) to finance
  and admin staff.
- Walk the team through the **Cash vs Accrual** distinction (see section
  2 of that doc) before they start using the new tab for decisions.

---

## Cluster-mode caveat (read once, plan later)

The SSE event bus is **in-process**. If/when PM2 cluster grows past 1
worker, only the worker holding the IMAP connection emits live events.
Other workers' connected browsers fall back to the 5-min safety refresh
(`refetchInterval` in the Cashbook panel and bank-feed page). Tracked
in [BANK_FEED_AS_BUILT.md](BANK_FEED_AS_BUILT.md) under "Cluster-mode
note". Not a blocker for current scale.
