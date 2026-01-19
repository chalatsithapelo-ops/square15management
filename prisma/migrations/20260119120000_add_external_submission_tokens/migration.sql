-- Add external contractor email-link submissions support

-- CreateTable
CREATE TABLE "ExternalSubmissionToken" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "rfqId" INTEGER,
    "orderId" INTEGER,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ExternalSubmissionToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalSubmissionToken_token_key" ON "ExternalSubmissionToken"("token");

-- CreateIndex
CREATE INDEX "ExternalSubmissionToken_type_idx" ON "ExternalSubmissionToken"("type");

-- CreateIndex
CREATE INDEX "ExternalSubmissionToken_email_idx" ON "ExternalSubmissionToken"("email");

-- CreateIndex
CREATE INDEX "ExternalSubmissionToken_rfqId_idx" ON "ExternalSubmissionToken"("rfqId");

-- CreateIndex
CREATE INDEX "ExternalSubmissionToken_orderId_idx" ON "ExternalSubmissionToken"("orderId");

-- AddForeignKey
ALTER TABLE "ExternalSubmissionToken" ADD CONSTRAINT "ExternalSubmissionToken_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "PropertyManagerRFQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalSubmissionToken" ADD CONSTRAINT "ExternalSubmissionToken_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PropertyManagerOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
