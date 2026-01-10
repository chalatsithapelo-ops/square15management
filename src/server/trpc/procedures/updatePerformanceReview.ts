import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";

export const updatePerformanceReview = baseProcedure
  .input(
    z.object({
      token: z.string(),
      reviewId: z.number(),
      status: z.enum(["DRAFT", "PENDING_EMPLOYEE_ACKNOWLEDGMENT", "COMPLETED", "ARCHIVED"]).optional(),
      
      // Category Ratings (1-5 scale)
      qualityOfWork: z.number().min(1).max(5).optional(),
      productivity: z.number().min(1).max(5).optional(),
      communication: z.number().min(1).max(5).optional(),
      teamwork: z.number().min(1).max(5).optional(),
      initiative: z.number().min(1).max(5).optional(),
      problemSolving: z.number().min(1).max(5).optional(),
      reliability: z.number().min(1).max(5).optional(),
      customerService: z.number().min(1).max(5).optional(),
      technicalSkills: z.number().min(1).max(5).optional(),
      leadership: z.number().min(1).max(5).optional(),
      
      // Text fields
      keyAchievements: z.string().optional(),
      strengths: z.string().optional(),
      areasForImprovement: z.string().optional(),
      improvementActions: z.string().optional(),
      goalsForNextPeriod: z.string().optional(),
      trainingNeeds: z.string().optional(),
      careerDevelopment: z.string().optional(),
      reviewerComments: z.string().optional(),
      employeeComments: z.string().optional(),
      notes: z.string().optional(),
      
      // Acknowledgment
      markAsAcknowledged: z.boolean().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    // Verify review exists
    const existingReview = await db.performanceReview.findUnique({
      where: { id: input.reviewId },
    });

    if (!existingReview) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Performance review not found",
      });
    }

    // Calculate overall rating if any category ratings are provided
    const ratings = [
      input.qualityOfWork,
      input.productivity,
      input.communication,
      input.teamwork,
      input.initiative,
      input.problemSolving,
      input.reliability,
      input.customerService,
      input.technicalSkills,
      input.leadership,
    ].filter((r): r is number => r !== undefined);

    const overallRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : undefined;

    // Prepare update data
    const updateData: any = {
      ...(input.status && { status: input.status }),
      ...(input.qualityOfWork !== undefined && { qualityOfWork: input.qualityOfWork }),
      ...(input.productivity !== undefined && { productivity: input.productivity }),
      ...(input.communication !== undefined && { communication: input.communication }),
      ...(input.teamwork !== undefined && { teamwork: input.teamwork }),
      ...(input.initiative !== undefined && { initiative: input.initiative }),
      ...(input.problemSolving !== undefined && { problemSolving: input.problemSolving }),
      ...(input.reliability !== undefined && { reliability: input.reliability }),
      ...(input.customerService !== undefined && { customerService: input.customerService }),
      ...(input.technicalSkills !== undefined && { technicalSkills: input.technicalSkills }),
      ...(input.leadership !== undefined && { leadership: input.leadership }),
      ...(overallRating !== undefined && { overallRating }),
      ...(input.keyAchievements !== undefined && { keyAchievements: input.keyAchievements }),
      ...(input.strengths !== undefined && { strengths: input.strengths }),
      ...(input.areasForImprovement !== undefined && { areasForImprovement: input.areasForImprovement }),
      ...(input.improvementActions !== undefined && { improvementActions: input.improvementActions }),
      ...(input.goalsForNextPeriod !== undefined && { goalsForNextPeriod: input.goalsForNextPeriod }),
      ...(input.trainingNeeds !== undefined && { trainingNeeds: input.trainingNeeds }),
      ...(input.careerDevelopment !== undefined && { careerDevelopment: input.careerDevelopment }),
      ...(input.reviewerComments !== undefined && { reviewerComments: input.reviewerComments }),
      ...(input.employeeComments !== undefined && { employeeComments: input.employeeComments }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.markAsAcknowledged && { employeeAcknowledgedAt: new Date() }),
    };

    // Update the review
    const review = await db.performanceReview.update({
      where: { id: input.reviewId },
      data: updateData,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return {
      success: true,
      review,
    };
  });
