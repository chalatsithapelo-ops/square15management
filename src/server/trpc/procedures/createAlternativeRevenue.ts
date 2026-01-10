import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const createAlternativeRevenue = baseProcedure
  .input(
    z.object({
      token: z.string(),
      date: z.string(),
      category: z.enum([
        "CONSULTING",
        "RENTAL_INCOME",
        "INTEREST",
        "INVESTMENTS",
        "GRANTS",
        "DONATIONS",
        "OTHER",
      ]),
      description: z.string().min(1),
      amount: z.number().positive(),
      source: z.string().optional(),
      referenceNumber: z.string().optional(),
      notes: z.string().optional(),
      documentUrl: z.string().optional(),
      isRecurring: z.boolean().default(false),
      recurringPeriod: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    // Create the alternative revenue
    const revenue = await db.alternativeRevenue.create({
      data: {
        date: new Date(input.date),
        category: input.category,
        description: input.description,
        amount: input.amount,
        source: input.source || null,
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
        recipientRole: seniorRoles[0],
        message: `${user.firstName} ${user.lastName} added alternative revenue: ${input.description} (R ${input.amount.toFixed(2)})`,
        type: "ALTERNATIVE_REVENUE_ADDED" as const,
        relatedEntityId: revenue.id,
        relatedEntityType: "ALTERNATIVE_REVENUE",
      }));

      if (notifications.length > 0) {
        await db.notification.createMany({
          data: notifications,
        });
      }
    }

    return revenue;
  });
