import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { minioClient } from "~/server/minio";
import { db } from "~/server/db";

export const deleteMilestoneSupplierQuotation = baseProcedure
  .input(
    z.object({
      token: z.string(),
      quotationId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);

      // Verify user is admin
      const user = await db.user.findUnique({
        where: { id: parsed.userId },
      });

      if (!user || (user.role !== "SENIOR_ADMIN" && user.role !== "JUNIOR_ADMIN")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can delete supplier quotations",
        });
      }

      // Fetch the quotation
      const quotation = await db.milestoneSupplierQuotation.findUnique({
        where: { id: input.quotationId },
      });

      if (!quotation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Supplier quotation not found",
        });
      }

      // Delete file from MinIO
      try {
        // Extract object name from URL
        // URL format: http://minio:9000/property-management/some/path/file.ext
        const urlObj = new URL(quotation.url);
        const objectName = urlObj.pathname.split('/').slice(2).join('/'); // Remove leading bucket name
        
        await minioClient.removeObject("property-management", objectName);
      } catch (error) {
        // Log but don't fail if file doesn't exist
        console.log(`Failed to delete file from MinIO: ${quotation.url}`, error);
      }

      // Delete the quotation record
      await db.milestoneSupplierQuotation.delete({
        where: { id: input.quotationId },
      });

      return {
        success: true,
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
