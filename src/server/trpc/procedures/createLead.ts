import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requirePermission, PERMISSIONS } from "~/server/utils/auth";

export const createLead = baseProcedure
  .input(
    z.object({
      token: z.string(),
      customerName: z.string().min(1),
      companyName: z.string().optional(),
      customerEmail: z.string().email(),
      customerPhone: z.string().min(1),
      address: z.string().optional(),
      serviceType: z.string().min(1),
      description: z.string().min(1),
      estimatedValue: z.number().optional(),
      nextFollowUpDate: z.string().datetime().optional(),
      followUpAssignedToId: z.number().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      // Authenticate and authorize the user
      const user = await authenticateUser(input.token);
      requirePermission(user, PERMISSIONS.MANAGE_LEADS, "You do not have permission to create new leads.");

      const lead = await db.lead.create({
        data: {
          customerName: input.customerName,
          companyName: input.companyName || null,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone,
          address: input.address || null,
          serviceType: input.serviceType,
          description: input.description,
          estimatedValue: input.estimatedValue || null,
          status: "NEW",
          createdById: user.id,
          nextFollowUpDate: input.nextFollowUpDate ? new Date(input.nextFollowUpDate) : null,
          followUpAssignedToId: input.followUpAssignedToId ?? user.id,
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
          followUpAssignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      return lead;
    } catch (error) {
      // Re-throw TRPCErrors as-is (includes FORBIDDEN from requirePermission)
      if (error instanceof TRPCError) {
        throw error;
      }
      // Fallback for unexpected errors
      console.error('[createLead] Unexpected error:', error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create lead",
      });
    }
  });
