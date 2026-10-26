import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { getCompanyDetails } from "~/server/utils/company-details";
import { getNextOrderNumber } from "~/server/utils/documentNumbers";

/**
 * Retroactively create a COMPLETED Order (job card) for an Invoice whose
 * work was done off-system. Used when admins need to produce a job card PDF
 * for an invoice that was raised without a matching order.
 *
 * If the invoice was created from a quotation, the order will also be linked
 * back to that quotation so the whole chain (quotation → order → invoice)
 * becomes consistent.
 */
export const generateJobCardForInvoice = baseProcedure
  .input(
    z.object({
      token: z.string(),
      invoiceId: z.number(),
      completionDate: z.string().optional(),
      startDate: z.string().optional(),
      workSessions: z
        .array(
          z.object({
            startAt: z.string(),
            endAt: z.string(),
          })
        )
        .optional(),
      clientRepName: z.string().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (!["JUNIOR_ADMIN", "SENIOR_ADMIN", "TECHNICAL_MANAGER", "MANAGER", "ADMIN"].includes(user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to generate job cards.",
      });
    }

    const invoice = await db.invoice.findUnique({
      where: { id: input.invoiceId },
      include: {
        quotation: { include: { lead: true } },
      },
    });

    if (!invoice) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
    }

    if (invoice.orderId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This invoice is already linked to a job card.",
      });
    }

    // If invoice has a quotation, make sure that quotation doesn't already have a different order.
    if (invoice.quotationId) {
      const quotationOrder = await db.order.findUnique({
        where: { quotationId: invoice.quotationId },
      });
      if (quotationOrder) {
        // Just link the invoice to the existing order and return.
        await db.invoice.update({
          where: { id: invoice.id },
          data: { orderId: quotationOrder.id },
        });
        return {
          order: quotationOrder,
          message: `Invoice linked to existing job card ${quotationOrder.orderNumber}.`,
        };
      }
    }

    const companyDetails = await getCompanyDetails();
    const orderPrefix = companyDetails?.orderPrefix || "ORD";
    const orderNumber = await getNextOrderNumber(db, orderPrefix);

    const quotation = invoice.quotation;
    const serviceType =
      quotation?.lead?.serviceType ||
      quotation?.projectDescription ||
      invoice.projectDescription ||
      "Retroactive Job Card";

    const completionDate = input.completionDate ? new Date(input.completionDate) : new Date();

    // Normalise & validate work sessions (each entry = one day the crew was on
    // site). Order.startTime / endTime are single DateTime columns so we record
    // the earliest start + latest end there and preserve the full per-day
    // breakdown in notes so it survives on the job-card PDF.
    const parsedSessions = (input.workSessions ?? [])
      .map((s) => ({ startAt: new Date(s.startAt), endAt: new Date(s.endAt) }))
      .filter(
        (s) =>
          !Number.isNaN(s.startAt.getTime()) &&
          !Number.isNaN(s.endAt.getTime()) &&
          s.endAt.getTime() >= s.startAt.getTime()
      )
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

    let startDate: Date;
    let endDate: Date;
    let sessionsBlock = "";
    if (parsedSessions.length > 0) {
      startDate = parsedSessions[0].startAt;
      endDate = parsedSessions.reduce(
        (max, s) => (s.endAt.getTime() > max.getTime() ? s.endAt : max),
        parsedSessions[0].endAt
      );
      const fmt = (d: Date) =>
        d.toLocaleString("en-ZA", {
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
      sessionsBlock =
        "Work sessions:\n" +
        parsedSessions.map((s, i) => `  ${i + 1}. ${fmt(s.startAt)} \u2192 ${fmt(s.endAt)}`).join("\n");
    } else {
      startDate = input.startDate ? new Date(input.startDate) : invoice.createdAt;
      endDate = completionDate;
    }

    const retroTag = `[Manually generated retroactively on ${new Date().toISOString().slice(0, 10)} by ${user.firstName ?? ""} ${user.lastName ?? ""}]`.trim();
    const combinedNotes = [
      retroTag,
      sessionsBlock,
      input.notes || "",
      `Job card generated from invoice ${invoice.invoiceNumber}${quotation ? ` (quotation ${quotation.quoteNumber})` : ""}`,
    ]
      .filter(Boolean)
      .join("\n");

    const order = await db.order.create({
      data: {
        orderNumber,
        customerName: invoice.customerName,
        customerEmail: invoice.customerEmail,
        customerPhone: invoice.customerPhone,
        address: invoice.address,
        serviceType,
        description:
          quotation?.projectDescription ||
          invoice.projectDescription ||
          `Job from invoice ${invoice.invoiceNumber}`,
        status: "COMPLETED",
        assignedToId: quotation?.assignedToId ?? null,
        leadId: quotation?.leadId ?? null,
        quotationId: invoice.quotationId ?? null,
        clientId: invoice.clientId,
        clientBuildingId: invoice.clientBuildingId,
        materialCost: invoice.companyMaterialCost,
        labourCost: invoice.companyLabourCost,
        totalCost: invoice.total,
        startTime: startDate,
        endTime: endDate,
        clientRepName: input.clientRepName || null,
        clientRepSignDate: input.clientRepName ? completionDate : null,
        clientUnavailableToSign: !input.clientRepName,
        notes: combinedNotes,
      },
    });

    await db.invoice.update({
      where: { id: invoice.id },
      data: { orderId: order.id },
    });

    return {
      order,
      message: `Job card ${order.orderNumber} generated for invoice ${invoice.invoiceNumber}.`,
    };
  });
