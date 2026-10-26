// PR-8 — Historical Technical Manager backfill.
//
// Fills `Order.technicalManagerId` for every completed order where it is
// currently NULL, using a deterministic resolution order:
//
//   1. `initiatedBy.defaultTechnicalManagerId`   (self-initiated jobs)
//   2. `assignee.defaultTechnicalManagerId`      (jobs assigned to an artisan)
//   3. `OrderCrew` LEAD                          (legacy pre-`technicalManagerId` data)
//   4. Unresolvable — leave NULL, surface in the "Unassigned TM" admin screen.
//
// Restricted to senior admin tier. Two-step workflow: `dryRun` returns the plan,
// `apply` writes it. Every write goes through the standard audit log so a TM's
// July statement can prove exactly why row X moved from "Themba" to "Tony".

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { writeAuditLog } from "~/server/utils/auditLog";
import { logTmAssignment, ensureTmAssignmentAllowed } from "~/server/utils/tmAssignmentLog";

const SENIOR_ADMIN_ROLES = ["ADMIN", "SENIOR_ADMIN", "MANAGER"];

function ensureSeniorAdmin(role: string) {
  if (!SENIOR_ADMIN_ROLES.includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Senior admin only" });
  }
}

type BackfillSource = "INITIATOR_DEFAULT_TM" | "ASSIGNEE_DEFAULT_TM" | "CREW_LEAD" | "UNRESOLVABLE";

type ProposedChange = {
  orderId: number;
  orderNumber: string;
  customerName: string | null;
  endTime: Date | null;
  status: string;
  proposedTmId: number | null;
  source: BackfillSource;
  // Human-friendly context for the review table
  assignedToId: number | null;
  assignedToName: string | null;
  initiatedById: number | null;
  initiatedByName: string | null;
  crewLeadId: number | null;
  crewLeadName: string | null;
  proposedTmName: string | null;
};

type Grouping = {
  tmId: number | null;
  tmName: string;
  count: number;
  sampleOrderNumbers: string[]; // first 5
};

/**
 * Load every order missing `technicalManagerId` (bounded by optional date window)
 * plus the data we need to resolve them, then compute the proposed change per row.
 *
 * The heavy lifting for both dry-run and apply lives here so both procedures see
 * exactly the same rows and reach exactly the same conclusion.
 */
async function computeBackfillPlan(input: {
  sinceMonths?: number | null;
  onlyResolvable: boolean;
}): Promise<ProposedChange[]> {
  const since = input.sinceMonths
    ? (() => {
        const d = new Date();
        d.setUTCMonth(d.getUTCMonth() - input.sinceMonths!);
        d.setUTCDate(1);
        d.setUTCHours(0, 0, 0, 0);
        return d;
      })()
    : null;

  const orders = await db.order.findMany({
    where: {
      technicalManagerId: null,
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      endTime: true,
      status: true,
      assignedToId: true,
      initiatedById: true,
      selfInitiated: true,
      assignedTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          defaultTechnicalManagerId: true,
          defaultTechnicalManager: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      initiatedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          defaultTechnicalManagerId: true,
          defaultTechnicalManager: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      crew: {
        where: { role: "LEAD", leftAt: null },
        take: 1,
        select: {
          userId: true,
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { id: "asc" },
  });

  const fullName = (u?: { firstName?: string | null; lastName?: string | null } | null) =>
    u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || null : null;

  const proposals: ProposedChange[] = orders.map((o) => {
    const initiatorTm = o.selfInitiated ? o.initiatedBy?.defaultTechnicalManager ?? null : null;
    const assigneeTm = o.assignedTo?.defaultTechnicalManager ?? null;
    const crewLead = o.crew[0]?.user ?? null;

    let source: BackfillSource;
    let proposedTmId: number | null;
    let proposedTmName: string | null;

    if (initiatorTm) {
      source = "INITIATOR_DEFAULT_TM";
      proposedTmId = initiatorTm.id;
      proposedTmName = fullName(initiatorTm);
    } else if (assigneeTm) {
      source = "ASSIGNEE_DEFAULT_TM";
      proposedTmId = assigneeTm.id;
      proposedTmName = fullName(assigneeTm);
    } else if (crewLead) {
      source = "CREW_LEAD";
      proposedTmId = crewLead.id;
      proposedTmName = fullName(crewLead);
    } else {
      source = "UNRESOLVABLE";
      proposedTmId = null;
      proposedTmName = null;
    }

    return {
      orderId: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      endTime: o.endTime,
      status: o.status,
      proposedTmId,
      source,
      assignedToId: o.assignedToId,
      assignedToName: fullName(o.assignedTo),
      initiatedById: o.initiatedById,
      initiatedByName: fullName(o.initiatedBy),
      crewLeadId: o.crew[0]?.userId ?? null,
      crewLeadName: fullName(crewLead),
      proposedTmName,
    };
  });

  return input.onlyResolvable ? proposals.filter((p) => p.source !== "UNRESOLVABLE") : proposals;
}

function summarise(proposals: ProposedChange[]) {
  const bySource: Record<BackfillSource, number> = {
    INITIATOR_DEFAULT_TM: 0,
    ASSIGNEE_DEFAULT_TM: 0,
    CREW_LEAD: 0,
    UNRESOLVABLE: 0,
  };
  const byTmMap = new Map<number | null, Grouping>();

  for (const p of proposals) {
    bySource[p.source]++;
    const key = p.proposedTmId;
    let g = byTmMap.get(key);
    if (!g) {
      g = {
        tmId: key,
        tmName: p.proposedTmName ?? "— Unresolvable —",
        count: 0,
        sampleOrderNumbers: [],
      };
      byTmMap.set(key, g);
    }
    g.count++;
    if (g.sampleOrderNumbers.length < 5) g.sampleOrderNumbers.push(p.orderNumber);
  }

  const byTm = Array.from(byTmMap.values()).sort((a, b) => b.count - a.count);
  return { bySource, byTm };
}

/**
 * READ-ONLY. Preview what the backfill would do. Safe to run any time.
 */
export const adminTmBackfillDryRun = baseProcedure
  .input(
    z.object({
      token: z.string(),
      sinceMonths: z.number().int().positive().optional(), // e.g. 12 = last 12 months only
      onlyResolvable: z.boolean().default(false),
      limit: z.number().int().positive().max(2000).default(500), // trim proposal list for UI
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureSeniorAdmin(user.role);

    const proposals = await computeBackfillPlan({
      sinceMonths: input.sinceMonths ?? null,
      onlyResolvable: input.onlyResolvable,
    });
    const summary = summarise(proposals);

    return {
      totalNullOrders: proposals.length,
      summary,
      proposals: proposals.slice(0, input.limit),
      truncated: proposals.length > input.limit,
      generatedAt: new Date(),
    };
  });

/**
 * WRITE. Apply the backfill. Options:
 *   - `orderIds`: apply to a specific subset (from the dry-run review UI).
 *   - `applyAllResolvable`: apply to every resolvable row currently null.
 * Exactly one of the two must be supplied.
 *
 * Writes an audit-log entry per order so the change is traceable.
 */
export const adminTmBackfillApply = baseProcedure
  .input(
    z.object({
      token: z.string(),
      sinceMonths: z.number().int().positive().optional(),
      orderIds: z.array(z.number()).optional(),
      applyAllResolvable: z.boolean().default(false),
      // Guard against accidental clicks — require the caller to echo the
      // expected count from a fresh dry-run so we never write against a stale
      // preview.
      expectedCount: z.number().int().min(0),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureSeniorAdmin(user.role);

    if (!input.orderIds && !input.applyAllResolvable) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Provide either orderIds or applyAllResolvable=true",
      });
    }
    if (input.orderIds && input.applyAllResolvable) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Provide orderIds OR applyAllResolvable, not both",
      });
    }

    const plan = await computeBackfillPlan({
      sinceMonths: input.sinceMonths ?? null,
      onlyResolvable: true, // never write UNRESOLVABLE rows
    });

    let targets = plan;
    if (input.orderIds) {
      const wanted = new Set(input.orderIds);
      targets = plan.filter((p) => wanted.has(p.orderId));
    }

    if (targets.length !== input.expectedCount) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Backfill plan drifted since preview: expected ${input.expectedCount} rows, plan now has ${targets.length}. Refresh the dry-run and try again.`,
      });
    }

    let updated = 0;
    for (const p of targets) {
      if (!p.proposedTmId) continue; // shouldn't happen (filtered above) but be defensive

      const before = { technicalManagerId: null as number | null };
      const after = { technicalManagerId: p.proposedTmId };

      await db.order.update({
        where: { id: p.orderId },
        data: { technicalManagerId: p.proposedTmId },
      });

      await writeAuditLog(db, {
        actor: user,
        action: "UPDATE",
        entityType: "Order",
        entityId: p.orderId,
        before,
        after,
        description: `PR-8 backfill: set technicalManagerId=${p.proposedTmId} (${p.proposedTmName}) via ${p.source}`,
      });

      // PR-8 — also record on the per-order TM assignment log so admins can
      // trace history from the order detail view (not just the global
      // AuditLog).
      await logTmAssignment(db, {
        orderId: p.orderId,
        fromTmId: null,
        toTmId: p.proposedTmId,
        source: "BACKFILL",
        actorId: user.id,
        reason: `Underlying source: ${p.source}${p.proposedTmName ? ` (${p.proposedTmName})` : ""}`,
      });

      updated++;
    }

    return {
      requested: input.expectedCount,
      updated,
      skipped: targets.length - updated,
      completedAt: new Date(),
    };
  });

/**
 * PR-8 — Manual, one-order cleanup used by the "/admin/tm-statements/unassigned"
 * screen. Assigns a TM to a single currently-null order and logs the change
 * with source=UNRESOLVABLE_CLEANUP so it's obvious in the audit trail that
 * this was a human triage decision, not a backfill and not a normal edit.
 *
 * Rejects orders that already have a TM (use adminSetOrderTechnicalManager
 * for override / correction) and orders that live in a month-locked window.
 */
export const adminResolveUnassignedTm = baseProcedure
  .input(
    z.object({
      token: z.string(),
      orderId: z.number(),
      technicalManagerId: z.number(),
      reason: z.string().max(500).optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureSeniorAdmin(user.role);

    const order = await db.order.findUnique({
      where: { id: input.orderId },
      select: {
        id: true,
        orderNumber: true,
        technicalManagerId: true,
        monthLockedAt: true,
      },
    });
    if (!order) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
    }
    if (order.technicalManagerId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Order ${order.orderNumber} already has a Technical Manager. Use the order edit screen to change it.`,
      });
    }
    if (order.monthLockedAt) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Order ${order.orderNumber} was locked in a monthly statement on ${order.monthLockedAt.toISOString().slice(0, 10)} — unlock first.`,
      });
    }

    // PR-8 D — also block when the incoming TM's monthly statement for the
    // order's endTime month is already locked (previous TM is null here so we
    // only need to check the incoming side).
    await ensureTmAssignmentAllowed(db, input.orderId, input.technicalManagerId);

    // Verify the chosen TM currently has an active CommissionRule of role="TM".
    const activeTm = await db.commissionRule.findFirst({
      where: {
        userId: input.technicalManagerId,
        role: "TM",
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
      },
      select: { id: true },
    });
    if (!activeTm) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Selected Technical Manager is not active — refresh the list and choose again.",
      });
    }

    await db.order.update({
      where: { id: input.orderId },
      data: { technicalManagerId: input.technicalManagerId },
    });

    await writeAuditLog(db, {
      actor: user,
      action: "UPDATE",
      entityType: "Order",
      entityId: input.orderId,
      before: { technicalManagerId: null },
      after: { technicalManagerId: input.technicalManagerId },
      description: `Unassigned-TM cleanup: assigned Technical Manager #${input.technicalManagerId}${input.reason ? ` — ${input.reason}` : ""}`,
    });

    await logTmAssignment(db, {
      orderId: input.orderId,
      fromTmId: null,
      toTmId: input.technicalManagerId,
      source: "UNRESOLVABLE_CLEANUP",
      actorId: user.id,
      reason: input.reason ?? `Manual cleanup on ${order.orderNumber}`,
    });

    return { ok: true, orderId: input.orderId, technicalManagerId: input.technicalManagerId };
  });
