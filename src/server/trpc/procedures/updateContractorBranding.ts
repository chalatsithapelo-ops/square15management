import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { db } from "~/server/db";

const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

export const updateContractorBranding = baseProcedure
  .input(
    z.object({
      token: z.string(),
      primaryColor: z.string().regex(hexColorRegex, "Must be a valid hex color").optional(),
      secondaryColor: z.string().regex(hexColorRegex, "Must be a valid hex color").optional(),
      accentColor: z.string().regex(hexColorRegex, "Must be a valid hex color").optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    // Allow all contractor roles to update their branding
    const isContractorRole = user.role === "CONTRACTOR" || 
                            user.role === "CONTRACTOR_SENIOR_MANAGER" || 
                            user.role === "CONTRACTOR_JUNIOR_MANAGER";
    if (!isContractorRole) {
      throw new Error("Only Contractors can update branding");
    }

    // Build update data object
    const updateData: Record<string, string> = {};
    if (input.primaryColor !== undefined) updateData.contractorBrandPrimaryColor = input.primaryColor;
    if (input.secondaryColor !== undefined) updateData.contractorBrandSecondaryColor = input.secondaryColor;
    if (input.accentColor !== undefined) updateData.contractorBrandAccentColor = input.accentColor;

    // Update the user record
    await db.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return {
      success: true,
    };
  });
