import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { env } from "~/server/env";
import { Client } from "minio";
import { getInternalMinioBaseUrl } from "~/server/minio";
import { getValidExternalTokenRecord } from "~/server/utils/external-submissions";
import { getBaseUrl } from "~/server/utils/base-url";

export const getPresignedUploadUrlForSubmission = baseProcedure
  .input(
    z.object({
      submissionToken: z.string().min(10),
      fileName: z.string().min(1),
      fileType: z.string().min(1),
    })
  )
  .mutation(async ({ input }) => {
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
      accessKey: "admin",
      secretKey: env.ADMIN_PASSWORD,
    });

    const presignedUrl = await minioClient.presignedPutObject(
      "property-management",
      objectName,
      10 * 60
    );

    const appBaseUrl = getBaseUrl().replace(/\/$/, "");
    const minioProxyPrefix = `${appBaseUrl}/minio`;
    const nginxProxyUrl = presignedUrl.replace("http://minio:9000", minioProxyPrefix);

    return {
      presignedUrl: nginxProxyUrl,
      fileUrl: nginxProxyUrl.split("?")[0],
    };
  });
