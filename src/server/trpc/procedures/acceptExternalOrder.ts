import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { db } from "~/server/db";

import { getValidExternalTokenRecord } from "~/server/utils/external-submissions";
import { createNotification } from "~/server/utils/notifications";

export const acceptExternalOrder = baseProcedure
  .input(
    z.object({
      submissionToken: z.string().min(10),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const record = await getValidExternalTokenRecord(input.submissionToken);

    if (record.type !== "ORDER_ACCEPT") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This link is not for order acceptance.",
      });
    }

    if (record.usedAt) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This order acceptance link has already been used.",
      });
    }

    if (!record.order) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Order not found for this link.",
      });
    }

    const order = record.order;

    const updatedOrder = await db.propertyManagerOrder.update({
      where: { id: order.id },
      data: {
        status: "ACCEPTED",
        acceptedDate: order.acceptedDate || new Date(),
        notes: input.notes ? [order.notes || "", input.notes].filter(Boolean).join("\n\n") : order.notes,
      },
    });

    await createNotification({
      recipientId: order.propertyManagerId,
      recipientRole: "PROPERTY_MANAGER",
      message: `Order ${order.orderNumber} was accepted by ${record.email}.`,
      type: "PM_ORDER_ACCEPTED",
      relatedEntityId: order.id,
      relatedEntityType: "PROPERTY_MANAGER_ORDER",
    });

    await db.externalSubmissionToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return updatedOrder;
  });
