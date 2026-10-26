/**
 * Fortnight wage report email builder + scheduler helper.
 * Renders an HTML summary and sends to every active WageReportRecipient.
 */
import { db } from "~/server/db";
import { sendEmail } from "~/server/utils/email";
import { fortnightWindowFor } from "~/server/trpc/procedures/wageReport";

function fmtR(n: number | null | undefined): string {
  return "R" + (n ?? 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function sendFortnightWageReportEmail(
  periodKey: "current" | "previous" = "previous",
): Promise<{ sent: number; skipped: number; period: { start: Date; end: Date } }> {
  const now = new Date();
  const ref = periodKey === "previous" ? new Date(now.getTime() - 14 * 86_400_000) : now;
  const { start, end } = fortnightWindowFor(ref);

  const recipients = await db.wageReportRecipient.findMany({ where: { isActive: true } });
  if (!recipients.length) return { sent: 0, skipped: 0, period: { start, end } };

  const requests = await db.paymentRequest.findMany({
    where: { createdAt: { gte: start, lt: end } },
    include: {
      artisan: { select: { id: true, firstName: true, lastName: true, hourlyRate: true, dailyRate: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const byArtisan = new Map<number, { name: string; pending: number; approved: number; paid: number; total: number; count: number }>();
  for (const r of requests) {
    const k = r.artisanId;
    if (!byArtisan.has(k)) {
      byArtisan.set(k, {
        name: `${r.artisan.firstName ?? ""} ${r.artisan.lastName ?? ""}`.trim(),
        pending: 0, approved: 0, paid: 0, total: 0, count: 0,
      });
    }
    const b = byArtisan.get(k)!;
    b.count++;
    b.total += r.calculatedAmount || 0;
    if (r.status === "PENDING") b.pending += r.calculatedAmount || 0;
    else if (r.status === "APPROVED") b.approved += r.calculatedAmount || 0;
    else if (r.status === "PAID") b.paid += r.calculatedAmount || 0;
  }

  const rows = Array.from(byArtisan.values()).sort((a, b) => b.total - a.total);
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const grandApproved = rows.reduce((s, r) => s + r.approved, 0);
  const grandPending = rows.reduce((s, r) => s + r.pending, 0);
  const grandPaid = rows.reduce((s, r) => s + r.paid, 0);

  const startStr = start.toLocaleDateString("en-ZA");
  const endEndOfPeriod = new Date(end.getTime() - 1);
  const endStr = endEndOfPeriod.toLocaleDateString("en-ZA");
  const appUrl = process.env.APP_URL || "https://square15management.co.za";

  const rowsHtml = rows.length
    ? rows
        .map(
          (r) => `
            <tr>
              <td style="padding:8px;border-bottom:1px solid #eee;">${r.name || "—"}</td>
              <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${r.count}</td>
              <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:#b45309;">${fmtR(r.pending)}</td>
              <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:#2D5016;">${fmtR(r.approved)}</td>
              <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:#065f46;">${fmtR(r.paid)}</td>
              <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${fmtR(r.total)}</td>
            </tr>`,
        )
        .join("")
    : `<tr><td colspan="6" style="padding:14px;color:#666;text-align:center;">No wage requests recorded in this fortnight.</td></tr>`;

  const html = `<!doctype html>
<html><body style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:780px;margin:0 auto;">
  <div style="background:#2D5016;color:#fff;padding:18px 24px;">
    <div style="font-size:12px;letter-spacing:2px;color:#F4C430;">SQUARE 15 FACILITY SOLUTIONS</div>
    <div style="font-size:20px;font-weight:700;">Fortnight Artisan Wage Report</div>
    <div style="font-size:13px;color:#e5f4d5;margin-top:4px;">${startStr} — ${endStr}</div>
  </div>
  <div style="padding:20px 24px;">
    <div style="display:flex;gap:12px;margin:0 0 20px 0;flex-wrap:wrap;">
      <div style="flex:1;min-width:150px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px;">
        <div style="font-size:11px;color:#9a3412;font-weight:600;">PENDING</div>
        <div style="font-size:20px;font-weight:700;color:#b45309;">${fmtR(grandPending)}</div>
      </div>
      <div style="flex:1;min-width:150px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px;">
        <div style="font-size:11px;color:#166534;font-weight:600;">APPROVED (READY TO PAY)</div>
        <div style="font-size:20px;font-weight:700;color:#2D5016;">${fmtR(grandApproved)}</div>
      </div>
      <div style="flex:1;min-width:150px;background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:12px;">
        <div style="font-size:11px;color:#065f46;font-weight:600;">PAID</div>
        <div style="font-size:20px;font-weight:700;color:#065f46;">${fmtR(grandPaid)}</div>
      </div>
      <div style="flex:1;min-width:150px;background:#f5f5f4;border:1px solid #d6d3d1;border-radius:8px;padding:12px;">
        <div style="font-size:11px;color:#57534e;font-weight:600;">TOTAL</div>
        <div style="font-size:20px;font-weight:700;color:#1c1917;">${fmtR(grandTotal)}</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:8px;text-align:left;border-bottom:2px solid #2D5016;">Artisan</th>
          <th style="padding:8px;text-align:right;border-bottom:2px solid #2D5016;">Reqs</th>
          <th style="padding:8px;text-align:right;border-bottom:2px solid #2D5016;">Pending</th>
          <th style="padding:8px;text-align:right;border-bottom:2px solid #2D5016;">Approved</th>
          <th style="padding:8px;text-align:right;border-bottom:2px solid #2D5016;">Paid</th>
          <th style="padding:8px;text-align:right;border-bottom:2px solid #2D5016;">Total</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <p style="margin:24px 0 8px 0;font-size:13px;color:#555;">Full drill-down (per job, join codes, invoice + PO status) is available in the live report:</p>
    <p style="margin:0 0 24px 0;">
      <a href="${appUrl}/admin/hr/wage-report" style="display:inline-block;padding:10px 20px;background:#2D5016;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Open live wage report →</a>
    </p>
    <p style="font-size:11px;color:#888;border-top:1px solid #eee;padding-top:12px;margin-top:24px;">
      This report is generated every 14 days and covers PaymentRequest rows created in the fortnight window.
      Manage recipients at ${appUrl}/admin/hr/wage-report (Recipients panel).
    </p>
  </div>
</body></html>`;

  const subject = `SQR15 Wage Report · ${startStr} — ${endStr} · ${fmtR(grandTotal)}`;
  let sent = 0;
  let skipped = 0;
  for (const r of recipients) {
    try {
      await sendEmail({ to: r.email, subject, html });
      sent++;
    } catch (e) {
      console.warn(`[wage-report] failed to send to ${r.email}: ${(e as Error).message}`);
      skipped++;
    }
  }
  console.log(`[wage-report] sent to ${sent}/${recipients.length} for ${startStr} — ${endStr}`);
  return { sent, skipped, period: { start, end } };
}

// ── Scheduler ─────────────────────────────────────────────────────────────
// Runs the email once per fortnight, on the Monday morning after the window closes.
// Idempotent: only sends if we haven't already sent for the just-closed fortnight.
let started = false;

export function bootstrapWageReportCron() {
  if (started) return;
  started = true;

  const CHECK_MS = 60 * 60 * 1000; // hourly check
  const TARGET_HOUR_SAST = 8; // send at/after 08:00 SAST (06:00 UTC) on the close day

  async function maybeSend() {
    try {
      const now = new Date();

      // Most recently CLOSED fortnight window.
      const { start: prevStart, end: prevEnd } = fortnightWindowFor(new Date(now.getTime() - 14 * 86_400_000));

      // Send once the window has closed and we've reached 08:00 SAST on the
      // close day. Using a "not before" lower bound (instead of an exact-hour
      // match) lets any later hourly tick catch up, so a restart/deploy around
      // the send time no longer causes the fortnight to be skipped forever.
      const sendNotBefore = new Date(prevEnd.getTime() + TARGET_HOUR_SAST * 3_600_000);
      if (now < sendNotBefore) return;

      // Idempotency check via WageReportRun table — guarantees exactly one send
      // per fortnight even though the catch-up window is now wide.
      const already = await db.wageReportRun.findFirst({
        where: { periodStart: prevStart, periodEnd: prevEnd },
      });
      if (already) return;

      console.log("[wage-report] running scheduled fortnight email…");
      const res = await sendFortnightWageReportEmail("previous");
      await db.wageReportRun.create({
        data: {
          periodStart: prevStart,
          periodEnd: prevEnd,
          sentCount: res.sent,
          skippedCount: res.skipped,
        },
      });
    } catch (e) {
      console.error("[wage-report] cron error:", (e as Error).message);
    }
  }

  // fire once ~30s after boot, then hourly
  setTimeout(maybeSend, 30_000);
  setInterval(maybeSend, CHECK_MS);
  console.log("[wage-report] fortnight cron armed");
}
