/**
 * tRPC procedures for the Order Email Inbox:
 *   - getOrderInbox   : list PENDING_REVIEW orders with their source emails
 *   - reviewOrderEmail : approve (→ PENDING) or reject an order email source
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

// ── getOrderInbox ────────────────────────────────────────────────────
export const getOrderInbox = baseProcedure
  .input(
    z.object({
      token: z.string(),
      status: z.enum(["PENDING_REVIEW", "APPROVED", "REJECTED"]).optional(),
    })
  )
  .query(async ({ input }) => {
    const verified = jwt.verify(input.token, env.JWT_SECRET);
    const parsed = z.object({ userId: z.number() }).parse(verified);

    const user = await db.user.findUnique({ where: { id: parsed.userId } });
    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

    // Only ADMIN / SENIOR_ADMIN roles
    const adminRoles = ["ADMIN", "SENIOR_ADMIN"];
    if (!adminRoles.includes(user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    const where: any = {};
    if (input.status) {
      where.status = input.status;
    }

    const sources = await db.orderEmailSource.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            customerEmail: true,
            customerPhone: true,
            address: true,
            serviceType: true,
            description: true,
            status: true,
            notes: true,
            assignedTo: {
              select: { id: true, name: true },
            },
          },
        },
        reviewedBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return sources;
  });

// ── reviewOrderEmail ─────────────────────────────────────────────────
export const reviewOrderEmail = baseProcedure
  .input(
    z.object({
      token: z.string(),
      emailSourceId: z.number(),
      action: z.enum(["APPROVE", "REJECT"]),
      /** Edits to apply when approving — admin can fix AI-extracted data */
      edits: z
        .object({
          customerName: z.string().optional(),
          customerEmail: z.string().optional(),
          customerPhone: z.string().optional(),
          address: z.string().optional(),
          serviceType: z.string().optional(),
          description: z.string().optional(),
          notes: z.string().optional(),
          assignedToId: z.number().optional(),
        })
        .optional(),
      reviewNotes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const verified = jwt.verify(input.token, env.JWT_SECRET);
    const parsed = z.object({ userId: z.number() }).parse(verified);

    const user = await db.user.findUnique({ where: { id: parsed.userId } });
    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

    const adminRoles = ["ADMIN", "SENIOR_ADMIN"];
    if (!adminRoles.includes(user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    const source = await db.orderEmailSource.findUnique({
      where: { id: input.emailSourceId },
      include: { order: true },
    });

    if (!source) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Email source not found" });
    }

    if (source.status !== "PENDING_REVIEW") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Already ${source.status.toLowerCase()}`,
      });
    }

    if (input.action === "REJECT") {
      // Reject: mark email source + delete the draft order
      await db.$transaction(async (tx) => {
        await tx.orderEmailSource.update({
          where: { id: source.id },
          data: {
            status: "REJECTED",
            reviewedById: user.id,
            reviewedAt: new Date(),
            reviewNotes: input.reviewNotes || null,
          },
        });

        if (source.orderId) {
          await tx.order.delete({ where: { id: source.orderId } });
        }
      });

      return { success: true, action: "REJECTED" as const };
    }

    // Approve: update order with any edits, move to PENDING
    const edits = input.edits || {};
    const orderUpdate: any = {
      status: "PENDING",
    };

    if (edits.customerName) orderUpdate.customerName = edits.customerName;
    if (edits.customerEmail) orderUpdate.customerEmail = edits.customerEmail;
    if (edits.customerPhone) orderUpdate.customerPhone = edits.customerPhone;
    if (edits.address) orderUpdate.address = edits.address;
    if (edits.serviceType) orderUpdate.serviceType = edits.serviceType;
    if (edits.description) orderUpdate.description = edits.description;
    if (edits.notes !== undefined) orderUpdate.notes = edits.notes;
    if (edits.assignedToId) orderUpdate.assignedToId = edits.assignedToId;

    await db.$transaction(async (tx) => {
      if (source.orderId) {
        await tx.order.update({
          where: { id: source.orderId },
          data: orderUpdate,
        });
      }

      await tx.orderEmailSource.update({
        where: { id: source.id },
        data: {
          status: "APPROVED",
          reviewedById: user.id,
          reviewedAt: new Date(),
          reviewNotes: input.reviewNotes || null,
        },
      });
    });

    return { success: true, action: "APPROVED" as const, orderId: source.orderId };
  });
