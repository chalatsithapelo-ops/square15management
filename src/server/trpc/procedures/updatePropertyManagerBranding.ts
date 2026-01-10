import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { db } from "~/server/db";

const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

export const updatePropertyManagerBranding = baseProcedure
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

    // Only allow property managers to update their branding
    if (user.role !== "PROPERTY_MANAGER") {
      throw new Error("Only Property Managers can update branding");
    }

    // Build update data object
    const updateData: Record<string, string> = {};
    if (input.primaryColor !== undefined) updateData.pmBrandPrimaryColor = input.primaryColor;
    if (input.secondaryColor !== undefined) updateData.pmBrandSecondaryColor = input.secondaryColor;
    if (input.accentColor !== undefined) updateData.pmBrandAccentColor = input.accentColor;

    // Update the user record
    await db.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return {
      success: true,
    };
  });
