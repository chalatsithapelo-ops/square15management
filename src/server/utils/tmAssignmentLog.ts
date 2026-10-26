// PR-8 — Append-only helper for `OrderTmAssignmentLog`.
//
// Every code path that writes `Order.technicalManagerId` should call this so
// TM statements can prove *why* each order was attributed the way it was.
//
// SAFE:  Never throws. Logging failures must not roll back the parent write.
// SKIP:  If `fromTmId === toTmId` we skip the insert — no assignment change happened.

import { TRPCError } from "@trpc/server";
import type { PrismaClient, Prisma } from "@prisma/client";

export type TmAssignmentSource =
  | "EXPLICIT_INPUT" // admin/agent typed a TM id at create time
  | "ARTISAN_PICKED" // artisan chose TM via TmPicker on job-start / self-initiate
  | "INITIATOR_DEFAULT_TM" // resolved from initiator's defaultTechnicalManagerId
  | "ASSIGNEE_DEFAULT_TM" // resolved from assignee's defaultTechnicalManagerId
  | "QUOTE_OWNER_DEFAULT_TM" // resolved from quotation.assignedTo.defaultTechnicalManagerId
  | "CREW_LEAD" // legacy fallback (OrderCrew role=LEAD)
  | "ADMIN_OVERRIDE" // admin edited via /admin/tm-statements order-detail knob
  | "BACKFILL" // PR-8 historical backfill job
  | "UNRESOLVABLE_CLEANUP"; // admin resolved via /admin/tm-statements/unassigned screen

export type TmAssignmentLogInput = {
  orderId: number;
  fromTmId?: number | null;
  toTmId: number | null;
  source: TmAssignmentSource;
  actorId?: number | null;
  reason?: string | null;
};

type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Persist an OrderTmAssignmentLog row. Never throws — logging failures must not
 * break the parent mutation.
 */
export async function logTmAssignment(
  db: DbClient,
  input: TmAssignmentLogInput
): Promise<void> {
  try {
    const from = input.fromTmId ?? null;
    const to = input.toTmId ?? null;

    // No-op if nothing actually changed.
    if (from === to) return;

    await db.orderTmAssignmentLog.create({
      data: {
        orderId: input.orderId,
        fromTmId: from,
        toTmId: to,
        source: input.source,
        actorId: input.actorId ?? null,
        reason: input.reason ?? null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[tmAssignmentLog] Failed to write log entry:", err);
  }
}

// ─────────────────── PR-8 D — strict month-lock guard ───────────────────

/**
 * PR-8 D — strict month-lock guard for TM edits.
 *
 * Blocks a `technicalManagerId` change on `orderId` when EITHER:
 *   1. The order itself has `monthLockedAt` set (existing lock), OR
 *   2. The order's `endTime` falls inside a month for which a
 *      `TmMonthlyStatement` is currently locked for the previous TM or the
 *      incoming TM. This closes the gap where an admin re-assigns to a TM
 *      whose statement for the affected month is already closed.
 *
 * Skipped when `endTime` is null (order not scheduled yet — nothing to lock).
 * Throws TRPCError(FORBIDDEN) with a caller-friendly message on violation.
 */
export async function ensureTmAssignmentAllowed(
  db: DbClient,
  orderId: number,
  nextTmId: number | null
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

  // 1. Order already frozen by a locked statement.
  if (order.monthLockedAt) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Order ${order.orderNumber} was locked in a monthly statement on ${order.monthLockedAt.toISOString().slice(0, 10)} — unlock the statement first.`,
    });
  }

  // 2. Cross-check the endTime month for any conflicting locked statement.
  if (!order.endTime) return;
  const monthStart = new Date(
    Date.UTC(order.endTime.getUTCFullYear(), order.endTime.getUTCMonth(), 1)
  );

  const candidateUserIds = Array.from(
    new Set(
      [order.technicalManagerId, nextTmId].filter(
        (v): v is number => typeof v === "number"
      )
    )
  );
  if (candidateUserIds.length === 0) return;

  const conflict = await db.tmMonthlyStatement.findFirst({
    where: {
      userId: { in: candidateUserIds },
      periodMonth: monthStart,
      lockedAt: { not: null },
    },
    select: {
      userId: true,
      lockedAt: true,
      user: { select: { firstName: true, lastName: true } },
    },
  });
  if (conflict) {
    const who = conflict.user
      ? `${conflict.user.firstName} ${conflict.user.lastName}`.trim()
      : `user #${conflict.userId}`;
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Cannot change TM on ${order.orderNumber}: ${who}'s statement for ${monthStart.toISOString().slice(0, 7)} is already locked. Unlock that statement first.`,
    });
  }
}
