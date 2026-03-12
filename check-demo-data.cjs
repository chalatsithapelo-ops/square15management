const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    const users = await p.user.findMany({
      where: {
        email: {
          in: [
            'admin@propmanagement.com',
            'junior@propmanagement.com',
            'pm@propmanagement.com',
            'artisan@propmanagement.com',
            'contractor@propmanagement.com',
            'customer@example.com',
          ],
        },
      },
      select: { id: true, email: true, role: true },
    });
    console.log('DEMO USERS:', JSON.stringify(users, null, 2));

    const leadCount = await p.lead.count();
    const orderCount = await p.order.count();
    const invoiceCount = await p.invoice.count();
    const quotationCount = await p.quotation.count();
    const projectCount = await p.project.count();
    const clientCount = await p.client.count();
    const assetCount = await p.asset.count();
    const buildingCount = await p.building.count();
    const notifCount = await p.notification.count();
    const campaignCount = await p.campaign.count();
    const pmTaskCount = await p.pMTask.count();
    const staffCount = await p.staffMember.count();
    const tenantCount = await p.propertyManagerCustomer.count();

    console.log('TOTAL COUNTS:', JSON.stringify({
      leadCount, orderCount, invoiceCount, quotationCount,
      projectCount, clientCount, assetCount, buildingCount,
      notifCount, campaignCount, pmTaskCount, staffCount, tenantCount
    }, null, 2));

    // Check demo-specific data
    const demoLeads = await p.lead.findMany({
      where: { customerEmail: { contains: 'demo.co.za' } },
      take: 5,
      select: { id: true, customerName: true, createdById: true, status: true },
    });
    console.log('DEMO LEADS (demo.co.za):', JSON.stringify(demoLeads, null, 2));

    // Check admin's data
    const adminUser = users.find((u) => u.email === 'admin@propmanagement.com');
    if (adminUser) {
      const adminLeads = await p.lead.count({ where: { createdById: adminUser.id } });
      const adminInvoices = await p.invoice.count({ where: { createdById: adminUser.id } });
      const adminQuotations = await p.quotation.count({ where: { createdById: adminUser.id } });
      console.log('ADMIN DATA:', JSON.stringify({ adminLeads, adminInvoices, adminQuotations }));
    }

    // Check PM's data
    const pmUser = users.find((u) => u.email === 'pm@propmanagement.com');
    if (pmUser) {
      const pmBuildings = await p.building.count({ where: { propertyManagerId: pmUser.id } });
      const pmTenants = await p.propertyManagerCustomer.count({ where: { propertyManagerId: pmUser.id } });
      const pmTasks = await p.pMTask.count({ where: { propertyManagerId: pmUser.id } });
      console.log('PM DATA:', JSON.stringify({ pmBuildings, pmTenants, pmTasks }));
    }

    // Check artisan's data
    const artisanUser = users.find((u) => u.email === 'artisan@propmanagement.com');
    if (artisanUser) {
      const artisanOrders = await p.order.count({ where: { assignedToId: artisanUser.id } });
      const artisanJobs = await p.jobActivity.count({ where: { artisanId: artisanUser.id } });
      const artisanPayReqs = await p.paymentRequest.count({ where: { artisanId: artisanUser.id } });
      console.log('ARTISAN DATA:', JSON.stringify({ artisanOrders, artisanJobs, artisanPayReqs }));
    }

  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await p.$disconnect();
  }
})();
