/**
 * bomSizer — deterministic quantity-surveyor math for the AI Quote Studio.
 *
 * Given a WorkTaskTemplate + a quantity (e.g. 120 m²), compute:
 *  - How many packs of each material to buy (rounded up, with wastage).
 *  - How many person-days each labour role is required.
 *  - A coverage-validation report the UI can display.
 *
 * The LLM in the studio pipeline never invents these numbers — it only
 * *plans* the scope. All quantities & prices come from this file so we
 * can always trace where a rand came from.
 */

import { db } from "~/server/db";

// ─────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────
export interface BOMMaterialLine {
  materialId: number;
  materialName: string;
  brand?: string | null;
  category: string;
  packSize: number;
  packUnit: string;

  supplierId: number | null;
  supplierName: string | null;

  // Raw math
  qtyPerUnitOfWork: number; // qty (in packUnit) needed per one unit-of-work
  rawQty: number;           // qtyPerUnitOfWork × workQuantity
  wastagePct: number;       // 0..1 fraction added on top
  qtyWithWastage: number;   // rawQty × (1 + wastagePct)
  packsNeeded: number;      // ceil(qtyWithWastage / packSize)
  qtyPurchased: number;     // packsNeeded × packSize

  unitPricePerPack: number; // ZAR per pack (from MaterialSupplierPrice or Material.lastKnownPrice)
  priceFetchedAt: Date | null;
  priceIsStale: boolean;    // true if fetchedAt > 30 days ago (Phase D refresh trigger)
  sourceUrl: string | null;

  costTotal: number;        // packsNeeded × unitPricePerPack

  // Coverage sanity — did we buy enough?
  coverageCheck?: {
    unitsCovered: number;   // e.g. m² covered by qtyPurchased
    unitsRequired: number;  // workQuantity
    ok: boolean;
    note: string;
  };
}

export interface BOMLabourLine {
  labourRoleId: number;
  code: string;
  name: string;
  crewCount: number;        // how many of this role on the crew
  personDays: number;       // days × count  ⇒ total person-days
  dailyRate: number;        // pre-overhead
  overheadMultiplier: number;
  effectiveDailyRate: number;
  costTotal: number;        // personDays × effectiveDailyRate
}

export interface BOMLineOutput {
  taskId: number;
  taskName: string;
  category: string;
  unitOfMeasure: string;

  workQuantity: number;
  targetMarginPct: number;
  overheadPct: number;

  materials: BOMMaterialLine[];
  labour: BOMLabourLine[];

  // Cost roll-up
  materialsCost: number;
  labourCost: number;
  overheadCost: number;       // materialsCost + labourCost × overheadPct
  costPrice: number;          // materials + labour + overhead
  suggestedPrice: number;     // costPrice / (1 - targetMarginPct)
  marginPct: number;          // (suggestedPrice - costPrice) / suggestedPrice
  perUnitPrice: number;       // suggestedPrice / workQuantity

  warnings: string[];         // e.g. "labour role X not found; assumed helper rate"
}

// ─────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────
const PRICE_STALE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ─────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────

/**
 * Size a single line item given a task + quantity.
 *
 * `taskId` may be undefined when the LLM couldn't match a template — in
 * that case the caller should build a bare BOMLineOutput manually.
 */
export async function sizeBomForTask(opts: {
  taskId: number;
  workQuantity: number;
  overrideMarginPct?: number;
}): Promise<BOMLineOutput> {
  const task = await db.workTaskTemplate.findUnique({
    where: { id: opts.taskId },
    include: {
      materialUsage: {
        include: {
          material: {
            include: {
              defaultSupplier: true,
              supplierPrices: { orderBy: { fetchedAt: "desc" }, take: 1 },
            },
          },
        },
      },
    },
  });
  if (!task) throw new Error(`WorkTaskTemplate ${opts.taskId} not found`);

  const warnings: string[] = [];
  const workQuantity = Math.max(0, opts.workQuantity);

  // ── Materials ─────────────────────────────────────────────────────
  const materials: BOMMaterialLine[] = [];
  for (const usage of task.materialUsage) {
    const m = usage.material;
    const rawQty = usage.qtyPerUnit * workQuantity;
    const wastagePct = m.wastageFactor;
    const qtyWithWastage = rawQty * (1 + wastagePct);
    const packsNeeded = Math.max(1, Math.ceil(qtyWithWastage / Math.max(m.packSize, 0.0001)));
    const qtyPurchased = packsNeeded * m.packSize;

    // Choose price: freshest MaterialSupplierPrice > lastKnownPrice
    const priceRow = m.supplierPrices[0];
    const unitPricePerPack = priceRow?.unitPrice ?? m.lastKnownPrice ?? 0;
    const priceFetchedAt = priceRow?.fetchedAt ?? m.lastPricedAt ?? null;
    const priceIsStale = priceFetchedAt
      ? Date.now() - priceFetchedAt.getTime() > PRICE_STALE_MS
      : true;
    if (unitPricePerPack <= 0) {
      warnings.push(`No price recorded for "${m.name}" — showing R0.`);
    }

    // Coverage validation (m²/L or m²/kg)
    let coverageCheck: BOMMaterialLine["coverageCheck"] | undefined;
    if (m.coverageRate && m.coverageUnit && task.unitOfMeasure === "m2") {
      // qtyPurchased (in packUnit like L or kg) × coverageRate = m² covered.
      // But qtyPurchased is packs × packSize (e.g. 3 × 20 = 60 L).
      const unitsCovered = qtyPurchased * m.coverageRate;
      const ok = unitsCovered >= workQuantity;
      coverageCheck = {
        unitsCovered,
        unitsRequired: workQuantity,
        ok,
        note: ok
          ? `${round1(qtyPurchased)} ${m.packUnit} covers ${round1(unitsCovered)} m² (need ${workQuantity} m²) ✓`
          : `Only ${round1(unitsCovered)} m² of coverage from ${round1(qtyPurchased)} ${m.packUnit} — need ${workQuantity} m² ✗`,
      };
      if (!ok) warnings.push(`Coverage short for ${m.name}: ${coverageCheck.note}`);
    }

    materials.push({
      materialId: m.id,
      materialName: m.name,
      brand: m.brand,
      category: m.category,
      packSize: m.packSize,
      packUnit: m.packUnit,
      supplierId: priceRow?.supplierId ?? m.defaultSupplierId ?? null,
      supplierName: priceRow ? undefined as any : m.defaultSupplier?.name ?? null, // fill next line
      qtyPerUnitOfWork: usage.qtyPerUnit,
      rawQty,
      wastagePct,
      qtyWithWastage,
      packsNeeded,
      qtyPurchased,
      unitPricePerPack,
      priceFetchedAt,
      priceIsStale,
      sourceUrl: priceRow?.sourceUrl ?? null,
      costTotal: packsNeeded * unitPricePerPack,
      coverageCheck,
    });
  }

  // Resolve supplier names for any priceRow-based rows in a single roundtrip
  const supplierIdsToLookup = materials
    .map((mm) => mm.supplierId)
    .filter((id): id is number => id != null && !materials.some((r) => r.supplierId === id && r.supplierName));
  if (supplierIdsToLookup.length) {
    const rows = await db.supplier.findMany({
      where: { id: { in: supplierIdsToLookup } },
    });
    const byId = new Map(rows.map((r) => [r.id, r.name] as const));
    for (const mm of materials) {
      if (mm.supplierId && !mm.supplierName) mm.supplierName = byId.get(mm.supplierId) ?? null;
    }
  }

  // ── Labour ────────────────────────────────────────────────────────
  const crewRoles: { code: string; count: number }[] = Array.isArray(task.defaultCrewRoles)
    ? (task.defaultCrewRoles as any as { code: string; count: number }[])
    : [];
  const crewSize = crewRoles.reduce((s, r) => s + (r.count || 0), 0) || task.defaultCrewSize;

  // How many crew-days does the whole job take?
  // productionRate = units per PERSON-day.  Total person-days = workQuantity / productionRate.
  const totalPersonDays = task.productionRate > 0 ? workQuantity / task.productionRate : 0;
  const crewDays = crewSize > 0 ? totalPersonDays / crewSize : 0; // wall-clock days for the crew

  const labour: BOMLabourLine[] = [];
  if (crewRoles.length === 0) {
    warnings.push(
      `Task "${task.name}" has no defaultCrewRoles configured — assuming 1 × ARTISAN_L2.`
    );
    crewRoles.push({ code: "ARTISAN_L2", count: 1 });
  }

  const roleCodes = crewRoles.map((r) => r.code);
  const roleRows = await db.labourRole.findMany({ where: { code: { in: roleCodes } } });
  const roleByCode = new Map(roleRows.map((r) => [r.code, r] as const));

  for (const cr of crewRoles) {
    const role = roleByCode.get(cr.code);
    if (!role) {
      warnings.push(`Labour role "${cr.code}" not configured — skipping.`);
      continue;
    }
    const personDays = crewDays * cr.count;
    const effectiveDailyRate = role.dailyRate * role.overheadMultiplier;
    labour.push({
      labourRoleId: role.id,
      code: role.code,
      name: role.name,
      crewCount: cr.count,
      personDays,
      dailyRate: role.dailyRate,
      overheadMultiplier: role.overheadMultiplier,
      effectiveDailyRate,
      costTotal: personDays * effectiveDailyRate,
    });
  }

  // ── Roll-up ───────────────────────────────────────────────────────
  const materialsCost = materials.reduce((s, m) => s + m.costTotal, 0);
  const labourCost = labour.reduce((s, l) => s + l.costTotal, 0);
  const overheadCost = (materialsCost + labourCost) * task.overheadPct;
  const costPrice = materialsCost + labourCost + overheadCost;
  const marginPct = opts.overrideMarginPct ?? task.targetMarginPct;
  const suggestedPrice = marginPct < 1 ? costPrice / (1 - marginPct) : costPrice;
  const perUnitPrice = workQuantity > 0 ? suggestedPrice / workQuantity : 0;

  return {
    taskId: task.id,
    taskName: task.name,
    category: task.category,
    unitOfMeasure: task.unitOfMeasure,
    workQuantity,
    targetMarginPct: marginPct,
    overheadPct: task.overheadPct,
    materials,
    labour,
    materialsCost,
    labourCost,
    overheadCost,
    costPrice,
    suggestedPrice,
    marginPct: suggestedPrice > 0 ? (suggestedPrice - costPrice) / suggestedPrice : 0,
    perUnitPrice,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────
function round1(n: number) {
  return Math.round(n * 10) / 10;
}
