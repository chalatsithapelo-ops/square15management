import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { db } from "~/server/db";

export const getPropertyManagerBranding = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const pmUser = await db.user.findUnique({
      where: { id: user.id },
      select: {
        pmBrandPrimaryColor: true,
        pmBrandSecondaryColor: true,
        pmBrandAccentColor: true,
      },
    });

    return {
      primaryColor: pmUser?.pmBrandPrimaryColor || "#2D5016",
      secondaryColor: pmUser?.pmBrandSecondaryColor || "#F4C430",
      accentColor: pmUser?.pmBrandAccentColor || "#5A9A47",
    };
  });
