import { db } from "~/server/db";
export async function runVatReconciliation(runBy = "scheduler") {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const periodEnd = now;
  const [output, input, vatMismatch, lineMismatch, missingVat] = await Promise.all([
    db.$queryRaw<Array<{value:number}>>`SELECT COALESCE(SUM(tax),0)::float AS value FROM "Invoice" WHERE status IN ('SENT','APPROVED','PAID','OVERDUE') AND "createdAt">=${periodStart} AND "createdAt"<${periodEnd}`,
    db.$queryRaw<Array<{value:number}>>`SELECT COALESCE(SUM(amount-"amountExclVat"),0)::float AS value FROM "ExpenseSlip" WHERE state='APPROVED' AND "amountExclVat" IS NOT NULL AND "vatRate" IS NOT NULL AND "vatRate">0 AND "createdAt">=${periodStart} AND "createdAt"<${periodEnd}`,
    db.$queryRaw<Array<{count:bigint;variance:number}>>`SELECT COUNT(*)::bigint AS count, COALESCE(SUM(ABS(tax-subtotal*0.15)),0)::float AS variance FROM "Invoice" WHERE status IN ('SENT','APPROVED','PAID','OVERDUE') AND "createdAt">=${periodStart} AND "createdAt"<${periodEnd} AND subtotal>0 AND tax>0 AND ABS(tax-subtotal*0.15)>1`,
    db.$queryRaw<Array<{count:bigint;variance:number}>>`WITH li AS (SELECT "invoiceId",SUM(total) AS sum_lines FROM "InvoiceLineItem" GROUP BY "invoiceId") SELECT COUNT(*)::bigint AS count,COALESCE(SUM(ABS(i.total-COALESCE(li.sum_lines,0))),0)::float AS variance FROM "Invoice" i LEFT JOIN li ON li."invoiceId"=i.id WHERE i."createdAt">=${periodStart} AND i."createdAt"<${periodEnd} AND i.status!='CANCELLED' AND ABS(i.total-COALESCE(li.sum_lines,0))>2`,
    db.$queryRaw<Array<{count:bigint;value:number}>>`SELECT COUNT(*)::bigint AS count,COALESCE(SUM(amount-amount/1.15),0)::float AS value FROM "ExpenseSlip" WHERE state='APPROVED' AND amount>100 AND ("amountExclVat" IS NULL OR "vatRate" IS NULL OR "vatRate"=0) AND "createdAt">=${periodStart} AND "createdAt"<${periodEnd}`,
  ]);
  const outputVat=output[0]?.value??0, inputVat=input[0]?.value??0;
  return db.vatReconciliationRun.create({ data: { periodStart, periodEnd, outputVat, inputVat, estimatedPayable: outputVat-inputVat, invoiceVatMismatch: Number(vatMismatch[0]?.count??0), invoiceVatVariance: vatMismatch[0]?.variance??0, invoiceLineMismatch: Number(lineMismatch[0]?.count??0), invoiceLineVariance: lineMismatch[0]?.variance??0, expensesMissingVat: Number(missingVat[0]?.count??0), expensesPotentialVat: missingVat[0]?.value??0, runBy, details: {generatedAt:now} as any } });
}
