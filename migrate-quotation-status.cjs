const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateQuotationStatus() {
  try {
    console.log('Starting migration of quotation statuses...');
    
    // Update READY_FOR_REVIEW to PENDING_JUNIOR_MANAGER_REVIEW
    const result = await prisma.$executeRaw`
      UPDATE "Quotation" 
      SET status = 'PENDING_JUNIOR_MANAGER_REVIEW' 
      WHERE status = 'READY_FOR_REVIEW'
    `;
    
    console.log(`✓ Updated ${result} quotations from READY_FOR_REVIEW to PENDING_JUNIOR_MANAGER_REVIEW`);
    
    await prisma.$disconnect();
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

migrateQuotationStatus();
