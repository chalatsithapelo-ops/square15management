const { PrismaClient } = require("./node_modules/.prisma/client");
const db = new PrismaClient();

(async () => {
  try {
    const emails = [
      "contractor@propmanagement.com",
      "customer@example.com",
      "artisan@propmanagement.com",
      "pm@propmanagement.com",
      "admin@propmanagement.com",
      "junior@propmanagement.com",
    ];

    for (const email of emails) {
      const u = await db.user.findFirst({
        where: { email },
        select: { id: true, email: true, role: true, firstName: true },
      });
      console.log(u ? JSON.stringify(u) : "NOT FOUND: " + email);
    }

    // Check contractor data
    const c = await db.user.findFirst({ where: { email: "contractor@propmanagement.com" } });
    if (c) {
      const leads = await db.lead.count({ where: { assignedToId: c.id } });
      const orders = await db.order.count({ where: { assignedToId: c.id } });
      const quotations = await db.quotation.count({ where: { createdById: c.id } });
      const invoices = await db.invoice.count({ where: { createdById: c.id } });
      const projects = await db.project.count({ where: { assignedToId: c.id } });
      const clients = await db.client.count({ where: { createdById: c.id } });
      const employees = await db.employee.count({ where: { createdById: c.id } });
      const assets = await db.asset.count({ where: { createdById: c.id } });
      const liabilities = await db.liability.count({ where: { createdById: c.id } });
      const opExpenses = await db.operationalExpense.count({ where: { createdById: c.id } });
      console.log("CONTRACTOR DATA:", JSON.stringify({ leads, orders, quotations, invoices, projects, clients, employees, assets, liabilities, opExpenses }));
    }

    // Check customer data
    const cu = await db.user.findFirst({ where: { email: "customer@example.com" } });
    if (cu) {
      const orders = await db.order.count({ where: { customerId: cu.id } });
      const quotations = await db.quotation.count({ where: { customerId: cu.id } });
      const invoices = await db.invoice.count({ where: { customerId: cu.id } });
      const projects = await db.project.count({ where: { customerId: cu.id } });
      const conversations = await db.conversation.count({ where: { OR: [{ senderId: cu.id }, { recipientId: cu.id }] } });
      const statements = await db.statement.count({ where: { customerId: cu.id } });
      console.log("CUSTOMER DATA:", JSON.stringify({ orders, quotations, invoices, projects, conversations, statements }));
    }

  } catch (e) {
    console.error(e);
  } finally {
    await db.$disconnect();
  }
})();
