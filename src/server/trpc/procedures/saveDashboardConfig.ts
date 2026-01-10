import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

const widgetSchema = z.object({
  id: z.string(),
  type: z.enum([
    "revenue_trend",
    "expense_breakdown",
    "profit_margin",
    "key_metrics",
    "recent_invoices",
    "recent_orders",
    "top_artisans",
    "top_clients",
  ]),
  position: z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
  }),
  config: z.record(z.any()).optional(),
});

export const saveDashboardConfig = baseProcedure
  .input(
    z.object({
      token: z.string(),
      widgets: z.array(widgetSchema),
      name: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);

      const user = await db.user.findUnique({
        where: { id: parsed.userId },
      });

      if (!user || (user.role !== "SENIOR_ADMIN" && user.role !== "JUNIOR_ADMIN")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only administrators can save dashboard configurations",
        });
      }

      const configKey = `dashboard_config_${parsed.userId}`;
      const configValue = JSON.stringify({
        widgets: input.widgets,
        name: input.name || "My Dashboard",
        updatedAt: new Date().toISOString(),
      });

      await db.systemSettings.upsert({
        where: { key: configKey },
        update: { value: configValue },
        create: { key: configKey, value: configValue },
      });

      return { success: true };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
