import { db } from "~/server/db";
import { listWorkRequests } from "./client";

let pollerStarted = false;
let pollTimer: NodeJS.Timeout | null = null;

async function findErisClientId(): Promise<number | null> {
  const c = await db.client.findFirst({
    where: {
      OR: [
        { companyName: { contains: "Eris", mode: "insensitive" } },
        { name: { contains: "Eris", mode: "insensitive" } },
      ],
    },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  return c?.id ?? null;
}

async function resolveSiteMapping(externalSite: string | null, externalCode: string | null): Promise<{ buildingId: number | null; clientId: number | null }> {
  if (!externalSite && !externalCode) return { buildingId: null, clientId: null };
  const where: any = { source: "MYBUILDINGS" };
  if (externalSite) where.externalSite = externalSite;
  else where.externalCode = externalCode;
  let m = await db.clientWorkOrderSiteMapping.findFirst({ where });
  if (!m && externalCode) {
    m = await db.clientWorkOrderSiteMapping.findFirst({ where: { source: "MYBUILDINGS", externalCode } });
  }
  if (m) {
    // Track how often this mapping is hit — useful for reporting
    void db.clientWorkOrderSiteMapping.update({ where: { id: m.id }, data: { autoLinkedCount: { increment: 1 } } }).catch(() => {});
    return { buildingId: m.linkedBuildingId, clientId: m.linkedClientId };
  }
  return { buildingId: null, clientId: null };
}

function pickFirst(obj: any, ...keys: string[]) {
  for (const k of keys) {
    if (obj?.[k] !== undefined && obj?.[k] !== null) return obj[k];
  }
  return undefined;
}

/**
 * Upsert a work request from the myBuildings payload.
 * Handles both webhook payloads and list responses since the field names vary slightly.
 */
export async function upsertWorkRequestFromPayload(payload: any): Promise<{ id: number; created: boolean } | null> {
  const jobCode = String(pickFirst(payload, "JobCode", "jobCode", "PONumber", "poNumber") ?? "").trim();
  const externalId = Number(pickFirst(payload, "WorkRequestID", "WorkRequestId", "workRequestId", "ID", "Id") ?? 0) || null;
  if (!jobCode && !externalId) return null;

  const externalSiteRaw = pickFirst(payload, "SiteName", "siteName", "Site", "PropertyName", "BuildingName") ?? null;
  const externalCode = pickFirst(payload, "ThirdPartySystem_BuildingID", "BuildingCode", "SiteCode") ?? null;
  const mapping = await resolveSiteMapping(externalSiteRaw, externalCode);
  const clientId = mapping.clientId ?? await findErisClientId();

  const data = {
    externalJobCode: jobCode || null,
    externalId,
    externalStatusId: Number(pickFirst(payload, "StatusID", "statusId", "NewStatusID") ?? 0) || null,
    externalStatusName: pickFirst(payload, "StatusName", "statusName", "Status") ?? null,
    externalSite: pickFirst(payload, "SiteName", "siteName", "Site", "PropertyName", "BuildingName") ?? null,
    title: pickFirst(payload, "Title", "title", "Subject", "Summary", "Type", "SubType") ?? null,
    description: (() => {
      const t = pickFirst(payload, "Type");
      const st = pickFirst(payload, "SubType");
      const explicit = pickFirst(payload, "Description", "description", "Details");
      if (explicit) return explicit;
      return [t, st].filter(Boolean).join(" — ") || null;
    })(),
    priority: pickFirst(payload, "Priority", "priority") ?? null,
    requestedAt: (() => {
      const v = pickFirst(payload, "RequestedAt", "CreatedDate", "createdDate", "DateRequested", "WorkBeganDate", "LastModifiedDate");
      if (!v) return null;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    })(),
    requiredBy: (() => {
      const v = pickFirst(payload, "RequiredBy", "DueDate", "dueDate", "TargetDate", "ExpectedCompletionDate");
      if (!v) return null;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    })(),
    approvedAmount: Number(pickFirst(payload, "ApprovedAmount", "approvedAmount", "AuthorisedAmount", "ApprovedAuthorisedAmount") ?? 0) || null,
    rawPayload: payload,
    linkedClientId: clientId,
    linkedBuildingId: mapping.buildingId,
  };

  const existing = jobCode
    ? await db.clientWorkOrder.findFirst({ where: { source: "MYBUILDINGS", externalJobCode: jobCode } })
    : await db.clientWorkOrder.findFirst({ where: { source: "MYBUILDINGS", externalId } });

  if (existing) {
    const updated = await db.clientWorkOrder.update({
      where: { id: existing.id },
      data: {
        ...data,
        // Never overwrite our internal fields via poll/webhook
        ourStatus: existing.ourStatus,
        assignedToUserId: existing.assignedToUserId,
        internalNotes: existing.internalNotes,
        linkedInvoiceId: existing.linkedInvoiceId,
        linkedBuildingId: existing.linkedBuildingId ?? mapping.buildingId,
      },
    });
    return { id: updated.id, created: false };
  }
  const created = await db.clientWorkOrder.create({
    data: { source: "MYBUILDINGS", ...data },
  });
  return { id: created.id, created: true };
}

export async function pollOnce(): Promise<{ fetched: number; created: number; updated: number; error: string | null }> {
  const res = await listWorkRequests();
  if (!res.ok) return { fetched: 0, created: 0, updated: 0, error: res.error };
  const data = res.data as any;
  // Response shape unknown — try common patterns
  const items: any[] = Array.isArray(data) ? data
    : Array.isArray(data?.WorkRequests) ? data.WorkRequests
    : Array.isArray(data?.Data?.WorkRequests) ? data.Data.WorkRequests
    : Array.isArray(data?.Data?.Items) ? data.Data.Items
    : Array.isArray(data?.Data?.results) ? data.Data.results
    : Array.isArray(data?.Data) ? data.Data
    : Array.isArray(data?.Items) ? data.Items
    : Array.isArray(data?.results) ? data.results
    : [];
  let created = 0, updated = 0;
  for (const it of items) {
    const r = await upsertWorkRequestFromPayload(it);
    if (r?.created) created++; else if (r) updated++;
  }
  // After ingest, opportunistically push any invoices Eris is now waiting for
  try {
    const push = await autoPushInvoicesForAwaiting();
    if (push.pushed > 0 || push.failed > 0) {
      console.log(`[myBuildings] Auto-pushed invoices: ${push.pushed} ok, ${push.failed} failed`);
    }
  } catch (e: any) {
    console.error("[myBuildings] Auto-push cycle error:", e?.message ?? e);
  }
  return { fetched: items.length, created, updated, error: null };
}

export function startMyBuildingsPoller(intervalMs: number = 600_000) {
  if (pollerStarted) return;
  if (process.env.MYBUILDINGS_ENABLED === "0") {
    console.log("[myBuildings] Poller disabled (MYBUILDINGS_ENABLED=0)");
    return;
  }
  if (!process.env.MYBUILDINGS_API_TOKEN) {
    console.log("[myBuildings] MYBUILDINGS_API_TOKEN not set — poller not started");
    return;
  }
  pollerStarted = true;
  console.log(`[myBuildings] Poller starting (${intervalMs / 1000}s interval)`);
  // Run once at startup, then on interval
  pollOnce().then((r) => console.log(`[myBuildings] Startup poll: fetched=${r.fetched} new=${r.created} updated=${r.updated}${r.error ? " error=" + r.error : ""}`)).catch((e) => console.error("[myBuildings] Poll error:", e));
  pollTimer = setInterval(() => {
    pollOnce()
      .then((r) => {
        if (r.created > 0 || r.error) {
          console.log(`[myBuildings] Poll: fetched=${r.fetched} new=${r.created} updated=${r.updated}${r.error ? " error=" + r.error : ""}`);
        }
      })
      .catch((e) => console.error("[myBuildings] Poll error:", e));
  }, intervalMs);
}

export function stopMyBuildingsPoller() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  pollerStarted = false;
}

/**
 * Scan for work orders where Eris status is "Awaiting Invoice"/"Awaiting Invoice Approval"
 * AND we have a linkedInvoiceId AND we haven't pushed the invoice yet.
 * Auto-generate a public URL and push. Runs at the tail of each poll cycle.
 */
export async function autoPushInvoicesForAwaiting(): Promise<{ pushed: number; failed: number }> {
  const { uploadInvoice } = await import("./client");
  const candidates = await db.clientWorkOrder.findMany({
    where: {
      source: "MYBUILDINGS",
      linkedInvoiceId: { not: null },
      pushedInvoiceAt: null,
      externalStatusName: { in: ["Awaiting Upload of Invoice", "Awaiting Invoice"], mode: "insensitive" },
    },
    include: { linkedInvoice: true },
    take: 20,
  });
  let pushed = 0, failed = 0;
  const base = (process.env.BASE_URL || "https://square15management.co.za").replace(/\/+$/, "");
  for (const wo of candidates) {
    if (!wo.linkedInvoice) continue;
    try {
      // create/rotate a signed public URL that expires in 7 days
      const rec = await db.myBuildingsInvoicePublicToken.create({
        data: {
          invoiceId: wo.linkedInvoice.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        },
      });
      const url = `${base}/api/public/mybuildings-invoice/${rec.token}.pdf`;
      const inv = wo.linkedInvoice;
      // Match the actual Invoice Prisma fields. Never infer a VAT field that
      // does not exist; the invoice's persisted subtotal/tax are authoritative.
      const amountEx = Number(inv.subtotal ?? (Number(inv.total) - Number(inv.tax ?? 0)));
      const tax = Number(inv.tax ?? 0);
      const res = await uploadInvoice({
        workRequestId: wo.externalId,
        jobCode: wo.externalJobCode,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.createdAt.toISOString().slice(0, 10),
        amountExVat: amountEx,
        tax,
        invoiceAttachmentUrl: url,
        clientWorkOrderId: wo.id,
      });
      if (res.ok) {
        pushed++;
        await db.clientWorkOrder.update({
          where: { id: wo.id },
          data: { pushedInvoiceAt: new Date(), ourStatus: "INVOICED" },
        });
      } else {
        failed++;
        await db.clientWorkOrder.update({
          where: { id: wo.id },
          data: { lastPushError: res.error },
        });
      }
    } catch (e: any) {
      failed++;
      console.error("[myBuildings] auto-invoice-push error:", e?.message ?? e);
    }
  }
  return { pushed, failed };
}

