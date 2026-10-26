/**
 * PR-9 — Portfolio Ownership
 * ═══════════════════════════════════════════════════════════════════════════
 * Centralised resolver + scope helpers for the "each junior admin owns a
 * portfolio of clients" model.
 *
 * Ownership resolution (single owner per document):
 *   1. If the doc has clientBuildingId AND ClientBuilding.portfolioOwnerId set
 *      → building owner wins.
 *   2. Else if Client.portfolioOwnerId set → client owner.
 *   3. Else → null (Unassigned pool).
 *
 * MINE scope:
 *   A user "owns" a document if they are the resolved owner OR they are the
 *   backup owner for the resolved owner who is currently on leave.
 *
 * Auto-assign:
 *   New clients with no explicit owner are auto-assigned to the JUNIOR_ADMIN
 *   with the fewest open items (open orders + unpaid invoices + pending
 *   quotations across all their owned clients/buildings). Ties broken by
 *   fewest clients owned, then lowest user id.
 */

import { db } from "~/server/db";

const OWNER_ROLES = ["JUNIOR_ADMIN", "SENIOR_ADMIN", "MANAGER", "TECHNICAL_MANAGER"];
const AUTO_ASSIGN_TARGET_ROLES = ["JUNIOR_ADMIN"];
const SENIOR_ROLES = ["SENIOR_ADMIN", "MANAGER", "ADMIN"];

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type PortfolioScope = "MINE" | "ALL" | "UNASSIGNED";

export interface PortfolioScopedUser {
  id: number;
  role: string;
  defaultPortfolioView?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Owner resolution
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resolve the single portfolio owner for a doc identified by clientId +
 * clientBuildingId.  Returns userId or null.
 */
export async function resolveOwnerForDoc(input: {
  clientId?: number | null;
  clientBuildingId?: number | null;
}): Promise<number | null> {
  if (input.clientBuildingId) {
    const b = await db.clientBuilding.findUnique({
      where: { id: input.clientBuildingId },
      select: { portfolioOwnerId: true, clientId: true },
    });
    if (b?.portfolioOwnerId) return b.portfolioOwnerId;
    if (b?.clientId) {
      const c = await db.client.findUnique({
        where: { id: b.clientId },
        select: { portfolioOwnerId: true },
      });
      return c?.portfolioOwnerId ?? null;
    }
    return null;
  }
  if (input.clientId) {
    const c = await db.client.findUnique({
      where: { id: input.clientId },
      select: { portfolioOwnerId: true },
    });
    return c?.portfolioOwnerId ?? null;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Scope: which clients/buildings does user X "see" in MINE view?
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Returns the set of client & building ids that user X is responsible for.
 * Includes ownership via active leave-cover.
 */
export async function getOwnedClientsAndBuildingsForUser(userId: number): Promise<{
  ownedClientIds: number[];
  ownedBuildingIds: number[];
  /** Buildings under my clients that someone ELSE owns — exclude these when
   *  computing "my client's documents". */
  excludedBuildingIds: number[];
  /** Users I am currently covering (on-leave backup) */
  coveringForUserIds: number[];
}> {
  // Users I'm currently covering
  const now = new Date();
  const covering = await db.user.findMany({
    where: {
      portfolioBackupOwnerId: userId,
      onLeaveFrom: { lte: now },
      onLeaveUntil: { gte: now },
    },
    select: { id: true },
  });
  const coveringForUserIds = covering.map((u) => u.id);
  const effectiveUserIds = [userId, ...coveringForUserIds];

  const [myClients, myBuildings] = await Promise.all([
    db.client.findMany({
      where: { portfolioOwnerId: { in: effectiveUserIds } },
      select: { id: true },
    }),
    db.clientBuilding.findMany({
      where: { portfolioOwnerId: { in: effectiveUserIds } },
      select: { id: true, clientId: true },
    }),
  ]);
  const ownedClientIds = myClients.map((c) => c.id);
  const ownedBuildingIds = myBuildings.map((b) => b.id);

  // Buildings under my clients that have a DIFFERENT explicit owner — exclude
  // them so I don't accidentally see the other admin's documents.
  const foreignBuildings = await db.clientBuilding.findMany({
    where: {
      clientId: { in: ownedClientIds },
      portfolioOwnerId: { not: null, notIn: effectiveUserIds },
    },
    select: { id: true },
  });
  const excludedBuildingIds = foreignBuildings.map((b) => b.id);

  return { ownedClientIds, ownedBuildingIds, excludedBuildingIds, coveringForUserIds };
}

/**
 * Build a Prisma `where` fragment that limits invoices / orders / quotations
 * to the docs the user owns.  Composable with other where clauses via AND.
 */
export async function portfolioMineWhereForDoc(userId: number): Promise<any> {
  const { ownedClientIds, ownedBuildingIds, excludedBuildingIds } =
    await getOwnedClientsAndBuildingsForUser(userId);

  if (ownedClientIds.length === 0 && ownedBuildingIds.length === 0) {
    // Not owning anything → return a where that matches nothing.
    return { id: -1 };
  }

  return {
    OR: [
      // Buildings I own directly.
      ownedBuildingIds.length > 0 ? { clientBuildingId: { in: ownedBuildingIds } } : null,
      // My clients, but not their buildings owned by someone else.
      ownedClientIds.length > 0
        ? {
            clientId: { in: ownedClientIds },
            OR: [
              { clientBuildingId: null },
              excludedBuildingIds.length > 0
                ? { clientBuildingId: { notIn: excludedBuildingIds } }
                : { clientBuildingId: { not: null } },
            ],
          }
        : null,
    ].filter(Boolean),
  };
}

/** Same as above but for the Client model itself (list clients I own). */
export async function portfolioMineWhereForClient(userId: number): Promise<any> {
  const { ownedClientIds, ownedBuildingIds } = await getOwnedClientsAndBuildingsForUser(userId);
  if (ownedClientIds.length === 0 && ownedBuildingIds.length === 0) return { id: -1 };
  const orClauses: any[] = [];
  if (ownedClientIds.length > 0) orClauses.push({ id: { in: ownedClientIds } });
  if (ownedBuildingIds.length > 0)
    orClauses.push({ buildings: { some: { id: { in: ownedBuildingIds } } } });
  return { OR: orClauses };
}

/**
 * Combined helper — returns null (no filter) for ALL scope + non-junior users,
 * an ownership filter for MINE, or an unassigned filter for UNASSIGNED.
 */
export function unassignedDocWhere(): any {
  return {
    OR: [
      { clientId: null, clientBuildingId: null },
      {
        clientBuildingId: { not: null },
        clientBuilding: {
          portfolioOwnerId: null,
          client: { portfolioOwnerId: null },
        },
      },
      {
        clientBuildingId: null,
        clientId: { not: null },
        client: { portfolioOwnerId: null },
      },
    ],
  };
}

export async function scopedWhereForDoc(
  user: PortfolioScopedUser,
  scope: PortfolioScope,
): Promise<any | null> {
  if (scope === "ALL") return null;
  if (scope === "UNASSIGNED") return unassignedDocWhere();
  // MINE
  return portfolioMineWhereForDoc(user.id);
}

// ═══════════════════════════════════════════════════════════════════════════
// Auto-assign new clients to lightest junior admin
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pick the junior admin with the fewest open items.  Open items = open orders
 * + unpaid/overdue invoices + pending quotations for clients/buildings they
 * currently own.  Ties broken by fewest clients, then lowest id.  Excludes
 * juniors currently on leave (uses backup instead).
 */
export async function pickLightestJuniorAdmin(): Promise<number | null> {
  const now = new Date();
  const juniors = await db.user.findMany({
    where: {
      role: { in: AUTO_ASSIGN_TARGET_ROLES },
      OR: [
        { onLeaveFrom: null },
        { onLeaveUntil: null },
        { onLeaveUntil: { lt: now } },
        { onLeaveFrom: { gt: now } },
      ],
    },
    select: { id: true, portfolioBackupOwnerId: true },
  });
  if (juniors.length === 0) return null;

  const workloads: { id: number; open: number; clients: number }[] = [];
  for (const j of juniors) {
    const { ownedClientIds, ownedBuildingIds, excludedBuildingIds } =
      await getOwnedClientsAndBuildingsForUser(j.id);
    if (ownedClientIds.length === 0 && ownedBuildingIds.length === 0) {
      workloads.push({ id: j.id, open: 0, clients: 0 });
      continue;
    }
    const docWhere = {
      OR: [
        ownedBuildingIds.length > 0 ? { clientBuildingId: { in: ownedBuildingIds } } : null,
        ownedClientIds.length > 0
          ? {
              clientId: { in: ownedClientIds },
              OR: [
                { clientBuildingId: null },
                excludedBuildingIds.length > 0
                  ? { clientBuildingId: { notIn: excludedBuildingIds } }
                  : { clientBuildingId: { not: null } },
              ],
            }
          : null,
      ].filter(Boolean),
    };
    const [openOrders, openInvoices, openQuotes] = await Promise.all([
      db.order.count({
        where: {
          ...docWhere,
          status: {
            in: [
              "PENDING_REVIEW",
              "PENDING",
              "ASSIGNED",
              "IN_PROGRESS",
              "SELF_INITIATED",
              "AWAITING_ORDER_NUMBER",
              "AWAITING_BUILDING_INFO",
              "COMPLETED",
            ] as any,
          },
        },
      }),
      db.invoice.count({
        where: {
          ...docWhere,
          status: {
            in: ["DRAFT", "PENDING_REVIEW", "PENDING_APPROVAL", "APPROVED", "SENT", "OVERDUE"] as any,
          },
        },
      }),
      db.quotation.count({
        where: {
          ...docWhere,
          status: {
            in: [
              "DRAFT",
              "PENDING_ARTISAN_REVIEW",
              "IN_PROGRESS",
              "PENDING_JUNIOR_MANAGER_REVIEW",
              "PENDING_SENIOR_MANAGER_REVIEW",
              "APPROVED",
              "SENT_TO_CUSTOMER",
            ] as any,
          },
        },
      }),
    ]);
    workloads.push({
      id: j.id,
      open: openOrders + openInvoices + openQuotes,
      clients: ownedClientIds.length,
    });
  }

  workloads.sort((a, b) => a.open - b.open || a.clients - b.clients || a.id - b.id);
  return workloads[0]?.id ?? null;
}

/**
 * Auto-assign a newly created client to the lightest junior admin.  Idempotent:
 * skips if client already has an owner.  Writes to PortfolioOwnershipLog.
 */
export async function autoAssignNewClient(clientId: number, actorId: number): Promise<number | null> {
  const c = await db.client.findUnique({
    where: { id: clientId },
    select: { portfolioOwnerId: true },
  });
  if (!c) return null;
  if (c.portfolioOwnerId) return c.portfolioOwnerId;

  const pickedId = await pickLightestJuniorAdmin();
  if (!pickedId) return null;

  await db.client.update({
    where: { id: clientId },
    data: { portfolioOwnerId: pickedId },
  });
  await db.portfolioOwnershipLog.create({
    data: {
      entityType: "CLIENT",
      clientId,
      fromUserId: null,
      toUserId: pickedId,
      actorId,
      reason: "Auto-assigned (lightest workload)",
      autoAssigned: true,
    },
  });
  console.log(`[portfolio] auto-assigned client ${clientId} → user ${pickedId}`);
  return pickedId;
}

// ═══════════════════════════════════════════════════════════════════════════
// Manual reassign (with audit log)
// ═══════════════════════════════════════════════════════════════════════════

export async function reassignClient(input: {
  clientId: number;
  toUserId: number | null;
  actorId: number;
  reason?: string;
}): Promise<void> {
  const c = await db.client.findUnique({
    where: { id: input.clientId },
    select: { portfolioOwnerId: true },
  });
  if (!c) throw new Error("Client not found");
  if (c.portfolioOwnerId === input.toUserId) return;
  await db.client.update({
    where: { id: input.clientId },
    data: { portfolioOwnerId: input.toUserId },
  });
  await db.portfolioOwnershipLog.create({
    data: {
      entityType: "CLIENT",
      clientId: input.clientId,
      fromUserId: c.portfolioOwnerId,
      toUserId: input.toUserId,
      actorId: input.actorId,
      reason: input.reason ?? "Manual reassignment",
    },
  });
}

export async function reassignClientBuilding(input: {
  clientBuildingId: number;
  toUserId: number | null;
  actorId: number;
  reason?: string;
}): Promise<void> {
  const b = await db.clientBuilding.findUnique({
    where: { id: input.clientBuildingId },
    select: { portfolioOwnerId: true },
  });
  if (!b) throw new Error("Client building not found");
  if (b.portfolioOwnerId === input.toUserId) return;
  await db.clientBuilding.update({
    where: { id: input.clientBuildingId },
    data: { portfolioOwnerId: input.toUserId },
  });
  await db.portfolioOwnershipLog.create({
    data: {
      entityType: "CLIENT_BUILDING",
      clientBuildingId: input.clientBuildingId,
      fromUserId: b.portfolioOwnerId,
      toUserId: input.toUserId,
      actorId: input.actorId,
      reason: input.reason ?? "Manual reassignment",
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Access rules
// ═══════════════════════════════════════════════════════════════════════════

/** Only senior roles + technical manager can reassign portfolios. */
export function canReassignPortfolios(role: string): boolean {
  return [...SENIOR_ROLES, "TECHNICAL_MANAGER"].includes(role);
}

/** Anyone in an admin role can be a portfolio owner. */
export function canBePortfolioOwner(role: string): boolean {
  return OWNER_ROLES.includes(role);
}

/**
 * Resolve the effective scope for a request.
 *   - If caller passed an explicit scope, honour it (but only ALL/UNASSIGNED
 *     allowed for non-senior roles when caller isn't the user in question).
 *   - Otherwise fall back to the user's defaultPortfolioView.
 */
export function effectiveScope(
  user: PortfolioScopedUser,
  requested?: PortfolioScope | null,
): PortfolioScope {
  if (requested) return requested;
  const def = (user.defaultPortfolioView ?? "ALL") as PortfolioScope;
  return def === "MINE" || def === "UNASSIGNED" ? def : "ALL";
}
