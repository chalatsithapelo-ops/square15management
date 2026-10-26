// PR-8 F — Site Lead + Ops Manager assignment/log/lock helpers.
//
// Structurally identical to salesAgentAssignmentLog.ts and tmAssignmentLog.ts
// but kept in a single file (two roles, one shape) to reduce boilerplate.
//
// Resolution priority for both roles:
//   1. Order.<role>Id (explicit — set by admin, artisan-picked, backfill)
//   2. Initiator's default<Role>Id  (user's own preference — for self-initiated jobs)
//   3. Assignee's default<Role>Id   (fallback when initiator has no default)
//   4. ClientBuilding.default<Role>Id
//   5. Client.default<Role>Id
//   6. null → surface as "Unassigned" for admin triage.

import { TRPCError } from "@trpc/server";
import type { PrismaClient, Prisma } from "@prisma/client";
import { db } from "~/server/db";

// ---------------------------------------------------------------------------
// Site Lead
// ---------------------------------------------------------------------------

export type SiteLeadAssignmentSource =
  | "EXPLICIT_INPUT"
  | "ARTISAN_PICKED"
  | "INITIATOR_DEFAULT_SITE_LEAD"
  | "ASSIGNEE_DEFAULT_SITE_LEAD"
  | "BUILDING_DEFAULT_SITE_LEAD"
  | "CLIENT_DEFAULT_SITE_LEAD"
  | "ADMIN_OVERRIDE"
  | "BACKFILL"
  | "UNRESOLVABLE_CLEANUP";

export type SiteLeadAssignmentLogInput = {
  orderId: number;
  fromSiteLeadId?: number | null;
  toSiteLeadId: number | null;
  source: SiteLeadAssignmentSource;
  actorId?: number | null;
  reason?: string | null;
};

// ---------------------------------------------------------------------------
// Ops Manager
// ---------------------------------------------------------------------------

export type OpsManagerAssignmentSource =
  | "EXPLICIT_INPUT"
  | "ARTISAN_PICKED"
  | "INITIATOR_DEFAULT_OPS_MANAGER"
  | "ASSIGNEE_DEFAULT_OPS_MANAGER"
  | "BUILDING_DEFAULT_OPS_MANAGER"
  | "CLIENT_DEFAULT_OPS_MANAGER"
  | "ADMIN_OVERRIDE"
  | "BACKFILL"
  | "UNRESOLVABLE_CLEANUP";

export type OpsManagerAssignmentLogInput = {
  orderId: number;
  fromOpsManagerId?: number | null;
  toOpsManagerId: number | null;
  source: OpsManagerAssignmentSource;
  actorId?: number | null;
  reason?: string | null;
};

type DbClient = PrismaClient | Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Resolution — Site Lead
// ---------------------------------------------------------------------------

export async function resolveSiteLeadFromDefaults(input: {
  initiatorId?: number | null;
  assigneeId?: number | null;
  clientBuildingId?: number | null;
  clientId?: number | null;
}): Promise<{ siteLeadId: number | null; source: SiteLeadAssignmentSource | null }> {
  if (input.initiatorId) {
    const u = await db.user.findUnique({
      where: { id: input.initiatorId },
      select: { defaultSiteLeadId: true },
    });
    if (u?.defaultSiteLeadId) {
      return { siteLeadId: u.defaultSiteLeadId, source: "INITIATOR_DEFAULT_SITE_LEAD" };
    }
  }
  if (input.assigneeId) {
    const u = await db.user.findUnique({
      where: { id: input.assigneeId },
      select: { defaultSiteLeadId: true },
    });
    if (u?.defaultSiteLeadId) {
      return { siteLeadId: u.defaultSiteLeadId, source: "ASSIGNEE_DEFAULT_SITE_LEAD" };
    }
  }
  if (input.clientBuildingId) {
    const b = await db.clientBuilding.findUnique({
      where: { id: input.clientBuildingId },
      select: { defaultSiteLeadId: true },
    });
    if (b?.defaultSiteLeadId) {
      return { siteLeadId: b.defaultSiteLeadId, source: "BUILDING_DEFAULT_SITE_LEAD" };
    }
  }
  if (input.clientId) {
    const c = await db.client.findUnique({
      where: { id: input.clientId },
      select: { defaultSiteLeadId: true },
    });
    if (c?.defaultSiteLeadId) {
      return { siteLeadId: c.defaultSiteLeadId, source: "CLIENT_DEFAULT_SITE_LEAD" };
    }
  }
  return { siteLeadId: null, source: null };
}

// ---------------------------------------------------------------------------
// Resolution — Ops Manager
// ---------------------------------------------------------------------------

export async function resolveOpsManagerFromDefaults(input: {
  initiatorId?: number | null;
  assigneeId?: number | null;
  clientBuildingId?: number | null;
  clientId?: number | null;
}): Promise<{ opsManagerId: number | null; source: OpsManagerAssignmentSource | null }> {
  if (input.initiatorId) {
    const u = await db.user.findUnique({
      where: { id: input.initiatorId },
      select: { defaultOpsManagerId: true },
    });
    if (u?.defaultOpsManagerId) {
      return { opsManagerId: u.defaultOpsManagerId, source: "INITIATOR_DEFAULT_OPS_MANAGER" };
    }
  }
  if (input.assigneeId) {
    const u = await db.user.findUnique({
      where: { id: input.assigneeId },
      select: { defaultOpsManagerId: true },
    });
    if (u?.defaultOpsManagerId) {
      return { opsManagerId: u.defaultOpsManagerId, source: "ASSIGNEE_DEFAULT_OPS_MANAGER" };
    }
  }
  if (input.clientBuildingId) {
    const b = await db.clientBuilding.findUnique({
      where: { id: input.clientBuildingId },
      select: { defaultOpsManagerId: true },
    });
    if (b?.defaultOpsManagerId) {
      return { opsManagerId: b.defaultOpsManagerId, source: "BUILDING_DEFAULT_OPS_MANAGER" };
    }
  }
  if (input.clientId) {
    const c = await db.client.findUnique({
      where: { id: input.clientId },
      select: { defaultOpsManagerId: true },
    });
    if (c?.defaultOpsManagerId) {
      return { opsManagerId: c.defaultOpsManagerId, source: "CLIENT_DEFAULT_OPS_MANAGER" };
    }
  }
  return { opsManagerId: null, source: null };
}

// ---------------------------------------------------------------------------
// Logging — never throws, no-op if from === to.
// ---------------------------------------------------------------------------

export async function logSiteLeadAssignment(
  db: DbClient,
  input: SiteLeadAssignmentLogInput,
): Promise<void> {
  try {
    const from = input.fromSiteLeadId ?? null;
    const to = input.toSiteLeadId ?? null;
    if (from === to) return;

    await db.orderSiteLeadAssignmentLog.create({
      data: {
        orderId: input.orderId,
        fromSiteLeadId: from,
        toSiteLeadId: to,
        source: input.source,
        actorId: input.actorId ?? null,
        reason: input.reason ?? null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[siteLeadAssignmentLog] Failed to write log entry:", err);
  }
}

export async function logOpsManagerAssignment(
  db: DbClient,
  input: OpsManagerAssignmentLogInput,
): Promise<void> {
  try {
    const from = input.fromOpsManagerId ?? null;
    const to = input.toOpsManagerId ?? null;
    if (from === to) return;

    await db.orderOpsManagerAssignmentLog.create({
      data: {
        orderId: input.orderId,
        fromOpsManagerId: from,
        toOpsManagerId: to,
        source: input.source,
        actorId: input.actorId ?? null,
        reason: input.reason ?? null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[opsManagerAssignmentLog] Failed to write log entry:", err);
  }
}

// ---------------------------------------------------------------------------
// Strict month-lock guards — parallel to ensureSalesAgentAssignmentAllowed.
// Both block when the parent order (or its TM's month) is already frozen.
// ---------------------------------------------------------------------------

async function ensureRoleAssignmentAllowedImpl(
  db: DbClient,
  orderId: number,
  roleLabel: string,
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
      message: `Cannot change ${roleLabel} on ${order.orderNumber}: ${who}'s TM statement for ${monthStart.toISOString().slice(0, 7)} is already locked. Unlock that statement first.`,
    });
  }
}

export function ensureSiteLeadAssignmentAllowed(db: DbClient, orderId: number) {
  return ensureRoleAssignmentAllowedImpl(db, orderId, "site lead");
}

export function ensureOpsManagerAssignmentAllowed(db: DbClient, orderId: number) {
  return ensureRoleAssignmentAllowedImpl(db, orderId, "ops manager");
}
