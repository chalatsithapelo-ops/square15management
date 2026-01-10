import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";

export const getCampaigns = baseProcedure
  .input(
    z.object({
      token: z.string(),
      status: z.enum(["DRAFT", "SCHEDULED", "SENDING", "SENT", "FAILED"]).optional(),
    })
  )
  .query(async ({ input }) => {
    // Authenticate user and require admin privileges
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    try {
      const campaigns = await db.campaign.findMany({
        where: input.status ? { status: input.status } : undefined,
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
        orderBy: {
          createdAt: "desc",
        },
      });

      return campaigns;
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
      
      if (error instanceof Error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to fetch campaigns: ${error.message}`,
          cause: error,
        });
      }
      
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch campaigns due to an unknown error",
      });
    }
  });
