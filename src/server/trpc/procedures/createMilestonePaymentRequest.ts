import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { assertCanAccessProject } from "~/server/utils/project-access";

export const createMilestonePaymentRequest = baseProcedure
  .input(
    z.object({
      token: z.string(),
      milestoneId: z.number(),
      artisanId: z.number(),
      hoursWorked: z.number().optional(),
      daysWorked: z.number().optional(),
      hourlyRate: z.number().optional(),
      dailyRate: z.number().optional(),
      calculatedAmount: z.number(),
      isPartialPayment: z.boolean().default(false),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const user = await authenticateUser(input.token);

      const isAdmin = user.role === "JUNIOR_ADMIN" || user.role === "SENIOR_ADMIN";
      const isContractorRole =
        user.role === "CONTRACTOR" ||
        user.role === "CONTRACTOR_SENIOR_MANAGER" ||
        user.role === "CONTRACTOR_JUNIOR_MANAGER";

      if (!isAdmin && !isContractorRole) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only contractors or admins can submit milestone payment requests",
        });
      }

      // Verify milestone exists and is completed
      const milestone = await db.milestone.findUnique({
        where: { id: input.milestoneId },
      });

      if (!milestone) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Milestone not found",
        });
      }

      // Enforce that the submitter has access to the milestone's project.
      await assertCanAccessProject(user, milestone.projectId);

      // Contractors can only submit for themselves.
      if (isContractorRole && input.artisanId !== user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only submit payment requests for your own account",
        });
      }

      // Generate unique request number
      const count = await db.paymentRequest.count();
      const requestNumber = `PAY-MS-${String(count + 1).padStart(5, "0")}`;

      const paymentRequest = await db.paymentRequest.create({
        data: {
          requestNumber,
          artisanId: input.artisanId,
          milestoneId: input.milestoneId,
          orderIds: [], // No order IDs for milestone payments
          hoursWorked: input.hoursWorked || null,
          daysWorked: input.daysWorked || null,
          hourlyRate: input.hourlyRate || null,
          dailyRate: input.dailyRate || null,
          calculatedAmount: input.calculatedAmount,
          notes: input.notes
            ? `${input.isPartialPayment ? "PARTIAL PAYMENT - " : ""}${input.notes}`
            : input.isPartialPayment
            ? "PARTIAL PAYMENT for milestone completion"
            : "Payment for milestone completion",
          status: "PENDING",
        },
        include: {
          artisan: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              hourlyRate: true,
              dailyRate: true,
            },
          },
          milestone: {
            select: {
              id: true,
              name: true,
              projectId: true,
            },
          },
        },
      });

      return paymentRequest;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create payment request",
      });
    }
  });
