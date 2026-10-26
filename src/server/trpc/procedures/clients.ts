import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { applyDemoIsolation } from "~/server/utils/demoAccounts";
import {
  autoAssignNewClient,
  reassignClient,
  reassignClientBuilding,
  canReassignPortfolios,
  canBePortfolioOwner,
  portfolioMineWhereForClient,
} from "~/server/services/portfolioOwnership";

// ── Get all clients ──────────────────────────────────────────────────
export const getClients = baseProcedure
  .input(
    z.object({
      token: z.string(),
      scope: z.enum(["MINE", "ALL", "UNASSIGNED"]).optional(),
      ownerId: z.number().optional(),
    }),
  )
  .query(async ({ input }) => {
    const verified = jwt.verify(input.token, env.JWT_SECRET);
    const { userId } = z.object({ userId: z.number() }).parse(verified);

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });

    // Return all clients created by anyone in the same employer scope
    // Admins see all, others see only their own
    const isAdmin = ["ADMIN", "SENIOR_ADMIN", "JUNIOR_ADMIN", "MANAGER"].includes(user.role);
    const isContractorAdmin = ["CONTRACTOR_ADMIN", "CONTRACTOR_SENIOR_MANAGER"].includes(user.role);

    let where: any = (isAdmin || isContractorAdmin)
      ? (user.employerId
        ? { createdBy: { employerId: user.employerId } }
        : {})
      : { createdById: userId };

    // Resolve effective scope. Default = user's stored preference.
    const scope =
      input.scope ??
      ((user as any).defaultPortfolioView === "MINE" ? "MINE" : "ALL");

    if (scope === "MINE") {
      const mine = await portfolioMineWhereForClient(userId);
      where = { AND: [where, mine] };
    } else if (scope === "UNASSIGNED") {
      where = { AND: [where, { portfolioOwnerId: null }] };
    } else if (input.ownerId) {
      // Senior filtering by a specific junior's portfolio
      const mine = await portfolioMineWhereForClient(input.ownerId);
      where = { AND: [where, mine] };
    }

    // Demo data isolation — createdById is required (NOT NULL)
    await applyDemoIsolation(where, user, db, 'createdById', true);

    return db.client.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        portfolioOwner: { select: { id: true, firstName: true, lastName: true, role: true } },
        buildings: {
          orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
          include: {
            portfolioOwner: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  });

// ── Create a client ──────────────────────────────────────────────────
export const createClient = baseProcedure
  .input(
    z.object({
      token: z.string(),
      name: z.string().min(1, "Client name is required"),
      companyName: z.string().optional(),
      email: z.string().email("Invalid email address"),
      phone: z.string().min(1, "Phone number is required"),
      address: z.string().optional(),
      vatNumber: z.string().optional(),
      notes: z.string().optional(),
      portfolioOwnerId: z.number().optional(),
      portfolioTag: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const verified = jwt.verify(input.token, env.JWT_SECRET);
    const { userId } = z.object({ userId: z.number() }).parse(verified);

    const created = await db.client.create({
      data: {
        name: input.name,
        companyName: input.companyName || null,
        email: input.email,
        phone: input.phone,
        address: input.address || null,
        vatNumber: input.vatNumber || null,
        notes: input.notes || null,
        createdById: userId,
        portfolioOwnerId: input.portfolioOwnerId ?? null,
        portfolioTag: input.portfolioTag || null,
      },
    });

    // If no explicit owner supplied → auto-assign to lightest junior admin
    if (!input.portfolioOwnerId) {
      autoAssignNewClient(created.id, userId).catch((err) =>
        console.error("[portfolio] auto-assign failed:", err),
      );
    } else {
      // Log the manual initial assignment for audit
      await db.portfolioOwnershipLog.create({
        data: {
          entityType: "CLIENT",
          clientId: created.id,
          fromUserId: null,
          toUserId: input.portfolioOwnerId,
          actorId: userId,
          reason: "Initial assignment on client creation",
        },
      }).catch(() => {});
    }

    return created;
  });

// ── Update a client ──────────────────────────────────────────────────
export const updateClient = baseProcedure
  .input(
    z.object({
      token: z.string(),
      id: z.number(),
      name: z.string().min(1).optional(),
      companyName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().min(1).optional(),
      address: z.string().optional(),
      vatNumber: z.string().optional(),
      notes: z.string().optional(),
      portfolioTag: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const verified = jwt.verify(input.token, env.JWT_SECRET);
    z.object({ userId: z.number() }).parse(verified);

    const { token: _t, id, ...data } = input;
    return db.client.update({
      where: { id },
      data,
    });
  });

// ── Delete a client ──────────────────────────────────────────────────
export const deleteClient = baseProcedure
  .input(z.object({ token: z.string(), id: z.number() }))
  .mutation(async ({ input }) => {
    const verified = jwt.verify(input.token, env.JWT_SECRET);
    z.object({ userId: z.number() }).parse(verified);

    return db.client.delete({ where: { id: input.id } });
  });

// ── Get a single client (with buildings) ─────────────────────────────
export const getClient = baseProcedure
  .input(z.object({ token: z.string(), id: z.number() }))
  .query(async ({ input }) => {
    const verified = jwt.verify(input.token, env.JWT_SECRET);
    z.object({ userId: z.number() }).parse(verified);

    return db.client.findUnique({
      where: { id: input.id },
      include: { buildings: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] } },
    });
  });

// ── List buildings for a client ─────────────────────────────────────
export const getClientBuildings = baseProcedure
  .input(z.object({ token: z.string(), clientId: z.number() }))
  .query(async ({ input }) => {
    const verified = jwt.verify(input.token, env.JWT_SECRET);
    z.object({ userId: z.number() }).parse(verified);

    return db.clientBuilding.findMany({
      where: { clientId: input.clientId },
      orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    });
  });

// ── Create a building under a client ────────────────────────────────
export const createClientBuilding = baseProcedure
  .input(
    z.object({
      token: z.string(),
      clientId: z.number(),
      name: z.string().min(1, "Building name is required"),
      address: z.string().min(1, "Address is required"),
      notes: z.string().optional(),
      isPrimary: z.boolean().optional(),
      managerName: z.string().optional(),
      managerEmail: z.string().email("Invalid manager email").optional().or(z.literal("")),
      managerPhone: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const verified = jwt.verify(input.token, env.JWT_SECRET);
    z.object({ userId: z.number() }).parse(verified);

    if (input.isPrimary) {
      // Demote any existing primary
      await db.clientBuilding.updateMany({
        where: { clientId: input.clientId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    return db.clientBuilding.create({
      data: {
        clientId: input.clientId,
        name: input.name,
        address: input.address,
        notes: input.notes || null,
        isPrimary: input.isPrimary ?? false,
        managerName: input.managerName || null,
        managerEmail: input.managerEmail || null,
        managerPhone: input.managerPhone || null,
      },
    });
  });

// ── Update a building ───────────────────────────────────────────────
export const updateClientBuilding = baseProcedure
  .input(
    z.object({
      token: z.string(),
      id: z.number(),
      name: z.string().min(1).optional(),
      address: z.string().min(1).optional(),
      notes: z.string().optional(),
      isPrimary: z.boolean().optional(),
      managerName: z.string().optional(),
      managerEmail: z.string().email("Invalid manager email").optional().or(z.literal("")),
      managerPhone: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const verified = jwt.verify(input.token, env.JWT_SECRET);
    z.object({ userId: z.number() }).parse(verified);

    const { token: _t, id, managerEmail, ...rest } = input;
    const data: any = { ...rest };
    if (managerEmail !== undefined) data.managerEmail = managerEmail || null;
    if (data.managerName === "") data.managerName = null;
    if (data.managerPhone === "") data.managerPhone = null;

    if (data.isPrimary) {
      const existing = await db.clientBuilding.findUnique({ where: { id } });
      if (existing) {
        await db.clientBuilding.updateMany({
          where: { clientId: existing.clientId, isPrimary: true, NOT: { id } },
          data: { isPrimary: false },
        });
      }
    }

    return db.clientBuilding.update({ where: { id }, data });
  });

// ── Delete a building ───────────────────────────────────────────────
export const deleteClientBuilding = baseProcedure
  .input(z.object({ token: z.string(), id: z.number() }))
  .mutation(async ({ input }) => {
    const verified = jwt.verify(input.token, env.JWT_SECRET);
    z.object({ userId: z.number() }).parse(verified);

    return db.clientBuilding.delete({ where: { id: input.id } });
  });

// ─────────────────────────────────────────────────────────────────────
// Internal helpers (NOT exported as tRPC procedures) used by
// createQuotation / createOrder / createInvoice to auto-save the
// client-on-first-input and reuse them on subsequent flows.
// ─────────────────────────────────────────────────────────────────────

type DbLike = typeof db;

/**
 * Find an existing Client by email (case-insensitive) or create one.
 * Returns the resolved clientId, or null if email is empty.
 *
 * - If `existingClientId` is provided, returns it as-is (no upsert).
 * - Email match is scoped to records the user can see (own creator chain or
 *   global) — for simplicity we match globally on email and trust the email
 *   as a soft natural key.
 * - Updates the existing client with any new info (e.g. previously missing
 *   phone/address/vat) so the record fills in over time.
 */
export async function resolveClientId(
  prisma: DbLike,
  userId: number,
  fields: {
    existingClientId?: number | null;
    customerName: string;
    companyName?: string | null;
    customerEmail: string;
    customerPhone: string;
    address?: string | null;
    customerVatNumber?: string | null;
  }
): Promise<number | null> {
  if (fields.existingClientId) return fields.existingClientId;
  const email = (fields.customerEmail || "").trim().toLowerCase();
  if (!email) return null;

  // Try to find an existing client by email (case-insensitive)
  const existing = await prisma.client.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    // Backfill missing fields without overwriting non-empty values
    const data: any = {};
    if (!existing.phone && fields.customerPhone) data.phone = fields.customerPhone;
    if (!existing.address && fields.address) data.address = fields.address;
    if (!existing.vatNumber && fields.customerVatNumber) data.vatNumber = fields.customerVatNumber;
    if (!existing.companyName && fields.companyName) data.companyName = fields.companyName;
    if (Object.keys(data).length > 0) {
      await prisma.client.update({ where: { id: existing.id }, data });
    }
    return existing.id;
  }

  // Create a new client snapshot
  const created = await prisma.client.create({
    data: {
      name: fields.customerName,
      companyName: fields.companyName || null,
      email,
      phone: fields.customerPhone,
      address: fields.address || null,
      vatNumber: fields.customerVatNumber || null,
      createdById: userId,
    },
  });
  return created.id;
}

/**
 * Ensure a ClientBuilding exists for the given clientId+address+name.
 *
 * Matching precedence:
 *  1. If `buildingName` is provided, match by (clientId, name) case-insensitive.
 *     This lets distinct sites (Calton Centre vs The Marc) coexist even when
 *     they share a head-office accounting address.
 *  2. If no name is provided, fall back to matching by address only.
 *  3. If no name is provided AND the address matches the client's primary
 *     address, return null — the client record itself represents the site.
 *  4. Otherwise create a new ClientBuilding row using the given name+address
 *     (or a fallback derived from address if no name was supplied).
 *
 * PR-8J: prior versions matched by address alone which merged distinct
 * sub-buildings that shared a head-office accounting address, causing them
 * to disappear from the artisan dropdown.
 */
export async function resolveClientBuildingId(
  prisma: DbLike,
  args: {
    existingClientBuildingId?: number | null;
    clientId: number | null;
    address?: string | null;
    buildingName?: string | null;
  }
): Promise<number | null> {
  if (args.existingClientBuildingId) return args.existingClientBuildingId;
  if (!args.clientId) return null;
  const name = (args.buildingName || "").trim();
  const address = (args.address || "").trim();
  if (!name && !address) return null;

  const client = await prisma.client.findUnique({ where: { id: args.clientId } });
  if (!client) return null;

  // 1. Prefer name-based match when a distinct building name is supplied.
  if (name) {
    const byName = await prisma.clientBuilding.findFirst({
      where: {
        clientId: args.clientId,
        name: { equals: name, mode: "insensitive" },
      },
    });
    if (byName) return byName.id;
  } else if (address) {
    // 2. No name → fall back to address match (legacy behaviour).
    const byAddr = await prisma.clientBuilding.findFirst({
      where: {
        clientId: args.clientId,
        address: { equals: address, mode: "insensitive" },
      },
    });
    if (byAddr) return byAddr.id;
    // 3. No name AND address matches client primary → represent as client itself.
    if (
      client.address &&
      client.address.trim().toLowerCase() === address.toLowerCase()
    ) {
      return null;
    }
  }

  // 4. Create a new CB using the given name+address, or a fallback.
  const finalName = name || address.split(",")[0]?.slice(0, 80) || "Site";
  const finalAddress = address || name;
  const created = await prisma.clientBuilding.create({
    data: {
      clientId: args.clientId,
      name: finalName,
      address: finalAddress,
    },
  });
  return created.id;
}

// ═══════════════════════════════════════════════════════════════════════
// PR-9 — Portfolio ownership procedures
// ═══════════════════════════════════════════════════════════════════════

/** List users eligible to own a portfolio (admin / manager / TM roles). */
export const listPortfolioOwners = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const verified = jwt.verify(input.token, env.JWT_SECRET);
    z.object({ userId: z.number() }).parse(verified);

    return db.user.findMany({
      where: {
        role: { in: ["JUNIOR_ADMIN", "SENIOR_ADMIN", "MANAGER", "TECHNICAL_MANAGER"] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        onLeaveFrom: true,
        onLeaveUntil: true,
        portfolioBackupOwnerId: true,
      },
      orderBy: [{ role: "asc" }, { firstName: "asc" }],
    });
  });

/** Reassign a client's portfolio owner. Requires senior role. */
export const reassignClientPortfolio = baseProcedure
  .input(
    z.object({
      token: z.string(),
      clientId: z.number(),
      toUserId: z.number().nullable(),
      reason: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const verified = jwt.verify(input.token, env.JWT_SECRET);
    const { userId } = z.object({ userId: z.number() }).parse(verified);
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
    if (!canReassignPortfolios(user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Senior Admins / Managers can reassign portfolios",
      });
    }
    if (input.toUserId) {
      const target = await db.user.findUnique({ where: { id: input.toUserId } });
      if (!target || !canBePortfolioOwner(target.role)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Target user cannot own a portfolio",
        });
      }
    }
    await reassignClient({
      clientId: input.clientId,
      toUserId: input.toUserId,
      actorId: userId,
      reason: input.reason,
    });
    return { success: true };
  });

/** Reassign a specific building's portfolio owner. */
export const reassignBuildingPortfolio = baseProcedure
  .input(
    z.object({
      token: z.string(),
      clientBuildingId: z.number(),
      toUserId: z.number().nullable(),
      reason: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const verified = jwt.verify(input.token, env.JWT_SECRET);
    const { userId } = z.object({ userId: z.number() }).parse(verified);
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
    if (!canReassignPortfolios(user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Senior Admins / Managers can reassign portfolios",
      });
    }
    if (input.toUserId) {
      const target = await db.user.findUnique({ where: { id: input.toUserId } });
      if (!target || !canBePortfolioOwner(target.role)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Target user cannot own a portfolio",
        });
      }
    }
    await reassignClientBuilding({
      clientBuildingId: input.clientBuildingId,
      toUserId: input.toUserId,
      actorId: userId,
      reason: input.reason,
    });
    return { success: true };
  });

/** Bulk reassign several clients to one owner. */
export const bulkReassignClients = baseProcedure
  .input(
    z.object({
      token: z.string(),
      clientIds: z.array(z.number()).min(1),
      toUserId: z.number().nullable(),
      reason: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const verified = jwt.verify(input.token, env.JWT_SECRET);
    const { userId } = z.object({ userId: z.number() }).parse(verified);
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
    if (!canReassignPortfolios(user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Senior Admins / Managers can reassign portfolios",
      });
    }
    for (const id of input.clientIds) {
      await reassignClient({
        clientId: id,
        toUserId: input.toUserId,
        actorId: userId,
        reason: input.reason ?? "Bulk reassignment",
      });
    }
    return { success: true, updated: input.clientIds.length };
  });

/** Save the user's default view preference (MINE / ALL). */
export const setMyPortfolioView = baseProcedure
  .input(
    z.object({
      token: z.string(),
      view: z.enum(["MINE", "ALL", "UNASSIGNED"]),
    }),
  )
  .mutation(async ({ input }) => {
    const verified = jwt.verify(input.token, env.JWT_SECRET);
    const { userId } = z.object({ userId: z.number() }).parse(verified);
    await db.user.update({
      where: { id: userId },
      data: { defaultPortfolioView: input.view },
    });
    return { success: true };
  });

/** Set the on-leave window + backup owner for the current user. */
export const setMyOnLeaveHandover = baseProcedure
  .input(
    z.object({
      token: z.string(),
      onLeaveFrom: z.string().nullable(),
      onLeaveUntil: z.string().nullable(),
      backupOwnerId: z.number().nullable(),
    }),
  )
  .mutation(async ({ input }) => {
    const verified = jwt.verify(input.token, env.JWT_SECRET);
    const { userId } = z.object({ userId: z.number() }).parse(verified);
    await db.user.update({
      where: { id: userId },
      data: {
        onLeaveFrom: input.onLeaveFrom ? new Date(input.onLeaveFrom) : null,
        onLeaveUntil: input.onLeaveUntil ? new Date(input.onLeaveUntil) : null,
        portfolioBackupOwnerId: input.backupOwnerId,
      },
    });
    return { success: true };
  });

/** Ownership audit log for a client or building (last 20 changes). */
export const getPortfolioAuditLog = baseProcedure
  .input(
    z.object({
      token: z.string(),
      clientId: z.number().optional(),
      clientBuildingId: z.number().optional(),
    }),
  )
  .query(async ({ input }) => {
    const verified = jwt.verify(input.token, env.JWT_SECRET);
    z.object({ userId: z.number() }).parse(verified);
    return db.portfolioOwnershipLog.findMany({
      where: {
        ...(input.clientId ? { clientId: input.clientId } : {}),
        ...(input.clientBuildingId ? { clientBuildingId: input.clientBuildingId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        actor: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  });


