import { db } from "~/server/db";
import { env } from "~/server/env";

interface CompanyDetails {
  companyName: string;
  companyAddressLine1: string;
  companyAddressLine2: string;
  companyPhone: string;
  companyEmail: string;
  companyVatNumber: string;
  companyBankName: string;
  companyBankAccountName: string;
  companyBankAccountNumber: string;
  companyBankBranchCode: string;
  statementTemplateContent: string;
  invoicePrefix: string;
  orderPrefix: string;
  quotationPrefix: string;
}

let cachedDetails: CompanyDetails | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 30 * 1000; // 30 seconds (reduced from 5 minutes for faster updates)

async function loadCompanyDetails(): Promise<CompanyDetails> {
  const now = Date.now();
  
  // Return cached details if they're still fresh
  if (cachedDetails && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedDetails;
  }

  try {
    // Fetch all company-related settings from the database
    const settings = await db.systemSettings.findMany({
      where: {
        key: {
          in: [
            "company_name",
            "company_address_line1",
            "company_address_line2",
            "company_phone",
            "company_email",
            "company_vat_number",
            "company_bank_name",
            "company_bank_account_name",
            "company_bank_account_number",
            "company_bank_branch_code",
            "statement_template_content",
            "invoice_prefix",
            "order_prefix",
            "quotation_prefix",
          ],
        },
      },
    });

    // Convert array to object for easier access
    const settingsMap = settings.reduce((acc, setting) => {
      if (setting.value) {
        acc[setting.key] = setting.value;
      }
      return acc;
    }, {} as Record<string, string>);

    // Build company details object with fallback to environment variables
    cachedDetails = {
      companyName: settingsMap.company_name || env.COMPANY_NAME,
      companyAddressLine1: settingsMap.company_address_line1 || env.COMPANY_ADDRESS_LINE1,
      companyAddressLine2: settingsMap.company_address_line2 || env.COMPANY_ADDRESS_LINE2,
      companyPhone: settingsMap.company_phone || env.COMPANY_PHONE,
      companyEmail: settingsMap.company_email || env.COMPANY_EMAIL,
      companyVatNumber: settingsMap.company_vat_number || env.COMPANY_VAT_NUMBER,
      companyBankName: settingsMap.company_bank_name || env.COMPANY_BANK_NAME,
      companyBankAccountName: settingsMap.company_bank_account_name || env.COMPANY_BANK_ACCOUNT_NAME,
      companyBankAccountNumber: settingsMap.company_bank_account_number || env.COMPANY_BANK_ACCOUNT_NUMBER,
      companyBankBranchCode: settingsMap.company_bank_branch_code || env.COMPANY_BANK_BRANCH_CODE,
      statementTemplateContent: settingsMap.statement_template_content || "",
      invoicePrefix: settingsMap.invoice_prefix || env.COMPANY_INVOICE_PREFIX,
      orderPrefix: settingsMap.order_prefix || env.COMPANY_ORDER_PREFIX,
      quotationPrefix: settingsMap.quotation_prefix || env.COMPANY_QUOTATION_PREFIX,
    };
    
    lastFetchTime = now;
    
    return cachedDetails;
  } catch (error) {
    console.error("Error loading company details:", error);
    
    // Fallback to environment variables
    return {
      companyName: env.COMPANY_NAME,
      companyAddressLine1: env.COMPANY_ADDRESS_LINE1,
      companyAddressLine2: env.COMPANY_ADDRESS_LINE2,
      companyPhone: env.COMPANY_PHONE,
      companyEmail: env.COMPANY_EMAIL,
      companyVatNumber: env.COMPANY_VAT_NUMBER,
      companyBankName: env.COMPANY_BANK_NAME,
      companyBankAccountName: env.COMPANY_BANK_ACCOUNT_NAME,
      companyBankAccountNumber: env.COMPANY_BANK_ACCOUNT_NUMBER,
      companyBankBranchCode: env.COMPANY_BANK_BRANCH_CODE,
      statementTemplateContent: "",
      invoicePrefix: env.COMPANY_INVOICE_PREFIX,
      orderPrefix: env.COMPANY_ORDER_PREFIX,
      quotationPrefix: env.COMPANY_QUOTATION_PREFIX,
    };
  }
}

export async function getCompanyDetails(): Promise<CompanyDetails> {
  return await loadCompanyDetails();
}
/**
 * Clear the cached company details
 * This should be called whenever company settings are updated
 */
export function clearCompanyDetailsCache(): void {
  cachedDetails = null;
  lastFetchTime = 0;
}