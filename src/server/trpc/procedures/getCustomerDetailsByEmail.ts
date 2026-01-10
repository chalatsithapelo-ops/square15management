import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const getCustomerDetailsByEmail = baseProcedure
  .input(
    z.object({
      token: z.string(),
      customerEmail: z.string().email(),
    })
  )
  .query(async ({ input }) => {
    try {
      // Verify authentication
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);

      const user = await db.user.findUnique({
        where: { id: parsed.userId },
      });

      if (!user || !["SENIOR_ADMIN", "JUNIOR_ADMIN"].includes(user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only administrators can access customer details",
        });
      }

      // Fetch the most recent invoice for this customer email
      const invoice = await db.invoice.findFirst({
        where: {
          customerEmail: input.customerEmail,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          address: true,
        },
      });

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No customer found with this email address",
        });
      }

      return {
        customerName: invoice.customerName,
        customerEmail: invoice.customerEmail,
        customerPhone: invoice.customerPhone,
        address: invoice.address,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
