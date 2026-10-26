import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
import { TRPCError } from "@trpc/server";

function assertFinance(user: any) {
  if (!isAdmin(user) && user.role !== "MANAGER" && user.role !== "TECHNICAL_MANAGER") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin / Manager access required" });
  }
}

const REVENUE_CATS = new Set([
  "INVOICE_PAYMENT",
  "RENTAL_INCOME",
  "INVESTMENTS",
  "OTHER_REVENUE",
]);
// REFUND is money we received back — treated as an offset to expenses, not gross revenue.

const COST_OF_SALES_CATS = new Set([
  "MATERIAL_PURCHASE",
  "INDEPENDENT_CONTRACTOR",
  "SALARIES",
]);

const OPERATING_CATS = new Set([
  "RENT",
  "UTILITIES",
  "TELECOMMUNICATIONS",
  "SOFTWARE_SUBSCRIPTIONS",
  "PETROL",
  "TRAVEL",
  "MARKETING",
  "OFFICE_SUPPLIES",
  "INSURANCE",
  "PROFESSIONAL_FEES",
  "MAINTENANCE",
  "OTHER",
]);

export const getBankIntegratedPL = baseProcedure
  .input(
    z.object({
      token: z.string(),
      start: z.string(), // ISO date
      end: z.string(),
    }),
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertFinance(user);

    const start = new Date(input.start);
    const end = new Date(input.end);

    // Bank feed: all confirmed-categorised transactions in the period
    const rows = await db.transactionCategorization.findMany({
      where: {
        isConfirmed: true,
        bankTransaction: {
          transactionDate: { gte: start, lte: end },
        },
      },
      select: {
        category: true,
        bankTransaction: {
          select: { id: true, amount: true, transactionType: true, transactionDate: true, description: true },
        },
      },
    });

    // Aggregate per category (credits are positive to revenue, debits to expenses)
    const revenueByCat: Record<string, number> = {};
    const cosByCat: Record<string, number> = {};
    const opexByCat: Record<string, number> = {};
    let refunds = 0;
    let uncategorised = 0;

    for (const r of rows) {
      const cat = r.category;
      const tx = r.bankTransaction;
      const amt = tx.amount;
      if (tx.transactionType === "CREDIT") {
        if (REVENUE_CATS.has(cat)) revenueByCat[cat] = (revenueByCat[cat] ?? 0) + amt;
        else if (cat === "REFUND") refunds += amt;
        else uncategorised += amt;
      } else if (tx.transactionType === "DEBIT") {
        if (COST_OF_SALES_CATS.has(cat)) cosByCat[cat] = (cosByCat[cat] ?? 0) + amt;
        else if (OPERATING_CATS.has(cat)) opexByCat[cat] = (opexByCat[cat] ?? 0) + amt;
        else if (cat === "REFUND") refunds -= amt; // a refund we paid out reduces revenue
        else uncategorised += amt;
      }
    }

    const totalRevenue = Object.values(revenueByCat).reduce((s, v) => s + v, 0);
    const totalCostOfSales = Object.values(cosByCat).reduce((s, v) => s + v, 0);
    const totalOpex = Object.values(opexByCat).reduce((s, v) => s + v, 0);
    const grossProfit = totalRevenue - totalCostOfSales;
    const netProfit = grossProfit - totalOpex + refunds;

    // Accrual context — money owed to us / by us as of end date
    const [arSentApproved, arPendingReview, apWages, apOps] = await Promise.all([
      db.invoice.aggregate({
        where: { status: { in: ["SENT", "APPROVED", "OVERDUE"] as any } },
        _sum: { total: true },
      }),
      db.invoice.aggregate({
        where: { status: "PENDING_REVIEW" },
        _sum: { total: true },
      }),
      db.paymentRequest.aggregate({
        where: { status: { in: ["PENDING", "APPROVED"] } },
        _sum: { calculatedAmount: true },
      }),
      db.operationalExpense.aggregate({ _sum: { amount: true } }),
    ]);

    const bankAccount = await db.bankAccount.findFirst({
      where: { currentBalance: { not: null } },
      select: { bankName: true, accountName: true, currentBalance: true, balanceAsOf: true },
      orderBy: { balanceAsOf: "desc" },
    });

    // Reconciliation checkpoints — what internal system says vs bank
    const invoicesMarkedPaidInPeriod = await db.invoice.aggregate({
      where: {
        status: "PAID",
        paidDate: { gte: start, lte: end },
      },
      _sum: { total: true },
    });

    return {
      period: { start: start.toISOString(), end: end.toISOString() },
      cashBasis: {
        revenueByCategory: revenueByCat,
        totalRevenue,
        costOfSalesByCategory: cosByCat,
        totalCostOfSales,
        operatingExpensesByCategory: opexByCat,
        totalOperatingExpenses: totalOpex,
        refunds,
        uncategorisedFlowingBothWays: uncategorised,
        grossProfit,
        netProfit,
      },
      accrualSnapshot: {
        accountsReceivableSentApproved: arSentApproved._sum.total ?? 0,
        accountsReceivablePendingReview: arPendingReview._sum.total ?? 0,
        accountsPayableWages: apWages._sum.calculatedAmount ?? 0,
        accountsPayableOps: apOps._sum.amount ?? 0,
      },
      reconciliation: {
        invoicesMarkedPaidInPeriod: invoicesMarkedPaidInPeriod._sum.total ?? 0,
        bankInvoicePaymentReceipts: revenueByCat.INVOICE_PAYMENT ?? 0,
        gap:
          (revenueByCat.INVOICE_PAYMENT ?? 0) -
          (invoicesMarkedPaidInPeriod._sum.total ?? 0),
      },
      bankAccount: bankAccount
        ? {
            name: `${bankAccount.bankName} ${bankAccount.accountName ?? ""}`.trim(),
            currentBalance: bankAccount.currentBalance,
            asOf: bankAccount.balanceAsOf,
          }
        : null,
    };
  });
