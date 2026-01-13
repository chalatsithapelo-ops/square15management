import { config as dotenvConfig } from "dotenv";
import { join } from "path";

// Load environment variables FIRST before any other imports
dotenvConfig({ path: join(process.cwd(), ".env") });

import bcryptjs from "bcryptjs";
import { db } from "~/server/db";

type SeedOptions = {
  disconnect?: boolean;
};

const DEMO_PM = {
  email: "pm@propmanagement.com",
  password: "property123",
  firstName: "Sarah",
  lastName: "Johnson",
  phone: "+27123456789",
} as const;

const DEMO_CONTRACTOR = {
  email: "contractor@propmanagement.com",
  password: "contractor123",
  firstName: "Mike",
  lastName: "Thompson",
  phone: "+27821234567",
} as const;

const DEMO_ARTISAN = {
  email: "artisan@propmanagement.com",
  password: "artisan123",
  firstName: "John",
  lastName: "Daniels",
  phone: "+27731234567",
} as const;

export async function seedRFQWorkflow(options: SeedOptions = {}) {
  console.log("🌱 Seeding Property Manager / Contractor demo workflow...");

  try {
    // 1) Ensure demo users exist
    const pmPasswordHash = await bcryptjs.hash(DEMO_PM.password, 10);
    const contractorPasswordHash = await bcryptjs.hash(DEMO_CONTRACTOR.password, 10);
    const artisanPasswordHash = await bcryptjs.hash(DEMO_ARTISAN.password, 10);

    const propertyManager = await db.user.upsert({
      where: { email: DEMO_PM.email },
      update: {
        // Keep demo credentials predictable
        password: pmPasswordHash,
        firstName: DEMO_PM.firstName,
        lastName: DEMO_PM.lastName,
        phone: DEMO_PM.phone,
        role: "PROPERTY_MANAGER",
      },
      create: {
        email: DEMO_PM.email,
        password: pmPasswordHash,
        firstName: DEMO_PM.firstName,
        lastName: DEMO_PM.lastName,
        phone: DEMO_PM.phone,
        role: "PROPERTY_MANAGER",
      },
    });

    const contractorUser = await db.user.upsert({
      where: { email: DEMO_CONTRACTOR.email },
      update: {},
      create: {
        email: DEMO_CONTRACTOR.email,
        password: contractorPasswordHash,
        firstName: DEMO_CONTRACTOR.firstName,
        lastName: DEMO_CONTRACTOR.lastName,
        phone: DEMO_CONTRACTOR.phone,
        role: "CONTRACTOR",
      },
    });

    await db.user.upsert({
      where: { email: DEMO_ARTISAN.email },
      update: {},
      create: {
        email: DEMO_ARTISAN.email,
        password: artisanPasswordHash,
        firstName: DEMO_ARTISAN.firstName,
        lastName: DEMO_ARTISAN.lastName,
        phone: DEMO_ARTISAN.phone,
        role: "ARTISAN",
        hourlyRate: 250,
      },
    });

    // 2) Ensure Contractor table record exists (RFQ targeting uses Contractor IDs)
    const contractorRecord = await db.contractor.upsert({
      where: { email: contractorUser.email },
      update: {
        portalAccessEnabled: true,
        propertyManagerId: propertyManager.id,
      },
      create: {
        firstName: contractorUser.firstName,
        lastName: contractorUser.lastName,
        email: contractorUser.email,
        phone: contractorUser.phone ?? undefined,
        companyName: "Thompson Construction",
        serviceType: "CONSTRUCTION",
        serviceCategory: "General Building",
        specializations: ["Commercial", "Renovations", "Maintenance"],
        hourlyRate: 450,
        dailyRate: 3500,
        dateJoined: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        portalAccessEnabled: true,
        propertyManagerId: propertyManager.id,
        totalJobsCompleted: 15,
        averageRating: 4.7,
        totalSpent: 125000,
      },
    });

    // 3) Create RFQs for the PM portal (idempotent)
    const rfqSubmitted = await db.propertyManagerRFQ.upsert({
      where: { rfqNumber: "PM-RFQ-DEMO-001" },
      update: {},
      create: {
        rfqNumber: "PM-RFQ-DEMO-001",
        propertyManagerId: propertyManager.id,
        title: "Elevator Service - Building A",
        description: "Annual elevator safety inspection and preventative service.",
        scopeOfWork:
          "Inspect elevator system, test safety mechanisms, lubricate moving parts, and provide compliance report.",
        buildingName: "Acme Corporate Tower",
        buildingAddress: "789 Corporate Drive, Sandton, 2196",
        urgency: "NORMAL",
        estimatedBudget: 45000,
        status: "SUBMITTED",
        submittedDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
        attachments: [],
        selectedContractorIds: [contractorRecord.id],
      },
    });

    await db.propertyManagerRFQ.upsert({
      where: { rfqNumber: "PM-RFQ-DEMO-002" },
      update: {},
      create: {
        rfqNumber: "PM-RFQ-DEMO-002",
        propertyManagerId: propertyManager.id,
        title: "Generator Maintenance - Basement",
        description: "Routine generator maintenance and load test.",
        scopeOfWork:
          "Perform full service on backup generator, replace filters, test under load, and log maintenance results.",
        buildingName: "Acme Corporate Tower",
        buildingAddress: "789 Corporate Drive, Sandton, 2196",
        urgency: "HIGH",
        estimatedBudget: 65000,
        status: "UNDER_REVIEW",
        submittedDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        attachments: [],
        selectedContractorIds: [contractorRecord.id],
      },
    });

    const rfqQuoted = await db.propertyManagerRFQ.upsert({
      where: { rfqNumber: "PM-RFQ-DEMO-003" },
      update: {},
      create: {
        rfqNumber: "PM-RFQ-DEMO-003",
        propertyManagerId: propertyManager.id,
        title: "HVAC Maintenance - Floor 12",
        description: "Service HVAC units and replace filters.",
        scopeOfWork:
          "Service HVAC units, clean coils, replace filters, check refrigerant levels, and provide maintenance checklist.",
        buildingName: "Acme Corporate Tower",
        buildingAddress: "789 Corporate Drive, Sandton, 2196",
        urgency: "NORMAL",
        estimatedBudget: 60000,
        status: "QUOTED",
        submittedDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        quotedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        attachments: [],
        selectedContractorIds: [contractorRecord.id],
      },
    });

    // 4) Create admin quote for the QUOTED RFQ (rfqId is unique)
    await db.propertyManagerQuote.upsert({
      where: { quoteNumber: "PM-QT-DEMO-001" },
      update: {},
      create: {
        quoteNumber: "PM-QT-DEMO-001",
        rfqId: rfqQuoted.id,
        items: [
          {
            description: "HVAC service per unit",
            quantity: 8,
            unitPrice: 6500,
            unitOfMeasure: "unit",
            total: 52000,
          },
          {
            description: "Consumables and filters",
            quantity: 1,
            unitPrice: 8000,
            unitOfMeasure: "lot",
            total: 8000,
          },
        ],
        subtotal: 60000,
        tax: 0,
        total: 60000,
        companyMaterialCost: 18000,
        companyLabourCost: 24000,
        estimatedProfit: 18000,
        estimatedDuration: "2 days",
        status: "SENT",
        sentDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        notes: "Includes maintenance log and call-out for minor issues during visit.",
      },
    });

    // 5) RFQ converted to an Order + invoice + progress
    const rfqConverted = await db.propertyManagerRFQ.upsert({
      where: { rfqNumber: "PM-RFQ-DEMO-004" },
      update: {},
      create: {
        rfqNumber: "PM-RFQ-DEMO-004",
        propertyManagerId: propertyManager.id,
        title: "Exterior Painting - Entrance Lobby",
        description: "Repaint main entrance lobby and external facade touch-ups.",
        scopeOfWork:
          "Prep surfaces, patch cracks, apply primer, and two coats of weatherproof paint.",
        buildingName: "Acme Corporate Tower",
        buildingAddress: "789 Corporate Drive, Sandton, 2196",
        urgency: "NORMAL",
        estimatedBudget: 90000,
        status: "CONVERTED_TO_ORDER",
        submittedDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        approvedDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        attachments: [],
        selectedContractorIds: [contractorRecord.id],
      },
    });

    const order = await db.propertyManagerOrder.upsert({
      where: { orderNumber: "PM-PO-DEMO-001" },
      update: {},
      create: {
        orderNumber: "PM-PO-DEMO-001",
        propertyManagerId: propertyManager.id,
        contractorId: contractorUser.id,
        title: rfqConverted.title,
        description: rfqConverted.description,
        scopeOfWork: rfqConverted.scopeOfWork,
        buildingName: rfqConverted.buildingName,
        buildingAddress: rfqConverted.buildingAddress,
        generatedFromRFQId: rfqConverted.id,
        sourceRFQId: rfqConverted.id,
        totalAmount: 88000,
        paidAmount: 0,
        status: "IN_PROGRESS",
        submittedDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        acceptedDate: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000),
        startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        progressPercentage: 45,
        notes: "Coordinate with security for scaffolding access.",
      },
    });

    // Keep redundant RFQ.generatedOrderId in sync (schema has both sides)
    if (!rfqConverted.generatedOrderId) {
      await db.propertyManagerRFQ.update({
        where: { id: rfqConverted.id },
        data: { generatedOrderId: order.id },
      });
    }

    const existingProgress = await db.propertyManagerOrderUpdate.count({
      where: { orderId: order.id },
    });
    if (existingProgress === 0) {
      await db.propertyManagerOrderUpdate.createMany({
        data: [
          {
            orderId: order.id,
            status: "STARTED",
            message: "Site setup completed and surfaces prepped.",
            progressPercentage: 15,
            createdById: contractorUser.id,
          },
          {
            orderId: order.id,
            status: "IN_PROGRESS",
            message: "First coat applied to lobby area. Facade touch-ups underway.",
            progressPercentage: 45,
            createdById: contractorUser.id,
          },
        ],
      });
    }

    const existingMaterials = await db.propertyManagerOrderMaterial.count({
      where: { orderId: order.id },
    });
    if (existingMaterials === 0) {
      await db.propertyManagerOrderMaterial.createMany({
        data: [
          {
            orderId: order.id,
            name: "Weatherproof paint (20L)",
            quantity: 6,
            unit: "bucket",
            unitPrice: 850,
            totalCost: 5100,
          },
          {
            orderId: order.id,
            name: "Primer (20L)",
            quantity: 2,
            unit: "bucket",
            unitPrice: 750,
            totalCost: 1500,
          },
        ],
      });
    }

    await db.propertyManagerInvoice.upsert({
      where: { invoiceNumber: "PM-INV-DEMO-001" },
      update: {},
      create: {
        invoiceNumber: "PM-INV-DEMO-001",
        propertyManagerId: propertyManager.id,
        orderId: order.id,
        items: [
          { description: "Exterior painting labour", quantity: 1, unitPrice: 60000, total: 60000 },
          { description: "Materials and consumables", quantity: 1, unitPrice: 28000, total: 28000 },
        ],
        subtotal: 88000,
        tax: 0,
        total: 88000,
        status: "SENT_TO_PM",
        sentToPMDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        notes: "Demo invoice for contractor workflow.",
      },
    });

    console.log("✅ Demo portal data seeded");
    console.log("✅ Demo credentials:");
    console.log(`   - Property Manager: ${DEMO_PM.email} / ${DEMO_PM.password}`);
    console.log(`   - Contractor: ${DEMO_CONTRACTOR.email} / ${DEMO_CONTRACTOR.password}`);
    console.log(`   - Artisan: ${DEMO_ARTISAN.email} / ${DEMO_ARTISAN.password}`);
    console.log("✅ Created:");
    console.log("   - Contractor directory entry (Contractor table)");
    console.log("   - 4 RFQs (SUBMITTED, UNDER_REVIEW, QUOTED + admin quote, CONVERTED_TO_ORDER)");
    console.log("   - 1 Order (IN_PROGRESS) + progress updates + materials");
    console.log("   - 1 PM invoice linked to the order");

    // Avoid unused-var lint issues while keeping useful handles for future extension
    void rfqSubmitted;
  } catch (error) {
    console.error("❌ Error seeding RFQ workflow:", error);
    throw error;
  } finally {
    if (options.disconnect !== false) {
      await db.$disconnect();
    }
  }
}

// Run when invoked directly (not imported)
if (process.argv[1]?.includes("seed-rfq-workflow")) {
  seedRFQWorkflow({ disconnect: true })
    .then(() => {
      console.log("\n🎉 Seed script completed");
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}
