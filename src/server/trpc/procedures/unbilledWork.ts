// PR-2 — "Money on the Floor": unbilled work + missing-order-number tracking.
// Exposes a single rich query for the admin dashboard and an Excel export.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
import ExcelJS from "exceljs";
import { uploadBufferToMinio } from "~/server/utils/minioUpload";

// ----- shared helpers --------------------------------------------------------

type BlockerType = "NO_ORDER_NUMBER" | "AWAITING_QUOTATION" | "AWAITING_INVOICE" | "AWAITING_SIGNATURE" | "PENDING_ADMIN_REVIEW";

function classifyBlockers(order: any): { blockers: BlockerType[]; atRiskValue: number } {
  const blockers: BlockerType[] = [];

  // missing official order number
  if (order.orderNumberStatus === "PENDING_FROM_CLIENT" && !order.clientOrderNumber) {
    blockers.push("NO_ORDER_NUMBER");
  }

  // completed with no invoice
  if (order.status === "COMPLETED" && !order.invoice) {
    if (!order.quotationId) {
      blockers.push("AWAITING_QUOTATION");
    } else {
      blockers.push("AWAITING_INVOICE");
    }
  }

  // self-initiated and not yet reviewed
  if (order.selfInitiated && !order.adminReviewedAt) {
    blockers.push("PENDING_ADMIN_REVIEW");
  }

  // completed but no signed job card
  if (order.status === "COMPLETED" && !order.signedJobCardUrl && !order.clientUnavailableToSign) {
    blockers.push("AWAITING_SIGNATURE");
  }

  const labour = typeof order.labourCost === "number" ? order.labourCost : 0;
  const materials = typeof order.materialCost === "number" ? order.materialCost : 0;
  const total = typeof order.totalCost === "number" && order.totalCost > 0
    ? order.totalCost
    : labour + materials;

  return { blockers, atRiskValue: total };
}

const ROLES_THAT_CAN_VIEW: string[] = [
  "ADMIN", "JUNIOR_ADMIN", "SENIOR_ADMIN", "TECHNICAL_MANAGER", "MANAGER",
];

function ensureCanView(role: string) {
  if (!ROLES_THAT_CAN_VIEW.includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only admins/managers can view unbilled work" });
  }
}

// ----- main query: getUnbilledWork ------------------------------------------

export const getUnbilledWork = baseProcedure
  .input(
    z.object({
      token: z.string(),
      // filters
      search: z.string().optional(),
      clientIds: z.array(z.number()).optional(),
      buildingIds: z.array(z.number()).optional(),
      artisanIds: z.array(z.number()).optional(),
      serviceTypes: z.array(z.string()).optional(),
      blockers: z.array(z.string()).optional(),
      selfInitiatedOnly: z.boolean().optional(),
      minAmount: z.number().optional(),
      maxAmount: z.number().optional(),
      agingBucket: z.enum(["0-7", "8-14", "15-30", "30+"]).optional(),
      completedFrom: z.string().optional(), // ISO date
      completedTo: z.string().optional(),
      // sorting/paging
      sortBy: z.enum(["completedAt", "totalCost", "ageDays", "orderNumber", "buildingName"]).default("completedAt"),
      sortDir: z.enum(["asc", "desc"]).default("desc"),
      limit: z.number().int().min(1).max(500).default(200),
      offset: z.number().int().min(0).default(0),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureCanView(user.role);

    // Base WHERE: orders that are completed without invoice OR awaiting order number OR self-initiated unreviewed
    const where: any = {
      OR: [
        { AND: [{ status: "COMPLETED" }, { invoice: { is: null } }] },
        { orderNumberStatus: "PENDING_FROM_CLIENT" },
        { AND: [{ selfInitiated: true }, { adminReviewedAt: null }] },
      ],
    };

    if (input.completedFrom) {
      where.endTime = { ...(where.endTime || {}), gte: new Date(input.completedFrom) };
    }
    if (input.completedTo) {
      where.endTime = { ...(where.endTime || {}), lte: new Date(input.completedTo) };
    }
    if (input.serviceTypes && input.serviceTypes.length) {
      where.serviceType = { in: input.serviceTypes };
    }
    if (input.clientIds && input.clientIds.length) {
      where.clientId = { in: input.clientIds };
    }
    if (input.buildingIds && input.buildingIds.length) {
      where.clientBuildingId = { in: input.buildingIds };
    }
    if (input.artisanIds && input.artisanIds.length) {
      where.assignedToId = { in: input.artisanIds };
    }
    if (input.selfInitiatedOnly) {
      where.selfInitiated = true;
    }
    if (input.search) {
      const s = input.search;
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { orderNumber: { contains: s, mode: "insensitive" } },
            { clientOrderNumber: { contains: s, mode: "insensitive" } },
            { description: { contains: s, mode: "insensitive" } },
            { customerName: { contains: s, mode: "insensitive" } },
            { address: { contains: s, mode: "insensitive" } },
            { client: { name: { contains: s, mode: "insensitive" } } },
            { clientBuilding: { name: { contains: s, mode: "insensitive" } } },
            { assignedTo: {
                OR: [
                  { firstName: { contains: s, mode: "insensitive" } },
                  { lastName: { contains: s, mode: "insensitive" } },
                ]
            }},
          ],
        },
      ];
    }

    // Order by chosen field (with mapped name)
    const orderBy: any = (() => {
      const dir = input.sortDir;
      switch (input.sortBy) {
        case "totalCost": return { totalCost: dir };
        case "orderNumber": return { orderNumber: dir };
        case "buildingName": return { clientBuilding: { name: dir } };
        case "ageDays":
        case "completedAt":
        default: return { endTime: dir === "asc" ? "asc" : "desc" };
      }
    })();

    const rows = await db.order.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, companyName: true } },
        clientBuilding: { select: { id: true, name: true, address: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        initiatedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        invoice: { select: { id: true, invoiceNumber: true, status: true, total: true } },
        quotation: { select: { id: true } },
      },
      orderBy,
      take: input.limit,
      skip: input.offset,
    });

    const now = Date.now();
    const enriched = rows.map((o) => {
      const { blockers, atRiskValue } = classifyBlockers(o);
      const completedAt = (o as any).completedAt ?? o.endTime ?? null;
      const ageDays = completedAt
        ? Math.floor((now - new Date(completedAt).getTime()) / 86400000)
        : null;
      const bucket =
        ageDays === null ? "n/a"
        : ageDays <= 7 ? "0-7"
        : ageDays <= 14 ? "8-14"
        : ageDays <= 30 ? "15-30"
        : "30+";

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        clientOrderNumber: o.clientOrderNumber,
        orderNumberStatus: o.orderNumberStatus,
        noOrderReason: o.noOrderReason,
        status: o.status,
        selfInitiated: o.selfInitiated,
        adminReviewedAt: o.adminReviewedAt,
        client: o.client,
        building: o.clientBuilding,
        addressSnapshot: o.address,
        serviceType: o.serviceType,
        description: o.description,
        artisan: o.assignedTo,
        initiator: o.initiatedBy,
        startedAt: o.startTime,
        completedAt,
        ageDays,
        agingBucket: bucket,
        labourCost: o.labourCost,
        materialCost: o.materialCost,
        atRiskValue,
        invoice: o.invoice,
        quotationId: o.quotationId,
        blockers,
      };
    });

    // Post-filter by blocker + aging + amount
    let filtered = enriched;
    if (input.blockers && input.blockers.length) {
      filtered = filtered.filter((r) =>
        r.blockers.some((b) => input.blockers!.includes(b))
      );
    }
    if (input.agingBucket) {
      filtered = filtered.filter((r) => r.agingBucket === input.agingBucket);
    }
    if (typeof input.minAmount === "number") {
      filtered = filtered.filter((r) => r.atRiskValue >= input.minAmount!);
    }
    if (typeof input.maxAmount === "number") {
      filtered = filtered.filter((r) => r.atRiskValue <= input.maxAmount!);
    }

    // Aggregates over the filtered set
    const totalAtRisk = filtered.reduce((sum, r) => sum + (r.atRiskValue || 0), 0);
    const avgAge = filtered.length
      ? Math.round(filtered.filter((r) => r.ageDays !== null).reduce((s, r) => s + (r.ageDays || 0), 0) / filtered.length)
      : 0;
    const oldest = filtered.reduce((max, r) => (r.ageDays || 0) > max ? (r.ageDays || 0) : max, 0);

    // Top building by R
    const byBuilding = new Map<string, number>();
    for (const r of filtered) {
      const name = r.building?.name || r.addressSnapshot || "Unknown";
      byBuilding.set(name, (byBuilding.get(name) || 0) + (r.atRiskValue || 0));
    }
    let worstBuilding: { name: string; value: number } | null = null;
    for (const [name, value] of byBuilding) {
      if (!worstBuilding || value > worstBuilding.value) worstBuilding = { name, value };
    }

    return {
      rows: filtered,
      count: filtered.length,
      aggregates: {
        totalAtRisk,
        averageAgeDays: avgAge,
        oldestAgeDays: oldest,
        worstBuilding,
      },
    };
  });

// ----- excel export ---------------------------------------------------------

export const exportUnbilledWorkExcel = baseProcedure
  .input(
    z.object({
      token: z.string(),
      // same filter shape as getUnbilledWork (we accept everything optional)
      search: z.string().optional(),
      clientIds: z.array(z.number()).optional(),
      buildingIds: z.array(z.number()).optional(),
      artisanIds: z.array(z.number()).optional(),
      serviceTypes: z.array(z.string()).optional(),
      blockers: z.array(z.string()).optional(),
      selfInitiatedOnly: z.boolean().optional(),
      minAmount: z.number().optional(),
      maxAmount: z.number().optional(),
      agingBucket: z.enum(["0-7", "8-14", "15-30", "30+"]).optional(),
      completedFrom: z.string().optional(),
      completedTo: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureCanView(user.role);

    // Reuse query logic — full result (cap big)
    const { rows, aggregates } = await getUnbilledWorkCaller({ ...input, sortBy: "completedAt", sortDir: "desc", limit: 5000, offset: 0 });

    const wb = new ExcelJS.Workbook();
    wb.creator = "Square 15 Facility Solutions";
    wb.created = new Date();

    // Summary sheet
    const summary = wb.addWorksheet("Summary");
    summary.addRow(["Money on the Floor — Unbilled / Blocked Work"]);
    summary.addRow([`Generated by: ${user.firstName} ${user.lastName} (${user.email})`]);
    summary.addRow([`Generated at: ${new Date().toISOString()}`]);
    summary.addRow([]);
    summary.addRow(["Total at risk (R)", aggregates.totalAtRisk.toFixed(2)]);
    summary.addRow(["Number of jobs", rows.length]);
    summary.addRow(["Average age (days)", aggregates.averageAgeDays]);
    summary.addRow(["Oldest job (days)", aggregates.oldestAgeDays]);
    summary.addRow(["Worst building", aggregates.worstBuilding?.name ?? "—"]);
    summary.addRow(["Worst building value (R)", aggregates.worstBuilding?.value.toFixed(2) ?? "—"]);
    summary.getRow(1).font = { bold: true, size: 16 };

    // Detail sheet
    const detail = wb.addWorksheet("Unbilled Work");
    detail.columns = [
      { header: "Order #",            key: "orderNumber",        width: 14 },
      { header: "Client PO #",        key: "clientOrderNumber",  width: 14 },
      { header: "Order Number Status",key: "orderNumberStatus",  width: 18 },
      { header: "Status",             key: "status",             width: 14 },
      { header: "Self-initiated?",    key: "selfInitiated",      width: 14 },
      { header: "Client",             key: "clientName",         width: 24 },
      { header: "Building",           key: "buildingName",       width: 24 },
      { header: "Address",            key: "address",            width: 30 },
      { header: "Service",            key: "serviceType",        width: 16 },
      { header: "Description",        key: "description",        width: 40 },
      { header: "Artisan",            key: "artisan",            width: 20 },
      { header: "Initiator",          key: "initiator",          width: 20 },
      { header: "Started",            key: "startedAt",          width: 18 },
      { header: "Completed",          key: "completedAt",        width: 18 },
      { header: "Age (days)",         key: "ageDays",            width: 10 },
      { header: "Aging bucket",       key: "agingBucket",        width: 12 },
      { header: "Labour (R)",         key: "labourCost",         width: 12 },
      { header: "Materials (R)",      key: "materialCost",       width: 14 },
      { header: "At risk (R)",        key: "atRiskValue",        width: 14 },
      { header: "Invoice #",          key: "invoiceNumber",      width: 14 },
      { header: "Blockers",           key: "blockers",           width: 40 },
    ];

    for (const r of rows) {
      detail.addRow({
        orderNumber: r.orderNumber,
        clientOrderNumber: r.clientOrderNumber ?? "",
        orderNumberStatus: r.orderNumberStatus,
        status: r.status,
        selfInitiated: r.selfInitiated ? "Yes" : "No",
        clientName: r.client?.name ?? "",
        buildingName: r.building?.name ?? "",
        address: r.building?.address ?? r.addressSnapshot ?? "",
        serviceType: r.serviceType,
        description: r.description,
        artisan: r.artisan ? `${r.artisan.firstName} ${r.artisan.lastName}` : "",
        initiator: r.initiator ? `${r.initiator.firstName} ${r.initiator.lastName}` : "",
        startedAt: r.startedAt ? new Date(r.startedAt as any).toISOString() : "",
        completedAt: r.completedAt ? new Date(r.completedAt as any).toISOString() : "",
        ageDays: r.ageDays,
        agingBucket: r.agingBucket,
        labourCost: r.labourCost,
        materialCost: r.materialCost,
        atRiskValue: r.atRiskValue,
        invoiceNumber: r.invoice?.invoiceNumber ?? "",
        blockers: r.blockers.join(", "),
      });
    }
    detail.getRow(1).font = { bold: true };

    const buffer = await wb.xlsx.writeBuffer();
    const fileName = `unbilled-work-${new Date().toISOString().slice(0, 10)}.xlsx`;
    const url = await uploadBufferToMinio(
      Buffer.from(buffer),
      `reports/${fileName}`,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    return { url, fileName };
  });

// Internal caller to reuse the query handler inside the export mutation.
async function getUnbilledWorkCaller(input: any) {
  const user = await authenticateUser(input.token);
  ensureCanView(user.role);
  // Replicate by calling getUnbilledWork — but we cannot call a procedure
  // directly without a caller; we just run the same logic inline by querying.
  // For correctness, build the same where/transform as above:
  const where: any = {
    OR: [
      { AND: [{ status: "COMPLETED" }, { invoice: { is: null } }] },
      { orderNumberStatus: "PENDING_FROM_CLIENT" },
      { AND: [{ selfInitiated: true }, { adminReviewedAt: null }] },
    ],
  };
  if (input.completedFrom) where.endTime = { ...(where.endTime || {}), gte: new Date(input.completedFrom) };
  if (input.completedTo)   where.endTime = { ...(where.endTime || {}), lte: new Date(input.completedTo) };
  if (input.serviceTypes?.length) where.serviceType = { in: input.serviceTypes };
  if (input.clientIds?.length) where.clientId = { in: input.clientIds };
  if (input.buildingIds?.length) where.clientBuildingId = { in: input.buildingIds };
  if (input.artisanIds?.length) where.assignedToId = { in: input.artisanIds };
  if (input.selfInitiatedOnly) where.selfInitiated = true;

  const rows = await db.order.findMany({
    where,
    include: {
      client: { select: { id: true, name: true, companyName: true } },
      clientBuilding: { select: { id: true, name: true, address: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      initiatedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      invoice: { select: { id: true, invoiceNumber: true, status: true, total: true } },
      quotation: { select: { id: true } },
    },
    orderBy: { endTime: "desc" },
    take: input.limit ?? 5000,
  });

  const now = Date.now();
  const enriched = rows.map((o: any) => {
    const { blockers, atRiskValue } = classifyBlockers(o);
    const completedAt = o.completedAt ?? o.endTime ?? null;
    const ageDays = completedAt ? Math.floor((now - new Date(completedAt).getTime()) / 86400000) : null;
    const bucket = ageDays === null ? "n/a" : ageDays <= 7 ? "0-7" : ageDays <= 14 ? "8-14" : ageDays <= 30 ? "15-30" : "30+";
    return {
      id: o.id, orderNumber: o.orderNumber, clientOrderNumber: o.clientOrderNumber,
      orderNumberStatus: o.orderNumberStatus, noOrderReason: o.noOrderReason, status: o.status,
      selfInitiated: o.selfInitiated, adminReviewedAt: o.adminReviewedAt,
      client: o.client, building: o.clientBuilding, addressSnapshot: o.address,
      serviceType: o.serviceType, description: o.description,
      artisan: o.assignedTo, initiator: o.initiatedBy,
      startedAt: o.startTime, completedAt,
      ageDays, agingBucket: bucket,
      labourCost: o.labourCost, materialCost: o.materialCost, atRiskValue,
      invoice: o.invoice, quotationId: o.quotationId, blockers,
    };
  });

  let filtered = enriched;
  if (input.blockers?.length) filtered = filtered.filter((r) => r.blockers.some((b) => input.blockers.includes(b)));
  if (input.agingBucket) filtered = filtered.filter((r) => r.agingBucket === input.agingBucket);
  if (typeof input.minAmount === "number") filtered = filtered.filter((r) => r.atRiskValue >= input.minAmount);
  if (typeof input.maxAmount === "number") filtered = filtered.filter((r) => r.atRiskValue <= input.maxAmount);

  const totalAtRisk = filtered.reduce((s, r) => s + (r.atRiskValue || 0), 0);
  const avgAge = filtered.length ? Math.round(filtered.reduce((s, r) => s + (r.ageDays || 0), 0) / filtered.length) : 0;
  const oldest = filtered.reduce((m, r) => (r.ageDays || 0) > m ? (r.ageDays || 0) : m, 0);

  const byBuilding = new Map<string, number>();
  for (const r of filtered) {
    const name = r.building?.name || r.addressSnapshot || "Unknown";
    byBuilding.set(name, (byBuilding.get(name) || 0) + (r.atRiskValue || 0));
  }
  let worstBuilding: { name: string; value: number } | null = null;
  for (const [name, value] of byBuilding) {
    if (!worstBuilding || value > worstBuilding.value) worstBuilding = { name, value };
  }

  return {
    rows: filtered,
    aggregates: { totalAtRisk, averageAgeDays: avgAge, oldestAgeDays: oldest, worstBuilding },
  };
}

// ----- weekly digest --------------------------------------------------------

export const sendUnbilledWorkDigest = baseProcedure
  .input(z.object({ token: z.string() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!isAdmin(user)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can send the digest" });
    }
    const { sendUnbilledWorkDigestNow } = await import("~/server/services/unbilledDigest");
    return sendUnbilledWorkDigestNow();
  });
