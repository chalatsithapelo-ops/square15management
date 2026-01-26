import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const createOperationalExpense = baseProcedure
  .input(
    z.object({
      token: z.string(),
      date: z.string(),
      category: z.enum([
        "PETROL",
        "OFFICE_SUPPLIES",
        "RENT",
        "UTILITIES",
        "INSURANCE",
        "SALARIES",
        "MARKETING",
        "MAINTENANCE",
        "TRAVEL",
        "PROFESSIONAL_FEES",
        "TELECOMMUNICATIONS",
        "SOFTWARE_SUBSCRIPTIONS",
        "OTHER",
      ]),
      description: z.string().min(1),
      amount: z.number().positive(),
      vendor: z.string().optional(),
      referenceNumber: z.string().optional(),
      notes: z.string().optional(),
      documentUrl: z.string().optional(),
      isRecurring: z.boolean().default(false),
      recurringPeriod: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    // Create the operational expense
    const expense = await db.operationalExpense.create({
      data: {
        date: new Date(input.date),
        category: input.category,
        description: input.description,
        amount: input.amount,
        vendor: input.vendor || null,
        referenceNumber: input.referenceNumber || null,
        notes: input.notes || null,
        documentUrl: input.documentUrl || null,
        isRecurring: input.isRecurring,
        recurringPeriod: input.recurringPeriod || null,
        createdById: user.id,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Notify senior users based on user role
    let seniorRoles: string[] = [];
    
    if (user.role.includes("ADMIN")) {
      seniorRoles = ["SENIOR_ADMIN"];
    } else if (user.role.includes("CONTRACTOR")) {
      seniorRoles = ["SENIOR_CONTRACTOR_MANAGER"];
    }

    if (seniorRoles.length > 0) {
      const recipientRole = seniorRoles[0] ?? "SENIOR_ADMIN";
      // Find all senior users
      const seniorUsers = await db.user.findMany({
        where: {
          role: {
            in: seniorRoles,
          },
        },
        select: {
          id: true,
        },
      });

      // Create notifications for senior users
      const notifications = seniorUsers.map((seniorUser) => ({
        recipientId: seniorUser.id,
        recipientRole,
        message: `${user.firstName} ${user.lastName} added a new operational expense: ${input.description} (R ${input.amount.toFixed(2)})`,
        type: "OPERATIONAL_EXPENSE_ADDED" as const,
        relatedEntityId: expense.id,
        relatedEntityType: "OPERATIONAL_EXPENSE",
      }));

      if (notifications.length > 0) {
        await db.notification.createMany({
          data: notifications,
        });
      }
    }

    return expense;
  });
