import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireSeniorAdmin, isAdmin } from "~/server/utils/auth";
import { minioClient } from "~/server/minio";
import { db } from "~/server/db";
import { clearLogoCache } from "~/server/utils/logo";
import { getBaseUrl } from "~/server/utils/base-url";

export const uploadCompanyLogo = baseProcedure
  .input(
    z.object({
      token: z.string(),
      fileName: z.string(),
      fileType: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    
    // Allow senior admins, property managers, and contractors (all contractor roles) to upload logos
    const userIsAdmin = isAdmin(user);
    const isContractorRole = user.role === "CONTRACTOR" || 
                            user.role === "CONTRACTOR_SENIOR_MANAGER" || 
                            user.role === "CONTRACTOR_JUNIOR_MANAGER";
    if (!userIsAdmin && user.role !== "PROPERTY_MANAGER" && !isContractorRole) {
      throw new Error("Only administrators, property managers, and contractors can upload logos");
    }

    // Contractors upload to contractor_logo_url, others upload to company_logo_url
    const settingKey = isContractorRole ? "contractor_logo_url" : "company_logo_url";
    const objectName = isContractorRole ? "public/contractor-logo.png" : "public/company-logo.png";

    // Generate presigned URL for uploading (expires in 10 minutes)
    const presignedUrl = await minioClient.presignedPutObject(
      "property-management",
      objectName,
      10 * 60 // 10 minutes
    );

    // Always return a browser-safe relative proxy URL.
    // (The presigned URL hostname might be http://minio:9000 OR http://localhost:9000 depending on runtime.)
    const presigned = new URL(presignedUrl);
    const browserPresignedUrl = `/minio${presigned.pathname}${presigned.search}`;

    // Store an externally reachable URL (absolute) for server-side consumers (PDF/logo fetch).
    const appBaseUrl = getBaseUrl().replace(/\/$/, "");
    const logoUrl = `${appBaseUrl}/minio/property-management/${objectName}`;

    // Store the logo URL in system settings
    await db.systemSettings.upsert({
      where: { key: settingKey },
      create: {
        key: settingKey,
        value: logoUrl,
      },
      update: {
        value: logoUrl,
      },
    });

    // Clear the appropriate logo cache so the new logo is loaded immediately
    clearLogoCache(isContractorRole ? 'contractor' : 'pm');

    return {
      presignedUrl: browserPresignedUrl,
      logoUrl,
    };
  });
