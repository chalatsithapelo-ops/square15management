/**
 * Pricing Catalog (Pricing Library) — core helpers.
 *
 * The catalog is built on top of LineItemTemplate. Items have a `source`:
 *   - MANUAL              : user-created template (always trusted / Verified)
 *   - LEARNED_FROM_QUOTE  : absorbed from an APPROVED quotation
 *   - LEARNED_FROM_INVOICE: absorbed from a PAID / FINALISED invoice
 *
 * The TM curates LEARNED items into "Verified" so juniors can rely on them.
 */

import type { PrismaClient } from "@prisma/client";
import { db as defaultDb } from "~/server/db";

export const PRICING_DEVIATION_THRESHOLD = 0.2; // ±20% triggers a warning
export const PRICING_HISTORY_LIMIT = 20;

export interface PriceSample {
  price: number;
  qty: number;
  quoteNumber?: string;
  invoiceNumber?: string;
  customerName?: string;
  customerEmail?: string;
  clientId?: number | null;
  clientBuildingId?: number | null;
  approvedAt: string;
  approvedById?: number | null;
}

export interface CatalogQuotationLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total?: number;
  unitOfMeasure?: string;
}

/** Produce a normalised key used to de-duplicate line items by description. */
export function normaliseDescription(desc: string): string {
  return (desc || "")
    .toLowerCase()
    .replace(/[\u2018\u2019\u201C\u201D]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Build a human-friendly short name from a description (first 60 chars). */
export function descriptionToName(desc: string): string {
  const trimmed = (desc || "").trim().replace(/\s+/g, " ");
  if (trimmed.length <= 60) return trimmed;
  return trimmed.slice(0, 57) + "...";
}

/** Compute simple rolling stats from a list of samples. */
function computeStats(samples: PriceSample[]) {
  if (samples.length === 0) return { avg: null, min: null, max: null };
  const prices = samples.map((s) => Number(s.price)).filter((n) => Number.isFinite(n) && n > 0);
  if (prices.length === 0) return { avg: null, min: null, max: null };
  const sum = prices.reduce((a, b) => a + b, 0);
  return {
    avg: sum / prices.length,
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
}

interface AbsorbContext {
  source: "LEARNED_FROM_QUOTE" | "LEARNED_FROM_INVOICE";
  quoteNumber?: string;
  invoiceNumber?: string;
  customerName?: string;
  customerEmail?: string;
  clientId?: number | null;
  clientBuildingId?: number | null;
  approvedById?: number | null;
  approvedAt?: Date;
}

/**
 * Absorb a list of approved line items into the catalog.
 * - Finds-or-creates a LineItemTemplate keyed by normalised description.
 * - Appends a price sample (keeping last 20).
 * - Recomputes avg/min/max.
 * - Bumps usageCount + lastUsedAt + lastApprovedBy.
 *
 * Also writes per-client/per-building pricing memory.
 *
 * Safe to call multiple times (idempotent within a single transaction).
 */
export async function absorbLineItemsIntoCatalog(
  items: CatalogQuotationLineItem[],
  ctx: AbsorbContext,
  prisma: PrismaClient = defaultDb,
): Promise<{ absorbed: number; created: number; updated: number }> {
  let absorbed = 0;
  let created = 0;
  let updated = 0;

  const approvedAt = ctx.approvedAt ?? new Date();

  for (const raw of items) {
    const description = (raw.description || "").trim();
    const unitPrice = Number(raw.unitPrice);
    const qty = Number(raw.quantity || 1);
    if (!description || !Number.isFinite(unitPrice) || unitPrice <= 0) continue;

    const key = normaliseDescription(description);
    if (!key) continue;

    const unitOfMeasure = raw.unitOfMeasure || "Sum";
    const sample: PriceSample = {
      price: unitPrice,
      qty,
      quoteNumber: ctx.quoteNumber,
      invoiceNumber: ctx.invoiceNumber,
      customerName: ctx.customerName,
      customerEmail: ctx.customerEmail,
      clientId: ctx.clientId ?? null,
      clientBuildingId: ctx.clientBuildingId ?? null,
      approvedAt: approvedAt.toISOString(),
      approvedById: ctx.approvedById ?? null,
    };

    // ─── 1. Catalog item ────────────────────────────────────────────────
    // Search by normalised description across LEARNED + MANUAL items so we
    // don't duplicate when a TM has already created the equivalent template.
    // PG doesn't have a native normalised column for it, so we fall back to a
    // case-insensitive description match plus a small post-filter.
    const candidates = await prisma.lineItemTemplate.findMany({
      where: {
        description: { equals: description, mode: "insensitive" },
        unitOfMeasure,
      },
      take: 5,
    });
    let existing = candidates.find((c) => normaliseDescription(c.description) === key) ?? null;

    if (existing) {
      const prior = (existing.priceSamples as unknown as PriceSample[]) || [];
      const nextSamples = [...prior, sample].slice(-PRICING_HISTORY_LIMIT);
      const stats = computeStats(nextSamples);

      await prisma.lineItemTemplate.update({
        where: { id: existing.id },
        data: {
          // Don't overwrite a MANUAL unitPrice — the TM's saved value is canonical.
          // But always keep stats fresh.
          unitPrice: existing.source === "MANUAL" ? existing.unitPrice : unitPrice,
          priceSamples: nextSamples as unknown as object,
          avgUnitPrice: stats.avg ?? existing.avgUnitPrice,
          minUnitPrice: stats.min ?? existing.minUnitPrice,
          maxUnitPrice: stats.max ?? existing.maxUnitPrice,
          usageCount: { increment: 1 },
          lastUsedAt: approvedAt,
          lastApprovedById: ctx.approvedById ?? existing.lastApprovedById,
        },
      });
      updated++;
    } else {
      const stats = computeStats([sample]);
      existing = await prisma.lineItemTemplate.create({
        data: {
          name: descriptionToName(description),
          description,
          unitPrice,
          unitOfMeasure,
          category: null,
          isActive: true,
          source: ctx.source,
          isVerified: false,
          defaultCost: 0,
          usageCount: 1,
          lastUsedAt: approvedAt,
          avgUnitPrice: stats.avg,
          minUnitPrice: stats.min,
          maxUnitPrice: stats.max,
          priceSamples: [sample] as unknown as object,
          tags: [],
          lastApprovedById: ctx.approvedById ?? null,
          createdById: ctx.approvedById ?? null,
        },
      });
      created++;
    }
    absorbed++;

    // ─── 2. Per-client / per-building memory ─────────────────────────────
    if (ctx.clientId || ctx.clientBuildingId) {
      const memKeyWhere = {
        clientId: ctx.clientId ?? null,
        clientBuildingId: ctx.clientBuildingId ?? null,
        descriptionKey: key,
      };
      const memExisting = await prisma.clientPricingMemory.findFirst({ where: memKeyWhere });
      if (memExisting) {
        const newCount = memExisting.usageCount + 1;
        const newAvg =
          (memExisting.avgUnitPrice * memExisting.usageCount + unitPrice) / newCount;
        await prisma.clientPricingMemory.update({
          where: { id: memExisting.id },
          data: {
            lastUnitPrice: unitPrice,
            avgUnitPrice: newAvg,
            minUnitPrice: Math.min(memExisting.minUnitPrice, unitPrice),
            maxUnitPrice: Math.max(memExisting.maxUnitPrice, unitPrice),
            usageCount: newCount,
            lastUsedAt: approvedAt,
            catalogItemId: existing.id,
            unitOfMeasure,
          },
        });
      } else {
        await prisma.clientPricingMemory.create({
          data: {
            clientId: ctx.clientId ?? null,
            clientBuildingId: ctx.clientBuildingId ?? null,
            descriptionKey: key,
            description,
            unitOfMeasure,
            lastUnitPrice: unitPrice,
            avgUnitPrice: unitPrice,
            minUnitPrice: unitPrice,
            maxUnitPrice: unitPrice,
            usageCount: 1,
            lastUsedAt: approvedAt,
            catalogItemId: existing.id,
          },
        });
      }
    }
  }

  return { absorbed, created, updated };
}

/** Returns a normalised "deviation" indicator for a proposed price. */
export function computePriceDeviation(
  proposedPrice: number,
  catalogItem: { avgUnitPrice: number | null; unitPrice: number; isVerified: boolean },
):
  | null
  | {
      kind: "below" | "above" | "ok";
      severity: "info" | "warn" | "danger";
      ratio: number;
      reference: number;
      message: string;
    } {
  const ref = catalogItem.avgUnitPrice ?? catalogItem.unitPrice;
  if (!Number.isFinite(ref) || ref <= 0 || !Number.isFinite(proposedPrice) || proposedPrice <= 0) {
    return null;
  }
  const ratio = (proposedPrice - ref) / ref;
  const verifiedLabel = catalogItem.isVerified ? "verified" : "historical";
  if (Math.abs(ratio) < PRICING_DEVIATION_THRESHOLD) {
    return { kind: "ok", severity: "info", ratio, reference: ref, message: "" };
  }
  if (ratio < 0) {
    return {
      kind: "below",
      severity: Math.abs(ratio) > 0.4 ? "danger" : "warn",
      ratio,
      reference: ref,
      message: `Proposed R${proposedPrice.toFixed(2)} is ${(Math.abs(ratio) * 100).toFixed(0)}% below the ${verifiedLabel} price (R${ref.toFixed(2)}).`,
    };
  }
  return {
    kind: "above",
    severity: ratio > 0.5 ? "danger" : "warn",
    ratio,
    reference: ref,
    message: `Proposed R${proposedPrice.toFixed(2)} is ${(ratio * 100).toFixed(0)}% above the ${verifiedLabel} price (R${ref.toFixed(2)}).`,
  };
}

/** Margin floor: returns null if OK, or an explanation if the floor is breached. */
export function checkMarginFloor(opts: {
  subtotal: number;
  totalCost: number;
  floorPct?: number;
}): null | { actualPct: number; floorPct: number; shortfall: number; message: string } {
  const floorPct = opts.floorPct ?? 15;
  if (!Number.isFinite(opts.subtotal) || opts.subtotal <= 0) return null;
  const margin = opts.subtotal - opts.totalCost;
  const actualPct = (margin / opts.subtotal) * 100;
  if (actualPct >= floorPct) return null;
  return {
    actualPct,
    floorPct,
    shortfall: (floorPct / 100) * opts.subtotal - margin,
    message: `Quote margin ${actualPct.toFixed(1)}% is below the required floor of ${floorPct}%. Requires Technical Manager approval.`,
  };
}
