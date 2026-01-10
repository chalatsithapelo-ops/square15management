import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const getDashboardConfig = baseProcedure
  .input(
    z.object({
      token: z.string(),
    })
  )
  .query(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);

      const user = await db.user.findUnique({
        where: { id: parsed.userId },
      });

      if (!user || (user.role !== "SENIOR_ADMIN" && user.role !== "JUNIOR_ADMIN")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only administrators can access dashboard configurations",
        });
      }

      const configKey = `dashboard_config_${parsed.userId}`;
      const setting = await db.systemSettings.findUnique({
        where: { key: configKey },
      });

      if (!setting || !setting.value) {
        // Return default configuration
        return {
          widgets: [
            {
              id: "key-metrics",
              type: "key_metrics",
              position: { x: 0, y: 0, w: 12, h: 2 },
            },
            {
              id: "revenue-trend",
              type: "revenue_trend",
              position: { x: 0, y: 2, w: 6, h: 4 },
            },
            {
              id: "expense-breakdown",
              type: "expense_breakdown",
              position: { x: 6, y: 2, w: 6, h: 4 },
            },
          ],
          name: "Default Dashboard",
        };
      }

      return JSON.parse(setting.value);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
