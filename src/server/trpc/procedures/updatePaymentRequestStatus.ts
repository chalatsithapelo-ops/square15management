import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { assertCanAccessProject } from "~/server/utils/project-access";
import { ensureArtisanPaymentStatement } from "~/server/services/financeAutomation/artisanStatements";

export const updatePaymentRequestStatus = baseProcedure
  .input(
    z.object({
      token: z.string(),
      paymentRequestId: z.number(),
      status: z.enum(["PENDING", "APPROVED", "REJECTED", "PAID"]),
      rejectionReason: z.string().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const user = await authenticateUser(input.token);

      const isPropertyManager = user.role === "PROPERTY_MANAGER";
      const isAdmin = user.role === "JUNIOR_ADMIN" || user.role === "SENIOR_ADMIN";

      if (!isPropertyManager && !isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to update payment requests",
        });
      }

      if (input.status === "PAID" && !isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can mark a payment request as PAID",
        });
      }

      const existing = await db.paymentRequest.findUnique({
        where: { id: input.paymentRequestId },
        select: {
          id: true,
          notes: true,
          calculatedAmount: true,
          artisanId: true,
          hoursWorked: true,
          daysWorked: true,
          hourlyRate: true,
          dailyRate: true,
          milestone: {
            select: {
              projectId: true,
              name: true,
            },
          },
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payment request not found",
        });
      }

      // PM can only act on payment requests for projects they manage.
      if (existing.milestone?.projectId) {
        await assertCanAccessProject(user, existing.milestone.projectId);
      }

      if (input.status === "REJECTED" && !input.rejectionReason?.trim()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Rejection reason is required",
        });
      }

      const updateData: any = {
        status: input.status,
        rejectionReason: input.rejectionReason || null,
      };

      if (input.notes?.trim()) {
        updateData.notes = existing.notes
          ? `${existing.notes}\n\n${input.notes.trim()}`
          : input.notes.trim();
      }

      if (input.status === "APPROVED") {
        updateData.approvedDate = new Date();
      }

      if (input.status === "PAID") {
        updateData.paidDate = new Date();
      }

      const paymentRequest = await db.paymentRequest.update({
        where: { id: input.paymentRequestId },
        data: updateData,
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
        },
      });

      if (input.status === "PAID") {
        await ensureArtisanPaymentStatement(paymentRequest.id, true);
      }

      return paymentRequest;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update payment request",
      });
    }
  });
