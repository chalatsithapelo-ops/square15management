/**
 * refreshMaterialPrice — server-side price refresh from allow-listed
 * South African supplier product pages.
 *
 * Scope for Phase D:
 *  - The caller supplies a materialId AND a supplier product URL.
 *  - We fetch the URL server-side (never from the browser — CORS + PoP).
 *  - Domain MUST be on ALLOWED_DOMAINS or we refuse.
 *  - Extract price using a small set of regexes that cover common SA
 *    e-commerce shops (JSON-LD Product schema + visible "R###" text).
 *  - Upsert a MaterialSupplierPrice row with fetchedAt=now.
 *
 * We deliberately do NOT auto-scrape a whole product catalog — that
 * crosses politeness thresholds and lands in scraping-terms trouble.
 * A single-URL manual refresh scales fine and matches the "TM clicks
 * refresh next to a line" UX in the Studio.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

// ─────────────────────────────────────────────────────────────────────
// Allow-list — expand cautiously.
// ─────────────────────────────────────────────────────────────────────
const ALLOWED_DOMAINS = new Set([
  "builders.co.za",
  "www.builders.co.za",
  "leroymerlin.co.za",
  "www.leroymerlin.co.za",
  "chamberlains.co.za",
  "www.chamberlains.co.za",
  "cashbuild.co.za",
  "www.cashbuild.co.za",
  "makro.co.za",
  "www.makro.co.za",
]);

const ROLES_ALLOWED = [
  "SENIOR_ADMIN",
  "JUNIOR_ADMIN",
  "ADMIN",
  "TECHNICAL_MANAGER",
  "MANAGER",
  "ACCOUNTANT",
];

function ensureAccess(role: string) {
  if (!ROLES_ALLOWED.includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not authorised." });
  }
}

// ─────────────────────────────────────────────────────────────────────
// Price extraction
// ─────────────────────────────────────────────────────────────────────
interface ExtractedPrice {
  price: number;
  currency: string;
  title?: string;
  method: "json-ld" | "microdata" | "regex-visible" | "regex-json";
}

export function extractPriceFromHtml(html: string): ExtractedPrice | null {
  // 1. JSON-LD <script type="application/ld+json">
  const ldRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = ldRegex.exec(html)) !== null) {
    try {
      const raw = m[1].trim();
      const jsonObjs: any[] = [];
      // Some sites wrap multiple JSON objects in an array or graph.
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) jsonObjs.push(...parsed);
      else if (parsed && Array.isArray(parsed["@graph"])) jsonObjs.push(...parsed["@graph"]);
      else jsonObjs.push(parsed);

      for (const obj of jsonObjs) {
        if (!obj) continue;
        const t = obj["@type"];
        if (t === "Product" || (Array.isArray(t) && t.includes("Product"))) {
          const offers = obj.offers ?? obj.offer ?? null;
          const offerObj = Array.isArray(offers) ? offers[0] : offers;
          const priceRaw =
            offerObj?.price ?? offerObj?.lowPrice ?? offerObj?.highPrice ?? obj.price;
          const priceNum =
            typeof priceRaw === "string" ? parseFloat(priceRaw.replace(/[^0-9.]/g, "")) : Number(priceRaw);
          if (priceNum && Number.isFinite(priceNum) && priceNum > 0) {
            return {
              price: priceNum,
              currency: String(offerObj?.priceCurrency ?? "ZAR"),
              title: String(obj.name ?? ""),
              method: "json-ld",
            };
          }
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }

  // 2. Microdata
  const microMatch = html.match(
    /itemprop=["']price["'][^>]*content=["']([0-9]+(?:\.[0-9]+)?)["']/i
  );
  if (microMatch) {
    const priceNum = parseFloat(microMatch[1]);
    if (priceNum > 0) {
      return { price: priceNum, currency: "ZAR", method: "microdata" };
    }
  }

  // 3. Any JSON-in-page field like "price":"1650.00"
  const jsonInline = html.match(/"price"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?/i);
  if (jsonInline) {
    const priceNum = parseFloat(jsonInline[1]);
    if (priceNum > 5) {
      return { price: priceNum, currency: "ZAR", method: "regex-json" };
    }
  }

  // 4. Visible price like "R1,650.00" — pick the FIRST large ZAR value.
  const visibleRegex = /R\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/g;
  let visible: RegExpExecArray | null;
  const candidates: number[] = [];
  while ((visible = visibleRegex.exec(html)) !== null) {
    const val = parseFloat(visible[1].replace(/,/g, ""));
    if (val >= 10 && val <= 500000) candidates.push(val);
    if (candidates.length > 20) break;
  }
  if (candidates.length) {
    // Median is more robust to "R99.99 off" style noise.
    candidates.sort((a, b) => a - b);
    const median = candidates[Math.floor(candidates.length / 2)];
    return { price: median, currency: "ZAR", method: "regex-visible" };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────
// Procedure
// ─────────────────────────────────────────────────────────────────────
export const refreshMaterialPrice = baseProcedure
  .input(
    z.object({
      token: z.string(),
      materialId: z.number().int(),
      supplierId: z.number().int().optional(), // if omitted we use material.defaultSupplierId
      url: z.string().url(),
      markVerified: z.boolean().default(false),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAccess(user.role);

    let urlObj: URL;
    try {
      urlObj = new URL(input.url);
    } catch {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid URL." });
    }
    if (!ALLOWED_DOMAINS.has(urlObj.host.toLowerCase())) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Domain not allow-listed for price refresh: ${urlObj.host}. Add it to ALLOWED_DOMAINS in refreshMaterialPrice.ts if it's a legitimate supplier.`,
      });
    }

    const material = await db.materialCatalog.findUnique({
      where: { id: input.materialId },
      include: { defaultSupplier: true },
    });
    if (!material) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Material not found." });
    }
    const supplierId = input.supplierId ?? material.defaultSupplierId;
    if (!supplierId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No supplier for this material — pass supplierId explicitly.",
      });
    }

    // Fetch with a friendly UA + timeout.
    let html: string;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      const resp = await fetch(urlObj.toString(), {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; SQR15-QuoteStudio/1.0; +internal-price-refresh)",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-ZA,en;q=0.9",
        },
        redirect: "follow",
      });
      clearTimeout(timeout);
      if (!resp.ok) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `Supplier returned ${resp.status} ${resp.statusText}.`,
        });
      }
      html = await resp.text();
    } catch (err: any) {
      if (err instanceof TRPCError) throw err;
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: `Could not fetch supplier page: ${err?.message ?? "network error"}`,
      });
    }

    const extracted = extractPriceFromHtml(html);
    if (!extracted) {
      throw new TRPCError({
        code: "UNPROCESSABLE_CONTENT",
        message:
          "Could not extract a price from that page. Copy the price manually and update the material.",
      });
    }

    const price = await db.materialSupplierPrice.upsert({
      where: { materialId_supplierId: { materialId: material.id, supplierId } },
      create: {
        materialId: material.id,
        supplierId,
        unitPrice: extracted.price,
        currency: extracted.currency,
        sourceUrl: urlObj.toString(),
        fetchedAt: new Date(),
        isVerified: input.markVerified,
        verifiedById: input.markVerified ? user.id : null,
        verifiedAt: input.markVerified ? new Date() : null,
        notes: `Extracted via ${extracted.method}${extracted.title ? ` — ${extracted.title}` : ""}`,
      },
      update: {
        unitPrice: extracted.price,
        currency: extracted.currency,
        sourceUrl: urlObj.toString(),
        fetchedAt: new Date(),
        isVerified: input.markVerified ? true : undefined,
        verifiedById: input.markVerified ? user.id : undefined,
        verifiedAt: input.markVerified ? new Date() : undefined,
        notes: `Extracted via ${extracted.method}${extracted.title ? ` — ${extracted.title}` : ""}`,
      },
    });

    // Also mirror to material.lastKnownPrice for quick lookups.
    await db.materialCatalog.update({
      where: { id: material.id },
      data: {
        lastKnownPrice: extracted.price,
        lastPricedAt: new Date(),
      },
    });

    return {
      materialId: material.id,
      supplierId,
      priceId: price.id,
      unitPrice: extracted.price,
      currency: extracted.currency,
      method: extracted.method,
      title: extracted.title ?? null,
      fetchedAt: price.fetchedAt,
    };
  });

// ─────────────────────────────────────────────────────────────────────
// listMaterialCatalog + listSuppliers — small helpers for the Studio UI
// ─────────────────────────────────────────────────────────────────────
export const listMaterialCatalog = baseProcedure
  .input(
    z.object({
      token: z.string(),
      search: z.string().optional(),
      category: z.string().optional(),
      limit: z.number().int().min(1).max(200).default(50),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAccess(user.role);

    const rows = await db.materialCatalog.findMany({
      where: {
        isActive: true,
        ...(input.category ? { category: input.category } : {}),
        ...(input.search
          ? { name: { contains: input.search, mode: "insensitive" } }
          : {}),
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      take: input.limit,
      include: {
        defaultSupplier: { select: { id: true, name: true } },
        supplierPrices: {
          orderBy: { fetchedAt: "desc" },
          take: 1,
          include: { supplier: { select: { id: true, name: true } } },
        },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      brand: r.brand,
      category: r.category,
      packSize: r.packSize,
      packUnit: r.packUnit,
      coverageRate: r.coverageRate,
      coverageUnit: r.coverageUnit,
      wastageFactor: r.wastageFactor,
      lastKnownPrice: r.lastKnownPrice,
      lastPricedAt: r.lastPricedAt,
      defaultSupplier: r.defaultSupplier,
      latestPrice: r.supplierPrices[0] ?? null,
    }));
  });

export const listWorkTaskTemplates = baseProcedure
  .input(z.object({ token: z.string(), category: z.string().optional() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAccess(user.role);
    return db.workTaskTemplate.findMany({
      where: {
        isActive: true,
        ...(input.category ? { category: input.category } : {}),
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: {
        materialUsage: {
          include: {
            material: { select: { id: true, name: true, packUnit: true } },
          },
        },
      },
    });
  });
