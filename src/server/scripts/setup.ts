import { config as dotenvConfig } from "dotenv";
import { join } from "path";

// Load environment variables FIRST before any other imports
// Use process.cwd() to get the project root directory
dotenvConfig({ path: join(process.cwd(), '.env') });

import { minioClient } from "~/server/minio";
import { db } from "~/server/db";
import bcryptjs from "bcryptjs";
import { env } from "~/server/env";
import { exec as execCallback } from "child_process";
import { promisify } from "util";
import { getCompanyDetails } from "~/server/utils/company-details";
import { clearPermissionsCache } from "~/server/utils/permissions";
import { createMonthlySalaryPayments } from "./create-monthly-salary-payments";
import { getBaseUrl } from "~/server/utils/base-url";
import { seedRFQWorkflow } from "./seed-rfq-workflow";

const exec = promisify(execCallback);

// Utility function to sleep for a given number of milliseconds
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry a function with exponential backoff
async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    operationName?: string;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 10,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    operationName = "operation",
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        console.error(`${operationName} failed after ${maxAttempts} attempts:`, lastError);
        throw lastError;
      }

      console.warn(
        `${operationName} failed (attempt ${attempt}/${maxAttempts}):`,
        lastError.message
      );
      console.log(`Retrying in ${delay}ms...`);

      await sleep(delay);
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  throw lastError;
}

// Sync company details from environment variables to database
async function syncCompanyDetailsToDatabase() {
  console.log("Syncing company details from environment to database...");
  
  const companySettings = [
    { key: "company_name", value: env.COMPANY_NAME },
    { key: "company_address_line1", value: env.COMPANY_ADDRESS_LINE1 },
    { key: "company_address_line2", value: env.COMPANY_ADDRESS_LINE2 },
    { key: "company_phone", value: env.COMPANY_PHONE },
    { key: "company_email", value: env.COMPANY_EMAIL },
    { key: "company_vat_number", value: env.COMPANY_VAT_NUMBER },
    { key: "company_bank_name", value: env.COMPANY_BANK_NAME },
    { key: "company_bank_account_name", value: env.COMPANY_BANK_ACCOUNT_NAME },
    { key: "company_bank_account_number", value: env.COMPANY_BANK_ACCOUNT_NUMBER },
    { key: "company_bank_branch_code", value: env.COMPANY_BANK_BRANCH_CODE },
    { key: "invoice_prefix", value: env.COMPANY_INVOICE_PREFIX },
    { key: "order_prefix", value: env.COMPANY_ORDER_PREFIX },
    { key: "quotation_prefix", value: env.COMPANY_QUOTATION_PREFIX },
  ];
  
  for (const setting of companySettings) {
    await db.systemSettings.upsert({
      where: { key: setting.key },
      create: {
        key: setting.key,
        value: setting.value,
      },
      update: {
        value: setting.value,
      },
    });
  }
  
  console.log("✓ Company details synced successfully");
  console.log(`  - Company Email: ${env.COMPANY_EMAIL}`);
}

// Reset role permissions to default configuration
async function resetRolePermissionsToDefaults() {
  console.log("Checking role permissions configuration...");
  
  try {
    // Check if dynamic role permissions exist
    const dynamicConfig = await db.systemSettings.findUnique({
      where: { key: "role_permissions_config" },
    });
    
    if (dynamicConfig) {
      console.log("⚠ Dynamic role permissions configuration found - resetting to defaults...");
      
      // Delete the dynamic configuration to restore defaults
      await db.systemSettings.deleteMany({
        where: { key: "role_permissions_config" },
      });
      
      // Clear the permissions cache
      clearPermissionsCache();
      
      console.log("✓ Role permissions reset to default configuration");
      console.log("  All roles now use the built-in static permissions");
    } else {
      console.log("✓ Using default role permissions (no custom configuration found)");
    }
  } catch (error) {
    console.error("Error resetting role permissions:", error);
    // Don't throw - this is not critical enough to stop the setup
  }
}

// Verify and fix senior admin user role
async function verifySeniorAdminRole() {
  console.log("Verifying senior admin user role...");
  
  try {
    const seniorAdminEmail = "chalatsithapelo@gmail.com";
    const seniorAdmin = await db.user.findUnique({
      where: { email: seniorAdminEmail },
    });
    
    if (seniorAdmin) {
      if (seniorAdmin.role !== "SENIOR_ADMIN") {
        console.log(`⚠ Senior admin user has incorrect role: ${seniorAdmin.role}`);
        console.log("  Correcting role to SENIOR_ADMIN...");
        
        await db.user.update({
          where: { email: seniorAdminEmail },
          data: { role: "SENIOR_ADMIN" },
        });
        
        console.log("✓ Senior admin role corrected to SENIOR_ADMIN");
      } else {
        console.log("✓ Senior admin user has correct role: SENIOR_ADMIN");
      }
    } else {
      console.log("  Senior admin user not found (will be created during user seeding)");
    }
  } catch (error) {
    console.error("Error verifying senior admin role:", error);
    // Don't throw - this is not critical enough to stop the setup
  }
}

// Validate BASE_URL configuration for preview/production deployments
function validateBaseUrl() {
  console.log("Validating BASE_URL configuration...");
  
  const baseUrl = getBaseUrl();
  const nodeEnv = env.NODE_ENV;
  
  console.log(`  Current BASE_URL: ${baseUrl}`);
  console.log(`  Current NODE_ENV: ${nodeEnv}`);
  
  // Check if BASE_URL is set to localhost in production/preview
  if (nodeEnv === "production") {
    if (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")) {
      console.warn("");
      console.warn("⚠️  WARNING: BASE_URL is set to localhost in production mode!");
      console.warn("⚠️  This will cause issues with:");
      console.warn("     - Email links (will point to localhost)");
      console.warn("     - File storage URLs (MinIO links will be broken)");
      console.warn("     - PDF generation (QR codes and links will be incorrect)");
      console.warn("     - Tenant portal access");
      console.warn("");
      console.warn("   To fix this, set the BASE_URL environment variable to your actual deployment URL:");
      console.warn("   Example: export BASE_URL=https://your-preview-url.codapt.app");
      console.warn("");
      console.warn("   For preview deployments, see: PREVIEW_BASE_URL_SETUP.md");
      console.warn("");
    } else {
      console.log("✓ BASE_URL is correctly configured for production/preview deployment");
    }
  } else {
    // Development mode
    if (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")) {
      console.log("✓ BASE_URL is set to localhost (appropriate for development)");
    } else {
      console.log(`✓ BASE_URL is set to: ${baseUrl}`);
    }
  }
  
  // Always log MinIO base URL for verification
  const minioBaseUrl = getBaseUrl({ port: 9000 });
  console.log(`  MinIO Base URL: ${minioBaseUrl}`);
  console.log("");
}

async function setup() {
  const setupStartTime = Date.now();
  console.log("Starting setup...");
  
  const shouldSeedDemoData = process.env.SEED_DEMO_DATA === "true";
  
  try {
    // 1. Apply database schema changes without resetting data.
    // This ensures schema is up-to-date while preserving all existing records.
    console.log("Applying database schema changes...");
    await exec("npx prisma db push --skip-generate");
    console.log("✓ Database schema applied successfully");
    
    // Test database connection with retry (since this relies on DB container start)
    await retry(
      async () => {
        await db.$queryRaw`SELECT 1`;
        console.log("✓ Database connection successful");
      },
      { operationName: "Database connection test" }
    );
    
    // Validate BASE_URL configuration
    validateBaseUrl();
    
    // Sync company details from environment to database with retry
    await retry(
      async () => {
        await syncCompanyDetailsToDatabase();
      },
      { operationName: "Company details sync" }
    );
    
    // Reset role permissions to defaults with retry
    await retry(
      async () => {
        await resetRolePermissionsToDefaults();
      },
      { operationName: "Role permissions reset" }
    );
    
    // Verify senior admin user role with retry
    await retry(
      async () => {
        await verifySeniorAdminRole();
      },
      { operationName: "Senior admin role verification" }
    );
    
    // Create MinIO bucket for property management files with retry
    await retry(
      async () => {
        const bucketName = "property-management";
        const bucketExists = await minioClient.bucketExists(bucketName);
        
        if (!bucketExists) {
          await minioClient.makeBucket(bucketName);
          console.log(`✓ Created bucket: ${bucketName}`);
          
          // Set bucket policy to allow public read access for files in the 'public' prefix
          const policy = {
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Principal: { AWS: ["*"] },
                Action: ["s3:GetObject"],
                Resource: [`arn:aws:s3:::${bucketName}/public/*`],
              },
            ],
          };
          
          await minioClient.setBucketPolicy(
            bucketName,
            JSON.stringify(policy)
          );
          console.log(`✓ Set public policy for ${bucketName}/public/*`);
        } else {
          console.log(`✓ Bucket ${bucketName} already exists`);
        }
      },
      { operationName: "MinIO bucket setup" }
    );
    
    // Create MinIO bucket for financial reports and other documents
    await retry(
      async () => {
        const documentsBucketName = "documents";
        const documentsExists = await minioClient.bucketExists(documentsBucketName);
        
        if (!documentsExists) {
          await minioClient.makeBucket(documentsBucketName);
          console.log(`✓ Created bucket: ${documentsBucketName}`);
          
          // Set bucket policy to allow public read access for files in the 'public' prefix
          const policy = {
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Principal: { AWS: ["*"] },
                Action: ["s3:GetObject"],
                Resource: [`arn:aws:s3:::${documentsBucketName}/public/*`],
              },
            ],
          };
          
          await minioClient.setBucketPolicy(
            documentsBucketName,
            JSON.stringify(policy)
          );
          console.log(`✓ Set public policy for ${documentsBucketName}/public/*`);
        } else {
          console.log(`✓ Bucket ${documentsBucketName} already exists`);
        }
      },
      { operationName: "MinIO documents bucket setup" }
    );
    
    // Seed users with retry
    await retry(
      async () => {
        // Seed junior admin user if not exists
        const juniorAdminEmail = "junior@propmanagement.com";
        const existingJuniorAdmin = await db.user.findUnique({
          where: { email: juniorAdminEmail },
        });
        
        if (!existingJuniorAdmin) {
          const hashedPassword = await bcryptjs.hash("junior123", 10);
          
          await db.user.create({
            data: {
              email: juniorAdminEmail,
              password: hashedPassword,
              firstName: "Junior",
              lastName: "Admin",
              phone: "+27123456789",
              role: "JUNIOR_ADMIN",
            },
          });
          console.log(`✓ Created junior admin user: ${juniorAdminEmail} (password: junior123)`);
        } else {
          console.log(`✓ Junior admin user already exists: ${juniorAdminEmail}`);
        }
        
        // Seed senior admin user if not exists
        const seniorAdminEmail = "chalatsithapelo@gmail.com";
        const existingSeniorAdmin = await db.user.findUnique({
          where: { email: seniorAdminEmail },
        });
        
        if (!existingSeniorAdmin) {
          const hashedPassword = await bcryptjs.hash("1991Slowmo*", 10);
          
          await db.user.create({
            data: {
              email: seniorAdminEmail,
              password: hashedPassword,
              firstName: "Chalat",
              lastName: "Sithapelo",
              phone: "+27783800308",
              role: "SENIOR_ADMIN",
            },
          });
          console.log(`✓ Created senior admin user: ${seniorAdminEmail} (password: 1991Slowmo*)`);
        } else {
          console.log(`✓ Senior admin user already exists: ${seniorAdminEmail}`);
        }

        // Seed demo admin user (displayed on landing page) if not exists
        const demoAdminEmail = "admin@propmanagement.com";
        const existingDemoAdmin = await db.user.findUnique({
          where: { email: demoAdminEmail },
        });

        if (!existingDemoAdmin) {
          const hashedPassword = await bcryptjs.hash("admin123", 10);

          await db.user.create({
            data: {
              email: demoAdminEmail,
              password: hashedPassword,
              firstName: "Admin",
              lastName: "User",
              phone: "+27123456788",
              role: "SENIOR_ADMIN",
            },
          });
          console.log(`✓ Created demo admin user: ${demoAdminEmail} (password: admin123)`);
        } else {
          console.log(`✓ Demo admin user already exists: ${demoAdminEmail}`);
        }

        // Seed demo Property Manager user if not exists
        const demoPmEmail = "pm@propmanagement.com";
        const existingDemoPm = await db.user.findUnique({
          where: { email: demoPmEmail },
        });

        if (!existingDemoPm) {
          const hashedPassword = await bcryptjs.hash("pm123", 10);

          await db.user.create({
            data: {
              email: demoPmEmail,
              password: hashedPassword,
              firstName: "Sarah",
              lastName: "Johnson",
              phone: "+27123456789",
              role: "PROPERTY_MANAGER",
              pmCompanyName: "Premium Property Management",
              pmCompanyAddressLine1: "123 Business Park",
              pmCompanyAddressLine2: "Sandton, 2196",
              pmCompanyPhone: "+27114445555",
              pmCompanyEmail: "info@premiumpm.co.za",
              pmCompanyVatNumber: "VAT123456789",
              pmCompanyBankName: "Standard Bank",
              pmCompanyBankAccountName: "Premium Property Management",
              pmCompanyBankAccountNumber: "1234567890",
              pmCompanyBankBranchCode: "051001",
              pmBrandPrimaryColor: "#2563eb",
              pmBrandSecondaryColor: "#1e40af",
              pmBrandAccentColor: "#3b82f6",
            },
          });
          console.log(`✓ Created demo property manager: ${demoPmEmail} (password: pm123)`);
        } else {
          console.log(`✓ Demo property manager already exists: ${demoPmEmail}`);
        }

        // Seed demo Contractor user if not exists
        const demoContractorEmail = "contractor@propmanagement.com";
        const existingDemoContractor = await db.user.findUnique({
          where: { email: demoContractorEmail },
        });

        if (!existingDemoContractor) {
          const hashedPassword = await bcryptjs.hash("contractor123", 10);

          await db.user.create({
            data: {
              email: demoContractorEmail,
              password: hashedPassword,
              firstName: "Mike",
              lastName: "Thompson",
              phone: "+27821234567",
              role: "CONTRACTOR",
              contractorCompanyName: "Thompson Construction",
              contractorCompanyAddressLine1: "456 Industrial Drive",
              contractorCompanyAddressLine2: "Midrand, 1685",
              contractorCompanyPhone: "+27114447777",
              contractorCompanyEmail: "mike@thompsonconstruction.co.za",
              contractorCompanyVatNumber: "VAT987654321",
              contractorCompanyBankName: "FNB",
              contractorCompanyBankAccountName: "Thompson Construction",
              contractorCompanyBankAccountNumber: "9876543210",
              contractorCompanyBankBranchCode: "250655",
              contractorBrandPrimaryColor: "#ea580c",
              contractorBrandSecondaryColor: "#c2410c",
              contractorBrandAccentColor: "#f97316",
            },
          });
          console.log(`✓ Created demo contractor: ${demoContractorEmail} (password: contractor123)`);
        } else {
          console.log(`✓ Demo contractor already exists: ${demoContractorEmail}`);
        }
        
        // Seed test artisan
        const artisanEmail = "artisan@propmanagement.com";
        const existingArtisan = await db.user.findUnique({
          where: { email: artisanEmail },
        });
        
        if (!existingArtisan) {
          const hashedPassword = await bcryptjs.hash("artisan123", 10);
          
          await db.user.create({
            data: {
              email: artisanEmail,
              password: hashedPassword,
              firstName: "John",
              lastName: "Smith",
              phone: "+27123456790",
              role: "ARTISAN",
              hourlyRate: 250,
              dailyRate: 2000,
            },
          });
          console.log(`✓ Created artisan user: ${artisanEmail} (password: artisan123)`);
        } else {
          console.log(`✓ Artisan user already exists: ${artisanEmail}`);
        }
        
        // Seed test customer
        const customerEmail = "customer@example.com";
        const existingCustomer = await db.user.findUnique({
          where: { email: customerEmail },
        });
        
        if (!existingCustomer) {
          const hashedPassword = await bcryptjs.hash("customer123", 10);
          
          await db.user.create({
            data: {
              email: customerEmail,
              password: hashedPassword,
              firstName: "Jane",
              lastName: "Doe",
              phone: "+27123456791",
              role: "CUSTOMER",
            },
          });
          console.log(`✓ Created customer user: ${customerEmail} (password: customer123)`);
        } else {
          console.log(`✓ Customer user already exists: ${customerEmail}`);
        }
      },
      { operationName: "User seeding" }
    );

    // Seed demo data only if explicitly requested
    if (shouldSeedDemoData) {
      console.log("SEED_DEMO_DATA is enabled, seeding demo data...");
      await retry(
        async () => {
          // Check if demo data already exists (using orders as a proxy)
          const existingOrders = await db.order.count();

          // Always seed PM/Contractor portal workflow data (idempotent)
          console.log("Seeding Property Manager / Contractor portal demo workflow...");
          await seedRFQWorkflow({ disconnect: false });

          if (existingOrders > 0) {
            console.log("✓ Admin demo data already exists, skipping seeding");
            return;
          }

          console.log("Seeding admin demo data...");
          
          // Get users for relationships
          const seniorAdmin = await db.user.findUnique({ where: { email: "chalatsithapelo@gmail.com" } });
          const juniorAdmin = await db.user.findUnique({ where: { email: "junior@propmanagement.com" } });
          const artisan = await db.user.findUnique({ where: { email: "artisan@propmanagement.com" } });
          const customer = await db.user.findUnique({ where: { email: "customer@example.com" } });
          
          if (!seniorAdmin || !juniorAdmin || !artisan || !customer) {
            console.warn("Required users not found, skipping demo data seeding");
            return;
          }
          
          // Get company details for document prefixes
          const companyDetails = await getCompanyDetails();
          
          // 1. Seed Leads
          console.log("Seeding leads...");
          const lead1 = await db.lead.create({
            data: {
              customerName: "Alice Johnson",
              customerEmail: "alice.johnson@example.com",
              customerPhone: "+27123456792",
              address: "123 Oak Street, Sandton, Johannesburg",
              serviceType: "Plumbing",
              description: "Kitchen sink installation and bathroom fixture replacement",
              estimatedValue: 15000,
              status: "QUALIFIED",
              createdById: seniorAdmin.id,
              notes: "Prefers morning appointments",
            },
          });

          const lead2 = await db.lead.create({
            data: {
              customerName: "Bob Williams",
              customerEmail: "bob.williams@example.com",
              customerPhone: "+27123456793",
              address: "456 Pine Avenue, Rosebank, Johannesburg",
              serviceType: "Electrical",
              description: "Complete office rewiring and lighting installation",
              estimatedValue: 45000,
              status: "PROPOSAL_SENT",
              createdById: juniorAdmin.id,
              nextFollowUpDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
              followUpAssignedToId: juniorAdmin.id,
            },
          });

          const lead3 = await db.lead.create({
            data: {
              customerName: "Carol Martinez",
              customerEmail: "carol.martinez@example.com",
              customerPhone: "+27123456794",
              address: "789 Maple Road, Parktown, Johannesburg",
              serviceType: "Painting",
              description: "Interior painting for 3-bedroom house",
              estimatedValue: 25000,
              status: "NEW",
              createdById: seniorAdmin.id,
            },
          });

          console.log("✓ Created 3 demo leads");

          // 2. Seed Orders
          console.log("Seeding orders...");
          const order1 = await db.order.create({
            data: {
              orderNumber: `${companyDetails.orderPrefix}-000001`,
              customerName: "Jane Doe",
              customerEmail: customer.email,
              customerPhone: customer.phone || "+27123456791",
              address: "100 Main Street, Sandton, Johannesburg",
              serviceType: "Plumbing",
              description: "Fix leaking bathroom faucet and replace kitchen sink drain",
              status: "COMPLETED",
              assignedToId: artisan.id,
              callOutFee: 500,
              labourRate: 250,
              materialCost: 1200,
              labourCost: 2000,
              totalCost: 3700,
              startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
              endTime: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
              leadId: lead1.id,
              beforePictures: [],
              afterPictures: [],
              materials: {
                create: [
                  {
                    name: "Kitchen Sink Drain Assembly",
                    description: "Stainless steel drain assembly with strainer",
                    quantity: 1,
                    unitPrice: 450,
                    totalCost: 450,
                    supplier: "Plumbing Supplies Co.",
                  },
                  {
                    name: "Bathroom Faucet Cartridge",
                    description: "Ceramic disc cartridge for bathroom faucet",
                    quantity: 2,
                    unitPrice: 375,
                    totalCost: 750,
                    supplier: "Plumbing Supplies Co.",
                  },
                ],
              },
            },
          });
          
          const order2 = await db.order.create({
            data: {
              orderNumber: `${companyDetails.orderPrefix}-000002`,
              customerName: "Alice Johnson",
              customerEmail: lead1.customerEmail,
              customerPhone: lead1.customerPhone,
              address: lead1.address,
              serviceType: "Electrical",
              description: "Install new light fixtures in living room and bedroom",
              status: "IN_PROGRESS",
              assignedToId: artisan.id,
              callOutFee: 500,
              labourRate: 300,
              materialCost: 3500,
              labourCost: 2400,
              totalCost: 6400,
              startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
              leadId: lead1.id,
              beforePictures: [],
              afterPictures: [],
            },
          });
          
          const order3 = await db.order.create({
            data: {
              orderNumber: `${companyDetails.orderPrefix}-000003`,
              customerName: "David Brown",
              customerEmail: "david.brown@example.com",
              customerPhone: "+27123456795",
              address: "200 River Road, Bryanston, Johannesburg",
              serviceType: "Carpentry",
              description: "Build custom bookshelf unit for home office",
              status: "ASSIGNED",
              assignedToId: artisan.id,
              callOutFee: 0,
              labourRate: 350,
              totalMaterialBudget: 5000,
              numLabourersNeeded: 1,
              totalLabourCostBudget: 7000,
              beforePictures: [],
              afterPictures: [],
            },
          });
          
          console.log("✓ Created 3 demo orders");
          
          // 3. Seed Projects
          console.log("Seeding projects...");
          const project1 = await db.project.create({
            data: {
              projectNumber: "PRJ-00001",
              name: "Office Renovation - Tech Startup",
              description: "Complete office renovation including electrical, plumbing, painting, and carpentry work",
              customerName: "Bob Williams",
              customerEmail: lead2.customerEmail,
              customerPhone: lead2.customerPhone,
              address: lead2.address,
              projectType: "Commercial Renovation",
              status: "IN_PROGRESS",
              startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
              endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
              estimatedBudget: 450000,
              actualCost: 125000,
              assignedToId: artisan.id,
              notes: "Client requires minimal disruption to daily operations",
            },
          });
          
          const project2 = await db.project.create({
            data: {
              projectNumber: "PRJ-00002",
              name: "Residential Home Build - Sandton",
              description: "New 4-bedroom house construction with modern finishes",
              customerName: "Emily Davis",
              customerEmail: "emily.davis@example.com",
              customerPhone: "+27123456796",
              address: "50 Hilltop Drive, Sandton, Johannesburg",
              projectType: "New Construction",
              status: "PLANNING",
              startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
              endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days from now
              estimatedBudget: 2500000,
              actualCost: 0,
              assignedToId: artisan.id,
            },
          });
          
          const project3 = await db.project.create({
            data: {
              projectNumber: "PRJ-00003",
              name: "Restaurant Kitchen Upgrade",
              description: "Commercial kitchen equipment installation and ventilation system upgrade",
              customerName: "Frank Thompson",
              customerEmail: "frank.thompson@example.com",
              customerPhone: "+27123456797",
              address: "75 Restaurant Lane, Melrose, Johannesburg",
              projectType: "Commercial Upgrade",
              status: "COMPLETED",
              startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
              endDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
              estimatedBudget: 350000,
              actualCost: 365000,
              assignedToId: artisan.id,
            },
          });
          
          console.log("✓ Created 3 demo projects");
          
          // 4. Seed Milestones for project1
          console.log("Seeding milestones...");
          const milestone1 = await db.milestone.create({
            data: {
              projectId: project1.id,
              name: "Electrical Work Phase 1",
              description: "Rewiring of main office area and installation of new circuit breakers",
              sequenceOrder: 1,
              status: "COMPLETED",
              labourCost: 25000,
              materialCost: 15000,
              expectedProfit: 10000,
              budgetAllocated: 50000,
              actualCost: 40000,
              dieselCost: 500,
              rentCost: 0,
              adminCost: 2000,
              otherOperationalCost: 500,
              startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              endDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
              actualStartDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              actualEndDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
              progressPercentage: 100,
              assignedToId: artisan.id,
            },
          });
          
          const milestone2 = await db.milestone.create({
            data: {
              projectId: project1.id,
              name: "Plumbing Installation",
              description: "Install new bathroom fixtures and kitchen plumbing",
              sequenceOrder: 2,
              status: "IN_PROGRESS",
              labourCost: 30000,
              materialCost: 20000,
              expectedProfit: 15000,
              budgetAllocated: 65000,
              actualCost: 35000,
              dieselCost: 800,
              rentCost: 0,
              adminCost: 2500,
              otherOperationalCost: 700,
              startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
              endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
              actualStartDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
              progressPercentage: 60,
              assignedToId: artisan.id,
            },
          });
          
          const milestone3 = await db.milestone.create({
            data: {
              projectId: project1.id,
              name: "Painting and Finishing",
              description: "Interior painting and final finishing touches",
              sequenceOrder: 3,
              status: "NOT_STARTED",
              labourCost: 20000,
              materialCost: 10000,
              expectedProfit: 8000,
              budgetAllocated: 38000,
              actualCost: 0,
              startDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
              endDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
              progressPercentage: 0,
              assignedToId: artisan.id,
            },
          });
          
          console.log("✓ Created 3 demo milestones");
          
          // 5. Seed Quotations
          console.log("Seeding quotations...");
          const quotation1 = await db.quotation.create({
            data: {
              quoteNumber: `${companyDetails.quotationPrefix}-00001`,
              customerName: lead2.customerName,
              customerEmail: lead2.customerEmail,
              customerPhone: lead2.customerPhone,
              address: lead2.address,
              items: [
                {
                  description: "Electrical rewiring - main office area",
                  quantity: 1,
                  unitPrice: 45000,
                  total: 45000,
                  unitOfMeasure: "Sum",
                },
                {
                  description: "LED lighting installation",
                  quantity: 20,
                  unitPrice: 1500,
                  total: 30000,
                  unitOfMeasure: "Unit",
                },
              ],
              subtotal: 75000,
              tax: 11250,
              total: 86250,
              companyMaterialCost: 25000,
              companyLabourCost: 35000,
              estimatedProfit: 15000,
              status: "APPROVED",
              validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              assignedToId: artisan.id,
              leadId: lead2.id,
              projectId: project1.id,
              labourRate: 300,
            },
          });
          
          const quotation2 = await db.quotation.create({
            data: {
              quoteNumber: `${companyDetails.quotationPrefix}-00002`,
              customerName: lead3.customerName,
              customerEmail: lead3.customerEmail,
              customerPhone: lead3.customerPhone,
              address: lead3.address,
              items: [
                {
                  description: "Interior painting - 3 bedrooms",
                  quantity: 3,
                  unitPrice: 6500,
                  total: 19500,
                  unitOfMeasure: "Room",
                },
                {
                  description: "Interior painting - living areas",
                  quantity: 1,
                  unitPrice: 8500,
                  total: 8500,
                  unitOfMeasure: "Sum",
                },
              ],
              subtotal: 28000,
              tax: 4200,
              total: 32200,
              companyMaterialCost: 8000,
              companyLabourCost: 15000,
              estimatedProfit: 5000,
              status: "PENDING_ARTISAN_REVIEW",
              validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
              assignedToId: artisan.id,
              leadId: lead3.id,
              labourRate: 250,
            },
          });
          
          console.log("✓ Created 2 demo quotations");
          
          // 6. Seed Invoices
          console.log("Seeding invoices...");
          const invoice1 = await db.invoice.create({
            data: {
              invoiceNumber: `${companyDetails.invoicePrefix}-000001`,
              customerName: order1.customerName,
              customerEmail: order1.customerEmail,
              customerPhone: order1.customerPhone,
              address: order1.address,
              items: [
                {
                  description: "Plumbing repair services",
                  quantity: 8,
                  unitPrice: 250,
                  total: 2000,
                  unitOfMeasure: "Hour",
                },
                {
                  description: "Materials and parts",
                  quantity: 1,
                  unitPrice: 1200,
                  total: 1200,
                  unitOfMeasure: "Sum",
                },
                {
                  description: "Call-out fee",
                  quantity: 1,
                  unitPrice: 500,
                  total: 500,
                  unitOfMeasure: "Sum",
                },
              ],
              subtotal: 3700,
              tax: 555,
              total: 4255,
              companyMaterialCost: 1200,
              companyLabourCost: 2000,
              estimatedProfit: 500,
              status: "PAID",
              dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
              paidDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
              orderId: order1.id,
            },
          });
          
          const invoice2 = await db.invoice.create({
            data: {
              invoiceNumber: `${companyDetails.invoicePrefix}-000002`,
              customerName: project1.customerName,
              customerEmail: project1.customerEmail,
              customerPhone: project1.customerPhone,
              address: project1.address,
              items: [
                {
                  description: "Milestone 1: Electrical Work Phase 1",
                  quantity: 1,
                  unitPrice: 50000,
                  total: 50000,
                  unitOfMeasure: "Sum",
                },
              ],
              subtotal: 50000,
              tax: 7500,
              total: 57500,
              companyMaterialCost: 15000,
              companyLabourCost: 25000,
              estimatedProfit: 10000,
              status: "SENT",
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              projectId: project1.id,
            },
          });
          
          const invoice3 = await db.invoice.create({
            data: {
              invoiceNumber: `${companyDetails.invoicePrefix}-000003`,
              customerName: order2.customerName,
              customerEmail: order2.customerEmail,
              customerPhone: order2.customerPhone,
              address: order2.address,
              items: [
                {
                  description: "Electrical installation services",
                  quantity: 8,
                  unitPrice: 300,
                  total: 2400,
                  unitOfMeasure: "Hour",
                },
                {
                  description: "Light fixtures and materials",
                  quantity: 1,
                  unitPrice: 3500,
                  total: 3500,
                  unitOfMeasure: "Sum",
                },
                {
                  description: "Call-out fee",
                  quantity: 1,
                  unitPrice: 500,
                  total: 500,
                  unitOfMeasure: "Sum",
                },
              ],
              subtotal: 6400,
              tax: 960,
              total: 7360,
              companyMaterialCost: 3500,
              companyLabourCost: 2400,
              estimatedProfit: 500,
              status: "PENDING_APPROVAL",
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              orderId: order2.id,
            },
          });
          
          console.log("✓ Created 3 demo invoices");
          
          // 7. Seed Payment Requests
          console.log("Seeding payment requests...");
          const paymentRequest1 = await db.paymentRequest.create({
            data: {
              requestNumber: "PR-000001",
              artisanId: artisan.id,
              orderIds: [order1.id],
              hoursWorked: 8,
              hourlyRate: 250,
              calculatedAmount: 2000,
              status: "PAID",
              approvedDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
              paidDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
              notes: "Payment for completed plumbing work",
            },
          });
          
          const paymentRequest2 = await db.paymentRequest.create({
            data: {
              requestNumber: "PR-000002",
              artisanId: artisan.id,
              milestoneId: milestone1.id,
              hoursWorked: 100,
              hourlyRate: 250,
              calculatedAmount: 25000,
              status: "APPROVED",
              approvedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
              notes: "Payment for Milestone 1 completion",
            },
          });
          
          const paymentRequest3 = await db.paymentRequest.create({
            data: {
              requestNumber: "PR-000003",
              artisanId: artisan.id,
              orderIds: [order2.id],
              hoursWorked: 8,
              hourlyRate: 300,
              calculatedAmount: 2400,
              status: "PENDING",
              notes: "Payment for ongoing electrical work",
            },
          });
          
          console.log("✓ Created 3 demo payment requests");
          
          // 8. Seed Assets
          console.log("Seeding assets...");
          await db.asset.create({
            data: {
              name: "Company Van - Toyota Hilux",
              description: "2020 Toyota Hilux double cab for transporting materials and equipment",
              category: "VEHICLE",
              serialNumber: "VIN123456789",
              purchaseDate: new Date("2020-03-15"),
              purchasePrice: 450000,
              currentValue: 320000,
              condition: "GOOD",
              location: "Main Office - Sandton",
              notes: "Regular maintenance up to date",
              images: [],
            },
          });
          
          await db.asset.create({
            data: {
              name: "Power Tools Set",
              description: "Professional grade power tools including drills, saws, and sanders",
              category: "EQUIPMENT",
              serialNumber: "PT-2021-001",
              purchaseDate: new Date("2021-06-10"),
              purchasePrice: 35000,
              currentValue: 25000,
              condition: "GOOD",
              location: "Equipment Storage",
              images: [],
            },
          });
          
          await db.asset.create({
            data: {
              name: "Office Furniture",
              description: "Desks, chairs, and filing cabinets for main office",
              category: "FURNITURE",
              purchaseDate: new Date("2019-01-20"),
              purchasePrice: 75000,
              currentValue: 40000,
              condition: "FAIR",
              location: "Main Office - Sandton",
              images: [],
            },
          });
          
          console.log("✓ Created 3 demo assets");
          
          // 9. Seed Liabilities
          console.log("Seeding liabilities...");
          await db.liability.create({
            data: {
              name: "Business Loan - Vehicle Finance",
              description: "Loan for Toyota Hilux purchase",
              category: "LOAN",
              amount: 180000,
              dueDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              isPaid: false,
              creditor: "ABC Bank",
              referenceNumber: "LOAN-2020-001",
              notes: "Monthly installments of R7,500",
            },
          });
          
          await db.liability.create({
            data: {
              name: "Supplier Account - Plumbing Supplies Co.",
              description: "Outstanding payment for materials",
              category: "ACCOUNTS_PAYABLE",
              amount: 15000,
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              isPaid: false,
              creditor: "Plumbing Supplies Co.",
              referenceNumber: "INV-PS-2024-045",
            },
          });
          
          await db.liability.create({
            data: {
              name: "Credit Line - Building Materials",
              description: "Revolving credit for purchasing building materials",
              category: "CREDIT_LINE",
              amount: 50000,
              isPaid: false,
              creditor: "BuildMart Suppliers",
              referenceNumber: "CL-2023-007",
              notes: "Credit limit: R100,000",
            },
          });
          
          console.log("✓ Created 3 demo liabilities");
          
          // 10. Seed Statements
          console.log("Seeding statements...");
          await db.statement.create({
            data: {
              statement_number: "STMT-000001",
              client_email: customer.email,
              client_name: customer.firstName + " " + customer.lastName,
              customerPhone: customer.phone,
              address: "100 Main Street, Sandton, Johannesburg",
              statement_date: new Date(),
              period_start: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
              period_end: new Date(),
              invoice_ids: [invoice1.invoiceNumber],
              invoice_details: [
                {
                  invoice_number: invoice1.invoiceNumber,
                  order_number: order1.orderNumber,
                  building: "Main Street Property",
                  description: "Plumbing repair services",
                  invoice_date: invoice1.createdAt.toISOString(),
                  due_date: invoice1.dueDate?.toISOString(),
                  amount: invoice1.total,
                  age_days: 0,
                },
              ],
              age_analysis: {
                current: 4255,
                days_31_60: 0,
                days_61_90: 0,
                days_91_120: 0,
                over_120: 0,
              },
              subtotal: 4255,
              total_interest: 0,
              total_amount_due: 4255,
              payments_received: 4255,
              previous_balance: 0,
              status: "paid",
            },
          });
          
          await db.statement.create({
            data: {
              statement_number: "STMT-000002",
              client_email: project1.customerEmail,
              client_name: project1.customerName,
              customerPhone: project1.customerPhone,
              address: project1.address,
              statement_date: new Date(),
              period_start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
              period_end: new Date(),
              invoice_ids: [invoice2.invoiceNumber],
              invoice_details: [
                {
                  invoice_number: invoice2.invoiceNumber,
                  order_number: project1.projectNumber,
                  building: "Office Renovation Project",
                  description: "Milestone 1: Electrical Work Phase 1",
                  invoice_date: invoice2.createdAt.toISOString(),
                  due_date: invoice2.dueDate?.toISOString(),
                  amount: invoice2.total,
                  age_days: 0,
                },
              ],
              age_analysis: {
                current: 57500,
                days_31_60: 0,
                days_61_90: 0,
                days_91_120: 0,
                over_120: 0,
              },
              subtotal: 57500,
              total_interest: 0,
              total_amount_due: 57500,
              payments_received: 0,
              previous_balance: 0,
              status: "sent",
              sent_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            },
          });
          
          console.log("✓ Created 2 demo statements");
          
          // 11. Seed Reviews
          console.log("Seeding reviews...");
          await db.review.create({
            data: {
              rating: 5,
              comment: "Excellent work! John was professional and completed the job quickly. Highly recommend!",
              serviceQuality: 5,
              professionalism: 5,
              timeliness: 5,
              customerId: customer.id,
              artisanId: artisan.id,
              orderId: order1.id,
            },
          });
          
          await db.review.create({
            data: {
              rating: 4.5,
              comment: "Great work on the electrical installation. Very knowledgeable and clean work.",
              serviceQuality: 5,
              professionalism: 4,
              timeliness: 4,
              customerId: customer.id,
              artisanId: artisan.id,
              projectId: project1.id,
            },
          });
          
          console.log("✓ Created 2 demo reviews");
          
          console.log("✓ Demo data seeding completed successfully");
        },
        { operationName: "Demo data seeding", maxAttempts: 3 }
      );
    } else {
      console.log("✓ Demo data seeding skipped (set SEED_DEMO_DATA=true to enable)");
    }

    // Check for monthly salary payments due today
    await retry(
      async () => {
        console.log("Checking for monthly salary payments due today...");
        await createMonthlySalaryPayments();
      },
      { operationName: "Monthly salary payment check", maxAttempts: 3 }
    );

    console.log("✓ Setup completed successfully");
    console.log(`  Total setup time: ${Date.now() - setupStartTime}ms`);
  } catch (error) {
    console.error("Setup failed:", error);
    if (error instanceof Error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    }
    throw error;
  } finally {
    // Disconnect from database to allow clean exit
    await db.$disconnect();
  }
}

setup()
  .then(() => {
    console.log("setup.ts complete");
    // Script will exit naturally after all async operations complete
  })
  .catch((error) => {
    console.error(error);
    // Exit with error code to signal failure
    process.exit(1);
  });
