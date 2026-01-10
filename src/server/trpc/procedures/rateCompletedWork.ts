import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const rateCompletedWorkSchema = z.object({
  token: z.string(),
  orderId: z.number(),
  contractorId: z.number(),
  qualityRating: z.number().min(1).max(5),
  timelinessRating: z.number().min(1).max(5),
  professionalismRating: z.number().min(1).max(5),
  communicationRating: z.number().min(1).max(5),
  overallRating: z.number().min(1).max(5),
  comments: z.string().optional(),
  kpiRatings: z.array(z.object({
    kpiId: z.number(),
    rating: z.number().min(1).max(5),
    notes: z.string().optional(),
  })).optional(),
});

export const rateCompletedWork = baseProcedure
  .input(rateCompletedWorkSchema)
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers can rate completed work",
      });
    }

    try {
      // Verify order exists and belongs to this property manager
      const order = await db.propertyManagerOrder.findFirst({
        where: {
          id: input.orderId,
          propertyManagerId: user.id,
        },
      });

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      // Try to find contractor in Contractor table first (third-party contractors)
      let contractor = await db.contractor.findFirst({
        where: {
          id: input.contractorId,
          propertyManagerId: user.id,
        },
      });

      // If not found, try User table (contractor portal users)
      let contractorUser = null;
      if (!contractor) {
        contractorUser = await db.user.findFirst({
          where: {
            id: input.contractorId,
            role: "CONTRACTOR",
          },
        });

        if (!contractorUser) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Contractor not found",
          });
        }
      }

      // Calculate average rating
      const averageRating = (
        input.qualityRating +
        input.timelinessRating +
        input.professionalismRating +
        input.communicationRating +
        input.overallRating
      ) / 5;

      // Update order with ratings
      await db.propertyManagerOrder.update({
        where: { id: input.orderId },
        data: {
          qualityRating: input.qualityRating,
          timelinessRating: input.timelinessRating,
          professionalismRating: input.professionalismRating,
          communicationRating: input.communicationRating,
          overallRating: input.overallRating,
          ratingComments: input.comments,
          ratedAt: new Date(),
        },
      });

      // Update contractor's average rating
      const contractorOrders = await db.propertyManagerOrder.findMany({
        where: {
          contractorId: input.contractorId,
          overallRating: { not: null },
        },
      });

      const totalRatings = contractorOrders.reduce((sum, order) => sum + (order.overallRating || 0), 0) + input.overallRating;
      const newAverageRating = totalRatings / (contractorOrders.length + 1);

      // Update contractor stats (only if it's a Contractor table entry)
      if (contractor) {
        await db.contractor.update({
          where: { id: input.contractorId },
          data: {
            averageRating: newAverageRating,
            totalJobsCompleted: contractor.totalJobsCompleted + 1,
          },
        });
      }
      // Note: For contractor portal users (User table), we don't update global stats
      // as those fields don't exist in the User model. The ratings are stored per order.

      // Update KPI actuals and performance metrics (only for Contractor table entries)
      if (contractor) {
        // Update KPI actuals if KPI ratings provided
        if (input.kpiRatings && input.kpiRatings.length > 0) {
          for (const kpiRating of input.kpiRatings) {
            const kpi = await db.contractorKPI.findUnique({
              where: { id: kpiRating.kpiId },
            });

            if (kpi) {
              // Increment actual value based on rating (simplified logic)
              const newActualValue = kpi.actualValue + (kpiRating.rating / 5); // Normalized contribution
              const achievementRate = (newActualValue / kpi.targetValue) * 100;

              await db.contractorKPI.update({
                where: { id: kpiRating.kpiId },
                data: {
                  actualValue: newActualValue,
                  achievementRate,
                  reviewedAt: new Date(),
                },
              });
            }
          }
        }

        // Update contractor performance metrics for current period
        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        let performance = await db.contractorPerformance.findFirst({
          where: {
            contractorId: input.contractorId,
            periodStart: { lte: now },
            periodEnd: { gte: now },
          },
        });

        if (!performance) {
          // Create new performance record for this period
          performance = await db.contractorPerformance.create({
            data: {
              contractorId: input.contractorId,
              periodStart,
              periodEnd,
              jobsCompleted: 1,
              jobsQuality: averageRating,
              qualityScore: averageRating * 20, // Convert to 0-100 scale
              overallRating: averageRating >= 4.5 ? "EXCELLENT" : averageRating >= 3.5 ? "GOOD" : "AVERAGE",
            },
          });
        } else {
          // Update existing performance record
          const newJobsCompleted = performance.jobsCompleted + 1;
          const newQualityAvg = ((performance.jobsQuality * performance.jobsCompleted) + averageRating) / newJobsCompleted;
          
          await db.contractorPerformance.update({
            where: { id: performance.id },
            data: {
              jobsCompleted: newJobsCompleted,
              jobsQuality: newQualityAvg,
              qualityScore: newQualityAvg * 20,
              overallRating: newQualityAvg >= 4.5 ? "EXCELLENT" : newQualityAvg >= 3.5 ? "GOOD" : "AVERAGE",
            },
          });
        }
      }

      return {
        success: true,
        averageRating,
        message: "Work rated successfully and contractor performance updated",
      };
    } catch (error) {
      console.error("Error rating completed work:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to rate work",
      });
    }
  });
