// PR-4 — Contractor compliance scoring.
// Takes: a contractor + their docs + the PM's requirements (or SA defaults) + recent incidents.
// Returns: a 0-100 score, a band (GREEN/AMBER/RED), and a per-requirement breakdown.

import { ComplianceBand } from "@prisma/client";

export type ScoringDoc = {
  documentType: string;
  expiryDate: Date | null;
  isRequired: boolean;
};

export type ScoringRequirement = {
  documentType: string;
  customLabel?: string | null;
  weight: number;          // 1..100
  isMandatory: boolean;
};

export type ScoringIncident = {
  occurredAt: Date;
  severity: "MINOR" | "MAJOR" | "FATAL" | "OTHER" | string;
};

export type RequirementOutcome = {
  documentType: string;
  customLabel: string | null;
  weight: number;
  status: "OK" | "EXPIRING_30D" | "EXPIRING_7D" | "EXPIRED" | "MISSING";
  expiryDate: string | null;
  points: number;  // points awarded (can be negative)
};

export type ScoringResult = {
  score: number;
  band: ComplianceBand;
  breakdown: RequirementOutcome[];
  counts: {
    missing: number;
    expired: number;
    expiring30d: number;
    expiring7d: number;
    minorIncidents12mo: number;
    majorIncidents12mo: number;
  };
};

const STATUS_POINTS = {
  OK: 0,            // no penalty
  EXPIRING_30D: -3,
  EXPIRING_7D: -5,
  EXPIRED: -15,
  MISSING: -10,
};

export function computeContractorScore(opts: {
  documents: ScoringDoc[];
  requirements: ScoringRequirement[];
  incidents?: ScoringIncident[];
}): ScoringResult {
  const now = Date.now();
  const docsByType = new Map<string, ScoringDoc>();
  for (const d of opts.documents) {
    // Keep the freshest (latest) doc per type
    const existing = docsByType.get(d.documentType);
    if (!existing || (d.expiryDate && existing.expiryDate && d.expiryDate > existing.expiryDate)) {
      docsByType.set(d.documentType, d);
    } else if (!existing) {
      docsByType.set(d.documentType, d);
    }
  }

  const breakdown: RequirementOutcome[] = [];
  let missing = 0, expired = 0, expiring30d = 0, expiring7d = 0;

  // Start at 100, penalize per failing requirement
  let score = 100;

  for (const req of opts.requirements) {
    const doc = docsByType.get(req.documentType);
    let status: RequirementOutcome["status"];
    let expiry: string | null = null;

    if (!doc) {
      status = "MISSING";
      missing++;
    } else {
      expiry = doc.expiryDate ? doc.expiryDate.toISOString() : null;
      if (!doc.expiryDate) {
        status = "OK";
      } else {
        const daysToExpiry = Math.floor((doc.expiryDate.getTime() - now) / 86400000);
        if (daysToExpiry < 0) { status = "EXPIRED"; expired++; }
        else if (daysToExpiry <= 7) { status = "EXPIRING_7D"; expiring7d++; }
        else if (daysToExpiry <= 30) { status = "EXPIRING_30D"; expiring30d++; }
        else status = "OK";
      }
    }

    // Weight the penalty
    const basePenalty = STATUS_POINTS[status];
    const weightedPenalty = Math.round(basePenalty * (req.weight / 10));
    const points = weightedPenalty;

    if (status !== "OK") {
      score += weightedPenalty;
    }

    breakdown.push({
      documentType: req.documentType,
      customLabel: req.customLabel ?? null,
      weight: req.weight,
      status,
      expiryDate: expiry,
      points,
    });
  }

  // Incident penalties
  const incidents = opts.incidents ?? [];
  const cutoff12mo = now - 365 * 86400000;
  let minor = 0, major = 0;
  for (const inc of incidents) {
    if (inc.occurredAt.getTime() < cutoff12mo) continue;
    if (inc.severity === "MAJOR" || inc.severity === "FATAL") major++;
    else minor++;
  }
  score += -3 * minor;
  score += -8 * major;

  // Bound score
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  const band: ComplianceBand = score >= 80 ? "GREEN" : score >= 50 ? "AMBER" : "RED";

  return {
    score,
    band,
    breakdown,
    counts: {
      missing,
      expired,
      expiring30d,
      expiring7d,
      minorIncidents12mo: minor,
      majorIncidents12mo: major,
    },
  };
}

/** SA default compliance requirements (used when a PM hasn't customised). */
export const SA_DEFAULT_REQUIREMENTS: ScoringRequirement[] = [
  { documentType: "COIDA_LETTER",            weight: 10, isMandatory: true },
  { documentType: "TAX_CLEARANCE",           weight: 10, isMandatory: true },
  { documentType: "PUBLIC_LIABILITY",        weight: 10, isMandatory: true },
  { documentType: "LETTER_OF_GOOD_STANDING", weight: 8,  isMandatory: true },
  { documentType: "BBBEE_CERT",              weight: 5,  isMandatory: false },
  { documentType: "ID_DOCUMENT",             weight: 7,  isMandatory: true },
  { documentType: "CIPC_REGISTRATION",       weight: 5,  isMandatory: false },
  { documentType: "SAFETY_FILE",             weight: 8,  isMandatory: true },
];
