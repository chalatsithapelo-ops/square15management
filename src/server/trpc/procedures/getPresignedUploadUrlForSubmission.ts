import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { env } from "~/server/env";
import { Client } from "minio";
import { getInternalMinioBaseUrl } from "~/server/minio";
import { getValidExternalTokenRecord } from "~/server/utils/external-submissions";

function buildMinioClient(baseUrl: string) {
  const urlObj = new URL(baseUrl);
  return new Client({
    endPoint: urlObj.hostname,
    port: parseInt(urlObj.port || "9000", 10),
    useSSL: baseUrl.startsWith("https://"),
    accessKey: env.MINIO_ACCESS_KEY ?? "admin",
    secretKey: env.MINIO_SECRET_KEY ?? env.ADMIN_PASSWORD,
  });
}

function buildMinioFallbackUrls(primary: string): string[] {
  const candidates: string[] = [];

  const add = (u: string | undefined) => {
    if (!u) return;
    const trimmed = u.trim();
    if (!trimmed) return;
    if (!candidates.includes(trimmed)) candidates.push(trimmed);
  };

  add(env.MINIO_INTERNAL_URL);
  add(primary);

  if (primary.includes("minio:9000")) {
    add("http://127.0.0.1:9000");
    add("http://localhost:9000");
  } else if (primary.includes("127.0.0.1")) {
    add(primary.replace("127.0.0.1", "localhost"));
    add("http://minio:9000");
  } else if (primary.includes("localhost")) {
    add(primary.replace("localhost", "127.0.0.1"));
    add("http://minio:9000");
  }

  return candidates;
}

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
      const candidateInternalUrls = buildMinioFallbackUrls(internalBaseUrl);

      let presignedUrl: string | null = null;
      let lastError: unknown = null;

      for (const candidateUrl of candidateInternalUrls) {
        try {
          const minioClient = buildMinioClient(candidateUrl);
          presignedUrl = await minioClient.presignedPutObject(
            "property-management",
            objectName,
            10 * 60
          );
          break;
        } catch (err) {
          lastError = err;
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND") || msg.includes("EAI_AGAIN")) {
            continue;
          }
          throw err;
        }
      }

      if (!presignedUrl) {
        const msg = lastError instanceof Error ? lastError.message : String(lastError ?? "Unknown error");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to generate upload URL: ${msg}. MinIO may be down/unreachable; verify MinIO is running and MINIO_INTERNAL_URL is correct.`,
        });
      }

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
