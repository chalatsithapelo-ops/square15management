// PR-4 — Compliance checker cron.
// Runs daily at 06:00 UTC (08:00 SAST) and:
// 1. Recomputes ContractorComplianceScore for every active contractor.
// 2. Sends DOC_EXPIRING_30D/7D/EXPIRED notifications + emails (idempotent via flags).
// 3. Auto-blocks contractors whose score < 50 (unless overridden).
// 4. Sends COMPLIANCE_DROPPED notifications when a contractor moves DOWN a band.

import { db } from "~/server/db";
import { sendEmail } from "~/server/utils/email";
import { createNotification } from "~/server/utils/notifications";
import { computeContractorScore, SA_DEFAULT_REQUIREMENTS, type ScoringRequirement } from "~/server/utils/complianceScoring";

export async function runComplianceCheckOnce(): Promise<{ scoredCount: number; remindersSent: number; autoBlocked: number }> {
  const contractors = await db.contractor.findMany({
    where: { status: "ACTIVE" },
    include: {
      documents: { select: { documentType: true, expiryDate: true, isRequired: true } },
      propertyManager: { select: { id: true, email: true, firstName: true, lastName: true } },
      complianceScore: true,
    },
  });

  let scoredCount = 0;
  let remindersSent = 0;
  let autoBlocked = 0;

  for (const c of contractors) {
    let requirements: ScoringRequirement[] = SA_DEFAULT_REQUIREMENTS;

    if (c.propertyManagerId) {
      const pmReqs = await db.pmComplianceRequirement.findMany({
        where: { propertyManagerId: c.propertyManagerId, isActive: true },
      });
      if (pmReqs.length > 0) {
        requirements = pmReqs
          .filter((r) => !r.serviceTypeFilter || r.serviceTypeFilter === c.serviceType)
          .map((r) => ({
            documentType: r.documentType,
            customLabel: r.customLabel,
            weight: r.weight,
            isMandatory: r.isMandatory,
          }));
      }
    }

    // Recent incidents linked to this contractor (where they are the injured user).
    // OhsIncident has a contractor relation via injuredUserId — but Contractor isn't a User.
    // For now we only count documents.
    const result = computeContractorScore({
      documents: c.documents.map((d) => ({
        documentType: d.documentType,
        expiryDate: d.expiryDate,
        isRequired: d.isRequired,
      })),
      requirements,
      incidents: [],
    });

    const prevScore = c.complianceScore?.score ?? null;
    const prevBand = c.complianceScore?.band ?? null;

    await db.contractorComplianceScore.upsert({
      where: { contractorId: c.id },
      create: {
        contractorId: c.id,
        propertyManagerId: c.propertyManagerId,
        score: result.score,
        band: result.band,
        breakdown: result.breakdown as any,
        missingCount: result.counts.missing,
        expiredCount: result.counts.expired,
        expiringCount30d: result.counts.expiring30d,
        expiringCount7d: result.counts.expiring7d,
        incidentsLast12mo: result.counts.minorIncidents12mo + result.counts.majorIncidents12mo,
        majorIncidentsLast12mo: result.counts.majorIncidents12mo,
      },
      update: {
        propertyManagerId: c.propertyManagerId,
        score: result.score,
        band: result.band,
        breakdown: result.breakdown as any,
        missingCount: result.counts.missing,
        expiredCount: result.counts.expired,
        expiringCount30d: result.counts.expiring30d,
        expiringCount7d: result.counts.expiring7d,
        incidentsLast12mo: result.counts.minorIncidents12mo + result.counts.majorIncidents12mo,
        majorIncidentsLast12mo: result.counts.majorIncidents12mo,
        previousScore: prevScore,
        previousBand: prevBand,
        computedAt: new Date(),
      },
    });
    scoredCount++;

    // ---- 2. Document expiry reminders -----------------------------------------
    const now = Date.now();
    const docs = await db.contractorDocument.findMany({
      where: { contractorId: c.id, expiryDate: { not: null } },
    });
    for (const d of docs) {
      if (!d.expiryDate) continue;
      const days = Math.floor((d.expiryDate.getTime() - now) / 86400000);

      const isExpired = days < 0;
      const is7d = days >= 0 && days <= 7;
      const is30d = days > 7 && days <= 30;

      let type: string | null = null;
      let alreadySent = false;
      if (isExpired && !d.reminderSentExpired) { type = "DOC_EXPIRED"; alreadySent = false; }
      else if (is7d && !d.reminderSent7d) { type = "DOC_EXPIRING_7D"; alreadySent = false; }
      else if (is30d && !d.reminderSent30d) { type = "DOC_EXPIRING_30D"; alreadySent = false; }

      if (!type) continue;

      const message =
        type === "DOC_EXPIRED"
          ? `Document "${d.title}" for contractor ${c.firstName} ${c.lastName} EXPIRED on ${d.expiryDate.toISOString().slice(0, 10)}`
          : type === "DOC_EXPIRING_7D"
          ? `Document "${d.title}" for contractor ${c.firstName} ${c.lastName} expires in ${days}d (${d.expiryDate.toISOString().slice(0, 10)})`
          : `Document "${d.title}" for contractor ${c.firstName} ${c.lastName} expires in ${days}d (${d.expiryDate.toISOString().slice(0, 10)})`;

      const recipients: { id: number; email: string; role: string }[] = [];
      if (c.propertyManager) {
        recipients.push({ id: c.propertyManager.id, email: c.propertyManager.email, role: "PROPERTY_MANAGER" });
      }
      const admins = await db.user.findMany({
        where: { role: { in: ["ADMIN", "SENIOR_ADMIN"] } },
        select: { id: true, email: true, role: true },
      });
      for (const a of admins) recipients.push(a);

      for (const r of recipients) {
        try {
          await createNotification({
            recipientId: r.id,
            recipientRole: r.role,
            message,
            type: type as any,
            relatedEntityId: d.id,
            relatedEntityType: "ContractorDocument",
          });
        } catch (e) { console.error("[Compliance] notify failed:", e); }
        try {
          await sendEmail({
            to: r.email,
            subject: `[Compliance] ${message}`,
            html: `<p>${message}</p><p>Please update or replace this document in the contractor compliance section.</p>`,
          });
        } catch (e) { console.error("[Compliance] email failed:", e); }
      }

      await db.contractorDocument.update({
        where: { id: d.id },
        data: {
          reminderSent30d: is30d ? true : d.reminderSent30d,
          reminderSent7d: is7d ? true : d.reminderSent7d,
          reminderSentExpired: isExpired ? true : d.reminderSentExpired,
        },
      });
      remindersSent++;
    }

    // ---- 3. Auto-block / unblock ---------------------------------------------
    const shouldAutoBlock = result.score < 50;
    const overrideActive = c.autoBlockOverride && (!c.autoBlockOverrideUntil || c.autoBlockOverrideUntil.getTime() > now);

    if (shouldAutoBlock && !c.autoBlocked && !overrideActive) {
      await db.contractor.update({
        where: { id: c.id },
        data: { autoBlocked: true, autoBlockedAt: new Date() },
      });
      autoBlocked++;
      if (c.propertyManagerId) {
        try {
          await createNotification({
            recipientId: c.propertyManagerId,
            recipientRole: "PROPERTY_MANAGER",
            message: `Contractor ${c.firstName} ${c.lastName} auto-blocked (compliance score ${result.score}/100).`,
            type: "COMPLIANCE_AUTO_BLOCKED" as any,
            relatedEntityId: c.id,
            relatedEntityType: "Contractor",
          });
        } catch {}
      }
    } else if (!shouldAutoBlock && c.autoBlocked) {
      await db.contractor.update({
        where: { id: c.id },
        data: { autoBlocked: false, autoBlockedAt: null },
      });
    }

    // ---- 4. Band drop notification -------------------------------------------
    if (prevBand && prevBand !== result.band) {
      const dropped = (prevBand === "GREEN" && result.band !== "GREEN") || (prevBand === "AMBER" && result.band === "RED");
      if (dropped && c.propertyManagerId) {
        try {
          await createNotification({
            recipientId: c.propertyManagerId,
            recipientRole: "PROPERTY_MANAGER",
            message: `${c.firstName} ${c.lastName} compliance dropped from ${prevBand} to ${result.band} (score ${result.score}).`,
            type: "COMPLIANCE_DROPPED" as any,
            relatedEntityId: c.id,
            relatedEntityType: "Contractor",
          });
        } catch {}
      }
    }
  }

  console.log(`[Compliance] Scored ${scoredCount} contractors, sent ${remindersSent} reminders, auto-blocked ${autoBlocked}`);
  return { scoredCount, remindersSent, autoBlocked };
}

// --------- Bootstrap scheduler -----------------------------------------------
let _started = false;
export function bootstrapComplianceChecker() {
  if (_started) return;
  if (process.env.COMPLIANCE_CHECKER_ENABLED === "0") return;
  _started = true;

  const checkIntervalMs = 6 * 60 * 60 * 1000; // 6h
  let lastRunDate = "";

  const check = async () => {
    try {
      const now = new Date();
      // SAST = UTC+2; we want roughly 08:00 SAST = 06:00 UTC
      const utcHour = now.getUTCHours();
      const todayKey = now.toISOString().slice(0, 10);
      if (utcHour >= 6 && utcHour < 12 && lastRunDate !== todayKey) {
        await runComplianceCheckOnce();
        lastRunDate = todayKey;
      }
    } catch (e) {
      console.error("[Compliance] checker failed:", e);
    }
  };

  setTimeout(check, 60 * 1000);
  setInterval(check, checkIntervalMs);
  console.log("[Compliance] checker scheduler started (daily 06-12 UTC)");
}
