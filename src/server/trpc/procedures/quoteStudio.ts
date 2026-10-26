/**
 * generateQuoteStudio — the multi-step Quantity-Surveyor pipeline that
 * powers the AI Quote & Invoice Studio.
 *
 * Five deterministic stages:
 *
 *  1. Scope planner (LLM)         — parses the natural-language brief into
 *                                    { description, quantity, unitOfMeasure } tasks
 *                                    and matches each to a WorkTaskTemplate id.
 *  2. BOM sizer (pure TS)         — for every matched task the deterministic
 *                                    sizer in `bomSizer.ts` computes materials,
 *                                    labour, wastage, coverage checks.
 *  3. Price resolver (pure TS)    — inside the sizer: the freshest
 *                                    MaterialSupplierPrice wins; stale rows are
 *                                    flagged for the "Refresh price" button.
 *  4. Margin engine (pure TS)     — applies the task's targetMarginPct
 *                                    (or a global override), holds the quote
 *                                    for review if the margin floor is broken.
 *  5. QS review (LLM)             — produces a customer-facing description
 *                                    for each line item plus overall risk notes.
 *
 * The returned payload is a *proposed* quote (not saved to DB by default) —
 * the front-end shows it, the user can tweak, then calls `persistStudioQuote`
 * to write a Quotation + QuotationBOMLine rows.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { generateObject } from "~/server/services/ai/controlledGeneration";
import { google } from "@ai-sdk/google";
import { sizeBomForTask, type BOMLineOutput } from "~/server/utils/bomSizer";

// ─────────────────────────────────────────────────────────────────────
// Role gate
// ─────────────────────────────────────────────────────────────────────
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
    throw new TRPCError({ code: "FORBIDDEN", message: "Not authorised to use AI Quote Studio." });
  }
}

// ─────────────────────────────────────────────────────────────────────
// Public tRPC procedure
// ─────────────────────────────────────────────────────────────────────
export const generateQuoteStudio = baseProcedure
  .input(
    z.object({
      token: z.string(),
      brief: z.string().min(8),
      mode: z.enum(["LINE", "PROJECT"]).default("PROJECT"),
      address: z.string().optional(),
      serviceType: z.string().optional(),
      clientId: z.number().int().optional().nullable(),
      clientBuildingId: z.number().int().optional().nullable(),
      overrideMarginPct: z.number().min(0).max(0.95).optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAccess(user.role);

    // ── Load the task catalog for grounding ─────────────────────────
    const tasks = await db.workTaskTemplate.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        unitOfMeasure: true,
        productionRate: true,
        targetMarginPct: true,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    if (tasks.length === 0) {
      throw new TRPCError({
        code: "FAILED_PRECONDITION",
        message:
          "No WorkTaskTemplate rows configured. Seed the AI Studio catalog first (prisma/seed-ai-studio.ts).",
      });
    }

    const catalogList = tasks
      .map(
        (t, i) =>
          `${i + 1}. [id=${t.id}] "${t.name}" — ${t.category} — unit=${t.unitOfMeasure}, ${t.productionRate} ${t.unitOfMeasure}/person-day, target margin ${(t.targetMarginPct * 100).toFixed(0)}%${t.description ? `  (${t.description})` : ""}`
      )
      .join("\n");

    // ── STAGE 1: Scope planner ───────────────────────────────────────
    let scope: {
      description: string;
      quantity: number;
      unitOfMeasure: string;
      taskId: number | null;
      rationale?: string;
    }[] = [];

    try {
      const { object } = await generateObject({
        aiFeature: "quoteStudio.lineItems",
        aiUserId: user.id,
        model: google("gemini-3.6-flash"),
        output: "array",
        schema: z.object({
          description: z.string(),
          quantity: z.number().min(0),
          unitOfMeasure: z.string(),
          taskId: z.number().int().nullable(),
          rationale: z.string().optional(),
        }),
        prompt: `You are a senior South African Quantity Surveyor drafting the scope of works from a project brief.

BRIEF FROM ADMIN STAFF:
${input.brief}
${input.serviceType ? `Service type: ${input.serviceType}` : ""}
${input.address ? `Address: ${input.address}` : ""}

INTERNAL TASK CATALOG (each row is a workable line item with a known production rate and material bill):
${catalogList}

INSTRUCTIONS:
- Break the brief into concrete billable scope items.
- For each item, if it clearly matches a catalog task, set taskId to the matching numeric id (the value inside id=...).
  When no reasonable match exists, set taskId to null and describe the work anyway (the QS will size it manually).
- quantity MUST be in the SAME unitOfMeasure as the matched catalog task (e.g. m2 for painting).
- When the brief gives you a total area (e.g. "120 m²"), use that as the quantity.
- When the brief lists individual rooms/points, sum them (e.g. "5 sockets" → quantity=5).
- Do NOT invent scope not described in the brief.
- If a step is prep-only (e.g. patching), still generate it as a separate line so the sizer can add materials.
- Return AT MOST 12 items.`,
      });
      scope = object as any;
    } catch (err: any) {
      console.error("[generateQuoteStudio] scope planner failed:", err);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "AI scope planner failed. Please refine the brief and retry.",
      });
    }

    // ── STAGE 2-4: BOM sizer / price / margin (deterministic) ────────
    interface BuiltLine {
      description: string;
      matchedTaskName: string | null;
      quantity: number;
      unitOfMeasure: string;
      rationale?: string;
      bom: BOMLineOutput | null;
      unmatched?: boolean;
    }

    const built: BuiltLine[] = [];
    for (const s of scope) {
      if (s.taskId == null) {
        built.push({
          description: s.description,
          matchedTaskName: null,
          quantity: s.quantity,
          unitOfMeasure: s.unitOfMeasure,
          rationale: s.rationale,
          bom: null,
          unmatched: true,
        });
        continue;
      }
      try {
        const bom = await sizeBomForTask({
          taskId: s.taskId,
          workQuantity: s.quantity,
          overrideMarginPct: input.overrideMarginPct,
        });
        built.push({
          description: s.description,
          matchedTaskName: bom.taskName,
          quantity: s.quantity,
          unitOfMeasure: bom.unitOfMeasure,
          rationale: s.rationale,
          bom,
        });
      } catch (err: any) {
        console.warn(`[generateQuoteStudio] sizer failed for taskId=${s.taskId}:`, err?.message);
        built.push({
          description: s.description,
          matchedTaskName: null,
          quantity: s.quantity,
          unitOfMeasure: s.unitOfMeasure,
          rationale: s.rationale,
          bom: null,
          unmatched: true,
        });
      }
    }

    // ── STAGE 5: QS review — customer-facing wording ─────────────────
    // We ask the LLM to polish the line descriptions and produce top-level
    // risk / assumption notes. If this stage fails we fall back to raw
    // scope descriptions — never crash the whole quote.
    let polishedDescriptions: string[] = built.map((b) => b.description);
    let qsNotes = "";
    try {
      const reviewInput = built
        .map(
          (b, i) =>
            `${i + 1}. ${b.matchedTaskName ?? "(no catalog match)"} — quantity ${b.quantity} ${b.unitOfMeasure} — original brief note: ${b.description}`
        )
        .join("\n");
      const { object } = await generateObject({
        aiFeature: "quoteStudio.review",
        aiUserId: user.id,
        model: google("gemini-3.6-flash"),
        schema: z.object({
          lines: z.array(z.string()),
          risks: z.string().default(""),
        }),
        prompt: `You are the senior Quantity Surveyor doing a final review of a quotation for a South African client.
For EACH scope line below, produce a short professional customer-facing description (max 25 words) that will appear on the printed quote.
Then produce a short 'risks' note that flags any assumptions or exclusions the client should know about (max 60 words).

SCOPE LINES (in order — return the same count):
${reviewInput}`,
      });
      const lines = (object as any).lines as string[];
      if (Array.isArray(lines) && lines.length === built.length) {
        polishedDescriptions = lines.map((l, i) => l?.trim() || built[i].description);
      }
      qsNotes = String((object as any).risks || "").trim();
    } catch (err: any) {
      console.warn("[generateQuoteStudio] QS review polish failed — using raw descriptions:", err?.message);
    }

    // ── Roll up whole-quote totals ───────────────────────────────────
    const totalCost = built.reduce((s, b) => s + (b.bom?.costPrice ?? 0), 0);
    const totalPrice = built.reduce((s, b) => s + (b.bom?.suggestedPrice ?? 0), 0);
    const overallMargin = totalPrice > 0 ? (totalPrice - totalCost) / totalPrice : 0;

    const lineItems = built.map((b, i) => ({
      idx: i,
      description: polishedDescriptions[i],
      originalBriefLine: b.description,
      matchedTaskName: b.matchedTaskName,
      quantity: b.quantity,
      unitOfMeasure: b.unitOfMeasure,
      unitPrice: b.bom?.perUnitPrice ?? 0,
      total: b.bom?.suggestedPrice ?? 0,
      cost: b.bom?.costPrice ?? 0,
      marginPct: b.bom?.marginPct ?? 0,
      unmatched: b.unmatched === true,
      warnings: b.bom?.warnings ?? [],
      bom: b.bom
        ? {
            taskId: b.bom.taskId,
            category: b.bom.category,
            materials: b.bom.materials,
            labour: b.bom.labour,
            materialsCost: b.bom.materialsCost,
            labourCost: b.bom.labourCost,
            overheadCost: b.bom.overheadCost,
            costPrice: b.bom.costPrice,
            suggestedPrice: b.bom.suggestedPrice,
            targetMarginPct: b.bom.targetMarginPct,
          }
        : null,
    }));

    return {
      brief: input.brief,
      mode: input.mode,
      clientId: input.clientId ?? null,
      clientBuildingId: input.clientBuildingId ?? null,
      lineItems,
      totalCost,
      totalPrice,
      overallMarginPct: overallMargin,
      qsNotes,
      generatedAt: new Date().toISOString(),
      catalogSize: tasks.length,
    };
  });

// ─────────────────────────────────────────────────────────────────────
// persistStudioQuote — writes the studio proposal to Quotation +
// QuotationLineItem + QuotationBOMLine so it enters the normal workflow.
// ─────────────────────────────────────────────────────────────────────
export const persistStudioQuote = baseProcedure
  .input(
    z.object({
      token: z.string(),
      brief: z.string(),
      clientId: z.number().int().nullable().optional(),
      clientBuildingId: z.number().int().nullable().optional(),
      customerName: z.string().min(1),
      customerEmail: z.string().email().optional().nullable(),
      customerPhone: z.string().optional().nullable(),
      address: z.string().optional().nullable(),
      lineItems: z.array(
        z.object({
          description: z.string(),
          quantity: z.number(),
          unitOfMeasure: z.string(),
          unitPrice: z.number(),
          total: z.number(),
          cost: z.number().optional(),
          bom: z
            .object({
              taskId: z.number().int().nullable().optional(),
              category: z.string().optional(),
              materials: z.array(z.any()).optional(),
              labour: z.array(z.any()).optional(),
            })
            .nullable()
            .optional(),
        })
      ),
      qsNotes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAccess(user.role);

    const subtotal = input.lineItems.reduce((s, l) => s + l.total, 0);

    const created = await db.$transaction(async (tx) => {
      // Generate next quote number using existing prefix pattern.
      const last = await tx.quotation.findFirst({
        orderBy: { id: "desc" },
        select: { quoteNumber: true },
      });
      const nextNum = nextQuoteNumber(last?.quoteNumber ?? null);

      const itemsJson = input.lineItems.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitOfMeasure: l.unitOfMeasure,
        unitPrice: l.unitPrice,
        total: l.total,
      }));

      const totalCost = input.lineItems.reduce((s, l) => s + (l.cost ?? 0), 0);

      const q = await tx.quotation.create({
        data: {
          quoteNumber: nextNum,
          customerName: input.customerName,
          customerEmail: input.customerEmail ?? "",
          customerPhone: input.customerPhone ?? "",
          address: input.address ?? "",
          items: itemsJson as any,
          subtotal,
          total: subtotal,
          companyMaterialCost: 0,
          companyLabourCost: 0,
          estimatedProfit: subtotal - totalCost,
          projectDescription: input.brief,
          notes: input.qsNotes ? `AI QS notes:\n${input.qsNotes}` : undefined,
          status: "DRAFT" as any,
          createdById: user.id,
          clientId: input.clientId ?? undefined,
          clientBuildingId: input.clientBuildingId ?? undefined,
          pictures: [],
        },
      });

      // Create line items.
      for (let i = 0; i < input.lineItems.length; i++) {
        const l = input.lineItems[i];
        const lineItem = await tx.quotationLineItem.create({
          data: {
            quotationId: q.id,
            description: l.description,
            quantity: l.quantity,
            unitOfMeasure: l.unitOfMeasure,
            unitPrice: l.unitPrice,
            total: l.total,
          },
        });

        // BOM breakdown persisted as QuotationBOMLine rows.
        const materials = (l.bom?.materials as any[]) ?? [];
        const labour = (l.bom?.labour as any[]) ?? [];

        for (const m of materials) {
          await tx.quotationBOMLine.create({
            data: {
              quotationId: q.id,
              quotationLineItemId: lineItem.id,
              lineItemIndex: i,
              kind: "MATERIAL",
              materialId: m.materialId ?? null,
              supplierId: m.supplierId ?? null,
              description: `${m.materialName} × ${m.packsNeeded}`,
              quantity: m.packsNeeded ?? 0,
              unit: m.packUnit ?? "ea",
              unitPrice: m.unitPricePerPack ?? 0,
              total: m.costTotal ?? 0,
              wastagePct: m.wastagePct ?? 0,
              sourceUrl: m.sourceUrl ?? null,
              notes: m.coverageCheck?.note ?? null,
            },
          });
        }
        for (const lb of labour) {
          await tx.quotationBOMLine.create({
            data: {
              quotationId: q.id,
              quotationLineItemId: lineItem.id,
              lineItemIndex: i,
              kind: "LABOUR",
              labourRoleId: lb.labourRoleId ?? null,
              description: `${lb.name} × ${lb.crewCount}`,
              quantity: lb.personDays ?? 0,
              unit: "person-day",
              unitPrice: lb.effectiveDailyRate ?? 0,
              total: lb.costTotal ?? 0,
            },
          });
        }
      }

      return q;
    });

    return { quotationId: created.id, quoteNumber: created.quoteNumber };
  });

// Simple next-number generator: uses the same "Q-YYYY-NNNN" scheme
// as existing quotations when present; otherwise Q-<epoch>.
function nextQuoteNumber(lastNumber: string | null) {
  const year = new Date().getFullYear();
  const prefix = `Q-${year}-`;
  if (lastNumber && lastNumber.startsWith(prefix)) {
    const n = parseInt(lastNumber.slice(prefix.length), 10);
    if (!Number.isNaN(n)) return `${prefix}${String(n + 1).padStart(4, "0")}`;
  }
  return `${prefix}0001`;
}
