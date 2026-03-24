const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function main() {
  const revenues = await db.alternativeRevenue.findMany({
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, role: true, email: true }
      }
    },
    orderBy: { id: "desc" },
    take: 10
  });

  console.log("=== Alternative Revenues ===");
  revenues.forEach(r => {
    console.log(JSON.stringify({
      id: r.id,
      desc: r.description,
      amount: r.amount,
      isApproved: r.isApproved,
      creatorRole: r.createdBy.role,
      creatorName: r.createdBy.firstName + " " + r.createdBy.lastName,
      creatorEmail: r.createdBy.email,
    }));
  });

  // Also check the logged-in Sr Admin user
  const admins = await db.user.findMany({
    where: { role: { contains: "ADMIN" } },
    select: { id: true, firstName: true, lastName: true, role: true, email: true }
  });
  console.log("\n=== Admin Users ===");
  admins.forEach(u => console.log(JSON.stringify(u)));

  await db.$disconnect();
}
main();
