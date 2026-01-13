import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const rateCompletedWorkSchema = z.object({
  token: z.string(),
  orderId: z.number(),
  // NOTE: PropertyManagerOrder.contractorId points to a User (contractor portal user)
  contractorId: z.number(),
  // Optional: Contractor management table id (for updating Contractor/KPI/performance records)
  contractorManagementId: z.number().optional(),
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
        select: {
          id: true,
          contractorId: true,
          assignedToId: true,
          ratedAt: true,
        },
      });

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      const wasAlreadyRated = !!order.ratedAt;

      // If the order already has a contractor assigned, enforce consistency.
      // Otherwise, allow assigning it now (some older orders may have null contractorId).
      const contractorUserId = order.contractorId ?? input.contractorId;
      if (order.contractorId && order.contractorId !== input.contractorId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selected contractor does not match the order contractor",
        });
      }

      // Load contractor user (PropertyManagerOrder.contractorId is a User relation)
      const contractorUser = await db.user.findFirst({
        where: {
          id: contractorUserId,
          role: { in: ["CONTRACTOR", "CONTRACTOR_SENIOR_MANAGER"] },
        },
        select: { id: true, email: true },
      });

      if (!contractorUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contractor not found",
        });
      }

      // Resolve Contractor management record (used by PM + contractor dashboards)
      const contractorRecord = input.contractorManagementId
        ? await db.contractor.findFirst({
            where: {
              id: input.contractorManagementId,
              propertyManagerId: user.id,
            },
            select: { id: true },
          })
        : await db.contractor.findFirst({
            where: {
              propertyManagerId: user.id,
              email: { equals: contractorUser.email, mode: "insensitive" },
            },
            select: { id: true },
          });

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
          contractorId: order.contractorId ?? contractorUserId,
          qualityRating: input.qualityRating,
          timelinessRating: input.timelinessRating,
          professionalismRating: input.professionalismRating,
          communicationRating: input.communicationRating,
          overallRating: input.overallRating,
          ratingComments: input.comments,
          ratedAt: new Date(),
        },
      });

      // Recompute contractor average rating across all PM orders for this contractor user
      const contractorRatingsAgg = await db.propertyManagerOrder.aggregate({
        where: {
          contractorId: contractorUserId,
          overallRating: { not: null },
        },
        _avg: { overallRating: true },
        _count: { _all: true },
      });

      const newAverageRating = contractorRatingsAgg._avg.overallRating ?? 0;
      const ratedJobsCount = contractorRatingsAgg._count._all ?? 0;

      // Update contractor management stats when a mapped record exists
      if (contractorRecord) {
        await db.contractor.update({
          where: { id: contractorRecord.id },
          data: {
            averageRating: newAverageRating,
            totalJobsCompleted: ratedJobsCount,
          },
        });
      }

      // Update KPI actuals and performance metrics (only when we have a Contractor record)
      if (contractorRecord) {
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
            contractorId: contractorRecord.id,
            periodStart: { lte: now },
            periodEnd: { gte: now },
          },
        });

        if (!performance) {
          // Create new performance record for this period
          performance = await db.contractorPerformance.create({
            data: {
              contractorId: contractorRecord.id,
              periodStart,
              periodEnd,
              jobsCompleted: wasAlreadyRated ? 0 : 1,
              jobsQuality: averageRating,
              qualityScore: averageRating * 20, // Convert to 0-100 scale
              overallRating: averageRating >= 4.5 ? "EXCELLENT" : averageRating >= 3.5 ? "GOOD" : "AVERAGE",
            },
          });
        } else {
          // Update existing performance record
          // Avoid inflating counts on re-rates
          const newJobsCompleted = wasAlreadyRated ? performance.jobsCompleted : performance.jobsCompleted + 1;
          const newQualityAvg = wasAlreadyRated
            ? performance.jobsQuality
            : ((performance.jobsQuality * performance.jobsCompleted) + averageRating) / newJobsCompleted;
          
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

      // If an artisan was assigned to this PM order, propagate a review-like signal so the artisan portal reflects it.
      // This leverages the existing Review-based artisan rating calculations.
      if (order.assignedToId) {
        try {
          await db.review.create({
            data: {
              customerId: user.id,
              artisanId: order.assignedToId,
              rating: input.overallRating,
              comment: input.comments || null,
              serviceQuality: input.qualityRating,
              professionalism: input.professionalismRating,
              timeliness: input.timelinessRating,
            },
          });
        } catch (e) {
          // Non-fatal: rating still persisted on the PM order.
          console.warn("Failed to create artisan review from PM rating", e);
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
