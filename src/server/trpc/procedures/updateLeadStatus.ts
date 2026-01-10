import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";

export const updateLeadStatus = baseProcedure
  .input(
    z.object({
      token: z.string(),
      leadId: z.number(),
      status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST"]),
      notes: z.string().optional(),
      nextFollowUpDate: z.string().datetime().optional(),
      followUpAssignedToId: z.number().optional(),
    })
  )
  .mutation(async ({ input }) => {
    // Authenticate the user and get their role
    const user = await authenticateUser(input.token);

    // Fetch the lead to verify it exists and check ownership
    const existingLead = await db.lead.findUnique({
      where: { id: input.leadId },
      select: { id: true, createdById: true },
    });

    if (!existingLead) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Lead not found",
      });
    }

    // Check if user has permission to update this lead
    // Admins can update any lead, non-admins can only update their own leads
    if (!isAdmin(user) && existingLead.createdById !== user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to update this lead",
      });
    }

    // Update the lead
    const lead = await db.lead.update({
      where: { id: input.leadId },
      data: {
        status: input.status,
        notes: input.notes || undefined,
        nextFollowUpDate: input.nextFollowUpDate ? new Date(input.nextFollowUpDate) : undefined,
        followUpAssignedToId: input.followUpAssignedToId || undefined,
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
  });
