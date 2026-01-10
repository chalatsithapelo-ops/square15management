import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";

export const updateLeaveRequestStatus = baseProcedure
  .input(
    z.object({
      token: z.string(),
      leaveRequestId: z.number(),
      status: z.enum(["APPROVED", "REJECTED", "CANCELLED"]),
      rejectionReason: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    const leaveRequest = await db.leaveRequest.findUnique({
      where: { id: input.leaveRequestId },
    });

    if (!leaveRequest) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Leave request not found",
      });
    }

    const updatedLeaveRequest = await db.leaveRequest.update({
      where: { id: input.leaveRequestId },
      data: {
        status: input.status,
        approvedById: input.status === "APPROVED" ? user.id : undefined,
        approvedAt: input.status === "APPROVED" ? new Date() : undefined,
        rejectionReason: input.rejectionReason,
      },
    });

    return updatedLeaveRequest;
  });
