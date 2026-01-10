import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { db } from "~/server/db";

export const updateContractorCompanyDetails = baseProcedure
  .input(
    z.object({
      token: z.string(),
      companyName: z.string().optional(),
      companyAddressLine1: z.string().optional(),
      companyAddressLine2: z.string().optional(),
      companyPhone: z.string().optional(),
      companyEmail: z.string().optional(),
      companyVatNumber: z.string().optional(),
      companyBankName: z.string().optional(),
      companyBankAccountName: z.string().optional(),
      companyBankAccountNumber: z.string().optional(),
      companyBankBranchCode: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    // Only allow contractors to update their own company details
    if (user.role !== "CONTRACTOR" && user.role !== "CONTRACTOR_SENIOR_MANAGER" && user.role !== "CONTRACTOR_JUNIOR_MANAGER") {
      throw new Error("Only Contractors can update company details");
    }

    // Build update data object
    const updateData: Record<string, string> = {};
    if (input.companyName !== undefined) updateData.contractorCompanyName = input.companyName;
    if (input.companyAddressLine1 !== undefined) updateData.contractorCompanyAddressLine1 = input.companyAddressLine1;
    if (input.companyAddressLine2 !== undefined) updateData.contractorCompanyAddressLine2 = input.companyAddressLine2;
    if (input.companyPhone !== undefined) updateData.contractorCompanyPhone = input.companyPhone;
    if (input.companyEmail !== undefined) updateData.contractorCompanyEmail = input.companyEmail;
    if (input.companyVatNumber !== undefined) updateData.contractorCompanyVatNumber = input.companyVatNumber;
    if (input.companyBankName !== undefined) updateData.contractorCompanyBankName = input.companyBankName;
    if (input.companyBankAccountName !== undefined) updateData.contractorCompanyBankAccountName = input.companyBankAccountName;
    if (input.companyBankAccountNumber !== undefined) updateData.contractorCompanyBankAccountNumber = input.companyBankAccountNumber;
    if (input.companyBankBranchCode !== undefined) updateData.contractorCompanyBankBranchCode = input.companyBankBranchCode;

    // Update the user record
    await db.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return {
      success: true,
    };
  });
