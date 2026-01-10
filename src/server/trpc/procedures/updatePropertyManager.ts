import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import bcryptjs from "bcryptjs";

const updatePropertyManagerSchema = z.object({
  token: z.string(),
  propertyManagerId: z.number().int().positive(),

  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),

  pmCompanyName: z.string().optional().nullable(),
  pmCompanyAddressLine1: z.string().optional().nullable(),
  pmCompanyAddressLine2: z.string().optional().nullable(),
  pmCompanyPhone: z.string().optional().nullable(),
  pmCompanyEmail: z.string().optional().nullable(),
  pmCompanyVatNumber: z.string().optional().nullable(),
  pmCompanyBankName: z.string().optional().nullable(),
  pmCompanyBankAccountName: z.string().optional().nullable(),
  pmCompanyBankAccountNumber: z.string().optional().nullable(),
  pmCompanyBankBranchCode: z.string().optional().nullable(),

  pmBrandPrimaryColor: z.string().optional().nullable(),
  pmBrandSecondaryColor: z.string().optional().nullable(),
  pmBrandAccentColor: z.string().optional().nullable(),

  newPassword: z.string().min(6).optional(),
});

export const updatePropertyManager = baseProcedure
  .input(updatePropertyManagerSchema)
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const isAdmin = user.role === "JUNIOR_ADMIN" || user.role === "SENIOR_ADMIN";
    if (!isAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Admins can update Property Managers",
      });
    }

    const pm = await db.user.findUnique({
      where: { id: input.propertyManagerId },
      select: { id: true, role: true },
    });

    if (!pm) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Property Manager not found" });
    }

    if (pm.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Selected user is not a Property Manager",
      });
    }

    try {
      const updated = await db.user.update({
        where: { id: input.propertyManagerId },
        data: {
          ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
          ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
          ...(input.phone !== undefined ? { phone: input.phone ?? undefined } : {}),

          ...(input.pmCompanyName !== undefined ? { pmCompanyName: input.pmCompanyName ?? undefined } : {}),
          ...(input.pmCompanyAddressLine1 !== undefined
            ? { pmCompanyAddressLine1: input.pmCompanyAddressLine1 ?? undefined }
            : {}),
          ...(input.pmCompanyAddressLine2 !== undefined
            ? { pmCompanyAddressLine2: input.pmCompanyAddressLine2 ?? undefined }
            : {}),
          ...(input.pmCompanyPhone !== undefined
            ? { pmCompanyPhone: input.pmCompanyPhone ?? undefined }
            : {}),
          ...(input.pmCompanyEmail !== undefined
            ? { pmCompanyEmail: input.pmCompanyEmail ?? undefined }
            : {}),
          ...(input.pmCompanyVatNumber !== undefined
            ? { pmCompanyVatNumber: input.pmCompanyVatNumber ?? undefined }
            : {}),
          ...(input.pmCompanyBankName !== undefined
            ? { pmCompanyBankName: input.pmCompanyBankName ?? undefined }
            : {}),
          ...(input.pmCompanyBankAccountName !== undefined
            ? { pmCompanyBankAccountName: input.pmCompanyBankAccountName ?? undefined }
            : {}),
          ...(input.pmCompanyBankAccountNumber !== undefined
            ? { pmCompanyBankAccountNumber: input.pmCompanyBankAccountNumber ?? undefined }
            : {}),
          ...(input.pmCompanyBankBranchCode !== undefined
            ? { pmCompanyBankBranchCode: input.pmCompanyBankBranchCode ?? undefined }
            : {}),

          ...(input.pmBrandPrimaryColor !== undefined
            ? { pmBrandPrimaryColor: input.pmBrandPrimaryColor ?? undefined }
            : {}),
          ...(input.pmBrandSecondaryColor !== undefined
            ? { pmBrandSecondaryColor: input.pmBrandSecondaryColor ?? undefined }
            : {}),
          ...(input.pmBrandAccentColor !== undefined
            ? { pmBrandAccentColor: input.pmBrandAccentColor ?? undefined }
            : {}),
        },
      });

      if (input.newPassword) {
        const hashedPassword = await bcryptjs.hash(input.newPassword, 10);
        await db.user.update({
          where: { id: input.propertyManagerId },
          data: { password: hashedPassword },
        });
      }

      return {
        success: true,
        propertyManager: {
          id: updated.id,
          firstName: updated.firstName,
          lastName: updated.lastName,
          email: updated.email,
          role: updated.role,
        },
        message: "Property Manager updated successfully",
      };
    } catch (error) {
      console.error("Error updating Property Manager:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update Property Manager",
      });
    }
  });
