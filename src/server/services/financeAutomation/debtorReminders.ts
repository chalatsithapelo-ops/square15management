import { db } from "~/server/db";
import { sendEmail } from "~/server/utils/email";

// First reminder only once an invoice is 30 days past due, then every 30 days.
const FIRST_REMINDER_DAYS = 30;
const REMINDER_INTERVAL_DAYS = 30;
const MAX_THRESHOLD_DAYS = 360;
// One statement per recipient at most this often, however many invoices they owe.
const RECIPIENT_COOLDOWN_DAYS = 25;

const COMPANY_WORDS = /\b(pty|ltd|limited|inc|cc|group|property|properties|place|park|house|mall|fund|plaza|mansions?|towers?|centre|center|building|trust|holdings|investments?|club|estate|court|office|block|attorneys?|management|admin|creditors|accounts|marc|rivonia|road|street|avenue|c\/o)\b/i;

function looksLikePersonName(value: string | null | undefined): value is string {
  if (!value) return false;
  const name = value.trim().replace(/\s+/g, " ");
  if (!/^[A-Za-z][A-Za-z' -]+$/.test(name)) return false;
  const words = name.split(" ");
  return words.length >= 2 && words.length <= 4 && !COMPANY_WORDS.test(name);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function formatRand(amount: number): string {
  return `R ${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function thresholdFor(days: number): number | null {
  if (days < FIRST_REMINDER_DAYS) return null;
  return Math.min(MAX_THRESHOLD_DAYS, Math.floor(days / REMINDER_INTERVAL_DAYS) * REMINDER_INTERVAL_DAYS);
}

export async function runDebtorReminderSweep(limit = 500) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - FIRST_REMINDER_DAYS * 86400000);
  const invoices = await db.invoice.findMany({
    where: {
      status: { in: ["SENT", "APPROVED", "OVERDUE"] },
      isDisputed: false,
      dueDate: { lte: cutoff },
      customerEmail: { not: "" },
    },
    select: {
      id: true, invoiceNumber: true, customerName: true, customerEmail: true, total: true, depositAmount: true, dueDate: true,
      client: { select: { name: true, companyName: true } },
      clientBuilding: { select: { managerName: true } },
    },
    orderBy: { dueDate: "asc" },
    take: limit,
  });

  // Never chase an invoice the bank feed has already linked to a payment.
  const bankLinked = new Set(
    (await db.bankTransaction.findMany({
      where: { linkedInvoiceId: { in: invoices.map((i) => i.id) } },
      select: { linkedInvoiceId: true },
    })).map((t) => t.linkedInvoiceId),
  );

  const byRecipient = new Map<string, typeof invoices>();
  let skipped = 0;
  for (const inv of invoices) {
    const email = inv.customerEmail.trim().toLowerCase();
    if (bankLinked.has(inv.id)) { skipped++; continue; }
    if (/@(?:example\.(?:com|org|net)|invalid|test)$/.test(email)) {
      await db.debtorReminderLog.upsert({
        where: { invoiceId_thresholdDays: { invoiceId: inv.id, thresholdDays: 0 } },
        create: { invoiceId: inv.id, thresholdDays: 0, recipient: inv.customerEmail, status: "SKIPPED", errorMessage: "Placeholder/test email domain; no reminder sent" },
        update: { status: "SKIPPED", errorMessage: "Placeholder/test email domain; no reminder sent" },
      });
      skipped++;
      continue;
    }
    if (!byRecipient.has(email)) byRecipient.set(email, []);
    byRecipient.get(email)!.push(inv);
  }

  const users = await db.user.findMany({
    where: { email: { in: [...byRecipient.keys()], mode: "insensitive" } },
    select: { email: true, firstName: true, lastName: true },
  });
  const userNameByEmail = new Map(users.map((u) => [u.email.toLowerCase(), `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()]));

  let sent = 0, failed = 0;
  for (const [email, group] of byRecipient) {
    const recent = await db.debtorReminderLog.count({
      where: {
        recipient: { equals: email, mode: "insensitive" },
        OR: [
          { status: "SENT", sentAt: { gte: new Date(now.getTime() - RECIPIENT_COOLDOWN_DAYS * 86400000) } },
          { status: "SENDING", createdAt: { gte: new Date(now.getTime() - 86400000) } },
        ],
      },
    });
    if (recent > 0) { skipped += group.length; continue; }

    const rows = group.map((inv) => {
      const days = Math.floor((now.getTime() - inv.dueDate!.getTime()) / 86400000);
      return { inv, days, threshold: thresholdFor(days)!, outstanding: Math.max(0, inv.total - (inv.depositAmount ?? 0)) };
    });
    const priorLogs = await db.debtorReminderLog.findMany({
      where: { OR: rows.map((r) => ({ invoiceId: r.inv.id, thresholdDays: r.threshold })) },
      select: { invoiceId: true, thresholdDays: true, status: true },
    });
    const done = new Set(priorLogs.filter((l) => l.status !== "FAILED").map((l) => `${l.invoiceId}:${l.thresholdDays}`));
    const due = rows.filter((r) => !done.has(`${r.inv.id}:${r.threshold}`));
    if (due.length === 0) { skipped += group.length; continue; }

    // Claim the reminders before sending so a concurrent sweep cannot email the same client twice.
    await db.debtorReminderLog.deleteMany({ where: { status: "FAILED", OR: due.map((r) => ({ invoiceId: r.inv.id, thresholdDays: r.threshold })) } });
    const claimed = await db.debtorReminderLog.createMany({
      data: due.map((r) => ({ invoiceId: r.inv.id, thresholdDays: r.threshold, recipient: r.inv.customerEmail, status: "SENDING" })),
      skipDuplicates: true,
    });
    if (claimed.count !== due.length) { skipped += group.length; continue; }

    const greetingName = group.map((inv) => inv.client?.name).find(looksLikePersonName)
      ?? group.map((inv) => inv.clientBuilding?.managerName).find(looksLikePersonName)
      ?? (looksLikePersonName(userNameByEmail.get(email)) ? userNameByEmail.get(email) : undefined);
    const greeting = greetingName ? `Dear ${escapeHtml(greetingName)}` : "Dear Accounts Payable Team";
    const totalOutstanding = rows.reduce((sum, r) => sum + r.outstanding, 0);
    const tableRows = rows
      .map((r) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(r.inv.invoiceNumber)}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(r.inv.customerName || "")}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${r.inv.dueDate!.toLocaleDateString("en-ZA")}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${r.days}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatRand(r.outstanding)}</td></tr>`)
      .join("");
    const single = rows.length === 1 ? rows[0]! : null;
    const subject = single
      ? `Payment reminder: invoice ${single.inv.invoiceNumber} is ${single.days} days overdue`
      : `Statement of overdue invoices (${rows.length}) – Square 15 Facility Solutions`;
    const html = `<p>${greeting},</p>
<p>Our records show the following ${single ? "invoice is" : "invoices are"} more than ${FIRST_REMINDER_DAYS} days past the due date and still unpaid:</p>
<table style="border-collapse:collapse;font-size:13px;"><thead><tr style="background:#f3f4f6;text-align:left;"><th style="padding:6px 10px;">Invoice</th><th style="padding:6px 10px;">Property / Account</th><th style="padding:6px 10px;">Due date</th><th style="padding:6px 10px;text-align:right;">Days overdue</th><th style="padding:6px 10px;text-align:right;">Outstanding</th></tr></thead><tbody>${tableRows}</tbody><tfoot><tr><td colspan="4" style="padding:6px 10px;font-weight:bold;">Total outstanding</td><td style="padding:6px 10px;text-align:right;font-weight:bold;">${formatRand(totalOutstanding)}</td></tr></tfoot></table>
<p>Please arrange payment or contact us if you believe this notice is in error. If you have already paid, please reply with the proof of payment so we can allocate it.</p>
<p>Kind regards,<br/>Square 15 Facility Solutions<br/>info@square15.co.za · 078 380 0308</p>
<p style="font-size:11px;color:#666">Automated account reminder, sent no more than once every ${RECIPIENT_COOLDOWN_DAYS} days.</p>`;

    const claimWhere = { status: "SENDING", OR: due.map((r) => ({ invoiceId: r.inv.id, thresholdDays: r.threshold })) };
    try {
      await sendEmail({ to: group[0]!.customerEmail, subject, html });
      await db.debtorReminderLog.updateMany({ where: claimWhere, data: { status: "SENT", sentAt: new Date() } });
      sent++;
    } catch (e: any) {
      await db.debtorReminderLog.updateMany({ where: claimWhere, data: { status: "FAILED", errorMessage: e?.message ?? String(e) } });
      failed++;
    }
  }
  return { scanned: invoices.length, recipients: byRecipient.size, sent, skipped, failed };
}
