import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { applyDemoIsolation } from "~/server/utils/demoAccounts";

// ── Get all clients ──────────────────────────────────────────────────
export const getClients = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const verified = jwt.verify(input.token, env.JWT_SECRET);
    const { userId } = z.object({ userId: z.number() }).parse(verified);

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });

    // Return all clients created by anyone in the same employer scope
    // Admins see all, others see only their own
    const isAdmin = ["ADMIN", "SENIOR_ADMIN", "JUNIOR_ADMIN", "MANAGER"].includes(user.role);
    const isContractorAdmin = ["CONTRACTOR_ADMIN", "CONTRACTOR_SENIOR_MANAGER"].includes(user.role);

    const where: any = (isAdmin || isContractorAdmin)
      ? (user.employerId
        ? { createdBy: { employerId: user.employerId } }
        : {})
      : { createdById: userId };

    // Demo data isolation — createdById is required (NOT NULL)
    await applyDemoIsolation(where, user, db, 'createdById', true);

    return db.client.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        buildings: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
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
    })
  )
  .mutation(async ({ input }) => {
    const verified = jwt.verify(input.token, env.JWT_SECRET);
    const { userId } = z.object({ userId: z.number() }).parse(verified);

    return db.client.create({
      data: {
        name: input.name,
        companyName: input.companyName || null,
        email: input.email,
        phone: input.phone,
        address: input.address || null,
        vatNumber: input.vatNumber || null,
        notes: input.notes || null,
        createdById: userId,
      },
    });
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
    })
  )
  .mutation(async ({ input }) => {
    const verified = jwt.verify(input.token, env.JWT_SECRET);
    z.object({ userId: z.number() }).parse(verified);

    const { token: _t, id, ...data } = input;

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
 * Ensure a ClientBuilding exists for the given clientId+address.
 * If the address matches the Client's primary address, returns null
 * (no separate building row needed). Otherwise finds-or-creates a
 * ClientBuilding row and returns its id.
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
  const address = (args.address || "").trim();
  if (!address) return null;

  const client = await prisma.client.findUnique({ where: { id: args.clientId } });
  if (!client) return null;

  // If the address matches the client's primary address, don't create a
  // separate building entry — the client record itself represents the site.
  if (
    client.address &&
    client.address.trim().toLowerCase() === address.toLowerCase()
  ) {
    return null;
  }

  const existing = await prisma.clientBuilding.findFirst({
    where: {
      clientId: args.clientId,
      address: { equals: address, mode: "insensitive" },
    },
  });
  if (existing) return existing.id;

  const created = await prisma.clientBuilding.create({
    data: {
      clientId: args.clientId,
      name: args.buildingName?.trim() || address.split(",")[0]?.slice(0, 80) || "Site",
      address,
    },
  });
  return created.id;
}
