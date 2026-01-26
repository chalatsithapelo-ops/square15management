import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requirePermission, PERMISSIONS } from "~/server/utils/auth";
import { hasPermission } from "~/server/utils/permissions";

export const getPayslips = baseProcedure
  .input(
    z.object({
      token: z.string(),
      employeeId: z.number().optional(),
      status: z.enum(["GENERATED", "SENT", "VIEWED"]).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const where: any = {};
    
    // Apply filters
    if (input.status) {
      where.status = input.status;
    }
    
    if (input.startDate) {
      where.paymentDate = {
        ...where.paymentDate,
        gte: new Date(input.startDate),
      };
    }
    
    if (input.endDate) {
      where.paymentDate = {
        ...where.paymentDate,
        lte: new Date(input.endDate),
      };
    }
    
    // Must be allowed to view payslips at all
    requirePermission(user, PERMISSIONS.VIEW_PAYSLIPS);

    // Check if user can view all payslips or only their own
    const canViewAll =
      hasPermission(user.role, PERMISSIONS.MANAGE_PAYSLIPS) ||
      hasPermission(user.role, PERMISSIONS.VIEW_ALL_EMPLOYEES) ||
      hasPermission(user.role, PERMISSIONS.MANAGE_ALL_EMPLOYEES);
    
    if (canViewAll) {
      // Admin/manager can view all or filter by specific employee
      if (input.employeeId) {
        where.employeeId = input.employeeId;
      }
    } else {
      // Regular employees can only view their own payslips
      where.employeeId = user.id;
    }

    const payslips = await db.payslip.findMany({
      where,
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
        paymentRequest: {
          select: {
            id: true,
            requestNumber: true,
            status: true,
          },
        },
      },
      orderBy: {
        paymentDate: "desc",
      },
    });

    return payslips;
  });
