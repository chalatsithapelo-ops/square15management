import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { Client } from "minio";
import { getInternalMinioBaseUrl } from "~/server/minio";
import { getBaseUrl } from "~/server/utils/base-url";

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
        accessKey: "admin",
        secretKey: env.ADMIN_PASSWORD,
      });

      // Generate presigned URL using internal MinIO connection
      const presignedUrl = await minioClient.presignedPutObject(
        "property-management",
        objectName,
        10 * 60 // 10 minutes
      );

      // Replace the internal Docker hostname with the externally reachable nginx proxy URL.
      // Nginx forwards the request to MinIO and sets the Host header to `minio:9000`
      // so MinIO signature validation still passes.
      const appBaseUrl = getBaseUrl().replace(/\/$/, "");
      const minioProxyPrefix = `${appBaseUrl}/minio`;
      const nginxProxyUrl = presignedUrl.replace("http://minio:9000", minioProxyPrefix);

      return {
        presignedUrl: nginxProxyUrl,
        fileUrl: nginxProxyUrl.split('?')[0], // Remove query params for file URL
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
