// PR-7 — Per-order admin financial knobs:
//   • Set / clear sales agent + amount (slice removed from commission base)
//   • Toggle commission-excluded with reason (replaces silent "zero profit" overrides)
//   • Set Technical Manager override (else LEAD → assignedTo)
//   • Add / list / delete financial adjustments (recon variance, returns, credit notes, hold-back)
//   • Set quoted-amount override (excl VAT) for legacy / off-system jobs

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { logTmAssignment, ensureTmAssignmentAllowed } from "~/server/utils/tmAssignmentLog";
import {
  logSalesAgentAssignment,
  ensureSalesAgentAssignmentAllowed,
} from "~/server/utils/salesAgentAssignmentLog";
import {
  logSiteLeadAssignment,
  ensureSiteLeadAssignmentAllowed,
  logOpsManagerAssignment,
  ensureOpsManagerAssignmentAllowed,
} from "~/server/utils/crewRoleAssignmentLog";

const ADMIN_TIER = ["ADMIN", "SENIOR_ADMIN", "JUNIOR_ADMIN", "MANAGER", "TECHNICAL_MANAGER"];

function ensureAdminTier(role: string) {
  if (!ADMIN_TIER.includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin tier only" });
  }
}

async function ensureNotLocked(orderId: number) {
  const o = await db.order.findUnique({ where: { id: orderId }, select: { monthLockedAt: true, orderNumber: true } });
  if (!o) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
  if (o.monthLockedAt) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `${o.orderNumber} was locked in a monthly statement on ${o.monthLockedAt.toISOString().slice(0, 10)} — unlock the statement first.`,
    });
  }
}

export const adminSetOrderSalesAgent = baseProcedure
  .input(
    z.object({
      token: z.string(),
      orderId: z.number(),
      salesAgentId: z.number().nullable(),
      salesAgentAmount: z.number().nullable(), // excl VAT
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);
    await ensureNotLocked(input.orderId);
    // PR-8 E — strict lock: also block when the affected TM's month is locked.
    await ensureSalesAgentAssignmentAllowed(db, input.orderId);

    // PR-8 E — capture previous sales agent so the audit log shows from → to.
    const previous = await db.order.findUnique({
      where: { id: input.orderId },
      select: { salesAgentId: true, orderNumber: true },
    });

    const updated = await db.order.update({
      where: { id: input.orderId },
      data: { salesAgentId: input.salesAgentId, salesAgentAmount: input.salesAgentAmount },
      select: { id: true, salesAgentId: true, salesAgentAmount: true },
    });

    if ((previous?.salesAgentId ?? null) !== (input.salesAgentId ?? null)) {
      await logSalesAgentAssignment(db, {
        orderId: input.orderId,
        fromSalesAgentId: previous?.salesAgentId ?? null,
        toSalesAgentId: input.salesAgentId,
        source: "ADMIN_OVERRIDE",
        actorId: user.id,
        reason: `Admin edit on ${previous?.orderNumber ?? `order #${input.orderId}`}`,
      });
    }

    return updated;
  });

// PR-8 F — Admin knob for Site Lead + optional pre-VAT commission slice.
export const adminSetOrderSiteLead = baseProcedure
  .input(
    z.object({
      token: z.string(),
      orderId: z.number(),
      siteLeadId: z.number().nullable(),
      siteLeadAmount: z.number().nullable(),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);
    await ensureNotLocked(input.orderId);
    await ensureSiteLeadAssignmentAllowed(db, input.orderId);

    const previous = await db.order.findUnique({
      where: { id: input.orderId },
      select: { siteLeadId: true, orderNumber: true },
    });

    const updated = await db.order.update({
      where: { id: input.orderId },
      data: { siteLeadId: input.siteLeadId, siteLeadAmount: input.siteLeadAmount },
      select: { id: true, siteLeadId: true, siteLeadAmount: true },
    });

    if ((previous?.siteLeadId ?? null) !== (input.siteLeadId ?? null)) {
      await logSiteLeadAssignment(db, {
        orderId: input.orderId,
        fromSiteLeadId: previous?.siteLeadId ?? null,
        toSiteLeadId: input.siteLeadId,
        source: "ADMIN_OVERRIDE",
        actorId: user.id,
        reason: `Admin edit on ${previous?.orderNumber ?? `order #${input.orderId}`}`,
      });
    }

    return updated;
  });

// PR-8 F — Admin knob for Ops Manager + optional pre-VAT commission slice.
export const adminSetOrderOpsManager = baseProcedure
  .input(
    z.object({
      token: z.string(),
      orderId: z.number(),
      opsManagerId: z.number().nullable(),
      opsManagerAmount: z.number().nullable(),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);
    await ensureNotLocked(input.orderId);
    await ensureOpsManagerAssignmentAllowed(db, input.orderId);

    const previous = await db.order.findUnique({
      where: { id: input.orderId },
      select: { opsManagerId: true, orderNumber: true },
    });

    const updated = await db.order.update({
      where: { id: input.orderId },
      data: { opsManagerId: input.opsManagerId, opsManagerAmount: input.opsManagerAmount },
      select: { id: true, opsManagerId: true, opsManagerAmount: true },
    });

    if ((previous?.opsManagerId ?? null) !== (input.opsManagerId ?? null)) {
      await logOpsManagerAssignment(db, {
        orderId: input.orderId,
        fromOpsManagerId: previous?.opsManagerId ?? null,
        toOpsManagerId: input.opsManagerId,
        source: "ADMIN_OVERRIDE",
        actorId: user.id,
        reason: `Admin edit on ${previous?.orderNumber ?? `order #${input.orderId}`}`,
      });
    }

    return updated;
  });

export const adminToggleOrderCommissionExclusion = baseProcedure
  .input(z.object({ token: z.string(), orderId: z.number(), excluded: z.boolean(), reason: z.string().optional() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);
    await ensureNotLocked(input.orderId);

    if (input.excluded && (!input.reason || input.reason.trim().length < 3)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "A reason (≥3 chars) is required when excluding from commission" });
    }

    const updated = await db.order.update({
      where: { id: input.orderId },
      data: {
        commissionExcluded: input.excluded,
        commissionExclusionReason: input.excluded ? input.reason : null,
      },
      select: { id: true, commissionExcluded: true, commissionExclusionReason: true },
    });
    return updated;
  });

export const adminSetOrderTechnicalManager = baseProcedure
  .input(z.object({ token: z.string(), orderId: z.number(), technicalManagerId: z.number().nullable() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);
    await ensureNotLocked(input.orderId);
    // PR-8 D — strict month-lock: also block when the target month's statement
    // is locked for either the outgoing or incoming TM (not just this order).
    await ensureTmAssignmentAllowed(db, input.orderId, input.technicalManagerId);

    // PR-8 — capture the previous TM so the audit log shows from → to.
    const previous = await db.order.findUnique({
      where: { id: input.orderId },
      select: { technicalManagerId: true, orderNumber: true },
    });

    const updated = await db.order.update({
      where: { id: input.orderId },
      data: { technicalManagerId: input.technicalManagerId },
      select: { id: true, technicalManagerId: true },
    });

    await logTmAssignment(db, {
      orderId: input.orderId,
      fromTmId: previous?.technicalManagerId ?? null,
      toTmId: input.technicalManagerId,
      source: "ADMIN_OVERRIDE",
      actorId: user.id,
      reason: `Admin edit on ${previous?.orderNumber ?? `order #${input.orderId}`}`,
    });

    return updated;
  });

export const adminSetOrderQuotedAmount = baseProcedure
  .input(z.object({ token: z.string(), orderId: z.number(), quotedAmountExclVat: z.number().nullable(), vatRate: z.number().min(0).max(1).optional() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);
    await ensureNotLocked(input.orderId);

    const updated = await db.order.update({
      where: { id: input.orderId },
      data: {
        quotedAmountExclVat: input.quotedAmountExclVat,
        ...(input.vatRate != null ? { vatRate: input.vatRate } : {}),
      },
      select: { id: true, quotedAmountExclVat: true, vatRate: true },
    });
    return updated;
  });

// PR-7b — Set the TM's hours / days worked on this order. Drives HOURLY / DAILY
// commission rules (no effect on PERCENT rules).
export const adminSetOrderTmTime = baseProcedure
  .input(
    z.object({
      token: z.string(),
      orderId: z.number(),
      tmHoursWorked: z.number().min(0).nullable(),
      tmDaysWorked: z.number().min(0).nullable(),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);
    await ensureNotLocked(input.orderId);

    const updated = await db.order.update({
      where: { id: input.orderId },
      data: { tmHoursWorked: input.tmHoursWorked, tmDaysWorked: input.tmDaysWorked },
      select: { id: true, tmHoursWorked: true, tmDaysWorked: true },
    });
    return updated;
  });

// PR-7b — Set the sales agent's hours / days worked on this order (rare; used
// when a sales-agent commission rule is HOURLY or DAILY).
export const adminSetOrderSalesAgentTime = baseProcedure
  .input(
    z.object({
      token: z.string(),
      orderId: z.number(),
      salesAgentHoursWorked: z.number().min(0).nullable(),
      salesAgentDaysWorked: z.number().min(0).nullable(),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);
    await ensureNotLocked(input.orderId);

    const updated = await db.order.update({
      where: { id: input.orderId },
      data: {
        salesAgentHoursWorked: input.salesAgentHoursWorked,
        salesAgentDaysWorked: input.salesAgentDaysWorked,
      },
      select: { id: true, salesAgentHoursWorked: true, salesAgentDaysWorked: true },
    });
    return updated;
  });

export const adminAddOrderAdjustment = baseProcedure
  .input(
    z.object({
      token: z.string(),
      orderId: z.number(),
      kind: z.enum(["RECONCILIATION", "MATERIAL_RETURN", "CREDIT_NOTE", "WARRANTY_HOLDBACK", "OTHER"]),
      amount: z.number(), // signed, excl VAT
      vatRate: z.number().min(0).max(1).optional(),
      notes: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);
    await ensureNotLocked(input.orderId);

    const created = await db.orderFinancialAdjustment.create({
      data: {
        orderId: input.orderId,
        kind: input.kind,
        amount: input.amount,
        vatRate: input.vatRate ?? 0.15,
        notes: input.notes ?? null,
        createdById: user.id,
      },
    });
    return created;
  });

export const adminListOrderAdjustments = baseProcedure
  .input(z.object({ token: z.string(), orderId: z.number() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);

    const rows = await db.orderFinancialAdjustment.findMany({
      where: { orderId: input.orderId },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    return rows;
  });

export const adminDeleteOrderAdjustment = baseProcedure
  .input(z.object({ token: z.string(), id: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);

    const row = await db.orderFinancialAdjustment.findUnique({ where: { id: input.id }, select: { orderId: true } });
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Adjustment not found" });
    await ensureNotLocked(row.orderId);

    await db.orderFinancialAdjustment.delete({ where: { id: input.id } });
    return { ok: true };
  });

export const adminGetOrderFinancialsSummary = baseProcedure
  .input(z.object({ token: z.string(), orderId: z.number() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);

    const { computeOrderFinancials, resolveOrderTechnicalManagerId, getEffectiveCommissionRule, computeCommissionFromRule } = await import("~/server/utils/commission");
    const fin = await computeOrderFinancials(input.orderId);
    const tmId = await resolveOrderTechnicalManagerId(input.orderId);
    const rate = tmId ? await getEffectiveCommissionRule(tmId) : null;
    const commission = !rate || fin.commissionExcluded
      ? { amount: 0, rateType: "PERCENT" as const, rateValue: 0 }
      : computeCommissionFromRule(rate, fin.isQuotedOrder, fin.commissionBase, fin.tmHoursWorked, fin.tmDaysWorked);

    const order = await db.order.findUnique({
      where: { id: input.orderId },
      select: {
        id: true, orderNumber: true,
        salesAgentId: true, salesAgentAmount: true,
        salesAgentHoursWorked: true, salesAgentDaysWorked: true,
        technicalManagerId: true,
        quotedAmountExclVat: true,
        commissionExcluded: true, commissionExclusionReason: true,
        tmHoursWorked: true, tmDaysWorked: true,
        monthLockedAt: true,
        quotationId: true,
      },
    });

    return {
      order,
      financials: fin,
      technicalManagerId: tmId,
      effectiveRate: rate,
      commissionAmount: commission.amount,
      commissionRateType: commission.rateType,
      commissionRateValue: commission.rateValue,
    };
  });
