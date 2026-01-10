import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requirePermission, PERMISSIONS } from "~/server/utils/auth";

export const getEmployees = baseProcedure
  .input(
    z.object({
      token: z.string(),
      role: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    
    // Contractors can view employees without special permission (their own employees)
    // TODO: Add employerId field to User model to properly filter contractor employees
    if (user.role !== "CONTRACTOR") {
      requirePermission(user, PERMISSIONS.VIEW_ALL_EMPLOYEES);
    }

    const employees = await db.user.findMany({
      where: input.role ? { role: input.role } : undefined,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        hourlyRate: true,
        dailyRate: true,
        monthlySalary: true,
        monthlyPaymentDay: true,
        createdAt: true,
      },
      orderBy: [
        { role: "asc" },
        { firstName: "asc" },
      ],
    });

    return employees;
  });
