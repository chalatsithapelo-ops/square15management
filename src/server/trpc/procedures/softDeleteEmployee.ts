import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const softDeleteEmployee = baseProcedure
  .input(
    z.object({
      token: z.string(),
      employeeId: z.number(),
      reason: z.enum(["RESIGNED", "DISMISSED", "RETIRED", "OTHER"]),
      reassignToUserId: z.number().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const actor = await authenticateUser(input.token);
    if (!["SENIOR_ADMIN", "TECHNICAL_MANAGER"].includes(actor.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only Senior Admin / TM can remove employees" });
    }
    if (input.employeeId === actor.id) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot remove your own account" });
    }
    const target = await db.user.findUnique({ where: { id: input.employeeId } });
    if (!target) throw new TRPCError({ code: "NOT_FOUND" });
    if (target.deletedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Already removed" });

    // Reassign ownership FKs if target user provided
    if (input.reassignToUserId) {
      const successor = await db.user.findUnique({ where: { id: input.reassignToUserId } });
      if (!successor || successor.deletedAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Successor user not valid" });
      }
      const from = input.employeeId;
      const to = input.reassignToUserId;

      // Buildings (property-manager-owned)
      await db.building.updateMany({ where: { propertyManagerId: from }, data: { propertyManagerId: to } });

      // ClientBuilding four assignment slots
      await db.clientBuilding.updateMany({ where: { defaultSiteLeadId: from }, data: { defaultSiteLeadId: to } });
      await db.clientBuilding.updateMany({ where: { defaultOpsManagerId: from }, data: { defaultOpsManagerId: to } });
      await db.clientBuilding.updateMany({ where: { defaultSalesAgentId: from }, data: { defaultSalesAgentId: to } });
      await db.clientBuilding.updateMany({ where: { portfolioOwnerId: from }, data: { portfolioOwnerId: to } });

      // Client four assignment slots
      await db.client.updateMany({ where: { defaultSiteLeadId: from }, data: { defaultSiteLeadId: to } });
      await db.client.updateMany({ where: { defaultOpsManagerId: from }, data: { defaultOpsManagerId: to } });
      await db.client.updateMany({ where: { defaultSalesAgentId: from }, data: { defaultSalesAgentId: to } });
      await db.client.updateMany({ where: { portfolioOwnerId: from }, data: { portfolioOwnerId: to } });
    }

    await db.user.update({
      where: { id: input.employeeId },
      data: {
        deletedAt: new Date(),
        terminationReason: input.reason,
        terminatedAt: new Date(),
        terminatedById: actor.id,
      },
    });
    return { success: true };
  });
