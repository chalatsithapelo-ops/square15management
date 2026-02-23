import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireSeniorAdmin } from "~/server/utils/auth";
import { db } from "~/server/db";
import { clearCompanyDetailsCache } from "~/server/utils/company-details";

export const updateCompanyDetails = baseProcedure
  .input(
    z.object({
      token: z.string(),
      companyName: z.string().optional(),
      companyAddressLine1: z.string().optional(),
      companyAddressLine2: z.string().optional(),
      companyPostalAddress: z.string().optional(),
      companyPhysicalAddress: z.string().optional(),
      companyPhone: z.string().optional(),
      companyEmail: z.string().email().optional(),
      companyVatNumber: z.string().optional(),
      companyBankName: z.string().optional(),
      companyBankAccountName: z.string().optional(),
      companyBankAccountNumber: z.string().optional(),
      companyBankBranchCode: z.string().optional(),
      statementTemplateContent: z.string().optional(),
      invoicePrefix: z.string().optional(),
      orderPrefix: z.string().optional(),
      quotationPrefix: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireSeniorAdmin(user);

    // Map of field names to database keys
    const fieldMap: Record<string, string> = {
      companyName: "company_name",
      companyAddressLine1: "company_address_line1",
      companyAddressLine2: "company_address_line2",
      companyPostalAddress: "company_postal_address",
      companyPhysicalAddress: "company_physical_address",
      companyPhone: "company_phone",
      companyEmail: "company_email",
      companyVatNumber: "company_vat_number",
      companyBankName: "company_bank_name",
      companyBankAccountName: "company_bank_account_name",
      companyBankAccountNumber: "company_bank_account_number",
      companyBankBranchCode: "company_bank_branch_code",
      statementTemplateContent: "statement_template_content",
      invoicePrefix: "invoice_prefix",
      orderPrefix: "order_prefix",
      quotationPrefix: "quotation_prefix",
    };

    // Update each provided field
    const updatePromises = Object.entries(input)
      .filter(([key]) => key !== "token" && input[key as keyof typeof input] !== undefined)
      .map(([key, value]) => {
        const dbKey = fieldMap[key];
        if (!dbKey) return null;

        return db.systemSettings.upsert({
          where: { key: dbKey },
          create: {
            key: dbKey,
            value: value as string,
          },
          update: {
            value: value as string,
          },
        });
      })
      .filter((p) => p !== null);

    await Promise.all(updatePromises);

    // Clear the cached company details so the next request fetches fresh data
    clearCompanyDetailsCache();

    return {
      success: true,
    };
  });
