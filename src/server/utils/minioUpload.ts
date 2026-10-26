// Tiny helper to put a buffer into the standard "property-management" bucket
// and return a presigned GET URL valid for 7 days.

import { Readable } from "stream";
import { minioClient } from "~/server/minio";

const BUCKET = "property-management";

export async function uploadBufferToMinio(
  buffer: Buffer,
  objectName: string,
  contentType: string,
  expirySeconds: number = 7 * 24 * 60 * 60,
): Promise<string> {
  // Ensure bucket exists (cheap call, idempotent).
  try {
    const exists = await minioClient.bucketExists(BUCKET);
    if (!exists) {
      await minioClient.makeBucket(BUCKET, "us-east-1");
    }
  } catch {
    // ignore — putObject will surface real failures
  }

  const stream = Readable.from(buffer);
  await minioClient.putObject(BUCKET, objectName, stream, buffer.length, {
    "Content-Type": contentType,
  });

  return minioClient.presignedGetObject(BUCKET, objectName, expirySeconds);
}
