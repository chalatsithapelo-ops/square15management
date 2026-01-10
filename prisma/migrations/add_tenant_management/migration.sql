-- Add tenant management and onboarding fields to PropertyManagerCustomer
ALTER TABLE "PropertyManagerCustomer" ADD COLUMN "buildingId" INTEGER;
ALTER TABLE "PropertyManagerCustomer" ADD COLUMN "onboardingStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "PropertyManagerCustomer" ADD COLUMN "onboardedDate" TIMESTAMP(3);
ALTER TABLE "PropertyManagerCustomer" ADD COLUMN "approvedBy" INTEGER;
ALTER TABLE "PropertyManagerCustomer" ADD COLUMN "approvedDate" TIMESTAMP(3);
ALTER TABLE "PropertyManagerCustomer" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "PropertyManagerCustomer" ADD COLUMN "leaseStartDate" TIMESTAMP(3);
ALTER TABLE "PropertyManagerCustomer" ADD COLUMN "leaseEndDate" TIMESTAMP(3);
ALTER TABLE "PropertyManagerCustomer" ADD COLUMN "monthlyRent" DOUBLE PRECISION;
ALTER TABLE "PropertyManagerCustomer" ADD COLUMN "securityDeposit" DOUBLE PRECISION;
ALTER TABLE "PropertyManagerCustomer" ADD COLUMN "electricityMeterNumber" TEXT;
ALTER TABLE "PropertyManagerCustomer" ADD COLUMN "waterMeterNumber" TEXT;
ALTER TABLE "PropertyManagerCustomer" ADD COLUMN "gasMeterNumber" TEXT;

-- Update default status to PENDING for new customers
ALTER TABLE "PropertyManagerCustomer" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- Create indexes
CREATE INDEX "PropertyManagerCustomer_buildingId_idx" ON "PropertyManagerCustomer"("buildingId");
CREATE INDEX "PropertyManagerCustomer_onboardingStatus_idx" ON "PropertyManagerCustomer"("onboardingStatus");

-- Add foreign key for building
ALTER TABLE "PropertyManagerCustomer" ADD CONSTRAINT "PropertyManagerCustomer_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create RentPayment table
CREATE TABLE "RentPayment" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "propertyManagerId" INTEGER NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidDate" TIMESTAMP(3),
    "amount" DOUBLE PRECISION NOT NULL,
    "amountPaid" DOUBLE PRECISION DEFAULT 0,
    "lateFee" DOUBLE PRECISION DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "transactionReference" TEXT,
    "notes" TEXT,

    CONSTRAINT "RentPayment_pkey" PRIMARY KEY ("id")
);

-- Create UtilityReading table
CREATE TABLE "UtilityReading" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "propertyManagerId" INTEGER NOT NULL,
    "utilityType" TEXT NOT NULL,
    "readingDate" TIMESTAMP(3) NOT NULL,
    "previousReading" DOUBLE PRECISION DEFAULT 0,
    "currentReading" DOUBLE PRECISION NOT NULL,
    "consumption" DOUBLE PRECISION NOT NULL,
    "ratePerUnit" DOUBLE PRECISION,
    "totalCost" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'RECORDED',
    "meterNumber" TEXT,
    "notes" TEXT,

    CONSTRAINT "UtilityReading_pkey" PRIMARY KEY ("id")
);

-- Create unique constraints
CREATE UNIQUE INDEX "RentPayment_paymentNumber_key" ON "RentPayment"("paymentNumber");

-- Create indexes
CREATE INDEX "RentPayment_tenantId_idx" ON "RentPayment"("tenantId");
CREATE INDEX "RentPayment_propertyManagerId_idx" ON "RentPayment"("propertyManagerId");
CREATE INDEX "RentPayment_status_idx" ON "RentPayment"("status");
CREATE INDEX "RentPayment_dueDate_idx" ON "RentPayment"("dueDate");

CREATE INDEX "UtilityReading_tenantId_idx" ON "UtilityReading"("tenantId");
CREATE INDEX "UtilityReading_propertyManagerId_idx" ON "UtilityReading"("propertyManagerId");
CREATE INDEX "UtilityReading_utilityType_idx" ON "UtilityReading"("utilityType");
CREATE INDEX "UtilityReading_readingDate_idx" ON "UtilityReading"("readingDate");

-- Add foreign keys
ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "PropertyManagerCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_propertyManagerId_fkey" FOREIGN KEY ("propertyManagerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UtilityReading" ADD CONSTRAINT "UtilityReading_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "PropertyManagerCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UtilityReading" ADD CONSTRAINT "UtilityReading_propertyManagerId_fkey" FOREIGN KEY ("propertyManagerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
