import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const getFinancialReports = baseProcedure
  .input(
    z.object({
      token: z.string(),
      reportType: z
        .enum([
          "MONTHLY_PL",
          "QUARTERLY_PL",
          "MONTHLY_BALANCE_SHEET",
          "QUARTERLY_BALANCE_SHEET",
          "ANNUAL_PL",
          "ANNUAL_BALANCE_SHEET",
          "MONTHLY_CFS",
          "QUARTERLY_CFS",
          "ANNUAL_CFS",
        ])
        .optional(),
      status: z.enum(["GENERATING", "COMPLETED", "FAILED"]).optional(),
    })
  )
  .query(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);

      const user = await db.user.findUnique({
        where: { id: parsed.userId },
      });

      if (!user || (user.role !== "SENIOR_ADMIN" && user.role !== "ADMIN")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only administrators can view financial reports",
        });
      }

      const where: any = {};

      if (input.reportType) {
        where.reportType = input.reportType;
      }

      if (input.status) {
        where.status = input.status;
      }

      const reports = await db.financialReport.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
      });

      return reports;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
