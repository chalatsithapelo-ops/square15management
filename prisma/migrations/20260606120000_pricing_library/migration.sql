-- Pricing Library: extend LineItemTemplate with catalog / learning fields
ALTER TABLE "LineItemTemplate" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "LineItemTemplate" ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LineItemTemplate" ADD COLUMN "defaultCost" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "LineItemTemplate" ADD COLUMN "usageCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LineItemTemplate" ADD COLUMN "lastUsedAt" TIMESTAMP(3);
ALTER TABLE "LineItemTemplate" ADD COLUMN "avgUnitPrice" DOUBLE PRECISION;
ALTER TABLE "LineItemTemplate" ADD COLUMN "minUnitPrice" DOUBLE PRECISION;
ALTER TABLE "LineItemTemplate" ADD COLUMN "maxUnitPrice" DOUBLE PRECISION;
ALTER TABLE "LineItemTemplate" ADD COLUMN "priceSamples" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "LineItemTemplate" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "LineItemTemplate" ADD COLUMN "lastApprovedById" INTEGER;

-- Existing manually-saved templates were trusted by definition: mark them verified.
UPDATE "LineItemTemplate" SET "isVerified" = true WHERE "source" = 'MANUAL';

CREATE INDEX "LineItemTemplate_isVerified_idx" ON "LineItemTemplate"("isVerified");
CREATE INDEX "LineItemTemplate_source_idx" ON "LineItemTemplate"("source");
CREATE INDEX "LineItemTemplate_lastUsedAt_idx" ON "LineItemTemplate"("lastUsedAt");

ALTER TABLE "LineItemTemplate"
    ADD CONSTRAINT "LineItemTemplate_lastApprovedById_fkey"
    FOREIGN KEY ("lastApprovedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Per-client / per-building pricing memory
CREATE TABLE "ClientPricingMemory" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clientId" INTEGER,
    "clientBuildingId" INTEGER,
    "descriptionKey" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unitOfMeasure" TEXT NOT NULL DEFAULT 'Sum',
    "lastUnitPrice" DOUBLE PRECISION NOT NULL,
    "avgUnitPrice" DOUBLE PRECISION NOT NULL,
    "minUnitPrice" DOUBLE PRECISION NOT NULL,
    "maxUnitPrice" DOUBLE PRECISION NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "catalogItemId" INTEGER,

    CONSTRAINT "ClientPricingMemory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientPricingMemory_clientId_clientBuildingId_descriptionKey_key"
    ON "ClientPricingMemory"("clientId", "clientBuildingId", "descriptionKey");
CREATE INDEX "ClientPricingMemory_clientId_idx" ON "ClientPricingMemory"("clientId");
CREATE INDEX "ClientPricingMemory_clientBuildingId_idx" ON "ClientPricingMemory"("clientBuildingId");
CREATE INDEX "ClientPricingMemory_descriptionKey_idx" ON "ClientPricingMemory"("descriptionKey");

ALTER TABLE "ClientPricingMemory"
    ADD CONSTRAINT "ClientPricingMemory_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientPricingMemory"
    ADD CONSTRAINT "ClientPricingMemory_clientBuildingId_fkey"
    FOREIGN KEY ("clientBuildingId") REFERENCES "ClientBuilding"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientPricingMemory"
    ADD CONSTRAINT "ClientPricingMemory_catalogItemId_fkey"
    FOREIGN KEY ("catalogItemId") REFERENCES "LineItemTemplate"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
