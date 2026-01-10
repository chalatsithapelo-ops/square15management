import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { db } from "~/server/db";

export const updatePropertyManagerCompanyDetails = baseProcedure
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

    // Only allow property managers to update their own company details
    if (user.role !== "PROPERTY_MANAGER") {
      throw new Error("Only Property Managers can update company details");
    }

    // Build update data object
    const updateData: Record<string, string> = {};
    if (input.companyName !== undefined) updateData.pmCompanyName = input.companyName;
    if (input.companyAddressLine1 !== undefined) updateData.pmCompanyAddressLine1 = input.companyAddressLine1;
    if (input.companyAddressLine2 !== undefined) updateData.pmCompanyAddressLine2 = input.companyAddressLine2;
    if (input.companyPhone !== undefined) updateData.pmCompanyPhone = input.companyPhone;
    if (input.companyEmail !== undefined) updateData.pmCompanyEmail = input.companyEmail;
    if (input.companyVatNumber !== undefined) updateData.pmCompanyVatNumber = input.companyVatNumber;
    if (input.companyBankName !== undefined) updateData.pmCompanyBankName = input.companyBankName;
    if (input.companyBankAccountName !== undefined) updateData.pmCompanyBankAccountName = input.companyBankAccountName;
    if (input.companyBankAccountNumber !== undefined) updateData.pmCompanyBankAccountNumber = input.companyBankAccountNumber;
    if (input.companyBankBranchCode !== undefined) updateData.pmCompanyBankBranchCode = input.companyBankBranchCode;

    // Update the user record
    await db.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return {
      success: true,
    };
  });
