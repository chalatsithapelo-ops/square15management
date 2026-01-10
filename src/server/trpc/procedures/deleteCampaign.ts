import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";

export const deleteCampaign = baseProcedure
  .input(
    z.object({
      token: z.string(),
      campaignId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    // Authenticate user and require admin privileges
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    try {
      // Check if campaign exists
      const campaign = await db.campaign.findUnique({
        where: { id: input.campaignId },
      });

      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaign not found",
        });
      }

      // Don't allow deleting sent campaigns (for audit trail)
      if (campaign.status === "SENT") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete a sent campaign. This is kept for audit purposes.",
        });
      }

      // Delete the campaign
      await db.campaign.delete({
        where: { id: input.campaignId },
      });

      return {
        success: true,
        message: "Campaign deleted successfully",
      };
    } catch (error) {
      console.error("Failed to delete campaign:", error);
      
      if (error instanceof TRPCError) {
        throw error;
      }
      
      if (error instanceof Error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to delete campaign: ${error.message}`,
          cause: error,
        });
      }
      
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete campaign due to an unknown error",
      });
    }
  });
