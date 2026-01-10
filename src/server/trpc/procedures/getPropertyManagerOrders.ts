import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
import { TRPCError } from "@trpc/server";

export const getPropertyManagerOrders = baseProcedure
  .input(
    z.object({
      token: z.string(),
      status: z.string().nullish(),
      propertyManagerId: z.number().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const userIsAdmin = isAdmin(user);

    const isContractorRole =
      user.role === "CONTRACTOR" ||
      user.role === "CONTRACTOR_SENIOR_MANAGER" ||
      user.role === "CONTRACTOR_JUNIOR_MANAGER";

    if (!userIsAdmin && user.role !== "PROPERTY_MANAGER" && !isContractorRole) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers, Contractors and Admins can view orders.",
      });
    }

    const where: any = {};

    if (user.role === "PROPERTY_MANAGER") {
      // Property managers can only see their own orders
      where.propertyManagerId = user.id;
    } else if (isContractorRole) {
      // Contractors only see orders assigned to them
      where.contractorId = user.id;
    } else if (userIsAdmin) {
      // Admins can filter by specific PM, or see all orders if no filter specified
      if (input.propertyManagerId) {
        where.propertyManagerId = input.propertyManagerId;
      }
      // Don't add contractorId filter - let admins see all orders
    }

    if (input.status) {
      where.status = input.status;
    }

    const orders = await db.propertyManagerOrder.findMany({
      where,
      include: {
        propertyManager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        contractor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        generatedFromRFQ: true,
        sourceRFQ: true,
        invoices: true,
        progressUpdates: {
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return orders;
  });
