import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const getMilestonesByProject = baseProcedure
  .input(
    z.object({
      token: z.string(),
      projectId: z.number(),
    })
  )
  .query(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      z.object({ userId: z.number() }).parse(verified);

      const milestones = await db.milestone.findMany({
        where: {
          projectId: input.projectId,
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          supplierQuotations: {
            orderBy: {
              createdAt: "desc",
            },
          },
          materials: {
            orderBy: {
              createdAt: "asc",
            },
          },
          weeklyUpdates: {
            orderBy: {
              weekStartDate: "desc",
            },
          },
          paymentRequests: {
            include: {
              artisan: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          dependenciesFrom: {
            include: {
              toMilestone: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          dependenciesTo: {
            include: {
              fromMilestone: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          risks: {
            where: {
              status: {
                not: "CLOSED",
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          },
          qualityCheckpoints: {
            orderBy: {
              createdAt: "asc",
            },
          },
          changeOrders: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
        orderBy: {
          sequenceOrder: "asc",
        },
      });

      return milestones;
    } catch (error) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
