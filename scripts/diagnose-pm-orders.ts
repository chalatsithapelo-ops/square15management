import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function getArg(name: string): string | undefined {
  const idx = process.argv.findIndex((a) => a === name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const orderNumber = getArg("--orderNumber");
  const take = Number(getArg("--take") ?? 20);

  const where = orderNumber ? { orderNumber } : {};

  const orders = await prisma.propertyManagerOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      createdAt: true,
      contractorId: true,
      contractor: { select: { id: true, email: true, role: true } },
      propertyManager: { select: { id: true, email: true } },
      generatedFromRFQ: { select: { id: true, rfqNumber: true, status: true } },
      sourceRFQ: { select: { id: true, rfqNumber: true, status: true } },
    },
  });

  console.log(JSON.stringify(orders, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
