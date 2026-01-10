const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkRFQs() {
  try {
    console.log('=== Checking PropertyManagerRFQs ===\n');
    
    const rfqs = await prisma.propertyManagerRFQ.findMany({
      include: {
        propertyManager: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Total RFQs found: ${rfqs.length}\n`);
    
    rfqs.forEach(rfq => {
      console.log(`ID: ${rfq.id}`);
      console.log(`Property Manager: ${rfq.propertyManager.firstName} ${rfq.propertyManager.lastName} (${rfq.propertyManager.email})`);
      console.log(`Status: ${rfq.status}`);
      console.log(`Title: ${rfq.title}`);
      console.log(`Created: ${rfq.createdAt}`);
      console.log(`Quoted Date: ${rfq.quotedDate}`);
      console.log('---\n');
    });

    console.log('\n=== Checking Quotations ===\n');
    
    const quotations = await prisma.quotation.findMany({
      select: {
        quoteNumber: true,
        status: true,
        customerEmail: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Total Quotations found: ${quotations.length}\n`);
    
    quotations.forEach(q => {
      console.log(`Quote: ${q.quoteNumber}`);
      console.log(`Status: ${q.status}`);
      console.log(`Customer Email: ${q.customerEmail}`);
      console.log(`Created: ${q.createdAt}`);
      console.log('---\n');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRFQs();
