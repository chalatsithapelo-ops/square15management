import { config as dotenvConfig } from "dotenv";
import { join } from "path";

// Load environment variables FIRST
dotenvConfig({ path: join(process.cwd(), '.env') });

import { db } from "~/server/db";
import bcryptjs from "bcryptjs";

/**
 * Seed script for PropertyManager RFQ Workflow
 * 
 * This creates a complete RFQ workflow for testing:
 * PM creates RFQ → Contractor receives → Contractor forwards to Artisan → 
 * Artisan quotes → Contractor marks up → PM receives quote → PM creates order
 */

async function seedRFQWorkflow() {
  console.log("🌱 Starting RFQ workflow seeding...");
  
  try {
    // 1. Get existing users or create them
    console.log("Checking for existing users...");
    
    let propertyManager = await db.user.findFirst({
      where: { role: "PROPERTY_MANAGER" }
    });
    
    if (!propertyManager) {
      console.log("Creating Property Manager user...");
      propertyManager = await db.user.create({
        data: {
          email: "pm@example.com",
          password: await bcryptjs.hash("password123", 10),
          firstName: "Sarah",
          lastName: "Johnson",
          phone: "+27123456789",
          role: "PROPERTY_MANAGER",
          pmCompanyName: "Premium Property Management",
          pmCompanyAddressLine1: "123 Business Park",
          pmCompanyAddressLine2: "Sandton, 2196",
          pmCompanyPhone: "+27114445555",
          pmCompanyEmail: "info@premiumpm.co.za",
          pmCompanyVatNumber: "VAT123456789",
          pmCompanyBankName: "Standard Bank",
          pmCompanyBankAccountName: "Premium Property Management",
          pmCompanyBankAccountNumber: "1234567890",
          pmCompanyBankBranchCode: "051001",
          pmBrandPrimaryColor: "#2563eb",
          pmBrandSecondaryColor: "#1e40af",
          pmBrandAccentColor: "#3b82f6",
        }
      });
    }
    
    let contractor = await db.user.findFirst({
      where: { role: "CONTRACTOR" }
    });
    
    if (!contractor) {
      console.log("Creating Contractor user...");
      contractor = await db.user.create({
        data: {
          email: "contractor@example.com",
          password: await bcryptjs.hash("password123", 10),
          firstName: "Mike",
          lastName: "Thompson",
          phone: "+27821234567",
          role: "CONTRACTOR",
          contractorCompanyName: "Thompson Construction",
          contractorCompanyAddressLine1: "456 Industrial Drive",
          contractorCompanyAddressLine2: "Midrand, 1685",
          contractorCompanyPhone: "+27114447777",
          contractorCompanyEmail: "mike@thompsonconstruction.co.za",
          contractorCompanyVatNumber: "VAT987654321",
          contractorCompanyBankName: "FNB",
          contractorCompanyBankAccountName: "Thompson Construction",
          contractorCompanyBankAccountNumber: "9876543210",
          contractorCompanyBankBranchCode: "250655",
          contractorBrandPrimaryColor: "#ea580c",
          contractorBrandSecondaryColor: "#c2410c",
          contractorBrandAccentColor: "#f97316",
        }
      });
    }
    
    // Create Contractor record linked to contractor user
    let contractorRecord = await db.contractor.findFirst({
      where: { email: contractor.email }
    });
    
    if (!contractorRecord) {
      console.log("Creating Contractor record...");
      contractorRecord = await db.contractor.create({
        data: {
          firstName: contractor.firstName,
          lastName: contractor.lastName,
          email: contractor.email,
          phone: contractor.phone,
          companyName: contractor.contractorCompanyName,
          serviceType: "CONSTRUCTION",
          serviceCategory: "General Building",
          specializations: ["Commercial", "Renovations", "Maintenance"],
          hourlyRate: 450,
          dailyRate: 3500,
          bankName: contractor.contractorCompanyBankName,
          bankAccountHolder: contractor.contractorCompanyBankAccountName,
          bankAccountNumber: contractor.contractorCompanyBankAccountNumber,
          bankCode: contractor.contractorCompanyBankBranchCode,
          status: "ACTIVE",
          dateJoined: new Date(),
          portalAccessEnabled: true,
          propertyManagerId: propertyManager.id,
          totalJobsCompleted: 15,
          averageRating: 4.7,
          totalSpent: 125000,
        }
      });
    }
    
    let artisan = await db.user.findFirst({
      where: { role: "ARTISAN" }
    });
    
    if (!artisan) {
      console.log("Creating Artisan user...");
      artisan = await db.user.create({
        data: {
          email: "artisan@example.com",
          password: await bcryptjs.hash("password123", 10),
          firstName: "John",
          lastName: "Daniels",
          phone: "+27731234567",
          role: "ARTISAN",
          hourlyRate: 250,
        }
      });
    }
    
    console.log("✓ Users ready");
    
    // 2. Create PropertyManagerCustomer
    console.log("Creating PropertyManager customer...");
    const pmCustomer = await db.propertyManagerCustomer.create({
      data: {
        propertyManagerId: propertyManager.id,
        firstName: "Jane",
        lastName: "Smith",
        email: "facilities@acmecorp.co.za",
        phone: "+27114448888",
        address: "789 Corporate Drive, Sandton, 2196",
        buildingName: "Acme Corporate Tower",
        unitNumber: "Building A",
        status: "ACTIVE",
        onboardingStatus: "APPROVED",
        onboardedDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 months ago
        approvedDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        moveInDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        leaseStartDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        leaseEndDate: new Date(Date.now() + 185 * 24 * 60 * 60 * 1000), // ~1 year lease
        monthlyRent: 25000,
        securityDeposit: 50000,
      }
    });
    
    console.log("✓ PM Customer created");
    
    // 3. Create PropertyManagerRFQ (Status: PENDING)
    console.log("Creating PropertyManager RFQ...");
    const rfq = await db.propertyManagerRFQ.create({
      data: {
        propertyManagerId: propertyManager.id,
        customerId: pmCustomer.id,
        rfqNumber: "RFQ-PM-2024-001",
        title: "Office Building Electrical Upgrade",
        description: "Full electrical upgrade for 3-storey office building including new distribution boards, LED lighting, and emergency backup systems.",
        category: "ELECTRICAL",
        priority: "HIGH",
        status: "PENDING",
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        siteAddress: "789 Corporate Drive, Sandton, 2196",
        contactPerson: "Jane Smith",
        contactPhone: "+27114448888",
        contactEmail: "facilities@acmecorp.co.za",
        requirements: [
          "New main distribution board (400A)",
          "Sub-distribution boards on each floor",
          "LED lighting throughout (150 fittings)",
          "Emergency lighting system",
          "Backup power system integration",
          "Compliance certificates required"
        ],
        attachments: [],
      }
    });
    
    console.log("✓ PropertyManager RFQ created");
    
    // 4. Create PropertyManagerRFQ (Status: QUOTED)
    console.log("Creating quoted PropertyManager RFQ...");
    const rfqQuoted = await db.propertyManagerRFQ.create({
      data: {
        propertyManagerId: propertyManager.id,
        customerId: pmCustomer.id,
        rfqNumber: "RFQ-PM-2024-002",
        title: "Plumbing Repairs - Building A",
        description: "Emergency plumbing repairs including pipe replacement, leak fixes, and installation of new fixtures in commercial property.",
        category: "PLUMBING",
        priority: "URGENT",
        status: "QUOTED",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        siteAddress: "456 Industrial Park, Midrand, 1685",
        contactPerson: "Tom Wilson",
        contactPhone: "+27114447777",
        contactEmail: "maintenance@industrial.co.za",
        requirements: [
          "Replace 50m of damaged piping",
          "Fix 3 major leaks",
          "Install 5 new toilet fixtures",
          "Install 3 new basin taps",
          "Pressure test entire system"
        ],
        attachments: [],
        contractorId: contractorRecord.id,
        sentToContractorAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        quotedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        quotedAmount: 45000,
        quotedBreakdown: {
          materials: 18000,
          labour: 22000,
          markup: 5000
        },
        quotedNotes: "Quote includes all materials, labour, and testing. Work can commence within 2 days of approval.",
      }
    });
    
    console.log("✓ Quoted RFQ created");
    
    // 5. Create PropertyManagerRFQ (Status: APPROVED → will have order)
    console.log("Creating approved PropertyManager RFQ...");
    const rfqApproved = await db.propertyManagerRFQ.create({
      data: {
        propertyManagerId: propertyManager.id,
        customerId: pmCustomer.id,
        rfqNumber: "RFQ-PM-2024-003",
        title: "HVAC System Maintenance",
        description: "Annual HVAC maintenance for entire office complex including cleaning, testing, and minor repairs.",
        category: "HVAC",
        priority: "NORMAL",
        status: "APPROVED",
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        siteAddress: "123 Business Park, Sandton, 2196",
        contactPerson: "Sarah Johnson",
        contactPhone: "+27123456789",
        contactEmail: "pm@example.com",
        requirements: [
          "Service 8 rooftop HVAC units",
          "Clean all filters and coils",
          "Check refrigerant levels",
          "Test all thermostats",
          "Provide maintenance report"
        ],
        attachments: [],
        contractorId: contractorRecord.id,
        sentToContractorAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        quotedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        quotedAmount: 28000,
        quotedBreakdown: {
          materials: 8000,
          labour: 16000,
          markup: 4000
        },
        approvedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        approvedBy: "Sarah Johnson",
      }
    });
    
    console.log("✓ Approved RFQ created");
    
    // 6. Create PropertyManagerOrder (linked to approved RFQ)
    console.log("Creating PropertyManager order from approved RFQ...");
    const pmOrder = await db.propertyManagerOrder.create({
      data: {
        propertyManagerId: propertyManager.id,
        customerId: pmCustomer.id,
        rfqId: rfqApproved.id,
        contractorId: contractorRecord.id,
        orderNumber: "PO-PM-2024-001",
        title: rfqApproved.title,
        description: rfqApproved.description,
        category: rfqApproved.category,
        priority: rfqApproved.priority,
        status: "IN_PROGRESS",
        orderDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        dueDate: rfqApproved.dueDate,
        siteAddress: rfqApproved.siteAddress,
        contactPerson: rfqApproved.contactPerson,
        contactPhone: rfqApproved.contactPhone,
        contactEmail: rfqApproved.contactEmail,
        totalAmount: rfqApproved.quotedAmount,
        paidAmount: 0,
        requirements: rfqApproved.requirements,
        assignedToArtisanId: artisan.id,
        assignedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      }
    });
    
    console.log("✓ PropertyManager order created");
    
    // 7. Create PropertyManagerOrder updates (progress tracking)
    console.log("Creating order updates...");
    await db.propertyManagerOrderUpdate.createMany({
      data: [
        {
          orderId: pmOrder.id,
          createdById: contractor.id,
          updateType: "STATUS_CHANGE",
          status: "IN_PROGRESS",
          notes: "Work commenced on site. HVAC units 1-3 serviced today.",
          progressPercentage: 30,
        },
        {
          orderId: pmOrder.id,
          createdById: artisan.id,
          updateType: "PROGRESS_UPDATE",
          status: "IN_PROGRESS",
          notes: "Units 4-6 completed. All filters replaced. Minor refrigerant top-up required on Unit 5.",
          progressPercentage: 60,
        },
      ]
    });
    
    console.log("✓ Order updates created");
    
    // 8. Create PropertyManagerOrder materials and expenses
    console.log("Creating order materials and expenses...");
    await db.propertyManagerOrderMaterial.createMany({
      data: [
        {
          orderId: pmOrder.id,
          name: "HVAC Filters - Set of 24",
          quantity: 3,
          unit: "SET",
          unitCost: 1500,
          totalCost: 4500,
          supplier: "HVAC Supplies Co.",
        },
        {
          orderId: pmOrder.id,
          name: "R410A Refrigerant - 5kg",
          quantity: 1,
          unit: "UNIT",
          unitCost: 2500,
          totalCost: 2500,
          supplier: "Cool Air Solutions",
        },
      ]
    });
    
    await db.propertyManagerOrderExpenseSlip.createMany({
      data: [
        {
          orderId: pmOrder.id,
          userId: artisan.id,
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          category: "TRANSPORT",
          amount: 450,
          description: "Fuel and transport to site",
          receiptUrl: null,
        },
        {
          orderId: pmOrder.id,
          userId: contractor.id,
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          category: "MATERIALS",
          amount: 7000,
          description: "Materials purchased - filters and refrigerant",
          receiptUrl: null,
        },
      ]
    });
    
    console.log("✓ Materials and expenses created");
    
    // 9. Create PropertyManagerOrder job activities (time tracking)
    console.log("Creating job activities...");
    await db.propertyManagerOrderJobActivity.createMany({
      data: [
        {
          orderId: pmOrder.id,
          userId: artisan.id,
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          hoursWorked: 8,
          hourlyRate: 250,
          totalCost: 2000,
          description: "Serviced units 1-3, replaced filters",
        },
        {
          orderId: pmOrder.id,
          userId: artisan.id,
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          hoursWorked: 8,
          hourlyRate: 250,
          totalCost: 2000,
          description: "Serviced units 4-6, refrigerant top-up",
        },
      ]
    });
    
    console.log("✓ Job activities created");
    
    // 10. Create additional RFQs for workflow testing
    console.log("Creating additional test RFQs...");
    
    // RFQ waiting for contractor response
    await db.propertyManagerRFQ.create({
      data: {
        propertyManagerId: propertyManager.id,
        customerId: pmCustomer.id,
        rfqNumber: "RFQ-PM-2024-004",
        title: "Painting - Building Exterior",
        description: "Full exterior painting of 5-storey commercial building",
        category: "PAINTING",
        priority: "NORMAL",
        status: "SENT_TO_CONTRACTOR",
        dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        siteAddress: "456 Industrial Park, Midrand, 1685",
        contactPerson: "Tom Wilson",
        contactPhone: "+27114447777",
        contactEmail: "maintenance@industrial.co.za",
        requirements: [
          "Power wash entire exterior",
          "Fill and seal all cracks",
          "2 coats of weather-resistant paint",
          "Include all scaffolding",
          "Work to be done on weekends only"
        ],
        attachments: [],
        contractorId: contractorRecord.id,
        sentToContractorAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      }
    });
    
    // RFQ rejected by PM
    await db.propertyManagerRFQ.create({
      data: {
        propertyManagerId: propertyManager.id,
        customerId: pmCustomer.id,
        rfqNumber: "RFQ-PM-2024-005",
        title: "Security System Upgrade",
        description: "Install new CCTV cameras and access control",
        category: "SECURITY",
        priority: "NORMAL",
        status: "REJECTED",
        dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        siteAddress: "123 Business Park, Sandton, 2196",
        contactPerson: "Sarah Johnson",
        contactPhone: "+27123456789",
        contactEmail: "pm@example.com",
        requirements: [
          "15 IP cameras (4MP minimum)",
          "NVR with 30 days storage",
          "4 access control points",
          "Integration with existing system",
          "Staff training included"
        ],
        attachments: [],
        contractorId: contractorRecord.id,
        sentToContractorAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        quotedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
        quotedAmount: 185000,
        quotedBreakdown: {
          materials: 120000,
          labour: 45000,
          markup: 20000
        },
        rejectedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        rejectionReason: "Quote exceeds budget. Please revise.",
      }
    });
    
    console.log("✓ Additional test RFQs created");
    
    // 11. Create some PropertyManagerQuotes (direct quotes not from RFQ)
    console.log("Creating PropertyManager quotes...");
    await db.propertyManagerQuote.create({
      data: {
        propertyManagerId: propertyManager.id,
        customerId: pmCustomer.id,
        quoteNumber: "QT-PM-2024-001",
        title: "Emergency Roof Repair",
        description: "Urgent roof leak repair on Building C",
        category: "ROOFING",
        priority: "URGENT",
        status: "SENT",
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        siteAddress: "789 Corporate Drive, Sandton, 2196",
        items: [
          {
            description: "Emergency call-out fee",
            quantity: 1,
            unit: "Sum",
            unitPrice: 2500,
            total: 2500,
          },
          {
            description: "Roof membrane repair (15m²)",
            quantity: 15,
            unit: "m²",
            unitPrice: 450,
            total: 6750,
          },
          {
            description: "Waterproofing treatment",
            quantity: 1,
            unit: "Sum",
            unitPrice: 3500,
            total: 3500,
          },
        ],
        subtotal: 12750,
        tax: 1912.50,
        total: 14662.50,
        notes: "Work can be completed within 48 hours of approval",
      }
    });
    
    console.log("✓ PropertyManager quotes created");
    
    // 12. Create PropertyManagerInvoice
    console.log("Creating PropertyManager invoice...");
    await db.propertyManagerInvoice.create({
      data: {
        propertyManagerId: propertyManager.id,
        customerId: pmCustomer.id,
        orderId: pmOrder.id,
        invoiceNumber: "INV-PM-2024-001",
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "PENDING",
        items: [
          {
            description: "HVAC System Annual Maintenance",
            quantity: 1,
            unit: "Service",
            unitPrice: 28000,
            total: 28000,
          },
        ],
        subtotal: 28000,
        tax: 4200,
        total: 32200,
        notes: "Payment terms: 30 days from invoice date",
      }
    });
    
    console.log("✓ PropertyManager invoice created");
    
    console.log("\n=== SEED DATA SUMMARY ===");
    console.log("✅ Users:");
    console.log(`   - Property Manager: ${propertyManager.email} / password123`);
    console.log(`   - Contractor: ${contractor.email} / password123`);
    console.log(`   - Artisan: ${artisan.email} / password123`);
    console.log("\n✅ RFQ Workflow Data:");
    console.log("   - 1 PM Customer (Acme Corporation)");
    console.log("   - 5 PropertyManager RFQs:");
    console.log("     • RFQ-PM-2024-001 (PENDING) - Electrical Upgrade");
    console.log("     • RFQ-PM-2024-002 (QUOTED) - Plumbing Repairs");
    console.log("     • RFQ-PM-2024-003 (APPROVED) - HVAC Maintenance");
    console.log("     • RFQ-PM-2024-004 (SENT_TO_CONTRACTOR) - Exterior Painting");
    console.log("     • RFQ-PM-2024-005 (REJECTED) - Security System");
    console.log("   - 1 PropertyManager Order (PO-PM-2024-001) - IN_PROGRESS");
    console.log("   - 2 Order Updates (progress tracking)");
    console.log("   - 2 Materials, 2 Expenses, 2 Job Activities");
    console.log("   - 1 PropertyManager Quote (QT-PM-2024-001)");
    console.log("   - 1 PropertyManager Invoice (INV-PM-2024-001)");
    console.log("\n🎯 You can now test the complete RFQ workflow:");
    console.log("   1. Login as PM and view RFQs");
    console.log("   2. Login as Contractor and respond to RFQs");
    console.log("   3. Track order progress and updates");
    console.log("   4. Generate invoices and manage payments");
    console.log("\n✅ RFQ workflow seeding completed successfully!");
    
  } catch (error) {
    console.error("❌ Error seeding RFQ workflow:", error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

// Run the seed script
seedRFQWorkflow()
  .then(() => {
    console.log("\n🎉 Seed script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Seed script failed:", error);
    process.exit(1);
  });
