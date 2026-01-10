import { baseProcedure } from "~/server/trpc/main";
import { minioBaseUrl } from "~/server/minio";

export const getMinioBaseUrl = baseProcedure.query(() => {
  // Convert the proxy to a plain string to ensure proper serialization
  return { baseUrl: String(minioBaseUrl) };
});
