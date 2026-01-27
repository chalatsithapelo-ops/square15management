import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { env } from "~/server/env";
import { Client } from "minio";
import { getInternalMinioBaseUrl } from "~/server/minio";
import { getValidExternalTokenRecord } from "~/server/utils/external-submissions";

export const getPresignedUploadUrlForSubmission = baseProcedure
  .input(
    z.object({
      submissionToken: z.string().min(10),
      fileName: z.string().min(1),
      fileType: z.string().min(1),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const record = await getValidExternalTokenRecord(input.submissionToken);

      // Only allow uploads for links meant for submissions
      if (!(["RFQ_QUOTE", "ORDER_INVOICE"].includes(record.type))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Uploads are not allowed for this link.",
        });
      }

      // Generate unique object name
      const timestamp = Date.now();
      const sanitizedFileName = input.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
      const objectName = `public/external-submissions/${record.type.toLowerCase()}/${timestamp}-${sanitizedFileName}`;

      const internalBaseUrl = getInternalMinioBaseUrl();
      const urlObj = new URL(internalBaseUrl);

      const minioClient = new Client({
        endPoint: urlObj.hostname,
        port: parseInt(urlObj.port || "9000", 10),
        useSSL: internalBaseUrl.startsWith("https://"),
        accessKey: env.MINIO_ACCESS_KEY ?? "admin",
        secretKey: env.MINIO_SECRET_KEY ?? env.ADMIN_PASSWORD,
      });

      const presignedUrl = await minioClient.presignedPutObject(
        "property-management",
        objectName,
        10 * 60
      );

      // Always return browser-safe proxy URLs as relative paths.
      const presigned = new URL(presignedUrl);
      const minioProxyPrefix = "/minio";
      const browserPresignedUrl = `${minioProxyPrefix}${presigned.pathname}${presigned.search}`;

      return {
        presignedUrl: browserPresignedUrl,
        fileUrl: `${minioProxyPrefix}${presigned.pathname}`,
      };
    } catch (error) {
      console.error("getPresignedUploadUrlForSubmission error:", error);
      if (error instanceof TRPCError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to generate upload URL: ${errorMessage}`,
      });
    }
  });
