import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const ADMIN_ROLES = ["ADMIN", "SENIOR_ADMIN", "JUNIOR_ADMIN", "MANAGER", "TECHNICAL_MANAGER"];

/** List users eligible to be assigned as Order.technicalManagerId (responsible TM).
 *  Includes any user with role TECHNICAL_MANAGER, plus any user that has an active
 *  CommissionRule of role "TM" (covers admins who also earn TM commission).
 */
export const adminListTechnicalManagers = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!ADMIN_ROLES.includes(user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
    }

    const users = await db.user.findMany({
      where: {
        OR: [
          { role: "TECHNICAL_MANAGER" },
          {
            commissionRules: {
              some: {
                role: "TM",
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
              },
            },
          },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    return users.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`.trim(),
      email: u.email,
      role: u.role,
    }));
  });

/** Admin sets a user's default Technical Manager (drives commission on self-initiated jobs). */
export const adminSetUserDefaultTechnicalManager = baseProcedure
  .input(z.object({
    token: z.string(),
    userId: z.number(),
    technicalManagerId: z.number().nullable(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!ADMIN_ROLES.includes(user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
    }
    await db.user.update({
      where: { id: input.userId },
      data: { defaultTechnicalManagerId: input.technicalManagerId },
    });
    return { ok: true };
  });

/**
 * PR-8 — Artisan-accessible list of TMs to pick from at job-start time.
 *
 * Any authenticated user may call this (artisans need it to populate the
 * <TmPicker> on start-job / accept-assignment). Filters to users with an
 * active `CommissionRule` where `role="TM"` — this is the canonical source
 * of truth (adding someone via the Commission Rules screen is the same
 * action as "make them a TM").
 *
 * `suggestedId` (optional in the response) is the caller's own
 * `defaultTechnicalManagerId` so the UI can pre-select it.
 */
export const getActiveTechnicalManagers = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const me = await authenticateUser(input.token);

    const now = new Date();
    // Fetch caller's default TM separately — `authenticateUser` doesn't select it.
    const myDefault = await db.user.findUnique({
      where: { id: me.id },
      select: { defaultTechnicalManagerId: true },
    });

    const users = await db.user.findMany({
      where: {
        commissionRules: {
          some: {
            role: "TM",
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
          },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    return {
      suggestedId: myDefault?.defaultTechnicalManagerId ?? null,
      tms: users.map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`.trim() || u.email,
        email: u.email,
        role: u.role,
      })),
    };
  });

/**
 * PR-8 — Admin overview of every user who might own a job (artisans,
 * contractors, admins, TMs themselves) plus their current
 * `defaultTechnicalManagerId`. Feeds the `/admin/tm-defaults` cleanup
 * screen so admins can spot and fix wrong or missing default TMs — this is
 * the setup data that seeds the artisan's <TmPicker> pre-selection and the
 * fallback the backfill uses.
 */
export const adminListUserTmDefaults = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!ADMIN_ROLES.includes(user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
    }

    const users = await db.user.findMany({
      where: {
        role: {
          in: ["ARTISAN", "CONTRACTOR", "TECHNICAL_MANAGER", "JUNIOR_ADMIN", "SENIOR_ADMIN", "ADMIN", "MANAGER"],
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        defaultTechnicalManagerId: true,
        defaultTechnicalManager: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ role: "asc" }, { firstName: "asc" }, { lastName: "asc" }],
    });

    return users.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`.trim() || u.email,
      email: u.email,
      role: u.role,
      defaultTechnicalManagerId: u.defaultTechnicalManagerId ?? null,
      defaultTechnicalManagerName: u.defaultTechnicalManager
        ? `${u.defaultTechnicalManager.firstName} ${u.defaultTechnicalManager.lastName}`.trim()
        : null,
    }));
  });

