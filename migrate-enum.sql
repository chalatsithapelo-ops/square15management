-- Add new enum values to QuotationStatus
ALTER TYPE "QuotationStatus" ADD VALUE IF NOT EXISTS 'PENDING_JUNIOR_MANAGER_REVIEW';
ALTER TYPE "QuotationStatus" ADD VALUE IF NOT EXISTS 'PENDING_SENIOR_MANAGER_REVIEW';
ALTER TYPE "QuotationStatus" ADD VALUE IF NOT EXISTS 'SENT_TO_CUSTOMER';

-- Migrate existing data
UPDATE "Quotation" 
SET status = 'PENDING_JUNIOR_MANAGER_REVIEW' 
WHERE status = 'READY_FOR_REVIEW';

-- Remove old enum value (this will be done by Prisma db push later)
-- Note: PostgreSQL doesn't support removing enum values directly
-- We'll handle this through Prisma's schema migration
