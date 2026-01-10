import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function getArg(name: string): string | undefined {
  const idx = process.argv.findIndex((a) => a === name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const email = getArg("--email") ?? "";
  if (!email) {
    console.error("Usage: pnpm -s tsx scripts/diagnose-contractor-visibility.ts --email someone@example.com");
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, firstName: true, lastName: true },
  });

  console.log("User:");
  console.log(JSON.stringify(user, null, 2));

  if (!user) return;

  const pmOrders = await prisma.propertyManagerOrder.findMany({
    where: { contractorId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      createdAt: true,
      propertyManager: { select: { email: true } },
      generatedFromRFQ: { select: { rfqNumber: true } },
    },
  });

  console.log("\nPropertyManagerOrders visible by contractorId=user.id:");
  console.log(JSON.stringify(pmOrders, null, 2));

  const contractorProfile = await prisma.contractor.findFirst({
    where: { email },
    select: { id: true, email: true, portalAccessEnabled: true, companyName: true, propertyManagerId: true },
  });

  console.log("\nContractor table profile:");
  console.log(JSON.stringify(contractorProfile, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
