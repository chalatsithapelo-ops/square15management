import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { Client } from "minio";
import { getInternalMinioBaseUrl } from "~/server/minio";

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

function parseMinioProxyUrl(inputUrl: string): { bucket: string; objectName: string } {
  // Accept either:
  // - /minio/<bucket>/<object>
  // - https://host/minio/<bucket>/<object>
  let pathname = inputUrl;
  if (inputUrl.startsWith("http://") || inputUrl.startsWith("https://")) {
    pathname = new URL(inputUrl).pathname;
  }

  const prefix = "/minio/";
  const idx = pathname.indexOf(prefix);
  if (idx === -1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid file URL: expected a /minio/... path",
    });
  }

  const rest = pathname.slice(idx + prefix.length);
  const parts = rest.split("/").filter(Boolean);

  const bucket = parts[0];
  const objectName = parts.slice(1).join("/");

  if (!bucket || !objectName) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid file URL: missing bucket or object name",
    });
  }

  return { bucket, objectName };
}

export const getPresignedDownloadUrl = baseProcedure
  .input(
    z.object({
      token: z.string(),
      url: z.string(),
      expiresInSeconds: z.number().int().positive().max(60 * 60).optional(),
    })
  )
  .query(async ({ input }) => {
    try {
      jwt.verify(input.token, env.JWT_SECRET);

      const { bucket, objectName } = parseMinioProxyUrl(input.url);
      const internalBaseUrl = getInternalMinioBaseUrl();
      const candidateInternalUrls = buildMinioFallbackUrls(internalBaseUrl);

      const expiry = input.expiresInSeconds ?? 10 * 60;

      let presignedUrl: string | null = null;
      let lastError: unknown = null;

      for (const candidateUrl of candidateInternalUrls) {
        try {
          const minioClient = buildMinioClient(candidateUrl);
          presignedUrl = await minioClient.presignedGetObject(bucket, objectName, expiry);
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
          message: `Failed to generate download URL: ${msg}`,
        });
      }

      const presigned = new URL(presignedUrl);
      const nginxProxyUrl = `/minio${presigned.pathname}${presigned.search}`;

      return { url: nginxProxyUrl };
    } catch (error) {
      console.error("getPresignedDownloadUrl error:", error);
      if (error instanceof TRPCError) throw error;

      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to generate download URL: ${errorMessage}`,
      });
    }
  });
