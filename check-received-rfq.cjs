const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkReceivedRFQ() {
  try {
    console.log('=== Checking RECEIVED RFQ and Related Quotation ===\n');
    
    // Find the RECEIVED RFQ
    const rfq = await prisma.propertyManagerRFQ.findFirst({
      where: { status: 'RECEIVED' },
      include: {
        propertyManager: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    if (!rfq) {
      console.log('❌ No RECEIVED RFQ found');
      return;
    }

    console.log(`✓ Found RECEIVED RFQ:`);
    console.log(`  ID: ${rfq.id}`);
    console.log(`  RFQ Number: ${rfq.rfqNumber}`);
    console.log(`  Title: ${rfq.title}`);
    console.log(`  Property Manager: ${rfq.propertyManager.email}`);
    console.log(`  Status: ${rfq.status}`);
    console.log(`  Quoted Date: ${rfq.quotedDate}\n`);

    // Find the related quotation
    const quotation = await prisma.quotation.findFirst({
      where: {
        customerEmail: rfq.propertyManager.email,
        status: 'SENT_TO_CUSTOMER'
      },
      include: {
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            contractorCompanyName: true,
          }
        }
      }
    });

    if (!quotation) {
      console.log('❌ No related quotation found');
      return;
    }

    console.log(`✓ Found Related Quotation:`);
    console.log(`  Quote Number: ${quotation.quoteNumber}`);
    console.log(`  Status: ${quotation.status}`);
    console.log(`  Customer Email: ${quotation.customerEmail}`);
    console.log(`  Total: R${quotation.total.toLocaleString()}`);
    console.log(`  Created By: ${quotation.createdBy?.firstName} ${quotation.createdBy?.lastName} (${quotation.createdBy?.email})`);
    console.log(`  Company: ${quotation.createdBy?.contractorCompanyName || 'N/A'}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkReceivedRFQ();
