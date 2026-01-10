import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";

export const updateLeadDetails = baseProcedure
  .input(
    z.object({
      token: z.string(),
      leadId: z.number(),
      customerName: z.string().min(1).optional(),
      companyName: z.string().optional(),
      customerEmail: z.string().email().optional(),
      customerPhone: z.string().min(1).optional(),
      address: z.string().optional(),
      serviceType: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      estimatedValue: z.number().optional(),
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

    // Build update data object with only provided fields
    const updateData: any = {};
    
    if (input.customerName !== undefined) updateData.customerName = input.customerName;
    if (input.companyName !== undefined) updateData.companyName = input.companyName || null;
    if (input.customerEmail !== undefined) updateData.customerEmail = input.customerEmail;
    if (input.customerPhone !== undefined) updateData.customerPhone = input.customerPhone;
    if (input.address !== undefined) updateData.address = input.address || null;
    if (input.serviceType !== undefined) updateData.serviceType = input.serviceType;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.estimatedValue !== undefined) updateData.estimatedValue = input.estimatedValue || null;
    if (input.nextFollowUpDate !== undefined) updateData.nextFollowUpDate = new Date(input.nextFollowUpDate);
    if (input.followUpAssignedToId !== undefined) updateData.followUpAssignedToId = input.followUpAssignedToId;

    // Update the lead
    const lead = await db.lead.update({
      where: { id: input.leadId },
      data: updateData,
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
