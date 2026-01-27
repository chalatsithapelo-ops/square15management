import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { Client } from "minio";
import { getInternalMinioBaseUrl } from "~/server/minio";
// NOTE: Upload URLs must be browser-reachable. Returning absolute URLs can
// accidentally point at the wrong host (www vs non-www) or scheme, causing CORS
// or mixed-content failures. Prefer returning a relative proxy path.

export const getPresignedUploadUrl = baseProcedure
  .input(
    z.object({
      token: z.string(),
      fileName: z.string(),
      fileType: z.string(),
      isPublic: z.boolean().optional().default(true),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);

      // Generate a unique object name with timestamp to avoid collisions
      const timestamp = Date.now();
      const sanitizedFileName = input.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
      const prefix = input.isPublic ? "public/attachments" : "private/attachments";
      const objectName = `${prefix}/${timestamp}-${sanitizedFileName}`;

      // Use internal MinIO URL to connect from inside Docker
      const internalBaseUrl = getInternalMinioBaseUrl();
      const urlObj = new URL(internalBaseUrl);
      
      // Create MinIO client with internal hostname for connection
      const minioClient = new Client({
        endPoint: urlObj.hostname,
        port: parseInt(urlObj.port || '9000', 10),
        useSSL: internalBaseUrl.startsWith("https://"),
        accessKey: env.MINIO_ACCESS_KEY ?? "admin",
        secretKey: env.MINIO_SECRET_KEY ?? env.ADMIN_PASSWORD,
      });

      // Generate presigned URL using internal MinIO connection
      const presignedUrl = await minioClient.presignedPutObject(
        "property-management",
        objectName,
        10 * 60 // 10 minutes
      );

      const presigned = new URL(presignedUrl);
      const minioProxyPrefix = "/minio";
      const nginxProxyUrl = `${minioProxyPrefix}${presigned.pathname}${presigned.search}`;

      return {
        presignedUrl: nginxProxyUrl,
        fileUrl: `${minioProxyPrefix}${presigned.pathname}`, // Stable URL without query params
      };
    } catch (error) {
      console.error("getPresignedUploadUrl error:", error);
      if (error instanceof TRPCError) {
        throw error;
      }
      // Log the actual error details
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Actual error message:", errorMessage);
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack");
      
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to generate upload URL: ${errorMessage}`,
      });
    }
  });
