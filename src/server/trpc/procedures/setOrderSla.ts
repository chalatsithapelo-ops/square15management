import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const ALLOWED_ROLES = [
  "JUNIOR_ADMIN",
  "SENIOR_ADMIN",
  "TECHNICAL_MANAGER",
  "MANAGER",
  "CONTRACTOR",
  "CONTRACTOR_SENIOR_MANAGER",
  "CONTRACTOR_JUNIOR_MANAGER",
];

/**
 * Set or clear an SLA on an order.
 * Pass slaHours=null to clear. Otherwise stamps slaStartedAt=now and
 * slaDueAt=now + slaHours.
 */
export const setOrderSla = baseProcedure
  .input(
    z.object({
      token: z.string(),
      orderId: z.number(),
      slaHours: z.number().int().positive().nullable(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!ALLOWED_ROLES.includes(user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to set SLA on orders.",
      });
    }

    if (input.slaHours === null) {
      return db.order.update({
        where: { id: input.orderId },
        data: { slaHours: null, slaStartedAt: null, slaDueAt: null },
      });
    }

    const now = new Date();
    const due = new Date(now.getTime() + input.slaHours * 60 * 60 * 1000);

    return db.order.update({
      where: { id: input.orderId },
      data: {
        slaHours: input.slaHours,
        slaStartedAt: now,
        slaDueAt: due,
      },
    });
  });
