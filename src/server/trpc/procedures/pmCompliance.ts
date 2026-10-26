// PR-4 — Property Manager Compliance Hub procedures.
// PM-scoped: PMs see only their assigned contractors.
// Senior admins see all.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
import { SA_DEFAULT_REQUIREMENTS } from "~/server/utils/complianceScoring";
import { runComplianceCheckOnce } from "~/server/services/complianceChecker";

const PM_ROLES = ["PROPERTY_MANAGER", "ADMIN", "SENIOR_ADMIN", "TECHNICAL_MANAGER", "MANAGER"];

function ensurePm(role: string) {
  if (!PM_ROLES.includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Property managers only" });
  }
}

/** Scope helper: returns the where clause that restricts contractors to those the user can see. */
function contractorScopeWhere(user: { id: number; role: string }): any {
  if (user.role === "PROPERTY_MANAGER") {
    return { propertyManagerId: user.id };
  }
  // admins see everything
  return {};
}

// -----------------------------------------------------------------------------
// PM dashboard — overview of all contractors I manage with their score band
// -----------------------------------------------------------------------------

export const getPmComplianceOverview = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensurePm(user.role);

    const contractors = await db.contractor.findMany({
      where: contractorScopeWhere(user),
      include: {
        complianceScore: true,
        documents: { select: { documentType: true, expiryDate: true } },
      },
      orderBy: [{ complianceScore: { score: "asc" } as any }, { lastName: "asc" }],
    });

    const counts = { green: 0, amber: 0, red: 0, unscored: 0, autoBlocked: 0 };
    for (const c of contractors) {
      if (c.autoBlocked) counts.autoBlocked++;
      if (!c.complianceScore) counts.unscored++;
      else if (c.complianceScore.band === "GREEN") counts.green++;
      else if (c.complianceScore.band === "AMBER") counts.amber++;
      else counts.red++;
    }

    return {
      contractors: contractors.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        companyName: c.companyName,
        serviceType: c.serviceType,
        status: c.status,
        autoBlocked: c.autoBlocked,
        autoBlockOverride: c.autoBlockOverride,
        autoBlockOverrideUntil: c.autoBlockOverrideUntil,
        score: c.complianceScore?.score ?? null,
        band: c.complianceScore?.band ?? null,
        missingCount: c.complianceScore?.missingCount ?? 0,
        expiredCount: c.complianceScore?.expiredCount ?? 0,
        expiringCount30d: c.complianceScore?.expiringCount30d ?? 0,
        computedAt: c.complianceScore?.computedAt ?? null,
      })),
      counts,
    };
  });

// -----------------------------------------------------------------------------
// Per-contractor compliance detail
// -----------------------------------------------------------------------------

export const getContractorCompliance = baseProcedure
  .input(z.object({ token: z.string(), contractorId: z.number() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensurePm(user.role);

    const c = await db.contractor.findUnique({
      where: { id: input.contractorId },
      include: {
        documents: { orderBy: { documentType: "asc" } },
        complianceScore: true,
        propertyManager: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Contractor not found" });

    if (user.role === "PROPERTY_MANAGER" && c.propertyManagerId !== user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not your contractor" });
    }

    // PM requirements applied to this contractor
    let requirements: any[] = SA_DEFAULT_REQUIREMENTS;
    if (c.propertyManagerId) {
      const pmReqs = await db.pmComplianceRequirement.findMany({
        where: { propertyManagerId: c.propertyManagerId, isActive: true },
      });
      if (pmReqs.length > 0) {
        requirements = pmReqs.filter((r) => !r.serviceTypeFilter || r.serviceTypeFilter === c.serviceType);
      }
    }

    return {
      contractor: {
        id: c.id, firstName: c.firstName, lastName: c.lastName, email: c.email,
        companyName: c.companyName, serviceType: c.serviceType, status: c.status,
        autoBlocked: c.autoBlocked, autoBlockedAt: c.autoBlockedAt,
        autoBlockOverride: c.autoBlockOverride, autoBlockOverrideUntil: c.autoBlockOverrideUntil,
        autoBlockOverrideReason: c.autoBlockOverrideReason,
        propertyManager: c.propertyManager,
      },
      score: c.complianceScore,
      documents: c.documents,
      requirements,
    };
  });

// -----------------------------------------------------------------------------
// PM custom requirements CRUD
// -----------------------------------------------------------------------------

export const listComplianceRequirements = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensurePm(user.role);

    const where = user.role === "PROPERTY_MANAGER" ? { propertyManagerId: user.id } : {};
    const rows = await db.pmComplianceRequirement.findMany({
      where,
      orderBy: [{ weight: "desc" }, { documentType: "asc" }],
    });
    return rows;
  });

export const upsertComplianceRequirement = baseProcedure
  .input(z.object({
    token: z.string(),
    id: z.number().optional(),
    documentType: z.string(),
    customLabel: z.string().nullable().optional(),
    weight: z.number().int().min(1).max(100).default(10),
    isMandatory: z.boolean().default(true),
    serviceTypeFilter: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    isActive: z.boolean().default(true),
    propertyManagerId: z.number().optional(), // admins managing on behalf of a PM
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensurePm(user.role);

    const ownerId = user.role === "PROPERTY_MANAGER" ? user.id : (input.propertyManagerId ?? user.id);

    if (input.id) {
      const existing = await db.pmComplianceRequirement.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Requirement not found" });
      if (user.role === "PROPERTY_MANAGER" && existing.propertyManagerId !== user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your requirement" });
      }
      return db.pmComplianceRequirement.update({
        where: { id: input.id },
        data: {
          documentType: input.documentType as any,
          customLabel: input.customLabel ?? null,
          weight: input.weight,
          isMandatory: input.isMandatory,
          serviceTypeFilter: input.serviceTypeFilter ?? null,
          notes: input.notes ?? null,
          isActive: input.isActive,
        },
      });
    }

    return db.pmComplianceRequirement.create({
      data: {
        propertyManagerId: ownerId,
        documentType: input.documentType as any,
        customLabel: input.customLabel ?? null,
        weight: input.weight,
        isMandatory: input.isMandatory,
        serviceTypeFilter: input.serviceTypeFilter ?? null,
        notes: input.notes ?? null,
        isActive: input.isActive,
      },
    });
  });

export const deleteComplianceRequirement = baseProcedure
  .input(z.object({ token: z.string(), id: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensurePm(user.role);

    const existing = await db.pmComplianceRequirement.findUnique({ where: { id: input.id } });
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Requirement not found" });
    if (user.role === "PROPERTY_MANAGER" && existing.propertyManagerId !== user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not your requirement" });
    }
    await db.pmComplianceRequirement.delete({ where: { id: input.id } });
    return { success: true };
  });

// Seed SA defaults for a PM (helpful first-time setup)
export const seedSaDefaultRequirements = baseProcedure
  .input(z.object({ token: z.string(), propertyManagerId: z.number().optional() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensurePm(user.role);

    const pmId = user.role === "PROPERTY_MANAGER" ? user.id : (input.propertyManagerId ?? user.id);
    const created = [];
    for (const r of SA_DEFAULT_REQUIREMENTS) {
      const existing = await db.pmComplianceRequirement.findFirst({
        where: { propertyManagerId: pmId, documentType: r.documentType as any, customLabel: null },
      });
      if (!existing) {
        const c = await db.pmComplianceRequirement.create({
          data: {
            propertyManagerId: pmId,
            documentType: r.documentType as any,
            weight: r.weight,
            isMandatory: r.isMandatory,
          },
        });
        created.push(c);
      }
    }
    return { created: created.length };
  });

// -----------------------------------------------------------------------------
// Manual recompute / admin override
// -----------------------------------------------------------------------------

export const recomputeContractorScore = baseProcedure
  .input(z.object({ token: z.string(), contractorId: z.number().optional() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!isAdmin(user) && user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    // For simplicity recompute all contractors (cheap on small DBs).
    const result = await runComplianceCheckOnce();
    return result;
  });

export const overrideContractorAutoBlock = baseProcedure
  .input(z.object({
    token: z.string(),
    contractorId: z.number(),
    until: z.string(),      // ISO date
    reason: z.string().min(3),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!isAdmin(user) && user.role !== "SENIOR_ADMIN") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
    }
    const updated = await db.contractor.update({
      where: { id: input.contractorId },
      data: {
        autoBlocked: false,
        autoBlockedAt: null,
        autoBlockOverride: true,
        autoBlockOverrideById: user.id,
        autoBlockOverrideUntil: new Date(input.until),
        autoBlockOverrideReason: input.reason,
      },
    });
    return updated;
  });

export const clearContractorAutoBlockOverride = baseProcedure
  .input(z.object({ token: z.string(), contractorId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!isAdmin(user) && user.role !== "SENIOR_ADMIN") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
    }
    return db.contractor.update({
      where: { id: input.contractorId },
      data: {
        autoBlockOverride: false,
        autoBlockOverrideUntil: null,
        autoBlockOverrideReason: null,
      },
    });
  });

// -----------------------------------------------------------------------------
// Document upload as PM (extends existing contractor doc pattern, with stricter validation)
// -----------------------------------------------------------------------------

export const uploadContractorDocumentAsPm = baseProcedure
  .input(z.object({
    token: z.string(),
    contractorId: z.number(),
    documentType: z.string(),
    title: z.string().min(1),
    description: z.string().optional(),
    fileUrl: z.string().url(),
    fileName: z.string().min(1),
    expiryDate: z.string().optional(), // ISO
    isRequired: z.boolean().default(false),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensurePm(user.role);

    const c = await db.contractor.findUnique({ where: { id: input.contractorId } });
    if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Contractor not found" });
    if (user.role === "PROPERTY_MANAGER" && c.propertyManagerId !== user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not your contractor" });
    }

    // Date-bound types must have an expiry date.
    const dateBound = new Set([
      "COIDA_LETTER", "TAX_CLEARANCE", "PUBLIC_LIABILITY", "LETTER_OF_GOOD_STANDING",
      "BBBEE_CERT", "WORK_AT_HEIGHTS", "MEDICAL_FITNESS",
    ]);
    if (dateBound.has(input.documentType) && !input.expiryDate) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "This document type requires an expiry date." });
    }

    const doc = await db.contractorDocument.create({
      data: {
        contractorId: input.contractorId,
        documentType: input.documentType as any,
        title: input.title,
        description: input.description,
        fileUrl: input.fileUrl,
        fileName: input.fileName,
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
        isRequired: input.isRequired,
        verifiedAt: user.role !== "PROPERTY_MANAGER" ? new Date() : null,
        verifiedById: user.role !== "PROPERTY_MANAGER" ? user.id : null,
      },
    });

    return doc;
  });
