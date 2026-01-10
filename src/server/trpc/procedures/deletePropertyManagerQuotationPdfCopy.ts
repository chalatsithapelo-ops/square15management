import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const deletePropertyManagerQuotationPdfCopy = baseProcedure
  .input(
    z.object({
      token: z.string(),
      copyId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers can delete quotation PDF copies.",
      });
    }

    const delegate = (db as any)["propertyManagerQuotationPdfCopy"];
    const copy = await delegate.findUnique({
      where: { id: input.copyId },
      select: {
        id: true,
        propertyManagerId: true,
      },
    });

    if (!copy) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Saved copy not found.",
      });
    }

    if (copy.propertyManagerId !== user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You can only delete your own saved copies.",
      });
    }

    await delegate.delete({
      where: { id: input.copyId },
    });

    return { success: true };
  });
