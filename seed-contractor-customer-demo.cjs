/**
 * Demo Data Seed for Contractor & Customer portals
 * Populates data visible to contractor@propmanagement.com and customer@example.com
 *
 * Run: node seed-contractor-customer-demo.cjs
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

let counter = Date.now();
const uid = () => `DEMO-CC-${++counter}`;

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };

async function main() {
  console.log("🚀 Seeding Contractor & Customer demo data...\n");

  // Find demo users
  const contractor = await prisma.user.findUnique({ where: { email: "contractor@propmanagement.com" } });
  const customer = await prisma.user.findUnique({ where: { email: "customer@example.com" } });
  const artisan = await prisma.user.findUnique({ where: { email: "artisan@propmanagement.com" } });
  const admin = await prisma.user.findUnique({ where: { email: "admin@propmanagement.com" } });

  if (!contractor) { console.error("❌ contractor@propmanagement.com not found"); return; }
  if (!customer) { console.error("❌ customer@example.com not found"); return; }
  console.log(`✅ Contractor: id=${contractor.id} (${contractor.firstName} ${contractor.lastName})`);
  console.log(`✅ Customer: id=${customer.id} (${customer.firstName} ${customer.lastName})`);
  if (artisan) console.log(`✅ Artisan: id=${artisan.id}`);
  if (admin) console.log(`✅ Admin: id=${admin.id}`);

  // =========================================================================
  // CONTRACTOR DATA — owned by contractor (createdById = contractor.id)
  // =========================================================================
  console.log("\n--- Seeding Contractor Portal Data ---\n");

  // 1. CLIENTS (for CRM)
  console.log("📇 Creating clients...");
  const clientsData = [
    { name: "Sipho Ndlovu", company: "Ndlovu Construction", email: "sipho@ndlovu.co.za", phone: "072 555 1001", address: "12 Mandela Drive, Sandton, 2196" },
    { name: "Thandi Mokoena", company: "Mokoena Properties", email: "thandi@mokoena.co.za", phone: "083 555 1002", address: "45 Jan Smuts Ave, Rosebank, 2196" },
    { name: "Johan van der Merwe", company: "VDM Estates", email: "johan@vdm.co.za", phone: "061 555 1003", address: "78 Rivonia Road, Rivonia, 2128" },
    { name: "Lerato Molefe", company: "Molefe Holdings", email: "lerato@molefe.co.za", phone: "074 555 1004", address: "23 Voortrekker Rd, Bellville, 7530" },
    { name: "Jane Smith", company: null, email: "customer@example.com", phone: "065 555 1005", address: "56 Main Road, Claremont, Cape Town, 7708" },
  ];

  const clients = [];
  for (const c of clientsData) {
    const client = await prisma.client.create({
      data: {
        name: c.name,
        companyName: c.company,
        email: c.email,
        phone: c.phone,
        address: c.address,
        createdById: contractor.id,
      },
    });
    clients.push(client);
    console.log(`  ✅ Client: ${client.name}`);
  }

  // 2. LEADS
  console.log("📋 Creating leads...");
  const leadsData = [
    { name: "Sipho Ndlovu", email: "sipho@ndlovu.co.za", phone: "072 555 1001", service: "Plumbing", status: "NEW", source: "WEBSITE", value: 15000, addr: "12 Mandela Drive, Sandton" },
    { name: "Thandi Mokoena", email: "thandi@mokoena.co.za", phone: "083 555 1002", service: "Electrical", status: "CONTACTED", source: "REFERRAL", value: 28000, addr: "45 Jan Smuts Ave, Rosebank" },
    { name: "Johan van der Merwe", email: "johan@vdm.co.za", phone: "061 555 1003", service: "HVAC", status: "QUALIFIED", source: "PHONE", value: 45000, addr: "78 Rivonia Road, Rivonia" },
    { name: "Lerato Molefe", email: "lerato@molefe.co.za", phone: "074 555 1004", service: "Painting", status: "PROPOSAL_SENT", source: "CAMPAIGN", value: 12000, addr: "23 Voortrekker Rd, Bellville" },
    { name: "Jane Smith", email: "customer@example.com", phone: "065 555 1005", service: "Roofing", status: "WON", source: "WALK_IN", value: 65000, addr: "56 Main Road, Claremont" },
    { name: "Pieter Botha", email: "pieter@botha.co.za", phone: "076 555 1006", service: "General Maintenance", status: "NEGOTIATION", source: "SOCIAL_MEDIA", value: 22000, addr: "101 Church St, Pretoria" },
    { name: "Nomsa Dlamini", email: "nomsa@dlamini.co.za", phone: "082 555 1007", service: "Carpentry", status: "WON", source: "REFERRAL", value: 35000, addr: "34 Umhlanga Rocks Drive, Durban" },
    { name: "David Naidoo", email: "david@naidoo.co.za", phone: "071 555 1008", service: "Landscaping", status: "LOST", source: "WEBSITE", value: 18000, addr: "89 Oxford Road, Illovo" },
    { name: "Zanele Mthembu", email: "zanele@mthembu.co.za", phone: "073 555 1009", service: "Tiling", status: "NEW", source: "AI_AGENT", value: 9500, addr: "67 William Nicol Drive, Fourways" },
    { name: "Andre Pretorius", email: "andre@pretorius.co.za", phone: "084 555 1010", service: "Waterproofing", status: "CONTACTED", source: "PHONE", value: 42000, addr: "15 Pretorius St, Centurion" },
  ];

  const leads = [];
  for (let i = 0; i < leadsData.length; i++) {
    const ld = leadsData[i];
    const lead = await prisma.lead.create({
      data: {
        customerName: ld.name,
        customerEmail: ld.email,
        customerPhone: ld.phone,
        serviceType: ld.service,
        description: `${ld.service} work needed at ${ld.addr}`,
        estimatedValue: ld.value,
        status: ld.status,
        source: ld.source,
        address: ld.addr,
        createdById: contractor.id,
        createdAt: daysAgo(30 - i * 3),
        nextFollowUpDate: ["NEW", "CONTACTED", "QUALIFIED", "NEGOTIATION"].includes(ld.status) ? daysFromNow(i + 1) : null,
      },
    });
    leads.push(lead);
  }
  console.log(`  ✅ Created ${leads.length} leads`);

  // 3. ORDERS (contractor-created, some with customer@example.com as customer)
  console.log("📦 Creating orders...");
  const ordersData = [
    { name: "Jane Smith", email: "customer@example.com", phone: "065 555 1005", service: "Roofing Repair", addr: "56 Main Road, Claremont, Cape Town", status: "COMPLETED", mat: 8500, lab: 12000, total: 22000, days: 45 },
    { name: "Jane Smith", email: "customer@example.com", phone: "065 555 1005", service: "Gutter Installation", addr: "56 Main Road, Claremont, Cape Town", status: "IN_PROGRESS", mat: 3200, lab: 5500, total: 9200, days: 10 },
    { name: "Jane Smith", email: "customer@example.com", phone: "065 555 1005", service: "Bathroom Renovation", addr: "56 Main Road, Claremont, Cape Town", status: "QUOTED", mat: 15000, lab: 25000, total: 42000, days: 2 },
    { name: "Sipho Ndlovu", email: "sipho@ndlovu.co.za", phone: "072 555 1001", service: "Plumbing Installation", addr: "12 Mandela Drive, Sandton", status: "COMPLETED", mat: 4500, lab: 7000, total: 12500, days: 60 },
    { name: "Thandi Mokoena", email: "thandi@mokoena.co.za", phone: "083 555 1002", service: "Electrical Rewiring", addr: "45 Jan Smuts Ave, Rosebank", status: "COMPLETED", mat: 12000, lab: 18000, total: 32000, days: 35 },
    { name: "Johan van der Merwe", email: "johan@vdm.co.za", phone: "061 555 1003", service: "HVAC Maintenance", addr: "78 Rivonia Road, Rivonia", status: "IN_PROGRESS", mat: 6000, lab: 9000, total: 16000, days: 5 },
    { name: "Lerato Molefe", email: "lerato@molefe.co.za", phone: "074 555 1004", service: "Interior Painting", addr: "23 Voortrekker Rd, Bellville", status: "PENDING", mat: 3800, lab: 8000, total: 12500, days: 0 },
    { name: "Nomsa Dlamini", email: "nomsa@dlamini.co.za", phone: "082 555 1007", service: "Carpentry Work", addr: "34 Umhlanga Rocks Drive, Durban", status: "COMPLETED", mat: 5000, lab: 15000, total: 21500, days: 25 },
  ];

  const orders = [];
  for (let i = 0; i < ordersData.length; i++) {
    const od = ordersData[i];
    const order = await prisma.order.create({
      data: {
        orderNumber: uid(),
        customerName: od.name,
        customerEmail: od.email,
        customerPhone: od.phone,
        address: od.addr,
        serviceType: od.service,
        description: `${od.service} - Full scope of work at ${od.addr}`,
        status: od.status,
        assignedToId: contractor.id,
        materialCost: od.mat,
        labourCost: od.lab,
        totalCost: od.total,
        callOutFee: i % 3 === 0 ? 450 : 0,
        createdAt: daysAgo(od.days),
        startTime: od.status !== "PENDING" ? daysAgo(od.days) : null,
        endTime: od.status === "COMPLETED" ? daysAgo(od.days - 7) : null,
      },
    });
    orders.push(order);
  }
  console.log(`  ✅ Created ${orders.length} orders`);

  // 4. QUOTATIONS (contractor-created)
  console.log("📝 Creating quotations...");
  const quotationsData = [
    { name: "Jane Smith", email: "customer@example.com", phone: "065 555 1005", addr: "56 Main Road, Claremont, Cape Town", status: "ACCEPTED", sub: 35000, tax: 5250, mat: 12000, lab: 18000, days: 30 },
    { name: "Jane Smith", email: "customer@example.com", phone: "065 555 1005", addr: "56 Main Road, Claremont, Cape Town", status: "SENT", sub: 15000, tax: 2250, mat: 5000, lab: 8000, days: 5 },
    { name: "Sipho Ndlovu", email: "sipho@ndlovu.co.za", phone: "072 555 1001", addr: "12 Mandela Drive, Sandton", status: "ACCEPTED", sub: 22000, tax: 3300, mat: 8000, lab: 12000, days: 45 },
    { name: "Thandi Mokoena", email: "thandi@mokoena.co.za", phone: "083 555 1002", addr: "45 Jan Smuts Ave, Rosebank", status: "DRAFT", sub: 48000, tax: 7200, mat: 18000, lab: 25000, days: 3 },
    { name: "Johan van der Merwe", email: "johan@vdm.co.za", phone: "061 555 1003", addr: "78 Rivonia Road, Rivonia", status: "SENT", sub: 28000, tax: 4200, mat: 10000, lab: 15000, days: 12 },
    { name: "Lerato Molefe", email: "lerato@molefe.co.za", phone: "074 555 1004", addr: "23 Voortrekker Rd, Bellville", status: "REJECTED", sub: 55000, tax: 8250, mat: 20000, lab: 30000, days: 20 },
    { name: "Pieter Botha", email: "pieter@botha.co.za", phone: "076 555 1006", addr: "101 Church St, Pretoria", status: "ACCEPTED", sub: 18000, tax: 2700, mat: 6000, lab: 10000, days: 40 },
    { name: "Nomsa Dlamini", email: "nomsa@dlamini.co.za", phone: "082 555 1007", addr: "34 Umhlanga Rocks Drive, Durban", status: "SENT", sub: 32000, tax: 4800, mat: 12000, lab: 16000, days: 8 },
  ];

  const quotations = [];
  for (let i = 0; i < quotationsData.length; i++) {
    const qd = quotationsData[i];
    const items = [
      { description: "Materials supply", quantity: 1, unitPrice: qd.mat, total: qd.mat },
      { description: "Labour", quantity: 1, unitPrice: qd.lab, total: qd.lab },
      { description: "Project management fee", quantity: 1, unitPrice: qd.sub - qd.mat - qd.lab, total: qd.sub - qd.mat - qd.lab },
    ];
    const quotation = await prisma.quotation.create({
      data: {
        quoteNumber: uid(),
        customerName: qd.name,
        customerEmail: qd.email,
        customerPhone: qd.phone,
        address: qd.addr,
        items: items,
        subtotal: qd.sub,
        tax: qd.tax,
        total: qd.sub + qd.tax,
        companyMaterialCost: qd.mat,
        companyLabourCost: qd.lab,
        estimatedProfit: qd.sub * 0.25,
        status: qd.status,
        createdById: contractor.id,
        assignedToId: contractor.id,
        createdAt: daysAgo(qd.days),
        validUntil: daysFromNow(30),
        notes: `Quotation for ${qd.name}`,
        projectDescription: `Comprehensive work at ${qd.addr}`,
      },
    });
    quotations.push(quotation);
  }
  console.log(`  ✅ Created ${quotations.length} quotations`);

  // 5. INVOICES (contractor-created, some for customer@example.com)
  console.log("💰 Creating invoices...");
  const invoicesData = [
    { name: "Jane Smith", email: "customer@example.com", phone: "065 555 1005", addr: "56 Main Road, Claremont, Cape Town", status: "PAID", sub: 22000, tax: 3300, days: 40, ordIdx: 0 },
    { name: "Jane Smith", email: "customer@example.com", phone: "065 555 1005", addr: "56 Main Road, Claremont, Cape Town", status: "SENT", sub: 9200, tax: 1380, days: 7, ordIdx: null },
    { name: "Sipho Ndlovu", email: "sipho@ndlovu.co.za", phone: "072 555 1001", addr: "12 Mandela Drive, Sandton", status: "PAID", sub: 12500, tax: 1875, days: 55, ordIdx: 3 },
    { name: "Thandi Mokoena", email: "thandi@mokoena.co.za", phone: "083 555 1002", addr: "45 Jan Smuts Ave, Rosebank", status: "PAID", sub: 32000, tax: 4800, days: 30, ordIdx: 4 },
    { name: "Nomsa Dlamini", email: "nomsa@dlamini.co.za", phone: "082 555 1007", addr: "34 Umhlanga Rocks Drive, Durban", status: "SENT", sub: 21500, tax: 3225, days: 18, ordIdx: 7 },
    { name: "Pieter Botha", email: "pieter@botha.co.za", phone: "076 555 1006", addr: "101 Church St, Pretoria", status: "DRAFT", sub: 18000, tax: 2700, days: 2, ordIdx: null },
  ];

  const invoices = [];
  for (let i = 0; i < invoicesData.length; i++) {
    const inv = invoicesData[i];
    const items = [
      { description: "Materials", quantity: 1, unitPrice: inv.sub * 0.4, total: inv.sub * 0.4 },
      { description: "Labour", quantity: 1, unitPrice: inv.sub * 0.5, total: inv.sub * 0.5 },
      { description: "Management fee", quantity: 1, unitPrice: inv.sub * 0.1, total: inv.sub * 0.1 },
    ];
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: uid(),
        customerName: inv.name,
        customerEmail: inv.email,
        customerPhone: inv.phone,
        address: inv.addr,
        items: items,
        subtotal: inv.sub,
        tax: inv.tax,
        total: inv.sub + inv.tax,
        companyMaterialCost: inv.sub * 0.35,
        companyLabourCost: inv.sub * 0.45,
        estimatedProfit: inv.sub * 0.20,
        status: inv.status,
        createdById: contractor.id,
        createdAt: daysAgo(inv.days),
        dueDate: inv.status === "PAID" ? daysAgo(inv.days - 30) : daysFromNow(30),
        paidDate: inv.status === "PAID" ? daysAgo(inv.days - 15) : null,
        orderId: inv.ordIdx !== null ? orders[inv.ordIdx].id : null,
        projectDescription: `Work completed for ${inv.name}`,
      },
    });
    invoices.push(invoice);
  }
  console.log(`  ✅ Created ${invoices.length} invoices`);

  // 6. PROJECTS (contractor-created)
  console.log("🏗️ Creating projects...");
  const projectsData = [
    { name: "Cape Town Office Renovation", custName: "Jane Smith", email: "customer@example.com", phone: "065 555 1005", addr: "56 Main Road, Claremont, Cape Town", type: "RENOVATION", status: "IN_PROGRESS", budget: 150000, actual: 62000, days: 30 },
    { name: "Sandton Plumbing Overhaul", custName: "Sipho Ndlovu", email: "sipho@ndlovu.co.za", phone: "072 555 1001", addr: "12 Mandela Drive, Sandton", type: "MAINTENANCE", status: "COMPLETED", budget: 85000, actual: 78000, days: 90 },
    { name: "Rosebank Electrical Upgrade", custName: "Thandi Mokoena", email: "thandi@mokoena.co.za", phone: "083 555 1002", addr: "45 Jan Smuts Ave, Rosebank", type: "INSTALLATION", status: "PLANNING", budget: 120000, actual: 0, days: 5 },
  ];

  const projects = [];
  for (let i = 0; i < projectsData.length; i++) {
    const pd = projectsData[i];
    const project = await prisma.project.create({
      data: {
        projectNumber: uid(),
        name: pd.name,
        description: `${pd.name} - Full project scope`,
        customerName: pd.custName,
        customerEmail: pd.email,
        customerPhone: pd.phone,
        address: pd.addr,
        projectType: pd.type,
        status: pd.status,
        assignedToId: contractor.id,
        estimatedBudget: pd.budget,
        actualCost: pd.actual,
        startDate: daysAgo(pd.days),
        endDate: pd.status === "COMPLETED" ? daysAgo(pd.days - 60) : daysFromNow(60),
        createdAt: daysAgo(pd.days + 5),
      },
    });
    projects.push(project);

    // Add milestones to each project
    const milestones = [
      { name: "Site Preparation", seq: 1, status: pd.status === "PLANNING" ? "PLANNING" : "COMPLETED", progress: pd.status === "PLANNING" ? 0 : 100, labCost: pd.budget * 0.1, matCost: pd.budget * 0.05 },
      { name: "Main Works", seq: 2, status: pd.status === "COMPLETED" ? "COMPLETED" : pd.status === "IN_PROGRESS" ? "IN_PROGRESS" : "PLANNING", progress: pd.status === "COMPLETED" ? 100 : pd.status === "IN_PROGRESS" ? 45 : 0, labCost: pd.budget * 0.35, matCost: pd.budget * 0.25 },
      { name: "Finishing & Handover", seq: 3, status: pd.status === "COMPLETED" ? "COMPLETED" : "PLANNING", progress: pd.status === "COMPLETED" ? 100 : 0, labCost: pd.budget * 0.15, matCost: pd.budget * 0.1 },
    ];

    for (const ms of milestones) {
      await prisma.milestone.create({
        data: {
          projectId: project.id,
          name: ms.name,
          description: `${ms.name} for ${pd.name}`,
          sequenceOrder: ms.seq,
          status: ms.status,
          progressPercentage: ms.progress,
          labourCost: ms.labCost,
          materialCost: ms.matCost,
          budgetAllocated: ms.labCost + ms.matCost,
          startDate: daysAgo(pd.days - (ms.seq - 1) * 15),
          endDate: daysFromNow((ms.seq) * 20),
          assignedToId: contractor.id,
        },
      });
    }
  }
  console.log(`  ✅ Created ${projects.length} projects with milestones`);

  // 7. ASSETS
  console.log("🏢 Creating assets...");
  const assetsData = [
    { name: "Hilti Drill Set", cat: "EQUIPMENT", serial: "HLT-2024-001", price: 12500, value: 9800, cond: "Good" },
    { name: "Toyota Hilux (Work Vehicle)", cat: "VEHICLE", serial: "VIN-123456789", price: 385000, value: 310000, cond: "Good" },
    { name: "Scaffolding Set (50m)", cat: "EQUIPMENT", serial: "SCF-2023-045", price: 45000, value: 32000, cond: "Fair" },
    { name: "Generator 5kVA", cat: "EQUIPMENT", serial: "GEN-2024-012", price: 18500, value: 15200, cond: "Good" },
    { name: "Office Computer & Software", cat: "IT_EQUIPMENT", serial: "PC-2024-001", price: 22000, value: 18000, cond: "Excellent" },
  ];
  for (const a of assetsData) {
    await prisma.asset.create({
      data: {
        name: a.name,
        category: a.cat,
        serialNumber: a.serial,
        purchaseDate: daysAgo(365),
        purchasePrice: a.price,
        currentValue: a.value,
        condition: a.cond,
        location: "Johannesburg Office",
        createdById: contractor.id,
        usefulLifeYears: 5,
        depreciationMethod: "STRAIGHT_LINE",
      },
    });
  }
  console.log(`  ✅ Created ${assetsData.length} assets`);

  // 8. LIABILITIES
  console.log("💳 Creating liabilities...");
  const liabilitiesData = [
    { name: "Vehicle Finance - Hilux", cat: "LOAN", amount: 285000, creditor: "Wesbank", isPaid: false },
    { name: "Equipment Lease - Scaffolding", cat: "OTHER", amount: 18000, creditor: "Scaffold SA", isPaid: false },
    { name: "SARS Provisional Tax Q1", cat: "OTHER", amount: 35000, creditor: "SARS", isPaid: true },
    { name: "Supplier Invoice - Mega Hardware", cat: "ACCOUNTS_PAYABLE", amount: 12500, creditor: "Mega Hardware", isPaid: false },
    { name: "Insurance Premium - Liability Cover", cat: "OTHER", amount: 8500, creditor: "Santam", isPaid: true },
  ];
  for (const l of liabilitiesData) {
    await prisma.liability.create({
      data: {
        name: l.name,
        amount: l.amount,
        creditor: l.creditor,
        isPaid: l.isPaid,
        paidDate: l.isPaid ? daysAgo(15) : null,
        dueDate: l.isPaid ? daysAgo(30) : daysFromNow(30),
        createdById: contractor.id,
        description: l.name,
      },
    });
  }
  console.log(`  ✅ Created ${liabilitiesData.length} liabilities`);

  // 9. OPERATIONAL EXPENSES
  console.log("📊 Creating operational expenses...");
  const expensesData = [
    { cat: "PETROL", desc: "Diesel for work vehicles", amount: 4500, vendor: "Engen", days: 5 },
    { cat: "RENT", desc: "Office rent - March 2026", amount: 12000, vendor: "Sandton Office Park", days: 10 },
    { cat: "INSURANCE", desc: "Vehicle insurance premium", amount: 2800, vendor: "Santam", days: 15 },
    { cat: "UTILITIES", desc: "Electricity & water - Office", amount: 3200, vendor: "City of Johannesburg", days: 8 },
    { cat: "MARKETING", desc: "Google Ads campaign", amount: 5500, vendor: "Google", days: 3 },
    { cat: "MAINTENANCE", desc: "Vehicle service - Hilux", amount: 6800, vendor: "Toyota Braamfontein", days: 20 },
    { cat: "OTHER", desc: "PPE equipment purchase", amount: 4200, vendor: "Safety First SA", days: 12 },
    { cat: "PROFESSIONAL_FEES", desc: "Accountant monthly retainer", amount: 3500, vendor: "BDO Accounting", days: 7 },
    { cat: "TELECOMMUNICATIONS", desc: "Cell phone & data contracts", amount: 2400, vendor: "Vodacom", days: 2 },
    { cat: "OTHER", desc: "Safety compliance training", amount: 8500, vendor: "NHBRC", days: 25 },
  ];
  for (const e of expensesData) {
    await prisma.operationalExpense.create({
      data: {
        date: daysAgo(e.days),
        category: e.cat,
        description: e.desc,
        amount: e.amount,
        vendor: e.vendor,
        createdById: contractor.id,
        isApproved: true,
        approvedAt: daysAgo(e.days - 1),
      },
    });
  }
  console.log(`  ✅ Created ${expensesData.length} operational expenses`);

  // 10. ALTERNATIVE REVENUES
  console.log("💵 Creating alternative revenues...");
  const revenuesData = [
    { cat: "RENTAL_INCOME", desc: "Scaffolding rental to Botha Builders", amount: 8500, source: "Botha & Sons", days: 10 },
    { cat: "CONSULTING", desc: "Building inspection consulting fee", amount: 5000, source: "Molefe Holdings", days: 15 },
    { cat: "OTHER", desc: "Subcontract income - Electrical work", amount: 12000, source: "Dlamini Electrical", days: 20 },
    { cat: "OTHER", desc: "Scrap metal sales", amount: 3200, source: "Metro Recycling", days: 8 },
  ];
  for (const r of revenuesData) {
    await prisma.alternativeRevenue.create({
      data: {
        date: daysAgo(r.days),
        category: r.cat,
        description: r.desc,
        amount: r.amount,
        source: r.source,
        createdById: contractor.id,
        isApproved: true,
        approvedAt: daysAgo(r.days - 1),
      },
    });
  }
  console.log(`  ✅ Created ${revenuesData.length} alternative revenues`);

  // 11. CONVERSATIONS (between contractor and customer)
  console.log("💬 Creating conversations...");
  if (customer) {
    const conv1 = await prisma.conversation.create({
      data: {
        participants: { connect: [{ id: contractor.id }, { id: customer.id }] },
      },
    });
    // Add messages
    const messages = [
      { senderId: customer.id, content: "Hi, I'd like to get a quote for my roofing repair. When can you come for an assessment?", daysAgo: 15 },
      { senderId: contractor.id, content: "Good morning Jane! I can come by on Thursday morning. Would 9am work for you?", daysAgo: 15 },
      { senderId: customer.id, content: "Thursday 9am is perfect. The address is 56 Main Road, Claremont.", daysAgo: 14 },
      { senderId: contractor.id, content: "Great, I'll be there. I'll bring our roofing specialist to assess the damage.", daysAgo: 14 },
      { senderId: contractor.id, content: "Hi Jane, we've completed the assessment. I'll send through a detailed quotation by end of day.", daysAgo: 12 },
      { senderId: customer.id, content: "Thank you for the quick turnaround! Looking forward to the quote.", daysAgo: 12 },
      { senderId: contractor.id, content: "Quotation sent! Please review and let me know if you have any questions.", daysAgo: 11 },
      { senderId: customer.id, content: "I've reviewed it and I'm happy with the price. Please proceed with the work.", daysAgo: 10 },
      { senderId: contractor.id, content: "Excellent! We'll start next Monday. The team will arrive at 7:30am.", daysAgo: 10 },
      { senderId: customer.id, content: "How is the roofing work progressing? Any updates?", daysAgo: 3 },
      { senderId: contractor.id, content: "Going well! We're about 60% done. Should be completed by Friday. I'll send photos.", daysAgo: 3 },
      { senderId: customer.id, content: "That's great news! Thank you for keeping me updated.", daysAgo: 2 },
    ];
    for (const msg of messages) {
      await prisma.message.create({
        data: {
          conversationId: conv1.id,
          senderId: msg.senderId,
          content: msg.content,
          createdAt: daysAgo(msg.daysAgo),
          readBy: [msg.senderId],
        },
      });
    }
    console.log(`  ✅ Created conversation with ${messages.length} messages`);

    // Second conversation with admin
    if (admin) {
      const conv2 = await prisma.conversation.create({
        data: {
          participants: { connect: [{ id: customer.id }, { id: admin.id }] },
        },
      });
      const adminMessages = [
        { senderId: customer.id, content: "Hello, I need help with my account settings. Can you assist?", daysAgo: 7 },
        { senderId: admin.id, content: "Of course! What do you need help with?", daysAgo: 7 },
        { senderId: customer.id, content: "I'd like to update my contact number. The new number is 065 555 9999.", daysAgo: 6 },
        { senderId: admin.id, content: "Done! I've updated your contact number in the system.", daysAgo: 6 },
        { senderId: customer.id, content: "Thank you for the quick response!", daysAgo: 6 },
      ];
      for (const msg of adminMessages) {
        await prisma.message.create({
          data: {
            conversationId: conv2.id,
            senderId: msg.senderId,
            content: msg.content,
            createdAt: daysAgo(msg.daysAgo),
            readBy: [msg.senderId],
          },
        });
      }
      console.log(`  ✅ Created admin-customer conversation with ${adminMessages.length} messages`);
    }
  }

  // 12. STATEMENTS (for customer@example.com)
  console.log("📄 Creating statements...");
  const statementsData = [
    {
      period: "January 2026",
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-01-31"),
      invoiceDetails: [
        { invoice_number: invoices[0] ? invoices[0].invoiceNumber : "INV-001", description: "Roofing Repair", amount: 25300, status: "PAID" },
      ],
      subtotal: 25300,
      totalDue: 0,
      paymentsReceived: 25300,
      status: "sent",
      days: 45,
    },
    {
      period: "February 2026",
      periodStart: new Date("2026-02-01"),
      periodEnd: new Date("2026-02-28"),
      invoiceDetails: [
        { invoice_number: invoices[1] ? invoices[1].invoiceNumber : "INV-002", description: "Gutter Installation", amount: 10580, status: "SENT" },
      ],
      subtotal: 10580,
      totalDue: 10580,
      paymentsReceived: 0,
      status: "sent",
      days: 15,
    },
    {
      period: "March 2026",
      periodStart: new Date("2026-03-01"),
      periodEnd: new Date("2026-03-31"),
      invoiceDetails: [
        { invoice_number: invoices[1] ? invoices[1].invoiceNumber : "INV-002", description: "Gutter Installation (Outstanding)", amount: 10580, status: "SENT" },
      ],
      subtotal: 10580,
      totalDue: 10580,
      paymentsReceived: 0,
      previous_balance: 10580,
      status: "generated",
      days: 1,
    },
  ];

  for (const sd of statementsData) {
    await prisma.statement.create({
      data: {
        statement_number: uid(),
        client_email: "customer@example.com",
        client_name: "Jane Smith",
        customerPhone: "065 555 1005",
        address: "56 Main Road, Claremont, Cape Town, 7708",
        statement_date: daysAgo(sd.days),
        period_start: sd.periodStart,
        period_end: sd.periodEnd,
        invoice_details: sd.invoiceDetails,
        age_analysis: { current: sd.totalDue, days_31_60: 0, days_61_90: 0, days_91_120: 0, over_120: 0 },
        subtotal: sd.subtotal,
        total_amount_due: sd.totalDue,
        payments_received: sd.paymentsReceived,
        previous_balance: sd.previous_balance || 0,
        status: sd.status,
      },
    });
  }
  console.log(`  ✅ Created ${statementsData.length} statements`);

  // 13. EMPLOYEES (contractor-owned artisan employees)
  console.log("👥 Creating contractor employees...");
  const employeesData = [
    { first: "Thabo", last: "Mabena", email: "thabo.mabena@contractor-demo.com", phone: "072 111 2001", role: "ARTISAN", hourly: 150, daily: 1200 },
    { first: "Sifiso", last: "Ngcobo", email: "sifiso.ngcobo@contractor-demo.com", phone: "083 111 2002", role: "ARTISAN", hourly: 120, daily: 960 },
    { first: "Anita", last: "Rossouw", email: "anita.rossouw@contractor-demo.com", phone: "061 111 2003", role: "ARTISAN", hourly: 180, daily: 1440 },
  ];

  for (const emp of employeesData) {
    // Check if employee already exists
    const existing = await prisma.user.findUnique({ where: { email: emp.email } });
    if (!existing) {
      await prisma.user.create({
        data: {
          email: emp.email,
          password: "$2a$10$dummyhashedpassword1234567890abcdefghijk", // placeholder
          firstName: emp.first,
          lastName: emp.last,
          phone: emp.phone,
          role: emp.role,
          hourlyRate: emp.hourly,
          dailyRate: emp.daily,
          employerId: contractor.id,
        },
      });
      console.log(`  ✅ Employee: ${emp.first} ${emp.last}`);
    } else {
      console.log(`  ⏭️ Employee ${emp.email} already exists`);
    }
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log("\n✅ Demo data seeding complete!");
  console.log("\n📊 Summary:");
  console.log(`  Clients: ${clientsData.length}`);
  console.log(`  Leads: ${leadsData.length}`);
  console.log(`  Orders: ${ordersData.length} (3 for customer@example.com)`);
  console.log(`  Quotations: ${quotationsData.length} (2 for customer@example.com)`);
  console.log(`  Invoices: ${invoicesData.length} (2 for customer@example.com)`);
  console.log(`  Projects: ${projectsData.length} (1 for customer@example.com)`);
  console.log(`  Assets: ${assetsData.length}`);
  console.log(`  Liabilities: ${liabilitiesData.length}`);
  console.log(`  Operational Expenses: ${expensesData.length}`);
  console.log(`  Alternative Revenues: ${revenuesData.length}`);
  console.log(`  Statements: ${statementsData.length} (for customer@example.com)`);
  console.log(`  Employees: ${employeesData.length}`);
  console.log(`  Conversations: 2 (contractor-customer, admin-customer)`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
