import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const getArtisanReviews = baseProcedure
  .input(
    z.object({
      token: z.string(),
      artisanId: z.number(),
      limit: z.number().optional().default(50),
    })
  )
  .query(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      z.object({ userId: z.number() }).parse(verified);

      const reviews = await db.review.findMany({
        where: {
          artisanId: input.artisanId,
        },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
              serviceType: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              projectNumber: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: input.limit,
      });

      // Calculate average ratings
      const avgRating =
        reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : 0;

      const avgServiceQuality =
        reviews.filter((r) => r.serviceQuality !== null).length > 0
          ? reviews
              .filter((r) => r.serviceQuality !== null)
              .reduce((sum, r) => sum + (r.serviceQuality || 0), 0) /
            reviews.filter((r) => r.serviceQuality !== null).length
          : 0;

      const avgProfessionalism =
        reviews.filter((r) => r.professionalism !== null).length > 0
          ? reviews
              .filter((r) => r.professionalism !== null)
              .reduce((sum, r) => sum + (r.professionalism || 0), 0) /
            reviews.filter((r) => r.professionalism !== null).length
          : 0;

      const avgTimeliness =
        reviews.filter((r) => r.timeliness !== null).length > 0
          ? reviews
              .filter((r) => r.timeliness !== null)
              .reduce((sum, r) => sum + (r.timeliness || 0), 0) /
            reviews.filter((r) => r.timeliness !== null).length
          : 0;

      return {
        reviews,
        stats: {
          totalReviews: reviews.length,
          avgRating: Math.round(avgRating * 10) / 10,
          avgServiceQuality: Math.round(avgServiceQuality * 10) / 10,
          avgProfessionalism: Math.round(avgProfessionalism * 10) / 10,
          avgTimeliness: Math.round(avgTimeliness * 10) / 10,
        },
      };
    } catch (error) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
