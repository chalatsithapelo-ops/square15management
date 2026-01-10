import { baseProcedure } from "~/server/trpc/main";
import { db } from "~/server/db";
import { env } from "~/server/env";

export const getCompanyDetails = baseProcedure
  .query(async () => {
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
      acc[setting.key] = setting.value || "";
      return acc;
    }, {} as Record<string, string>);

    // Return settings with environment variable fallbacks
    return {
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
  });
