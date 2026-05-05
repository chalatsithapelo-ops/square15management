import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const QUOTATION_STATUSES = [
  "DRAFT",
  "PENDING_ARTISAN_REVIEW",
  "IN_PROGRESS",
  "PENDING_JUNIOR_MANAGER_REVIEW",
  "PENDING_SENIOR_MANAGER_REVIEW",
  "APPROVED",
  "SENT_TO_CUSTOMER",
  "REJECTED",
  "APPROVED_BY_CUSTOMER",
  "REJECTED_BY_CUSTOMER",
] as const;

const ALLOWED_ROLES = [
  "JUNIOR_ADMIN",
  "SENIOR_ADMIN",
  "TECHNICAL_MANAGER",
  "MANAGER",
  "CONTRACTOR",
  "CONTRACTOR_SENIOR_MANAGER",
];

export const bulkUpdateQuotationStatus = baseProcedure
  .input(
    z.object({
      token: z.string(),
      quotationIds: z.array(z.number()).min(1).max(200),
      status: z.enum(QUOTATION_STATUSES),
      rejectionReason: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!ALLOWED_ROLES.includes(user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to bulk-update quotations.",
      });
    }

    const updateData: any = { status: input.status };
    if (input.status === "REJECTED" || input.status === "REJECTED_BY_CUSTOMER") {
      updateData.rejectionReason = input.rejectionReason || "Bulk rejection";
    }

    const result = await db.quotation.updateMany({
      where: { id: { in: input.quotationIds } },
      data: updateData,
    });

    return { updated: result.count };
  });

export const bulkDeleteQuotations = baseProcedure
  .input(
    z.object({
      token: z.string(),
      quotationIds: z.array(z.number()).min(1).max(200),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!["SENIOR_ADMIN", "MANAGER", "CONTRACTOR_SENIOR_MANAGER"].includes(user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only senior roles can bulk-delete quotations.",
      });
    }

    // Block deletion of quotations already converted to orders or invoices
    const blocked = await db.quotation.findMany({
      where: {
        id: { in: input.quotationIds },
        OR: [{ generatedOrder: { isNot: null } }, { generatedInvoice: { isNot: null } }],
      },
      select: { id: true, quoteNumber: true },
    });
    if (blocked.length > 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Cannot delete quotations already converted: ${blocked.map((q) => q.quoteNumber).join(", ")}`,
      });
    }

    const result = await db.quotation.deleteMany({
      where: { id: { in: input.quotationIds } },
    });
    return { deleted: result.count };
  });
