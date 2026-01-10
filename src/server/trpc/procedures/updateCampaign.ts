import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";

export const updateCampaign = baseProcedure
  .input(
    z.object({
      token: z.string(),
      campaignId: z.number(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      subject: z.string().min(1).optional(),
      htmlBody: z.string().min(1).optional(),
      targetCriteria: z.object({
        statuses: z.array(z.string()).optional(),
        serviceTypes: z.array(z.string()).optional(),
        estimatedValueMin: z.number().optional(),
        estimatedValueMax: z.number().optional(),
        targetCustomerIds: z.array(z.number()).optional(),
        excludedCustomerIds: z.array(z.number()).optional(),
      }).optional(),
      scheduledFor: z.string().optional(), // ISO date string
      status: z.enum(["DRAFT", "SCHEDULED", "SENDING", "SENT", "FAILED"]).optional(),
    })
  )
  .mutation(async ({ input }) => {
    // Authenticate user and require admin privileges
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    try {
      // Check if campaign exists
      const existingCampaign = await db.campaign.findUnique({
        where: { id: input.campaignId },
      });

      if (!existingCampaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaign not found",
        });
      }

      // Don't allow editing campaigns that have been sent
      if (existingCampaign.status === "SENT" && input.htmlBody) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot edit content of a sent campaign",
        });
      }

      // Update the campaign
      const updatedCampaign = await db.campaign.update({
        where: { id: input.campaignId },
        data: {
          name: input.name,
          description: input.description,
          subject: input.subject,
          htmlBody: input.htmlBody,
          targetCriteria: input.targetCriteria,
          scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : undefined,
          status: input.status,
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

      return {
        success: true,
        campaign: updatedCampaign,
      };
    } catch (error) {
      console.error("Failed to update campaign:", error);
      
      if (error instanceof TRPCError) {
        throw error;
      }
      
      if (error instanceof Error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to update campaign: ${error.message}`,
          cause: error,
        });
      }
      
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update campaign due to an unknown error",
      });
    }
  });
