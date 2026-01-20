import { config as dotenvConfig } from "dotenv";
import { join } from "path";

// Load environment variables FIRST before any other imports
dotenvConfig({ path: join(process.cwd(), ".env") });

import bcryptjs from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const prisma = db as any;

const DEMO_PM_EMAIL = "pm@propmanagement.com";

const DEMO_TENANTS = [
  {
    email: "tenant1@propmanagement.com",
    password: "tenant123",
    firstName: "Lerato",
    lastName: "Mokoena",
    phone: "+27710000001",
    unitNumber: "12A",
  },
  {
    email: "tenant2@propmanagement.com",
    password: "tenant123",
    firstName: "Thabo",
    lastName: "Nkosi",
    phone: "+27710000002",
    unitNumber: "12B",
  },
] as const;

async function main() {
  console.log("🌱 Seeding Tenant Complaints & Compliments demo data...");

  const pm = await db.user.findFirst({
    where: { email: DEMO_PM_EMAIL, role: "PROPERTY_MANAGER" },
  });

  if (!pm) {
    throw new Error(
      `Demo Property Manager not found (${DEMO_PM_EMAIL}). Run the main setup/seed first.`
    );
  }

  const buildingName = "Acme Corporate Tower";
  const buildingAddress = "789 Corporate Drive, Sandton, 2196";

  const building =
    (await db.building.findFirst({
      where: { propertyManagerId: pm.id, name: buildingName },
    })) ??
    (await db.building.create({
      data: {
        propertyManagerId: pm.id,
        name: buildingName,
        address: buildingAddress,
        buildingType: "MIXED_USE",
        numberOfUnits: 120,
        status: "ACTIVE",
      },
    }));

  console.log(`✓ Using building: ${building.name}`);

  for (const tenantSeed of DEMO_TENANTS) {
    const passwordHash = await bcryptjs.hash(tenantSeed.password, 10);

    const tenantUser = await db.user.upsert({
      where: { email: tenantSeed.email },
      update: {
        role: "CUSTOMER",
      },
      create: {
        email: tenantSeed.email,
        password: passwordHash,
        firstName: tenantSeed.firstName,
        lastName: tenantSeed.lastName,
        phone: tenantSeed.phone,
        role: "CUSTOMER",
      },
    });

    const tenantRecord =
      (await db.propertyManagerCustomer.findFirst({
        where: { userId: tenantUser.id },
      })) ??
      (await db.propertyManagerCustomer.create({
        data: {
          propertyManagerId: pm.id,
          userId: tenantUser.id,
          firstName: tenantUser.firstName,
          lastName: tenantUser.lastName,
          email: tenantUser.email,
          phone: tenantUser.phone ?? undefined,
          buildingId: building.id,
          buildingName: building.name,
          unitNumber: tenantSeed.unitNumber,
          address: building.address,
          onboardingStatus: "APPROVED",
          onboardedDate: new Date(),
          approvedBy: pm.id,
          approvedDate: new Date(),
          status: "ACTIVE",
          moveInDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        },
      }));

    const existingCount = await prisma.tenantFeedback.count({
      where: { customerId: tenantRecord.id },
    });

    if (existingCount > 0) {
      console.log(`↷ Feedback already exists for ${tenantUser.email}, skipping...`);
      continue;
    }

    const now = Date.now();
    const daysAgo = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000);

    await prisma.tenantFeedback.createMany({
      data: [
        {
          customerId: tenantRecord.id,
          propertyManagerId: pm.id,
          buildingId: building.id,
          type: "COMPLAINT",
          category: "MAINTENANCE",
          message:
            "The hallway lights on our floor have been flickering for days. Please arrange maintenance.",
          status: "OPEN",
          createdAt: daysAgo(4),
          updatedAt: daysAgo(4),
        },
        {
          customerId: tenantRecord.id,
          propertyManagerId: pm.id,
          buildingId: building.id,
          type: "COMPLAINT",
          category: "CLEANLINESS",
          message:
            "The bin area is overflowing and smells bad. Could cleaning be scheduled more frequently?",
          status: "IN_PROGRESS",
          createdAt: daysAgo(12),
          updatedAt: daysAgo(2),
        },
        {
          customerId: tenantRecord.id,
          propertyManagerId: pm.id,
          buildingId: building.id,
          type: "COMPLEMENT",
          category: "COMMUNICATION",
          message:
            "Thanks for the quick updates about the water shutdown. It made planning much easier.",
          status: "RESOLVED",
          resolvedAt: daysAgo(6),
          createdAt: daysAgo(20),
          updatedAt: daysAgo(6),
        },
        {
          customerId: tenantRecord.id,
          propertyManagerId: pm.id,
          buildingId: building.id,
          type: "COMPLEMENT",
          category: "SECURITY",
          message:
            "Security has been very helpful and professional at the entrance recently. Great job.",
          status: "RESOLVED",
          resolvedAt: daysAgo(15),
          createdAt: daysAgo(30),
          updatedAt: daysAgo(15),
        },
      ],
    });

    console.log(`✓ Seeded tenant + feedback: ${tenantUser.email} (unit ${tenantSeed.unitNumber})`);
  }

  console.log("\n✅ Tenant feedback demo data seeded.\n");
  console.log("Logins:");
  console.log("- Property Manager: pm@propmanagement.com / property123");
  console.log("- Tenant 1: tenant1@propmanagement.com / tenant123");
  console.log("- Tenant 2: tenant2@propmanagement.com / tenant123");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
