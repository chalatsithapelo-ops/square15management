/**
 * Pricing Library tRPC procedures.
 *
 * Surfaces:
 *  - searchPricingCatalog        : autocomplete for the quote builder
 *  - getPricingLibrary           : TM curation view
 *  - upsertPricingCatalogItem    : manual create/edit (defaults to verified)
 *  - verifyPricingCatalogItem    : TM-only verify toggle
 *  - deletePricingCatalogItem
 *  - getClientPricingMemory      : per-client recall lookup
 *  - getPricingAnomalies         : drift / margin issues for dashboard
 *  - backfillPricingCatalog      : one-shot import from past approved quotes
 *  - generateScopeFromBrief      : LLM-driven scope drafter grounded in catalog
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import {
  absorbLineItemsIntoCatalog,
  computePriceDeviation,
  normaliseDescription,
  descriptionToName,
  type CatalogQuotationLineItem,
  PRICING_DEVIATION_THRESHOLD,
} from "~/server/utils/pricingCatalog";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";

const ROLES_ALLOWED_TO_VIEW = [
  "SENIOR_ADMIN",
  "JUNIOR_ADMIN",
  "ADMIN",
  "TECHNICAL_MANAGER",
  "MANAGER",
  "ACCOUNTANT",
  "ARTISAN",
  "CONTRACTOR",
  "CONTRACTOR_SENIOR_MANAGER",
  "CONTRACTOR_JUNIOR_MANAGER",
];

const ROLES_ALLOWED_TO_CURATE = [
  "SENIOR_ADMIN",
  "TECHNICAL_MANAGER",
  "MANAGER",
  "ADMIN",
];

function ensureViewAccess(role: string) {
  if (!ROLES_ALLOWED_TO_VIEW.includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not allowed to view pricing library." });
  }
}

function ensureCurateAccess(role: string) {
  if (!ROLES_ALLOWED_TO_CURATE.includes(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only Technical Manager / Senior Admin can curate the pricing library.",
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// searchPricingCatalog — used by the autocomplete in the quote builder
// ────────────────────────────────────────────────────────────────────────────

export const searchPricingCatalog = baseProcedure
  .input(
    z.object({
      token: z.string(),
      query: z.string().default(""),
      limit: z.number().int().min(1).max(20).default(8),
      clientId: z.number().optional().nullable(),
      clientBuildingId: z.number().optional().nullable(),
      category: z.string().optional(),
      verifiedOnly: z.boolean().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureViewAccess(user.role);

    const q = input.query.trim();
    const where: any = { isActive: true };
    if (input.verifiedOnly) where.isVerified = true;
    if (input.category) where.category = input.category;
    if (q.length > 0) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { tags: { has: q.toLowerCase() } },
      ];
    }

    const items = await db.lineItemTemplate.findMany({
      where,
      orderBy: [
        { isVerified: "desc" },
        { usageCount: "desc" },
        { lastUsedAt: "desc" },
      ],
      take: input.limit,
    });

    // Per-client recall (if a client / building is selected, surface their
    // remembered prices — they always trump generic catalog matches).
    let clientRecall: any[] = [];
    if ((input.clientId || input.clientBuildingId) && q.length > 0) {
      const key = normaliseDescription(q);
      const memWhere: any = { descriptionKey: { contains: key } };
      const clientCond: any[] = [];
      if (input.clientId) clientCond.push({ clientId: input.clientId });
      if (input.clientBuildingId) clientCond.push({ clientBuildingId: input.clientBuildingId });
      if (clientCond.length > 0) memWhere.OR = clientCond;
      try {
        clientRecall = await db.clientPricingMemory.findMany({
          where: memWhere,
          orderBy: [{ usageCount: "desc" }, { lastUsedAt: "desc" }],
          take: 5,
        });
      } catch {
        clientRecall = [];
      }
    }

    return {
      items: items.map((it) => ({
        id: it.id,
        name: it.name,
        description: it.description,
        unitPrice: it.unitPrice,
        avgUnitPrice: it.avgUnitPrice,
        minUnitPrice: it.minUnitPrice,
        maxUnitPrice: it.maxUnitPrice,
        unitOfMeasure: it.unitOfMeasure,
        category: it.category,
        defaultCost: it.defaultCost,
        usageCount: it.usageCount,
        lastUsedAt: it.lastUsedAt,
        isVerified: it.isVerified,
        source: it.source,
        tags: it.tags,
      })),
      clientRecall: clientRecall.map((m) => ({
        id: m.id,
        description: m.description,
        unitOfMeasure: m.unitOfMeasure,
        lastUnitPrice: m.lastUnitPrice,
        avgUnitPrice: m.avgUnitPrice,
        minUnitPrice: m.minUnitPrice,
        maxUnitPrice: m.maxUnitPrice,
        usageCount: m.usageCount,
        lastUsedAt: m.lastUsedAt,
      })),
    };
  });

// ────────────────────────────────────────────────────────────────────────────
// getPricingLibrary — TM curation view (paged, filterable)
// ────────────────────────────────────────────────────────────────────────────

export const getPricingLibrary = baseProcedure
  .input(
    z.object({
      token: z.string(),
      query: z.string().optional(),
      source: z.enum(["MANUAL", "LEARNED_FROM_QUOTE", "LEARNED_FROM_INVOICE", "ALL"]).default("ALL"),
      verified: z.enum(["ALL", "VERIFIED", "UNVERIFIED"]).default("ALL"),
      category: z.string().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(25),
      sort: z.enum(["recent", "popular", "alpha"]).default("recent"),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureViewAccess(user.role);

    const where: any = { isActive: true };
    if (input.source !== "ALL") where.source = input.source;
    if (input.verified === "VERIFIED") where.isVerified = true;
    if (input.verified === "UNVERIFIED") where.isVerified = false;
    if (input.category) where.category = input.category;
    const q = (input.query || "").trim();
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
        { tags: { has: q.toLowerCase() } },
      ];
    }

    const orderBy: any[] = [];
    if (input.sort === "recent") orderBy.push({ lastUsedAt: "desc" }, { updatedAt: "desc" });
    if (input.sort === "popular") orderBy.push({ usageCount: "desc" }, { lastUsedAt: "desc" });
    if (input.sort === "alpha") orderBy.push({ name: "asc" });

    const [total, items] = await Promise.all([
      db.lineItemTemplate.count({ where }),
      db.lineItemTemplate.findMany({
        where,
        orderBy,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        include: {
          lastApprovedBy: { select: { id: true, firstName: true, lastName: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    ]);

    return { total, items, page: input.page, pageSize: input.pageSize };
  });

// ────────────────────────────────────────────────────────────────────────────
// upsertPricingCatalogItem — manual create/edit (TM curation)
// ────────────────────────────────────────────────────────────────────────────

export const upsertPricingCatalogItem = baseProcedure
  .input(
    z.object({
      token: z.string(),
      id: z.number().optional(),
      name: z.string().min(1),
      description: z.string().min(1),
      unitPrice: z.number().nonnegative(),
      defaultCost: z.number().nonnegative().optional(),
      unitOfMeasure: z.string().default("Sum"),
      category: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
      isVerified: z.boolean().optional(),
      isActive: z.boolean().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureCurateAccess(user.role);

    const data: any = {
      name: input.name.trim(),
      description: input.description.trim(),
      unitPrice: input.unitPrice,
      defaultCost: input.defaultCost ?? 0,
      unitOfMeasure: input.unitOfMeasure || "Sum",
      category: input.category ?? null,
      tags: input.tags ?? [],
    };
    if (typeof input.isVerified === "boolean") data.isVerified = input.isVerified;
    if (typeof input.isActive === "boolean") data.isActive = input.isActive;

    if (input.id) {
      return db.lineItemTemplate.update({ where: { id: input.id }, data });
    }
    return db.lineItemTemplate.create({
      data: {
        ...data,
        source: "MANUAL",
        isVerified: data.isVerified ?? true,
        createdById: user.id,
      },
    });
  });

// ────────────────────────────────────────────────────────────────────────────
// verifyPricingCatalogItem — toggle the green "Verified" badge
// ────────────────────────────────────────────────────────────────────────────

export const verifyPricingCatalogItem = baseProcedure
  .input(z.object({ token: z.string(), id: z.number(), isVerified: z.boolean() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureCurateAccess(user.role);
    return db.lineItemTemplate.update({
      where: { id: input.id },
      data: { isVerified: input.isVerified },
    });
  });

// ────────────────────────────────────────────────────────────────────────────
// deletePricingCatalogItem (soft) — sets isActive=false to preserve history
// ────────────────────────────────────────────────────────────────────────────

export const deletePricingCatalogItem = baseProcedure
  .input(z.object({ token: z.string(), id: z.number(), hard: z.boolean().optional() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureCurateAccess(user.role);
    if (input.hard) {
      await db.lineItemTemplate.delete({ where: { id: input.id } });
    } else {
      await db.lineItemTemplate.update({ where: { id: input.id }, data: { isActive: false } });
    }
    return { success: true };
  });

// ────────────────────────────────────────────────────────────────────────────
// getClientPricingMemory — list remembered prices for a client/building
// ────────────────────────────────────────────────────────────────────────────

export const getClientPricingMemory = baseProcedure
  .input(
    z.object({
      token: z.string(),
      clientId: z.number().optional(),
      clientBuildingId: z.number().optional(),
      limit: z.number().int().min(1).max(100).default(50),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureViewAccess(user.role);
    if (!input.clientId && !input.clientBuildingId) return { items: [] };
    const items = await db.clientPricingMemory.findMany({
      where: {
        ...(input.clientId ? { clientId: input.clientId } : {}),
        ...(input.clientBuildingId ? { clientBuildingId: input.clientBuildingId } : {}),
      },
      orderBy: [{ usageCount: "desc" }, { lastUsedAt: "desc" }],
      take: input.limit,
    });
    return { items };
  });

// ────────────────────────────────────────────────────────────────────────────
// getPricingAnomalies — anomaly dashboard data
// ────────────────────────────────────────────────────────────────────────────

export const getPricingAnomalies = baseProcedure
  .input(z.object({ token: z.string(), days: z.number().int().min(1).max(365).default(60) }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureViewAccess(user.role);

    const since = new Date();
    since.setDate(since.getDate() - input.days);

    // 1. Catalog items with wide price spread (volatility / drift)
    const drifting = await db.lineItemTemplate.findMany({
      where: {
        isActive: true,
        usageCount: { gte: 3 },
        avgUnitPrice: { gt: 0 },
        minUnitPrice: { gt: 0 },
      },
      orderBy: { usageCount: "desc" },
      take: 200,
    });
    const drift = drifting
      .map((it) => {
        if (!it.avgUnitPrice || !it.minUnitPrice || !it.maxUnitPrice) return null;
        const spread = (it.maxUnitPrice - it.minUnitPrice) / it.avgUnitPrice;
        if (spread < 0.5) return null; // 50%+ spread to be flagged
        return {
          id: it.id,
          name: it.name,
          description: it.description,
          avg: it.avgUnitPrice,
          min: it.minUnitPrice,
          max: it.maxUnitPrice,
          spreadPct: spread * 100,
          usageCount: it.usageCount,
          isVerified: it.isVerified,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.spreadPct - a.spreadPct)
      .slice(0, 25);

    // 2. Low-margin quotes recently approved
    const recentApproved = await db.quotation.findMany({
      where: {
        status: { in: ["APPROVED", "APPROVED_BY_CUSTOMER", "SENT_TO_CUSTOMER"] },
        updatedAt: { gte: since },
        subtotal: { gt: 0 },
      },
      select: {
        id: true,
        quoteNumber: true,
        customerName: true,
        subtotal: true,
        companyMaterialCost: true,
        companyLabourCost: true,
        createdBy: { select: { firstName: true, lastName: true, role: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    const lowMargin = recentApproved
      .map((q) => {
        const cost = (q.companyMaterialCost || 0) + (q.companyLabourCost || 0);
        const marginPct = q.subtotal > 0 ? ((q.subtotal - cost) / q.subtotal) * 100 : 0;
        if (marginPct >= 15) return null;
        return {
          id: q.id,
          quoteNumber: q.quoteNumber,
          customerName: q.customerName,
          subtotal: q.subtotal,
          cost,
          marginPct,
          createdBy: q.createdBy
            ? `${q.createdBy.firstName} ${q.createdBy.lastName}`
            : "—",
          createdByRole: q.createdBy?.role ?? "",
          assignedTo: q.assignedTo
            ? `${q.assignedTo.firstName} ${q.assignedTo.lastName}`
            : "—",
          updatedAt: q.updatedAt,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.marginPct - b.marginPct)
      .slice(0, 25);

    // 3. Junior under-pricing offenders — sum of recently approved quotes per creator
    const creatorTotals = new Map<
      string,
      { name: string; role: string; count: number; below: number }
    >();
    for (const q of recentApproved) {
      const cost = (q.companyMaterialCost || 0) + (q.companyLabourCost || 0);
      const marginPct = q.subtotal > 0 ? ((q.subtotal - cost) / q.subtotal) * 100 : 0;
      const key = q.createdBy
        ? `${q.createdBy.firstName} ${q.createdBy.lastName}`
        : "Unknown";
      const cur = creatorTotals.get(key) || {
        name: key,
        role: q.createdBy?.role ?? "",
        count: 0,
        below: 0,
      };
      cur.count++;
      if (marginPct < 15) cur.below++;
      creatorTotals.set(key, cur);
    }
    const offenders = Array.from(creatorTotals.values())
      .filter((c) => c.below > 0)
      .sort((a, b) => b.below - a.below)
      .slice(0, 10);

    return {
      windowDays: input.days,
      drift,
      lowMargin,
      offenders,
      summary: {
        catalogItems: drifting.length,
        flaggedDrift: drift.length,
        flaggedLowMargin: lowMargin.length,
      },
    };
  });

// ────────────────────────────────────────────────────────────────────────────
// backfillPricingCatalog — one-shot import (idempotent)
// ────────────────────────────────────────────────────────────────────────────

export const backfillPricingCatalog = baseProcedure
  .input(
    z.object({
      token: z.string(),
      limit: z.number().int().min(1).max(2000).default(500),
      dryRun: z.boolean().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureCurateAccess(user.role);

    const quotes = await db.quotation.findMany({
      where: { status: { in: ["APPROVED", "APPROVED_BY_CUSTOMER", "SENT_TO_CUSTOMER"] } },
      orderBy: { updatedAt: "desc" },
      take: input.limit,
      select: {
        id: true,
        quoteNumber: true,
        customerName: true,
        customerEmail: true,
        items: true,
        updatedAt: true,
        clientId: true,
        clientBuildingId: true,
        createdById: true,
      },
    });

    let totalAbsorbed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let processed = 0;

    for (const q of quotes) {
      const items: CatalogQuotationLineItem[] = Array.isArray(q.items)
        ? (q.items as any[]).map((it) => ({
            description: String(it.description ?? ""),
            quantity: Number(it.quantity ?? 1),
            unitPrice: Number(it.unitPrice ?? 0),
            total: Number(it.total ?? 0),
            unitOfMeasure: typeof it.unitOfMeasure === "string" ? it.unitOfMeasure : "Sum",
          }))
        : [];
      if (items.length === 0) continue;
      processed++;
      if (input.dryRun) continue;
      const res = await absorbLineItemsIntoCatalog(items, {
        source: "LEARNED_FROM_QUOTE",
        quoteNumber: q.quoteNumber,
        customerName: q.customerName,
        customerEmail: q.customerEmail,
        clientId: q.clientId ?? null,
        clientBuildingId: q.clientBuildingId ?? null,
        approvedById: q.createdById ?? user.id,
        approvedAt: q.updatedAt,
      });
      totalAbsorbed += res.absorbed;
      totalCreated += res.created;
      totalUpdated += res.updated;
    }

    return {
      processedQuotes: processed,
      totalAbsorbed,
      totalCreated,
      totalUpdated,
      dryRun: !!input.dryRun,
    };
  });

// ────────────────────────────────────────────────────────────────────────────
// computeQuoteDeviationReport — server-side helper used by the UI for
// margin / deviation badges on a draft quote before submission.
// ────────────────────────────────────────────────────────────────────────────

export const computeQuoteDeviationReport = baseProcedure
  .input(
    z.object({
      token: z.string(),
      items: z.array(
        z.object({
          description: z.string(),
          quantity: z.number(),
          unitPrice: z.number(),
          unitOfMeasure: z.string().optional(),
        })
      ),
      clientId: z.number().optional().nullable(),
      clientBuildingId: z.number().optional().nullable(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureViewAccess(user.role);

    const report: any[] = [];
    for (const it of input.items) {
      const key = normaliseDescription(it.description);
      if (!key) {
        report.push({ description: it.description, status: "unmatched" });
        continue;
      }
      // Catalog lookup
      const candidates = await db.lineItemTemplate.findMany({
        where: {
          isActive: true,
          description: { equals: it.description, mode: "insensitive" },
        },
        take: 5,
      });
      let match = candidates.find((c) => normaliseDescription(c.description) === key) ?? null;
      // Fallback: client memory
      let clientMem: any = null;
      if ((input.clientId || input.clientBuildingId) && !match) {
        const memWhere: any = { descriptionKey: key };
        const conds: any[] = [];
        if (input.clientId) conds.push({ clientId: input.clientId });
        if (input.clientBuildingId) conds.push({ clientBuildingId: input.clientBuildingId });
        if (conds.length > 0) memWhere.OR = conds;
        clientMem = await db.clientPricingMemory.findFirst({
          where: memWhere,
          orderBy: { lastUsedAt: "desc" },
        });
      }
      if (!match && !clientMem) {
        report.push({ description: it.description, status: "unmatched" });
        continue;
      }
      const dev = match
        ? computePriceDeviation(it.unitPrice, {
            avgUnitPrice: match.avgUnitPrice ?? match.unitPrice,
            unitPrice: match.unitPrice,
            isVerified: match.isVerified,
          })
        : computePriceDeviation(it.unitPrice, {
            avgUnitPrice: clientMem.avgUnitPrice,
            unitPrice: clientMem.lastUnitPrice,
            isVerified: false,
          });
      report.push({
        description: it.description,
        status: "matched",
        matchedItemId: match?.id ?? null,
        isVerified: match?.isVerified ?? false,
        reference: dev?.reference ?? null,
        deviation: dev,
      });
    }
    return { report, threshold: PRICING_DEVIATION_THRESHOLD };
  });

// ────────────────────────────────────────────────────────────────────────────
// generateScopeFromBrief — LLM scope drafter grounded in your catalog
// ────────────────────────────────────────────────────────────────────────────

export const generateScopeFromBrief = baseProcedure
  .input(
    z.object({
      token: z.string(),
      brief: z.string().min(8),
      serviceType: z.string().optional(),
      address: z.string().optional(),
      clientId: z.number().optional().nullable(),
      clientBuildingId: z.number().optional().nullable(),
      maxItems: z.number().int().min(3).max(15).default(8),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureViewAccess(user.role);

    // 1. Pull a relevant slice of the catalog (top verified + recently used)
    const verifiedItems = await db.lineItemTemplate.findMany({
      where: { isActive: true, isVerified: true },
      orderBy: [{ usageCount: "desc" }, { lastUsedAt: "desc" }],
      take: 80,
    });
    const recentLearned = await db.lineItemTemplate.findMany({
      where: { isActive: true, isVerified: false, usageCount: { gte: 2 } },
      orderBy: { usageCount: "desc" },
      take: 40,
    });
    const catalog = [...verifiedItems, ...recentLearned];

    // 2. Per-client recent prices to bias output
    let clientMem: any[] = [];
    if (input.clientId || input.clientBuildingId) {
      clientMem = await db.clientPricingMemory.findMany({
        where: {
          ...(input.clientId ? { clientId: input.clientId } : {}),
          ...(input.clientBuildingId ? { clientBuildingId: input.clientBuildingId } : {}),
        },
        orderBy: { usageCount: "desc" },
        take: 30,
      });
    }

    // 3. Build a compact prompt
    const catalogList = catalog
      .map(
        (c, i) =>
          `${i + 1}. [${c.isVerified ? "VERIFIED" : "history"}] "${c.description}" — R${c.unitPrice.toFixed(2)} / ${c.unitOfMeasure} (avg R${(c.avgUnitPrice ?? c.unitPrice).toFixed(2)})`
      )
      .join("\n");
    const clientList = clientMem
      .map(
        (m) =>
          `- "${m.description}" — last R${m.lastUnitPrice.toFixed(2)} / ${m.unitOfMeasure}, avg R${m.avgUnitPrice.toFixed(2)} over ${m.usageCount} jobs`
      )
      .join("\n");

    try {
      const model = google("gemini-2.0-flash-exp");
      const { object } = await generateObject({
        model,
        output: "array",
        schema: z.object({
          description: z.string(),
          quantity: z.number().min(0),
          unitPrice: z.number().min(0),
          unitOfMeasure: z.enum(["m2", "Lm", "Sum", "m3", "Hr"]),
          rationale: z.string().optional(),
          matchedCatalogId: z.number().optional().nullable(),
        }),
        prompt: `You are the Technical Manager of a South African facilities-management firm.
Generate a quotation scope (line items) for the following brief. You MUST prefer prices and wording from our internal Pricing Catalog below — they reflect what we actually charge.

BRIEF:
${input.brief}
${input.serviceType ? `Service type: ${input.serviceType}` : ""}
${input.address ? `Address: ${input.address}` : ""}

PRICING CATALOG (use these where possible — copy the description verbatim and quote the listed unit price):
${catalogList || "(empty — use sensible South African market rates)"}

${
  clientList
    ? `THIS CLIENT'S RECENT PRICES (always prefer these for this client):\n${clientList}`
    : ""
}

RULES:
- Generate ${input.maxItems} or fewer line items.
- When a catalog item clearly matches, set matchedCatalogId to its number prefix and reuse its description verbatim.
- Never invent prices wildly outside the catalog: stay within ±20% of the listed unit price.
- Quantities must be realistic for the scope described.
- Include callout fees / labour as separate items if the catalog has them.
`,
      });

      const items = (object as any[]).map((it) => {
        // Resolve matchedCatalogId (1-based prefix in our list) back to a real id.
        let matchedId: number | null = null;
        if (typeof it.matchedCatalogId === "number") {
          const idx = it.matchedCatalogId - 1;
          if (idx >= 0 && idx < catalog.length) matchedId = catalog[idx].id;
        }
        return {
          description: it.description,
          quantity: Number(it.quantity || 0),
          unitPrice: Number(it.unitPrice || 0),
          total: Number(it.quantity || 0) * Number(it.unitPrice || 0),
          unitOfMeasure: it.unitOfMeasure,
          rationale: it.rationale,
          matchedCatalogId: matchedId,
        };
      });

      return {
        items,
        catalogSize: catalog.length,
        clientMemorySize: clientMem.length,
      };
    } catch (err: any) {
      console.error("[generateScopeFromBrief] failed:", err);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not generate scope. Please add items manually or try again.",
      });
    }
  });

// ────────────────────────────────────────────────────────────────────────────
// listApprovedQuotationsForTemplate — "use as template" picker source
// ────────────────────────────────────────────────────────────────────────────

export const listApprovedQuotationsForTemplate = baseProcedure
  .input(
    z.object({
      token: z.string(),
      query: z.string().optional(),
      clientId: z.number().optional(),
      clientBuildingId: z.number().optional(),
      limit: z.number().int().min(1).max(50).default(15),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureViewAccess(user.role);

    const where: any = {
      status: { in: ["APPROVED", "APPROVED_BY_CUSTOMER", "SENT_TO_CUSTOMER"] },
    };
    if (input.clientId) where.clientId = input.clientId;
    if (input.clientBuildingId) where.clientBuildingId = input.clientBuildingId;
    const q = (input.query || "").trim();
    if (q) {
      where.OR = [
        { quoteNumber: { contains: q, mode: "insensitive" } },
        { customerName: { contains: q, mode: "insensitive" } },
        { address: { contains: q, mode: "insensitive" } },
        { projectDescription: { contains: q, mode: "insensitive" } },
      ];
    }

    const quotes = await db.quotation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: input.limit,
      select: {
        id: true,
        quoteNumber: true,
        customerName: true,
        address: true,
        total: true,
        subtotal: true,
        items: true,
        updatedAt: true,
        status: true,
      },
    });

    return {
      quotes: quotes.map((q) => ({
        id: q.id,
        quoteNumber: q.quoteNumber,
        customerName: q.customerName,
        address: q.address,
        total: q.total,
        subtotal: q.subtotal,
        status: q.status,
        updatedAt: q.updatedAt,
        itemCount: Array.isArray(q.items) ? (q.items as any[]).length : 0,
        items: Array.isArray(q.items)
          ? (q.items as any[]).map((it) => ({
              description: String(it.description ?? ""),
              quantity: Number(it.quantity ?? 1),
              unitPrice: Number(it.unitPrice ?? 0),
              total: Number(it.total ?? 0),
              unitOfMeasure: typeof it.unitOfMeasure === "string" ? it.unitOfMeasure : "Sum",
            }))
          : [],
      })),
    };
  });

// Helper re-export for the absorb procedure used elsewhere (if needed).
export { absorbLineItemsIntoCatalog };
