import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const ALLOWED_ROLES = [
  "JUNIOR_ADMIN",
  "SENIOR_ADMIN",
  "TECHNICAL_MANAGER",
  "MANAGER",
  "CONTRACTOR",
  "CONTRACTOR_SENIOR_MANAGER",
  "CONTRACTOR_JUNIOR_MANAGER",
];

/**
 * Returns CRM pipeline data grouped by stage:
 *   leads → quotations → approved quotations → in-progress orders →
 *   completed orders awaiting invoice → invoices unpaid → invoices paid
 *
 * Lightweight projection — only fields needed for kanban cards.
 */
export const getPipeline = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!ALLOWED_ROLES.includes(user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to view the pipeline.",
      });
    }

    const cardSelect = {
      id: true,
      createdAt: true,
      updatedAt: true,
      status: true,
    } as const;

    const [leads, quotationsRaw, ordersRaw, invoicesRaw] = await Promise.all([
      db.lead.findMany({
        where: { status: { in: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION"] } },
        select: {
          ...cardSelect,
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          serviceType: true,
          estimatedValue: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 200,
      }),
      db.quotation.findMany({
        select: {
          ...cardSelect,
          quoteNumber: true,
          customerName: true,
          customerEmail: true,
          total: true,
          assignedToId: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 300,
      }),
      db.order.findMany({
        select: {
          ...cardSelect,
          orderNumber: true,
          customerName: true,
          totalCost: true,
          assignedToId: true,
          slaDueAt: true,
          slaHours: true,
          slaStartedAt: true,
          invoice: { select: { id: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 300,
      }),
      db.invoice.findMany({
        select: {
          ...cardSelect,
          invoiceNumber: true,
          customerName: true,
          total: true,
          dueDate: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 300,
      }),
    ]);

    // Bucket quotations
    const quoteApproved = quotationsRaw.filter((q) =>
      ["APPROVED", "SENT_TO_CUSTOMER", "APPROVED_BY_CUSTOMER"].includes(q.status as string)
    );
    const quoteOpen = quotationsRaw.filter((q) =>
      ["DRAFT", "PENDING_ARTISAN_REVIEW", "IN_PROGRESS", "PENDING_JUNIOR_MANAGER_REVIEW", "PENDING_SENIOR_MANAGER_REVIEW"].includes(
        q.status as string
      )
    );

    // Bucket orders
    const orderInProgress = ordersRaw.filter((o) =>
      ["PENDING", "ASSIGNED", "IN_PROGRESS"].includes(o.status as string)
    );
    const orderCompletedNoInvoice = ordersRaw.filter(
      (o) => o.status === "COMPLETED" && !o.invoice
    );

    // Bucket invoices
    const invoiceUnpaid = invoicesRaw.filter((i) =>
      ["DRAFT", "SENT", "OVERDUE", "PARTIALLY_PAID"].includes(i.status as string)
    );
    const invoicePaid = invoicesRaw.filter((i) => i.status === "PAID");

    return {
      leads,
      quotationsOpen: quoteOpen,
      quotationsApproved: quoteApproved,
      ordersInProgress: orderInProgress,
      ordersCompletedNoInvoice: orderCompletedNoInvoice,
      invoicesUnpaid: invoiceUnpaid,
      invoicesPaid: invoicePaid,
      generatedAt: new Date(),
    };
  });
