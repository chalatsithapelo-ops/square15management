// PR-8 F — Sales Agent / Site Lead / Ops Manager monthly statement procedures.
//
// Read side + PR-8 G lock/unlock/export additions. Kept intentionally separate
// from tmStatement.ts so a bug in one path cannot contaminate the other.
//
// Exposed:
//   • adminRoleStatementListCandidates(role)  — users with an active rule for role
//   • adminRoleStatementPreview(role, userId, period) — live payload
//   • adminRoleStatementList(role?, userId?) — list snapshotted statements
//   • adminRoleStatementGenerateAndLock(role, userId, period) — snapshot + lock orders
//   • adminRoleStatementUnlock(statementId) — clear lock, release orders
//   • adminRoleStatementExportXlsx(role, userId, period, useLockedSnapshot?)

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import ExcelJS from "exceljs";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { buildRoleStatement, type CrewRole } from "~/server/utils/commission";

const ADMIN_TIER = ["ADMIN", "SENIOR_ADMIN", "JUNIOR_ADMIN", "MANAGER", "TECHNICAL_MANAGER"];
const SENIOR_TIER = ["ADMIN", "SENIOR_ADMIN", "MANAGER"];

function ensureAdminTier(role: string) {
  if (!ADMIN_TIER.includes(role)) throw new TRPCError({ code: "FORBIDDEN", message: "Admin tier only" });
}
function ensureSeniorAdmin(role: string) {
  if (!SENIOR_TIER.includes(role)) throw new TRPCError({ code: "FORBIDDEN", message: "Senior admin only" });
}

const RoleEnum = z.enum(["SALES_AGENT", "SITE_LEAD", "OPS_MANAGER"]);

/** parse "YYYY-MM" into a UTC first-of-month Date */
function parseMonth(period: string): Date {
  const m = /^(\d{4})-(\d{1,2})$/.exec(period.trim());
  if (!m) throw new TRPCError({ code: "BAD_REQUEST", message: "period must be YYYY-MM" });
  const yr = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) throw new TRPCError({ code: "BAD_REQUEST", message: "invalid month" });
  return new Date(Date.UTC(yr, mo - 1, 1));
}

/**
 * List every user with an active CommissionRule whose `role` matches. These
 * are the users eligible to receive a monthly statement in that role.
 */
export const adminRoleStatementListCandidates = baseProcedure
  .input(z.object({ token: z.string(), role: RoleEnum }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);

    const now = new Date();
    const users = await db.user.findMany({
      where: {
        commissionRules: {
          some: {
            role: input.role,
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
          },
        },
      },
      select: {
        id: true, firstName: true, lastName: true, email: true, role: true,
        commissionRules: {
          where: { role: input.role, effectiveTo: null },
          select: {
            rate: true, role: true,
            openRateType: true, openRateValue: true,
            quotedRateType: true, quotedRateValue: true,
          },
          take: 1,
        },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    return users.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`.trim() || u.email,
      email: u.email,
      role: u.role,
      activeRate: u.commissionRules[0]?.rate ?? 0,
      openRateType: (u.commissionRules[0]?.openRateType as string) ?? "PERCENT",
      openRateValue: u.commissionRules[0]?.openRateValue ?? 0,
      quotedRateType: (u.commissionRules[0]?.quotedRateType as string) ?? "PERCENT",
      quotedRateValue: u.commissionRules[0]?.quotedRateValue ?? 0,
    }));
  });

/**
 * Live per-user monthly statement for SA / SL / OM.
 * Not cached, not locked — this is the read side.
 */
export const adminRoleStatementPreview = baseProcedure
  .input(z.object({
    token: z.string(),
    role: RoleEnum,
    userId: z.number(),
    period: z.string(),
  }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);
    return buildRoleStatement(input.role as CrewRole, input.userId, parseMonth(input.period));
  });

// ─────────────────────────────────────────────────────────────────────────────
// PR-8 G — list / generate+lock / unlock / xlsx export
// ─────────────────────────────────────────────────────────────────────────────

/** List past locked/generated statements. Filter by role and/or userId. */
export const adminRoleStatementList = baseProcedure
  .input(z.object({
    token: z.string(),
    role: RoleEnum.optional(),
    userId: z.number().optional(),
  }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);
    const rows = await db.crewRoleMonthlyStatement.findMany({
      where: {
        ...(input.role ? { role: input.role } : {}),
        ...(input.userId ? { userId: input.userId } : {}),
      },
      orderBy: [{ periodMonth: "desc" }, { role: "asc" }, { userId: "asc" }],
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        generatedBy: { select: { firstName: true, lastName: true } },
        lockedBy: { select: { firstName: true, lastName: true } },
      },
    });
    return rows;
  });

/**
 * Generate + lock a role statement for (role, user, month).
 * Sets monthLockedAt on every order in the snapshot — same semantics as TM
 * lock — so no further financial edits can slip in.
 */
export const adminRoleStatementGenerateAndLock = baseProcedure
  .input(z.object({
    token: z.string(),
    role: RoleEnum,
    userId: z.number(),
    period: z.string(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureSeniorAdmin(user.role);

    const month = parseMonth(input.period);
    const payload = await buildRoleStatement(input.role as CrewRole, input.userId, month);
    const orderIds = payload.rows.map((r) => r.orderId);

    const statement = await db.crewRoleMonthlyStatement.upsert({
      where: {
        role_userId_periodMonth: {
          role: input.role,
          userId: input.userId,
          periodMonth: month,
        },
      },
      create: {
        role: input.role,
        userId: input.userId,
        periodMonth: month,
        generatedById: user.id,
        lockedAt: new Date(),
        lockedById: user.id,
        totalQuoted: payload.totals.totalQuoted,
        totalHours: payload.totals.totalHours,
        totalDays: payload.totals.totalDays,
        totalAmount: payload.totals.totalAmount,
        jobCount: payload.totals.jobCount,
        payloadJson: payload as any,
      },
      update: {
        generatedById: user.id,
        generatedAt: new Date(),
        lockedAt: new Date(),
        lockedById: user.id,
        totalQuoted: payload.totals.totalQuoted,
        totalHours: payload.totals.totalHours,
        totalDays: payload.totals.totalDays,
        totalAmount: payload.totals.totalAmount,
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

    return {
      statementId: statement.id,
      jobCount: orderIds.length,
      lockedAt: statement.lockedAt,
    };
  });

export const adminRoleStatementUnlock = baseProcedure
  .input(z.object({ token: z.string(), statementId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureSeniorAdmin(user.role);

    const statement = await db.crewRoleMonthlyStatement.findUnique({
      where: { id: input.statementId },
    });
    if (!statement) throw new TRPCError({ code: "NOT_FOUND", message: "Statement not found" });

    const payload = statement.payloadJson as any;
    const orderIds: number[] = Array.isArray(payload?.rows)
      ? payload.rows.map((r: any) => r.orderId)
      : [];

    // NOTE: If an order also belongs to a currently-locked TM (or other role)
    // statement, this will unlock it prematurely. That is the same limitation
    // the TM unlock has — Order.monthLockedAt is a single field with no
    // per-role ownership. Kept identical intentionally for parity.
    if (orderIds.length > 0) {
      await db.order.updateMany({
        where: { id: { in: orderIds } },
        data: { monthLockedAt: null, monthLockedById: null },
      });
    }

    await db.crewRoleMonthlyStatement.update({
      where: { id: input.statementId },
      data: { lockedAt: null, lockedById: null },
    });

    return { ok: true, unlockedOrders: orderIds.length };
  });

/**
 * XLSX export for a role statement. Two sheets: Statement + Audit.
 * Returns base64 for the client to decode + download.
 */
export const adminRoleStatementExportXlsx = baseProcedure
  .input(z.object({
    token: z.string(),
    role: RoleEnum,
    userId: z.number(),
    period: z.string(),
    useLockedSnapshot: z.boolean().default(false),
  }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);

    const month = parseMonth(input.period);
    let payload: any;
    if (input.useLockedSnapshot) {
      const snap = await db.crewRoleMonthlyStatement.findUnique({
        where: {
          role_userId_periodMonth: {
            role: input.role,
            userId: input.userId,
            periodMonth: month,
          },
        },
      });
      if (!snap) throw new TRPCError({ code: "NOT_FOUND", message: "No locked statement for that month" });
      payload = snap.payloadJson;
    } else {
      payload = await buildRoleStatement(input.role as CrewRole, input.userId, month);
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "Square 15 Facility Solutions";
    wb.created = new Date();

    const sheetName = `${payload.userName} ${payload.periodLabel}`.replace(/[\\/:*?[\]]/g, "").slice(0, 31);
    const ws = wb.addWorksheet(sheetName || "Statement");
    ws.columns = [
      { header: "Item", key: "item", width: 6 },
      { header: "Order #", key: "orderNumber", width: 14 },
      { header: "Customer", key: "customerName", width: 28 },
      { header: "Description", key: "description", width: 40 },
      { header: "Completed", key: "completedAt", width: 12 },
      { header: "Quoted (excl)", key: "quotedExclVat", width: 14 },
      { header: "Hours", key: "hoursWorked", width: 10 },
      { header: "Days", key: "daysWorked", width: 10 },
      { header: "Amount", key: "amount", width: 14 },
      { header: "Source", key: "amountSource", width: 12 },
      { header: "Rate", key: "rateType", width: 10 },
      { header: "Rate value", key: "rateValue", width: 12 },
      { header: "Invoice #", key: "invoiceNumber", width: 14 },
      { header: "Invoice status", key: "invoiceStatus", width: 14 },
    ];
    ws.getRow(1).font = { bold: true };

    const rows = (payload.rows as any[]) ?? [];
    rows.forEach((r, i) => {
      ws.addRow({
        item: i + 1,
        orderNumber: r.orderNumber,
        customerName: r.customerName ?? "",
        description: r.description ?? "",
        completedAt: r.completedAt ? new Date(r.completedAt).toISOString().slice(0, 10) : "",
        quotedExclVat: r.quotedExclVat ?? 0,
        hoursWorked: r.hoursWorked ?? 0,
        daysWorked: r.daysWorked ?? 0,
        amount: r.amount ?? 0,
        amountSource: r.amountSource ?? "NONE",
        rateType: r.rateType ?? "",
        rateValue: r.rateValue ?? 0,
        invoiceNumber: r.invoiceNumber ?? "",
        invoiceStatus: r.invoiceStatus ?? "",
      });
    });

    // Totals row
    const totalsRow = ws.addRow({
      item: "",
      orderNumber: "",
      customerName: "",
      description: "TOTALS",
      completedAt: "",
      quotedExclVat: payload.totals.totalQuoted,
      hoursWorked: payload.totals.totalHours,
      daysWorked: payload.totals.totalDays,
      amount: payload.totals.totalAmount,
      amountSource: "",
      rateType: "",
      rateValue: "",
      invoiceNumber: "",
      invoiceStatus: "",
    });
    totalsRow.font = { bold: true };

    // Currency format for money cols
    ["quotedExclVat", "amount"].forEach((k) => {
      ws.getColumn(k as any).numFmt = '"R"#,##0.00;[Red]-"R"#,##0.00';
    });

    // Header block above column headers (insert two rows at the top)
    ws.spliceRows(1, 0, [], []);
    ws.getCell("A1").value = `${payload.roleLabel} — ${payload.userName}`;
    ws.getCell("A1").font = { bold: true, size: 14 };
    ws.getCell("A2").value = `Period: ${payload.periodLabel}`;
    ws.getRow(3).font = { bold: true }; // column header row after splice

    const buf = await wb.xlsx.writeBuffer();
    const base64 = Buffer.from(buf as ArrayBuffer).toString("base64");
    return {
      filename: `${payload.roleLabel.replace(/\s+/g, "-")}_${payload.userName.replace(/\s+/g, "-")}_${payload.periodLabel.replace(/\s+/g, "-")}.xlsx`,
      base64,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  });
