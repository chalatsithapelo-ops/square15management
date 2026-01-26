-- Add persisted dispute flags for tenant invoice tracking

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "isDisputed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RentPayment" ADD COLUMN IF NOT EXISTS "isDisputed" BOOLEAN NOT NULL DEFAULT false;
