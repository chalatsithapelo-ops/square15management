const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findQuotations() {
  try {
    console.log('Searching for quotations...\n');
    
    const quotations = await prisma.quotation.findMany({
      include: {
        lead: {
          select: {
            customerName: true,
            customerEmail: true,
            customerPhone: true
          }
        },
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        },
        assignedTo: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`Found ${quotations.length} total quotations:\n`);
    
    quotations.forEach((q) => {
      console.log(`ID: ${q.id}`);
      console.log(`Quote Number: ${q.quoteNumber}`);
      console.log(`Status: ${q.status}`);
      console.log(`Customer: ${q.lead?.customerName || 'N/A'} (${q.lead?.customerEmail || 'N/A'})`);
      console.log(`Created By: ${q.createdBy ? `${q.createdBy.firstName} ${q.createdBy.lastName} (${q.createdBy.email}, ${q.createdBy.role})` : 'NULL'}`);
      console.log(`Created By ID: ${q.createdById}`);
      console.log(`Assigned To: ${q.assignedTo ? `${q.assignedTo.firstName} ${q.assignedTo.lastName} (${q.assignedTo.email}, ${q.assignedTo.role})` : 'N/A'}`);
      console.log(`Total Amount: R${q.totalAmount || 0}`);
      console.log(`Created At: ${q.createdAt}`);
      console.log('---');
    });
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

findQuotations();
