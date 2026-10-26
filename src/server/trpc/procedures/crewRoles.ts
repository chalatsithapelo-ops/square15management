// PR-8 F — Site Lead + Ops Manager defaults management (parallel to salesAgents.ts).
//
// Exposes for BOTH roles (site-lead + ops-manager):
//   • adminList{Role}s                          — active users with matching CommissionRule
//   • adminListUser{Role}Defaults               — users + their current default (for User.default<Role>Id knob)
//   • adminSetUserDefault{Role}                 — mutate User.default<Role>Id
//   • adminListClient{Role}Defaults             — clients + their default
//   • adminSetClientDefault{Role}               — mutate Client.default<Role>Id
//   • adminListBuilding{Role}Defaults           — buildings + inherited client default
//   • adminSetBuildingDefault{Role}             — mutate ClientBuilding.default<Role>Id

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const ADMIN_ROLES = ["ADMIN", "SENIOR_ADMIN", "JUNIOR_ADMIN", "MANAGER", "TECHNICAL_MANAGER"];

function ensureAdmin(role: string) {
  if (!ADMIN_ROLES.includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
  }
}

// ---------------------------------------------------------------------------
// SITE LEAD
// ---------------------------------------------------------------------------

export const adminListSiteLeads = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdmin(user.role);

    const users = await db.user.findMany({
      where: {
        commissionRules: {
          some: {
            role: "SITE_LEAD",
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
          },
        },
      },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    return users.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`.trim(),
      email: u.email,
      role: u.role,
    }));
  });

export const adminListUserSiteLeadDefaults = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdmin(user.role);

    const users = await db.user.findMany({
      where: {
        isActive: true,
        role: { in: ["ARTISAN", "TECHNICAL_MANAGER", "MANAGER", "JUNIOR_ADMIN", "SENIOR_ADMIN"] as any },
      },
      select: {
        id: true, firstName: true, lastName: true, email: true, role: true,
        defaultSiteLeadId: true,
        defaultSiteLead: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ firstName: "asc" }],
    });
    return users.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`.trim(),
      email: u.email,
      role: u.role,
      defaultSiteLeadId: u.defaultSiteLeadId,
      defaultSiteLeadName: u.defaultSiteLead
        ? `${u.defaultSiteLead.firstName} ${u.defaultSiteLead.lastName}`.trim()
        : null,
    }));
  });

export const adminSetUserDefaultSiteLead = baseProcedure
  .input(z.object({ token: z.string(), userId: z.number(), siteLeadId: z.number().nullable() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdmin(user.role);
    await db.user.update({
      where: { id: input.userId },
      data: { defaultSiteLeadId: input.siteLeadId },
    });
    return { ok: true };
  });

export const adminListClientSiteLeadDefaults = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdmin(user.role);

    const clients = await db.client.findMany({
      select: {
        id: true, name: true, companyName: true, email: true,
        defaultSiteLeadId: true,
        defaultSiteLead: { select: { firstName: true, lastName: true } },
        _count: { select: { buildings: true, orders: true } },
      },
      orderBy: [{ name: "asc" }],
    });
    return clients.map((c) => ({
      id: c.id,
      name: c.name,
      companyName: c.companyName,
      email: c.email,
      defaultSiteLeadId: c.defaultSiteLeadId,
      defaultSiteLeadName: c.defaultSiteLead
        ? `${c.defaultSiteLead.firstName} ${c.defaultSiteLead.lastName}`.trim()
        : null,
      buildingCount: c._count.buildings,
      orderCount: c._count.orders,
    }));
  });

export const adminSetClientDefaultSiteLead = baseProcedure
  .input(z.object({ token: z.string(), clientId: z.number(), siteLeadId: z.number().nullable() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdmin(user.role);
    await db.client.update({
      where: { id: input.clientId },
      data: { defaultSiteLeadId: input.siteLeadId },
    });
    return { ok: true };
  });

export const adminListBuildingSiteLeadDefaults = baseProcedure
  .input(z.object({ token: z.string(), clientId: z.number().optional() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdmin(user.role);

    const buildings = await db.clientBuilding.findMany({
      where: input.clientId ? { clientId: input.clientId } : undefined,
      select: {
        id: true, name: true, address: true, clientId: true,
        client: {
          select: {
            id: true, name: true,
            defaultSiteLeadId: true,
            defaultSiteLead: { select: { firstName: true, lastName: true } },
          },
        },
        defaultSiteLeadId: true,
        defaultSiteLead: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ client: { name: "asc" } }, { name: "asc" }],
    });
    return buildings.map((b) => ({
      id: b.id,
      name: b.name,
      address: b.address,
      clientId: b.clientId,
      clientName: b.client.name,
      buildingDefaultSiteLeadId: b.defaultSiteLeadId,
      buildingDefaultSiteLeadName: b.defaultSiteLead
        ? `${b.defaultSiteLead.firstName} ${b.defaultSiteLead.lastName}`.trim()
        : null,
      clientDefaultSiteLeadId: b.client.defaultSiteLeadId,
      clientDefaultSiteLeadName: b.client.defaultSiteLead
        ? `${b.client.defaultSiteLead.firstName} ${b.client.defaultSiteLead.lastName}`.trim()
        : null,
    }));
  });

export const adminSetBuildingDefaultSiteLead = baseProcedure
  .input(z.object({ token: z.string(), clientBuildingId: z.number(), siteLeadId: z.number().nullable() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdmin(user.role);
    await db.clientBuilding.update({
      where: { id: input.clientBuildingId },
      data: { defaultSiteLeadId: input.siteLeadId },
    });
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// OPS MANAGER
// ---------------------------------------------------------------------------

export const adminListOpsManagers = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdmin(user.role);

    const users = await db.user.findMany({
      where: {
        commissionRules: {
          some: {
            role: "OPS_MANAGER",
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
          },
        },
      },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
    return users.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`.trim(),
      email: u.email,
      role: u.role,
    }));
  });

export const adminListUserOpsManagerDefaults = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdmin(user.role);

    const users = await db.user.findMany({
      where: {
        isActive: true,
        role: { in: ["ARTISAN", "TECHNICAL_MANAGER", "MANAGER", "JUNIOR_ADMIN", "SENIOR_ADMIN"] as any },
      },
      select: {
        id: true, firstName: true, lastName: true, email: true, role: true,
        defaultOpsManagerId: true,
        defaultOpsManager: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ firstName: "asc" }],
    });
    return users.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`.trim(),
      email: u.email,
      role: u.role,
      defaultOpsManagerId: u.defaultOpsManagerId,
      defaultOpsManagerName: u.defaultOpsManager
        ? `${u.defaultOpsManager.firstName} ${u.defaultOpsManager.lastName}`.trim()
        : null,
    }));
  });

export const adminSetUserDefaultOpsManager = baseProcedure
  .input(z.object({ token: z.string(), userId: z.number(), opsManagerId: z.number().nullable() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdmin(user.role);
    await db.user.update({
      where: { id: input.userId },
      data: { defaultOpsManagerId: input.opsManagerId },
    });
    return { ok: true };
  });

export const adminListClientOpsManagerDefaults = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdmin(user.role);

    const clients = await db.client.findMany({
      select: {
        id: true, name: true, companyName: true, email: true,
        defaultOpsManagerId: true,
        defaultOpsManager: { select: { firstName: true, lastName: true } },
        _count: { select: { buildings: true, orders: true } },
      },
      orderBy: [{ name: "asc" }],
    });
    return clients.map((c) => ({
      id: c.id,
      name: c.name,
      companyName: c.companyName,
      email: c.email,
      defaultOpsManagerId: c.defaultOpsManagerId,
      defaultOpsManagerName: c.defaultOpsManager
        ? `${c.defaultOpsManager.firstName} ${c.defaultOpsManager.lastName}`.trim()
        : null,
      buildingCount: c._count.buildings,
      orderCount: c._count.orders,
    }));
  });

export const adminSetClientDefaultOpsManager = baseProcedure
  .input(z.object({ token: z.string(), clientId: z.number(), opsManagerId: z.number().nullable() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdmin(user.role);
    await db.client.update({
      where: { id: input.clientId },
      data: { defaultOpsManagerId: input.opsManagerId },
    });
    return { ok: true };
  });

export const adminListBuildingOpsManagerDefaults = baseProcedure
  .input(z.object({ token: z.string(), clientId: z.number().optional() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdmin(user.role);

    const buildings = await db.clientBuilding.findMany({
      where: input.clientId ? { clientId: input.clientId } : undefined,
      select: {
        id: true, name: true, address: true, clientId: true,
        client: {
          select: {
            id: true, name: true,
            defaultOpsManagerId: true,
            defaultOpsManager: { select: { firstName: true, lastName: true } },
          },
        },
        defaultOpsManagerId: true,
        defaultOpsManager: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ client: { name: "asc" } }, { name: "asc" }],
    });
    return buildings.map((b) => ({
      id: b.id,
      name: b.name,
      address: b.address,
      clientId: b.clientId,
      clientName: b.client.name,
      buildingDefaultOpsManagerId: b.defaultOpsManagerId,
      buildingDefaultOpsManagerName: b.defaultOpsManager
        ? `${b.defaultOpsManager.firstName} ${b.defaultOpsManager.lastName}`.trim()
        : null,
      clientDefaultOpsManagerId: b.client.defaultOpsManagerId,
      clientDefaultOpsManagerName: b.client.defaultOpsManager
        ? `${b.client.defaultOpsManager.firstName} ${b.client.defaultOpsManager.lastName}`.trim()
        : null,
    }));
  });

export const adminSetBuildingDefaultOpsManager = baseProcedure
  .input(z.object({ token: z.string(), clientBuildingId: z.number(), opsManagerId: z.number().nullable() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdmin(user.role);
    await db.clientBuilding.update({
      where: { id: input.clientBuildingId },
      data: { defaultOpsManagerId: input.opsManagerId },
    });
    return { ok: true };
  });


// ---------------------------------------------------------------------------
// PUBLIC (artisan-facing) � feed the pickers on job-start wizard
// ---------------------------------------------------------------------------

/**
 * PR-8 F � Populate <SiteLeadPicker> for artisans starting a job.
 *
 * Combined "Site Lead / Technical Manager / Ops Manager" pool: returns every
 * user with an active `CommissionRule` where role is SITE_LEAD, TM **or**
 * OPS_MANAGER. This lets the artisan pick a single supervisor for the job,
 * and whoever they pick will have this job land on their statement (see
 * `artisanCreateOrder`, which mirrors the picked id to `technicalManagerId`,
 * `siteLeadId` and `opsManagerId` when those are not separately supplied).
 *
 * Pre-selects the caller's `defaultSiteLeadId`, falling back to their
 * `defaultTechnicalManagerId` and then `defaultOpsManagerId` so the common
 * case is a single tap.
 */
export const getActiveSiteLeads = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const me = await authenticateUser(input.token);
    const now = new Date();
    const myDefault = await db.user.findUnique({
      where: { id: me.id },
      select: {
        defaultSiteLeadId: true,
        defaultTechnicalManagerId: true,
        defaultOpsManagerId: true,
      },
    });
    const users = await db.user.findMany({
      where: {
        commissionRules: {
          some: {
            role: { in: ["SITE_LEAD", "TM", "OPS_MANAGER"] as any },
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
          },
        },
      },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
    return {
      suggestedId:
        myDefault?.defaultSiteLeadId ??
        myDefault?.defaultTechnicalManagerId ??
        myDefault?.defaultOpsManagerId ??
        null,
      siteLeads: users.map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`.trim() || u.email,
        email: u.email,
        role: u.role,
      })),
    };
  });

/**
 * PR-8 F � Populate <OpsManagerPicker> for artisans starting a job.
 * Returns every user with an active `CommissionRule` where role="OPS_MANAGER"
 * plus the caller's own `defaultOpsManagerId` for pre-selection.
 */
export const getActiveOpsManagers = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const me = await authenticateUser(input.token);
    const now = new Date();
    const myDefault = await db.user.findUnique({
      where: { id: me.id },
      select: { defaultOpsManagerId: true },
    });
    const users = await db.user.findMany({
      where: {
        commissionRules: {
          some: {
            role: "OPS_MANAGER",
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
          },
        },
      },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
    return {
      suggestedId: myDefault?.defaultOpsManagerId ?? null,
      opsManagers: users.map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`.trim() || u.email,
        email: u.email,
        role: u.role,
      })),
    };
  });