import { config as dotenvConfig } from "dotenv";
import { join } from "path";

// Load environment variables FIRST
dotenvConfig({ path: join(process.cwd(), '.env') });

import { db } from "~/server/db";
import bcryptjs from "bcryptjs";

/**
 * Quick seed script to restore basic test data
 * Creates: Users, Orders, Invoices for testing workflows
 */

async function seedQuickData() {
  console.log("🌱 Starting quick data seeding...");
  
  try {
    // Get existing users
    const admin = await db.user.findFirst({ where: { role: "SENIOR_ADMIN" } });
    const customer = await db.user.findFirst({ where: { role: "CUSTOMER" } });
    let artisan = await db.user.findFirst({ where: { role: "ARTISAN" } });
    
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
    
    let manager = await db.user.findFirst({ where: { role: "SENIOR_MANAGER" } });
    if (!manager) {
      console.log("Creating Manager user...");
      manager = await db.user.create({
        data: {
          email: "manager@example.com",
          password: await bcryptjs.hash("password123", 10),
          firstName: "Mike",
          lastName: "Wilson",
          phone: "+27821234567",
          role: "SENIOR_MANAGER",
        }
      });
    }
    
    console.log("✓ Users ready");
    
    // Create Orders
    console.log("Creating orders...");
    const order1 = await db.order.create({
      data: {
        orderNumber: "ORD-2024-001",
        customerName: customer ? `${customer.firstName} ${customer.lastName}` : "Test Customer",
        customerEmail: customer?.email || "customer@example.com",
        customerPhone: customer?.phone || "+27123456789",
        address: "100 Main Street, Sandton, Johannesburg",
        orderType: "REPAIR",
        serviceType: "PLUMBING",
        description: "Plumbing repair - leaking pipe under kitchen sink",
        status: "COMPLETED",
        priority: "HIGH",
        preferredDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        completedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        estimatedCost: 3500,
        finalCost: 3800,
        assignedToUserId: artisan?.id,
      }
    });
    
    const order2 = await db.order.create({
      data: {
        orderNumber: "ORD-2024-002",
        customerName: "David Smith",
        customerEmail: "david.smith@example.com",
        customerPhone: "+27834567890",
        address: "250 Park Avenue, Midrand",
        orderType: "INSTALLATION",
        serviceType: "ELECTRICAL",
        description: "Install new circuit breaker and upgrade distribution board",
        status: "IN_PROGRESS",
        priority: "NORMAL",
        preferredDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        estimatedCost: 8500,
        assignedToUserId: artisan?.id,
      }
    });
    
    const order3 = await db.order.create({
      data: {
        orderNumber: "ORD-2024-003",
        customerName: "Sarah Johnson",
        customerEmail: "sarah.j@example.com",
        customerPhone: "+27765432109",
        address: "45 Business Park, Sandton",
        orderType: "MAINTENANCE",
        serviceType: "HVAC",
        description: "Annual HVAC system maintenance and cleaning",
        status: "APPROVED",
        priority: "NORMAL",
        preferredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        estimatedCost: 5000,
        assignedToUserId: artisan?.id,
      }
    });
    
    console.log("✓ Created 3 orders");
    
    // Create Invoices
    console.log("Creating invoices...");
    const invoice1 = await db.invoice.create({
      data: {
        invoiceNumber: "INV-2024-001",
        customerName: order1.customerName,
        customerEmail: order1.customerEmail,
        customerPhone: order1.customerPhone,
        address: order1.address,
        items: [
          {
            description: "Plumbing repair - leaking pipe",
            quantity: 1,
            unitPrice: 2500,
            total: 2500,
            unitOfMeasure: "Job",
          },
          {
            description: "Pipe fittings and materials",
            quantity: 1,
            unitPrice: 800,
            total: 800,
            unitOfMeasure: "Sum",
          },
          {
            description: "Call-out fee",
            quantity: 1,
            unitPrice: 500,
            total: 500,
            unitOfMeasure: "Sum",
          },
        ],
        subtotal: 3800,
        tax: 570,
        total: 4370,
        companyMaterialCost: 800,
        companyLabourCost: 2500,
        estimatedProfit: 500,
        status: "PAID",
        paidDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        dueDate: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000),
        orderId: order1.id,
      },
    });
    
    const invoice2 = await db.invoice.create({
      data: {
        invoiceNumber: "INV-2024-002",
        customerName: "David Smith",
        customerEmail: "david.smith@example.com",
        customerPhone: "+27834567890",
        address: "250 Park Avenue, Midrand",
        items: [
          {
            description: "Electrical installation - circuit breaker",
            quantity: 8,
            unitPrice: 800,
            total: 6400,
            unitOfMeasure: "Hour",
          },
          {
            description: "Distribution board and materials",
            quantity: 1,
            unitPrice: 2500,
            total: 2500,
            unitOfMeasure: "Sum",
          },
        ],
        subtotal: 8900,
        tax: 1335,
        total: 10235,
        companyMaterialCost: 2500,
        companyLabourCost: 6400,
        estimatedProfit: 0,
        status: "PENDING_APPROVAL",
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        orderId: order2.id,
      },
    });
    
    console.log("✓ Created 2 invoices");
    
    // Create some Quotations
    console.log("Creating quotations...");
    const quote1 = await db.quotation.create({
      data: {
        quotationNumber: "QT-2024-001",
        customerName: "Mike Brown",
        customerEmail: "mike.brown@example.com",
        customerPhone: "+27823456789",
        address: "15 Industrial Road, Midrand",
        serviceType: "PAINTING",
        description: "Interior office painting - 200m²",
        items: [
          {
            description: "Interior painting (walls and ceiling)",
            quantity: 200,
            unitPrice: 150,
            total: 30000,
            unitOfMeasure: "m²",
          },
          {
            description: "Paint and materials",
            quantity: 1,
            unitPrice: 8000,
            total: 8000,
            unitOfMeasure: "Sum",
          },
        ],
        subtotal: 38000,
        tax: 5700,
        total: 43700,
        companyMaterialCost: 8000,
        companyLabourCost: 30000,
        estimatedProfit: 0,
        status: "PENDING",
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    
    console.log("✓ Created 1 quotation");
    
    // Create Projects
    console.log("Creating projects...");
    const project1 = await db.project.create({
      data: {
        projectNumber: "PRJ-2024-001",
        projectName: "Office Renovation - Phase 1",
        customerName: "Corporate Solutions Ltd",
        customerEmail: "projects@corpsolutions.co.za",
        customerPhone: "+27114445555",
        address: "789 Corporate Drive, Sandton",
        description: "Complete office renovation including electrical, plumbing, and interior finishing",
        projectType: "RENOVATION",
        status: "IN_PROGRESS",
        priority: "HIGH",
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        expectedEndDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        budgetAmount: 500000,
        actualCost: 180000,
        projectManagerId: manager?.id,
      },
    });
    
    console.log("✓ Created 1 project");
    
    // Create Payment Requests
    console.log("Creating payment requests...");
    const paymentRequest1 = await db.paymentRequest.create({
      data: {
        requestNumber: "PR-2024-001",
        artisanId: artisan!.id,
        orderIds: [order1.id],
        hoursWorked: 10,
        hourlyRate: 250,
        calculatedAmount: 2500,
        status: "PAID",
        approvedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        paidDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        notes: "Payment for completed plumbing work",
      },
    });
    
    const paymentRequest2 = await db.paymentRequest.create({
      data: {
        requestNumber: "PR-2024-002",
        artisanId: artisan!.id,
        orderIds: [order2.id],
        hoursWorked: 16,
        hourlyRate: 250,
        calculatedAmount: 4000,
        status: "PENDING",
        notes: "Payment for ongoing electrical work",
      },
    });
    
    console.log("✓ Created 2 payment requests");
    
    // Create Leads
    console.log("Creating leads...");
    const lead1 = await db.lead.create({
      data: {
        leadNumber: "LEAD-2024-001",
        name: "Potential Customer",
        email: "potential@example.com",
        phone: "+27765432100",
        serviceType: "CONSTRUCTION",
        description: "Interested in office building construction project",
        status: "NEW",
        priority: "NORMAL",
        source: "WEBSITE",
        estimatedValue: 1500000,
      },
    });
    
    console.log("✓ Created 1 lead");
    
    console.log("\n=== SEED DATA SUMMARY ===");
    console.log("✅ Test Data Created:");
    console.log("   - 3 Orders (1 completed, 1 in-progress, 1 approved)");
    console.log("   - 2 Invoices (1 paid, 1 pending)");
    console.log("   - 1 Quotation (pending)");
    console.log("   - 1 Project (in-progress)");
    console.log("   - 2 Payment Requests (1 paid, 1 pending)");
    console.log("   - 1 Lead (new)");
    console.log("\n🎯 You can now test workflows with this data!");
    console.log("\n✅ Quick data seeding completed successfully!");
    
  } catch (error) {
    console.error("❌ Error seeding data:", error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

// Run the seed script
seedQuickData()
  .then(() => {
    console.log("\n🎉 Seed script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Seed script failed:", error);
    process.exit(1);
  });
