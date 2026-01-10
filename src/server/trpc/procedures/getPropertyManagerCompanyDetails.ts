import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { db } from "~/server/db";

export const getPropertyManagerCompanyDetails = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    // Fetch the PM's company details from their user record
    const pmUser = await db.user.findUnique({
      where: { id: user.id },
      select: {
        pmCompanyName: true,
        pmCompanyAddressLine1: true,
        pmCompanyAddressLine2: true,
        pmCompanyPhone: true,
        pmCompanyEmail: true,
        pmCompanyVatNumber: true,
        pmCompanyBankName: true,
        pmCompanyBankAccountName: true,
        pmCompanyBankAccountNumber: true,
        pmCompanyBankBranchCode: true,
      },
    });

    return {
      companyName: pmUser?.pmCompanyName || "",
      companyAddressLine1: pmUser?.pmCompanyAddressLine1 || "",
      companyAddressLine2: pmUser?.pmCompanyAddressLine2 || "",
      companyPhone: pmUser?.pmCompanyPhone || "",
      companyEmail: pmUser?.pmCompanyEmail || "",
      companyVatNumber: pmUser?.pmCompanyVatNumber || "",
      companyBankName: pmUser?.pmCompanyBankName || "",
      companyBankAccountName: pmUser?.pmCompanyBankAccountName || "",
      companyBankAccountNumber: pmUser?.pmCompanyBankAccountNumber || "",
      companyBankBranchCode: pmUser?.pmCompanyBankBranchCode || "",
    };
  });
