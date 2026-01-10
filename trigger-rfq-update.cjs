const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function triggerRFQUpdate() {
  try {
    console.log('=== Triggering RFQ Update ===\n');
    
    // Find the quotation that was sent to customer
    const quotation = await prisma.quotation.findFirst({
      where: {
        quoteNumber: 'QUO-00003',
        status: 'SENT_TO_CUSTOMER'
      }
    });

    if (!quotation) {
      console.log('❌ Quotation QUO-00003 not found or not in SENT_TO_CUSTOMER status');
      return;
    }

    console.log(`✓ Found quotation: ${quotation.quoteNumber}`);
    console.log(`  Status: ${quotation.status}`);
    console.log(`  Customer Email: ${quotation.customerEmail}\n`);

    // Find the matching PropertyManagerRFQ
    const relatedRFQ = await prisma.propertyManagerRFQ.findFirst({
      where: {
        propertyManager: {
          email: quotation.customerEmail
        },
        status: {
          in: ['SUBMITTED', 'UNDER_REVIEW']
        }
      },
      include: {
        propertyManager: {
          select: {
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!relatedRFQ) {
      console.log(`❌ No matching PropertyManagerRFQ found for email: ${quotation.customerEmail}`);
      console.log('   Looking for RFQs with status: SUBMITTED or UNDER_REVIEW');
      return;
    }

    console.log(`✓ Found matching RFQ:`);
    console.log(`  ID: ${relatedRFQ.id}`);
    console.log(`  Title: ${relatedRFQ.title}`);
    console.log(`  Property Manager: ${relatedRFQ.propertyManager.firstName} ${relatedRFQ.propertyManager.lastName}`);
    console.log(`  Current Status: ${relatedRFQ.status}\n`);

    // Update the RFQ to RECEIVED
    const updatedRFQ = await prisma.propertyManagerRFQ.update({
      where: {
        id: relatedRFQ.id
      },
      data: {
        status: 'RECEIVED',
        quotedDate: new Date()
      }
    });

    console.log(`✓ Successfully updated RFQ to RECEIVED`);
    console.log(`  New Status: ${updatedRFQ.status}`);
    console.log(`  Quoted Date: ${updatedRFQ.quotedDate}\n`);

    console.log('=== Update Complete ===');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

triggerRFQUpdate();
