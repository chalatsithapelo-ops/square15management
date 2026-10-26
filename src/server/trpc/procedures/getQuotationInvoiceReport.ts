import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

/**
 * Unified Quotations + Invoices report.
 *
 * Replaces the "July Report Broll"-style spreadsheet the team was maintaining
 * by hand. One row per document (quote or invoice) with computed statuses
 * derived from the linked Order:
 *
 *  - jobStatus:      "JOB_DONE" | "NOT_DONE" | "IN_PROGRESS"
 *  - orderStatus:    "HAS_ORDER" | "NO_ORDER" | "PENDING_FROM_CLIENT" | "NO_ORDER_REQUIRED"
 *  - jobCardStatus:  "SIGNED" | "AWAITING_CLIENT_SIGNATURE" | "NOT_SIGNED" | "NO_JOB_CARD"
 *  - invoiceStatus:  the invoice's own status (or "NO_INVOICE" for quotes not invoiced)
 *  - quotationStatus: the quotation's own status (or "NO_QUOTATION" for invoices without a source quote)
 */

const DocKind = z.enum(["QUOTATION", "INVOICE"]);

export const getQuotationInvoiceReport = baseProcedure
  .input(
    z.object({
      token: z.string(),
      fromDate: z.string().optional(), // ISO string
      toDate: z.string().optional(),
      clientId: z.number().optional(),
      clientBuildingId: z.number().optional(),
      // Which documents to include. Default: BOTH.
      include: z.array(DocKind).default(["QUOTATION", "INVOICE"]),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const isAdminTier = [
      "ADMIN",
      "SENIOR_ADMIN",
      "JUNIOR_ADMIN",
      "MANAGER",
      "TECHNICAL_MANAGER",
      "ACCOUNTANT",
    ].includes(user.role);

    if (!isAdminTier) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Admin access required for this report",
      });
    }

    const fromDate = input.fromDate ? new Date(input.fromDate) : undefined;
    const toDate = input.toDate ? new Date(input.toDate) : undefined;
    // Include the entire toDate day.
    if (toDate) toDate.setHours(23, 59, 59, 999);

    const dateFilter: any = {};
    if (fromDate) dateFilter.gte = fromDate;
    if (toDate) dateFilter.lte = toDate;
    const hasDateFilter = fromDate || toDate;

    const commonWhere: any = {};
    if (hasDateFilter) commonWhere.createdAt = dateFilter;
    if (input.clientId) commonWhere.clientId = input.clientId;
    if (input.clientBuildingId) commonWhere.clientBuildingId = input.clientBuildingId;

    // ─── Quotations ─────────────────────────────────────────────────
    const wantsQuotes = input.include.includes("QUOTATION");
    const quotations = wantsQuotes
      ? await db.quotation.findMany({
          where: commonWhere,
          include: {
            client: { select: { id: true, name: true, companyName: true } },
            clientBuilding: { select: { id: true, name: true, address: true } },
            assignedTo: { select: { id: true, firstName: true, lastName: true } },
            generatedOrder: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                endTime: true,
                startTime: true,
                signedJobCardUrl: true,
                clientRepName: true,
                clientRepSignDate: true,
                clientUnavailableToSign: true,
                signatureRequestToken: true,
                signatureRequestSentAt: true,
                clientOrderNumber: true,
                orderNumberStatus: true,
                selfInitiated: true,
              },
            },
            generatedInvoice: {
              select: {
                id: true,
                invoiceNumber: true,
                status: true,
                total: true,
                paidDate: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 2000,
        })
      : [];

    // ─── Invoices ───────────────────────────────────────────────────
    const wantsInvoices = input.include.includes("INVOICE");
    const invoices = wantsInvoices
      ? await db.invoice.findMany({
          where: commonWhere,
          include: {
            client: { select: { id: true, name: true, companyName: true } },
            clientBuilding: { select: { id: true, name: true, address: true } },
            createdBy: { select: { id: true, firstName: true, lastName: true } },
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                endTime: true,
                startTime: true,
                signedJobCardUrl: true,
                clientRepName: true,
                clientRepSignDate: true,
                clientUnavailableToSign: true,
                signatureRequestToken: true,
                signatureRequestSentAt: true,
                clientOrderNumber: true,
                orderNumberStatus: true,
                selfInitiated: true,
                assignedTo: { select: { firstName: true, lastName: true } },
              },
            },
            quotation: {
              select: {
                id: true,
                quoteNumber: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 2000,
        })
      : [];

    // ─── Row shaping helpers ────────────────────────────────────────
    type Row = {
      kind: "QUOTATION" | "INVOICE";
      id: number;
      number: string; // QUO-000 / INV-000
      createdAt: Date;
      description: string;
      buildingName: string | null;
      buildingAddress: string | null;
      customerEmail: string | null;
      customerName: string | null;
      clientName: string | null;
      artisanName: string | null;
      amount: number;
      jobStatus: "JOB_DONE" | "IN_PROGRESS" | "NOT_DONE";
      orderStatus:
        | "HAS_ORDER"
        | "NO_ORDER"
        | "PENDING_FROM_CLIENT"
        | "NO_ORDER_REQUIRED";
      jobCardStatus:
        | "SIGNED"
        | "AWAITING_CLIENT_SIGNATURE"
        | "NOT_SIGNED"
        | "NO_JOB_CARD";
      quotationStatus: string;
      invoiceStatus: string;
      orderNumber: string | null;
      clientOrderNumber: string | null;
    };

    function computeStatuses(order: any | null | undefined) {
      // Job status
      let jobStatus: Row["jobStatus"] = "NOT_DONE";
      if (order) {
        if (order.endTime) jobStatus = "JOB_DONE";
        else if (order.status === "IN_PROGRESS") jobStatus = "IN_PROGRESS";
      }

      // Order (client PO) status
      let orderStatus: Row["orderStatus"] = "NO_ORDER";
      if (order) {
        const ons = order.orderNumberStatus as string | null | undefined;
        if (ons === "HAS_NUMBER" || order.clientOrderNumber) {
          orderStatus = "HAS_ORDER";
        } else if (ons === "PENDING_FROM_CLIENT") {
          orderStatus = "PENDING_FROM_CLIENT";
        } else if (ons === "NO_ORDER_REQUIRED") {
          orderStatus = "NO_ORDER_REQUIRED";
        } else {
          orderStatus = "HAS_ORDER"; // Order exists → we consider it as ordered
        }
      }

      // Job card status
      let jobCardStatus: Row["jobCardStatus"] = "NO_JOB_CARD";
      if (order) {
        if (order.signedJobCardUrl) {
          jobCardStatus = "SIGNED";
        } else if (order.signatureRequestSentAt) {
          jobCardStatus = "AWAITING_CLIENT_SIGNATURE";
        } else if (order.endTime) {
          // Work is done but the job card hasn't been signed yet.
          jobCardStatus = "NOT_SIGNED";
        } else {
          jobCardStatus = "NO_JOB_CARD";
        }
      }

      return { jobStatus, orderStatus, jobCardStatus };
    }

    const rows: Row[] = [];

    for (const q of quotations) {
      const order = q.generatedOrder;
      const { jobStatus, orderStatus, jobCardStatus } = computeStatuses(order);
      rows.push({
        kind: "QUOTATION",
        id: q.id,
        number: q.quoteNumber,
        createdAt: q.createdAt,
        description: q.projectDescription || q.notes || "",
        buildingName: q.clientBuilding?.name ?? null,
        buildingAddress: q.clientBuilding?.address ?? q.address ?? null,
        customerEmail: q.customerEmail || null,
        customerName: q.customerName || null,
        clientName:
          q.client?.companyName ||
          q.client?.name ||
          q.customerName ||
          null,
        artisanName: q.assignedTo
          ? `${q.assignedTo.firstName} ${q.assignedTo.lastName}`.trim()
          : null,
        amount: q.total ?? 0,
        jobStatus,
        orderStatus,
        jobCardStatus,
        quotationStatus: q.status,
        invoiceStatus: q.generatedInvoice?.status ?? "NO_INVOICE",
        orderNumber: order?.orderNumber ?? null,
        clientOrderNumber: order?.clientOrderNumber ?? null,
      });
    }

    for (const inv of invoices) {
      // Skip invoices that came from a quotation we already emitted a row
      // for — no need to double-count in the same report.
      if (wantsQuotes && inv.quotationId) {
        continue;
      }
      const order = inv.order;
      const { jobStatus, orderStatus, jobCardStatus } = computeStatuses(order);
      rows.push({
        kind: "INVOICE",
        id: inv.id,
        number: inv.invoiceNumber,
        createdAt: inv.createdAt,
        description: inv.projectDescription || inv.notes || "",
        buildingName: inv.clientBuilding?.name ?? null,
        buildingAddress: inv.clientBuilding?.address ?? inv.address ?? null,
        customerEmail: inv.customerEmail || null,
        customerName: inv.customerName || null,
        clientName:
          inv.client?.companyName ||
          inv.client?.name ||
          inv.customerName ||
          null,
        artisanName:
          order?.assignedTo
            ? `${order.assignedTo.firstName} ${order.assignedTo.lastName}`.trim()
            : inv.createdBy
              ? `${inv.createdBy.firstName} ${inv.createdBy.lastName}`.trim()
              : null,
        amount: inv.total ?? 0,
        jobStatus,
        orderStatus,
        jobCardStatus,
        quotationStatus: inv.quotation?.status ?? "NO_QUOTATION",
        invoiceStatus: inv.status,
        orderNumber: order?.orderNumber ?? null,
        clientOrderNumber: order?.clientOrderNumber ?? null,
      });
    }

    rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // ─── Summary counters ───────────────────────────────────────────
    const summary = {
      totalRows: rows.length,
      totalAmount: rows.reduce((s, r) => s + (r.amount || 0), 0),
      jobsDone: rows.filter((r) => r.jobStatus === "JOB_DONE").length,
      jobsNotDone: rows.filter((r) => r.jobStatus === "NOT_DONE").length,
      jobsInProgress: rows.filter((r) => r.jobStatus === "IN_PROGRESS").length,
      withOrder: rows.filter((r) => r.orderStatus === "HAS_ORDER").length,
      withoutOrder: rows.filter((r) => r.orderStatus === "NO_ORDER").length,
      jobCardsSigned: rows.filter((r) => r.jobCardStatus === "SIGNED").length,
      jobCardsAwaiting: rows.filter((r) => r.jobCardStatus === "AWAITING_CLIENT_SIGNATURE").length,
      jobCardsNotSigned: rows.filter((r) => r.jobCardStatus === "NOT_SIGNED").length,
      jobCardsNone: rows.filter((r) => r.jobCardStatus === "NO_JOB_CARD").length,
      quotationCount: rows.filter((r) => r.kind === "QUOTATION").length,
      invoiceCount: rows.filter((r) => r.kind === "INVOICE").length,
    };

    return { rows, summary };
  });
