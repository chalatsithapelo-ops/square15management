// PR-7 — Expense slip review (admin) + bank-transaction linking.
// In v1 we have no automatic bank-feed matcher, so admin does manual link.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const ADMIN_TIER = ["ADMIN", "SENIOR_ADMIN", "JUNIOR_ADMIN", "MANAGER", "TECHNICAL_MANAGER"];
function ensureAdminTier(role: string) {
  if (!ADMIN_TIER.includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin tier only" });
  }
}

export const adminListExpenseSlipsForReview = baseProcedure
  .input(
    z.object({
      token: z.string(),
      state: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "POSTED", "DISPUTED", "REJECTED"]).optional(),
      orderId: z.number().optional(),
      paymentMethod: z.string().optional(),
      limit: z.number().min(1).max(500).default(100),
    }),
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);

    const rows = await db.expenseSlip.findMany({
      where: {
        ...(input.state ? { state: input.state } : {}),
        ...(input.orderId ? { orderId: input.orderId } : {}),
        ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: input.limit,
      include: {
        order: { select: { id: true, orderNumber: true, customerName: true, technicalManagerId: true, assignedToId: true } },
        submittedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        linkedBankTransaction: { select: { id: true, transactionDate: true, amount: true, description: true } },
      },
    });
    return rows;
  });

export const adminApproveExpenseSlip = baseProcedure
  .input(z.object({ token: z.string(), id: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);

    const updated = await db.expenseSlip.update({
      where: { id: input.id },
      data: { state: "APPROVED", approvedById: user.id, approvedAt: new Date(), disputedReason: null },
      select: { id: true, state: true, approvedAt: true },
    });
    return updated;
  });

export const adminDisputeExpenseSlip = baseProcedure
  .input(z.object({ token: z.string(), id: z.number(), reason: z.string().min(3) }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);

    const updated = await db.expenseSlip.update({
      where: { id: input.id },
      data: { state: "DISPUTED", disputedReason: input.reason, approvedById: user.id, approvedAt: new Date() },
      select: { id: true, state: true, disputedReason: true },
    });
    return updated;
  });

export const adminRejectExpenseSlip = baseProcedure
  .input(z.object({ token: z.string(), id: z.number(), reason: z.string().min(3) }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);

    const updated = await db.expenseSlip.update({
      where: { id: input.id },
      data: { state: "REJECTED", disputedReason: input.reason, approvedById: user.id, approvedAt: new Date() },
      select: { id: true, state: true, disputedReason: true },
    });
    return updated;
  });

export const adminLinkExpenseSlipToBankTransaction = baseProcedure
  .input(z.object({ token: z.string(), expenseSlipId: z.number(), bankTransactionId: z.number().nullable() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);

    if (input.bankTransactionId) {
      const existing = await db.expenseSlip.findFirst({
        where: { linkedBankTransactionId: input.bankTransactionId, id: { not: input.expenseSlipId } },
        select: { id: true, order: { select: { orderNumber: true } } },
      });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: `Bank transaction is already linked to expense #${existing.id} on ${existing.order.orderNumber}` });
      }
    }

    const updated = await db.expenseSlip.update({
      where: { id: input.expenseSlipId },
      data: {
        linkedBankTransactionId: input.bankTransactionId,
        state: input.bankTransactionId ? "POSTED" : "APPROVED",
      },
      select: { id: true, state: true, linkedBankTransactionId: true },
    });
    return updated;
  });
