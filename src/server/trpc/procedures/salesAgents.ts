// PR-8 E — Sales Agent defaults management (parallel to technicalManagers.ts).
//
// Exposes:
//   • adminListSalesAgents           — list users eligible to be assigned as sales agent
//   • adminListClientSalesAgentDefaults — clients + their current default sales agent
//   • adminListBuildingSalesAgentDefaults — buildings + their current default sales agent
//   • adminSetClientDefaultSalesAgent   — mutate Client.defaultSalesAgentId
//   • adminSetBuildingDefaultSalesAgent — mutate ClientBuilding.defaultSalesAgentId

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

/** List users eligible to be Sales Agent: anyone with an active CommissionRule of role="SALES_AGENT". */
export const adminListSalesAgents = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdmin(user.role);

    const users = await db.user.findMany({
      where: {
        commissionRules: {
          some: {
            role: "SALES_AGENT",
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

/** All clients with their current default sales agent (null-friendly). */
export const adminListClientSalesAgentDefaults = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdmin(user.role);

    const clients = await db.client.findMany({
      select: {
        id: true,
        name: true,
        companyName: true,
        email: true,
        defaultSalesAgentId: true,
        defaultSalesAgent: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        _count: { select: { buildings: true, orders: true } },
      },
      orderBy: [{ name: "asc" }],
    });

    return clients.map((c) => ({
      id: c.id,
      name: c.name,
      companyName: c.companyName,
      email: c.email,
      defaultSalesAgentId: c.defaultSalesAgentId,
      defaultSalesAgentName: c.defaultSalesAgent
        ? `${c.defaultSalesAgent.firstName} ${c.defaultSalesAgent.lastName}`.trim()
        : null,
      buildingCount: c._count.buildings,
      orderCount: c._count.orders,
    }));
  });

/** All buildings with their current default sales agent + inherited client default. */
export const adminListBuildingSalesAgentDefaults = baseProcedure
  .input(z.object({ token: z.string(), clientId: z.number().optional() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdmin(user.role);

    const buildings = await db.clientBuilding.findMany({
      where: input.clientId ? { clientId: input.clientId } : undefined,
      select: {
        id: true,
        name: true,
        address: true,
        clientId: true,
        client: {
          select: {
            id: true,
            name: true,
            defaultSalesAgentId: true,
            defaultSalesAgent: { select: { firstName: true, lastName: true } },
          },
        },
        defaultSalesAgentId: true,
        defaultSalesAgent: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ client: { name: "asc" } }, { name: "asc" }],
    });

    return buildings.map((b) => ({
      id: b.id,
      name: b.name,
      address: b.address,
      clientId: b.clientId,
      clientName: b.client.name,
      buildingDefaultSalesAgentId: b.defaultSalesAgentId,
      buildingDefaultSalesAgentName: b.defaultSalesAgent
        ? `${b.defaultSalesAgent.firstName} ${b.defaultSalesAgent.lastName}`.trim()
        : null,
      clientDefaultSalesAgentId: b.client.defaultSalesAgentId,
      clientDefaultSalesAgentName: b.client.defaultSalesAgent
        ? `${b.client.defaultSalesAgent.firstName} ${b.client.defaultSalesAgent.lastName}`.trim()
        : null,
    }));
  });

export const adminSetClientDefaultSalesAgent = baseProcedure
  .input(z.object({ token: z.string(), clientId: z.number(), salesAgentId: z.number().nullable() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdmin(user.role);

    await db.client.update({
      where: { id: input.clientId },
      data: { defaultSalesAgentId: input.salesAgentId },
    });
    return { ok: true };
  });

export const adminSetBuildingDefaultSalesAgent = baseProcedure
  .input(z.object({ token: z.string(), clientBuildingId: z.number(), salesAgentId: z.number().nullable() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdmin(user.role);

    await db.clientBuilding.update({
      where: { id: input.clientBuildingId },
      data: { defaultSalesAgentId: input.salesAgentId },
    });
    return { ok: true };
  });
