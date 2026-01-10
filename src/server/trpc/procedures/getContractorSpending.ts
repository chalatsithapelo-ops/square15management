import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const getContractorSpending = baseProcedure
  .input(
    z.object({
      token: z.string(),
      contractorId: z.number().optional(),
      periodStart: z.date().optional(),
      periodEnd: z.date().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers can view spending data",
      });
    }

    try {
      if (input.contractorId) {
        // Single contractor spending
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

        return {
          success: true,
          type: "SINGLE_CONTRACTOR",
          contractor: {
            id: contractor.id,
            name: `${contractor.firstName} ${contractor.lastName}`,
            companyName: contractor.companyName,
            serviceType: contractor.serviceType,
            totalSpent: contractor.totalSpent,
            totalJobsCompleted: contractor.totalJobsCompleted,
            averageJobValue: contractor.totalJobsCompleted > 0 ? contractor.totalSpent / contractor.totalJobsCompleted : 0,
          },
        };
      } else {
        // All contractors spending for property manager
        const contractors = await db.contractor.findMany({
          where: { propertyManagerId: user.id },
        });

        const totalSpent = contractors.reduce((sum, c) => sum + c.totalSpent, 0);
        const totalJobs = contractors.reduce((sum, c) => sum + c.totalJobsCompleted, 0);

        // Group by service type
        const spendingByServiceType: any = {};
        contractors.forEach((c) => {
          if (!spendingByServiceType[c.serviceType]) {
            spendingByServiceType[c.serviceType] = {
              serviceType: c.serviceType,
              totalSpent: 0,
              numberOfContractors: 0,
              jobsCompleted: 0,
            };
          }
          spendingByServiceType[c.serviceType].totalSpent += c.totalSpent;
          spendingByServiceType[c.serviceType].numberOfContractors += 1;
          spendingByServiceType[c.serviceType].jobsCompleted += c.totalJobsCompleted;
        });

        return {
          success: true,
          type: "ALL_CONTRACTORS",
          summary: {
            totalContractors: contractors.length,
            totalSpent,
            totalJobs,
            averageSpentPerContractor: contractors.length > 0 ? totalSpent / contractors.length : 0,
            averageSpentPerJob: totalJobs > 0 ? totalSpent / totalJobs : 0,
          },
          spendingByServiceType: Object.values(spendingByServiceType),
          topContractors: contractors
            .sort((a, b) => b.totalSpent - a.totalSpent)
            .slice(0, 10)
            .map((c) => ({
              id: c.id,
              name: `${c.firstName} ${c.lastName}`,
              companyName: c.companyName,
              serviceType: c.serviceType,
              totalSpent: c.totalSpent,
              totalJobs: c.totalJobsCompleted,
              averageJobValue: c.totalJobsCompleted > 0 ? c.totalSpent / c.totalJobsCompleted : 0,
            })),
        };
      }
    } catch (error) {
      console.error("Error fetching spending data:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch spending data",
      });
    }
  });
