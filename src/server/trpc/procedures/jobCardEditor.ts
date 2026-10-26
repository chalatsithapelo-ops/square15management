import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin, type AuthenticatedUser } from "~/server/utils/auth";
import { userIsLeadOfOrder } from "~/server/utils/orderAccess";
import { pushJobCardIfLinked } from "~/server/services/myBuildings/hooks";

async function assertCanEditJobCard(user: AuthenticatedUser, orderId: number) {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { id: true, status: true, assignedToId: true } });
  if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
  if (order.status === "CANCELLED") throw new TRPCError({ code: "BAD_REQUEST", message: "Cancelled orders cannot be edited" });
  if (isAdmin(user) || order.assignedToId === user.id) return order;
  if (await userIsLeadOfOrder(order.id, user.id)) return order;
  throw new TRPCError({ code: "FORBIDDEN", message: "Only admins or the artisan/lead on this job can edit its job card" });
}

export const getJobCardForEdit = baseProcedure
  .input(z.object({ token: z.string(), orderId: z.number() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    await assertCanEditJobCard(user, input.orderId);
    const order = await db.order.findUnique({
      where: { id: input.orderId },
      select: {
        id: true, orderNumber: true, status: true, customerName: true, address: true, serviceType: true,
        description: true, notes: true, startTime: true, endTime: true,
        beforePictures: true, afterPictures: true, clientRepName: true, clientRepSignDate: true,
        materials: { select: { id: true, name: true, description: true, quantity: true, unitPrice: true, supplier: true }, orderBy: { id: "asc" } },
      },
    });
    return order!;
  });

export const updateJobCard = baseProcedure
  .input(
    z.object({
      token: z.string(),
      orderId: z.number(),
      serviceType: z.string().trim().min(1).max(200).optional(),
      description: z.string().trim().min(1).max(10000).optional(),
      notes: z.string().max(10000).nullable().optional(),
      startTime: z.string().datetime().nullable().optional(),
      endTime: z.string().datetime().nullable().optional(),
      beforePictures: z.array(z.string().min(1)).max(60).optional(),
      afterPictures: z.array(z.string().min(1)).max(60).optional(),
      clientRepName: z.string().trim().max(200).nullable().optional(),
      materials: z
        .array(
          z.object({
            name: z.string().trim().min(1).max(200),
            description: z.string().max(1000).nullable().optional(),
            quantity: z.number().positive(),
            unitPrice: z.number().min(0),
            supplier: z.string().max(200).nullable().optional(),
          }),
        )
        .max(200)
        .optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    await assertCanEditJobCard(user, input.orderId);

    const before = await db.order.findUnique({
      where: { id: input.orderId },
      select: {
        serviceType: true, description: true, notes: true, startTime: true, endTime: true,
        beforePictures: true, afterPictures: true, clientRepName: true,
        materials: { select: { name: true, quantity: true, unitPrice: true } },
      },
    });

    const startTime = input.startTime === undefined ? before!.startTime : input.startTime ? new Date(input.startTime) : null;
    const endTime = input.endTime === undefined ? before!.endTime : input.endTime ? new Date(input.endTime) : null;
    if (startTime && endTime && endTime < startTime) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "End time cannot be before start time" });
    }

    const data: Record<string, unknown> = {};
    if (input.serviceType !== undefined) data.serviceType = input.serviceType;
    if (input.description !== undefined) data.description = input.description;
    if (input.notes !== undefined) data.notes = input.notes || null;
    if (input.startTime !== undefined) data.startTime = startTime;
    if (input.endTime !== undefined) data.endTime = endTime;
    if (input.beforePictures !== undefined) data.beforePictures = input.beforePictures;
    if (input.afterPictures !== undefined) data.afterPictures = input.afterPictures;
    if (input.clientRepName !== undefined) data.clientRepName = input.clientRepName || null;

    const updated = await db.$transaction(async (tx) => {
      const order = await tx.order.update({ where: { id: input.orderId }, data });
      if (input.materials !== undefined) {
        await tx.material.deleteMany({ where: { orderId: input.orderId } });
        if (input.materials.length) {
          await tx.material.createMany({
            data: input.materials.map((m) => ({
              orderId: input.orderId,
              name: m.name,
              description: m.description || null,
              quantity: m.quantity,
              unitPrice: m.unitPrice,
              totalCost: Math.round(m.quantity * m.unitPrice * 100) / 100,
              supplier: m.supplier || null,
            })),
          });
        }
      }
      await tx.auditLog.create({
        data: {
          userId: user.id,
          userName: `${user.firstName} ${user.lastName}`.trim(),
          action: "UPDATE",
          entityType: "OrderJobCard",
          entityId: input.orderId,
          module: "operations",
          description: `Job card edited for ${order.orderNumber}`,
          changes: JSON.stringify({ before, after: { ...data, materials: input.materials } }),
        },
      });
      return order;
    });

    void pushJobCardIfLinked(input.orderId).catch((e) => console.error("[myBuildings] job-card push after edit failed:", e?.message ?? e));
    return { id: updated.id, orderNumber: updated.orderNumber };
  });
