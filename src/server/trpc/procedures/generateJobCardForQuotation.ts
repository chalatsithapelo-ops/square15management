import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { getCompanyDetails } from "~/server/utils/company-details";
import { getNextOrderNumber } from "~/server/utils/documentNumbers";

/**
 * Retroactively create a COMPLETED Order (job card) for a Quotation whose
 * work was done off-system. Used when admins need to produce a job card PDF
 * for a quotation that never went through the normal "convert to order" flow.
 */
export const generateJobCardForQuotation = baseProcedure
  .input(
    z.object({
      token: z.string(),
      quotationId: z.number(),
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
      // Client purchase-order reference — surfaces on the job card PDF trace
      // header as "Client PO No" so the admin can cross-reference our order
      // number against the client's PO on the same page.
      clientOrderNumber: z.string().optional(),
      // Retroactive traceability — allow the admin to attach the on-site
      // record for this job card so the PDF renders the full evidence trail
      // even though the work happened off-system.
      beforePictures: z.array(z.string()).optional(),
      afterPictures: z.array(z.string()).optional(),
      materials: z
        .array(
          z.object({
            name: z.string().min(1),
            description: z.string().optional(),
            quantity: z.number().nonnegative(),
            unitPrice: z.number().nonnegative(),
            supplier: z.string().optional(),
          })
        )
        .optional(),
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

    const quotation = await db.quotation.findUnique({
      where: { id: input.quotationId },
      include: { lead: true },
    });

    if (!quotation) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Quotation not found" });
    }

    const existingOrder = await db.order.findUnique({
      where: { quotationId: quotation.id },
    });
    if (existingOrder) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `A job card already exists for this quotation (order ${existingOrder.orderNumber}).`,
      });
    }

    const companyDetails = await getCompanyDetails();
    const orderPrefix = companyDetails?.orderPrefix || "ORD";
    const orderNumber = await getNextOrderNumber(db, orderPrefix);

    const serviceType = quotation.lead?.serviceType || quotation.projectDescription || "Retroactive Job Card";
    const completionDate = input.completionDate ? new Date(input.completionDate) : new Date();

    // Normalise & validate work sessions (each entry represents one day the crew
    // was on site). Order.startTime / endTime are single DateTime columns so we
    // record the earliest start + latest end there and preserve the full
    // per-day breakdown in the notes so it survives on the job-card PDF.
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
      startDate = input.startDate ? new Date(input.startDate) : quotation.createdAt;
      endDate = completionDate;
    }

    const retroTag = `[Manually generated retroactively on ${new Date().toISOString().slice(0, 10)} by ${user.firstName ?? ""} ${user.lastName ?? ""}]`.trim();
    const combinedNotes = [
      retroTag,
      sessionsBlock,
      input.notes || "",
      `Job card generated from quotation ${quotation.quoteNumber}`,
    ]
      .filter(Boolean)
      .join("\n");

    const materialInputs = (input.materials ?? []).filter(
      (m) => m.name && Number.isFinite(m.quantity) && Number.isFinite(m.unitPrice)
    );
    const materialsTotal = materialInputs.reduce(
      (sum, m) => sum + m.quantity * m.unitPrice,
      0
    );

    const order = await db.order.create({
      data: {
        orderNumber,
        customerName: quotation.customerName,
        customerEmail: quotation.customerEmail,
        customerPhone: quotation.customerPhone,
        address: quotation.address,
        serviceType,
        description: quotation.projectDescription || `Job from quotation ${quotation.quoteNumber}`,
        status: "COMPLETED",
        assignedToId: quotation.assignedToId ?? null,
        leadId: quotation.leadId,
        quotationId: quotation.id,
        clientId: quotation.clientId,
        clientBuildingId: quotation.clientBuildingId,
        materialCost: materialsTotal > 0 ? materialsTotal : quotation.companyMaterialCost,
        labourCost: quotation.companyLabourCost,
        totalCost: quotation.total,
        startTime: startDate,
        endTime: endDate,
        clientRepName: input.clientRepName || null,
        clientRepSignDate: input.clientRepName ? completionDate : null,
        clientUnavailableToSign: !input.clientRepName,
        notes: combinedNotes,
        clientOrderNumber: input.clientOrderNumber?.trim() || null,
        beforePictures: input.beforePictures ?? [],
        afterPictures: input.afterPictures ?? [],
      },
    });

    if (materialInputs.length > 0) {
      await db.material.createMany({
        data: materialInputs.map((m) => ({
          orderId: order.id,
          name: m.name,
          description: m.description || null,
          quantity: m.quantity,
          unitPrice: m.unitPrice,
          totalCost: m.quantity * m.unitPrice,
          supplier: m.supplier || null,
        })),
      });
    }

    // If an invoice already exists for this quotation and has no order, link it now.
    const invoice = await db.invoice.findUnique({ where: { quotationId: quotation.id } });
    if (invoice && !invoice.orderId) {
      await db.invoice.update({
        where: { id: invoice.id },
        data: { orderId: order.id },
      });
    }

    return {
      order,
      message: `Job card ${order.orderNumber} generated for quotation ${quotation.quoteNumber}.`,
    };
  });
