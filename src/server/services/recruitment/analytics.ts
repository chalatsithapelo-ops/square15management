/**
 * Recruitment analytics — funnel, time-in-stage, source ROI, adverse impact, EEA.
 */

import { db } from "~/server/db";

export async function getFunnelReport(params: { jobId?: number; fromDate?: Date; toDate?: Date }) {
  const where: any = { deletedAt: null };
  if (params.jobId) where.jobId = params.jobId;
  if (params.fromDate || params.toDate) {
    where.createdAt = {};
    if (params.fromDate) where.createdAt.gte = params.fromDate;
    if (params.toDate) where.createdAt.lte = params.toDate;
  }

  const apps = await db.application.groupBy({
    by: ["stageBucket"],
    where,
    _count: true,
  });

  const totals: Record<string, number> = {};
  for (const a of apps) totals[a.stageBucket] = a._count;

  const order = [
    "APPLIED",
    "SCREENING",
    "ASSESSMENT",
    "INTERVIEW",
    "OFFER",
    "BACKGROUND_CHECK",
    "HIRED",
  ];
  const funnel = order.map((stage) => ({ stage, count: totals[stage] ?? 0 }));

  // Conversion %
  let max = funnel[0]?.count || 1;
  const withConv = funnel.map((s) => {
    const prev = max || 1;
    max = Math.max(max, s.count);
    return { ...s, conversion: prev > 0 ? Math.round((s.count / prev) * 100) : 0 };
  });

  return {
    funnel: withConv,
    totalApplicants: Object.values(totals).reduce((s, v) => s + v, 0),
    hired: totals["HIRED"] ?? 0,
    rejected: totals["REJECTED"] ?? 0,
    withdrawn: totals["WITHDRAWN"] ?? 0,
  };
}

export async function getTimeInStageReport(params: { jobId?: number }) {
  const where: any = {};
  if (params.jobId) {
    where.application = { jobId: params.jobId };
  }
  const history = await db.applicationStageHistory.findMany({
    where: { ...where, durationHours: { not: null } },
    select: { bucket: true, durationHours: true },
    take: 5000,
  });
  const byStage: Record<string, number[]> = {};
  for (const h of history) {
    if (!byStage[h.bucket]) byStage[h.bucket] = [];
    if (h.durationHours !== null) byStage[h.bucket]!.push(h.durationHours);
  }
  return Object.entries(byStage).map(([bucket, hours]) => ({
    bucket,
    avgHours: Math.round(hours.reduce((s, v) => s + v, 0) / hours.length),
    medianHours: median(hours),
    p90Hours: percentile(hours, 90),
    sampleSize: hours.length,
  }));
}

export async function getTimeToFill(jobId?: number) {
  const where: any = { hiredAt: { not: null }, deletedAt: null };
  if (jobId) where.jobId = jobId;
  const hired = await db.application.findMany({
    where,
    select: { createdAt: true, hiredAt: true, jobId: true },
  });
  if (!hired.length) return { avgDays: 0, medianDays: 0, sampleSize: 0 };
  const days = hired.map(
    (h) => (new Date(h.hiredAt!).getTime() - new Date(h.createdAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  return {
    avgDays: Math.round(days.reduce((s, v) => s + v, 0) / days.length),
    medianDays: Math.round(median(days)),
    sampleSize: days.length,
  };
}

export async function getSourceROI(params: { fromDate?: Date; toDate?: Date }) {
  const where: any = { deletedAt: null };
  if (params.fromDate || params.toDate) {
    where.createdAt = {};
    if (params.fromDate) where.createdAt.gte = params.fromDate;
    if (params.toDate) where.createdAt.lte = params.toDate;
  }
  const apps = await db.application.findMany({
    where,
    select: { sourceChannel: true, stageBucket: true, hiredAt: true },
  });
  const byChannel: Record<string, { total: number; hired: number; inPipeline: number; rejected: number }> = {};
  for (const a of apps) {
    const c = a.sourceChannel;
    if (!byChannel[c]) byChannel[c] = { total: 0, hired: 0, inPipeline: 0, rejected: 0 };
    byChannel[c]!.total++;
    if (a.hiredAt) byChannel[c]!.hired++;
    else if (a.stageBucket === "REJECTED") byChannel[c]!.rejected++;
    else byChannel[c]!.inPipeline++;
  }
  return Object.entries(byChannel).map(([channel, v]) => ({
    channel,
    ...v,
    hireRate: v.total > 0 ? Math.round((v.hired / v.total) * 100) : 0,
  }));
}

export async function getRejectionReasonBreakdown(jobId?: number) {
  const where: any = { rejectionReasonId: { not: null }, deletedAt: null };
  if (jobId) where.jobId = jobId;
  const rows = await db.application.groupBy({
    by: ["rejectionReasonId"],
    where,
    _count: true,
  });
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.rejectionReasonId).filter((x): x is number => x !== null);
  const reasons = await db.rejectionReason.findMany({ where: { id: { in: ids } } });
  const byId = new Map(reasons.map((r) => [r.id, r]));
  return rows.map((r) => ({
    reasonId: r.rejectionReasonId,
    label: r.rejectionReasonId ? byId.get(r.rejectionReasonId)?.label : "Unknown",
    category: r.rejectionReasonId ? byId.get(r.rejectionReasonId)?.category : "UNKNOWN",
    count: r._count,
  }));
}

export async function getAdverseImpactReport(params: { jobId?: number; decision?: "HIRED" | "REJECTED" }) {
  // 4/5ths rule on hire rates by demographic group
  const where: any = { deletedAt: null };
  if (params.jobId) where.jobId = params.jobId;

  const apps = await db.application.findMany({
    where,
    include: { demographicProfile: true },
  });

  const groups: Record<string, { total: number; hired: number }> = {};
  for (const a of apps) {
    const race = a.demographicProfile?.race ?? "UNSPECIFIED";
    if (!groups[race]) groups[race] = { total: 0, hired: 0 };
    groups[race]!.total++;
    if (a.hiredAt) groups[race]!.hired++;
  }

  const results = Object.entries(groups).map(([group, v]) => ({
    group,
    total: v.total,
    hired: v.hired,
    rate: v.total > 0 ? v.hired / v.total : 0,
  }));

  const maxRate = Math.max(0, ...results.map((r) => r.rate));
  const withImpact = results.map((r) => ({
    ...r,
    selectionRatio: maxRate > 0 ? r.rate / maxRate : 0,
    adverseImpact: maxRate > 0 && r.total >= 5 && r.rate / maxRate < 0.8,
  }));

  return {
    threshold: 0.8,
    rule: "4/5ths rule (EEOC)",
    groups: withImpact,
    flagged: withImpact.filter((r) => r.adverseImpact).map((r) => r.group),
  };
}

export async function getEEAReport(params: { jobId?: number }) {
  const where: any = { deletedAt: null };
  if (params.jobId) where.jobId = params.jobId;

  const apps = await db.application.findMany({
    where,
    include: { demographicProfile: true },
  });

  const breakdown = {
    byRace: {} as Record<string, number>,
    byGender: {} as Record<string, number>,
    byDisability: {} as Record<string, number>,
    designatedGroupCount: 0,
    totalCount: apps.length,
  };

  for (const a of apps) {
    const d = a.demographicProfile;
    if (!d) continue;
    const race = d.race ?? "UNSPECIFIED";
    breakdown.byRace[race] = (breakdown.byRace[race] ?? 0) + 1;
    const gender = d.gender ?? "UNSPECIFIED";
    breakdown.byGender[gender] = (breakdown.byGender[gender] ?? 0) + 1;
    const dis = d.disability ?? "UNSPECIFIED";
    breakdown.byDisability[dis] = (breakdown.byDisability[dis] ?? 0) + 1;
    if (d.employmentEquityDesignated) breakdown.designatedGroupCount++;
  }

  return breakdown;
}

export async function getRecruiterDashboard(recruiterId: number) {
  const [assigned, overdue, upcomingInterviews, pendingOffers] = await Promise.all([
    db.application.count({
      where: { assignedRecruiterId: recruiterId, deletedAt: null, hiredAt: null, withdrawnAt: null },
    }),
    db.application.count({
      where: {
        assignedRecruiterId: recruiterId,
        deletedAt: null,
        hiredAt: null,
        stageEnteredAt: { lt: new Date(Date.now() - 72 * 3600 * 1000) },
        stageBucket: { notIn: ["HIRED", "REJECTED", "WITHDRAWN"] },
      },
    }),
    db.interviewBooking.count({
      where: {
        scheduledStart: { gte: new Date() },
        status: "SCHEDULED",
        application: { assignedRecruiterId: recruiterId },
      },
    }),
    db.offer.count({
      where: {
        status: { in: ["PENDING_APPROVAL", "SENT", "VIEWED"] },
        application: { assignedRecruiterId: recruiterId },
      },
    }),
  ]);
  return { assigned, overdue, upcomingInterviews, pendingOffers };
}

// ─────── helpers ───────
function median(arr: number[]) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[mid - 1]! + sorted[mid]!) / 2) : sorted[mid]!;
}
function percentile(arr: number[], p: number) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[idx] ?? 0);
}
