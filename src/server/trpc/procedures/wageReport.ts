/**
 * Fortnight artisan wage report + payment execution + recipient management.
 *
 * A fortnight is anchored on Mondays, starting from the reference Monday
 * 2026-09-14. Any date maps to its containing fortnight window [Mon 00:00, Mon 00:00 + 14d).
 */
import { z } from "zod";
import { backfillPaidArtisanStatements } from "~/server/services/financeAutomation/artisanStatements";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
import { TRPCError } from "@trpc/server";

const FORTNIGHT_ANCHOR = new Date("2026-09-14T00:00:00+02:00"); // Mon, SAST
const FORTNIGHT_MS = 14 * 24 * 60 * 60 * 1000;

function assertHR(user: any) {
  if (!isAdmin(user) && user.role !== "HR" && user.role !== "TECHNICAL_MANAGER") {
    throw new TRPCError({ code: "FORBIDDEN", message: "HR / Admin / Technical Manager only" });
  }
}

/** Given any date, return the [start, end) window of the fortnight it belongs to. */
export function fortnightWindowFor(date: Date): { start: Date; end: Date; index: number } {
  const diff = date.getTime() - FORTNIGHT_ANCHOR.getTime();
  const index = Math.floor(diff / FORTNIGHT_MS);
  const start = new Date(FORTNIGHT_ANCHOR.getTime() + index * FORTNIGHT_MS);
  const end = new Date(start.getTime() + FORTNIGHT_MS);
  return { start, end, index };
}

function currentFortnight() {
  return fortnightWindowFor(new Date());
}

function prevFortnight() {
  const now = new Date();
  return fortnightWindowFor(new Date(now.getTime() - FORTNIGHT_MS));
}

// ═════════════════════════════════════════════════════════════════════════════
// getFortnightWageReport
// ═════════════════════════════════════════════════════════════════════════════
export const getFortnightWageReport = baseProcedure
  .input(
    z.object({
      token: z.string(),
      periodKey: z.enum(["current", "previous", "custom"]).default("current"),
      customStart: z.string().optional(), // ISO
      customEnd: z.string().optional(),
    }),
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHR(user);

    let start: Date, end: Date;
    if (input.periodKey === "custom") {
      if (!input.customStart || !input.customEnd)
        throw new TRPCError({ code: "BAD_REQUEST", message: "customStart+customEnd required" });
      start = new Date(input.customStart);
      end = new Date(input.customEnd);
    } else if (input.periodKey === "previous") {
      const w = prevFortnight();
      start = w.start;
      end = w.end;
    } else {
      const w = currentFortnight();
      start = w.start;
      end = w.end;
    }

    const requests = await db.paymentRequest.findMany({
      where: { createdAt: { gte: start, lt: end } },
      include: {
        artisan: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            hourlyRate: true,
            dailyRate: true,
            contractorCompanyBankName: true,
            contractorCompanyBankAccountName: true,
            contractorCompanyBankAccountNumber: true,
            contractorCompanyBankBranchCode: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const allOrderIds = [...new Set(requests.flatMap((r) => r.orderIds ?? []))];
    const orders = allOrderIds.length
      ? await db.order.findMany({
          where: { id: { in: allOrderIds } },
          select: {
            id: true,
            orderNumber: true,
            description: true,
            serviceType: true,
            status: true,
            assignedToId: true,
            joinCode: true,
            labourBreakdown: true,
            clientOrderNumber: true,
            client: { select: { id: true, name: true } },
            clientBuilding: { select: { id: true, name: true } },
            invoice: {
              select: { id: true, invoiceNumber: true, status: true, total: true },
            },
          },
        })
      : [];
    const ordersById: Record<number, any> = {};
    for (const o of orders) ordersById[o.id] = o;

    // Group by artisan
    const byArtisan = new Map<number, any>();
    for (const r of requests) {
      const key = r.artisanId;
      if (!byArtisan.has(key)) {
        byArtisan.set(key, {
          artisan: r.artisan,
          rows: [] as any[],
          totalPending: 0,
          totalApproved: 0,
          totalPaid: 0,
          totalRejected: 0,
          totalAll: 0,
        });
      }
      const bucket = byArtisan.get(key)!;
      const orderRefs = (r.orderIds ?? []).map((oid: number) => {
        const o = ordersById[oid];
        if (!o) return { orderId: oid, orderNumber: `#${oid}`, missing: true };
        // Determine how this artisan participated
        const breakdown = Array.isArray(o.labourBreakdown) ? o.labourBreakdown : [];
        const myEntry = breakdown.find((b: any) => b?.userId === r.artisanId);
        const joinedViaCode = o.assignedToId !== r.artisanId; // primary artisan is assignedTo
        return {
          orderId: o.id,
          orderNumber: o.orderNumber,
          description: o.description,
          serviceType: o.serviceType,
          status: o.status,
          client: o.client?.name,
          building: o.clientBuilding?.name,
          clientOrderNumber: o.clientOrderNumber,
          invoice: o.invoice
            ? {
                invoiceNumber: o.invoice.invoiceNumber,
                status: o.invoice.status,
                total: o.invoice.total,
              }
            : null,
          joinCode: o.joinCode,
          joinedViaCode,
          role: myEntry?.role ?? (joinedViaCode ? "CREW" : "LEAD"),
        };
      });
      bucket.rows.push({
        id: r.id,
        requestNumber: r.requestNumber,
        status: r.status,
        rateType: r.hourlyRate ? "HOURLY" : r.dailyRate ? "DAILY" : "UNKNOWN",
        hourlyRate: r.hourlyRate,
        dailyRate: r.dailyRate,
        hoursWorked: r.hoursWorked,
        daysWorked: r.daysWorked,
        amount: r.calculatedAmount,
        approvedDate: r.approvedDate,
        paidDate: r.paidDate,
        rejectionReason: r.rejectionReason,
        createdAt: r.createdAt,
        orders: orderRefs,
      });
      bucket.totalAll += r.calculatedAmount || 0;
      if (r.status === "PENDING") bucket.totalPending += r.calculatedAmount || 0;
      else if (r.status === "APPROVED") bucket.totalApproved += r.calculatedAmount || 0;
      else if (r.status === "PAID") bucket.totalPaid += r.calculatedAmount || 0;
      else if (r.status === "REJECTED") bucket.totalRejected += r.calculatedAmount || 0;
    }

    const artisans = Array.from(byArtisan.values()).sort((a, b) => {
      const na = `${a.artisan.firstName} ${a.artisan.lastName}`.trim();
      const nb = `${b.artisan.firstName} ${b.artisan.lastName}`.trim();
      return na.localeCompare(nb);
    });

    const grand = {
      pending: artisans.reduce((s, a) => s + a.totalPending, 0),
      approved: artisans.reduce((s, a) => s + a.totalApproved, 0),
      paid: artisans.reduce((s, a) => s + a.totalPaid, 0),
      rejected: artisans.reduce((s, a) => s + a.totalRejected, 0),
      all: artisans.reduce((s, a) => s + a.totalAll, 0),
    };

    return {
      period: { start, end, periodKey: input.periodKey },
      artisans,
      grand,
      requestCount: requests.length,
    };
  });

// ═════════════════════════════════════════════════════════════════════════════
// Nedbank Business Online bulk-payment CSV (approved-only)
// Columns follow the NBOL "beneficiary batch payment" upload format.
// ═════════════════════════════════════════════════════════════════════════════
export const generateNedbankWagePaymentCsv = baseProcedure
  .input(
    z.object({
      token: z.string(),
      periodKey: z.enum(["current", "previous", "custom"]).default("current"),
      customStart: z.string().optional(),
      customEnd: z.string().optional(),
      onlyApproved: z.boolean().default(true),
    }),
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHR(user);

    let start: Date, end: Date;
    if (input.periodKey === "custom") {
      if (!input.customStart || !input.customEnd)
        throw new TRPCError({ code: "BAD_REQUEST", message: "custom range required" });
      start = new Date(input.customStart);
      end = new Date(input.customEnd);
    } else if (input.periodKey === "previous") {
      ({ start, end } = prevFortnight());
    } else {
      ({ start, end } = currentFortnight());
    }

    const where: any = { createdAt: { gte: start, lt: end } };
    if (input.onlyApproved) where.status = "APPROVED";

    const requests = await db.paymentRequest.findMany({
      where,
      include: {
        artisan: {
          select: {
            firstName: true,
            lastName: true,
            contractorCompanyBankName: true,
            contractorCompanyBankAccountName: true,
            contractorCompanyBankAccountNumber: true,
            contractorCompanyBankBranchCode: true,
          },
        },
      },
    });

    // Aggregate to one row per artisan (bank consolidates by beneficiary)
    const byArtisan = new Map<number, { total: number; refs: string[]; a: any }>();
    for (const r of requests) {
      const key = r.artisanId;
      if (!byArtisan.has(key)) byArtisan.set(key, { total: 0, refs: [], a: r.artisan });
      const b = byArtisan.get(key)!;
      b.total += r.calculatedAmount || 0;
      b.refs.push(r.requestNumber);
    }

    const header = [
      "BeneficiaryName",
      "AccountName",
      "AccountNumber",
      "BranchCode",
      "BankName",
      "Amount",
      "MyReference",
      "TheirReference",
    ].join(",");

    const rows: string[] = [];
    const missingBank: string[] = [];
    for (const [_, b] of byArtisan) {
      const fullName = `${b.a.firstName ?? ""} ${b.a.lastName ?? ""}`.trim();
      const acctNum = b.a.contractorCompanyBankAccountNumber ?? "";
      if (!acctNum) {
        missingBank.push(fullName);
        continue;
      }
      const acctName = b.a.contractorCompanyBankAccountName ?? fullName;
      const branch = b.a.contractorCompanyBankBranchCode ?? "";
      const bank = b.a.contractorCompanyBankName ?? "";
      const myRef = `SQR15 WAGE ${start.toISOString().slice(0, 10)}`.slice(0, 20);
      const theirRef = `SQR15 ${b.refs.join(" ")}`.slice(0, 20);
      rows.push(
        [
          csvSafe(fullName),
          csvSafe(acctName),
          csvSafe(acctNum),
          csvSafe(branch),
          csvSafe(bank),
          b.total.toFixed(2),
          csvSafe(myRef),
          csvSafe(theirRef),
        ].join(","),
      );
    }

    const csv = [header, ...rows].join("\n");
    return {
      csv,
      filename: `SQR15_wages_${start.toISOString().slice(0, 10)}_to_${end.toISOString().slice(0, 10)}.csv`,
      rowCount: rows.length,
      missingBank,
      totalAmount: rows.reduce((s, r) => s + parseFloat(r.split(",")[5]), 0),
    };
  });

function csvSafe(s: any): string {
  if (s == null) return "";
  const str = String(s);
  if (str.includes(",") || str.includes('"') || str.includes("\n"))
    return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

// ═════════════════════════════════════════════════════════════════════════════
// Bulk mark PAID
// ═════════════════════════════════════════════════════════════════════════════
export const bulkMarkPaymentRequestsPaid = baseProcedure
  .input(
    z.object({
      token: z.string(),
      requestIds: z.array(z.number()).min(1),
      paymentReference: z.string().optional(),
      paidDate: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHR(user);
    const paidAt = input.paidDate ? new Date(input.paidDate) : new Date();
    const noteSuffix = input.paymentReference ? ` [Ref: ${input.paymentReference}]` : "";
    const result = await db.paymentRequest.updateMany({
      where: { id: { in: input.requestIds } },
      data: {
        status: "PAID",
        paidDate: paidAt,
      },
    });
    if (input.paymentReference) {
      await db.paymentRequest.updateMany({
        where: { id: { in: input.requestIds } },
        data: { notes: { set: `Marked PAID by ${user.firstName} ${user.lastName}${noteSuffix}` } as any },
      });
    }
    await backfillPaidArtisanStatements();
    return { count: result.count };
  });

// ═════════════════════════════════════════════════════════════════════════════
// Recipient management
// ═════════════════════════════════════════════════════════════════════════════
export const getWageReportRecipients = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHR(user);
    return db.wageReportRecipient.findMany({ orderBy: { id: "asc" } });
  });

export const addWageReportRecipient = baseProcedure
  .input(z.object({ token: z.string(), email: z.string().email(), name: z.string().optional() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHR(user);
    return db.wageReportRecipient.upsert({
      where: { email: input.email.toLowerCase() },
      create: {
        email: input.email.toLowerCase(),
        name: input.name ?? null,
        isActive: true,
        createdById: user.id,
      },
      update: { isActive: true, name: input.name ?? undefined },
    });
  });

export const removeWageReportRecipient = baseProcedure
  .input(z.object({ token: z.string(), id: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHR(user);
    await db.wageReportRecipient.update({
      where: { id: input.id },
      data: { isActive: false },
    });
    return { ok: true };
  });

// ═════════════════════════════════════════════════════════════════════════════
// Preview + manually trigger the fortnight email
// ═════════════════════════════════════════════════════════════════════════════
export const sendFortnightWageReportEmailNow = baseProcedure
  .input(z.object({ token: z.string(), periodKey: z.enum(["current", "previous"]).default("previous") }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHR(user);
    const { sendFortnightWageReportEmail } = await import("~/server/services/wageReportEmail");
    const res = await sendFortnightWageReportEmail(input.periodKey);
    return res;
  });
