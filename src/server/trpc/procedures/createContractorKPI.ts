import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const createContractorKPISchema = z.object({
  token: z.string(),
  contractorId: z.number(),
  kpiName: z.string().min(1, "KPI name is required"),
  description: z.string().optional(),
  targetValue: z.number().min(0),
  unit: z.string().default("jobs"),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]),
  periodStart: z.date(),
  periodEnd: z.date(),
});

export const createContractorKPI = baseProcedure
  .input(createContractorKPISchema)
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers can create contractor KPIs",
      });
    }

    try {
      // Verify contractor belongs to this property manager
      const contractor = await db.contractor.findFirst({
        where: {
          id: input.contractorId,
          propertyManagerId: user.id,
        },
      });

      if (!contractor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contractor not found",
        });
      }

      const kpi = await db.contractorKPI.create({
        data: {
          contractorId: input.contractorId,
          kpiName: input.kpiName,
          description: input.description,
          targetValue: input.targetValue,
          unit: input.unit,
          frequency: input.frequency,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          status: "ACTIVE",
        },
      });

      return {
        success: true,
        kpi: {
          id: kpi.id,
          kpiName: kpi.kpiName,
          targetValue: kpi.targetValue,
          unit: kpi.unit,
          frequency: kpi.frequency,
        },
        message: "KPI created successfully",
      };
    } catch (error) {
      console.error("Error creating contractor KPI:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create KPI",
      });
    }
  });
