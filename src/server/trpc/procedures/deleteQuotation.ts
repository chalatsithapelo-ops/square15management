import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { minioClient } from "~/server/minio";
import { db } from "~/server/db";

export const deleteQuotation = baseProcedure
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
          message: "Only admins can delete quotations",
        });
      }

      // Fetch the quotation with related expense slips
      const quotation = await db.quotation.findUnique({
        where: { id: input.quotationId },
        include: {
          expenseSlips: true,
        },
      });

      if (!quotation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Quotation not found",
        });
      }

      // Collect all file URLs to delete from MinIO
      const urlsToDelete: string[] = [];

      // Add expense slip URLs
      for (const slip of quotation.expenseSlips) {
        urlsToDelete.push(slip.url);
      }

      // Add before pictures
      urlsToDelete.push(...quotation.beforePictures);

      // Add pictures
      urlsToDelete.push(...quotation.pictures);

      // Delete files from MinIO
      for (const url of urlsToDelete) {
        try {
          // Extract object name from URL
          // URL format: http://minio:9000/property-management/some/path/file.ext
          const urlObj = new URL(url);
          const objectName = urlObj.pathname.split('/').slice(2).join('/'); // Remove leading bucket name
          
          await minioClient.removeObject("property-management", objectName);
        } catch (error) {
          // Log but don't fail if file doesn't exist
          console.log(`Failed to delete file from MinIO: ${url}`, error);
        }
      }

      // Delete the quotation (cascade will handle related records)
      await db.quotation.delete({
        where: { id: input.quotationId },
      });

      return {
        success: true,
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      // Check if it's a JWT error vs a database error
      if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid or expired token",
        });
      }
      console.error("Failed to delete quotation:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to delete quotation: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  });
