import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requirePermission, PERMISSIONS } from "~/server/utils/auth";
import { assertNotRestrictedDemoAccountAccessDenied } from "~/server/utils/demoAccounts";

export const getEmployees = baseProcedure
  .input(
    z.object({
      token: z.string(),
      role: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    assertNotRestrictedDemoAccountAccessDenied(user);
    
    // Contractors can view employees without special permission (their own employees)
    if (user.role !== "CONTRACTOR") {
      requirePermission(user, PERMISSIONS.VIEW_ALL_EMPLOYEES);
    }

    const where: any = {};
    if (input.role) where.role = input.role;
    if (user.role === "CONTRACTOR") where.employerId = user.id;

    const employees = await db.user.findMany({
      where,
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
