import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";

export const getLeaveRequests = baseProcedure
  .input(
    z.object({
      token: z.string(),
      employeeId: z.number().optional(),
      status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    
    // Non-admins can only see their own leave requests
    const employeeFilter = isAdmin(user) 
      ? input.employeeId 
      : user.id;

    const leaveRequests = await db.leaveRequest.findMany({
      where: {
        employeeId: employeeFilter,
        status: input.status,
        ...(input.startDate && input.endDate ? {
          OR: [
            {
              startDate: {
                gte: new Date(input.startDate),
                lte: new Date(input.endDate),
              },
            },
            {
              endDate: {
                gte: new Date(input.startDate),
                lte: new Date(input.endDate),
              },
            },
          ],
        } : {}),
      },
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
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return leaveRequests;
  });
