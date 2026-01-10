import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";
import { minioClient } from "~/server/minio";

export const deleteHRDocument = baseProcedure
  .input(
    z.object({
      token: z.string(),
      documentId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    const document = await db.hRDocument.findUnique({
      where: { id: input.documentId },
    });

    if (!document) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Document not found",
      });
    }

    // Delete file from MinIO
    try {
      // Extract object name from URL
      // URL format: http://minio:9000/property-management/some/path/file.ext
      const urlObj = new URL(document.fileUrl);
      const objectName = urlObj.pathname.split('/').slice(2).join('/'); // Remove leading bucket name
      
      await minioClient.removeObject("property-management", objectName);
    } catch (error) {
      // Log but don't fail if file doesn't exist
      console.log(`Failed to delete file from MinIO: ${document.fileUrl}`, error);
    }

    await db.hRDocument.delete({
      where: { id: input.documentId },
    });

    return { success: true };
  });
