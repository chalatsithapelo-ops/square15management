// PR-8 E — Sales Agent parity helpers.
//
// Mirrors src/server/utils/tmAssignmentLog.ts for the sales-agent role.
//
// Resolution priority (matches the shape of resolveOrderTechnicalManagerId):
//   1. Order.salesAgentId (explicit — set by admin, agent, backfill)
//   2. ClientBuilding.defaultSalesAgentId (building-scoped default)
//   3. Client.defaultSalesAgentId (account-scoped default)
//   4. null → surface as "Unassigned Sales Agent" for admin triage.

import { TRPCError } from "@trpc/server";
import type { PrismaClient, Prisma } from "@prisma/client";
import { db } from "~/server/db";

export type SalesAgentAssignmentSource =
  | "EXPLICIT_INPUT"                // admin/agent typed a sales-agent id at create time
  | "BUILDING_DEFAULT_SALES_AGENT"  // resolved from ClientBuilding.defaultSalesAgentId
  | "CLIENT_DEFAULT_SALES_AGENT"    // resolved from Client.defaultSalesAgentId
  | "ADMIN_OVERRIDE"                // admin edited via order-detail knob
  | "BACKFILL"                      // PR-8 E historical backfill job
  | "UNRESOLVABLE_CLEANUP";         // admin manual triage

export type SalesAgentAssignmentLogInput = {
  orderId: number;
  fromSalesAgentId?: number | null;
  toSalesAgentId: number | null;
  source: SalesAgentAssignmentSource;
  actorId?: number | null;
  reason?: string | null;
};

type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Resolve a sales agent for an order from the reusable client/building defaults.
 * Callers pass the order's linkage ids; if none of them resolve to a stored
 * default, returns { salesAgentId: null, source: null }.
 */
export async function resolveSalesAgentFromDefaults(input: {
  clientBuildingId?: number | null;
  clientId?: number | null;
}): Promise<{ salesAgentId: number | null; source: SalesAgentAssignmentSource | null }> {
  // 1. Building-level default (most specific).
  if (input.clientBuildingId) {
    const b = await db.clientBuilding.findUnique({
      where: { id: input.clientBuildingId },
      select: { defaultSalesAgentId: true },
    });
    if (b?.defaultSalesAgentId) {
      return { salesAgentId: b.defaultSalesAgentId, source: "BUILDING_DEFAULT_SALES_AGENT" };
    }
  }
  // 2. Client-level default.
  if (input.clientId) {
    const c = await db.client.findUnique({
      where: { id: input.clientId },
      select: { defaultSalesAgentId: true },
    });
    if (c?.defaultSalesAgentId) {
      return { salesAgentId: c.defaultSalesAgentId, source: "CLIENT_DEFAULT_SALES_AGENT" };
    }
  }
  return { salesAgentId: null, source: null };
}

/**
 * Persist an OrderSalesAgentAssignmentLog row. Never throws — logging failures
 * must not roll back the parent write. No-op if `fromSalesAgentId === toSalesAgentId`.
 */
export async function logSalesAgentAssignment(
  db: DbClient,
  input: SalesAgentAssignmentLogInput,
): Promise<void> {
  try {
    const from = input.fromSalesAgentId ?? null;
    const to = input.toSalesAgentId ?? null;
    if (from === to) return;

    await db.orderSalesAgentAssignmentLog.create({
      data: {
        orderId: input.orderId,
        fromSalesAgentId: from,
        toSalesAgentId: to,
        source: input.source,
        actorId: input.actorId ?? null,
        reason: input.reason ?? null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[salesAgentAssignmentLog] Failed to write log entry:", err);
  }
}

/**
 * Strict month-lock guard for sales-agent edits — mirrors ensureTmAssignmentAllowed.
 *
 * Blocks when EITHER:
 *   1. `order.monthLockedAt` is set (order already frozen by a locked TM statement), OR
 *   2. The order's `endTime` month has a locked TmMonthlyStatement (the sales-agent
 *      slice is subtracted from the TM's commission base, so re-attributing after
 *      the TM's month is locked would silently invalidate the frozen statement).
 */
export async function ensureSalesAgentAssignmentAllowed(
  db: DbClient,
  orderId: number,
): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      endTime: true,
      technicalManagerId: true,
      monthLockedAt: true,
    },
  });
  if (!order) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
  }
  if (order.monthLockedAt) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Order ${order.orderNumber} was locked in a monthly statement on ${order.monthLockedAt.toISOString().slice(0, 10)} — unlock the statement first.`,
    });
  }
  if (!order.endTime || !order.technicalManagerId) return;
  const monthStart = new Date(Date.UTC(order.endTime.getUTCFullYear(), order.endTime.getUTCMonth(), 1));
  const conflict = await db.tmMonthlyStatement.findFirst({
    where: {
      userId: order.technicalManagerId,
      periodMonth: monthStart,
      lockedAt: { not: null },
    },
    select: { userId: true, user: { select: { firstName: true, lastName: true } } },
  });
  if (conflict) {
    const who = conflict.user
      ? `${conflict.user.firstName} ${conflict.user.lastName}`.trim()
      : `user #${conflict.userId}`;
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Cannot change sales agent on ${order.orderNumber}: ${who}'s TM statement for ${monthStart.toISOString().slice(0, 7)} is already locked. Unlock that statement first.`,
    });
  }
}
