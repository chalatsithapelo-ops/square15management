import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const createLeaveRequest = baseProcedure
  .input(
    z.object({
      token: z.string(),
      employeeId: z.number().optional(), // If not provided, use current user
      leaveType: z.enum([
        "ANNUAL",
        "SICK",
        "UNPAID",
        "MATERNITY",
        "PATERNITY",
        "STUDY",
        "FAMILY_RESPONSIBILITY",
        "OTHER",
      ]),
      startDate: z.string(),
      endDate: z.string(),
      totalDays: z.number(),
      reason: z.string(),
      supportingDocumentUrl: z.string().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    
    // Use provided employeeId or default to current user
    const employeeId = input.employeeId || user.id;
    
    // Check if user is trying to create leave for someone else
    if (employeeId !== user.id && user.role !== "SENIOR_ADMIN" && user.role !== "JUNIOR_ADMIN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You can only create leave requests for yourself",
      });
    }

    const employee = await db.user.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Employee not found",
      });
    }

    const leaveRequest = await db.leaveRequest.create({
      data: {
        employeeId,
        leaveType: input.leaveType,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        totalDays: input.totalDays,
        reason: input.reason,
        supportingDocumentUrl: input.supportingDocumentUrl,
        notes: input.notes,
      },
    });

    return leaveRequest;
  });
