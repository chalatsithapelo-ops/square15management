-- Extend MaintenanceRequest with maintenance workflow fields
ALTER TABLE "MaintenanceRequest" ADD COLUMN "recipientType" TEXT NOT NULL DEFAULT 'PM';
ALTER TABLE "MaintenanceRequest" ADD COLUMN "recipientId" INTEGER;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "contractorCompanyName" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "contractorEmail" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "contractorPhone" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "contractorContactPerson" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "approvedBy" INTEGER;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "approvalNotes" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "submittedDate" TIMESTAMP(3);
ALTER TABLE "MaintenanceRequest" ADD COLUMN "receivedDate" TIMESTAMP(3);
ALTER TABLE "MaintenanceRequest" ADD COLUMN "rejectedDate" TIMESTAMP(3);
ALTER TABLE "MaintenanceRequest" ADD COLUMN "conversionType" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "convertedDate" TIMESTAMP(3);

-- Update status default
UPDATE "MaintenanceRequest" SET "status" = 'DRAFT' WHERE "status" = 'SUBMITTED';

-- Add indexes
CREATE INDEX "MaintenanceRequest_recipientType_idx" ON "MaintenanceRequest"("recipientType");
