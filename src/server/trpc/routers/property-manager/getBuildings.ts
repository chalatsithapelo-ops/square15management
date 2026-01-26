import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { TRPCError } from "@trpc/server";

export const getBuildings = baseProcedure
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

    const buildings = await db.building.findMany({
      where: {
        propertyManagerId: propertyManagerId,
      },
      select: {
        id: true,
        name: true,
        address: true,
        buildingType: true,
        status: true,
        numberOfUnits: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return buildings;
  });
