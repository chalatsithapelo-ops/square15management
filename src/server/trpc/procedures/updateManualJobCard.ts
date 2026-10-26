import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

/**
 * Update an existing manually-generated job card (Order) linked to a
 * Quotation. Mirrors the input shape of `generateJobCardForQuotation` so the
 * same modal can drive both flows. Also replaces the order's Material rows
 * with whatever is submitted (delete + createMany) so the traceability
 * ledger stays in sync with what the admin last confirmed on screen.
 *
 * We intentionally keep this OUT of `generateJobCardForQuotation` because
 * the create-path enforces "one job card per quotation" and re-uses the
 * quotation's serviceType / description snapshot. Editing is a distinct
 * operation on an existing Order.
 */
export const updateManualJobCard = baseProcedure
  .input(
    z.object({
      token: z.string(),
      orderId: z.number(),
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
      clientOrderNumber: z.string().optional(),
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

    const ADMIN_ROLES = ["JUNIOR_ADMIN", "SENIOR_ADMIN", "TECHNICAL_MANAGER", "MANAGER", "ADMIN"];
    const isAdmin = ADMIN_ROLES.includes(user.role);

    const existingOrder = await db.order.findUnique({
      where: { id: input.orderId },
      include: {
        quotation: { select: { quoteNumber: true, createdAt: true } },
        crew: { where: { userId: user.id, leftAt: null }, select: { id: true, role: true } },
      },
    });

    if (!existingOrder) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
    }

    const isAssignedArtisan = user.role === "ARTISAN" && existingOrder.assignedToId === user.id;
    const isOnCrew = user.role === "ARTISAN" && existingOrder.crew.length > 0;
    if (!isAdmin && !isAssignedArtisan && !isOnCrew) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to update this job card. Only admins and artisans who worked on the job (as LEAD or CREW) may edit it.",
      });
    }

    // Warn on note when a signed card is being edited so the audit trail is honest.
    const wasSigned = !!(existingOrder as any).clientSignatureUrl || !!(existingOrder as any).artisanSignatureUrl;
    const editorLabel = `${user.firstName ?? ""} ${user.lastName ?? ""} (${user.role})`.trim();
    const auditPrefix = wasSigned
      ? `[Edit ${new Date().toISOString().slice(0,16)} by ${editorLabel} â€” job card was already SIGNED at time of edit]
`
      : `[Edit ${new Date().toISOString().slice(0,16)} by ${editorLabel}]
`;

    const completionDate = input.completionDate ? new Date(input.completionDate) : existingOrder.endTime ?? new Date();

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
      startDate = input.startDate
        ? new Date(input.startDate)
        : existingOrder.startTime ?? existingOrder.quotation?.createdAt ?? existingOrder.createdAt;
      endDate = completionDate;
    }

    // Preserve the original "manually generated" tag if it was already in the
    // notes; otherwise stamp a fresh one so audit trail is retained.
    const priorNotes = existingOrder.notes || "";
    const retroTagMatch = priorNotes.match(/\[Manually generated retroactively[^\]]*\]/);
    const retroTag =
      retroTagMatch?.[0] ||
      `[Manually generated retroactively on ${new Date().toISOString().slice(0, 10)} by ${user.firstName ?? ""} ${user.lastName ?? ""}]`.trim();

    const combinedNotes = [
      retroTag,
      sessionsBlock,
      input.notes || "",
      existingOrder.quotation?.quoteNumber
        ? `Job card generated from quotation ${existingOrder.quotation.quoteNumber}`
        : "",
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

    await db.order.update({
      where: { id: existingOrder.id },
      data: {
        startTime: startDate,
        endTime: endDate,
        clientRepName: input.clientRepName || null,
        clientRepSignDate: input.clientRepName ? completionDate : null,
        clientUnavailableToSign: !input.clientRepName,
        notes: combinedNotes,
        clientOrderNumber: input.clientOrderNumber?.trim() || null,
        beforePictures: input.beforePictures ?? [],
        afterPictures: input.afterPictures ?? [],
        ...(materialsTotal > 0 ? { materialCost: materialsTotal } : {}),
      },
    });

    // Replace the traceability ledger wholesale so removed / edited rows
    // disappear from the PDF. The order is COMPLETED and manual, so there
    // are no downstream side-effects from swapping the material list.
    await db.material.deleteMany({ where: { orderId: existingOrder.id } });
    if (materialInputs.length > 0) {
      await db.material.createMany({
        data: materialInputs.map((m) => ({
          orderId: existingOrder.id,
          name: m.name,
          description: m.description || null,
          quantity: m.quantity,
          unitPrice: m.unitPrice,
          totalCost: m.quantity * m.unitPrice,
          supplier: m.supplier || null,
        })),
      });
    }

    return {
      orderId: existingOrder.id,
      orderNumber: existingOrder.orderNumber,
      message: `Job card ${existingOrder.orderNumber} updated.`,
    };
  });
