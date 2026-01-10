import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";

export const createCampaign = baseProcedure
  .input(
    z.object({
      token: z.string(),
      name: z.string().min(1, "Campaign name is required"),
      description: z.string().optional(),
      subject: z.string().min(1, "Email subject is required"),
      htmlBody: z.string().min(1, "Email body is required"),
      targetCriteria: z.object({
        statuses: z.array(z.string()).optional(),
        serviceTypes: z.array(z.string()).optional(),
        estimatedValueMin: z.number().optional(),
        estimatedValueMax: z.number().optional(),
        targetCustomerIds: z.array(z.number()).optional(),
        excludedCustomerIds: z.array(z.number()).optional(),
      }).optional(),
      scheduledFor: z.string().optional(), // ISO date string
    })
  )
  .mutation(async ({ input }) => {
    // Authenticate user and require admin privileges
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    try {
      // Create the campaign
      const campaign = await db.campaign.create({
        data: {
          name: input.name,
          description: input.description,
          subject: input.subject,
          htmlBody: input.htmlBody,
          targetCriteria: input.targetCriteria || {},
          scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
          status: "DRAFT",
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

      return {
        success: true,
        campaign,
      };
    } catch (error) {
      console.error("Failed to create campaign:", error);
      
      if (error instanceof Error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to create campaign: ${error.message}`,
          cause: error,
        });
      }
      
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create campaign due to an unknown error",
      });
    }
  });
