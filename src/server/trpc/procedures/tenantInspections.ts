// PR-5 — Tenant inspection procedures.
// Court-ready ingoing/outgoing inspections with photo capture, tenant signature
// magic-link, and side-by-side comparison.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomBytes, createHash } from "crypto";
import PDFDocument from "pdfkit";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
import { createNotification } from "~/server/utils/notifications";
import { sendEmail } from "~/server/utils/email";
import { uploadBufferToMinio } from "~/server/utils/minioUpload";
import { STANDARD_TEMPLATES, getStandardTemplate } from "~/server/utils/inspectionTemplates";

const PM_ROLES = ["PROPERTY_MANAGER", "ADMIN", "SENIOR_ADMIN", "TECHNICAL_MANAGER", "MANAGER"];

function ensurePm(role: string) {
  if (!PM_ROLES.includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Property managers only" });
  }
}

function newInspectionNumber(year: number, n: number) {
  return `INSP-${year}-${String(n).padStart(5, "0")}`;
}

// -----------------------------------------------------------------------------
// Templates
// -----------------------------------------------------------------------------

export const getInspectionTemplates = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensurePm(user.role);

    // Standard system templates + PM's own templates
    const pmTemplates = await db.inspectionTemplate.findMany({
      where: { OR: [{ propertyManagerId: user.id }, { propertyManagerId: null }] },
      orderBy: { name: "asc" },
    });

    return {
      systemTemplates: STANDARD_TEMPLATES.map((t) => ({
        key: t.key,
        name: t.name,
        description: t.description,
        buildingType: t.buildingType,
        roomCount: t.rooms.length,
        itemCount: t.rooms.reduce((sum, r) => sum + r.items.length, 0),
      })),
      customTemplates: pmTemplates,
    };
  });

export const createInspectionTemplate = baseProcedure
  .input(z.object({
    token: z.string(),
    name: z.string().min(1),
    description: z.string().optional(),
    buildingType: z.string().optional(),
    rooms: z.array(z.object({
      name: z.string(),
      type: z.string(),
      displayOrder: z.number().default(0),
      items: z.array(z.object({ name: z.string(), category: z.string().optional() })),
    })),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensurePm(user.role);
    return db.inspectionTemplate.create({
      data: {
        propertyManagerId: user.id,
        name: input.name,
        description: input.description,
        buildingType: input.buildingType,
        rooms: input.rooms as any,
      },
    });
  });

export const deleteInspectionTemplate = baseProcedure
  .input(z.object({ token: z.string(), id: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensurePm(user.role);
    const t = await db.inspectionTemplate.findUnique({ where: { id: input.id } });
    if (!t) throw new TRPCError({ code: "NOT_FOUND" });
    if (user.role === "PROPERTY_MANAGER" && t.propertyManagerId !== user.id) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    await db.inspectionTemplate.delete({ where: { id: input.id } });
    return { success: true };
  });

// -----------------------------------------------------------------------------
// Create inspection
// -----------------------------------------------------------------------------

export const createTenantInspection = baseProcedure
  .input(z.object({
    token: z.string(),
    buildingId: z.number(),
    unitNumber: z.string().optional(),
    type: z.enum(["INGOING", "OUTGOING"]),
    tenantName: z.string().min(1),
    tenantEmail: z.string().email(),
    tenantPhone: z.string().optional(),
    tenantIdNumber: z.string().optional(),
    scheduledFor: z.string().optional(), // ISO
    // Template option: pick a system template OR a saved custom template OR no template
    systemTemplateKey: z.string().optional(),
    customTemplateId: z.number().optional(),
    // For outgoing: link to ingoing
    linkedIngoingId: z.number().optional(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensurePm(user.role);

    // Verify building belongs to PM
    const building = await db.building.findUnique({ where: { id: input.buildingId } });
    if (!building) throw new TRPCError({ code: "NOT_FOUND", message: "Building not found" });
    if (user.role === "PROPERTY_MANAGER" && building.propertyManagerId !== user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not your building" });
    }

    // Generate inspection number
    const year = new Date().getFullYear();
    const yearStart = new Date(year, 0, 1);
    const count = await db.tenantInspection.count({ where: { createdAt: { gte: yearStart } } });
    const inspectionNumber = newInspectionNumber(year, count + 1);

    // Resolve template rooms
    let templateRooms: any[] = [];
    if (input.systemTemplateKey) {
      const t = getStandardTemplate(input.systemTemplateKey);
      if (t) templateRooms = t.rooms;
    } else if (input.customTemplateId) {
      const t = await db.inspectionTemplate.findUnique({ where: { id: input.customTemplateId } });
      if (t && Array.isArray(t.rooms)) templateRooms = t.rooms as any[];
    }

    const inspection = await db.tenantInspection.create({
      data: {
        inspectionNumber,
        type: input.type,
        status: input.scheduledFor ? "SCHEDULED" : "DRAFT",
        buildingId: input.buildingId,
        unitNumber: input.unitNumber,
        tenantName: input.tenantName,
        tenantEmail: input.tenantEmail,
        tenantPhone: input.tenantPhone,
        tenantIdNumber: input.tenantIdNumber,
        propertyManagerId: user.role === "PROPERTY_MANAGER" ? user.id : (building.propertyManagerId),
        conductedById: user.id,
        scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
        linkedIngoingId: input.linkedIngoingId ?? null,
        rooms: {
          create: templateRooms.map((r, i) => ({
            roomName: r.name,
            roomType: r.type,
            displayOrder: r.displayOrder ?? i,
            items: {
              create: (r.items ?? []).map((it: any, j: number) => ({
                itemName: it.name,
                category: it.category,
                displayOrder: j,
              })),
            },
          })),
        },
      },
      include: { rooms: { include: { items: true } } },
    });

    if (input.scheduledFor) {
      try {
        await createNotification({
          recipientId: inspection.propertyManagerId,
          recipientRole: "PROPERTY_MANAGER",
          message: `Inspection ${inspectionNumber} scheduled for ${input.tenantName}`,
          type: "INSPECTION_SCHEDULED" as any,
          relatedEntityId: inspection.id,
          relatedEntityType: "TenantInspection",
        });
      } catch {}
    }

    return inspection;
  });

// -----------------------------------------------------------------------------
// List / get / update inspection
// -----------------------------------------------------------------------------

export const getInspections = baseProcedure
  .input(z.object({
    token: z.string(),
    status: z.enum(["DRAFT","SCHEDULED","IN_PROGRESS","TENANT_REVIEW","COMPLETED","DISPUTED","CANCELLED","all"]).default("all"),
    type: z.enum(["INGOING","OUTGOING","all"]).default("all"),
    buildingId: z.number().optional(),
  }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensurePm(user.role);

    const where: any = {};
    if (user.role === "PROPERTY_MANAGER") where.propertyManagerId = user.id;
    if (input.status !== "all") where.status = input.status;
    if (input.type !== "all") where.type = input.type;
    if (input.buildingId) where.buildingId = input.buildingId;

    return db.tenantInspection.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        building: { select: { id: true, name: true, address: true } },
        conductedBy: { select: { id: true, firstName: true, lastName: true } },
        rooms: { select: { id: true } },
      },
    });
  });

export const getInspectionDetail = baseProcedure
  .input(z.object({ token: z.string(), id: z.number() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensurePm(user.role);

    const insp = await db.tenantInspection.findUnique({
      where: { id: input.id },
      include: {
        building: true,
        conductedBy: { select: { id: true, firstName: true, lastName: true } },
        propertyManager: { select: { id: true, firstName: true, lastName: true } },
        rooms: { include: { items: true }, orderBy: { displayOrder: "asc" } },
        linkedIngoing: { select: { id: true, inspectionNumber: true } },
      },
    });
    if (!insp) throw new TRPCError({ code: "NOT_FOUND" });
    if (user.role === "PROPERTY_MANAGER" && insp.propertyManagerId !== user.id) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return insp;
  });

export const updateInspectionItem = baseProcedure
  .input(z.object({
    token: z.string(),
    itemId: z.number(),
    condition: z.enum(["EXCELLENT","GOOD","FAIR","POOR","DAMAGED","NOT_APPLICABLE"]).optional(),
    notes: z.string().optional(),
    photoUrls: z.array(z.string()).optional(),
    repairRequired: z.boolean().optional(),
    estimatedRepairCost: z.number().optional(),
    tenantLiable: z.boolean().optional(),
    isNewDamage: z.boolean().optional(),
    isPreExisting: z.boolean().optional(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensurePm(user.role);

    const item = await db.tenantInspectionItem.findUnique({
      where: { id: input.itemId },
      include: { room: { include: { inspection: true } } },
    });
    if (!item) throw new TRPCError({ code: "NOT_FOUND" });
    if (user.role === "PROPERTY_MANAGER" && item.room.inspection.propertyManagerId !== user.id) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    if (item.room.inspection.status === "COMPLETED") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Inspection already completed" });
    }

    return db.tenantInspectionItem.update({
      where: { id: input.itemId },
      data: {
        condition: input.condition,
        notes: input.notes,
        photoUrls: input.photoUrls,
        repairRequired: input.repairRequired,
        estimatedRepairCost: input.estimatedRepairCost,
        tenantLiable: input.tenantLiable,
        isNewDamage: input.isNewDamage,
        isPreExisting: input.isPreExisting,
      },
    });
  });

export const updateInspectionRoom = baseProcedure
  .input(z.object({
    token: z.string(),
    roomId: z.number(),
    overallCondition: z.enum(["EXCELLENT","GOOD","FAIR","POOR","DAMAGED","NOT_APPLICABLE"]).optional(),
    notes: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensurePm(user.role);
    const room = await db.tenantInspectionRoom.findUnique({
      where: { id: input.roomId },
      include: { inspection: true },
    });
    if (!room) throw new TRPCError({ code: "NOT_FOUND" });
    if (user.role === "PROPERTY_MANAGER" && room.inspection.propertyManagerId !== user.id) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return db.tenantInspectionRoom.update({
      where: { id: input.roomId },
      data: { overallCondition: input.overallCondition, notes: input.notes },
    });
  });

export const updateInspectionMeta = baseProcedure
  .input(z.object({
    token: z.string(),
    id: z.number(),
    generalNotes: z.string().optional(),
    weatherConditions: z.string().optional(),
    meterReadings: z.any().optional(),
    keyHandover: z.any().optional(),
    depositAmount: z.number().optional(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensurePm(user.role);
    const insp = await db.tenantInspection.findUnique({ where: { id: input.id } });
    if (!insp) throw new TRPCError({ code: "NOT_FOUND" });
    if (user.role === "PROPERTY_MANAGER" && insp.propertyManagerId !== user.id) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return db.tenantInspection.update({
      where: { id: input.id },
      data: {
        generalNotes: input.generalNotes,
        weatherConditions: input.weatherConditions,
        meterReadings: input.meterReadings,
        keyHandover: input.keyHandover,
        depositAmount: input.depositAmount,
      },
    });
  });

// -----------------------------------------------------------------------------
// Finalize & tenant signature flow
// -----------------------------------------------------------------------------

export const finalizeInspection = baseProcedure
  .input(z.object({ token: z.string(), id: z.number(), pmSignatureUrl: z.string().optional() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensurePm(user.role);

    const insp = await db.tenantInspection.findUnique({
      where: { id: input.id },
      include: { rooms: { include: { items: true } } },
    });
    if (!insp) throw new TRPCError({ code: "NOT_FOUND" });
    if (user.role === "PROPERTY_MANAGER" && insp.propertyManagerId !== user.id) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const token = randomBytes(24).toString("hex");
    const tokenExpiry = new Date(Date.now() + 14 * 86400000); // 14 days

    // Compute damages for outgoing
    let totalDamageCost = 0;
    if (insp.type === "OUTGOING") {
      for (const r of insp.rooms) {
        for (const it of r.items) {
          if (it.tenantLiable && it.estimatedRepairCost) totalDamageCost += it.estimatedRepairCost;
        }
      }
    }

    const updated = await db.tenantInspection.update({
      where: { id: input.id },
      data: {
        status: "TENANT_REVIEW",
        completedAt: new Date(),
        pmSignatureUrl: input.pmSignatureUrl,
        pmSignedAt: input.pmSignatureUrl ? new Date() : null,
        tenantSignatureToken: token,
        tenantTokenExpiresAt: tokenExpiry,
        totalDamageCost: insp.type === "OUTGOING" ? totalDamageCost : null,
      },
    });

    // Email tenant magic link
    const publicUrl = process.env.PUBLIC_APP_URL ?? "";
    const tenantLink = `${publicUrl}/tenant/inspection/${token}`;
    try {
      await sendEmail({
        to: insp.tenantEmail,
        subject: `[Square 15] Please review your ${insp.type.toLowerCase()} inspection ${insp.inspectionNumber}`,
        html: `
          <p>Hi ${insp.tenantName},</p>
          <p>Your property inspection for <strong>${insp.inspectionNumber}</strong> is ready for your review and signature.</p>
          <p><a href="${tenantLink}" style="background:#2563eb;color:white;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">Review and sign</a></p>
          <p style="font-size:12px;color:#666;">This link expires on ${tokenExpiry.toLocaleDateString()}.</p>
          ${insp.type === "OUTGOING" && totalDamageCost > 0 ? `<p>Note: deductions of <strong>R ${totalDamageCost.toFixed(2)}</strong> are proposed.</p>` : ""}
          <p>Thank you,<br/>Property Management</p>
        `,
      });
    } catch (e) {
      console.error("[Inspection] tenant email failed:", e);
    }

    try {
      await createNotification({
        recipientId: insp.propertyManagerId,
        recipientRole: "PROPERTY_MANAGER",
        message: `Inspection ${insp.inspectionNumber} sent to tenant for review.`,
        type: "INSPECTION_TENANT_REVIEW" as any,
        relatedEntityId: insp.id,
        relatedEntityType: "TenantInspection",
      });
    } catch {}

    return { ...updated, tenantLink };
  });

// -----------------------------------------------------------------------------
// Public tenant routes (no auth, use token)
// -----------------------------------------------------------------------------

export const getInspectionByToken = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const insp = await db.tenantInspection.findUnique({
      where: { tenantSignatureToken: input.token },
      include: {
        building: { select: { name: true, address: true } },
        rooms: { include: { items: true }, orderBy: { displayOrder: "asc" } },
      },
    });
    if (!insp) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid link" });
    if (insp.tenantTokenExpiresAt && insp.tenantTokenExpiresAt.getTime() < Date.now()) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Link expired" });
    }
    return insp;
  });

export const submitTenantSignature = baseProcedure
  .input(z.object({
    token: z.string(),
    signatureDataUrl: z.string(),
    accept: z.boolean(), // accept findings, or dispute
    disputeNotes: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    const insp = await db.tenantInspection.findUnique({ where: { tenantSignatureToken: input.token } });
    if (!insp) throw new TRPCError({ code: "NOT_FOUND" });
    if (insp.tenantTokenExpiresAt && insp.tenantTokenExpiresAt.getTime() < Date.now()) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Link expired" });
    }

    // Upload signature image to MinIO
    let signatureUrl = "";
    try {
      if (input.signatureDataUrl.startsWith("data:")) {
        const match = input.signatureDataUrl.match(/^data:(.+?);base64,(.+)$/);
        if (match) {
          const mime = match[1];
          const b64 = match[2];
          const buf = Buffer.from(b64, "base64");
          const ext = mime.split("/")[1] || "png";
          signatureUrl = await uploadBufferToMinio(buf, `inspections/${insp.inspectionNumber}-tenant-${Date.now()}.${ext}`, mime);
        }
      }
    } catch (e) {
      console.error("[Inspection] signature upload failed:", e);
    }

    const newStatus = input.accept ? "COMPLETED" : "DISPUTED";
    const updated = await db.tenantInspection.update({
      where: { id: insp.id },
      data: {
        tenantSignatureUrl: signatureUrl || insp.tenantSignatureUrl,
        tenantSignedAt: new Date(),
        status: newStatus,
        tenantDisputed: !input.accept,
        disputeNotes: input.disputeNotes ?? null,
        // Invalidate token after signing
        tenantSignatureToken: null,
      },
    });

    try {
      await createNotification({
        recipientId: insp.propertyManagerId,
        recipientRole: "PROPERTY_MANAGER",
        message: input.accept
          ? `Tenant signed inspection ${insp.inspectionNumber}.`
          : `Tenant DISPUTED inspection ${insp.inspectionNumber}.`,
        type: (input.accept ? "INSPECTION_COMPLETED" : "INSPECTION_DISPUTED") as any,
        relatedEntityId: insp.id,
        relatedEntityType: "TenantInspection",
      });
    } catch {}

    return updated;
  });

// -----------------------------------------------------------------------------
// Compare ingoing vs outgoing
// -----------------------------------------------------------------------------

export const compareInspections = baseProcedure
  .input(z.object({ token: z.string(), outgoingId: z.number() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensurePm(user.role);

    const outgoing = await db.tenantInspection.findUnique({
      where: { id: input.outgoingId },
      include: { rooms: { include: { items: true } }, linkedIngoing: true },
    });
    if (!outgoing) throw new TRPCError({ code: "NOT_FOUND" });
    if (user.role === "PROPERTY_MANAGER" && outgoing.propertyManagerId !== user.id) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    if (!outgoing.linkedIngoingId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No linked ingoing inspection" });
    }

    const ingoing = await db.tenantInspection.findUnique({
      where: { id: outgoing.linkedIngoingId },
      include: { rooms: { include: { items: true } } },
    });
    if (!ingoing) throw new TRPCError({ code: "NOT_FOUND", message: "Ingoing not found" });

    // Pair rooms by name (best-effort)
    const ingoingRoomsByName = new Map<string, typeof ingoing.rooms[number]>();
    for (const r of ingoing.rooms) ingoingRoomsByName.set(r.roomName.toLowerCase(), r);

    const diffs: any[] = [];
    let totalDamage = 0;
    for (const outRoom of outgoing.rooms) {
      const inRoom = ingoingRoomsByName.get(outRoom.roomName.toLowerCase());
      const inItemsByName = new Map<string, any>();
      if (inRoom) for (const it of inRoom.items) inItemsByName.set(it.itemName.toLowerCase(), it);

      for (const outItem of outRoom.items) {
        const inItem = inItemsByName.get(outItem.itemName.toLowerCase());
        const changed = !!inItem && inItem.condition !== outItem.condition;
        const newDamage = outItem.isNewDamage || (changed && (outItem.condition === "POOR" || outItem.condition === "DAMAGED"));
        if (newDamage || outItem.estimatedRepairCost) {
          if (outItem.tenantLiable && outItem.estimatedRepairCost) totalDamage += outItem.estimatedRepairCost;
          diffs.push({
            room: outRoom.roomName,
            item: outItem.itemName,
            ingoingCondition: inItem?.condition ?? null,
            outgoingCondition: outItem.condition,
            estimatedRepairCost: outItem.estimatedRepairCost ?? 0,
            tenantLiable: outItem.tenantLiable,
            outgoingPhotos: outItem.photoUrls,
            ingoingPhotos: inItem?.photoUrls ?? [],
          });
        }
      }
    }

    return {
      ingoing: { id: ingoing.id, inspectionNumber: ingoing.inspectionNumber, completedAt: ingoing.completedAt },
      outgoing: { id: outgoing.id, inspectionNumber: outgoing.inspectionNumber, completedAt: outgoing.completedAt },
      diffs,
      totalDamage,
      deposit: outgoing.depositAmount ?? 0,
    };
  });

// -----------------------------------------------------------------------------
// PDF report (court-ready, with hash & integrity fingerprint)
// -----------------------------------------------------------------------------

export const generateInspectionPdf = baseProcedure
  .input(z.object({ token: z.string(), id: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensurePm(user.role);

    const insp = await db.tenantInspection.findUnique({
      where: { id: input.id },
      include: {
        building: true,
        rooms: { include: { items: true }, orderBy: { displayOrder: "asc" } },
        conductedBy: true,
        propertyManager: true,
      },
    });
    if (!insp) throw new TRPCError({ code: "NOT_FOUND" });
    if (user.role === "PROPERTY_MANAGER" && insp.propertyManagerId !== user.id) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    // Build content hash for tamper detection
    const integrityPayload = JSON.stringify({
      id: insp.id,
      number: insp.inspectionNumber,
      type: insp.type,
      tenant: insp.tenantName,
      tenantSignedAt: insp.tenantSignedAt,
      pmSignedAt: insp.pmSignedAt,
      rooms: insp.rooms.map((r) => ({
        name: r.roomName,
        items: r.items.map((i) => ({ name: i.itemName, condition: i.condition, cost: i.estimatedRepairCost, liable: i.tenantLiable })),
      })),
    });
    const hash = createHash("sha256").update(integrityPayload).digest("hex");

    // Generate PDF
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Header
      doc.fontSize(18).fillColor("#1f2937").text(`Tenant Inspection Report — ${insp.type}`, { align: "center" });
      doc.moveDown(0.3);
      doc.fontSize(12).fillColor("#6b7280").text(insp.inspectionNumber, { align: "center" });
      doc.moveDown();

      doc.fontSize(11).fillColor("#000");
      doc.text(`Property: ${insp.building.name}`);
      doc.text(`Address: ${insp.building.address}${insp.unitNumber ? ` (Unit ${insp.unitNumber})` : ""}`);
      doc.text(`Tenant: ${insp.tenantName}`);
      doc.text(`Email: ${insp.tenantEmail}`);
      if (insp.tenantIdNumber) doc.text(`ID: ${insp.tenantIdNumber}`);
      doc.text(`Conducted by: ${insp.conductedBy ? `${insp.conductedBy.firstName} ${insp.conductedBy.lastName}` : "—"}`);
      doc.text(`Completed: ${insp.completedAt ? new Date(insp.completedAt).toISOString() : "—"}`);
      doc.text(`Tenant signed: ${insp.tenantSignedAt ? new Date(insp.tenantSignedAt).toISOString() : "Pending"}`);
      doc.moveDown();

      if (insp.meterReadings) {
        doc.fontSize(12).text("Meter readings:");
        doc.fontSize(10).text(JSON.stringify(insp.meterReadings, null, 2));
        doc.moveDown();
      }
      if (insp.keyHandover) {
        doc.fontSize(12).text("Key handover:");
        doc.fontSize(10).text(JSON.stringify(insp.keyHandover, null, 2));
        doc.moveDown();
      }
      if (insp.generalNotes) {
        doc.fontSize(12).text("General notes:");
        doc.fontSize(10).text(insp.generalNotes);
        doc.moveDown();
      }

      // Rooms
      for (const room of insp.rooms) {
        doc.addPage();
        doc.fontSize(14).fillColor("#1f2937").text(`${room.roomName} (${room.roomType})`);
        doc.fontSize(10).fillColor("#6b7280").text(`Overall: ${room.overallCondition}`);
        if (room.notes) doc.text(`Notes: ${room.notes}`);
        doc.moveDown(0.5);
        doc.fillColor("#000");

        for (const item of room.items) {
          doc.fontSize(10).text(
            `${item.itemName} — ${item.condition}${item.tenantLiable ? " (tenant liable)" : ""}` +
            (item.estimatedRepairCost ? ` — R ${item.estimatedRepairCost.toFixed(2)}` : "")
          );
          if (item.notes) doc.fontSize(9).fillColor("#374151").text(`   ${item.notes}`).fillColor("#000");
          if (item.photoUrls?.length) doc.fontSize(8).fillColor("#6b7280").text(`   ${item.photoUrls.length} photo(s)`).fillColor("#000");
        }
      }

      if (insp.type === "OUTGOING" && insp.totalDamageCost) {
        doc.addPage();
        doc.fontSize(14).text("Damage cost summary");
        doc.fontSize(11);
        doc.text(`Total damages: R ${insp.totalDamageCost.toFixed(2)}`);
        if (insp.depositAmount) doc.text(`Deposit held: R ${insp.depositAmount.toFixed(2)}`);
        if (insp.depositDeducted) doc.text(`Deducted: R ${insp.depositDeducted.toFixed(2)}`);
        if (insp.depositRefunded) doc.text(`Refunded: R ${insp.depositRefunded.toFixed(2)}`);
      }

      // Integrity footer
      doc.addPage();
      doc.fontSize(10).text("Integrity & audit", { underline: true });
      doc.fontSize(8).fillColor("#6b7280");
      doc.text(`SHA-256: ${hash}`);
      doc.text(`Generated: ${new Date().toISOString()}`);
      doc.text(`By: ${user.firstName} ${user.lastName} (${user.email})`);

      doc.end();
    });

    const url = await uploadBufferToMinio(buffer, `inspections/${insp.inspectionNumber}.pdf`, "application/pdf");

    await db.tenantInspection.update({
      where: { id: insp.id },
      data: { pdfReportUrl: url },
    });

    return { url, hash };
  });
