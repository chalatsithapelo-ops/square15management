// PR-7 — Commission, financial reconciliation, and TM monthly statement engine.
// All amounts in this module are PRE-VAT (excl). Helpers convert at the boundary.
//
// Money flow per order:
//   commissionBase = (quotedExclVat − salesAgentAmount) − totalExpensesExclVat
//   tmShare        = commissionExcluded ? 0 : (commissionBase × rate)   // NO floor: losses reduce share
//
// "totalExpensesExclVat" = ExpenseSlip(POSTED|APPROVED) + Materials + labourCost
//                          + Σ OrderFinancialAdjustment.amount

import { db } from "~/server/db";

export const DEFAULT_VAT_RATE = 0.15;
export const DEFAULT_COMMISSION_RATE = 0.35;
export const DEFAULT_APPROVAL_THRESHOLD = 5000;
const ELIGIBLE_EXPENSE_STATES = ["APPROVED", "POSTED"] as const;

const round2 = (n: number) => Math.round(n * 100) / 100;
const exclFromIncl = (incl: number, vatRate: number) => round2(incl / (1 + vatRate));

// ─────────────────────────── Commission rule lookup ───────────────────────────

export type CommissionRateType = "PERCENT" | "HOURLY" | "DAILY" | "NONE";

export type EffectiveCommissionRule = {
  rate: number; // legacy percent (for display / backwards-compat)
  role: string;
  approvalThreshold: number;
  // PR-7b — per-order-kind rate strategy
  openRateType: CommissionRateType;
  openRateValue: number;
  quotedRateType: CommissionRateType;
  quotedRateValue: number;
  ruleId: number | null; // null = default fallback
  effectiveFrom: Date | null;
};

/**
 * Returns the commission rule that was active for `userId` at `atDate`.
 * Falls back to system defaults (rate=0.35, role="TM") if none configured.
 */
export async function getEffectiveCommissionRule(
  userId: number,
  atDate: Date = new Date(),
): Promise<EffectiveCommissionRule> {
  const rule = await db.commissionRule.findFirst({
    where: {
      userId,
      effectiveFrom: { lte: atDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: atDate } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

  if (!rule) {
    return {
      rate: DEFAULT_COMMISSION_RATE,
      role: "TM",
      approvalThreshold: DEFAULT_APPROVAL_THRESHOLD,
      openRateType: "PERCENT",
      openRateValue: DEFAULT_COMMISSION_RATE,
      quotedRateType: "PERCENT",
      quotedRateValue: DEFAULT_COMMISSION_RATE,
      ruleId: null,
      effectiveFrom: null,
    };
  }

  return {
    rate: rule.rate,
    role: rule.role,
    approvalThreshold: rule.approvalThreshold,
    openRateType: (rule.openRateType as CommissionRateType) || "PERCENT",
    openRateValue: rule.openRateValue ?? rule.rate,
    quotedRateType: (rule.quotedRateType as CommissionRateType) || "PERCENT",
    quotedRateValue: rule.quotedRateValue ?? rule.rate,
    ruleId: rule.id,
    effectiveFrom: rule.effectiveFrom,
  };
}

/**
 * Compute commission amount from a rule for a single order.
 *  - isQuoted picks open vs quoted strategy
 *  - base       — pre-VAT commission base (quoted − salesSlice − expenses)
 *  - hoursWorked, daysWorked — driven by Order.tmHoursWorked / Order.tmDaysWorked
 *    (or salesAgentHoursWorked / salesAgentDaysWorked for sales-agent rules)
 */
export function computeCommissionFromRule(
  rule: EffectiveCommissionRule,
  isQuoted: boolean,
  base: number,
  hoursWorked: number,
  daysWorked: number,
): { amount: number; rateType: CommissionRateType; rateValue: number } {
  const rateType = isQuoted ? rule.quotedRateType : rule.openRateType;
  const rateValue = isQuoted ? rule.quotedRateValue : rule.openRateValue;

  let amount = 0;
  switch (rateType) {
    case "PERCENT":
      amount = base * rateValue;
      break;
    case "HOURLY":
      amount = hoursWorked * rateValue;
      break;
    case "DAILY":
      amount = daysWorked * rateValue;
      break;
    case "NONE":
      amount = 0;
      break;
  }
  return { amount: round2(amount), rateType, rateValue };
}

// ─────────────────────────── Per-order financials ───────────────────────────

export type OrderFinancials = {
  orderId: number;
  orderNumber: string;
  status: string;
  completedAt: Date | null;
  isQuotedOrder: boolean; // PR-7b — true when Order.quotationId is set
  quotedExclVat: number;
  quotedSource: "OVERRIDE" | "INVOICE" | "TOTAL_COST" | "NONE";
  salesAgentAmount: number;
  salesAgentName: string | null;
  salesAgentId: number | null;
  salesAgentSource: "MANUAL" | "RULE" | "NONE"; // PR-7b — how the slice was computed
  tmHoursWorked: number; // PR-7b
  tmDaysWorked: number; // PR-7b
  expensesExclVat: number;
  expenseBreakdown: {
    receiptsExclVat: number;
    materialsExclVat: number;
    labourExclVat: number;
    adjustmentsExclVat: number;
  };
  commissionBase: number;
  commissionExcluded: boolean;
  commissionExclusionReason: string | null;
  vatRate: number;
};

/**
 * Resolve who "owns" an order for TM-commission purposes.
 *
 * PR-8: `Order.assignedToId` is the ARTISAN who does the work, NOT the TM,
 * so the legacy fallback that used it as a TM guess has been REMOVED. It was
 * silently mis-attributing quotation-converted orders (which are auto-created
 * without a `technicalManagerId`) to whoever happened to be `assignedToId`.
 *
 * Priority now:
 *   1. Order.technicalManagerId (explicit — set by admin, artisan-picker,
 *      quotation conversion, or backfill)
 *   2. OrderCrew LEAD  (safety net for pre-backfill data only)
 * Returns null if neither is set — surface that as "Unassigned TM" in admin.
 */
export async function resolveOrderTechnicalManagerId(orderId: number): Promise<number | null> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { technicalManagerId: true, crew: { where: { role: "LEAD", leftAt: null }, select: { userId: true }, take: 1 } },
  });
  if (!order) return null;
  if (order.technicalManagerId) return order.technicalManagerId;
  if (order.crew[0]?.userId) return order.crew[0].userId;
  return null;
}

/** Compute the live pre-VAT financials for an order. */
export async function computeOrderFinancials(orderId: number): Promise<OrderFinancials> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      endTime: true,
      vatRate: true,
      totalCost: true,
      labourCost: true,
      quotedAmountExclVat: true,
      quotationId: true,
      salesAgentId: true,
      salesAgentAmount: true,
      salesAgentHoursWorked: true,
      salesAgentDaysWorked: true,
      salesAgent: { select: { firstName: true, lastName: true } },
      tmHoursWorked: true,
      tmDaysWorked: true,
      commissionExcluded: true,
      commissionExclusionReason: true,
      invoice: { select: { subtotal: true } },
      expenseSlips: {
        where: { state: { in: ELIGIBLE_EXPENSE_STATES as unknown as string[] } },
        select: { amount: true, amountExclVat: true, vatRate: true },
      },
      materials: { select: { totalCost: true } },
      financialAdjustments: { select: { amount: true } },
    },
  });

  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  const vatRate = order.vatRate || DEFAULT_VAT_RATE;
  const isQuotedOrder = order.quotationId != null;

  // Quoted (excl VAT) — prefer admin override, then invoice subtotal, then totalCost
  let quotedExclVat = 0;
  let quotedSource: OrderFinancials["quotedSource"] = "NONE";
  if (order.quotedAmountExclVat != null) {
    quotedExclVat = order.quotedAmountExclVat;
    quotedSource = "OVERRIDE";
  } else if (order.invoice?.subtotal != null) {
    quotedExclVat = order.invoice.subtotal;
    quotedSource = "INVOICE";
  } else if (order.totalCost && order.totalCost > 0) {
    // Treat the legacy totalCost field as VAT-inclusive client price
    quotedExclVat = exclFromIncl(order.totalCost, vatRate);
    quotedSource = "TOTAL_COST";
  }

  // Receipts (excl VAT)
  const receiptsExclVat = round2(
    order.expenseSlips.reduce((sum, s) => {
      if (s.amountExclVat != null) return sum + s.amountExclVat;
      const incl = s.amount ?? 0;
      const slipVat = s.vatRate ?? vatRate;
      return sum + (incl ? incl / (1 + slipVat) : 0);
    }, 0),
  );

  // Materials (existing model — totalCost is incl VAT by convention)
  const materialsExclVat = round2(
    order.materials.reduce((sum, m) => sum + exclFromIncl(m.totalCost ?? 0, vatRate), 0),
  );

  // Labour — treat as excl VAT (wages are non-VATable in SA at our scale)
  const labourExclVat = round2(order.labourCost ?? 0);

  // Adjustments — already excl VAT per schema convention; signed (+ adds expense, − credits)
  const adjustmentsExclVat = round2(order.financialAdjustments.reduce((sum, a) => sum + a.amount, 0));

  const expensesExclVat = round2(receiptsExclVat + materialsExclVat + labourExclVat + adjustmentsExclVat);

  // PR-7b — Sales agent slice: prefer manual override (Order.salesAgentAmount).
  // If null but a sales agent is assigned AND they have an effective SALES_AGENT
  // rule, compute from the rule (PERCENT × base, HOURLY × hours, DAILY × days).
  let salesAgentAmount = order.salesAgentAmount ?? 0;
  let salesAgentSource: OrderFinancials["salesAgentSource"] = order.salesAgentAmount != null ? "MANUAL" : "NONE";
  if (order.salesAgentAmount == null && order.salesAgentId) {
    const agentRule = await getEffectiveCommissionRule(order.salesAgentId);
    if (agentRule.role === "SALES_AGENT") {
      // base for sales agent = quoted − expenses (before subtracting their own slice)
      const agentBase = round2(quotedExclVat - expensesExclVat);
      const c = computeCommissionFromRule(
        agentRule,
        isQuotedOrder,
        agentBase,
        order.salesAgentHoursWorked ?? 0,
        order.salesAgentDaysWorked ?? 0,
      );
      salesAgentAmount = c.amount;
      salesAgentSource = "RULE";
    }
  }
  const salesAgentName = order.salesAgent ? `${order.salesAgent.firstName} ${order.salesAgent.lastName}`.trim() : null;

  const commissionBase = round2(quotedExclVat - salesAgentAmount - expensesExclVat);

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    completedAt: order.endTime,
    isQuotedOrder,
    quotedExclVat,
    quotedSource,
    salesAgentAmount,
    salesAgentName,
    salesAgentId: order.salesAgentId,
    salesAgentSource,
    tmHoursWorked: order.tmHoursWorked ?? 0,
    tmDaysWorked: order.tmDaysWorked ?? 0,
    expensesExclVat,
    expenseBreakdown: { receiptsExclVat, materialsExclVat, labourExclVat, adjustmentsExclVat },
    commissionBase,
    commissionExcluded: order.commissionExcluded,
    commissionExclusionReason: order.commissionExclusionReason,
    vatRate,
  };
}

// ─────────────────────────── Monthly TM statement ───────────────────────────

// PR-8 D — attribution badge for each row on the TM statement.
// Rolled up from the most-recent OrderTmAssignmentLog entry for that order.
//   EXPLICIT = admin, artisan or explicit-input override → high-trust
//   DEFAULT  = fell back to a stored default TM (initiator / assignee / quote owner)
//   LEGACY   = crew-LEAD fallback, historical backfill, or unresolvable cleanup
//   UNKNOWN  = no log row (pre-PR-8-C data that has not been touched since)
export type TmAttributionBadge = "EXPLICIT" | "DEFAULT" | "LEGACY" | "UNKNOWN";
export type TmAttributionSource =
  | "EXPLICIT_INPUT"
  | "ARTISAN_PICKED"
  | "INITIATOR_DEFAULT_TM"
  | "ASSIGNEE_DEFAULT_TM"
  | "QUOTE_OWNER_DEFAULT_TM"
  | "CREW_LEAD"
  | "ADMIN_OVERRIDE"
  | "BACKFILL"
  | "UNRESOLVABLE_CLEANUP"
  | null;

export type TmStatementRow = OrderFinancials & {
  customerName: string;
  description: string;
  commissionAmount: number; // computed from rule (PERCENT/HOURLY/DAILY/NONE); 0 if excluded
  commissionRateType: CommissionRateType; // which strategy was used for this row
  commissionRateValue: number; // the numeric rate that was applied
  // Invoiced amounts (from the linked Invoice, if any)
  invoiceId: number | null; // PR-8M — for deep-linking to /admin/invoices?invoiceId=X
  invoiceNumber: string | null;
  invoiceStatus: string | null; // Invoice.status enum or null when no invoice
  invoicedExclVat: number; // Invoice.subtotal
  invoicedInclVat: number; // Invoice.total
  // Quotation reference (if this order was converted from a quote) — for deep-linking
  quotationId: number | null;
  quoteNumber: string | null;
  // PR-8 D — how this order landed on this TM's statement.
  attributionBadge: TmAttributionBadge;
  attributionSource: TmAttributionSource;
  attributionActorName: string | null;
  attributionAt: Date | null;
};

export type TmStatementOutstanding = {
  missingClientOrders: Array<{ orderId: number; orderNumber: string; completedAt: Date | null; customerName: string }>;
  missingInvoices: Array<{ orderId: number; orderNumber: string; completedAt: Date | null; customerName: string; total: number }>;
  missingJobCards: Array<{ orderId: number; orderNumber: string; completedAt: Date | null; customerName: string }>;
  unreconciledExpenses: Array<{ expenseSlipId: number; orderId: number; orderNumber: string; supplier: string | null; amount: number; state: string; reason: string }>;
};

export type TmStatementTotals = {
  jobCount: number;
  totalQuoted: number;
  totalSalesSlice: number;
  totalExpenses: number;
  totalAdjustments: number;
  totalBase: number;
  rateSnapshot: number;
  totalCommission: number;
};

export type TmStatementPayload = {
  userId: number;
  userName: string;
  periodMonth: Date; // first day of month (UTC)
  periodLabel: string; // "June 2026"
  rate: EffectiveCommissionRule;
  rows: TmStatementRow[];
  outstanding: TmStatementOutstanding;
  totals: TmStatementTotals;
  generatedAt: Date;
};

/**
 * Build a TM's monthly statement.
 *
 * Included orders (all resolved to this TM via override → LEAD):
 *  (a) COMPLETED jobs whose `endTime` falls inside the month — these drive
 *      earned commission.
 *  (b) Open jobs (ASSIGNED / IN_PROGRESS / AWAITING_ORDER_NUMBER /
 *      SELF_INITIATED / PENDING_REVIEW) whose `createdAt` falls inside the
 *      month — visibility rows. Commission is forced to R 0 for these; it
 *      crystallises only on completion + invoicing.
 */
export async function buildTmStatement(userId: number, periodMonth: Date): Promise<TmStatementPayload> {
  const monthStart = new Date(Date.UTC(periodMonth.getUTCFullYear(), periodMonth.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(periodMonth.getUTCFullYear(), periodMonth.getUTCMonth() + 1, 1));

  const user = await db.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
  if (!user) throw new Error(`User ${userId} not found`);
  const userName = `${user.firstName} ${user.lastName}`.trim();

  // Find candidate orders: completed this month OR open-and-created this month,
  // AND user is the resolved TM (override → crew LEAD when TM is null).
  //
  // PR-8: Removed the legacy `{ assignedToId: userId, technicalManagerId: null }`
  // branch. `assignedToId` is the ARTISAN (via relation `AssignedArtisan`), not
  // the TM — that branch was pulling other people's jobs onto the wrong TM
  // statements every time a quotation-converted order left `technicalManagerId`
  // unset. The crew LEAD branch is now guarded by `technicalManagerId IS NULL`
  // so an explicit TM assignment always wins over a stray crew LEAD row.
  const candidates = await db.order.findMany({
    where: {
      AND: [
        {
          OR: [
            // (a) Completed this month → contributes to earned commission
            { endTime: { gte: monthStart, lt: monthEnd } },
            // (b) Open this month → visibility only, commission forced to R 0
            {
              AND: [
                {
                  status: {
                    in: [
                      "ASSIGNED",
                      "IN_PROGRESS",
                      "AWAITING_ORDER_NUMBER",
                      "SELF_INITIATED",
                      "PENDING_REVIEW",
                    ],
                  },
                },
                { createdAt: { gte: monthStart, lt: monthEnd } },
              ],
            },
          ],
        },
        {
          OR: [
            { technicalManagerId: userId },
            {
              AND: [
                { technicalManagerId: null },
                { crew: { some: { userId, role: "LEAD", leftAt: null } } },
              ],
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      customerName: true,
      description: true,
      endTime: true,
      createdAt: true,
      status: true,
      orderNumberStatus: true,
      clientOrderNumber: true,
      signedJobCardUrl: true,
      invoice: { select: { id: true, invoiceNumber: true, status: true, total: true, subtotal: true } },
      quotation: { select: { id: true, quoteNumber: true } },
    },
    orderBy: [{ endTime: "asc" }, { createdAt: "asc" }],
  });

  // Compute per-row financials in parallel
  const rate = await getEffectiveCommissionRule(userId, monthEnd);
  const financials = await Promise.all(candidates.map((o) => computeOrderFinancials(o.id)));

  // PR-8 D — attribution: latest OrderTmAssignmentLog entry per order, categorised
  // into a rendered badge (EXPLICIT / DEFAULT / LEGACY / UNKNOWN).
  const attributionByOrderId = await loadTmAttribution(candidates.map((c) => c.id));

  const rows: TmStatementRow[] = candidates.map((c, idx) => {
    const fin = financials[idx];
    const isNotCompleted = c.status !== "COMPLETED";
    // PR-8M — "commission is finalised on invoiced amount". An invoice counts
    // once it has been approved (amounts are locked at that point). DRAFT and
    // PENDING_REVIEW invoices are still being edited so they are hidden and
    // don't earn commission; CANCELLED/REJECTED never will.
    const invoiceIsIssued =
      c.invoice != null &&
      (c.invoice.status === "PENDING_APPROVAL" ||
        c.invoice.status === "APPROVED" ||
        c.invoice.status === "SENT" ||
        c.invoice.status === "PAID" ||
        c.invoice.status === "OVERDUE");
    let commissionAmount = 0;
    let commissionRateType: CommissionRateType = rate.openRateType;
    let commissionRateValue = rate.openRateValue;
    // Non-completed rows are shown for visibility only. Commission crystallises
    // on completion + invoicing, so we force it to R 0 here and flag the row
    // as excluded with a human-readable reason.
    let effectiveExcluded = fin.commissionExcluded;
    let effectiveReason = fin.commissionExclusionReason;
    if (isNotCompleted) {
      effectiveExcluded = true;
      effectiveReason = "Not yet completed — commission finalises on invoicing";
    } else if (!invoiceIsIssued) {
      effectiveExcluded = true;
      effectiveReason = "Invoice not yet issued — commission finalises on invoicing";
    } else if (!fin.commissionExcluded) {
      const c2 = computeCommissionFromRule(
        rate,
        fin.isQuotedOrder,
        fin.commissionBase,
        fin.tmHoursWorked,
        fin.tmDaysWorked,
      );
      commissionAmount = c2.amount;
      commissionRateType = c2.rateType;
      commissionRateValue = c2.rateValue;
    }
    const attr = attributionByOrderId.get(c.id);
    return {
      ...fin,
      commissionExcluded: effectiveExcluded,
      commissionExclusionReason: effectiveReason,
      customerName: c.customerName,
      description: c.description,
      commissionAmount,
      commissionRateType,
      commissionRateValue,
      invoiceId: c.invoice?.id ?? null,
      invoiceNumber: c.invoice?.invoiceNumber ?? null,
      invoiceStatus: c.invoice?.status ?? null,
      // Only show invoiced amounts when the invoice has actually been issued.
      invoicedExclVat: invoiceIsIssued ? (c.invoice?.subtotal ?? 0) : 0,
      invoicedInclVat: invoiceIsIssued ? (c.invoice?.total ?? 0) : 0,
      quotationId: c.quotation?.id ?? null,
      quoteNumber: c.quotation?.quoteNumber ?? null,
      attributionBadge: attr?.badge ?? "UNKNOWN",
      attributionSource: attr?.source ?? null,
      attributionActorName: attr?.actorName ?? null,
      attributionAt: attr?.at ?? null,
    };
  });

  // PR-8 D — double-count guard. `candidates` comes from a single findMany with
  // OR-branches; any order should appear exactly once. This assertion fires only
  // on genuine data corruption (e.g. duplicated OrderCrew LEAD rows). It is
  // deliberately loud so a bug never silently doubles a TM's payout.
  {
    const seen = new Set<number>();
    for (const r of rows) {
      if (seen.has(r.orderId)) {
        throw new Error(
          `TM statement integrity error: order ${r.orderNumber} appears twice on ${userName}'s ${monthStart.toISOString().slice(0, 7)} statement`,
        );
      }
      seen.add(r.orderId);
    }
  }


  const totals: TmStatementTotals = {
    jobCount: rows.length,
    totalQuoted: round2(rows.reduce((s, r) => s + r.quotedExclVat, 0)),
    totalSalesSlice: round2(rows.reduce((s, r) => s + r.salesAgentAmount, 0)),
    totalExpenses: round2(rows.reduce((s, r) => s + r.expensesExclVat, 0)),
    totalAdjustments: round2(rows.reduce((s, r) => s + r.expenseBreakdown.adjustmentsExclVat, 0)),
    totalBase: round2(rows.reduce((s, r) => s + r.commissionBase, 0)),
    rateSnapshot: rate.rate,
    totalCommission: round2(rows.reduce((s, r) => s + r.commissionAmount, 0)),
  };

  // Outstanding work buckets (limited to this TM's universe — all of his ever, not just this month)
  const allOwnedOrderIds = candidates.map((c) => c.id);
  // We need outstanding lookups across all his orders, not just this month — but for v1 we scope
  // to this month + the previous 3 months so the dashboard is bounded.
  const outstandingWindowStart = new Date(monthStart);
  outstandingWindowStart.setUTCMonth(outstandingWindowStart.getUTCMonth() - 3);

  // Same PR-8 correction as above — remove the buggy assignedToId branch and
  // guard the crew-LEAD safety net with `technicalManagerId IS NULL`.
  const ownedAcrossWindow = await db.order.findMany({
    where: {
      OR: [
        { technicalManagerId: userId },
        {
          AND: [
            { technicalManagerId: null },
            { crew: { some: { userId, role: "LEAD", leftAt: null } } },
          ],
        },
      ],
      createdAt: { gte: outstandingWindowStart },
    },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      endTime: true,
      status: true,
      orderNumberStatus: true,
      clientOrderNumber: true,
      signedJobCardUrl: true,
      clientUnavailableToSign: true,
      invoice: { select: { id: true, status: true, total: true } },
    },
  });

  const missingClientOrders = ownedAcrossWindow
    .filter((o) => o.orderNumberStatus === "PENDING_FROM_CLIENT" && !o.clientOrderNumber)
    .map((o) => ({ orderId: o.id, orderNumber: o.orderNumber, customerName: o.customerName, completedAt: o.endTime }));

  const missingInvoices = ownedAcrossWindow
    .filter((o) => o.status === "COMPLETED" && (!o.invoice || o.invoice.status === "DRAFT"))
    .map((o) => ({ orderId: o.id, orderNumber: o.orderNumber, customerName: o.customerName, completedAt: o.endTime, total: o.invoice?.total ?? 0 }));

  const missingJobCards = ownedAcrossWindow
    .filter((o) => o.status === "COMPLETED" && !o.signedJobCardUrl && !o.clientUnavailableToSign)
    .map((o) => ({ orderId: o.id, orderNumber: o.orderNumber, customerName: o.customerName, completedAt: o.endTime }));

  // Unreconciled expenses — DRAFT/SUBMITTED/DISPUTED state on this TM's orders
  const unreconciledRows = await db.expenseSlip.findMany({
    where: {
      orderId: { in: ownedAcrossWindow.map((o) => o.id) },
      state: { in: ["DRAFT", "SUBMITTED", "DISPUTED"] },
    },
    select: { id: true, orderId: true, supplierName: true, amount: true, state: true, disputedReason: true, order: { select: { orderNumber: true } } },
    take: 200,
  });
  const unreconciledExpenses = unreconciledRows.map((e) => ({
    expenseSlipId: e.id,
    orderId: e.orderId,
    orderNumber: e.order.orderNumber,
    supplier: e.supplierName,
    amount: e.amount ?? 0,
    state: e.state,
    reason: e.disputedReason ?? (e.state === "DISPUTED" ? "Disputed" : e.state === "SUBMITTED" ? "Awaiting approval" : "Draft"),
  }));

  return {
    userId,
    userName,
    periodMonth: monthStart,
    periodLabel: monthStart.toLocaleString("en-ZA", { month: "long", year: "numeric", timeZone: "UTC" }),
    rate,
    rows,
    outstanding: {
      missingClientOrders,
      missingInvoices,
      missingJobCards,
      unreconciledExpenses,
    },
    totals,
    generatedAt: new Date(),
  };
}

// ─────────────────────── PR-8 D attribution helper ───────────────────────

/** Bucket a raw source string into a rendered badge for the UI. */
function categoriseAttribution(source: string): TmAttributionBadge {
  switch (source) {
    case "EXPLICIT_INPUT":
    case "ARTISAN_PICKED":
    case "ADMIN_OVERRIDE":
      return "EXPLICIT";
    case "INITIATOR_DEFAULT_TM":
    case "ASSIGNEE_DEFAULT_TM":
    case "QUOTE_OWNER_DEFAULT_TM":
      return "DEFAULT";
    case "CREW_LEAD":
    case "BACKFILL":
    case "UNRESOLVABLE_CLEANUP":
      return "LEGACY";
    default:
      return "UNKNOWN";
  }
}

/**
 * Load the most-recent OrderTmAssignmentLog row for each order, plus the actor
 * name. Returns a Map<orderId, {source, badge, actorName, at}>. Orders with no
 * log row (pre-PR-8-C data never touched) are absent from the map — the caller
 * renders "UNKNOWN" for those.
 */
async function loadTmAttribution(orderIds: number[]): Promise<
  Map<number, { source: TmAttributionSource; badge: TmAttributionBadge; actorName: string | null; at: Date }>
> {
  const out = new Map<
    number,
    { source: TmAttributionSource; badge: TmAttributionBadge; actorName: string | null; at: Date }
  >();
  if (orderIds.length === 0) return out;

  // Pull the newest log per order. Prisma has no DISTINCT ON — cheapest correct
  // approach for a monthly statement (~50 rows) is to fetch ordered by createdAt
  // desc and pick the first per orderId.
  const rows = await db.orderTmAssignmentLog.findMany({
    where: { orderId: { in: orderIds } },
    orderBy: { createdAt: "desc" },
    select: {
      orderId: true,
      source: true,
      createdAt: true,
      actor: { select: { firstName: true, lastName: true } },
    },
  });

  for (const r of rows) {
    if (out.has(r.orderId)) continue; // keep the first (most recent)
    out.set(r.orderId, {
      source: r.source as TmAttributionSource,
      badge: categoriseAttribution(r.source),
      actorName: r.actor ? `${r.actor.firstName} ${r.actor.lastName}`.trim() : null,
      at: r.createdAt,
    });
  }
  return out;
}


// ---------------------------------------------------------------------------
// PR-8 F � Sales Agent / Site Lead / Ops Manager monthly statements.
//
// Read side of the E + E7 milestones. Each role's statement:
//   � Includes every order whose `endTime` falls in the month AND the user
//     is the resolved role-holder on that order's dedicated column.
//   � Uses the manual override `<role>Amount` if set, else computes from the
//     user's active CommissionRule matching that role.
//   � Ignores the TM-specific commission-base math (quoted - sa - expenses).
//     For SA / SL / OM the payout is either a direct amount or role-based
//     PERCENT of quotedExclVat (before commission-base netting), whichever
//     the rule specifies.
//
// TM statements remain a separate, richer builder (`buildTmStatement`) because
// they carry the outstanding-work buckets, attribution badges, and
// commissionBase math. Keeping the two paths separate is intentional: a bug
// on one must never contaminate the other.
// ---------------------------------------------------------------------------

export type CrewRole = "SALES_AGENT" | "SITE_LEAD" | "OPS_MANAGER";

export type RoleStatementRow = {
  orderId: number;
  orderNumber: string;
  customerName: string;
  description: string;
  completedAt: Date | null;
  status: string;
  isQuotedOrder: boolean;
  quotedExclVat: number;
  // The role-specific fields captured on the Order at completion time.
  hoursWorked: number;
  daysWorked: number;
  // Amount actually paid on this row for this role.
  amount: number;
  amountSource: "MANUAL" | "RULE" | "NONE";
  rateType: CommissionRateType;
  rateValue: number;
  // Convenience link back to the invoice, if any (for reconciliation).
  invoiceNumber: string | null;
  invoiceStatus: string | null;
};

export type RoleStatementTotals = {
  jobCount: number;
  totalQuoted: number;
  totalHours: number;
  totalDays: number;
  totalAmount: number;
};

export type RoleStatementPayload = {
  role: CrewRole;
  roleLabel: string; // "Sales Agent" | "Site Lead" | "Ops Manager"
  userId: number;
  userName: string;
  periodMonth: Date; // first day of month (UTC)
  periodLabel: string; // "June 2026"
  rate: EffectiveCommissionRule;
  rows: RoleStatementRow[];
  totals: RoleStatementTotals;
  generatedAt: Date;
};

const ROLE_CONFIG: Record<
  CrewRole,
  {
    label: string;
    columnId: "salesAgentId" | "siteLeadId" | "opsManagerId";
    amountField: "salesAgentAmount" | "siteLeadAmount" | "opsManagerAmount";
    hoursField: "salesAgentHoursWorked" | "siteLeadHoursWorked" | "opsManagerHoursWorked";
    daysField: "salesAgentDaysWorked" | "siteLeadDaysWorked" | "opsManagerDaysWorked";
  }
> = {
  SALES_AGENT: {
    label: "Sales Agent",
    columnId: "salesAgentId",
    amountField: "salesAgentAmount",
    hoursField: "salesAgentHoursWorked",
    daysField: "salesAgentDaysWorked",
  },
  SITE_LEAD: {
    label: "Site Lead",
    columnId: "siteLeadId",
    amountField: "siteLeadAmount",
    hoursField: "siteLeadHoursWorked",
    daysField: "siteLeadDaysWorked",
  },
  OPS_MANAGER: {
    label: "Ops Manager",
    columnId: "opsManagerId",
    amountField: "opsManagerAmount",
    hoursField: "opsManagerHoursWorked",
    daysField: "opsManagerDaysWorked",
  },
};

/**
 * Generic builder for SA/SL/OM monthly statements.
 * See `buildTmStatement` for the equivalent TM path (kept separate).
 */
export async function buildRoleStatement(
  role: CrewRole,
  userId: number,
  periodMonth: Date,
): Promise<RoleStatementPayload> {
  const cfg = ROLE_CONFIG[role];
  const monthStart = new Date(Date.UTC(periodMonth.getUTCFullYear(), periodMonth.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(periodMonth.getUTCFullYear(), periodMonth.getUTCMonth() + 1, 1));

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, email: true },
  });
  if (!user) throw new Error(`User ${userId} not found`);
  const userName = `${user.firstName} ${user.lastName}`.trim() || user.email;

  const rate = await getEffectiveCommissionRule(userId, monthEnd);

  // Guard: warn on the payload (not throw) if the user has a rule whose role
  // doesn't match � we still show the statement, admin can see + fix.
  //   e.g. SA rule but statement viewed under SITE_LEAD ? 0 rows, empty totals.
  const orders = await db.order.findMany({
    where: {
      endTime: { gte: monthStart, lt: monthEnd },
      [cfg.columnId]: userId,
    },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      description: true,
      status: true,
      endTime: true,
      quotationId: true,
      quotedAmountExclVat: true,
      totalCost: true,
      vatRate: true,
      salesAgentAmount: true,
      salesAgentHoursWorked: true,
      salesAgentDaysWorked: true,
      siteLeadAmount: true,
      siteLeadHoursWorked: true,
      siteLeadDaysWorked: true,
      opsManagerAmount: true,
      opsManagerHoursWorked: true,
      opsManagerDaysWorked: true,
      invoice: { select: { invoiceNumber: true, status: true, subtotal: true } },
    },
    orderBy: { endTime: "asc" },
  });

  const rows: RoleStatementRow[] = orders.map((o) => {
    const vatRate = o.vatRate || DEFAULT_VAT_RATE;
    const isQuotedOrder = o.quotationId != null;

    // Quoted excl VAT � same resolution as computeOrderFinancials but inlined
    // (we don't need the full financials shape here, just quotedExclVat).
    let quotedExclVat = 0;
    if (o.quotedAmountExclVat != null) quotedExclVat = o.quotedAmountExclVat;
    else if (o.invoice?.subtotal != null) quotedExclVat = o.invoice.subtotal;
    else if (o.totalCost && o.totalCost > 0) quotedExclVat = exclFromIncl(o.totalCost, vatRate);

    const manualAmount = (o as any)[cfg.amountField] as number | null | undefined;
    const hoursWorked = ((o as any)[cfg.hoursField] as number | null) ?? 0;
    const daysWorked = ((o as any)[cfg.daysField] as number | null) ?? 0;

    let amount = 0;
    let amountSource: RoleStatementRow["amountSource"] = "NONE";
    let rateType: CommissionRateType = rate.openRateType;
    let rateValue = rate.openRateValue;

    if (manualAmount != null) {
      amount = round2(manualAmount);
      amountSource = "MANUAL";
    } else if (rate.role === role) {
      // Compute from the rule. Base for SA / SL / OM is the quoted amount
      // pre-VAT � none of them get netted against expenses (only TM does).
      const c = computeCommissionFromRule(rate, isQuotedOrder, quotedExclVat, hoursWorked, daysWorked);
      amount = c.amount;
      amountSource = "RULE";
      rateType = c.rateType;
      rateValue = c.rateValue;
    }

    return {
      orderId: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      description: o.description,
      completedAt: o.endTime,
      status: o.status,
      isQuotedOrder,
      quotedExclVat: round2(quotedExclVat),
      hoursWorked,
      daysWorked,
      amount,
      amountSource,
      rateType,
      rateValue,
      invoiceNumber: o.invoice?.invoiceNumber ?? null,
      invoiceStatus: o.invoice?.status ?? null,
    };
  });

  const totals: RoleStatementTotals = {
    jobCount: rows.length,
    totalQuoted: round2(rows.reduce((s, r) => s + r.quotedExclVat, 0)),
    totalHours: round2(rows.reduce((s, r) => s + r.hoursWorked, 0)),
    totalDays: round2(rows.reduce((s, r) => s + r.daysWorked, 0)),
    totalAmount: round2(rows.reduce((s, r) => s + r.amount, 0)),
  };

  return {
    role,
    roleLabel: cfg.label,
    userId,
    userName,
    periodMonth: monthStart,
    periodLabel: monthStart.toLocaleString("en-ZA", { month: "long", year: "numeric", timeZone: "UTC" }),
    rate,
    rows,
    totals,
    generatedAt: new Date(),
  };
}

/** Convenience wrappers � thin aliases for readability at call sites. */
export function buildSalesAgentStatement(userId: number, periodMonth: Date) {
  return buildRoleStatement("SALES_AGENT", userId, periodMonth);
}
export function buildSiteLeadStatement(userId: number, periodMonth: Date) {
  return buildRoleStatement("SITE_LEAD", userId, periodMonth);
}
export function buildOpsManagerStatement(userId: number, periodMonth: Date) {
  return buildRoleStatement("OPS_MANAGER", userId, periodMonth);
}