import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const getPendingOnboardings = baseProcedure
  .input(
    z.object({
      token: z.string(),
      propertyManagerId: z.number().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    const userId = user.id;
    const propertyManagerId = input.propertyManagerId || userId;

    const pendingOnboardings = await db.propertyManagerCustomer.findMany({
      where: {
        propertyManagerId: propertyManagerId,
        onboardingStatus: "PENDING",
      },
      include: {
        building: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        onboardedDate: "desc",
      },
    });

    return pendingOnboardings;
  });
