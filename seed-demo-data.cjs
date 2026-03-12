/**
 * Demo Data Seed Script
 * Populates comprehensive demo data for all 6 test accounts
 * shown on the login page. Does NOT delete existing data.
 *
 * Run: node seed-demo-data.cjs
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ============================================================================
// HELPERS
// ============================================================================

const DEMO_PREFIX = "DEMO";
let counter = Date.now(); // unique counter for IDs
const uid = () => `${DEMO_PREFIX}-${++counter}`;

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

const monthsAgo = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
};

const randomBetween = (min, max) =>
  Math.round((Math.random() * (max - min) + min) * 100) / 100;

// South African names and addresses for realistic data
const saNames = [
  { first: "Sipho", last: "Ndlovu", company: "Ndlovu Construction" },
  { first: "Thandi", last: "Mokoena", company: "Mokoena Properties" },
  { first: "Johan", last: "van der Merwe", company: "Van der Merwe Estates" },
  { first: "Lerato", last: "Molefe", company: "Molefe Holdings" },
  { first: "Pieter", last: "Botha", company: "Botha & Sons Plumbing" },
  { first: "Nomsa", last: "Dlamini", company: "Dlamini Electrical Services" },
  { first: "David", last: "Naidoo", company: "Naidoo Engineering" },
  { first: "Zanele", last: "Mthembu", company: "Mthembu Cleaning Services" },
  { first: "Andre", last: "Pretorius", company: "Pretorius Builders" },
  { first: "Palesa", last: "Khumalo", company: "Khumalo Interiors" },
  { first: "James", last: "Williams", company: "Williams Painters" },
  { first: "Ayanda", last: "Zulu", company: "Zulu Security" },
  { first: "Michelle", last: "Fourie", company: "Fourie Landscaping" },
  { first: "Bongani", last: "Sithole", company: "Sithole HVAC" },
  { first: "Lindiwe", last: "Nkosi", company: "Nkosi Legal Services" },
];

const saAddresses = [
  "12 Mandela Drive, Sandton, Johannesburg, 2196",
  "45 Jan Smuts Avenue, Rosebank, Johannesburg, 2196",
  "78 Rivonia Road, Rivonia, Johannesburg, 2128",
  "23 Voortrekker Road, Bellville, Cape Town, 7530",
  "56 Main Road, Claremont, Cape Town, 7708",
  "101 Church Street, Hatfield, Pretoria, 0028",
  "34 Umhlanga Rocks Drive, Umhlanga, Durban, 4320",
  "89 Oxford Road, Illovo, Johannesburg, 2196",
  "67 William Nicol Drive, Fourways, Johannesburg, 2191",
  "15 Pretorius Street, Centurion, Pretoria, 0157",
];

const serviceTypes = [
  "Plumbing",
  "Electrical",
  "HVAC",
  "Painting",
  "Roofing",
  "General Maintenance",
  "Carpentry",
  "Landscaping",
  "Tiling",
  "Waterproofing",
];

const buildingNames = [
  "Sandton Towers",
  "Rivonia Gardens",
  "Centurion Heights",
  "Rosebank Plaza",
  "Fourways Business Park",
];

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function main() {
  console.log("🚀 Starting demo data seed...\n");

  // 1. Find all demo users
  const demoEmails = [
    "junior@propmanagement.com",
    "admin@propmanagement.com",
    "pm@propmanagement.com",
    "contractor@propmanagement.com",
    "artisan@propmanagement.com",
    "customer@example.com",
  ];

  const users = {};
  for (const email of demoEmails) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`⚠️  User ${email} not found, skipping...`);
      continue;
    }
    users[email] = user;
    console.log(
      `✅ Found user: ${user.firstName} ${user.lastName} (${email}) - Role: ${user.role}`
    );
  }

  const admin = users["admin@propmanagement.com"];
  const junior = users["junior@propmanagement.com"];
  const pm = users["pm@propmanagement.com"];
  const contractor = users["contractor@propmanagement.com"];
  const artisan = users["artisan@propmanagement.com"];
  const customer = users["customer@example.com"];

  if (!admin || !junior) {
    console.error("❌ Admin accounts not found. Cannot proceed.");
    return;
  }

  console.log("\n--- Seeding Admin Data ---\n");

  // =========================================================================
  // 2. LEADS - Create 15 leads with various statuses and sources
  // =========================================================================
  console.log("📋 Creating leads...");
  const leads = [];
  const leadData = [
    {
      name: saNames[0],
      status: "NEW",
      source: "WEBSITE",
      service: "Plumbing",
      value: 15000,
      addr: saAddresses[0],
    },
    {
      name: saNames[1],
      status: "CONTACTED",
      source: "REFERRAL",
      service: "Electrical",
      value: 28000,
      addr: saAddresses[1],
    },
    {
      name: saNames[2],
      status: "QUALIFIED",
      source: "PHONE",
      service: "HVAC",
      value: 45000,
      addr: saAddresses[2],
    },
    {
      name: saNames[3],
      status: "PROPOSAL_SENT",
      source: "CAMPAIGN",
      service: "Painting",
      value: 12000,
      addr: saAddresses[3],
    },
    {
      name: saNames[4],
      status: "NEGOTIATION",
      source: "WALK_IN",
      service: "Roofing",
      value: 65000,
      addr: saAddresses[4],
    },
    {
      name: saNames[5],
      status: "WON",
      source: "SOCIAL_MEDIA",
      service: "Electrical",
      value: 35000,
      addr: saAddresses[5],
    },
    {
      name: saNames[6],
      status: "WON",
      source: "REFERRAL",
      service: "General Maintenance",
      value: 22000,
      addr: saAddresses[6],
    },
    {
      name: saNames[7],
      status: "LOST",
      source: "WEBSITE",
      service: "Landscaping",
      value: 18000,
      addr: saAddresses[7],
    },
    {
      name: saNames[8],
      status: "NEW",
      source: "AI_AGENT",
      service: "Carpentry",
      value: 9500,
      addr: saAddresses[8],
    },
    {
      name: saNames[9],
      status: "CONTACTED",
      source: "SOCIAL_MEDIA",
      service: "Tiling",
      value: 14000,
      addr: saAddresses[9],
    },
    {
      name: saNames[10],
      status: "QUALIFIED",
      source: "WEBSITE",
      service: "Waterproofing",
      value: 55000,
      addr: saAddresses[0],
    },
    {
      name: saNames[11],
      status: "PROPOSAL_SENT",
      source: "PHONE",
      service: "Plumbing",
      value: 8500,
      addr: saAddresses[1],
    },
    {
      name: saNames[12],
      status: "WON",
      source: "REFERRAL",
      service: "Landscaping",
      value: 42000,
      addr: saAddresses[2],
    },
    {
      name: saNames[13],
      status: "NEGOTIATION",
      source: "CAMPAIGN",
      service: "HVAC",
      value: 78000,
      addr: saAddresses[3],
    },
    {
      name: saNames[14],
      status: "NEW",
      source: "WALK_IN",
      service: "General Maintenance",
      value: 5500,
      addr: saAddresses[4],
    },
  ];

  for (let i = 0; i < leadData.length; i++) {
    const ld = leadData[i];
    const creatorId = i % 2 === 0 ? admin.id : junior.id;
    const lead = await prisma.lead.create({
      data: {
        customerName: `${ld.name.first} ${ld.name.last}`,
        companyName: ld.name.company,
        customerEmail: `${ld.name.first.toLowerCase()}.${ld.name.last.toLowerCase()}@demo.co.za`,
        customerPhone: `+27${(710000000 + i * 1111111).toString().slice(0, 9)}`,
        address: ld.addr,
        serviceType: ld.service,
        description: `${ld.service} services required at ${ld.addr}. Customer inquired about comprehensive ${ld.service.toLowerCase()} solutions for their property.`,
        estimatedValue: ld.value,
        status: ld.status,
        source: ld.source,
        createdById: creatorId,
        createdAt: daysAgo(Math.floor(Math.random() * 60) + 5),
        nextFollowUpDate:
          ld.status !== "WON" && ld.status !== "LOST"
            ? daysFromNow(Math.floor(Math.random() * 14) + 1)
            : null,
        followUpAssignedToId: i % 3 === 0 ? junior.id : admin.id,
        notes:
          ld.status === "LOST"
            ? "Customer went with competitor - lower pricing offered."
            : null,
      },
    });
    leads.push(lead);
  }
  console.log(`   ✅ Created ${leads.length} leads`);

  // =========================================================================
  // 3. CLIENTS - Create 10 clients
  // =========================================================================
  console.log("👥 Creating clients...");
  const clients = [];
  for (let i = 0; i < 10; i++) {
    const n = saNames[i];
    const client = await prisma.client.create({
      data: {
        name: `${n.first} ${n.last}`,
        companyName: n.company,
        email: `${n.first.toLowerCase()}.${n.last.toLowerCase()}@demo.co.za`,
        phone: `+27${(720000000 + i * 1111111).toString().slice(0, 9)}`,
        address: saAddresses[i % saAddresses.length],
        vatNumber: i < 5 ? `VAT${4000000000 + i}` : null,
        createdById: i % 2 === 0 ? admin.id : junior.id,
      },
    });
    clients.push(client);
  }
  console.log(`   ✅ Created ${clients.length} clients`);

  // =========================================================================
  // 4. QUOTATIONS - Create 12 quotations with various statuses
  // =========================================================================
  console.log("📝 Creating quotations...");
  const quotations = [];
  const quotationStatuses = [
    "DRAFT",
    "PENDING_JUNIOR_MANAGER_REVIEW",
    "PENDING_SENIOR_MANAGER_REVIEW",
    "APPROVED",
    "SENT_TO_CUSTOMER",
    "APPROVED",
    "SENT_TO_CUSTOMER",
    "REJECTED",
    "DRAFT",
    "APPROVED",
    "SENT_TO_CUSTOMER",
    "APPROVED",
  ];
  for (let i = 0; i < 12; i++) {
    const n = saNames[i % saNames.length];
    const items = [
      {
        description: `${serviceTypes[i % serviceTypes.length]} - Labour`,
        quantity: randomBetween(2, 20),
        unitPrice: randomBetween(500, 2500),
        total: 0,
      },
      {
        description: `${serviceTypes[i % serviceTypes.length]} - Materials`,
        quantity: randomBetween(1, 10),
        unitPrice: randomBetween(200, 5000),
        total: 0,
      },
      {
        description: "Transport & Call-out Fee",
        quantity: 1,
        unitPrice: randomBetween(350, 850),
        total: 0,
      },
    ];
    items.forEach((it) => (it.total = +(it.quantity * it.unitPrice).toFixed(2)));
    const subtotal = items.reduce((s, it) => s + it.total, 0);
    const tax = +(subtotal * 0.15).toFixed(2);
    const total = +(subtotal + tax).toFixed(2);
    const companyMatCost = +(subtotal * 0.3).toFixed(2);
    const companyLabCost = +(subtotal * 0.25).toFixed(2);
    const profit = +(total - companyMatCost - companyLabCost).toFixed(2);

    const q = await prisma.quotation.create({
      data: {
        quoteNumber: uid(),
        customerName: `${n.first} ${n.last}`,
        customerEmail: `${n.first.toLowerCase()}.${n.last.toLowerCase()}@demo.co.za`,
        customerPhone: `+27${(730000000 + i * 1111111).toString().slice(0, 9)}`,
        address: saAddresses[i % saAddresses.length],
        items: items,
        subtotal,
        tax,
        total,
        companyMaterialCost: companyMatCost,
        companyLabourCost: companyLabCost,
        estimatedProfit: profit,
        status: quotationStatuses[i],
        validUntil: daysFromNow(30),
        createdById: i % 2 === 0 ? admin.id : junior.id,
        assignedToId: artisan ? artisan.id : null,
        leadId: i < leads.length ? leads[i].id : null,
        createdAt: daysAgo(Math.floor(Math.random() * 45) + 3),
        notes:
          quotationStatuses[i] === "REJECTED"
            ? "Customer found pricing too high for scope."
            : null,
        rejectionReason:
          quotationStatuses[i] === "REJECTED"
            ? "Price exceeds customer budget"
            : null,
      },
    });
    quotations.push(q);
  }
  console.log(`   ✅ Created ${quotations.length} quotations`);

  // =========================================================================
  // 5. ORDERS - Create 10 orders with various statuses
  // =========================================================================
  console.log("📦 Creating orders...");
  const orders = [];
  const orderStatuses = [
    "PENDING",
    "ASSIGNED",
    "IN_PROGRESS",
    "COMPLETED",
    "COMPLETED",
    "IN_PROGRESS",
    "COMPLETED",
    "PENDING",
    "ASSIGNED",
    "COMPLETED",
  ];
  for (let i = 0; i < 10; i++) {
    const n = saNames[i % saNames.length];
    const matCost = randomBetween(1500, 15000);
    const labCost = randomBetween(2000, 12000);
    const callOut = randomBetween(350, 850);
    const totalCost = +(matCost + labCost + callOut).toFixed(2);

    const isCompleted = orderStatuses[i] === "COMPLETED";
    const isAssigned =
      orderStatuses[i] === "ASSIGNED" ||
      orderStatuses[i] === "IN_PROGRESS" ||
      isCompleted;

    const order = await prisma.order.create({
      data: {
        orderNumber: uid(),
        customerName: `${n.first} ${n.last}`,
        customerEmail: `${n.first.toLowerCase()}.${n.last.toLowerCase()}@demo.co.za`,
        customerPhone: `+27${(740000000 + i * 1111111).toString().slice(0, 9)}`,
        address: saAddresses[i % saAddresses.length],
        serviceType: serviceTypes[i % serviceTypes.length],
        description: `${serviceTypes[i % serviceTypes.length]} work order for ${n.first} ${n.last}. Scope includes assessment, materials procurement, and professional execution of all ${serviceTypes[i % serviceTypes.length].toLowerCase()} tasks.`,
        status: orderStatuses[i],
        assignedToId: isAssigned && artisan ? artisan.id : null,
        leadId: i < leads.length ? leads[i].id : null,
        materialCost: isCompleted ? matCost : 0,
        labourCost: isCompleted ? labCost : 0,
        callOutFee: callOut,
        totalCost: isCompleted ? totalCost : callOut,
        startTime: isAssigned ? daysAgo(10 + i) : null,
        endTime: isCompleted ? daysAgo(i) : null,
        createdAt: daysAgo(Math.floor(Math.random() * 50) + 5),
      },
    });
    orders.push(order);

    // Create materials for completed orders
    if (isCompleted) {
      const materialNames = [
        "PVC Pipes 110mm",
        "Copper Wire 2.5mm",
        "Paint (Dulux White)",
        "Cement 50kg",
        "Tiles 600x600mm",
        "Waterproofing Membrane",
        "LED Downlights",
        "Geyser Element 3kW",
      ];
      for (let m = 0; m < 3; m++) {
        const qty = randomBetween(1, 20);
        const unitP = randomBetween(50, 800);
        await prisma.material.create({
          data: {
            name: materialNames[(i + m) % materialNames.length],
            quantity: qty,
            unitPrice: unitP,
            totalCost: +(qty * unitP).toFixed(2),
            supplier: saNames[(i + m) % saNames.length].company,
            orderId: order.id,
          },
        });
      }
    }
  }
  console.log(`   ✅ Created ${orders.length} orders (with materials)`);

  // =========================================================================
  // 6. INVOICES - Create 10 invoices with various statuses
  // =========================================================================
  console.log("💰 Creating invoices...");
  const invoices = [];
  const invoiceStatuses = [
    "DRAFT",
    "SENT",
    "PAID",
    "PAID",
    "OVERDUE",
    "SENT",
    "PAID",
    "APPROVED",
    "PENDING_REVIEW",
    "PAID",
  ];
  for (let i = 0; i < 10; i++) {
    const n = saNames[i % saNames.length];
    const items = [
      {
        description: `${serviceTypes[i % serviceTypes.length]} Services`,
        quantity: randomBetween(1, 15),
        unitPrice: randomBetween(800, 4000),
        total: 0,
      },
      {
        description: "Materials Supplied",
        quantity: randomBetween(1, 8),
        unitPrice: randomBetween(500, 3000),
        total: 0,
      },
      {
        description: "Call-out & Transport",
        quantity: 1,
        unitPrice: randomBetween(400, 900),
        total: 0,
      },
    ];
    items.forEach((it) => (it.total = +(it.quantity * it.unitPrice).toFixed(2)));
    const subtotal = items.reduce((s, it) => s + it.total, 0);
    const tax = +(subtotal * 0.15).toFixed(2);
    const total = +(subtotal + tax).toFixed(2);
    const companyMatCost = +(subtotal * 0.3).toFixed(2);
    const companyLabCost = +(subtotal * 0.25).toFixed(2);
    const profit = +(total - companyMatCost - companyLabCost).toFixed(2);

    const isPaid = invoiceStatuses[i] === "PAID";
    const completedOrder = orders.find(
      (o, idx) => idx === i && o.status === "COMPLETED"
    );

    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber: uid(),
        customerName: `${n.first} ${n.last}`,
        customerEmail: `${n.first.toLowerCase()}.${n.last.toLowerCase()}@demo.co.za`,
        customerPhone: `+27${(750000000 + i * 1111111).toString().slice(0, 9)}`,
        address: saAddresses[i % saAddresses.length],
        items: items,
        subtotal,
        tax,
        total,
        companyMaterialCost: companyMatCost,
        companyLabourCost: companyLabCost,
        estimatedProfit: profit,
        status: invoiceStatuses[i],
        dueDate:
          invoiceStatuses[i] === "OVERDUE" ? daysAgo(15) : daysFromNow(30),
        paidDate: isPaid ? daysAgo(Math.floor(Math.random() * 10)) : null,
        orderId: completedOrder ? completedOrder.id : null,
        createdById: i % 2 === 0 ? admin.id : junior.id,
        createdAt: daysAgo(Math.floor(Math.random() * 40) + 3),
      },
    });
    invoices.push(inv);
  }
  console.log(`   ✅ Created ${invoices.length} invoices`);

  // =========================================================================
  // 7. PROJECTS with MILESTONES - Create 4 projects
  // =========================================================================
  console.log("🏗️  Creating projects with milestones...");
  const projectData = [
    {
      name: "Sandton Office Renovation",
      type: "Commercial Renovation",
      status: "IN_PROGRESS",
      budget: 350000,
    },
    {
      name: "Centurion Residential Complex Maintenance",
      type: "Residential Maintenance",
      status: "PLANNING",
      budget: 180000,
    },
    {
      name: "Rosebank Mall Electrical Upgrade",
      type: "Electrical Infrastructure",
      status: "COMPLETED",
      budget: 520000,
    },
    {
      name: "Fourways Estate Landscaping",
      type: "Landscaping & Irrigation",
      status: "IN_PROGRESS",
      budget: 95000,
    },
  ];

  const projects = [];
  for (let i = 0; i < projectData.length; i++) {
    const pd = projectData[i];
    const n = saNames[i];
    const project = await prisma.project.create({
      data: {
        projectNumber: uid(),
        name: pd.name,
        description: `Full-scope ${pd.type.toLowerCase()} project. Includes site assessment, material procurement, skilled labour deployment, and final handover with quality assurance checks.`,
        customerName: `${n.first} ${n.last}`,
        customerEmail: `${n.first.toLowerCase()}.${n.last.toLowerCase()}@demo.co.za`,
        customerPhone: `+27${(760000000 + i * 1111111).toString().slice(0, 9)}`,
        address: saAddresses[i],
        projectType: pd.type,
        status: pd.status,
        startDate: pd.status !== "PLANNING" ? daysAgo(60 + i * 10) : null,
        endDate: pd.status === "COMPLETED" ? daysAgo(5) : null,
        estimatedBudget: pd.budget,
        actualCost:
          pd.status === "COMPLETED"
            ? +(pd.budget * randomBetween(0.85, 1.1)).toFixed(2)
            : +(pd.budget * randomBetween(0.2, 0.6)).toFixed(2),
        assignedToId: artisan ? artisan.id : null,
        createdAt: daysAgo(75 + i * 5),
      },
    });
    projects.push(project);

    // Create milestones for each project
    const milestoneNames = [
      "Site Assessment & Planning",
      "Material Procurement",
      "Phase 1 - Foundation Work",
      "Phase 2 - Core Implementation",
      "Final Inspection & Handover",
    ];
    for (let m = 0; m < milestoneNames.length; m++) {
      const mBudget = +(pd.budget / milestoneNames.length).toFixed(2);
      const mStatus =
        pd.status === "COMPLETED"
          ? "COMPLETED"
          : m < 2
            ? "COMPLETED"
            : m === 2
              ? "IN_PROGRESS"
              : "NOT_STARTED";

      await prisma.milestone.create({
        data: {
          projectId: project.id,
          name: milestoneNames[m],
          description: `${milestoneNames[m]} for ${pd.name}. Detailed scope and deliverables documented in project brief.`,
          sequenceOrder: m + 1,
          status: mStatus,
          labourCost: +(mBudget * 0.4).toFixed(2),
          materialCost: +(mBudget * 0.35).toFixed(2),
          expectedProfit: +(mBudget * 0.15).toFixed(2),
          budgetAllocated: mBudget,
          actualCost:
            mStatus === "COMPLETED"
              ? +(mBudget * randomBetween(0.9, 1.05)).toFixed(2)
              : 0,
          progressPercentage:
            mStatus === "COMPLETED"
              ? 100
              : mStatus === "IN_PROGRESS"
                ? randomBetween(30, 70)
                : 0,
          assignedToId: artisan ? artisan.id : null,
          startDate: daysAgo(60 - m * 10),
          endDate: daysFromNow(m * 10),
        },
      });
    }
  }
  console.log(
    `   ✅ Created ${projects.length} projects with milestones`
  );

  // =========================================================================
  // 8. ASSETS - Create 8 assets
  // =========================================================================
  console.log("🏠 Creating assets...");
  const assetData = [
    {
      name: "Toyota Hilux 2.8 GD-6",
      cat: "VEHICLE",
      serial: "VIN-DEMO-001",
      price: 685000,
      cond: "GOOD",
      loc: "Head Office Parking",
    },
    {
      name: "Bosch Professional Drill Set",
      cat: "EQUIPMENT",
      serial: "BSH-DEMO-002",
      price: 12500,
      cond: "EXCELLENT",
      loc: "Tool Store A",
    },
    {
      name: "Dell Latitude 5540 Laptop",
      cat: "IT_EQUIPMENT",
      serial: "DLL-DEMO-003",
      price: 24999,
      cond: "GOOD",
      loc: "Admin Office",
    },
    {
      name: "Makita Generator 6.5kVA",
      cat: "EQUIPMENT",
      serial: "MKT-DEMO-004",
      price: 45000,
      cond: "FAIR",
      loc: "Warehouse",
    },
    {
      name: "Office Furniture Set (Executive)",
      cat: "FURNITURE",
      serial: "FRN-DEMO-005",
      price: 35000,
      cond: "GOOD",
      loc: "Main Office",
    },
    {
      name: "Nissan NP200 Bakkie",
      cat: "VEHICLE",
      serial: "VIN-DEMO-006",
      price: 295000,
      cond: "GOOD",
      loc: "Site Office",
    },
    {
      name: "Scaffolding Set (Full)",
      cat: "EQUIPMENT",
      serial: "SCF-DEMO-007",
      price: 85000,
      cond: "FAIR",
      loc: "Warehouse",
    },
    {
      name: "HP LaserJet Pro MFP M428",
      cat: "IT_EQUIPMENT",
      serial: "HPP-DEMO-008",
      price: 8999,
      cond: "EXCELLENT",
      loc: "Admin Office",
    },
  ];

  for (const a of assetData) {
    await prisma.asset.create({
      data: {
        name: a.name,
        description: `Company asset: ${a.name}. Maintained per scheduled service plan.`,
        category: a.cat,
        serialNumber: a.serial,
        purchaseDate: monthsAgo(Math.floor(Math.random() * 24) + 6),
        purchasePrice: a.price,
        currentValue: +(a.price * randomBetween(0.5, 0.9)).toFixed(2),
        condition: a.cond,
        location: a.loc,
        createdById: admin.id,
      },
    });
  }
  console.log(`   ✅ Created ${assetData.length} assets`);

  // =========================================================================
  // 9. LIABILITIES - Create 5 liabilities
  // =========================================================================
  console.log("📊 Creating liabilities...");
  const liabilityData = [
    {
      name: "Vehicle Finance - Toyota Hilux",
      cat: "LOAN",
      amount: 485000,
      creditor: "Wesbank",
    },
    {
      name: "Equipment Lease - Generators",
      cat: "LOAN",
      amount: 120000,
      creditor: "Bidvest Leasing",
    },
    {
      name: "Supplier Account - BuildIt",
      cat: "ACCOUNTS_PAYABLE",
      amount: 45000,
      creditor: "BuildIt",
    },
    {
      name: "Business Overdraft Facility",
      cat: "CREDIT_LINE",
      amount: 250000,
      creditor: "FNB Business",
    },
    {
      name: "Insurance Premium (Annual)",
      cat: "OTHER",
      amount: 38000,
      creditor: "Santam Business Insurance",
    },
  ];

  for (const l of liabilityData) {
    await prisma.liability.create({
      data: {
        name: l.name,
        description: `${l.name} - monthly repayment obligation`,
        category: l.cat,
        amount: l.amount,
        dueDate: daysFromNow(Math.floor(Math.random() * 180) + 30),
        isPaid: false,
        creditor: l.creditor,
        createdById: admin.id,
      },
    });
  }
  console.log(`   ✅ Created ${liabilityData.length} liabilities`);

  // =========================================================================
  // 10. OPERATIONAL EXPENSES - Create 12
  // =========================================================================
  console.log("💳 Creating operational expenses...");
  const expenseData = [
    { cat: "PETROL", desc: "Diesel - Toyota Hilux", amount: 2800, vendor: "Shell" },
    { cat: "OFFICE_SUPPLIES", desc: "Stationery & printer cartridges", amount: 1450, vendor: "Waltons" },
    { cat: "UTILITIES", desc: "Electricity - Head Office", amount: 3200, vendor: "City Power" },
    { cat: "INSURANCE", desc: "Monthly vehicle insurance", amount: 2100, vendor: "Santam" },
    { cat: "MARKETING", desc: "Google Ads campaign", amount: 5000, vendor: "Google" },
    { cat: "MAINTENANCE", desc: "Office AC service", amount: 1800, vendor: "Carrier SA" },
    { cat: "TELECOMMUNICATIONS", desc: "Business fibre & mobile", amount: 2500, vendor: "Vodacom Business" },
    { cat: "SOFTWARE_SUBSCRIPTIONS", desc: "Microsoft 365 Business", amount: 3500, vendor: "Microsoft" },
    { cat: "TRAVEL", desc: "Fuel & tolls - site visits", amount: 1650, vendor: "Various" },
    { cat: "PROFESSIONAL_FEES", desc: "Accountant monthly retainer", amount: 8500, vendor: "Mazars SA" },
    { cat: "RENT", desc: "Office rent - Sandton", amount: 18000, vendor: "Growthpoint Properties" },
    { cat: "SALARIES", desc: "Staff salaries", amount: 85000, vendor: "Internal Payroll" },
  ];

  for (let i = 0; i < expenseData.length; i++) {
    const e = expenseData[i];
    await prisma.operationalExpense.create({
      data: {
        date: daysAgo(Math.floor(Math.random() * 30)),
        category: e.cat,
        description: e.desc,
        amount: e.amount,
        vendor: e.vendor,
        createdById: i % 2 === 0 ? admin.id : junior.id,
        isApproved: i < 8,
        approvedById: i < 8 ? admin.id : null,
        approvedAt: i < 8 ? daysAgo(Math.floor(Math.random() * 5)) : null,
        isRecurring: i >= 6,
        recurringPeriod: i >= 6 ? "MONTHLY" : null,
      },
    });
  }
  console.log(`   ✅ Created ${expenseData.length} operational expenses`);

  // =========================================================================
  // 11. ALTERNATIVE REVENUE - Create 6
  // =========================================================================
  console.log("💵 Creating alternative revenue entries...");
  const revenueData = [
    { cat: "CONSULTING", desc: "Project consulting - Residential", amount: 15000, src: "Direct Client" },
    { cat: "RENTAL_INCOME", desc: "Workshop rental income", amount: 8500, src: "Tenant Sublease" },
    { cat: "INTEREST", desc: "Business savings interest", amount: 2200, src: "FNB Business Account" },
    { cat: "OTHER", desc: "Equipment rental - Scaffolding", amount: 6000, src: "Contractor Sublease" },
    { cat: "CONSULTING", desc: "Site inspection consulting", amount: 12000, src: "Insurance Assessor" },
    { cat: "RENTAL_INCOME", desc: "Parking bay rental", amount: 3500, src: "Monthly Rental" },
  ];

  for (let i = 0; i < revenueData.length; i++) {
    const r = revenueData[i];
    await prisma.alternativeRevenue.create({
      data: {
        date: daysAgo(Math.floor(Math.random() * 30)),
        category: r.cat,
        description: r.desc,
        amount: r.amount,
        source: r.src,
        createdById: i % 2 === 0 ? admin.id : junior.id,
        isApproved: true,
        approvedById: admin.id,
        approvedAt: daysAgo(2),
      },
    });
  }
  console.log(`   ✅ Created ${revenueData.length} alternative revenue entries`);

  // =========================================================================
  // 12. CAMPAIGNS - Create 4
  // =========================================================================
  console.log("📧 Creating campaigns...");
  const campaignData = [
    {
      name: "Winter Maintenance Special",
      subject: "Prepare Your Property for Winter - 15% Off",
      status: "SENT",
      recipients: 245,
      sent: 238,
    },
    {
      name: "New Year Property Check-Up",
      subject: "Start 2025 Right - Free Property Assessment",
      status: "SENT",
      recipients: 180,
      sent: 175,
    },
    {
      name: "Geyser Replacement Promotion",
      subject: "Upgrade to Solar Geyser - Save Up to R5,000",
      status: "DRAFT",
      recipients: 0,
      sent: 0,
    },
    {
      name: "Referral Rewards Program",
      subject: "Refer a Friend & Get R500 Off Your Next Service",
      status: "SCHEDULED",
      recipients: 320,
      sent: 0,
    },
  ];

  for (let i = 0; i < campaignData.length; i++) {
    const c = campaignData[i];
    await prisma.campaign.create({
      data: {
        name: c.name,
        description: `Marketing campaign: ${c.name}`,
        subject: c.subject,
        htmlBody: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #2D5016; color: white; padding: 20px; text-align: center;">
            <h1>Square 15 Management</h1>
          </div>
          <div style="padding: 20px;">
            <h2>${c.subject}</h2>
            <p>Dear Valued Customer,</p>
            <p>We are excited to bring you this exclusive offer from Square 15 Management. Our team of skilled professionals is ready to assist with all your property maintenance needs.</p>
            <p>Contact us today to take advantage of this limited-time promotion!</p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="#" style="background: #F4C430; color: #2D5016; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Book Now</a>
            </div>
            <p>Best regards,<br/>The Square 15 Team</p>
          </div>
        </div>`,
        targetCriteria: { statuses: ["WON", "CONTACTED"], serviceTypes: [] },
        status: c.status,
        scheduledFor: c.status === "SCHEDULED" ? daysFromNow(7) : null,
        sentAt: c.status === "SENT" ? daysAgo(Math.floor(Math.random() * 30)) : null,
        totalRecipients: c.recipients,
        totalSent: c.sent,
        totalFailed: c.sent > 0 ? Math.floor(c.recipients - c.sent) : 0,
        createdById: admin.id,
      },
    });
  }
  console.log(`   ✅ Created ${campaignData.length} campaigns`);

  // =========================================================================
  // 13. FINANCIAL REPORTS - Create 6
  // =========================================================================
  console.log("📈 Creating financial reports...");
  const reportTypes = [
    "MONTHLY_PL",
    "QUARTERLY_PL",
    "MONTHLY_BALANCE_SHEET",
    "MONTHLY_CFS",
    "ANNUAL_PL",
    "MONTHLY_BUSINESS_INSIGHTS",
  ];
  for (let i = 0; i < reportTypes.length; i++) {
    const monthOffset = i + 1;
    await prisma.financialReport.create({
      data: {
        reportType: reportTypes[i],
        reportPeriod:
          reportTypes[i].includes("QUARTERLY")
            ? "2025-Q1"
            : reportTypes[i].includes("ANNUAL")
              ? "2024"
              : `2025-${String(6 - i).padStart(2, "0")}`,
        startDate: monthsAgo(monthOffset + 1),
        endDate: monthsAgo(monthOffset),
        status: "COMPLETED",
        totalRevenue: randomBetween(80000, 350000),
        totalExpenses: randomBetween(50000, 200000),
        netProfit: randomBetween(20000, 150000),
        aiInsights: `Business performance for this period shows positive growth trends. Revenue increased by ${randomBetween(5, 25).toFixed(1)}% compared to the previous period. Key drivers include increased order volume and improved margins on ${serviceTypes[i % serviceTypes.length]} services. Recommendation: Focus on high-margin services and continue lead nurture campaigns.`,
      },
    });
  }
  console.log(`   ✅ Created ${reportTypes.length} financial reports`);

  // =========================================================================
  // 14. JOB ACTIVITIES (for artisan)
  // =========================================================================
  if (artisan) {
    console.log("\n--- Seeding Artisan Data ---\n");
    console.log("⏱️  Creating job activities...");
    const completedOrders = orders.filter((o) => o.status === "COMPLETED");
    for (const order of completedOrders) {
      for (let d = 0; d < 3; d++) {
        const start = new Date(daysAgo(15 - d));
        start.setHours(8, 0, 0, 0);
        const end = new Date(start);
        end.setHours(16, 30, 0, 0);
        await prisma.jobActivity.create({
          data: {
            startTime: start,
            endTime: end,
            durationMinutes: 510,
            description: `Day ${d + 1}: ${d === 0 ? "Site assessment and preparation" : d === 1 ? "Core work execution and materials installation" : "Finishing, cleanup, and quality checks"}`,
            orderId: order.id,
            artisanId: artisan.id,
          },
        });
      }
    }
    console.log(
      `   ✅ Created ${completedOrders.length * 3} job activities`
    );

    // PAYMENT REQUESTS
    console.log("💸 Creating payment requests...");
    for (let i = 0; i < 4; i++) {
      const statuses = ["PENDING", "APPROVED", "PAID", "PAID"];
      await prisma.paymentRequest.create({
        data: {
          requestNumber: uid(),
          artisanId: artisan.id,
          orderIds: completedOrders.length > i ? [completedOrders[i].id] : [],
          calculatedAmount: randomBetween(3000, 15000),
          status: statuses[i],
          createdAt: daysAgo(20 - i * 5),
        },
      });
    }
    console.log(`   ✅ Created 4 payment requests`);
  }

  // =========================================================================
  // 15. REVIEWS (customer reviews artisan)
  // =========================================================================
  if (customer && artisan) {
    console.log("\n--- Seeding Customer/Review Data ---\n");
    console.log("⭐ Creating reviews...");
    const completedOrders = orders.filter((o) => o.status === "COMPLETED");
    for (let i = 0; i < Math.min(4, completedOrders.length); i++) {
      const ratings = [4.5, 5, 4, 4.5];
      await prisma.review.create({
        data: {
          rating: ratings[i],
          comment: [
            "Excellent work! Very professional and completed on time. Highly recommended.",
            "Outstanding service from start to finish. Will definitely use again.",
            "Good quality work. Minor delays but overall satisfied with the result.",
            "Very impressed with the attention to detail. Great communication throughout.",
          ][i],
          serviceQuality: Math.min(5, Math.ceil(ratings[i])),
          professionalism: 5,
          timeliness: i === 2 ? 3 : 5,
          customerId: customer.id,
          artisanId: artisan.id,
          orderId: completedOrders[i].id,
        },
      });
    }
    console.log(`   ✅ Created 4 reviews`);
  }

  // =========================================================================
  // 16. HR DATA - KPIs, Leave Requests, Performance Reviews
  // =========================================================================
  if (artisan) {
    console.log("\n--- Seeding HR Data ---\n");

    // Employee KPIs
    console.log("📊 Creating employee KPIs...");
    const kpiData = [
      { name: "Jobs Completed", target: 20, actual: 17, unit: "jobs", freq: "MONTHLY" },
      { name: "Customer Satisfaction", target: 4.5, actual: 4.7, unit: "rating", freq: "MONTHLY" },
      { name: "Revenue Generated", target: 150000, actual: 128000, unit: "R", freq: "MONTHLY" },
      { name: "On-Time Delivery Rate", target: 95, actual: 88, unit: "%", freq: "MONTHLY" },
      { name: "Material Waste Reduction", target: 10, actual: 7, unit: "%", freq: "QUARTERLY" },
    ];
    for (const k of kpiData) {
      await prisma.employeeKPI.create({
        data: {
          employeeId: artisan.id,
          kpiName: k.name,
          description: `${k.name} target for the current period`,
          targetValue: k.target,
          actualValue: k.actual,
          unit: k.unit,
          frequency: k.freq,
          status: "ACTIVE",
          periodStart: monthsAgo(1),
          periodEnd: daysFromNow(0),
          achievementRate: +((k.actual / k.target) * 100).toFixed(1),
          reviewedById: admin.id,
          reviewedAt: daysAgo(2),
        },
      });
    }
    console.log(`   ✅ Created ${kpiData.length} KPIs`);

    // Leave Requests
    console.log("🏖️  Creating leave requests...");
    const leaveData = [
      { type: "ANNUAL", days: 5, status: "APPROVED", reason: "Family holiday - December break" },
      { type: "SICK", days: 2, status: "APPROVED", reason: "Flu - doctor's note provided" },
      { type: "FAMILY_RESPONSIBILITY", days: 3, status: "APPROVED", reason: "Family emergency" },
      { type: "ANNUAL", days: 10, status: "PENDING", reason: "Year-end holiday - December 2025" },
    ];
    for (let i = 0; i < leaveData.length; i++) {
      const l = leaveData[i];
      await prisma.leaveRequest.create({
        data: {
          employeeId: artisan.id,
          leaveType: l.type,
          startDate: i < 3 ? daysAgo(60 - i * 20) : daysFromNow(150),
          endDate:
            i < 3
              ? daysAgo(60 - i * 20 - l.days)
              : daysFromNow(150 + l.days),
          totalDays: l.days,
          reason: l.reason,
          status: l.status,
          approvedById: l.status === "APPROVED" ? admin.id : null,
          approvedAt:
            l.status === "APPROVED" ? daysAgo(55 - i * 20) : null,
        },
      });
    }
    console.log(`   ✅ Created ${leaveData.length} leave requests`);

    // Performance Reviews
    console.log("📋 Creating performance reviews...");
    await prisma.performanceReview.create({
      data: {
        employeeId: artisan.id,
        reviewerId: admin.id,
        reviewPeriodStart: monthsAgo(6),
        reviewPeriodEnd: monthsAgo(0),
        reviewDate: daysAgo(5),
        status: "COMPLETED",
        overallRating: 4.2,
        qualityOfWork: 5,
        productivity: 4,
        communication: 4,
        teamwork: 4,
        initiative: 4,
        problemSolving: 5,
        reliability: 4,
        customerService: 5,
        technicalSkills: 5,
        leadership: 3,
        keyAchievements:
          "Successfully completed Sandton Office Renovation ahead of schedule. Maintained 4.7/5 customer satisfaction rating. Zero safety incidents for 6 months.",
        strengths:
          "Exceptional technical skills and customer service. Strong problem-solving abilities and attention to detail.",
        areasForImprovement:
          "Time management on concurrent projects could be improved. Leadership skills development recommended.",
        improvementActions:
          "Enroll in project management short course. Shadow senior team lead on next major project.",
        goalsForNextPeriod:
          "Complete 25 jobs per month. Achieve 95% on-time delivery. Mentor one junior artisan.",
        trainingNeeds:
          "Advanced electrical certification. First aid refresher course.",
        careerDevelopment:
          "Pathway to Senior Artisan role within 12 months. Potential team lead position by Q4 2025.",
        reviewerComments:
          "Strong performer with excellent customer feedback. Ready for increased responsibility.",
        employeeComments:
          "Grateful for the opportunities. Looking forward to skill development and growth within the company.",
        employeeAcknowledgedAt: daysAgo(3),
      },
    });
    console.log(`   ✅ Created 1 performance review`);
  }

  // =========================================================================
  // 17. PROPERTY MANAGER DATA
  // =========================================================================
  if (pm) {
    console.log("\n--- Seeding Property Manager Data ---\n");

    // Buildings
    console.log("🏢 Creating buildings...");
    const buildingData = [
      {
        name: "Sandton Towers",
        addr: "12 Mandela Drive, Sandton, 2196",
        type: "COMMERCIAL",
        units: 45,
        sqft: 12000,
        value: 25000000,
        revenue: 350000,
      },
      {
        name: "Rivonia Gardens",
        addr: "78 Rivonia Road, Rivonia, 2128",
        type: "RESIDENTIAL",
        units: 24,
        sqft: 6500,
        value: 15000000,
        revenue: 192000,
      },
      {
        name: "Centurion Heights",
        addr: "15 Pretorius Street, Centurion, 0157",
        type: "RESIDENTIAL",
        units: 36,
        sqft: 9200,
        value: 18000000,
        revenue: 288000,
      },
      {
        name: "Rosebank Plaza",
        addr: "45 Jan Smuts Avenue, Rosebank, 2196",
        type: "MIXED_USE",
        units: 18,
        sqft: 5000,
        value: 12000000,
        revenue: 144000,
      },
      {
        name: "Fourways Business Park",
        addr: "67 William Nicol Drive, Fourways, 2191",
        type: "COMMERCIAL",
        units: 30,
        sqft: 15000,
        value: 35000000,
        revenue: 450000,
      },
    ];

    const buildings = [];
    for (const b of buildingData) {
      const building = await prisma.building.create({
        data: {
          propertyManagerId: pm.id,
          name: b.name,
          address: b.addr,
          buildingType: b.type,
          numberOfUnits: b.units,
          totalSquareFeet: b.sqft,
          yearBuilt: 2010 + Math.floor(Math.random() * 10),
          estimatedValue: b.value,
          monthlyExpenses: +(b.revenue * 0.35).toFixed(2),
          monthlyRevenue: b.revenue,
          status: "ACTIVE",
          notes: `Premium ${b.type.toLowerCase().replace("_", " ")} property in prime location. Well-maintained with regular scheduled maintenance.`,
        },
      });
      buildings.push(building);
    }
    console.log(`   ✅ Created ${buildings.length} buildings`);

    // Tenants (PropertyManagerCustomer)
    console.log("🏠 Creating tenants...");
    const tenants = [];
    const tenantData = [
      { first: "Sarah", last: "Johnson", unit: "A101", rent: 12000, building: 0 },
      { first: "Michael", last: "Nkomo", unit: "B204", rent: 9500, building: 1 },
      { first: "Priya", last: "Patel", unit: "C305", rent: 11000, building: 1 },
      { first: "Thomas", last: "Kruger", unit: "D102", rent: 15000, building: 2 },
      { first: "Fatima", last: "Mohamed", unit: "E201", rent: 8500, building: 2 },
      { first: "William", last: "Ngcobo", unit: "A302", rent: 13500, building: 0 },
      { first: "Jessica", last: "van Wyk", unit: "B105", rent: 10000, building: 3 },
      { first: "Daniel", last: "Mahlangu", unit: "C403", rent: 14000, building: 3 },
      { first: "Amahle", last: "Dube", unit: "D201", rent: 7500, building: 4 },
      { first: "Robert", last: "Steyn", unit: "E304", rent: 16000, building: 4 },
    ];

    for (let i = 0; i < tenantData.length; i++) {
      const t = tenantData[i];
      const bld = buildings[t.building];
      const tenant = await prisma.propertyManagerCustomer.create({
        data: {
          propertyManagerId: pm.id,
          firstName: t.first,
          lastName: t.last,
          email: `${t.first.toLowerCase()}.${t.last.toLowerCase()}@demo.co.za`,
          phone: `+27${(780000000 + i * 1111111).toString().slice(0, 9)}`,
          buildingId: bld.id,
          buildingName: bld.name,
          unitNumber: t.unit,
          address: bld.address,
          onboardingStatus: "APPROVED",
          onboardedDate: monthsAgo(Math.floor(Math.random() * 12) + 3),
          status: "ACTIVE",
          moveInDate: monthsAgo(Math.floor(Math.random() * 18) + 6),
          leaseStartDate: monthsAgo(Math.floor(Math.random() * 12) + 6),
          leaseEndDate: daysFromNow(Math.floor(Math.random() * 365) + 90),
          monthlyRent: t.rent,
          securityDeposit: t.rent * 2,
          electricityMeterNumber: `ELEC-${bld.name.replace(/\s/g, "")}-${t.unit}`,
          waterMeterNumber: `WATER-${bld.name.replace(/\s/g, "")}-${t.unit}`,
        },
      });
      tenants.push(tenant);
    }
    console.log(`   ✅ Created ${tenants.length} tenants`);

    // Rent Payments
    console.log("💰 Creating rent payments...");
    let rentPaymentCount = 0;
    for (const tenant of tenants) {
      // Create 3 months of rent payments
      for (let m = 0; m < 3; m++) {
        const statuses = ["PAID", "PAID", m === 2 ? "PENDING" : "PAID"];
        await prisma.rentPayment.create({
          data: {
            tenantId: tenant.id,
            propertyManagerId: pm.id,
            paymentNumber: uid(),
            dueDate: monthsAgo(m),
            paidDate: statuses[m] === "PAID" ? monthsAgo(m) : null,
            amount: tenant.monthlyRent || 10000,
            amountPaid: statuses[m] === "PAID" ? (tenant.monthlyRent || 10000) : 0,
            status: statuses[m],
            paymentMethod: statuses[m] === "PAID" ? "BANK_TRANSFER" : null,
          },
        });
        rentPaymentCount++;
      }
    }
    console.log(`   ✅ Created ${rentPaymentCount} rent payments`);

    // Staff Members
    console.log("👷 Creating staff members...");
    const staffData = [
      { first: "John", last: "Moyo", role: "BUILDING_MANAGER", building: 0, title: "Building Manager" },
      { first: "Grace", last: "Obi", role: "CLEANER", building: 1, title: "Head Cleaner" },
      { first: "Peter", last: "Nkuna", role: "MAINTENANCE_TECH", building: 2, title: "Maintenance Technician" },
      { first: "Maria", last: "dos Santos", role: "SECURITY", building: 0, title: "Security Officer" },
      { first: "Thabo", last: "Moleleki", role: "GARDENER", building: 3, title: "Head Gardener" },
      { first: "Lindiwe", last: "Mabaso", role: "SUPERVISOR", building: 4, title: "Operations Supervisor" },
    ];

    const staffMembers = [];
    for (let i = 0; i < staffData.length; i++) {
      const s = staffData[i];
      const staff = await prisma.staffMember.create({
        data: {
          firstName: s.first,
          lastName: s.last,
          email: `${s.first.toLowerCase()}.${s.last.toLowerCase()}@demo.co.za`,
          phone: `+27${(790000000 + i * 1111111).toString().slice(0, 9)}`,
          staffRole: s.role,
          title: s.title,
          propertyManagerId: pm.id,
          buildingId: buildings[s.building].id,
          isActive: true,
        },
      });
      staffMembers.push(staff);
    }
    console.log(`   ✅ Created ${staffMembers.length} staff members`);

    // PM Tasks
    console.log("📝 Creating PM tasks...");
    const taskData = [
      { title: "Fix leaking tap in Unit A101", cat: "PLUMBING", pri: "HIGH", status: "IN_PROGRESS", staff: 2, building: 0 },
      { title: "Monthly fire extinguisher inspection", cat: "INSPECTION", pri: "MEDIUM", status: "COMPLETED", staff: 5, building: 0 },
      { title: "Repaint corridor - 3rd floor", cat: "PAINTING", pri: "LOW", status: "ASSIGNED", staff: 2, building: 1 },
      { title: "Replace faulty security camera", cat: "SECURITY", pri: "URGENT", status: "IN_PROGRESS", staff: 3, building: 2 },
      { title: "Landscape front garden area", cat: "GARDENING", pri: "MEDIUM", status: "COMPLETED", staff: 4, building: 3 },
      { title: "Electrical panel maintenance", cat: "ELECTRICAL", pri: "HIGH", status: "ASSIGNED", staff: 2, building: 4 },
      { title: "Deep clean - common areas", cat: "CLEANING", pri: "MEDIUM", status: "COMPLETED", staff: 1, building: 1 },
      { title: "Investigate water damage report", cat: "INVESTIGATION", pri: "URGENT", status: "IN_PROGRESS", staff: 0, building: 2 },
      { title: "Install new access control system", cat: "SECURITY", pri: "HIGH", status: "DRAFT", staff: 3, building: 0 },
      { title: "Quarterly pest control", cat: "MAINTENANCE", pri: "MEDIUM", status: "ASSIGNED", staff: 5, building: 4 },
    ];

    for (let i = 0; i < taskData.length; i++) {
      const t = taskData[i];
      const bld = buildings[t.building];
      await prisma.pMTask.create({
        data: {
          taskNumber: uid(),
          propertyManagerId: pm.id,
          assignedToId: staffMembers[t.staff].id,
          title: t.title,
          description: `${t.title} at ${bld.name}. Please complete as per maintenance schedule and report findings.`,
          category: t.cat,
          priority: t.pri,
          buildingName: bld.name,
          buildingAddress: bld.address,
          status: t.status,
          progressPercentage:
            t.status === "COMPLETED" ? 100 : t.status === "IN_PROGRESS" ? randomBetween(25, 75) : 0,
          dueDate: daysFromNow(t.pri === "URGENT" ? 2 : t.pri === "HIGH" ? 7 : 14),
          startDate: t.status !== "DRAFT" ? daysAgo(Math.floor(Math.random() * 10)) : null,
          completedDate: t.status === "COMPLETED" ? daysAgo(Math.floor(Math.random() * 3)) : null,
          estimatedHours: randomBetween(2, 16),
          actualHours: t.status === "COMPLETED" ? randomBetween(2, 20) : null,
          materialCost: t.status === "COMPLETED" ? randomBetween(200, 5000) : 0,
          labourCost: t.status === "COMPLETED" ? randomBetween(500, 3000) : 0,
          isRecurring: i === 1 || i === 6 || i === 9,
          recurrencePattern:
            i === 1 ? "MONTHLY" : i === 6 ? "WEEKLY" : i === 9 ? "QUARTERLY" : null,
          createdAt: daysAgo(Math.floor(Math.random() * 20) + 3),
        },
      });
    }
    console.log(`   ✅ Created ${taskData.length} PM tasks`);

    // Building Budgets
    console.log("💼 Creating building budgets...");
    for (let i = 0; i < buildings.length; i++) {
      const bld = buildings[i];
      const totalBudget = randomBetween(80000, 350000);
      const spent = +(totalBudget * randomBetween(0.3, 0.7)).toFixed(2);
      await prisma.buildingBudget.create({
        data: {
          buildingId: bld.id,
          propertyManagerId: pm.id,
          fiscalYear: 2025,
          quarter: 2,
          startDate: new Date("2025-04-01"),
          endDate: new Date("2025-06-30"),
          preventativeMaintenance: +(totalBudget * 0.25).toFixed(2),
          reactiveMaintenance: +(totalBudget * 0.2).toFixed(2),
          correctiveMaintenance: +(totalBudget * 0.15).toFixed(2),
          capitalExpenditures: +(totalBudget * 0.1).toFixed(2),
          utilities: +(totalBudget * 0.12).toFixed(2),
          insurance: +(totalBudget * 0.08).toFixed(2),
          propertyTax: +(totalBudget * 0.05).toFixed(2),
          other: +(totalBudget * 0.05).toFixed(2),
          totalBudget,
          totalSpent: spent,
          totalRemaining: +(totalBudget - spent).toFixed(2),
          status: "ACTIVE",
        },
      });
    }
    console.log(`   ✅ Created ${buildings.length} building budgets`);

    // Building Maintenance Schedules
    console.log("🔧 Creating maintenance schedules...");
    const scheduleData = [
      { title: "HVAC Filter Replacement", type: "PREVENTATIVE", cat: "HVAC", freq: "MONTHLY" },
      { title: "Fire System Inspection", type: "PREVENTATIVE", cat: "ELECTRICAL", freq: "QUARTERLY" },
      { title: "Elevator Maintenance", type: "PREVENTATIVE", cat: "STRUCTURAL", freq: "MONTHLY" },
      { title: "Pest Control Treatment", type: "PREVENTATIVE", cat: "GENERAL", freq: "QUARTERLY" },
      { title: "Roof Inspection", type: "PREVENTATIVE", cat: "STRUCTURAL", freq: "ANNUALLY" },
    ];

    for (let b = 0; b < Math.min(3, buildings.length); b++) {
      for (const sch of scheduleData) {
        await prisma.buildingMaintenanceSchedule.create({
          data: {
            buildingId: buildings[b].id,
            propertyManagerId: pm.id,
            title: sch.title,
            description: `Scheduled ${sch.type.toLowerCase()} maintenance: ${sch.title} for ${buildings[b].name}.`,
            maintenanceType: sch.type,
            category: sch.cat,
            frequency: sch.freq,
            startDate: monthsAgo(6),
            nextDueDate:
              sch.freq === "MONTHLY"
                ? daysFromNow(15)
                : sch.freq === "QUARTERLY"
                  ? daysFromNow(45)
                  : daysFromNow(180),
            estimatedCost: randomBetween(1500, 8000),
            status: "ACTIVE",
            notifyDaysBefore: 7,
          },
        });
      }
    }
    console.log(`   ✅ Created ${3 * scheduleData.length} maintenance schedules`);

    // PM Orders
    console.log("📦 Creating PM orders...");
    const pmOrderStatuses = [
      "DRAFT",
      "SUBMITTED",
      "ACCEPTED",
      "IN_PROGRESS",
      "COMPLETED",
      "COMPLETED",
    ];
    const pmOrders = [];
    for (let i = 0; i < pmOrderStatuses.length; i++) {
      const bld = buildings[i % buildings.length];
      const totalAmt = randomBetween(5000, 45000);
      const pmOrder = await prisma.propertyManagerOrder.create({
        data: {
          orderNumber: uid(),
          propertyManagerId: pm.id,
          assignedToId: artisan ? artisan.id : null,
          title: `${serviceTypes[i % serviceTypes.length]} - ${bld.name}`,
          description: `${serviceTypes[i % serviceTypes.length]} work required at ${bld.name}. Address: ${bld.address}.`,
          scopeOfWork: `Complete ${serviceTypes[i % serviceTypes.length].toLowerCase()} services including assessment, materials, labour, and cleanup.`,
          serviceType: serviceTypes[i % serviceTypes.length],
          buildingName: bld.name,
          buildingAddress: bld.address,
          totalAmount: totalAmt,
          paidAmount: pmOrderStatuses[i] === "COMPLETED" ? totalAmt : 0,
          status: pmOrderStatuses[i],
          submittedDate: i > 0 ? daysAgo(30 - i * 3) : null,
          acceptedDate: i > 1 ? daysAgo(25 - i * 3) : null,
          startDate: i > 2 ? daysAgo(20 - i * 3) : null,
          completedDate: pmOrderStatuses[i] === "COMPLETED" ? daysAgo(i) : null,
          progressPercentage:
            pmOrderStatuses[i] === "COMPLETED"
              ? 100
              : pmOrderStatuses[i] === "IN_PROGRESS"
                ? 65
                : 0,
          materialCost: pmOrderStatuses[i] === "COMPLETED" ? +(totalAmt * 0.4).toFixed(2) : 0,
          labourCost: pmOrderStatuses[i] === "COMPLETED" ? +(totalAmt * 0.45).toFixed(2) : 0,
          createdAt: daysAgo(35 - i * 3),
        },
      });
      pmOrders.push(pmOrder);
    }
    console.log(`   ✅ Created ${pmOrders.length} PM orders`);

    // PM Invoices
    console.log("🧾 Creating PM invoices...");
    const pmInvStatuses = ["DRAFT", "SENT_TO_PM", "PM_APPROVED", "PAID"];
    for (let i = 0; i < pmInvStatuses.length; i++) {
      const completedPmOrder = pmOrders.find(
        (o, idx) => o.status === "COMPLETED" && idx >= i
      );
      const invItems = [
        {
          description: `${serviceTypes[i % serviceTypes.length]} - Labour`,
          quantity: randomBetween(5, 20),
          unitPrice: randomBetween(400, 1500),
          total: 0,
        },
        {
          description: "Materials & Supplies",
          quantity: randomBetween(1, 10),
          unitPrice: randomBetween(300, 2500),
          total: 0,
        },
      ];
      invItems.forEach(
        (it) => (it.total = +(it.quantity * it.unitPrice).toFixed(2))
      );
      const sub = invItems.reduce((s, it) => s + it.total, 0);
      const tx = +(sub * 0.15).toFixed(2);
      const tot = +(sub + tx).toFixed(2);

      await prisma.propertyManagerInvoice.create({
        data: {
          invoiceNumber: uid(),
          propertyManagerId: pm.id,
          orderId: completedPmOrder ? completedPmOrder.id : null,
          items: invItems,
          subtotal: sub,
          tax: tx,
          total: tot,
          status: pmInvStatuses[i],
          adminApprovedDate: i >= 1 ? daysAgo(10) : null,
          sentToPMDate: i >= 1 ? daysAgo(8) : null,
          dueDate: daysFromNow(30),
          paidDate: pmInvStatuses[i] === "PAID" ? daysAgo(2) : null,
          pmApprovedDate:
            pmInvStatuses[i] === "PM_APPROVED" || pmInvStatuses[i] === "PAID"
              ? daysAgo(5)
              : null,
          createdAt: daysAgo(15 - i * 3),
        },
      });
    }
    console.log(`   ✅ Created ${pmInvStatuses.length} PM invoices`);

    // Tenant Feedback
    console.log("💬 Creating tenant feedback...");
    const feedbackData = [
      { type: "COMPLEMENT", cat: "SERVICE", msg: "The maintenance team was incredibly responsive. Fixed the issue within 2 hours!", status: "RESOLVED" },
      { type: "COMPLAINT", cat: "NOISE", msg: "Excessive noise from construction work during weekends. Please restrict to weekday hours.", status: "IN_PROGRESS" },
      { type: "COMPLEMENT", cat: "CLEANLINESS", msg: "The common areas are always spotless. Great job by the cleaning team!", status: "RESOLVED" },
      { type: "COMPLAINT", cat: "PARKING", msg: "Visitor parking is often occupied by non-residents. Need better enforcement.", status: "OPEN" },
      { type: "COMPLEMENT", cat: "MANAGEMENT", msg: "Very professional management. Quick response to all queries and concerns.", status: "RESOLVED" },
    ];

    for (let i = 0; i < feedbackData.length; i++) {
      const fb = feedbackData[i];
      await prisma.tenantFeedback.create({
        data: {
          type: fb.type,
          category: fb.cat,
          message: fb.msg,
          status: fb.status,
          resolvedAt: fb.status === "RESOLVED" ? daysAgo(Math.floor(Math.random() * 10)) : null,
          customerId: tenants[i % tenants.length].id,
          propertyManagerId: pm.id,
          buildingId: buildings[i % buildings.length].id,
          createdAt: daysAgo(Math.floor(Math.random() * 30) + 1),
        },
      });
    }
    console.log(`   ✅ Created ${feedbackData.length} tenant feedback items`);

    // Property Financial Metrics (per building)
    console.log("📊 Creating property financial metrics...");
    for (const bld of buildings) {
      const rentalIncome = (bld.monthlyRevenue || 100000);
      const maintExp = +(rentalIncome * 0.15).toFixed(2);
      const utilExp = +(rentalIncome * 0.08).toFixed(2);
      const totalIncome = +(rentalIncome * 1.05).toFixed(2);
      const totalExpenses = +(maintExp + utilExp + rentalIncome * 0.12).toFixed(2);

      await prisma.propertyFinancialMetrics.create({
        data: {
          buildingId: bld.id,
          propertyManagerId: pm.id,
          periodStart: monthsAgo(1),
          periodEnd: new Date(),
          periodType: "MONTHLY",
          rentalIncome,
          maintenanceFees: +(rentalIncome * 0.025).toFixed(2),
          totalIncome,
          maintenanceExpenses: maintExp,
          utilities: utilExp,
          propertyTax: +(rentalIncome * 0.03).toFixed(2),
          insurance: +(rentalIncome * 0.02).toFixed(2),
          staffSalaries: +(rentalIncome * 0.05).toFixed(2),
          totalExpenses,
          operatingProfit: +(totalIncome - totalExpenses).toFixed(2),
          profitMargin: +(((totalIncome - totalExpenses) / totalIncome) * 100).toFixed(1),
          buildingValue: bld.estimatedValue || 10000000,
          totalAssets: bld.estimatedValue || 10000000,
          occupancyRate: randomBetween(82, 98),
        },
      });
    }
    console.log(`   ✅ Created ${buildings.length} property financial metrics`);
  }

  // =========================================================================
  // 18. NOTIFICATIONS (demo-relevant only)
  // =========================================================================
  console.log("\n--- Seeding Notifications ---\n");
  const notificationRecipients = [
    { user: admin, role: "SENIOR_ADMIN" },
    { user: junior, role: "JUNIOR_ADMIN" },
    { user: artisan, role: "ARTISAN" },
    { user: pm, role: "PROPERTY_MANAGER" },
  ].filter((n) => n.user);

  const notifMessages = [
    { type: "ORDER_ASSIGNED", msg: "New order assigned - Plumbing services at Sandton Towers" },
    { type: "ORDER_COMPLETED", msg: "Order completed - Electrical work at Rivonia Gardens" },
    { type: "QUOTATION_READY_FOR_REVIEW", msg: "Quotation ready for review - HVAC installation" },
    { type: "INVOICE_CREATED", msg: "New invoice created - R45,000 for commercial renovation" },
    { type: "PAYMENT_REQUEST_CREATED", msg: "Payment request submitted by artisan - R8,500" },
    { type: "LEAD_FOLLOW_UP_REMINDER", msg: "Follow-up reminder: Sipho Ndlovu - Plumbing enquiry" },
    { type: "PROJECT_STATUS_UPDATED", msg: "Project update: Sandton Office Renovation - 65% complete" },
    { type: "SYSTEM_ALERT", msg: "Monthly financial reports are ready for review" },
    { type: "TASK_ASSIGNED", msg: "New task assigned: Fix leaking tap in Unit A101" },
    { type: "TASK_COMPLETED", msg: "Task completed: Monthly fire extinguisher inspection" },
    { type: "MAINTENANCE_REQUEST_SUBMITTED", msg: "New maintenance request from tenant Sarah Johnson" },
    { type: "CUSTOMER_PAYMENT_SUBMITTED", msg: "Rent payment received from Michael Nkomo - R9,500" },
  ];

  let notifCount = 0;
  for (const recipient of notificationRecipients) {
    for (let i = 0; i < notifMessages.length; i++) {
      const nm = notifMessages[i];
      // Only create relevant notifications per role
      if (
        recipient.role === "ARTISAN" &&
        !["ORDER_ASSIGNED", "ORDER_COMPLETED", "TASK_ASSIGNED", "PAYMENT_REQUEST_CREATED"].includes(nm.type)
      )
        continue;
      if (
        recipient.role === "PROPERTY_MANAGER" &&
        !["TASK_ASSIGNED", "TASK_COMPLETED", "MAINTENANCE_REQUEST_SUBMITTED", "CUSTOMER_PAYMENT_SUBMITTED", "PM_ORDER_COMPLETED"].includes(nm.type)
      )
        continue;

      await prisma.notification.create({
        data: {
          recipientId: recipient.user.id,
          recipientRole: recipient.role,
          message: nm.msg,
          type: nm.type,
          isRead: i < 4, // First few are read
          createdAt: daysAgo(Math.floor(Math.random() * 14)),
        },
      });
      notifCount++;
    }
  }
  console.log(`   ✅ Created ${notifCount} notifications`);

  // =========================================================================
  // 19. CLEAN UP: Remove cross-contaminated notifications for demo admin
  // =========================================================================
  console.log("\n--- Cleanup ---\n");
  console.log(
    "🧹 Removing non-demo notifications from admin@propmanagement.com..."
  );
  if (admin) {
    // Delete notifications that reference real entities (not demo ones)
    // We'll delete all notifications for the demo admin that were created BEFORE this seed
    const deletedNotifs = await prisma.notification.deleteMany({
      where: {
        recipientId: admin.id,
        createdAt: {
          lt: daysAgo(0), // today or earlier, before our seed
        },
        // Keep only notifications we just created (they have demo-relevant messages)
        NOT: {
          message: {
            contains: "Sandton",
          },
        },
      },
    });
    console.log(`   🧹 Cleaned ${deletedNotifs.count} stale notifications from demo admin`);
  }

  console.log("\n========================================");
  console.log("🎉 Demo data seed completed successfully!");
  console.log("========================================\n");

  console.log("Summary:");
  console.log(`  - 15 Leads (various statuses & sources)`);
  console.log(`  - 10 Clients`);
  console.log(`  - 12 Quotations`);
  console.log(`  - 10 Orders (with materials)`);
  console.log(`  - 10 Invoices (various statuses including PAID, OVERDUE)`);
  console.log(`  - 4 Projects (with 20 milestones)`);
  console.log(`  - 8 Assets`);
  console.log(`  - 5 Liabilities`);
  console.log(`  - 12 Operational Expenses`);
  console.log(`  - 6 Alternative Revenue entries`);
  console.log(`  - 4 Campaigns`);
  console.log(`  - 6 Financial Reports`);
  console.log(`  - Job Activities & Payment Requests (Artisan)`);
  console.log(`  - 4 Customer Reviews`);
  console.log(`  - 5 KPIs, 4 Leave Requests, 1 Performance Review (HR)`);
  console.log(`  - 5 Buildings, 10 Tenants, 30 Rent Payments (PM)`);
  console.log(`  - 6 Staff Members, 10 PM Tasks (PM)`);
  console.log(`  - 5 Building Budgets, 15 Maintenance Schedules (PM)`);
  console.log(`  - 6 PM Orders, 4 PM Invoices (PM)`);
  console.log(`  - 5 Tenant Feedback items`);
  console.log(`  - ${notifCount} Notifications`);
  console.log(`  - Property Financial Metrics per building`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
