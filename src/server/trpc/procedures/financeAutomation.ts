import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { runVatReconciliation } from "~/server/services/financeAutomation/vatReconciliation";

function assertAdmin(role: string) {
  if (!["SENIOR_ADMIN", "JUNIOR_ADMIN", "TECHNICAL_MANAGER"].includes(role)) throw new TRPCError({ code: "FORBIDDEN" });
}

export const getFinanceAutomationStatus = baseProcedure.input(z.object({ token: z.string() })).query(async ({ input }) => {
  const user = await authenticateUser(input.token); assertAdmin(user.role);
  const [reminderStats, latestVatRun, statementCount, recentStatements] = await Promise.all([
    db.debtorReminderLog.groupBy({ by: ["status"], _count: { _all: true } }),
    db.vatReconciliationRun.findFirst({ orderBy: { createdAt: "desc" } }),
    db.artisanPaymentStatement.count(),
    db.artisanPaymentStatement.findMany({ orderBy: { paymentDate: "desc" }, take: 10, include: { paymentRequest: { select: { requestNumber: true, artisan: { select: { firstName: true, lastName: true } } } } } }),
  ]);
  return { reminderStats: reminderStats.map(r => ({ status: r.status, count: r._count._all })), latestVatRun, statementCount, recentStatements };
});

export const listDebtorReminderHistory = baseProcedure.input(z.object({ token: z.string(), take: z.number().default(100) })).query(async ({ input }) => {
  const user = await authenticateUser(input.token); assertAdmin(user.role);
  return db.debtorReminderLog.findMany({ where: { status: { in: ["SENT", "FAILED"] } }, include: { invoice: { select: { invoiceNumber: true, customerName: true, total: true, dueDate: true } } }, orderBy: { createdAt: "desc" }, take: input.take });
});

export const listVatReconciliationRuns = baseProcedure.input(z.object({ token: z.string(), take: z.number().default(30) })).query(async ({ input }) => {
  const user = await authenticateUser(input.token); assertAdmin(user.role);
  return db.vatReconciliationRun.findMany({ orderBy: { createdAt: "desc" }, take: input.take });
});

export const runVatReconciliationNow = baseProcedure.input(z.object({ token: z.string() })).mutation(async ({ input }) => {
  const user = await authenticateUser(input.token); assertAdmin(user.role);
  return runVatReconciliation(`manual:${user.email}`);
});

export const listArtisanPaymentStatements = baseProcedure.input(z.object({ token: z.string(), take: z.number().default(100) })).query(async ({ input }) => {
  const user = await authenticateUser(input.token); assertAdmin(user.role);
  return db.artisanPaymentStatement.findMany({ orderBy: { paymentDate: "desc" }, take: input.take, include: { paymentRequest: { select: { requestNumber: true, artisan: { select: { firstName: true, lastName: true, email: true } } } } } });
});
