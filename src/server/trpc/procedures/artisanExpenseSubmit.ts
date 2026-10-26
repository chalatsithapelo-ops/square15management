// PR-7 — Artisan / crew lead in-field material-expense capture.
// Lets the artisan add an expense slip to a job WITHOUT having to be in the
// job-completion wizard. Captures receipt photo URL, payment method, supplier,
// GPS, purchase date. State starts as SUBMITTED → admin reviews → APPROVED → POSTED.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { userCanActOnOrder } from "~/server/utils/orderAccess";
import { DEFAULT_VAT_RATE, DEFAULT_APPROVAL_THRESHOLD, getEffectiveCommissionRule } from "~/server/utils/commission";

const PAYMENT_METHODS = ["TM_CARD", "COMPANY_CARD", "OWN_CASH", "PETTY_CASH", "ARTISAN_CLAIM"] as const;
const SLIP_CATEGORIES = ["MATERIALS", "TOOLS", "TRANSPORTATION", "OTHER"] as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

export const artisanAddExpenseSlip = baseProcedure
  .input(
    z.object({
      token: z.string(),
      orderId: z.number(),
      url: z.string().min(1, "Receipt photo URL required"),
      category: z.enum(SLIP_CATEGORIES).default("MATERIALS"),
      amount: z.number().positive("Amount must be > 0"), // INCL VAT (what's on the receipt)
      vatRate: z.number().min(0).max(1).optional(),
      description: z.string().optional(),
      supplierName: z.string().optional(),
      paymentMethod: z.enum(PAYMENT_METHODS),
      cardLast4: z.string().regex(/^\d{4}$/).optional(),
      purchasedAt: z.string().optional(), // ISO
      gpsLat: z.number().optional(),
      gpsLng: z.number().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (user.role !== "ARTISAN" && user.role !== "CONTRACTOR") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Artisan only" });
    }

    const order = await db.order.findUnique({
      where: { id: input.orderId },
      select: { id: true, assignedToId: true, monthLockedAt: true, status: true, orderNumber: true },
    });
    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
    if (order.monthLockedAt) {
      throw new TRPCError({ code: "FORBIDDEN", message: `${order.orderNumber} is locked in a monthly statement` });
    }

    const allowed = await userCanActOnOrder({ orderId: order.id, userId: user.id, assignedToId: order.assignedToId });
    if (!allowed) throw new TRPCError({ code: "FORBIDDEN", message: "Not on this job" });

    const vatRate = input.vatRate ?? DEFAULT_VAT_RATE;
    const amountExclVat = round2(input.amount / (1 + vatRate));

    // Auto-approve under threshold for this artisan/contractor (their CommissionRule, if any).
    // For artisans without a CommissionRule we default to admin-approval-required to be safe.
    const rule = await getEffectiveCommissionRule(user.id);
    const autoApprove = rule.ruleId != null && input.amount <= (rule.approvalThreshold ?? DEFAULT_APPROVAL_THRESHOLD);
    const state = autoApprove ? "APPROVED" : "SUBMITTED";

    const created = await db.expenseSlip.create({
      data: {
        orderId: input.orderId,
        url: input.url,
        category: input.category,
        description: input.description ?? null,
        amount: input.amount,
        amountExclVat,
        vatRate,
        supplierName: input.supplierName ?? null,
        paymentMethod: input.paymentMethod,
        cardLast4: input.cardLast4 ?? null,
        purchasedAt: input.purchasedAt ? new Date(input.purchasedAt) : new Date(),
        gpsLat: input.gpsLat ?? null,
        gpsLng: input.gpsLng ?? null,
        state,
        submittedById: user.id,
        ...(autoApprove ? { approvedById: user.id, approvedAt: new Date() } : {}),
      },
      select: { id: true, state: true, amountExclVat: true, amount: true },
    });

    return { ...created, autoApproved: autoApprove };
  });

export const artisanListMyExpenseSlips = baseProcedure
  .input(z.object({ token: z.string(), orderId: z.number().optional(), limit: z.number().min(1).max(200).default(50) }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const rows = await db.expenseSlip.findMany({
      where: { submittedById: user.id, ...(input.orderId ? { orderId: input.orderId } : {}) },
      orderBy: { createdAt: "desc" },
      take: input.limit,
      include: { order: { select: { id: true, orderNumber: true, customerName: true } } },
    });
    return rows;
  });

export const artisanDeleteMyExpenseSlip = baseProcedure
  .input(z.object({ token: z.string(), id: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const row = await db.expenseSlip.findUnique({
      where: { id: input.id },
      select: { id: true, submittedById: true, state: true, order: { select: { monthLockedAt: true } } },
    });
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found" });
    if (row.submittedById !== user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not your expense" });
    }
    if (row.state === "POSTED" || row.state === "APPROVED" || row.order.monthLockedAt) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Already approved or locked — ask admin to dispute it instead" });
    }
    await db.expenseSlip.delete({ where: { id: input.id } });
    return { ok: true };
  });
