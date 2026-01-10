import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { db } from "~/server/db";

export const getContractorBranding = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const contractorUser = await db.user.findUnique({
      where: { id: user.id },
      select: {
        contractorBrandPrimaryColor: true,
        contractorBrandSecondaryColor: true,
        contractorBrandAccentColor: true,
      },
    });

    return {
      primaryColor: contractorUser?.contractorBrandPrimaryColor || "#2D5016",
      secondaryColor: contractorUser?.contractorBrandSecondaryColor || "#F4C430",
      accentColor: contractorUser?.contractorBrandAccentColor || "#5A9A47",
    };
  });
