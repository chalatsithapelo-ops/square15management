import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const updateOrderNotes = baseProcedure
  .input(
    z.object({
      token: z.string(),
      orderId: z.number(),
      notes: z.string(),
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

      // Get the order to check permissions
      const order = await db.order.findUnique({
        where: { id: input.orderId },
      });

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      // Check if user has permission to update notes
      const isAdmin = user.role === "JUNIOR_ADMIN" || user.role === "SENIOR_ADMIN";
      const isAssignedArtisan = user.role === "ARTISAN" && order.assignedToId === user.id;

      if (!isAdmin && !isAssignedArtisan) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to update notes for this order",
        });
      }

      const updatedOrder = await db.order.update({
        where: { id: input.orderId },
        data: {
          notes: input.notes,
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      });

      return updatedOrder;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
