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
      include: { createdBy: { select: { firstName: true, lastName: true } } },
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
