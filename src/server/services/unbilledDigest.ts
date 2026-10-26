// Weekly "Money on the Floor" digest service.
// Sends an email + in-app notification to senior_admin + technical_manager + manager
// with the current totalAtRisk + top oldest + top highest-value rows.

import { db } from "~/server/db";
import { sendEmail } from "~/server/utils/email";
import { createNotification } from "~/server/utils/notifications";

function classifyBlockers(o: any): { atRiskValue: number; blockers: string[] } {
  const blockers: string[] = [];
  if (o.orderNumberStatus === "PENDING_FROM_CLIENT" && !o.clientOrderNumber) blockers.push("NO_ORDER_NUMBER");
  if (o.status === "COMPLETED" && !o.invoice) blockers.push(o.quotationId ? "AWAITING_INVOICE" : "AWAITING_QUOTATION");
  if (o.selfInitiated && !o.adminReviewedAt) blockers.push("PENDING_ADMIN_REVIEW");
  if (o.status === "COMPLETED" && !o.signedJobCardUrl && !o.clientUnavailableToSign) blockers.push("AWAITING_SIGNATURE");
  const total = (typeof o.totalCost === "number" && o.totalCost > 0)
    ? o.totalCost
    : (o.labourCost || 0) + (o.materialCost || 0);
  return { atRiskValue: total, blockers };
}

export async function sendUnbilledWorkDigestNow(): Promise<{ recipients: number; totalAtRisk: number }> {
  const where: any = {
    OR: [
      { AND: [{ status: "COMPLETED" }, { invoice: { is: null } }] },
      { orderNumberStatus: "PENDING_FROM_CLIENT" },
      { AND: [{ selfInitiated: true }, { adminReviewedAt: null }] },
    ],
  };
  const orders = await db.order.findMany({
    where,
    include: {
      client: { select: { name: true } },
      clientBuilding: { select: { name: true, address: true } },
      assignedTo: { select: { firstName: true, lastName: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
    },
    orderBy: { endTime: "desc" },
    take: 2000,
  });

  const now = Date.now();
  const enriched = orders.map((o: any) => {
    const { atRiskValue, blockers } = classifyBlockers(o);
    const completedAt = o.completedAt ?? o.endTime ?? null;
    const ageDays = completedAt ? Math.floor((now - new Date(completedAt).getTime()) / 86400000) : 0;
    return { ...o, atRiskValue, blockers, ageDays, completedAt };
  });

  const totalAtRisk = enriched.reduce((s, r) => s + r.atRiskValue, 0);
  const top5Oldest = [...enriched].sort((a, b) => b.ageDays - a.ageDays).slice(0, 5);
  const top5Value = [...enriched].sort((a, b) => b.atRiskValue - a.atRiskValue).slice(0, 5);

  // Find recipients
  const recipients = await db.user.findMany({
    where: { role: { in: ["SENIOR_ADMIN", "TECHNICAL_MANAGER", "MANAGER"] } },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  });

  const fmt = (n: number) => `R ${n.toLocaleString("en-ZA", { maximumFractionDigits: 2 })}`;
  const renderRow = (r: any) => `
    <tr>
      <td style="padding:6px 8px;border:1px solid #ddd;">${r.orderNumber}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;">${r.client?.name ?? r.customerName ?? ""}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;">${r.clientBuilding?.name ?? r.address ?? ""}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;">${r.assignedTo ? `${r.assignedTo.firstName} ${r.assignedTo.lastName}` : ""}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;text-align:right;">${fmt(r.atRiskValue)}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;text-align:right;">${r.ageDays}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;font-size:11px;">${r.blockers.join(", ")}</td>
    </tr>
  `;

  const html = `
    <div style="font-family:Arial,sans-serif;color:#222;max-width:880px;">
      <h1 style="color:#9c1a1a;">Money on the Floor</h1>
      <p style="font-size:18px;">
        Total at risk: <strong style="color:#9c1a1a;">${fmt(totalAtRisk)}</strong>
        across <strong>${enriched.length}</strong> jobs.
      </p>

      <h3 style="margin-top:24px;">Top 5 oldest unbilled jobs</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead style="background:#f4f4f4;">
          <tr><th style="padding:6px;border:1px solid #ddd;">Order</th><th style="padding:6px;border:1px solid #ddd;">Client</th><th style="padding:6px;border:1px solid #ddd;">Building</th><th style="padding:6px;border:1px solid #ddd;">Artisan</th><th style="padding:6px;border:1px solid #ddd;">At risk</th><th style="padding:6px;border:1px solid #ddd;">Age (d)</th><th style="padding:6px;border:1px solid #ddd;">Blockers</th></tr>
        </thead>
        <tbody>${top5Oldest.map(renderRow).join("")}</tbody>
      </table>

      <h3 style="margin-top:24px;">Top 5 highest-value unbilled jobs</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead style="background:#f4f4f4;">
          <tr><th style="padding:6px;border:1px solid #ddd;">Order</th><th style="padding:6px;border:1px solid #ddd;">Client</th><th style="padding:6px;border:1px solid #ddd;">Building</th><th style="padding:6px;border:1px solid #ddd;">Artisan</th><th style="padding:6px;border:1px solid #ddd;">At risk</th><th style="padding:6px;border:1px solid #ddd;">Age (d)</th><th style="padding:6px;border:1px solid #ddd;">Blockers</th></tr>
        </thead>
        <tbody>${top5Value.map(renderRow).join("")}</tbody>
      </table>

      <p style="margin-top:24px;font-size:13px;color:#666;">
        Live dashboard: <a href="${process.env.PUBLIC_APP_URL || ""}/admin/billing/unbilled-work">/admin/billing/unbilled-work</a>
      </p>
    </div>
  `;

  for (const rcpt of recipients) {
    try {
      await sendEmail({
        to: rcpt.email,
        subject: `[Money on the Floor] ${fmt(totalAtRisk)} of work not yet invoiced`,
        html,
      });
    } catch (e) {
      console.error(`[UnbilledDigest] email to ${rcpt.email} failed:`, e);
    }
    try {
      await createNotification({
        recipientId: rcpt.id,
        recipientRole: rcpt.role,
        message: `Weekly unbilled work digest: ${fmt(totalAtRisk)} across ${enriched.length} jobs.`,
        type: "UNBILLED_WORK_ALERT",
      });
    } catch (e) {
      console.error(`[UnbilledDigest] notify ${rcpt.id} failed:`, e);
    }
  }

  return { recipients: recipients.length, totalAtRisk };
}

// Bootstrap a once-a-week scheduler. We schedule from the next Monday 07:00 SAST
// onwards. The interval here is daily-check-and-fire-on-monday (so we don't
// have to maintain a separate cron expression parser).
let _unbilledStarted = false;
export function bootstrapUnbilledWorkDigest() {
  if (_unbilledStarted) return;
  if (process.env.UNBILLED_DIGEST_ENABLED === "0") return;
  _unbilledStarted = true;

  const intervalHours = 6; // check 4x daily
  const intervalMs = intervalHours * 60 * 60 * 1000;
  let lastSentDate = "";

  const check = async () => {
    try {
      // SAST = UTC+2
      const now = new Date();
      const sast = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const isMonday = sast.getUTCDay() === 1;
      const hour = sast.getUTCHours();
      const todayKey = sast.toISOString().slice(0, 10);
      if (isMonday && hour >= 7 && hour < 13 && lastSentDate !== todayKey) {
        await sendUnbilledWorkDigestNow();
        lastSentDate = todayKey;
        console.log("[UnbilledDigest] weekly digest sent");
      }
    } catch (err) {
      console.error("[UnbilledDigest] check failed:", err);
    }
  };

  // Run once at boot (won't actually send unless Monday 07-13 SAST)
  setTimeout(check, 30 * 1000);
  setInterval(check, intervalMs);
  console.log(`[UnbilledDigest] scheduler started (checks every ${intervalHours}h, fires Mon 07-13 SAST)`);
}
