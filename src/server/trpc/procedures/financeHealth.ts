import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

function assertFinance(user: { role: string }) {
  if (!["SENIOR_ADMIN", "TECHNICAL_MANAGER", "JUNIOR_ADMIN"].includes(user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

export const getFinanceHealthSummary = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertFinance(user);

    const [
      invoiceStatusCounts,
      overdueResult,
      ageingBuckets,
      lineMismatchResult,
      noLinesResult,
      noDueDateResult,
      vatByMonth,
      inputVatByMonth,
      expenseFlags,
      flaggedItems,
      recentFixes,
      companyVat,
    ] = await Promise.all([
      db.$queryRaw<Array<{ status: string; count: bigint; value: number }>>`
        SELECT status::text, COUNT(*)::bigint, SUM(total)::float AS value
        FROM "Invoice" GROUP BY status ORDER BY SUM(total) DESC NULLS LAST
      `,
      db.$queryRaw<Array<{ count: bigint; value: number }>>`
        SELECT COUNT(*)::bigint, SUM(total)::float AS value FROM "Invoice"
        WHERE status NOT IN ('PAID','CANCELLED') AND "dueDate" < NOW() - INTERVAL '30 days'
      `,
      db.$queryRaw<Array<{ bucket: string; count: bigint; value: number }>>`
        SELECT
          CASE
            WHEN "dueDate" IS NULL THEN 'No due date'
            WHEN "dueDate" >= NOW() THEN 'Current'
            WHEN "dueDate" >= NOW() - INTERVAL '30 days' THEN '0-30 days'
            WHEN "dueDate" >= NOW() - INTERVAL '60 days' THEN '31-60 days'
            WHEN "dueDate" >= NOW() - INTERVAL '90 days' THEN '61-90 days'
            ELSE '90+ days' END AS bucket,
          COUNT(*)::bigint,
          SUM(total)::float AS value
        FROM "Invoice" WHERE status NOT IN ('PAID','CANCELLED','DRAFT')
        GROUP BY 1
      `,
      db.$queryRaw<Array<{ mismatch_rows: bigint; cum: number }>>`
        WITH li AS (SELECT "invoiceId", SUM(total) AS sum_lines FROM "InvoiceLineItem" GROUP BY "invoiceId")
        SELECT COUNT(*)::bigint AS mismatch_rows,
               COALESCE(SUM(ABS(i.total - li.sum_lines)), 0)::float AS cum
        FROM "Invoice" i LEFT JOIN li ON li."invoiceId" = i.id
        WHERE i.total > 0 AND ABS(i.total - COALESCE(li.sum_lines, 0)) > 2
      `,
      db.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint FROM "Invoice" i
        WHERE i.total > 0 AND NOT EXISTS (SELECT 1 FROM "InvoiceLineItem" li WHERE li."invoiceId" = i.id)
      `,
      db.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint FROM "Invoice" WHERE "dueDate" IS NULL AND status NOT IN ('CANCELLED','DRAFT')
      `,
      db.$queryRaw<Array<{ month: string; invoices: bigint; taxable_sales: number; output_vat: number }>>`
        SELECT TO_CHAR("createdAt", 'YYYY-MM') AS month,
               COUNT(*)::bigint AS invoices,
               COALESCE(SUM(subtotal),0)::float AS taxable_sales,
               COALESCE(SUM(tax),0)::float AS output_vat
        FROM "Invoice" WHERE status IN ('SENT','APPROVED','PAID','OVERDUE') AND "createdAt" > NOW() - INTERVAL '12 months'
        GROUP BY month ORDER BY month DESC LIMIT 12
      `,
      db.$queryRaw<Array<{ month: string; count: bigint; gross: number; input_vat: number }>>`
        SELECT TO_CHAR("createdAt", 'YYYY-MM') AS month,
               COUNT(*)::bigint,
               COALESCE(SUM(amount),0)::float AS gross,
               COALESCE(SUM(amount - "amountExclVat"),0)::float AS input_vat
        FROM "ExpenseSlip" WHERE amount > 0 AND "amountExclVat" IS NOT NULL AND "vatRate" > 0 AND "createdAt" > NOW() - INTERVAL '12 months'
        GROUP BY month ORDER BY month DESC LIMIT 12
      `,
      db.$queryRaw<Array<{ no_vat: bigint; no_receipt: bigint; approved_value: number }>>`
        SELECT
          COUNT(*) FILTER (WHERE amount > 100 AND ("amountExclVat" IS NULL OR "vatRate" IS NULL OR "vatRate" = 0))::bigint AS no_vat,
          COUNT(*) FILTER (WHERE amount > 500 AND url IS NULL)::bigint AS no_receipt,
          COALESCE(SUM(amount) FILTER (WHERE state = 'APPROVED'),0)::float AS approved_value
        FROM "ExpenseSlip"
      `,
      db.$queryRaw<Array<{ category: string; count: bigint }>>`
        SELECT category, COUNT(*)::bigint
        FROM "FinanceAuditFix"
        WHERE action LIKE 'FLAGGED%'
        GROUP BY category ORDER BY COUNT(*) DESC
      `,
      db.$queryRaw<Array<{ category: string; count: bigint; most_recent: Date }>>`
        SELECT category, COUNT(*)::bigint, MAX("createdAt") AS most_recent
        FROM "FinanceAuditFix"
        WHERE "createdAt" > NOW() - INTERVAL '30 days'
        GROUP BY category ORDER BY MAX("createdAt") DESC
      `,
      db.systemSettings.findUnique({ where: { key: "company_vat_number" } }).catch(() => null),
    ]);

    return {
      invoiceStatusCounts: invoiceStatusCounts.map((r) => ({ ...r, count: Number(r.count) })),
      overdue: overdueResult[0] ? { count: Number(overdueResult[0].count), value: overdueResult[0].value } : { count: 0, value: 0 },
      ageingBuckets: ageingBuckets.map((r) => ({ ...r, count: Number(r.count) })),
      lineMismatch: lineMismatchResult[0] ? { count: Number(lineMismatchResult[0].mismatch_rows), cumulative: lineMismatchResult[0].cum } : { count: 0, cumulative: 0 },
      invoicesWithoutLines: noLinesResult[0] ? Number(noLinesResult[0].count) : 0,
      invoicesWithoutDueDate: noDueDateResult[0] ? Number(noDueDateResult[0].count) : 0,
      vatByMonth: vatByMonth,
      inputVatByMonth: inputVatByMonth.map((r) => ({ ...r, count: Number(r.count) })),
      expenseFlags: expenseFlags[0] ? { noVat: Number(expenseFlags[0].no_vat), noReceipt: Number(expenseFlags[0].no_receipt), approvedValue: expenseFlags[0].approved_value } : { noVat: 0, noReceipt: 0, approvedValue: 0 },
      flaggedForReview: flaggedItems.map((r) => ({ category: r.category, count: Number(r.count) })),
      recentFixes: recentFixes.map((r) => ({ category: r.category, count: Number(r.count), mostRecent: r.most_recent })),
      companyVatNumber: companyVat?.value ?? null,
    };
  });

export const listFlaggedFinanceItems = baseProcedure
  .input(z.object({ token: z.string(), category: z.string().optional() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertFinance(user);
    const where: any = { action: { startsWith: "FLAGGED" } };
    if (input.category) where.category = input.category;
    return db.$queryRawUnsafe<Array<any>>(`
      SELECT f.id, f.category, f.entity, f."entityId", f.action, f.before, f."createdAt"
      FROM "FinanceAuditFix" f
      WHERE f.action LIKE 'FLAGGED%'
        ${input.category ? `AND f.category = '${input.category.replace(/'/g, "''")}'` : ""}
      ORDER BY f."createdAt" DESC
      LIMIT 200
    `);
  });

export const listFinanceAuditFixHistory = baseProcedure
  .input(z.object({ token: z.string(), take: z.number().default(100) }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertFinance(user);
    return db.$queryRawUnsafe<Array<any>>(`
      SELECT f.id, f.category, f.entity, f."entityId", f.action, f.before, f.after, f."createdAt"
      FROM "FinanceAuditFix" f
      ORDER BY f.id DESC
      LIMIT ${input.take}
    `);
  });

export const dismissFlag = baseProcedure
  .input(z.object({ token: z.string(), id: z.number(), resolution: z.string() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertFinance(user);
    await db.$executeRaw`
      UPDATE "FinanceAuditFix"
      SET action = 'RESOLVED',
          after = jsonb_build_object('resolution', ${input.resolution}, 'resolvedBy', ${user.email}, 'resolvedAt', NOW()::text)
      WHERE id = ${input.id}
    `;
    return { success: true };
  });
