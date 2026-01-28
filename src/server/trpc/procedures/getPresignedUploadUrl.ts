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

  // If we guessed wrong about Docker vs host runtime, try the other common endpoints.
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

      const internalBaseUrl = getInternalMinioBaseUrl();
      const candidateInternalUrls = buildMinioFallbackUrls(internalBaseUrl);

      // Generate presigned URL using an internal MinIO connection.
      // In production, the app may run either inside Docker (minio:9000) or on the host (127.0.0.1:9000).
      // If the first endpoint isn't reachable, try common fallbacks.
      let presignedUrl: string | null = null;
      let lastError: unknown = null;

      for (const candidateUrl of candidateInternalUrls) {
        try {
          const minioClient = buildMinioClient(candidateUrl);
          presignedUrl = await minioClient.presignedPutObject(
            "property-management",
            objectName,
            10 * 60 // 10 minutes
          );
          break;
        } catch (err) {
          lastError = err;
          const msg = err instanceof Error ? err.message : String(err);
          // Only fall back on clear connection-type failures.
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
