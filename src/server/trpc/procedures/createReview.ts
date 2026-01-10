import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const createReview = baseProcedure
  .input(
    z.object({
      token: z.string(),
      artisanId: z.number(),
      orderId: z.number().optional(),
      projectId: z.number().optional(),
      rating: z.number().min(1).max(5),
      comment: z.string().optional(),
      serviceQuality: z.number().min(1).max(5).optional(),
      professionalism: z.number().min(1).max(5).optional(),
      timeliness: z.number().min(1).max(5).optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);

      const user = await db.user.findUnique({
        where: { id: parsed.userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Verify the artisan exists and is actually an artisan
      const artisan = await db.user.findUnique({
        where: { id: input.artisanId },
      });

      if (!artisan || artisan.role !== "ARTISAN") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Artisan not found",
        });
      }

      // If orderId is provided, verify the order exists and was completed
      if (input.orderId) {
        const order = await db.order.findUnique({
          where: { id: input.orderId },
        });

        if (!order || order.status !== "COMPLETED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Order not found or not completed",
          });
        }

        // Check if review already exists for this order
        const existingReview = await db.review.findFirst({
          where: {
            customerId: user.id,
            artisanId: input.artisanId,
            orderId: input.orderId,
          },
        });

        if (existingReview) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You have already reviewed this order",
          });
        }
      }

      // If projectId is provided, verify the project exists
      if (input.projectId) {
        const project = await db.project.findUnique({
          where: { id: input.projectId },
        });

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }
      }

      const review = await db.review.create({
        data: {
          customerId: user.id,
          artisanId: input.artisanId,
          orderId: input.orderId || null,
          projectId: input.projectId || null,
          rating: input.rating,
          comment: input.comment || null,
          serviceQuality: input.serviceQuality || null,
          professionalism: input.professionalism || null,
          timeliness: input.timeliness || null,
        },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          artisan: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      return review;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
