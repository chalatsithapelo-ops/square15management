import { PrismaClient, PackageType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding packages...');

  // Contractor Packages
  const contractorPackages = [
    {
      name: 'S1',
      displayName: 'Starter Package',
      description: 'Basic package with Quotations, Invoices, and Statements',
      type: PackageType.CONTRACTOR,
      basePrice: 195,
      additionalUserPrice: 100,
      hasQuotations: true,
      hasInvoices: true,
      hasStatements: true,
      trialDays: 0,
    },
    {
      name: 'S2',
      displayName: 'Operations Package',
      description: 'S1 features plus Operations Management',
      type: PackageType.CONTRACTOR,
      basePrice: 350,
      additionalUserPrice: 100,
      hasQuotations: true,
      hasInvoices: true,
      hasStatements: true,
      hasOperations: true,
      trialDays: 0,
    },
    {
      name: 'S3',
      displayName: 'Payments Package',
      description: 'S2 features plus Payments Management',
      type: PackageType.CONTRACTOR,
      basePrice: 400,
      additionalUserPrice: 100,
      hasQuotations: true,
      hasInvoices: true,
      hasStatements: true,
      hasOperations: true,
      hasPayments: true,
      trialDays: 0,
    },
    {
      name: 'S4',
      displayName: 'Professional Package',
      description: 'S3 features plus CRM and Project Management',
      type: PackageType.CONTRACTOR,
      basePrice: 450,
      additionalUserPrice: 100,
      hasQuotations: true,
      hasInvoices: true,
      hasStatements: true,
      hasOperations: true,
      hasPayments: true,
      hasCRM: true,
      hasProjectManagement: true,
      trialDays: 0,
    },
    {
      name: 'S5',
      displayName: 'Business Package',
      description: 'S4 features plus Assets, HR, and Messages',
      type: PackageType.CONTRACTOR,
      basePrice: 600,
      additionalUserPrice: 100,
      hasQuotations: true,
      hasInvoices: true,
      hasStatements: true,
      hasOperations: true,
      hasPayments: true,
      hasCRM: true,
      hasProjectManagement: true,
      hasAssets: true,
      hasHR: true,
      hasMessages: true,
      trialDays: 0,
    },
    {
      name: 'S6',
      displayName: 'Enterprise Package',
      description: 'Full system access including AI Agent and AI Insights',
      type: PackageType.CONTRACTOR,
      basePrice: 650,
      additionalUserPrice: 100,
      hasQuotations: true,
      hasInvoices: true,
      hasStatements: true,
      hasOperations: true,
      hasPayments: true,
      hasCRM: true,
      hasProjectManagement: true,
      hasAssets: true,
      hasHR: true,
      hasMessages: true,
      hasAIAgent: true,
      hasAIInsights: true,
      trialDays: 30, // 30-day free trial
    },
  ];

  // Property Manager Packages
  const propertyManagerPackages = [
    {
      name: 'PM1',
      displayName: 'Property Manager Standard',
      description: 'Full system access without AI features',
      type: PackageType.PROPERTY_MANAGER,
      basePrice: 2500,
      additionalUserPrice: 950,
      additionalTenantPrice: 50,
      hasQuotations: true,
      hasInvoices: true,
      hasStatements: true,
      hasOperations: true,
      hasPayments: true,
      hasCRM: true,
      hasProjectManagement: true,
      hasAssets: true,
      hasHR: true,
      hasMessages: true,
      trialDays: 0,
    },
    {
      name: 'PM2',
      displayName: 'Property Manager Premium',
      description: 'Full system access including AI Agent and AI Insights',
      type: PackageType.PROPERTY_MANAGER,
      basePrice: 3500,
      additionalUserPrice: 950,
      additionalTenantPrice: 50,
      hasQuotations: true,
      hasInvoices: true,
      hasStatements: true,
      hasOperations: true,
      hasPayments: true,
      hasCRM: true,
      hasProjectManagement: true,
      hasAssets: true,
      hasHR: true,
      hasMessages: true,
      hasAIAgent: true,
      hasAIInsights: true,
      trialDays: 30, // 30-day free trial
    },
  ];

  // Upsert all packages
  for (const pkg of [...contractorPackages, ...propertyManagerPackages]) {
    await prisma.package.upsert({
      where: { name: pkg.name },
      update: pkg,
      create: pkg,
    });
    console.log(`✅ Package ${pkg.name} (${pkg.displayName}) created/updated`);
  }

  console.log('✅ Package seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding packages:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
