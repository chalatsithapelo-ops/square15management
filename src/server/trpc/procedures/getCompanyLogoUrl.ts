import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { db } from "~/server/db";
import { authenticateUser } from "~/server/utils/auth";

export const getCompanyLogoUrl = baseProcedure
  .input(
    z.object({
      token: z.string().optional(),
    }).optional()
  )
  .query(async ({ input }) => {
    // If token provided, determine user role and return appropriate logo
    if (input?.token) {
      try {
        const user = await authenticateUser(input.token);
        const isContractorRole = user.role === "CONTRACTOR" || 
                                user.role === "CONTRACTOR_SENIOR_MANAGER" || 
                                user.role === "CONTRACTOR_JUNIOR_MANAGER";
        
        if (isContractorRole) {
          const contractorSetting = await db.systemSettings.findUnique({
            where: { key: "contractor_logo_url" },
          });
          
          // Fall back to company logo if contractor logo not set
          if (contractorSetting?.value) {
            return {
              logoUrl: contractorSetting.value,
            };
          }
        }
      } catch (error) {
        console.error("Error getting user role for logo:", error);
      }
    }

    // Default: return company logo (Property Manager)
    const setting = await db.systemSettings.findUnique({
      where: { key: "company_logo_url" },
    });

    return {
      logoUrl: setting?.value || null,
    };
  });
