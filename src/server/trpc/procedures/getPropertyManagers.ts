import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const getPropertyManagers = baseProcedure
  .input(
    z.object({
      token: z.string(),
      searchQuery: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "JUNIOR_ADMIN" && user.role !== "SENIOR_ADMIN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Admin users can view Property Managers",
      });
    }

    const where: any = {
      role: "PROPERTY_MANAGER",
    };

    if (input.searchQuery?.trim()) {
      const q = input.searchQuery.trim();
      where.OR = [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { pmCompanyName: { contains: q, mode: "insensitive" } },
      ];
    }

    const propertyManagers = await db.user.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        pmCompanyName: true,
        pmCompanyPhone: true,
        pmCompanyEmail: true,
        subscriptions: {
          select: {
            id: true,
            status: true,
            currentUsers: true,
            maxUsers: true,
            trialEndDate: true,
            nextBillingDate: true,
            package: {
              select: {
                id: true,
                name: true,
                displayName: true,
                basePrice: true,
                type: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      propertyManagers,
    };
  });
