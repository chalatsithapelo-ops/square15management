/**
 * PR-9 — Portfolio Digest
 * ═══════════════════════════════════════════════════════════════════════════
 * Daily digest for each portfolio owner (JA / SA / TM / Manager). Covers the
 * items in their scope needing attention:
 *   1. Overdue invoices (SENT/OVERDUE/APPROVED/PENDING_APPROVAL, dueDate<now).
 *   2. Invoices due next 7 days.
 *   3. Stale quotations (SENT_TO_CUSTOMER, updatedAt>5d ago).
 *   4. Idle orders (IN_PROGRESS, no jobActivity in >3d).
 *   5. Missing signed job cards on completed orders.
 *   6. Missing order numbers (orderNumberStatus=PENDING_FROM_CLIENT).
 *   7. Completed jobs needing invoicing (no Invoice row).
 *   8. Completed jobs needing quotation (self-initiated, no quotationId).
 *
 * On-leave routing: if owner is on leave, digest is sent to portfolioBackupOwner.
 *
 * Weekly senior digest (Monday 07:00 SAST): portfolio health per JA + AR
 * aging + Unassigned pool count. Sent to all SENIOR_ADMIN + MANAGER.
 */

import { db } from "~/server/db";
import { sendEmail } from "~/server/utils/email";
import { createNotification } from "~/server/utils/notifications";
import { portfolioMineWhereForDoc, getOwnedClientsAndBuildingsForUser } from "./portfolioOwnership";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface DigestBundle {
  overdueInvoices: any[];
  dueSoonInvoices: any[];
  staleQuotations: any[];
  idleOrders: any[];
  missingJobCards: any[];
  missingOrderNumbers: any[];
  completedNeedInvoice: any[];
  completedNeedQuote: any[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}
function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

function fmtMoney(v: number | null | undefined): string {
  if (v == null) return "R0";
  return `R${Number(v).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "2-digit" });
}
function ageDays(d: Date | string | null | undefined): number {
  if (!d) return 0;
  return Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
}

// ═══════════════════════════════════════════════════════════════════════════
// Per-owner digest bundle
// ═══════════════════════════════════════════════════════════════════════════

async function collectDigestForOwner(ownerId: number): Promise<DigestBundle> {
  const scopeWhere = await portfolioMineWhereForDoc(ownerId);
  const now = new Date();

  const [
    overdueInvoices,
    dueSoonInvoices,
    staleQuotations,
    idleOrdersCandidates,
    missingJobCards,
    missingOrderNumbers,
    completedNeedInvoice,
    completedNeedQuote,
  ] = await Promise.all([
    // 1. Overdue invoices
    db.invoice.findMany({
      where: {
        AND: [
          scopeWhere,
          { status: { in: ["SENT", "OVERDUE", "APPROVED", "PENDING_APPROVAL"] as any } },
          { dueDate: { lt: now } },
        ],
      },
      select: {
        id: true, invoiceNumber: true, total: true, dueDate: true, status: true,
        customerName: true,
        client: { select: { name: true, companyName: true } },
        clientBuilding: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 100,
    }),

    // 2. Due in next 7 days
    db.invoice.findMany({
      where: {
        AND: [
          scopeWhere,
          { status: { in: ["SENT", "APPROVED", "PENDING_APPROVAL"] as any } },
          { dueDate: { gte: now, lte: daysFromNow(7) } },
        ],
      },
      select: {
        id: true, invoiceNumber: true, total: true, dueDate: true, customerName: true,
        client: { select: { name: true, companyName: true } },
        clientBuilding: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 100,
    }),

    // 3. Stale quotations
    db.quotation.findMany({
      where: {
        AND: [
          scopeWhere,
          { status: { in: ["SENT_TO_CUSTOMER"] as any } },
          { updatedAt: { lt: daysAgo(5) } },
        ],
      },
      select: {
        id: true, quoteNumber: true, total: true, updatedAt: true, customerName: true,
        client: { select: { name: true, companyName: true } },
        clientBuilding: { select: { name: true } },
      },
      orderBy: { updatedAt: "asc" },
      take: 100,
    }),

    // 4. Idle orders (IN_PROGRESS with no recent activity)
    db.order.findMany({
      where: {
        AND: [
          scopeWhere,
          { status: { in: ["IN_PROGRESS", "ASSIGNED"] as any } },
        ],
      },
      select: {
        id: true, orderNumber: true, customerName: true, status: true,
        updatedAt: true,
        client: { select: { name: true, companyName: true } },
        clientBuilding: { select: { name: true } },
        jobActivities: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
      orderBy: { updatedAt: "asc" },
      take: 100,
    }),

    // 5. Missing signed job cards (completed, no signature)
    db.order.findMany({
      where: {
        AND: [
          scopeWhere,
          { status: "COMPLETED" as any },
          { signedJobCardUrl: null },
          { clientUnavailableToSign: false },
        ],
      },
      select: {
        id: true, orderNumber: true, customerName: true, endTime: true,
        client: { select: { name: true, companyName: true } },
        clientBuilding: { select: { name: true } },
      },
      orderBy: { endTime: "desc" },
      take: 100,
    }),

    // 6. Missing client order numbers
    db.order.findMany({
      where: {
        AND: [
          scopeWhere,
          { orderNumberStatus: "PENDING_FROM_CLIENT" as any },
        ],
      },
      select: {
        id: true, orderNumber: true, customerName: true, createdAt: true,
        client: { select: { name: true, companyName: true } },
        clientBuilding: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),

    // 7. Completed jobs needing invoicing (no Invoice)
    db.order.findMany({
      where: {
        AND: [
          scopeWhere,
          { status: "COMPLETED" as any },
          { invoice: null },
        ],
      },
      select: {
        id: true, orderNumber: true, customerName: true, endTime: true, totalCost: true,
        client: { select: { name: true, companyName: true } },
        clientBuilding: { select: { name: true } },
      },
      orderBy: { endTime: "desc" },
      take: 100,
    }),

    // 8. Completed self-initiated jobs needing quote
    db.order.findMany({
      where: {
        AND: [
          scopeWhere,
          { status: "COMPLETED" as any },
          { selfInitiated: true },
          { quotationId: null },
        ],
      },
      select: {
        id: true, orderNumber: true, customerName: true, endTime: true,
        client: { select: { name: true, companyName: true } },
        clientBuilding: { select: { name: true } },
      },
      orderBy: { endTime: "desc" },
      take: 100,
    }),
  ]);

  // Filter idle orders where latest activity is >3 days old
  const cutoff = daysAgo(3);
  const idleOrders = idleOrdersCandidates.filter((o) => {
    const last = o.jobActivities?.[0]?.createdAt ?? o.updatedAt;
    return new Date(last) < cutoff;
  });

  return {
    overdueInvoices,
    dueSoonInvoices,
    staleQuotations,
    idleOrders,
    missingJobCards,
    missingOrderNumbers,
    completedNeedInvoice,
    completedNeedQuote,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Email composition
// ═══════════════════════════════════════════════════════════════════════════

function docLabel(d: any): string {
  return (
    d.clientBuilding?.name ??
    d.client?.companyName ??
    d.client?.name ??
    d.customerName ??
    "Ad-hoc"
  );
}

function renderInvoiceRow(inv: any): string {
  const age = ageDays(inv.dueDate);
  return `<tr>
    <td style="padding:6px 10px">${inv.invoiceNumber ?? "—"}</td>
    <td style="padding:6px 10px">${docLabel(inv)}</td>
    <td style="padding:6px 10px">${fmtMoney(inv.total)}</td>
    <td style="padding:6px 10px">${fmtDate(inv.dueDate)} <span style="color:#dc2626;font-weight:600">(${age}d)</span></td>
  </tr>`;
}
function renderQuoteRow(q: any): string {
  return `<tr>
    <td style="padding:6px 10px">${q.quoteNumber ?? "—"}</td>
    <td style="padding:6px 10px">${docLabel(q)}</td>
    <td style="padding:6px 10px">${fmtMoney(q.total)}</td>
    <td style="padding:6px 10px">${fmtDate(q.updatedAt)} <span style="color:#b45309">(${ageDays(q.updatedAt)}d idle)</span></td>
  </tr>`;
}
function renderOrderRow(o: any): string {
  return `<tr>
    <td style="padding:6px 10px">${o.orderNumber ?? "—"}</td>
    <td style="padding:6px 10px">${docLabel(o)}</td>
    <td style="padding:6px 10px">${o.status ?? "—"}</td>
    <td style="padding:6px 10px">${fmtDate(o.endTime ?? o.updatedAt ?? o.createdAt)}</td>
  </tr>`;
}

function section(title: string, rowsHtml: string, count: number, colour: string): string {
  if (count === 0) return "";
  return `
  <h3 style="margin:18px 0 6px;color:${colour};font-size:14px">${title} <span style="background:${colour};color:white;padding:2px 6px;border-radius:4px;font-size:11px">${count}</span></h3>
  <table style="width:100%;border-collapse:collapse;font-size:12px;background:#fff;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
    ${rowsHtml}
  </table>`;
}

function composeDigestHtml(ownerName: string, bundle: DigestBundle): string {
  const total =
    bundle.overdueInvoices.length +
    bundle.dueSoonInvoices.length +
    bundle.staleQuotations.length +
    bundle.idleOrders.length +
    bundle.missingJobCards.length +
    bundle.missingOrderNumbers.length +
    bundle.completedNeedInvoice.length +
    bundle.completedNeedQuote.length;

  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:720px;margin:0 auto;padding:20px;background:#f9fafb">
    <h2 style="margin:0 0 4px;color:#111827">Portfolio digest — ${ownerName}</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:12px">${total} item${total === 1 ? "" : "s"} needing your attention today.</p>

    ${section("💰 Overdue invoices", bundle.overdueInvoices.map(renderInvoiceRow).join(""), bundle.overdueInvoices.length, "#dc2626")}
    ${section("⏰ Due in next 7 days", bundle.dueSoonInvoices.map(renderInvoiceRow).join(""), bundle.dueSoonInvoices.length, "#f59e0b")}
    ${section("📝 Quotations idle >5d", bundle.staleQuotations.map(renderQuoteRow).join(""), bundle.staleQuotations.length, "#b45309")}
    ${section("🛠️ Orders idle >3d", bundle.idleOrders.map(renderOrderRow).join(""), bundle.idleOrders.length, "#f59e0b")}
    ${section("📋 Missing signed job cards", bundle.missingJobCards.map(renderOrderRow).join(""), bundle.missingJobCards.length, "#7c3aed")}
    ${section("🔢 Missing client order numbers", bundle.missingOrderNumbers.map(renderOrderRow).join(""), bundle.missingOrderNumbers.length, "#7c3aed")}
    ${section("🧾 Completed jobs needing invoice", bundle.completedNeedInvoice.map(renderOrderRow).join(""), bundle.completedNeedInvoice.length, "#059669")}
    ${section("📄 Completed jobs needing quotation", bundle.completedNeedQuote.map(renderOrderRow).join(""), bundle.completedNeedQuote.length, "#059669")}

    <p style="margin-top:24px;color:#9ca3af;font-size:11px;text-align:center">
      Sent by SQR15 Portfolio automation · <a href="https://square15.co.za/admin/dashboard" style="color:#6b7280">Open dashboard</a>
    </p>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Route: send to owner OR their backup if on leave
// ═══════════════════════════════════════════════════════════════════════════

async function resolveDigestRecipient(
  owner: any,
): Promise<{ userId: number; email: string; name: string; role: string } | null> {
  const now = new Date();
  const onLeave =
    owner.onLeaveFrom &&
    owner.onLeaveUntil &&
    new Date(owner.onLeaveFrom) <= now &&
    new Date(owner.onLeaveUntil) >= now;

  if (onLeave && owner.portfolioBackupOwnerId) {
    const backup = await db.user.findUnique({
      where: { id: owner.portfolioBackupOwnerId },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });
    if (backup?.email) {
      return {
        userId: backup.id,
        email: backup.email,
        role: backup.role,
        name: `${backup.firstName} ${backup.lastName} (covering for ${owner.firstName})`,
      };
    }
  }
  if (!owner.email) return null;
  return {
    userId: owner.id,
    email: owner.email,
    role: owner.role,
    name: `${owner.firstName} ${owner.lastName}`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Daily per-owner digest
// ═══════════════════════════════════════════════════════════════════════════

export async function sendDailyPortfolioDigest(): Promise<number> {
  // Every user who currently owns at least one client or building.
  const owners = await db.user.findMany({
    where: {
      OR: [
        { ownedClients: { some: {} } },
        { ownedClientBuildings: { some: {} } },
      ],
    },
    select: {
      id: true, email: true, firstName: true, lastName: true, role: true,
      onLeaveFrom: true, onLeaveUntil: true, portfolioBackupOwnerId: true,
    },
  });

  let sent = 0;
  for (const owner of owners) {
    try {
      const bundle = await collectDigestForOwner(owner.id);
      const total =
        bundle.overdueInvoices.length +
        bundle.dueSoonInvoices.length +
        bundle.staleQuotations.length +
        bundle.idleOrders.length +
        bundle.missingJobCards.length +
        bundle.missingOrderNumbers.length +
        bundle.completedNeedInvoice.length +
        bundle.completedNeedQuote.length;
      if (total === 0) continue;

      const recipient = await resolveDigestRecipient(owner);
      if (!recipient) continue;

      const html = composeDigestHtml(recipient.name, bundle);
      await sendEmail({
        to: recipient.email,
        subject: `Your portfolio digest — ${total} item${total === 1 ? "" : "s"} this week`,
        html,
      }).catch((e) => console.error("[portfolio-digest] email failed:", e));

      await createNotification({
        recipientId: recipient.userId,
        recipientRole: recipient.role,
        type: "SYSTEM_ALERT",
        message: `Portfolio digest: ${total} item${total === 1 ? "" : "s"} need your attention this week.`,
      }).catch(() => {});

      sent++;
    } catch (err) {
      console.error(`[portfolio-digest] owner ${owner.id} failed:`, err);
    }
  }
  return sent;
}

// ═══════════════════════════════════════════════════════════════════════════
// Weekly senior digest — portfolio health per JA + AR aging + Unassigned pool
// ═══════════════════════════════════════════════════════════════════════════

interface JaHealthRow {
  userId: number;
  name: string;
  clientCount: number;
  overdueCount: number;
  overdueAmount: number;
  dueSoonCount: number;
  staleQuotes: number;
  idleOrders: number;
  missingJobCards: number;
  missingOrderNumbers: number;
  onLeave: boolean;
}

export async function sendWeeklySeniorDigest(): Promise<number> {
  const juniors = await db.user.findMany({
    where: { role: { in: ["JUNIOR_ADMIN", "TECHNICAL_MANAGER"] } },
    select: {
      id: true, firstName: true, lastName: true,
      onLeaveFrom: true, onLeaveUntil: true,
    },
  });

  const now = new Date();
  const rows: JaHealthRow[] = [];
  for (const j of juniors) {
    const { ownedClientIds, ownedBuildingIds } = await getOwnedClientsAndBuildingsForUser(j.id);
    if (ownedClientIds.length === 0 && ownedBuildingIds.length === 0) continue;
    const bundle = await collectDigestForOwner(j.id);
    const overdueAmount = bundle.overdueInvoices.reduce(
      (sum, i) => sum + Number(i.total || 0),
      0,
    );
    const onLeave =
      j.onLeaveFrom && j.onLeaveUntil &&
      new Date(j.onLeaveFrom) <= now && new Date(j.onLeaveUntil) >= now;
    rows.push({
      userId: j.id,
      name: `${j.firstName} ${j.lastName}`,
      clientCount: ownedClientIds.length,
      overdueCount: bundle.overdueInvoices.length,
      overdueAmount,
      dueSoonCount: bundle.dueSoonInvoices.length,
      staleQuotes: bundle.staleQuotations.length,
      idleOrders: bundle.idleOrders.length,
      missingJobCards: bundle.missingJobCards.length,
      missingOrderNumbers: bundle.missingOrderNumbers.length,
      onLeave: !!onLeave,
    });
  }

  // AR aging bucket for whole business
  const openInvoices = await db.invoice.findMany({
    where: {
      status: { in: ["SENT", "OVERDUE", "APPROVED", "PENDING_APPROVAL"] as any },
    },
    select: { total: true, dueDate: true },
  });
  const arBuckets = { current: 0, d1to30: 0, d31to60: 0, d61to90: 0, d90plus: 0 };
  for (const inv of openInvoices) {
    const days = inv.dueDate ? Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const amt = Number(inv.total || 0);
    if (days <= 0) arBuckets.current += amt;
    else if (days <= 30) arBuckets.d1to30 += amt;
    else if (days <= 60) arBuckets.d31to60 += amt;
    else if (days <= 90) arBuckets.d61to90 += amt;
    else arBuckets.d90plus += amt;
  }

  // Unassigned pool
  const unassignedCount = await db.client.count({ where: { portfolioOwnerId: null } });

  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:820px;margin:0 auto;padding:20px;background:#f9fafb">
    <h2 style="margin:0 0 4px;color:#111827">Weekly portfolio health — Junior Admins</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:12px">Data as of ${fmtDate(now)}. Traffic-light view per junior + AR aging.</p>

    <h3 style="margin:16px 0 6px;color:#111827;font-size:13px">Per-junior workload</h3>
    <table style="width:100%;border-collapse:collapse;font-size:12px;background:#fff;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
      <thead style="background:#f3f4f6"><tr>
        <th style="padding:8px 10px;text-align:left">Junior</th>
        <th style="padding:8px 10px;text-align:right">Clients</th>
        <th style="padding:8px 10px;text-align:right">Overdue</th>
        <th style="padding:8px 10px;text-align:right">Overdue R</th>
        <th style="padding:8px 10px;text-align:right">Due 7d</th>
        <th style="padding:8px 10px;text-align:right">Stale Q</th>
        <th style="padding:8px 10px;text-align:right">Idle Ord</th>
        <th style="padding:8px 10px;text-align:right">No JC</th>
        <th style="padding:8px 10px;text-align:right">No PO#</th>
      </tr></thead>
      <tbody>
      ${rows
        .map(
          (r) => `<tr>
        <td style="padding:6px 10px">${r.name}${r.onLeave ? " <span style='background:#fde68a;padding:1px 4px;border-radius:3px;font-size:10px'>ON LEAVE</span>" : ""}</td>
        <td style="padding:6px 10px;text-align:right">${r.clientCount}</td>
        <td style="padding:6px 10px;text-align:right;color:${r.overdueCount > 5 ? "#dc2626" : "#111827"}">${r.overdueCount}</td>
        <td style="padding:6px 10px;text-align:right">${fmtMoney(r.overdueAmount)}</td>
        <td style="padding:6px 10px;text-align:right">${r.dueSoonCount}</td>
        <td style="padding:6px 10px;text-align:right">${r.staleQuotes}</td>
        <td style="padding:6px 10px;text-align:right">${r.idleOrders}</td>
        <td style="padding:6px 10px;text-align:right">${r.missingJobCards}</td>
        <td style="padding:6px 10px;text-align:right">${r.missingOrderNumbers}</td>
      </tr>`,
        )
        .join("")}
      </tbody>
    </table>

    <h3 style="margin:20px 0 6px;color:#111827;font-size:13px">Accounts receivable aging</h3>
    <table style="width:100%;border-collapse:collapse;font-size:12px;background:#fff;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
      <thead style="background:#f3f4f6"><tr>
        <th style="padding:8px 10px;text-align:left">Bucket</th>
        <th style="padding:8px 10px;text-align:right">Amount</th>
      </tr></thead>
      <tbody>
        <tr><td style="padding:6px 10px">Current (not due)</td><td style="padding:6px 10px;text-align:right">${fmtMoney(arBuckets.current)}</td></tr>
        <tr><td style="padding:6px 10px">1 – 30 days</td><td style="padding:6px 10px;text-align:right">${fmtMoney(arBuckets.d1to30)}</td></tr>
        <tr><td style="padding:6px 10px">31 – 60 days</td><td style="padding:6px 10px;text-align:right">${fmtMoney(arBuckets.d31to60)}</td></tr>
        <tr><td style="padding:6px 10px">61 – 90 days</td><td style="padding:6px 10px;text-align:right">${fmtMoney(arBuckets.d61to90)}</td></tr>
        <tr><td style="padding:6px 10px;color:#dc2626;font-weight:600">Over 90 days</td><td style="padding:6px 10px;text-align:right;color:#dc2626;font-weight:600">${fmtMoney(arBuckets.d90plus)}</td></tr>
      </tbody>
    </table>

    <h3 style="margin:20px 0 6px;color:#111827;font-size:13px">Unassigned pool</h3>
    <p style="margin:0;color:#374151;font-size:12px">
      <strong>${unassignedCount}</strong> client${unassignedCount === 1 ? "" : "s"} currently have no portfolio owner. New clients auto-assign to the lightest junior on creation.
    </p>

    <p style="margin-top:24px;color:#9ca3af;font-size:11px;text-align:center">
      Sent weekly by SQR15 Portfolio automation.
    </p>
  </div>`;

  // Send to all seniors
  const seniors = await db.user.findMany({
    where: { role: { in: ["SENIOR_ADMIN", "MANAGER", "ADMIN"] } },
    select: { id: true, email: true, firstName: true, role: true },
  });

  let sent = 0;
  for (const s of seniors) {
    if (!s.email) continue;
    await sendEmail({
      to: s.email,
      subject: `Weekly portfolio health — ${rows.length} juniors, ${fmtMoney(arBuckets.d1to30 + arBuckets.d31to60 + arBuckets.d61to90 + arBuckets.d90plus)} overdue AR`,
      html,
    }).catch((e) => console.error("[portfolio-digest] weekly email failed:", e));
    await createNotification({
      recipientId: s.id,
      recipientRole: s.role,
      type: "SYSTEM_ALERT",
      message: `Weekly portfolio health: ${unassignedCount} client${unassignedCount === 1 ? "" : "s"} unassigned; ${rows.reduce((a, r) => a + r.overdueCount, 0)} overdue invoices across all juniors.`,
    }).catch(() => {});
    sent++;
  }
  return sent;
}

// ═══════════════════════════════════════════════════════════════════════════
// Scheduler bootstrap — checks every hour, runs daily/weekly at SAST windows.
// ═══════════════════════════════════════════════════════════════════════════

let _portfolioSchedulerStarted = false;

export function bootstrapPortfolioDigest(): void {
  // Guard: without this every incoming HTTP request would register a
  // fresh setInterval — after a few hours of traffic the digest fires
  // hundreds of times each Monday morning.
  if (_portfolioSchedulerStarted) return;
  _portfolioSchedulerStarted = true;

  const CHECK_HOURS = 1;
  const intervalMs = CHECK_HOURS * 60 * 60 * 1000;

  let lastOwnerWeeklyKey = "";
  let lastSeniorWeeklyKey = "";

  const check = async () => {
    try {
      const now = new Date();
      const sast = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const hour = sast.getUTCHours();
      const day = sast.getUTCDay(); // 0 Sun … 6 Sat
      const weekKey = `${sast.getUTCFullYear()}-W${Math.floor(
        (sast.getTime() - new Date(Date.UTC(sast.getUTCFullYear(), 0, 1)).getTime()) / (1000 * 60 * 60 * 24 * 7),
      )}`;

      // Weekly per-owner digest: Monday 06:00-08:00 SAST
      if (day === 1 && hour >= 6 && hour < 8 && lastOwnerWeeklyKey !== weekKey) {
        // Belt-and-braces DB dedup: survives PM2 restarts during the window.
        const claimKey = `digest_owner_weekly_${weekKey}`;
        const claimed = await claimWeeklyLock(claimKey);
        if (claimed) {
          const sent = await sendDailyPortfolioDigest();
          console.log(`[portfolio-digest] weekly per-owner sent to ${sent} owners`);
        } else {
          console.log(`[portfolio-digest] weekly per-owner already claimed by another worker for ${weekKey}`);
        }
        lastOwnerWeeklyKey = weekKey;
      }

      // Weekly senior digest: Monday 07:00-09:00 SAST
      if (day === 1 && hour >= 7 && hour < 9 && lastSeniorWeeklyKey !== weekKey) {
        const claimKey = `digest_senior_weekly_${weekKey}`;
        const claimed = await claimWeeklyLock(claimKey);
        if (claimed) {
          const sent = await sendWeeklySeniorDigest();
          console.log(`[portfolio-digest] weekly senior sent to ${sent} seniors`);
        } else {
          console.log(`[portfolio-digest] weekly senior already claimed by another worker for ${weekKey}`);
        }
        lastSeniorWeeklyKey = weekKey;
      }
    } catch (err) {
      console.error("[portfolio-digest] tick failed:", err);
    }
  };

  setTimeout(check, 90 * 1000);
  setInterval(check, intervalMs);
  console.log("[portfolio-digest] scheduler started (hourly checks; weekly per-owner Mon 06-08 SAST, weekly senior Mon 07-09 SAST)");
}

// Atomic claim via SystemSettings upsert. Returns true if THIS caller
// successfully created the row; false if it already existed.
async function claimWeeklyLock(key: string): Promise<boolean> {
  try {
    const existing = await db.systemSettings.findUnique({ where: { key } });
    if (existing) return false;
    await db.systemSettings.create({ data: { key, value: new Date().toISOString() } });
    return true;
  } catch (err) {
    // If two workers race here, the unique key on `key` will reject the
    // second insert — the winner still sends, the loser silently skips.
    return false;
  }
}
