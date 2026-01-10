import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireSeniorAdmin, isAdmin } from "~/server/utils/auth";
import { minioClient } from "~/server/minio";
import { db } from "~/server/db";
import { clearLogoCache } from "~/server/utils/logo";

export const deleteCompanyLogo = baseProcedure
  .input(
    z.object({
      token: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    
    // Allow senior admins, property managers, and contractors to delete their respective logos
    const userIsAdmin = isAdmin(user);
    const isContractorRole = user.role === "CONTRACTOR" || 
                            user.role === "CONTRACTOR_SENIOR_MANAGER" || 
                            user.role === "CONTRACTOR_JUNIOR_MANAGER";
    if (!userIsAdmin && user.role !== "PROPERTY_MANAGER" && !isContractorRole) {
      throw new Error("Only administrators, property managers, and contractors can delete logos");
    }

    // Determine which logo to delete based on user role
    const settingKey = isContractorRole ? "contractor_logo_url" : "company_logo_url";
    const objectName = isContractorRole ? "public/contractor-logo.png" : "public/company-logo.png";
    
    try {
      await minioClient.removeObject("property-management", objectName);
    } catch (error) {
      // If the object doesn't exist, that's fine - we'll still remove it from the database
      console.log("Logo file not found in MinIO, continuing with database cleanup");
    }

    // Remove the logo URL from system settings
    await db.systemSettings.deleteMany({
      where: { key: settingKey },
    });

    // Clear the appropriate logo cache
    clearLogoCache(isContractorRole ? 'contractor' : 'pm');

    return {
      success: true,
    };
  });
