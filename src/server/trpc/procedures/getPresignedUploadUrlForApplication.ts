import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { baseProcedure } from "~/server/trpc/main";
import { env } from "~/server/env";
import { Client } from "minio";
import { getInternalMinioBaseUrl } from "~/server/minio";
import { db } from "~/server/db";

/**
 * Anonymous / public presigned-upload endpoint used by the public careers
 * page ("Apply for this role" form) to attach a CV and qualification
 * documents to a job application before the application row is created.
 *
 * Guardrails:
 *   - Requires a real, OPEN job slug (basic abuse prevention).
 *   - File-type whitelist (documents + images).
 *   - Filename sanitised, object path prefixed with `public/applications/`.
 *   - Presigned URL valid for 10 minutes only.
 */

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

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

export const getPresignedUploadUrlForApplication = baseProcedure
  .input(
    z.object({
      jobSlug: z.string().min(1),
      fileName: z.string().min(1).max(200),
      fileType: z.string().min(1),
    }),
  )
  .mutation(async ({ input }) => {
    if (!ALLOWED_MIME.has(input.fileType)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Unsupported file type. Please upload a PDF, Word document, or image.",
      });
    }

    // Basic abuse prevention: only allow uploads tied to a real open job.
    const job = await db.job.findUnique({
      where: { slug: input.jobSlug },
      select: { id: true, status: true, visibility: true },
    });
    if (!job || job.status !== "OPEN" || job.visibility === "PRIVATE") {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Job posting is no longer accepting applications.",
      });
    }

    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
    const objectName = `public/applications/${input.jobSlug}/${randomUUID()}-${safeName}`;

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
          10 * 60,
        );
        break;
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes("ECONNREFUSED") ||
          msg.includes("ENOTFOUND") ||
          msg.includes("EAI_AGAIN")
        ) {
          continue;
        }
        throw err;
      }
    }

    if (!presignedUrl) {
      const msg =
        lastError instanceof Error ? lastError.message : String(lastError ?? "Unknown error");
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to generate upload URL: ${msg}`,
      });
    }

    // Return browser-safe proxy URLs.
    const presigned = new URL(presignedUrl);
    const minioProxyPrefix = "/minio";
    return {
      presignedUrl: `${minioProxyPrefix}${presigned.pathname}${presigned.search}`,
      fileUrl: `${minioProxyPrefix}${presigned.pathname}`,
    };
  });
