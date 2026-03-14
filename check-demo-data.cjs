const { PrismaClient } = require("./node_modules/.prisma/client");
const db = new PrismaClient();

(async () => {
  try {
    // Get demo accounts
    const demos = await db.user.findMany({
      where: { email: { contains: "demo" } },
      select: { id: true, email: true, role: true, firstName: true, lastName: true },
    });
    console.log("DEMO ACCOUNTS:", JSON.stringify(demos, null, 2));

    // Check contractor demo data
    const contractor = demos.find((d) => d.role === "CONTRACTOR");
    if (contractor) {
      const leads = await db.lead.count({ where: { assignedToId: contractor.id } });
      const orders = await db.order.count({ where: { assignedToId: contractor.id } });
      const quotations = await db.quotation.count({ where: { createdById: contractor.id } });
      const invoices = await db.invoice.count({ where: { createdById: contractor.id } });
      const projects = await db.project.count({ where: { assignedToId: contractor.id } });
      const clients = await db.client.count({ where: { createdById: contractor.id } });
      const employees = await db.employee.count({ where: { createdById: contractor.id } });
      const assets = await db.asset.count({ where: { createdById: contractor.id } });
      const liabilities = await db.liability.count({ where: { createdById: contractor.id } });
      const opExpenses = await db.operationalExpense.count({ where: { createdById: contractor.id } });
      console.log("CONTRACTOR DATA:", JSON.stringify({ leads, orders, quotations, invoices, projects, clients, employees, assets, liabilities, opExpenses }));
    } else {
      console.log("NO CONTRACTOR DEMO ACCOUNT FOUND");
    }

    // Check customer demo data
    const customer = demos.find((d) => d.role === "CUSTOMER");
    if (customer) {
      const orders = await db.order.count({ where: { customerId: customer.id } });
      const quotations = await db.quotation.count({ where: { customerId: customer.id } });
      const invoices = await db.invoice.count({ where: { customerId: customer.id } });
      const projects = await db.project.count({ where: { OR: [{ customerId: customer.id }] } });
      const conversations = await db.conversation.count({ where: { OR: [{ senderId: customer.id }, { recipientId: customer.id }] } });
      const statements = await db.statement.count({ where: { customerId: customer.id } });
      console.log("CUSTOMER DATA:", JSON.stringify({ orders, quotations, invoices, projects, conversations, statements }));
    } else {
      console.log("NO CUSTOMER DEMO ACCOUNT FOUND");
    }

    // Check artisan
    const artisan = demos.find((d) => d.role === "ARTISAN");
    if (artisan) {
      const orders = await db.order.count({ where: { artisanId: artisan.id } });
      console.log("ARTISAN:", artisan.email, "orders:", orders);
    }

    // Check PM
    const pm = demos.find((d) => d.role === "PROPERTY_MANAGER");
    if (pm) {
      const orders = await db.order.count({ where: { assignedToId: pm.id } });
      console.log("PM:", pm.email, "orders:", orders);
    }

  } catch (e) {
    console.error(e);
  } finally {
    await db.$disconnect();
  }
})();
