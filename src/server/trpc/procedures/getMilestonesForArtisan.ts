import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const getMilestonesForArtisan = baseProcedure
  .input(
    z.object({
      token: z.string(),
      status: z.enum(["PLANNING", "NOT_STARTED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"]).optional(),
    })
  )
  .query(async ({ input }) => {
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

      // Build where clause
      const where: any = {
        assignedToId: user.id,
      };

      if (input.status) {
        where.status = input.status;
      }

      const milestones = await db.milestone.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              projectNumber: true,
              name: true,
              description: true,
              customerName: true,
              customerEmail: true,
              customerPhone: true,
              address: true,
              status: true,
            },
          },
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
            take: 5,
          },
          paymentRequests: {
            where: {
              artisanId: user.id,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
          expenseSlips: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
        orderBy: [
          {
            status: "asc", // IN_PROGRESS first
          },
          {
            sequenceOrder: "asc",
          },
        ],
      });

      return milestones;
    } catch (error) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
