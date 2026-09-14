// PR-7 — Technical Manager monthly statement procedures.
// Live preview, snapshot+lock (immutability), and XLSX export matching Tony's
// hand-built sheet.
//
// Lock semantics: once a TmMonthlyStatement is locked, the underlying orders
// have monthLockedAt set, blocking further financial edits. Unlocking is
// allowed to senior admin only and clears monthLockedAt on those orders.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import ExcelJS from "exceljs";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { buildTmStatement, getEffectiveCommissionRule } from "~/server/utils/commission";

const ADMIN_TIER = ["ADMIN", "SENIOR_ADMIN", "JUNIOR_ADMIN", "MANAGER", "TECHNICAL_MANAGER"];
const SENIOR_TIER = ["ADMIN", "SENIOR_ADMIN", "MANAGER"];

function ensureAdminTier(role: string) {
  if (!ADMIN_TIER.includes(role)) throw new TRPCError({ code: "FORBIDDEN", message: "Admin tier only" });
}
function ensureSeniorAdmin(role: string) {
  if (!SENIOR_TIER.includes(role)) throw new TRPCError({ code: "FORBIDDEN", message: "Senior admin only" });
}

/** A TM may view their own statement but not other users'. Admin tier can view any. */
function ensureCanViewStatement(role: string, callerId: number, targetUserId: number) {
  ensureAdminTier(role);
  if (role === "TECHNICAL_MANAGER" && callerId !== targetUserId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "TMs can only view their own statement" });
  }
}

/** parse "YYYY-MM" into a UTC first-of-month Date */
function parseMonth(period: string): Date {
  const m = /^(\d{4})-(\d{1,2})$/.exec(period.trim());
  if (!m) throw new TRPCError({ code: "BAD_REQUEST", message: "period must be YYYY-MM" });
  const yr = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) throw new TRPCError({ code: "BAD_REQUEST", message: "invalid month" });
  return new Date(Date.UTC(yr, mo - 1, 1));
}

/** TMs / Site leads / Ops managers eligible for statements. */
export const adminListTmCandidates = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);

    // TMs viewing this page only see themselves in the picker.
    if (user.role === "TECHNICAL_MANAGER") {
      const self = await db.user.findUnique({
        where: { id: user.id },
        select: {
          id: true, firstName: true, lastName: true, email: true, role: true,
          commissionRules: {
            where: { effectiveTo: null },
            select: { rate: true, role: true, openRateType: true, openRateValue: true, quotedRateType: true, quotedRateValue: true },
          },
        },
      });
      if (!self) return [];
      return [{
        id: self.id,
        name: `${self.firstName} ${self.lastName}`.trim(),
        email: self.email,
        role: self.role,
        activeRate: self.commissionRules[0]?.rate ?? 0.35,
        commissionRole: self.commissionRules[0]?.role ?? "TM",
        openRateType: (self.commissionRules[0]?.openRateType as string) ?? "PERCENT",
        openRateValue: self.commissionRules[0]?.openRateValue ?? 0.35,
        quotedRateType: (self.commissionRules[0]?.quotedRateType as string) ?? "PERCENT",
        quotedRateValue: self.commissionRules[0]?.quotedRateValue ?? 0.35,
      }];
    }

    // Anyone with an active CommissionRule OR with role = TECHNICAL_MANAGER
    const withRules = await db.user.findMany({
      where: {
        OR: [
          { commissionRules: { some: { effectiveTo: null } } },
          { role: "TECHNICAL_MANAGER" },
        ],
      },
      select: {
        id: true, firstName: true, lastName: true, email: true, role: true,
        commissionRules: {
          where: { effectiveTo: null },
          select: { rate: true, role: true, openRateType: true, openRateValue: true, quotedRateType: true, quotedRateValue: true },
        },
      },
      orderBy: [{ firstName: "asc" }],
    });
    return withRules.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`.trim(),
      email: u.email,
      role: u.role,
      activeRate: u.commissionRules[0]?.rate ?? 0.35,
      commissionRole: u.commissionRules[0]?.role ?? "TM",
      openRateType: (u.commissionRules[0]?.openRateType as string) ?? "PERCENT",
      openRateValue: u.commissionRules[0]?.openRateValue ?? 0.35,
      quotedRateType: (u.commissionRules[0]?.quotedRateType as string) ?? "PERCENT",
      quotedRateValue: u.commissionRules[0]?.quotedRateValue ?? 0.35,
    }));
  });

export const adminTmStatementPreview = baseProcedure
  .input(z.object({ token: z.string(), userId: z.number(), period: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureCanViewStatement(user.role, user.id, input.userId);
    return buildTmStatement(input.userId, parseMonth(input.period));
  });

/**
 * PR-8M — Per-row audit drill-down for the TM statement.
 *
 * Returns the full audit trail for one order:
 *  - Personnel (assigned artisan, TM, site lead, ops manager, sales agent)
 *  - Timeline (created, assigned, started, completed, month-locked)
 *  - Cost breakdown (materials, labour, expense slips, adjustments)
 *  - Every expense slip loaded by the artisan (with URL + state + supplier)
 *  - Linked quotation + invoice for direct deep-linking
 */
export const adminTmStatementRowDetail = baseProcedure
  .input(z.object({ token: z.string(), orderId: z.number() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);

    const order = await db.order.findUnique({
      where: { id: input.orderId },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        address: true,
        description: true,
        serviceType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        startTime: true,
        endTime: true,
        pausedAt: true,
        monthLockedAt: true,
        clientOrderNumber: true,
        orderNumberStatus: true,
        signedJobCardUrl: true,
        clientRepName: true,
        clientRepSignDate: true,
        materialCost: true,
        labourCost: true,
        labourRate: true,
        callOutFee: true,
        totalCost: true,
        totalMaterialBudget: true,
        totalLabourCostBudget: true,
        numLabourersNeeded: true,
        labourBreakdown: true,
        quotedAmountExclVat: true,
        vatRate: true,
        commissionExcluded: true,
        commissionExclusionReason: true,
        salesAgentAmount: true,
        siteLeadAmount: true,
        siteLeadHoursWorked: true,
        siteLeadDaysWorked: true,
        opsManagerAmount: true,
        opsManagerHoursWorked: true,
        opsManagerDaysWorked: true,
        tmHoursWorked: true,
        tmDaysWorked: true,

        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        technicalManager: { select: { id: true, firstName: true, lastName: true, email: true } },
        siteLead: { select: { id: true, firstName: true, lastName: true } },
        opsManager: { select: { id: true, firstName: true, lastName: true } },
        salesAgent: { select: { id: true, firstName: true, lastName: true } },

        quotation: {
          select: { id: true, quoteNumber: true, status: true, total: true, subtotal: true, createdAt: true },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            total: true,
            subtotal: true,
            createdAt: true,
            depositAmount: true,
            paidDate: true,
          },
        },

        materials: {
          select: {
            id: true,
            name: true,
            description: true,
            quantity: true,
            unitPrice: true,
            totalCost: true,
            supplier: true,
            supplierQuotationUrl: true,
            supplierQuotationAmount: true,
          },
          orderBy: { id: "asc" },
        },
        expenseSlips: {
          select: {
            id: true,
            createdAt: true,
            url: true,
            category: true,
            description: true,
            amount: true,
            amountExclVat: true,
            vatRate: true,
            supplierName: true,
            paymentMethod: true,
            cardLast4: true,
            purchasedAt: true,
            state: true,
            disputedReason: true,
            submittedBy: { select: { id: true, firstName: true, lastName: true } },
            approvedBy: { select: { id: true, firstName: true, lastName: true } },
            approvedAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
        financialAdjustments: {
          select: {
            id: true,
            createdAt: true,
            kind: true,
            notes: true,
            amount: true,
            vatRate: true,
            createdBy: { select: { firstName: true, lastName: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        crew: {
          select: {
            id: true,
            role: true,
            joinedAt: true,
            leftAt: true,
            hourlyRate: true,
            dailyRate: true,
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

    // TMs may only drill into orders resolved to them.
    if (user.role === "TECHNICAL_MANAGER") {
      const isTheirs =
        order.technicalManager?.id === user.id ||
        order.crew.some((c) => c.role === "LEAD" && !c.leftAt && c.user?.id === user.id);
      if (!isTheirs) throw new TRPCError({ code: "FORBIDDEN", message: "Not your order" });
    }

    // Artisan/crew payment requests that reference this order in orderIds[].
    // Used to show labour-time actually billed to the company for this job.
    const paymentRequests = await db.paymentRequest.findMany({
      where: { orderIds: { has: input.orderId } },
      select: {
        id: true,
        requestNumber: true,
        createdAt: true,
        artisan: { select: { id: true, firstName: true, lastName: true } },
        hoursWorked: true,
        daysWorked: true,
        hourlyRate: true,
        dailyRate: true,
        calculatedAmount: true,
        status: true,
        approvedDate: true,
        paidDate: true,
        notes: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return { ...order, paymentRequests };
  });

export const adminTmStatementList = baseProcedure
  .input(z.object({ token: z.string(), userId: z.number().optional() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);
    // TMs may only list their own statements regardless of the userId param.
    const effectiveUserId = user.role === "TECHNICAL_MANAGER" ? user.id : input.userId;

    const rows = await db.tmMonthlyStatement.findMany({
      where: effectiveUserId ? { userId: effectiveUserId } : undefined,
      orderBy: [{ periodMonth: "desc" }, { userId: "asc" }],
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        generatedBy: { select: { firstName: true, lastName: true } },
        lockedBy: { select: { firstName: true, lastName: true } },
      },
    });
    return rows;
  });

/**
 * Generate + lock a TM statement for a given (user, month).
 * Sets monthLockedAt on every order in the snapshot so no further financial
 * edits can sneak in afterwards.
 */
export const adminTmStatementGenerateAndLock = baseProcedure
  .input(z.object({ token: z.string(), userId: z.number(), period: z.string() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureSeniorAdmin(user.role);

    const month = parseMonth(input.period);
    const payload = await buildTmStatement(input.userId, month);
    const orderIds = payload.rows.map((r) => r.orderId);

    // Upsert the TmMonthlyStatement
    const statement = await db.tmMonthlyStatement.upsert({
      where: { userId_periodMonth: { userId: input.userId, periodMonth: month } },
      create: {
        userId: input.userId,
        periodMonth: month,
        generatedById: user.id,
        lockedAt: new Date(),
        lockedById: user.id,
        totalQuoted: payload.totals.totalQuoted,
        totalSalesSlice: payload.totals.totalSalesSlice,
        totalExpenses: payload.totals.totalExpenses,
        totalAdjustments: payload.totals.totalAdjustments,
        totalBase: payload.totals.totalBase,
        rateSnapshot: payload.totals.rateSnapshot,
        totalCommission: payload.totals.totalCommission,
        jobCount: payload.totals.jobCount,
        payloadJson: payload as any,
      },
      update: {
        generatedById: user.id,
        generatedAt: new Date(),
        lockedAt: new Date(),
        lockedById: user.id,
        totalQuoted: payload.totals.totalQuoted,
        totalSalesSlice: payload.totals.totalSalesSlice,
        totalExpenses: payload.totals.totalExpenses,
        totalAdjustments: payload.totals.totalAdjustments,
        totalBase: payload.totals.totalBase,
        rateSnapshot: payload.totals.rateSnapshot,
        totalCommission: payload.totals.totalCommission,
        jobCount: payload.totals.jobCount,
        payloadJson: payload as any,
      },
    });

    if (orderIds.length > 0) {
      await db.order.updateMany({
        where: { id: { in: orderIds } },
        data: { monthLockedAt: new Date(), monthLockedById: user.id },
      });
    }

    return { statementId: statement.id, jobCount: orderIds.length, lockedAt: statement.lockedAt };
  });

export const adminTmStatementUnlock = baseProcedure
  .input(z.object({ token: z.string(), statementId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureSeniorAdmin(user.role);

    const statement = await db.tmMonthlyStatement.findUnique({ where: { id: input.statementId } });
    if (!statement) throw new TRPCError({ code: "NOT_FOUND", message: "Statement not found" });

    const payload = statement.payloadJson as any;
    const orderIds: number[] = Array.isArray(payload?.rows) ? payload.rows.map((r: any) => r.orderId) : [];

    if (orderIds.length > 0) {
      await db.order.updateMany({
        where: { id: { in: orderIds } },
        data: { monthLockedAt: null, monthLockedById: null },
      });
    }

    await db.tmMonthlyStatement.update({
      where: { id: input.statementId },
      data: { lockedAt: null, lockedById: null },
    });

    return { ok: true, unlockedOrders: orderIds.length };
  });

/**
 * Export the live preview (or a locked snapshot) as XLSX matching Tony's format.
 * Returns base64. Client decodes and triggers a download.
 */
export const adminTmStatementExportXlsx = baseProcedure
  .input(z.object({ token: z.string(), userId: z.number(), period: z.string(), useLockedSnapshot: z.boolean().default(false) }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureCanViewStatement(user.role, user.id, input.userId);

    const month = parseMonth(input.period);
    let payload: any;
    if (input.useLockedSnapshot) {
      const snap = await db.tmMonthlyStatement.findUnique({ where: { userId_periodMonth: { userId: input.userId, periodMonth: month } } });
      if (!snap) throw new TRPCError({ code: "NOT_FOUND", message: "No locked statement for that month" });
      payload = snap.payloadJson;
    } else {
      payload = await buildTmStatement(input.userId, month);
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "Square 15 Facility Solutions";
    wb.created = new Date();

    const rate = (payload.totals?.rateSnapshot ?? 0.35) as number;
    const companyShare = 1 - rate;

    // ── Sheet 1: Statement (matches Tony's format) ──
    const ws = wb.addWorksheet(`${payload.userName} ${payload.periodLabel}`.slice(0, 31));
    ws.columns = [
      { header: "Item No", key: "item", width: 8 },
      { header: "Job Description", key: "desc", width: 55 },
      { header: "Status", key: "status", width: 18 },
      { header: "Budget", key: "budget", width: 14 },
      { header: "Quoted Amount", key: "quoted", width: 16 },
      { header: "Invoiced (excl)", key: "invExcl", width: 16 },
      { header: "Invoiced (incl)", key: "invIncl", width: 16 },
      { header: "Expenses", key: "expenses", width: 14 },
      { header: "Profit", key: "profit", width: 14 },
      { header: `Profit ${Math.round(rate * 100)}%`, key: "tmShare", width: 14 },
      { header: `Profit ${Math.round(companyShare * 100)}%`, key: "coShare", width: 14 },
    ];

    ws.getRow(1).font = { bold: true };

    const rows = payload.rows as any[];
    rows.forEach((r, idx) => {
      const profit = (r.commissionBase ?? 0); // pre-VAT, can be negative
      const tmShare = r.commissionExcluded ? 0 : r.commissionAmount ?? profit * rate;
      const coShare = profit - tmShare;
      const statusLabel = r.invoiceStatus
        ? (r.invoiceStatus === "PAID" ? "Paid"
          : r.invoiceStatus === "DRAFT" ? "Draft invoice"
          : r.invoiceStatus === "REJECTED" ? "Invoice rejected"
          : String(r.invoiceStatus).replace(/_/g, " "))
        : (r.status === "COMPLETED" ? "Completed" : String(r.status ?? "").replace(/_/g, " "));
      ws.addRow({
        item: idx,
        desc: r.description ?? r.customerName,
        status: statusLabel,
        budget: "",
        quoted: r.quotedExclVat,
        invExcl: r.invoicedExclVat ?? 0,
        invIncl: r.invoicedInclVat ?? 0,
        expenses: r.expensesExclVat,
        profit,
        tmShare,
        coShare,
      });
    });

    const totalInvExcl = rows.reduce((s, r) => s + (r.invoicedExclVat ?? 0), 0);
    const totalInvIncl = rows.reduce((s, r) => s + (r.invoicedInclVat ?? 0), 0);

    // Totals row
    const totalsRow = ws.addRow({
      item: "",
      desc: "TOTALS",
      status: "",
      budget: "",
      quoted: payload.totals.totalQuoted,
      invExcl: totalInvExcl,
      invIncl: totalInvIncl,
      expenses: payload.totals.totalExpenses,
      profit: payload.totals.totalBase,
      tmShare: payload.totals.totalCommission,
      coShare: payload.totals.totalBase - payload.totals.totalCommission,
    });
    totalsRow.font = { bold: true };

    // Format numbers as ZAR
    ["quoted", "invExcl", "invIncl", "expenses", "profit", "tmShare", "coShare"].forEach((k) => {
      ws.getColumn(k as any).numFmt = '"R"#,##0.00;[Red]-"R"#,##0.00';
    });

    // Header note for excluded jobs
    if (rows.some((r) => r.commissionExcluded)) {
      ws.addRow([]);
      const note = ws.addRow(["", "Excluded jobs (commission = 0):"]);
      note.font = { italic: true };
      rows.filter((r) => r.commissionExcluded).forEach((r) => {
        ws.addRow(["", `• ${r.orderNumber} — ${r.description ?? r.customerName} (reason: ${r.commissionExclusionReason ?? "—"})`]);
      });
    }

    // ── Sheet 2: Outstanding work ──
    const wsOut = wb.addWorksheet("Outstanding");
    wsOut.getCell("A1").value = "Outstanding Client Orders (PO missing)";
    wsOut.getCell("A1").font = { bold: true };
    wsOut.getCell("A2").value = "Order #";
    wsOut.getCell("B2").value = "Client";
    wsOut.getCell("C2").value = "Completed";
    payload.outstanding.missingClientOrders.forEach((o: any, i: number) => {
      wsOut.getCell(`A${3 + i}`).value = o.orderNumber;
      wsOut.getCell(`B${3 + i}`).value = o.customerName;
      wsOut.getCell(`C${3 + i}`).value = o.completedAt ? new Date(o.completedAt).toISOString().slice(0, 10) : "";
    });
    let nextRow = 5 + payload.outstanding.missingClientOrders.length;
    wsOut.getCell(`A${nextRow}`).value = "Outstanding Invoices";
    wsOut.getCell(`A${nextRow}`).font = { bold: true };
    payload.outstanding.missingInvoices.forEach((o: any, i: number) => {
      wsOut.getCell(`A${nextRow + 1 + i}`).value = o.orderNumber;
      wsOut.getCell(`B${nextRow + 1 + i}`).value = o.customerName;
      wsOut.getCell(`C${nextRow + 1 + i}`).value = o.completedAt ? new Date(o.completedAt).toISOString().slice(0, 10) : "";
    });
    nextRow = nextRow + 2 + payload.outstanding.missingInvoices.length;
    wsOut.getCell(`A${nextRow}`).value = "Outstanding Job Cards (signed)";
    wsOut.getCell(`A${nextRow}`).font = { bold: true };
    payload.outstanding.missingJobCards.forEach((o: any, i: number) => {
      wsOut.getCell(`A${nextRow + 1 + i}`).value = o.orderNumber;
      wsOut.getCell(`B${nextRow + 1 + i}`).value = o.customerName;
      wsOut.getCell(`C${nextRow + 1 + i}`).value = o.completedAt ? new Date(o.completedAt).toISOString().slice(0, 10) : "";
    });
    nextRow = nextRow + 2 + payload.outstanding.missingJobCards.length;
    wsOut.getCell(`A${nextRow}`).value = "Unreconciled Expenses (not yet APPROVED / POSTED)";
    wsOut.getCell(`A${nextRow}`).font = { bold: true };
    payload.outstanding.unreconciledExpenses.forEach((e: any, i: number) => {
      wsOut.getCell(`A${nextRow + 1 + i}`).value = e.orderNumber;
      wsOut.getCell(`B${nextRow + 1 + i}`).value = e.supplier ?? "—";
      wsOut.getCell(`C${nextRow + 1 + i}`).value = e.amount;
      wsOut.getCell(`D${nextRow + 1 + i}`).value = e.state;
      wsOut.getCell(`E${nextRow + 1 + i}`).value = e.reason;
    });

    // ── Sheet 3: Audit (per-row breakdown) ──
    const wsAud = wb.addWorksheet("Audit");
    wsAud.columns = [
      { header: "Order #", key: "orderNumber", width: 12 },
      { header: "Customer", key: "customerName", width: 30 },
      { header: "Description", key: "description", width: 40 },
      { header: "Order status", key: "orderStatus", width: 16 },
      { header: "Completed", key: "completedAt", width: 12 },
      { header: "Invoice #", key: "invoiceNumber", width: 14 },
      { header: "Invoice status", key: "invoiceStatus", width: 14 },
      { header: "Invoiced (excl)", key: "invoicedExclVat", width: 16 },
      { header: "Invoiced (incl)", key: "invoicedInclVat", width: 16 },
      { header: "Quoted (excl)", key: "quotedExclVat", width: 14 },
      { header: "Quote src", key: "quotedSource", width: 12 },
      { header: "Sales agent", key: "salesAgentName", width: 18 },
      { header: "Sales slice", key: "salesAgentAmount", width: 14 },
      { header: "Receipts (excl)", key: "receiptsExclVat", width: 14 },
      { header: "Materials (excl)", key: "materialsExclVat", width: 14 },
      { header: "Labour (excl)", key: "labourExclVat", width: 14 },
      { header: "Adjustments (excl)", key: "adjustmentsExclVat", width: 16 },
      { header: "Total expenses", key: "expensesExclVat", width: 14 },
      { header: "Commission base", key: "commissionBase", width: 14 },
      { header: "Excluded?", key: "commissionExcluded", width: 10 },
      { header: "Excl reason", key: "commissionExclusionReason", width: 24 },
      { header: "TM commission", key: "commissionAmount", width: 14 },
      // PR-8 D — attribution trail
      { header: "Attribution", key: "attributionBadge", width: 12 },
      { header: "Attribution source", key: "attributionSource", width: 22 },
      { header: "Attribution actor", key: "attributionActorName", width: 22 },
      { header: "Attribution at", key: "attributionAt", width: 12 },
    ];
    wsAud.getRow(1).font = { bold: true };
    rows.forEach((r: any) => {
      wsAud.addRow({
        orderNumber: r.orderNumber,
        customerName: r.customerName,
        description: r.description,
        orderStatus: r.status ? String(r.status).replace(/_/g, " ") : "",
        completedAt: r.completedAt ? new Date(r.completedAt).toISOString().slice(0, 10) : "",
        invoiceNumber: r.invoiceNumber ?? "",
        invoiceStatus: r.invoiceStatus ?? "",
        invoicedExclVat: r.invoicedExclVat ?? 0,
        invoicedInclVat: r.invoicedInclVat ?? 0,
        quotedExclVat: r.quotedExclVat,
        quotedSource: r.quotedSource,
        salesAgentName: r.salesAgentName ?? "",
        salesAgentAmount: r.salesAgentAmount,
        receiptsExclVat: r.expenseBreakdown.receiptsExclVat,
        materialsExclVat: r.expenseBreakdown.materialsExclVat,
        labourExclVat: r.expenseBreakdown.labourExclVat,
        adjustmentsExclVat: r.expenseBreakdown.adjustmentsExclVat,
        expensesExclVat: r.expensesExclVat,
        commissionBase: r.commissionBase,
        commissionExcluded: r.commissionExcluded ? "YES" : "no",
        commissionExclusionReason: r.commissionExclusionReason ?? "",
        commissionAmount: r.commissionAmount,
        // PR-8 D — attribution trail (absent on rows from pre-C locked snapshots)
        attributionBadge: r.attributionBadge ?? "UNKNOWN",
        attributionSource: r.attributionSource ?? "",
        attributionActorName: r.attributionActorName ?? "",
        attributionAt: r.attributionAt ? new Date(r.attributionAt).toISOString().slice(0, 10) : "",
      });
    });
    [
      "invoicedExclVat",
      "invoicedInclVat",
      "quotedExclVat",
      "salesAgentAmount",
      "receiptsExclVat",
      "materialsExclVat",
      "labourExclVat",
      "adjustmentsExclVat",
      "expensesExclVat",
      "commissionBase",
      "commissionAmount",
    ].forEach((k) => {
      wsAud.getColumn(k as any).numFmt = '"R"#,##0.00;[Red]-"R"#,##0.00';
    });

    const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    const base64 = Buffer.from(buffer).toString("base64");
    const filename = `tm-statement-${payload.userName.replace(/\s+/g, "_")}-${payload.periodLabel.replace(/\s+/g, "_")}.xlsx`;
    return { filename, base64, mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  });
