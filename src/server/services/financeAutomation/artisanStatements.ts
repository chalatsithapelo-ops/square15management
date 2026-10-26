import { db } from "~/server/db";
import { sendEmail } from "~/server/utils/email";

export async function ensureArtisanPaymentStatement(paymentRequestId: number, emailCopy = true) {
  const request = await db.paymentRequest.findUnique({ where: { id: paymentRequestId }, include: { artisan: { select: { id: true, firstName: true, lastName: true, email: true } } } });
  if (!request || request.status !== "PAID" || !request.paidDate) return null;
  const year = request.paidDate.getFullYear();
  const month = String(request.paidDate.getMonth() + 1).padStart(2, "0");
  const statementNumber = `ARS-${year}-${month}-${String(request.id).padStart(6, "0")}`;
  const record = await db.artisanPaymentStatement.upsert({
    where: { paymentRequestId: request.id },
    create: { statementNumber, paymentRequestId: request.id, artisanId: request.artisanId, paymentDate: request.paidDate, grossAmount: request.calculatedAmount, withholdingAmount: 0, netAmount: request.calculatedAmount, classification: "INDEPENDENT_CONTRACTOR", notes: "Contractor payment advice. No PAYE/UIF withheld; not an employee payslip." },
    update: {},
  });
  if (emailCopy && request.artisan.email && !record.emailedAt) {
    const name = `${request.artisan.firstName ?? ""} ${request.artisan.lastName ?? ""}`.trim();
    await sendEmail({ to: request.artisan.email, subject: `Payment advice ${statementNumber} — Square 15`, html: `<p>Hi ${name || "there"},</p><p>Your contractor payment has been recorded as paid.</p><p><b>Statement:</b> ${statementNumber}<br/><b>Payment request:</b> ${request.requestNumber}<br/><b>Payment date:</b> ${request.paidDate.toLocaleDateString("en-ZA")}<br/><b>Gross/net paid:</b> R ${request.calculatedAmount.toLocaleString("en-ZA", {minimumFractionDigits:2})}<br/><b>Withholding:</b> R 0.00</p><p>This is a contractor payment advice, not an employee payslip. Tax obligations depend on your tax status; consult your tax practitioner if needed.</p><p>Square 15 Facility Solutions</p>` });
    await db.artisanPaymentStatement.update({ where: { id: record.id }, data: { emailedAt: new Date() } });
  }
  return record;
}

export async function backfillPaidArtisanStatements() {
  const paid = await db.paymentRequest.findMany({ where: { status: "PAID", paidDate: { not: null }, artisanStatement: null }, select: { id: true }, take: 250, orderBy: { paidDate: "asc" } });
  let created = 0;
  for (const r of paid) { try { await ensureArtisanPaymentStatement(r.id, false); created++; } catch (e) { console.error("[finance-automation] statement error", r.id, e); } }
  return { scanned: paid.length, created };
}
