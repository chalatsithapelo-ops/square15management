import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CONTRACTOR_ROLES = [
  "CONTRACTOR",
  "CONTRACTOR_SENIOR_MANAGER",
  "CONTRACTOR_JUNIOR_MANAGER",
] as const;

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const candidates = await prisma.propertyManagerOrder.findMany({
    where: {
      contractorId: null,
      generatedFromRFQId: { not: null },
    },
    select: {
      id: true,
      orderNumber: true,
      generatedFromRFQId: true,
      sourceRFQId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  if (candidates.length === 0) {
    console.log("No PropertyManagerOrder rows found needing repair.");
    return;
  }

  console.log(
    `Found ${candidates.length} PropertyManagerOrder rows with contractorId=null and generatedFromRFQId!=null.`
  );

  let repaired = 0;
  let skipped = 0;

  for (const order of candidates) {
    const rfqId = order.generatedFromRFQId ?? order.sourceRFQId;
    if (!rfqId) {
      skipped++;
      console.log(`SKIP ${order.orderNumber}: no RFQ reference fields.`);
      continue;
    }

    const rfq = await prisma.propertyManagerRFQ.findUnique({
      where: { id: rfqId },
      select: { id: true, rfqNumber: true },
    });

    if (!rfq?.rfqNumber) {
      skipped++;
      console.log(`SKIP ${order.orderNumber}: RFQ missing rfqNumber.`);
      continue;
    }

    const approvedQuotation = await prisma.quotation.findFirst({
      where: {
        clientReferenceQuoteNumber: rfq.rfqNumber,
        status: "APPROVED",
      },
      select: {
        id: true,
        createdById: true,
        createdBy: { select: { id: true, email: true, role: true } },
      },
    });

    if (!approvedQuotation?.createdBy?.email) {
      skipped++;
      console.log(`SKIP ${order.orderNumber}: no approved quotation creator email for RFQ ${rfq.rfqNumber}.`);
      continue;
    }

    const contractorUser = await prisma.user.findFirst({
      where: {
        email: approvedQuotation.createdBy.email,
        role: { in: [...CONTRACTOR_ROLES] },
      },
      select: { id: true, email: true, role: true },
    });

    if (!contractorUser) {
      skipped++;
      console.log(
        `SKIP ${order.orderNumber}: no contractor user found for email ${approvedQuotation.createdBy.email}.`
      );
      continue;
    }

    console.log(
      `${dryRun ? "DRY" : "FIX"} ${order.orderNumber}: set contractorId=${contractorUser.id} (${contractorUser.email}, ${contractorUser.role})`
    );

    if (!dryRun) {
      await prisma.propertyManagerOrder.update({
        where: { id: order.id },
        data: { contractorId: contractorUser.id },
      });
    }

    repaired++;
  }

  console.log(`Done. repaired=${repaired}, skipped=${skipped}, dryRun=${dryRun}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
