-- Add MBTI assessment requirement + flip psychometric defaults ON
-- (2026-09-13) — so freshly-created jobs test the full 5-assessment pack
-- (AI Behaviour Interview, IQ, EQ, MBTI, Big Five) by default instead
-- of only the interview.

ALTER TABLE "Job"
  ADD COLUMN IF NOT EXISTS "requireMBTI" BOOLEAN NOT NULL DEFAULT true;

-- Change defaults for future inserts. Existing rows keep whatever the
-- admin previously picked; backfill script below opts them in.
ALTER TABLE "Job" ALTER COLUMN "requireIQ" SET DEFAULT true;
ALTER TABLE "Job" ALTER COLUMN "requireEQ" SET DEFAULT true;
ALTER TABLE "Job" ALTER COLUMN "requireBigFive" SET DEFAULT true;
ALTER TABLE "Job" ALTER COLUMN "requireWorkSample" SET DEFAULT true;

-- Backfill: opt in every currently-OPEN job so the candidates the user
-- is testing today land in the full assessment flow immediately.
UPDATE "Job"
   SET "requireIQ" = true,
       "requireEQ" = true,
       "requireBigFive" = true,
       "requireMBTI" = true,
       "requireWorkSample" = true,
       "requireInterview" = true
 WHERE "status" IN ('OPEN', 'DRAFT', 'PENDING_APPROVAL');
