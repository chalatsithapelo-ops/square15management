// PR-6 — Multi-artisan crew procedures.
// Lets multiple artisans collaborate on one Order, while keeping a single source
// of truth: 1 LEAD + 0..N CREW per Order. The LEAD is the only one allowed to
// mark the job COMPLETED, which guarantees admin sees one clean order per job.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { createNotification } from "~/server/utils/notifications";
import {
  userIsLeadOfOrder,
  userIsOnOrderCrew,
  computeLabourBreakdown,
  generateUniqueJoinCode,
} from "~/server/utils/orderAccess";
import {
  haversineMeters,
  DEFAULT_GEOFENCE_METERS,
  JOIN_CODE_TTL_MINUTES,
  joinCodeExpiryFromNow,
  isValidCoord,
} from "~/server/utils/geo";

function ensureArtisanOrContractor(role: string) {
  if (role !== "ARTISAN" && role !== "CONTRACTOR") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Artisan or contractor only" });
  }
}

/** Return crew roster + live labour breakdown for an order. Open to any active crew member or admin. */
export const artisanGetCrew = baseProcedure
  .input(z.object({ token: z.string(), orderId: z.number() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const order = await db.order.findUnique({
      where: { id: input.orderId },
      select: { id: true, orderNumber: true, joinCode: true, joinCodeExpiresAt: true, status: true, assignedToId: true, siteLat: true, siteLng: true },
    });
    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

    const isAdminTier = ["ADMIN", "SENIOR_ADMIN", "JUNIOR_ADMIN", "MANAGER", "TECHNICAL_MANAGER"].includes(user.role);
    const onCrew = await userIsOnOrderCrew(order.id, user.id);
    const isLegacyAssigned = order.assignedToId === user.id;
    if (!isAdminTier && !onCrew && !isLegacyAssigned) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not on this job" });
    }

    const crew = await db.orderCrew.findMany({
      where: { orderId: order.id },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    });

    const { rows: breakdown, grandTotal } = await computeLabourBreakdown(order.id);

    // Only the LEAD (or admin) sees the join code
    const isLead = await userIsLeadOfOrder(order.id, user.id);
    const showJoinCode = isAdminTier || isLead;

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      joinCode: showJoinCode ? order.joinCode : null,
      joinCodeExpiresAt: showJoinCode ? order.joinCodeExpiresAt : null,
      siteLat: order.siteLat,
      siteLng: order.siteLng,
      geofenceMeters: DEFAULT_GEOFENCE_METERS,
      crew: crew.map((c) => ({
        id: c.id,
        userId: c.userId,
        name: `${c.user.firstName} ${c.user.lastName}`.trim(),
        email: c.user.email,
        role: c.role,
        hourlyRate: c.hourlyRate,
        dailyRate: c.dailyRate,
        joinedAt: c.joinedAt,
        leftAt: c.leftAt,
        ssraAckedAt: c.ssraAckedAt,
        joinLat: c.joinLat,
        joinLng: c.joinLng,
        joinDistanceMeters: c.joinDistanceMeters,
      })),
      labourBreakdown: breakdown,
      labourTotal: grandTotal,
    };
  });

/** Artisan/contractor joins an existing active order via 6-digit code.
 *  Anti-collusion controls:
 *   - Code TTL: rejects expired codes.
 *   - Single-use: successful join nulls the code (lead can regenerate).
 *   - Geofence: if site coords are set and joiner provides GPS, reject when >200m away.
 *     If site coords are NOT set, the first joiner's coords become the site anchor.
 *   - One active job at a time: rejects if user already has another IN_PROGRESS job.
 */
export const artisanJoinByCode = baseProcedure
  .input(z.object({
    token: z.string(),
    joinCode: z.string().regex(/^\d{6}$/),
    lat: z.number().optional(),
    lng: z.number().optional(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureArtisanOrContractor(user.role);

    const order = await db.order.findFirst({
      where: { joinCode: input.joinCode, status: { notIn: ["COMPLETED", "CANCELLED"] as any } },
    });
    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "No active job found for that code" });

    // TTL check
    if (order.joinCodeExpiresAt && order.joinCodeExpiresAt.getTime() < Date.now()) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This code has expired. Ask the lead artisan to generate a new one.",
      });
    }

    // One-active-job check (excluding this order). Instead of hard-blocking, we
    // surface the active jobs to the caller so the UI can offer to pause them
    // and then retry the join.
    const activeCrewMemberships = await db.orderCrew.findMany({
      where: {
        userId: user.id,
        leftAt: null,
        orderId: { not: order.id },
        order: { status: { in: ["IN_PROGRESS", "ASSIGNED", "SELF_INITIATED", "AWAITING_ORDER_NUMBER"] as any } },
      },
      select: {
        role: true,
        order: { select: { id: true, orderNumber: true, status: true } },
      },
    });
    const activeAssignedOrders = await db.order.findMany({
      where: {
        id: { not: order.id },
        assignedToId: user.id,
        status: { in: ["IN_PROGRESS", "ASSIGNED"] as any },
      },
      select: { id: true, orderNumber: true, status: true },
    });
    const activeJobsMap = new Map<number, { orderId: number; orderNumber: string; status: string; role: string }>();
    for (const c of activeCrewMemberships) {
      if (!c.order) continue;
      activeJobsMap.set(c.order.id, {
        orderId: c.order.id,
        orderNumber: c.order.orderNumber,
        status: c.order.status,
        role: c.role,
      });
    }
    for (const o of activeAssignedOrders) {
      if (!activeJobsMap.has(o.id)) {
        activeJobsMap.set(o.id, { orderId: o.id, orderNumber: o.orderNumber, status: o.status, role: "ASSIGNED" });
      }
    }
    const activeJobs = Array.from(activeJobsMap.values());
    if (activeJobs.length > 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `You have ${activeJobs.length} active job${activeJobs.length === 1 ? "" : "s"} (${activeJobs.map((j) => j.orderNumber).join(", ")}). Pause ${activeJobs.length === 1 ? "it" : "them"} before joining a new one.`,
        cause: { reason: "ACTIVE_JOB_EXISTS", activeJobs } as any,
      });
    }

    const hasJoinerCoords = isValidCoord(input.lat) && isValidCoord(input.lng);
    let distanceMeters: number | null = null;
    let anchorSite = false;

    if (order.siteLat != null && order.siteLng != null && hasJoinerCoords) {
      distanceMeters = haversineMeters(order.siteLat, order.siteLng, input.lat!, input.lng!);
      if (distanceMeters > DEFAULT_GEOFENCE_METERS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `You appear to be ~${Math.round(distanceMeters)}m from the job site. You must be within ${DEFAULT_GEOFENCE_METERS}m to join.`,
        });
      }
    } else if ((order.siteLat == null || order.siteLng == null) && hasJoinerCoords) {
      // First joiner with GPS — anchor the site to their coordinates.
      anchorSite = true;
    }

    // If already on crew, reactivate (respect same anti-collusion checks above)
    const existing = await db.orderCrew.findUnique({
      where: { orderId_userId: { orderId: order.id, userId: user.id } },
    });
    if (existing) {
      if (existing.leftAt) {
        await db.orderCrew.update({
          where: { id: existing.id },
          data: {
            leftAt: null,
            joinedAt: new Date(),
            joinLat: hasJoinerCoords ? input.lat! : existing.joinLat,
            joinLng: hasJoinerCoords ? input.lng! : existing.joinLng,
            joinDistanceMeters: distanceMeters ?? existing.joinDistanceMeters,
          },
        });
      }
      // Even for re-joins, invalidate code (single-use)
      await db.order.update({
        where: { id: order.id },
        data: {
          joinCode: null,
          joinCodeExpiresAt: null,
          ...(anchorSite ? { siteLat: input.lat!, siteLng: input.lng! } : {}),
        },
      });
      return { orderId: order.id, orderNumber: order.orderNumber, alreadyOnCrew: true, distanceMeters };
    }

    // Snapshot rate at join time
    const me = await db.user.findUnique({
      where: { id: user.id },
      select: { hourlyRate: true, dailyRate: true, firstName: true, lastName: true },
    });

    await db.orderCrew.create({
      data: {
        orderId: order.id,
        userId: user.id,
        role: "CREW",
        hourlyRate: me?.hourlyRate ?? null,
        dailyRate: me?.dailyRate ?? null,
        joinLat: hasJoinerCoords ? input.lat! : null,
        joinLng: hasJoinerCoords ? input.lng! : null,
        joinDistanceMeters: distanceMeters,
      },
    });

    // Single-use: invalidate the code, and optionally anchor site coords.
    await db.order.update({
      where: { id: order.id },
      data: {
        joinCode: null,
        joinCodeExpiresAt: null,
        ...(anchorSite ? { siteLat: input.lat!, siteLng: input.lng! } : {}),
      },
    });

    // Notify the lead
    if (order.assignedToId) {
      try {
        const distMsg = distanceMeters != null ? ` (≈${Math.round(distanceMeters)}m from site)` : "";
        await createNotification({
          recipientId: order.assignedToId,
          recipientRole: "ARTISAN",
          message: `${me?.firstName ?? "Someone"} ${me?.lastName ?? ""} joined your job ${order.orderNumber} as crew${distMsg}.`.trim(),
          type: "ARTISAN_SELF_INITIATED_JOB" as any,
          relatedEntityId: order.id,
          relatedEntityType: "Order",
        });
      } catch {}
    }

    return { orderId: order.id, orderNumber: order.orderNumber, alreadyOnCrew: false, distanceMeters };
  });

/** Soft-leave the crew (preserves history; their JobActivity entries remain attributed). */
export const artisanLeaveOrder = baseProcedure
  .input(z.object({ token: z.string(), orderId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const crew = await db.orderCrew.findUnique({
      where: { orderId_userId: { orderId: input.orderId, userId: user.id } },
    });
    if (!crew) throw new TRPCError({ code: "NOT_FOUND", message: "You are not on this crew" });
    if (crew.role === "LEAD") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "The lead cannot leave — transfer leadership first or cancel the job" });
    }

    await db.orderCrew.update({
      where: { id: crew.id },
      data: { leftAt: new Date() },
    });

    return { ok: true };
  });

/** Crew member acknowledges that they were briefed on the SSRA. Required before they can clock time. */
export const artisanAckSsra = baseProcedure
  .input(z.object({ token: z.string(), orderId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const crew = await db.orderCrew.findUnique({
      where: { orderId_userId: { orderId: input.orderId, userId: user.id } },
    });
    if (!crew) throw new TRPCError({ code: "NOT_FOUND", message: "You are not on this crew" });

    const updated = await db.orderCrew.update({
      where: { id: crew.id },
      data: { ssraAckedAt: new Date() },
    });

    return { ok: true, ssraAckedAt: updated.ssraAckedAt };
  });

/** Lead regenerates the join code with a fresh TTL (e.g. if it expired or leaked). */
export const artisanRegenerateJoinCode = baseProcedure
  .input(z.object({ token: z.string(), orderId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const isLead = await userIsLeadOfOrder(input.orderId, user.id);
    const isAdmin = ["ADMIN", "SENIOR_ADMIN", "JUNIOR_ADMIN", "MANAGER", "TECHNICAL_MANAGER"].includes(user.role);
    if (!isLead && !isAdmin) throw new TRPCError({ code: "FORBIDDEN", message: "Only the lead or an admin can regenerate the join code" });

    const code = await generateUniqueJoinCode();
    const expiresAt = joinCodeExpiryFromNow();
    await db.order.update({
      where: { id: input.orderId },
      data: { joinCode: code, joinCodeExpiresAt: expiresAt },
    });
    return { joinCode: code, expiresAt, ttlMinutes: JOIN_CODE_TTL_MINUTES };
  });

/** Admin-only crew presence report for an order. Shows who joined, where, and how far from site. */
export const adminGetOrderCrewPresence = baseProcedure
  .input(z.object({ token: z.string(), orderId: z.number() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!["ADMIN", "SENIOR_ADMIN", "JUNIOR_ADMIN", "MANAGER", "TECHNICAL_MANAGER"].includes(user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
    }

    const order = await db.order.findUnique({
      where: { id: input.orderId },
      select: {
        id: true,
        orderNumber: true,
        siteLat: true,
        siteLng: true,
        address: true,
        joinCode: true,
        joinCodeExpiresAt: true,
      },
    });
    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

    const crew = await db.orderCrew.findMany({
      where: { orderId: order.id },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      address: order.address,
      siteLat: order.siteLat,
      siteLng: order.siteLng,
      geofenceMeters: DEFAULT_GEOFENCE_METERS,
      joinCode: order.joinCode,
      joinCodeExpiresAt: order.joinCodeExpiresAt,
      crew: crew.map((c) => ({
        id: c.id,
        userId: c.userId,
        name: `${c.user.firstName} ${c.user.lastName}`.trim(),
        email: c.user.email,
        userRole: c.user.role,
        role: c.role,
        joinedAt: c.joinedAt,
        leftAt: c.leftAt,
        joinLat: c.joinLat,
        joinLng: c.joinLng,
        joinDistanceMeters: c.joinDistanceMeters,
        outOfRange:
          c.joinDistanceMeters != null && c.joinDistanceMeters > DEFAULT_GEOFENCE_METERS,
        hasGeo: c.joinLat != null && c.joinLng != null,
      })),
    };
  });

/** List orders the current artisan/contractor is participating in (lead or crew, active only). */
export const artisanGetMyCrewOrders = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const memberships = await db.orderCrew.findMany({
      where: {
        userId: user.id,
        leftAt: null,
        order: { status: { notIn: ["COMPLETED", "CANCELLED"] as any } },
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            serviceType: true,
            status: true,
            address: true,
            clientBuilding: { select: { id: true, name: true, address: true } },
            joinCode: true,
            joinCodeExpiresAt: true,
            assignedToId: true,
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });

    return memberships.map((m) => ({
      orderId: m.orderId,
      orderNumber: m.order.orderNumber,
      serviceType: m.order.serviceType,
      status: m.order.status,
      address: m.order.address,
      building: m.order.clientBuilding,
      role: m.role,
      joinedAt: m.joinedAt,
      ssraAckedAt: m.ssraAckedAt,
      joinCode: m.role === "LEAD" ? m.order.joinCode : null,
      joinCodeExpiresAt: m.role === "LEAD" ? m.order.joinCodeExpiresAt : null,
    }));
  });
