import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const createBuilding = baseProcedure
  .input(
    z.object({
      token: z.string(),
      name: z.string().min(3),
      address: z.string().min(5),
      buildingType: z.string(),
      numberOfUnits: z.number().int().min(1).optional(),
      totalSquareFeet: z.number().positive().optional(),
      yearBuilt: z.number().int().optional(),
      estimatedValue: z.number().positive().optional(),
      monthlyExpenses: z.number().positive().optional(),
      photos: z.array(z.string()).optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    
    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers can add buildings.",
      });
    }
    
    try {
      const building = await db.building.create({
        data: {
          propertyManagerId: user.id,
          name: input.name,
          address: input.address,
          buildingType: input.buildingType,
          numberOfUnits: input.numberOfUnits,
          totalSquareFeet: input.totalSquareFeet,
          yearBuilt: input.yearBuilt,
          estimatedValue: input.estimatedValue,
          monthlyExpenses: input.monthlyExpenses,
          photos: input.photos || [],
          notes: input.notes,
          status: "ACTIVE",
        },
      });

      return building;
    } catch (error) {
      console.error("Error creating building:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create building.",
      });
    }
  });
