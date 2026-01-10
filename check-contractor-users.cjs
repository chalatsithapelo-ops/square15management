const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkContractorUsers() {
  try {
    console.log('Checking contractor company users...\n');
    
    // Find all contractor users
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
        role: true,
        contractorCompanyName: true
      },
      orderBy: {
        id: 'asc'
      }
    });
    
    console.log('Contractor users found:');
    contractorUsers.forEach(u => {
      console.log(`  ID: ${u.id}, ${u.firstName} ${u.lastName} (${u.email})`);
      console.log(`    Role: ${u.role}`);
      console.log(`    Company: ${u.contractorCompanyName || 'N/A'}`);
      console.log('');
    });
    
    console.log('\n--- Quotations owned by contractor users ---\n');
    
    // Get quotations created by contractor users
    const quotations = await prisma.quotation.findMany({
      where: {
        createdById: {
          in: contractorUsers.map(u => u.id)
        }
      },
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        createdById: true,
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        id: 'asc'
      }
    });
    
    quotations.forEach(q => {
      console.log(`${q.quoteNumber}: ${q.status}`);
      console.log(`  Created By: ${q.createdBy.firstName} ${q.createdBy.lastName} (ID: ${q.createdById})`);
      console.log('');
    });
    
    console.log('\n--- Checking getQuotations filtering logic ---\n');
    
    // Simulate what getQuotations does
    const seniorManager = contractorUsers.find(u => u.email === 'thapelochalatsi@square15.co.za');
    if (seniorManager) {
      console.log(`Senior Manager: ${seniorManager.firstName} ${seniorManager.lastName} (ID: ${seniorManager.id})`);
      console.log(`Company: ${seniorManager.contractorCompanyName}`);
      
      // Get all users in same company
      const companyUsers = contractorUsers.filter(u => 
        u.contractorCompanyName === seniorManager.contractorCompanyName
      );
      
      console.log(`\nUsers in same company (${seniorManager.contractorCompanyName}):`);
      companyUsers.forEach(u => {
        console.log(`  - ${u.firstName} ${u.lastName} (ID: ${u.id})`);
      });
      
      const ids = companyUsers.map(u => u.id);
      console.log(`\nIDs to filter by: [${ids.join(', ')}]`);
      
      // Check if quotations match this filter
      const matchingQuotations = quotations.filter(q => ids.includes(q.createdById));
      console.log(`\nQuotations that would appear for this user:`);
      matchingQuotations.forEach(q => {
        console.log(`  ${q.quoteNumber}: ${q.status} (createdById: ${q.createdById})`);
      });
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkContractorUsers();
