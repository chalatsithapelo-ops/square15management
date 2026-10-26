// PR-6 — Order access + labour cost helpers for multi-artisan crew.
// Centralised so every "is this artisan allowed to act on this Order?" check
// uses the same rule (lead OR active crew member) and labour is computed the same way.

import { db } from "~/server/db";

export type CrewRole = "LEAD" | "CREW";

/** True if the user is the LEAD of the order (active). */
export async function userIsLeadOfOrder(orderId: number, userId: number): Promise<boolean> {
  const row = await db.orderCrew.findFirst({
    where: { orderId, userId, role: "LEAD", leftAt: null },
    select: { id: true },
  });
  return !!row;
}

/** True if the user is on the active crew (lead or crew, leftAt null). */
export async function userIsOnOrderCrew(orderId: number, userId: number): Promise<boolean> {
  const row = await db.orderCrew.findFirst({
    where: { orderId, userId, leftAt: null },
    select: { id: true },
  });
  return !!row;
}

/**
 * Authoritative permission check for any artisan action on an Order.
 * Returns true if the user is the legacy assignedTo, OR on the active OrderCrew.
 * This is intentionally permissive enough to support pre-PR6 orders that have
 * no crew rows yet (the assignedToId acts as implicit LEAD).
 */
export async function userCanActOnOrder(opts: {
  orderId: number;
  userId: number;
  /** Legacy assignedToId from the order (already loaded by caller). */
  assignedToId?: number | null;
}): Promise<boolean> {
  if (opts.assignedToId && opts.assignedToId === opts.userId) return true;
  return userIsOnOrderCrew(opts.orderId, opts.userId);
}

/** Generate a unique 6-digit join code that's not already in use on any active order. */
export async function generateUniqueJoinCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const existing = await db.order.findFirst({
      where: { joinCode: code, status: { notIn: ["COMPLETED", "CANCELLED"] as any } },
      select: { id: true },
    });
    if (!existing) return code;
  }
  // Fallback — extremely unlikely collision after 20 tries
  return String(Date.now()).slice(-6);
}

/**
 * Compute live labour breakdown for an order from JobActivity entries × crew rate snapshots.
 * Returns one row per crew member with totalMinutes, totalCost, and the rate that was used.
 * If a crew member has no hourly rate snapshot we fall back to dailyRate / 8 hours.
 */
export type LabourBreakdownRow = {
  userId: number;
  name: string;
  role: CrewRole;
  totalMinutes: number;
  hourlyRate: number | null;
  dailyRate: number | null;
  totalCost: number;
};

export async function computeLabourBreakdown(orderId: number): Promise<{
  rows: LabourBreakdownRow[];
  grandTotal: number;
}> {
  const crew = await db.orderCrew.findMany({
    where: { orderId },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });

  const activities = await db.jobActivity.findMany({
    where: { orderId },
    select: { artisanId: true, durationMinutes: true, startTime: true, endTime: true },
  });

  // Per-user total minutes (use durationMinutes if present, else compute from start/end)
  const minutesByUser = new Map<number, number>();
  for (const a of activities) {
    const mins =
      typeof a.durationMinutes === "number" && a.durationMinutes > 0
        ? a.durationMinutes
        : a.startTime && a.endTime
        ? Math.max(0, Math.round((a.endTime.getTime() - a.startTime.getTime()) / 60000))
        : 0;
    minutesByUser.set(a.artisanId, (minutesByUser.get(a.artisanId) ?? 0) + mins);
  }

  const rows: LabourBreakdownRow[] = crew.map((c) => {
    const totalMinutes = minutesByUser.get(c.userId) ?? 0;
    let totalCost = 0;
    const hourly = c.hourlyRate ?? null;
    const daily = c.dailyRate ?? null;
    if (hourly && hourly > 0) {
      totalCost = (totalMinutes / 60) * hourly;
    } else if (daily && daily > 0) {
      // dailyRate / 8h
      totalCost = (totalMinutes / 60) * (daily / 8);
    }
    return {
      userId: c.userId,
      name: `${c.user.firstName} ${c.user.lastName}`.trim(),
      role: c.role as CrewRole,
      totalMinutes,
      hourlyRate: hourly,
      dailyRate: daily,
      totalCost: Math.round(totalCost * 100) / 100,
    };
  });

  // Include any artisan who logged time but isn't in OrderCrew (pre-PR6 jobs)
  for (const [userId, totalMinutes] of minutesByUser) {
    if (rows.find((r) => r.userId === userId)) continue;
    rows.push({
      userId,
      name: `User #${userId}`,
      role: "CREW",
      totalMinutes,
      hourlyRate: null,
      dailyRate: null,
      totalCost: 0,
    });
  }

  const grandTotal = Math.round(rows.reduce((s, r) => s + r.totalCost, 0) * 100) / 100;
  return { rows, grandTotal };
}
