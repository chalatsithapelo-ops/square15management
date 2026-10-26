import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import {
  listWorkRequests,
  updateWorkRequestStatus,
  uploadInvoice,
  uploadAttachment,
  testConnection,
} from "~/server/services/myBuildings/client";
import { pollOnce } from "~/server/services/myBuildings/poller";

function assertAdmin(user: { role: string }) {
  const ok = ["SENIOR_ADMIN", "TECHNICAL_MANAGER", "JUNIOR_ADMIN", "STAFF"].includes(user.role);
  if (!ok) throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
}

export const listClientWorkOrders = baseProcedure
  .input(
    z.object({
      token: z.string(),
      status: z.string().optional(),
      source: z.string().optional(),
      assignedToMe: z.boolean().default(false),
      take: z.number().default(100),
    }),
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertAdmin(user);
    const where: any = {};
    if (input.status) where.ourStatus = input.status;
    if (input.source) where.source = input.source;
    if (input.assignedToMe) where.assignedToUserId = user.id;
    return db.clientWorkOrder.findMany({
      where,
      include: {
        assignedToUser: { select: { id: true, firstName: true, lastName: true } },
        linkedInvoice: { select: { id: true, invoiceNumber: true, total: true, status: true } },
        linkedClient:  { select: { id: true, name: true, companyName: true } },
        linkedOrders: { select: { id: true, orderNumber: true, status: true, clientId: true, clientBuildingId: true } },
        syncLogs: { orderBy: { createdAt: "desc" }, take: 3 },
      },
      orderBy: [{ createdAt: "desc" }],
      take: input.take,
    });
  });

export const getClientWorkOrder = baseProcedure
  .input(z.object({ token: z.string(), id: z.number() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertAdmin(user);
    const wo = await db.clientWorkOrder.findUnique({
      where: { id: input.id },
      include: {
        assignedToUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        linkedInvoice: true,
        linkedClient:  { select: { id: true, name: true, companyName: true } },
        linkedOrders: { select: { id: true, orderNumber: true, status: true, clientId: true, clientBuildingId: true } },
        syncLogs: { orderBy: { createdAt: "desc" }, take: 30 },
      },
    });
    if (!wo) throw new TRPCError({ code: "NOT_FOUND" });
    return wo;
  });

export const updateClientWorkOrderLocal = baseProcedure
  .input(z.object({
    token: z.string(),
    id: z.number(),
    ourStatus: z.string().optional(),
    internalNotes: z.string().optional(),
    assignedToUserId: z.number().nullable().optional(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertAdmin(user);
    const data: any = {};
    if (input.ourStatus !== undefined) data.ourStatus = input.ourStatus;
    if (input.internalNotes !== undefined) data.internalNotes = input.internalNotes;
    if (input.assignedToUserId !== undefined) data.assignedToUserId = input.assignedToUserId;
    return db.clientWorkOrder.update({ where: { id: input.id }, data });
  });

export const pushClientWorkOrderStatus = baseProcedure
  .input(z.object({
    token: z.string(),
    id: z.number(),
    newStatusId: z.number(),
    comment: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertAdmin(user);
    const wo = await db.clientWorkOrder.findUnique({ where: { id: input.id } });
    if (!wo) throw new TRPCError({ code: "NOT_FOUND" });
    const res = await updateWorkRequestStatus({
      workRequestId: wo.externalId,
      jobCode: wo.externalJobCode,
      newStatusId: input.newStatusId,
      comment: input.comment,
      clientWorkOrderId: wo.id,
    });
    await db.clientWorkOrder.update({
      where: { id: wo.id },
      data: {
        lastPushAt: new Date(),
        lastPushError: res.error,
        pushedStatusId: res.ok ? input.newStatusId : wo.pushedStatusId,
      },
    });
    if (!res.ok) throw new TRPCError({ code: "BAD_REQUEST", message: res.error ?? "Push failed" });
    return { success: true };
  });

export const linkOrderToClientWorkOrder = baseProcedure
  .input(z.object({ token: z.string(), id: z.number(), orderId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertAdmin(user);
    const [workOrder, order] = await Promise.all([
      db.clientWorkOrder.findUnique({ where: { id: input.id } }),
      db.order.findUnique({ where: { id: input.orderId }, select: { id: true, orderNumber: true, clientId: true, clientBuildingId: true, clientWorkOrderId: true } }),
    ]);
    if (!workOrder) throw new TRPCError({ code: "NOT_FOUND", message: "Client work order not found" });
    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Square 15 order not found" });
    if (order.clientWorkOrderId && order.clientWorkOrderId !== workOrder.id) {
      throw new TRPCError({ code: "CONFLICT", message: `Order ${order.orderNumber} is already linked to another client work order` });
    }
    if (order.clientId && workOrder.linkedClientId && order.clientId !== workOrder.linkedClientId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Client IDs do not match; verify the client/building before linking" });
    }
    await db.order.update({ where: { id: order.id }, data: { clientWorkOrderId: workOrder.id } });
    await db.myBuildingsSyncLog.create({ data: {
      direction: "INTERNAL", operation: "LINK_ORDER", externalRef: workOrder.externalJobCode,
      clientWorkOrderId: workOrder.id, success: true,
      requestBody: { orderId: order.id, orderNumber: order.orderNumber, actorId: user.id } as any,
    } });
    return { success: true, orderNumber: order.orderNumber };
  });

export const linkInvoiceToClientWorkOrder = baseProcedure
  .input(z.object({ token: z.string(), id: z.number(), invoiceId: z.number().nullable() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertAdmin(user);
    return db.clientWorkOrder.update({
      where: { id: input.id },
      data: { linkedInvoiceId: input.invoiceId },
    });
  });

export const pushInvoiceToMyBuildings = baseProcedure
  .input(z.object({
    token: z.string(),
    id: z.number(),
    invoiceAttachmentUrl: z.string().url(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertAdmin(user);
    const wo = await db.clientWorkOrder.findUnique({
      where: { id: input.id },
      include: { linkedInvoice: true },
    });
    if (!wo) throw new TRPCError({ code: "NOT_FOUND" });
    if (!wo.linkedInvoice) throw new TRPCError({ code: "BAD_REQUEST", message: "Link an invoice first" });
    if (!/^awaiting (upload of )?invoice$/i.test((wo.externalStatusName ?? "").trim())) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Eris work order is '${wo.externalStatusName ?? "unknown"}'. Upload is enabled only while Eris is awaiting the contractor's invoice.` });
    }
    const inv = wo.linkedInvoice;
    const amountEx = Number(inv.subtotal ?? (Number(inv.total) - Number(inv.vatAmount ?? 0)));
    const tax = Number(inv.vatAmount ?? 0);
    const res = await uploadInvoice({
      workRequestId: wo.externalId,
      jobCode: wo.externalJobCode,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: (inv.issueDate ?? inv.createdAt).toISOString().slice(0, 10),
      amountExVat: amountEx,
      tax,
      invoiceAttachmentUrl: input.invoiceAttachmentUrl,
      clientWorkOrderId: wo.id,
    });
    await db.clientWorkOrder.update({
      where: { id: wo.id },
      data: {
        pushedInvoiceAt: res.ok ? new Date() : null,
        lastPushError: res.error,
        ourStatus: res.ok ? "INVOICED" : wo.ourStatus,
      },
    });
    if (!res.ok) throw new TRPCError({ code: "BAD_REQUEST", message: res.error ?? "Invoice upload failed" });
    return { success: true };
  });

export const pushAttachmentToMyBuildings = baseProcedure
  .input(z.object({
    token: z.string(),
    id: z.number(),
    attachmentName: z.string(),
    attachmentUrl: z.string().url(),
    attachmentExtension: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertAdmin(user);
    const wo = await db.clientWorkOrder.findUnique({ where: { id: input.id } });
    if (!wo) throw new TRPCError({ code: "NOT_FOUND" });
    const res = await uploadAttachment({
      workRequestId: wo.externalId,
      jobCode: wo.externalJobCode,
      attachmentName: input.attachmentName,
      attachmentUrl: input.attachmentUrl,
      attachmentExtension: input.attachmentExtension,
      clientWorkOrderId: wo.id,
    });
    if (res.ok) {
      await db.clientWorkOrder.update({
        where: { id: wo.id },
        data: { pushedAttachmentAt: new Date() },
      });
    }
    if (!res.ok) throw new TRPCError({ code: "BAD_REQUEST", message: res.error ?? "Attachment upload failed" });
    return { success: true };
  });

export const generatePublicInvoiceUrl = baseProcedure
  .input(z.object({ token: z.string(), invoiceId: z.number(), expiresInHours: z.number().default(168) }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertAdmin(user);
    const expiresAt = new Date(Date.now() + input.expiresInHours * 3600 * 1000);
    const rec = await db.myBuildingsInvoicePublicToken.create({
      data: { invoiceId: input.invoiceId, expiresAt },
    });
    const base = process.env.BASE_URL || process.env.APP_URL || "https://square15management.co.za";
    return { url: `${base.replace(/\/+$/, "")}/api/public/mybuildings-invoice/${rec.token}.pdf`, expiresAt };
  });

export const testMyBuildingsConnection = baseProcedure
  .input(z.object({ token: z.string() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertAdmin(user);
    return testConnection();
  });

export const syncMyBuildingsNow = baseProcedure
  .input(z.object({ token: z.string() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertAdmin(user);
    return pollOnce();
  });

export const listMyBuildingsSyncLog = baseProcedure
  .input(z.object({ token: z.string(), take: z.number().default(50), clientWorkOrderId: z.number().optional() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertAdmin(user);
    return db.myBuildingsSyncLog.findMany({
      where: input.clientWorkOrderId ? { clientWorkOrderId: input.clientWorkOrderId } : {},
      orderBy: { createdAt: "desc" },
      take: input.take,
    });
  });

export const getMyBuildingsIntegrationStatus = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertAdmin(user);
    const totalOrders = await db.clientWorkOrder.count({ where: { source: "MYBUILDINGS" } });
    const openOrders = await db.clientWorkOrder.count({ where: { source: "MYBUILDINGS", ourStatus: { in: ["NEW", "IN_PROGRESS", "ON_HOLD"] } } });
    const lastPoll = await db.myBuildingsSyncLog.findFirst({
      where: { operation: "LIST_WORK_REQUESTS" },
      orderBy: { createdAt: "desc" },
    });
    const lastWebhook = await db.myBuildingsSyncLog.findFirst({
      where: { operation: "WEBHOOK_RECEIVED" },
      orderBy: { createdAt: "desc" },
    });
    return {
      tokenConfigured: !!process.env.MYBUILDINGS_API_TOKEN,
      baseUrl: process.env.MYBUILDINGS_BASE_URL,
      webhookUrl: `${(process.env.BASE_URL || "https://square15management.co.za").replace(/\/+$/, "")}/api/webhooks/mybuildings/`,
      pollInterval: parseInt(process.env.MYBUILDINGS_POLL_INTERVAL_MS || "600000", 10),
      totalOrders,
      openOrders,
      lastPollAt: lastPoll?.createdAt ?? null,
      lastPollSuccess: lastPoll?.success ?? null,
      lastPollError: lastPoll?.errorMessage ?? null,
      lastWebhookAt: lastWebhook?.createdAt ?? null,
    };
  });

// ─── Site → Building mappings ───
import { z as _z_dup } from "zod"; // no-op — z already imported above

export const listSiteMappings = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertAdmin(user);
    return db.clientWorkOrderSiteMapping.findMany({
      include: {
        linkedBuilding: { select: { id: true, name: true, address: true } },
        linkedClient:   { select: { id: true, name: true, companyName: true } },
      },
      orderBy: [{ externalSite: "asc" }],
    });
  });

export const upsertSiteMapping = baseProcedure
  .input(z.object({
    token: z.string(),
    externalSite: z.string().min(1),
    externalCode: z.string().optional(),
    linkedBuildingId: z.number().nullable().optional(),
    linkedClientId: z.number().nullable().optional(),
    notes: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertAdmin(user);
    const record = await db.clientWorkOrderSiteMapping.upsert({
      where: { source_externalSite: { source: "MYBUILDINGS", externalSite: input.externalSite } },
      create: {
        source: "MYBUILDINGS",
        externalSite: input.externalSite,
        externalCode: input.externalCode,
        linkedBuildingId: input.linkedBuildingId ?? null,
        linkedClientId: input.linkedClientId ?? null,
        notes: input.notes,
      },
      update: {
        externalCode: input.externalCode,
        linkedBuildingId: input.linkedBuildingId ?? null,
        linkedClientId: input.linkedClientId ?? null,
        notes: input.notes,
      },
    });
    // Backfill existing work orders that match this site but weren't linked
    if (record.linkedBuildingId || record.linkedClientId) {
      await db.clientWorkOrder.updateMany({
        where: { source: "MYBUILDINGS", externalSite: input.externalSite, linkedBuildingId: null },
        data: {
          linkedBuildingId: record.linkedBuildingId,
          linkedClientId:   record.linkedClientId ?? undefined,
        },
      });
    }
    return record;
  });

export const deleteSiteMapping = baseProcedure
  .input(z.object({ token: z.string(), id: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertAdmin(user);
    await db.clientWorkOrderSiteMapping.delete({ where: { id: input.id } });
    return { success: true };
  });

export const listUnmappedSites = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertAdmin(user);
    const rows = await db.$queryRaw<Array<{ externalSite: string; count: bigint }>>`
      SELECT "externalSite", count(*)::bigint as count
      FROM "ClientWorkOrder" cwo
      WHERE cwo.source = 'MYBUILDINGS'
        AND cwo."externalSite" IS NOT NULL
        AND cwo."linkedBuildingId" IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM "ClientWorkOrderSiteMapping" m
          WHERE m.source = 'MYBUILDINGS' AND m."externalSite" = cwo."externalSite"
        )
      GROUP BY "externalSite"
      ORDER BY count DESC
    `;
    return rows.map((r) => ({ externalSite: r.externalSite, count: Number(r.count) }));
  });

// ─── Cashflow contribution ───
export const getMyBuildingsCashflowForecast = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertAdmin(user);
    const inProgress = await db.clientWorkOrder.findMany({
      where: {
        source: "MYBUILDINGS",
        ourStatus: { notIn: ["INVOICED", "CLOSED"] },
      },
      include: { linkedInvoice: true },
    });
    const invoiced = await db.clientWorkOrder.findMany({
      where: {
        source: "MYBUILDINGS",
        ourStatus: "INVOICED",
      },
      include: { linkedInvoice: true },
    });
    const sumApproved = inProgress.reduce((s, w) => s + (w.approvedAmount ?? 0), 0);
    const sumUninvoiced = inProgress.reduce((s, w) => s + (w.linkedInvoice ? Number(w.linkedInvoice.total) : 0), 0);
    const sumAwaitingPayment = invoiced.reduce((s, w) => s + (w.linkedInvoice ? Number(w.linkedInvoice.total) : 0), 0);
    return {
      openWorkOrders: inProgress.length,
      openApprovedTotal: sumApproved,
      openLinkedInvoicesTotal: sumUninvoiced,
      awaitingPaymentTotal: sumAwaitingPayment,
      awaitingPaymentCount: invoiced.length,
    };
  });
