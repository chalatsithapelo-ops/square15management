const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function reassignToSeniorManager() {
  try {
    // Find the senior manager
    const seniorManager = await prisma.user.findFirst({
      where: {
        email: 'thapelochalatsi@square15.co.za'
      }
    });
    
    if (!seniorManager) {
      console.log('Senior manager not found!');
      await prisma.$disconnect();
      return;
    }
    
    console.log(`Reassigning quotations to: ${seniorManager.firstName} ${seniorManager.lastName} (ID: ${seniorManager.id})\n`);
    
    // Update all quotations to be owned by senior manager
    const result = await prisma.quotation.updateMany({
      where: {},
      data: {
        createdById: seniorManager.id
      }
    });
    
    console.log(`✓ Updated ${result.count} quotations to have createdById = ${seniorManager.id}`);
    
    // Show updated quotations
    const updatedQuotations = await prisma.quotation.findMany({
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        createdById: true
      },
      orderBy: {
        id: 'asc'
      }
    });
    
    console.log('\nUpdated quotations:');
    updatedQuotations.forEach(q => {
      console.log(`  ${q.quoteNumber}: ${q.status} (createdById: ${q.createdById})`);
    });
    
    await prisma.$disconnect();
    console.log('\n✓ All quotations now assigned to senior manager!');
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

reassignToSeniorManager();
