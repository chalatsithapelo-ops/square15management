import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
import { TRPCError } from "@trpc/server";

export const getPropertyManagerInvoices = baseProcedure
  .input(
    z.object({
      token: z.string(),
      status: z.string().optional(),
      propertyManagerId: z.number().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const userIsAdmin = isAdmin(user);
    const isContractor = user.role === "CONTRACTOR" || user.role === "CONTRACTOR_JUNIOR_MANAGER" || user.role === "CONTRACTOR_SENIOR_MANAGER";

    if (!userIsAdmin && user.role !== "PROPERTY_MANAGER" && !isContractor) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers, Contractors, and Admins can view invoices.",
      });
    }

    const where: any = {};

    // Contractors can only see invoices for their own PM orders
    if (isContractor && !userIsAdmin) {
      where.order = {
        contractorId: user.id,
      };
      // Contractors can see all statuses of their invoices (for workflow tracking)
    }
    // Property managers can only see their own invoices
    else if (!userIsAdmin && user.role === "PROPERTY_MANAGER") {
      where.propertyManagerId = user.id;
      // Property managers should only see invoices that have been sent to them or already processed
      // Hide DRAFT status invoices (still in contractor approval workflow)
      if (!input.status) {
        // Default: show all visible statuses including ADMIN_APPROVED (awaiting PM review)
        where.status = {
          in: ["SENT_TO_PM", "PM_APPROVED", "PM_REJECTED", "PAID", "OVERDUE", "ADMIN_APPROVED"],
        };
      } else {
        // If specific status requested, ensure it's one PMs are allowed to see
        const allowedStatuses = ["SENT_TO_PM", "PM_APPROVED", "PM_REJECTED", "PAID", "OVERDUE", "ADMIN_APPROVED"];
        if (allowedStatuses.includes(input.status)) {
          where.status = input.status;
        } else {
          // If requesting a status they shouldn't see, return empty results
          where.id = -1;
        }
      }
    } else if (input.propertyManagerId) {
      // Admins can filter by property manager
      where.propertyManagerId = input.propertyManagerId;
      // Allow explicit status filtering for admins
      if (input.status) {
        where.status = input.status;
      }
    }

    const invoices = await db.propertyManagerInvoice.findMany({
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
        order: {
          select: {
            id: true,
            orderNumber: true,
            title: true,
            buildingName: true,
            buildingAddress: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return invoices;
  });
