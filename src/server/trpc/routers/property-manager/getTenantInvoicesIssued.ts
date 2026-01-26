import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const getTenantInvoicesIssued = baseProcedure
  .input(
    z.object({
      token: z.string(),
      status: z.enum(["ALL", "PAID", "OVERDUE", "OUTSTANDING", "DISPUTED"]).optional().default("ALL"),
      fromDueDate: z.string().datetime().optional(),
      toDueDate: z.string().datetime().optional(),
      tenantId: z.number().int().positive().optional(),
      limit: z.number().int().positive().max(500).optional().default(200),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    const propertyManagerId = user.id;

    const now = new Date();

    const requestedStatus = input.status ?? "ALL";

    // Resolve tenant(s) so we can also match PM-created invoices by email.
    const pmTenants = input.tenantId
      ? await db.propertyManagerCustomer.findMany({
          where: { id: input.tenantId, propertyManagerId },
          select: { id: true, email: true },
        })
      : await db.propertyManagerCustomer.findMany({
          where: { propertyManagerId },
          select: { id: true, email: true },
        });

    const tenantEmailList = pmTenants.map((t) => t.email);
    const tenantIdList = pmTenants.map((t) => t.id);

    const rentWhere: any = {
      propertyManagerId,
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      ...(input.fromDueDate || input.toDueDate
        ? {
            dueDate: {
              ...(input.fromDueDate ? { gte: new Date(input.fromDueDate) } : {}),
              ...(input.toDueDate ? { lte: new Date(input.toDueDate) } : {}),
            },
          }
        : {}),
    };

    // Status filtering:
    // - OVERDUE: explicit OVERDUE, OR dueDate passed and not PAID
    // - OUTSTANDING: not PAID (PENDING/PARTIAL/OVERDUE)
    // - PAID: PAID
    if (requestedStatus === "PAID") {
      rentWhere.status = "PAID";
    } else if (requestedStatus === "OVERDUE") {
      rentWhere.OR = [{ status: "OVERDUE" }, { status: { in: ["PENDING", "PARTIAL"] }, dueDate: { lt: now } }];
    } else if (requestedStatus === "OUTSTANDING") {
      rentWhere.status = { in: ["PENDING", "PARTIAL", "OVERDUE"] };
    } else if (requestedStatus === "DISPUTED") {
      // For disputed, we need to compute disputes across all rent statuses for the filter window.
    }

    const rentInvoices: any[] = await db.rentPayment.findMany({
      where: rentWhere,
      include: {
        tenant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            buildingName: true,
            unitNumber: true,
          },
        },
      },
      orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
      take: input.limit,
    });

    // PM-created billing invoices live in the shared Invoice table; match them to tenants by customerEmail.
    const invoiceWhere: any = {
      createdById: propertyManagerId,
      ...(tenantEmailList.length ? { customerEmail: { in: tenantEmailList } } : { id: -1 }),
      ...(input.fromDueDate || input.toDueDate
        ? {
            dueDate: {
              ...(input.fromDueDate ? { gte: new Date(input.fromDueDate) } : {}),
              ...(input.toDueDate ? { lte: new Date(input.toDueDate) } : {}),
            },
          }
        : {}),
    };

    if (requestedStatus === "PAID") {
      invoiceWhere.status = "PAID";
    } else if (requestedStatus === "OVERDUE") {
      invoiceWhere.OR = [
        { status: "OVERDUE" },
        { status: { in: ["SENT", "PENDING_REVIEW", "PENDING_APPROVAL"] }, dueDate: { lt: now } },
      ];
    } else if (requestedStatus === "OUTSTANDING") {
      invoiceWhere.status = { in: ["SENT", "PENDING_REVIEW", "PENDING_APPROVAL", "OVERDUE"] };
    } else if (requestedStatus === "DISPUTED") {
      invoiceWhere.OR = [{ isDisputed: true }, { status: "REJECTED" }];
    }

    const pmInvoices: any[] = await (db.invoice as any).findMany({
      where: invoiceWhere,
      select: {
        id: true,
        invoiceNumber: true,
        customerName: true,
        customerEmail: true,
        total: true,
        subtotal: true,
        tax: true,
        status: true,
        isDisputed: true,
        dueDate: true,
        paidDate: true,
        notes: true,
        createdAt: true,
      },
      orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
      take: input.limit,
    });

    // Map emails -> tenant summary for display.
    const tenantByEmail = new Map(
      (
        await db.propertyManagerCustomer.findMany({
          where: {
            propertyManagerId,
            ...(tenantEmailList.length ? { email: { in: tenantEmailList } } : {}),
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            buildingName: true,
            unitNumber: true,
          },
        })
      ).map((t) => [t.email, t])
    );

    // Compute disputed rent invoices based on rejected rent payments for the same tenant and month.
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    const rentDueDates = rentInvoices.map((p) => p.dueDate);
    const rangeStart = input.fromDueDate
      ? new Date(input.fromDueDate)
      : rentDueDates.length
        ? new Date(Math.min(...rentDueDates.map((d) => d.getTime())))
        : null;
    const rangeEnd = input.toDueDate
      ? new Date(input.toDueDate)
      : rentDueDates.length
        ? new Date(Math.max(...rentDueDates.map((d) => d.getTime())))
        : null;

    const rejectedRentPayments = tenantIdList.length
      ? await db.customerPayment.findMany({
          where: {
            propertyManagerId,
            paymentType: "RENT",
            status: "REJECTED",
            tenantId: { in: tenantIdList },
            ...(rangeStart && rangeEnd
              ? {
                  paymentDate: {
                    gte: rangeStart,
                    lte: rangeEnd,
                  },
                }
              : {}),
          },
          select: {
            tenantId: true,
            paymentMonth: true,
            paymentDate: true,
          },
        })
      : [];

    const disputedRentKeySet = new Set(
      rejectedRentPayments
        .filter((p) => !!p.tenantId)
        .map((p) => {
          const m = p.paymentMonth ?? p.paymentDate;
          return `${p.tenantId}:${monthKey(m)}`;
        })
    );

    return {
      success: true,
      invoices: [
        ...rentInvoices.map((p) => {
          const computedOverdue = p.status !== "PAID" && p.dueDate < now;
          const computedDisputed = disputedRentKeySet.has(`${p.tenantId}:${monthKey(p.dueDate)}`);
          const persistedIsDisputed = Boolean((p as any)["isDisputed"]);
          const isDisputed = persistedIsDisputed || computedDisputed;
          const effectiveStatus = isDisputed ? "DISPUTED" : computedOverdue ? "OVERDUE" : p.status;
          const outstanding = Math.max(0, (p.amount ?? 0) + (p.lateFee ?? 0) - (p.amountPaid ?? 0));

          return {
            source: 'RENT' as const,
            id: p.id,
            refNumber: p.paymentNumber,
            tenantId: p.tenantId,
            tenant: p.tenant,
            dueDate: p.dueDate,
            paidDate: p.paidDate,
            amount: p.amount,
            amountPaid: p.amountPaid,
            lateFee: p.lateFee,
            status: effectiveStatus,
            rawStatus: p.status,
            outstanding,
            paymentMethod: p.paymentMethod,
            transactionReference: p.transactionReference,
            notes: p.notes,
            createdAt: p.createdAt,
          };
        }),
        ...pmInvoices.map((inv) => {
          const computedOverdue = inv.status !== 'PAID' && !!inv.dueDate && inv.dueDate < now;
          const persistedIsDisputed = Boolean((inv as any)["isDisputed"]);
          const isDisputed = persistedIsDisputed || inv.status === 'REJECTED';
          const effectiveStatus = isDisputed ? 'DISPUTED' : computedOverdue ? 'OVERDUE' : inv.status;
          const tenant = tenantByEmail.get(inv.customerEmail) ?? null;

          return {
            source: 'INVOICE' as const,
            id: inv.id,
            refNumber: inv.invoiceNumber,
            tenantId: tenant?.id ?? null,
            tenant,
            dueDate: inv.dueDate,
            paidDate: inv.paidDate,
            amount: inv.total,
            amountPaid: inv.status === 'PAID' ? inv.total : 0,
            lateFee: 0,
            status: effectiveStatus,
            rawStatus: inv.status,
            outstanding: inv.status === 'PAID' ? 0 : inv.total,
            paymentMethod: null,
            transactionReference: null,
            notes: inv.notes,
            createdAt: inv.createdAt,
            customerName: inv.customerName,
            customerEmail: inv.customerEmail,
            subtotal: inv.subtotal,
            tax: inv.tax,
            total: inv.total,
          };
        }),
      ].filter((inv) => {
        if (requestedStatus === "DISPUTED") return inv.status === "DISPUTED";
        if (requestedStatus === "ALL") return true;
        // For other filters, do not include disputed invoices.
        return inv.status !== "DISPUTED";
      }),
    };
  });
