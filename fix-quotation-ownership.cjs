const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixQuotationOwnership() {
  try {
    console.log('Finding contractor users...\n');
    
    // Find contractor users
    const contractorUsers = await prisma.user.findMany({
      where: {
        role: {
          in: ['CONTRACTOR', 'CONTRACTOR_SENIOR_MANAGER', 'CONTRACTOR_JUNIOR_MANAGER']
        }
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true
      }
    });
    
    console.log('Contractor users found:');
    contractorUsers.forEach(u => {
      console.log(`  ID: ${u.id}, ${u.firstName} ${u.lastName} (${u.email}) - ${u.role}`);
    });
    
    // Use the first contractor user (or you can choose a specific one)
    const contractorUser = contractorUsers.find(u => u.role === 'CONTRACTOR') || contractorUsers[0];
    
    if (!contractorUser) {
      console.log('\nNo contractor users found!');
      await prisma.$disconnect();
      return;
    }
    
    console.log(`\nAssigning quotations to: ${contractorUser.firstName} ${contractorUser.lastName} (ID: ${contractorUser.id})\n`);
    
    // Update quotations with null createdById
    const result = await prisma.quotation.updateMany({
      where: {
        createdById: null
      },
      data: {
        createdById: contractorUser.id
      }
    });
    
    console.log(`✓ Updated ${result.count} quotations to have createdById = ${contractorUser.id}`);
    
    // Show updated quotations
    const updatedQuotations = await prisma.quotation.findMany({
      where: {
        createdById: contractorUser.id
      },
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        createdById: true
      }
    });
    
    console.log('\nUpdated quotations:');
    updatedQuotations.forEach(q => {
      console.log(`  ${q.quoteNumber}: ${q.status} (createdById: ${q.createdById})`);
    });
    
    await prisma.$disconnect();
    console.log('\n✓ Quotation ownership fixed successfully!');
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

fixQuotationOwnership();
