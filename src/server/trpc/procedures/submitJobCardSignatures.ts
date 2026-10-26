// Shared "sign the job card" mutation used by artisan, admin operations and
// admin invoices. Accepts an optional client signature block and an optional
// artisan signature block so a single mutation can capture one, the other or
// both at once. Idempotent: if a signature is already on file it will not be
// overwritten unless explicitly unset via clientUnavailableToSign=false.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { minioClient, minioBaseUrl } from "~/server/minio";
import { pushJobCardIfLinked } from "~/server/services/myBuildings/hooks";

async function uploadSignature(dataUrl: string, orderNumber: string, who: "client" | "artisan"): Promise<string> {
  const base64Match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (!base64Match) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid signature image format" });
  }
  const imageBuffer = Buffer.from(base64Match[1]!, "base64");
  if (imageBuffer.length > 2 * 1024 * 1024) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Signature image is too large" });
  }
  const timestamp = Date.now();
  const objectName = `signatures/${who}-signature-${orderNumber}-${timestamp}.png`;
  await minioClient.putObject("property-management", objectName, imageBuffer, imageBuffer.length, {
    "Content-Type": "image/png",
  });
  return `${minioBaseUrl}/property-management/${objectName}`;
}

export const submitJobCardSignatures = baseProcedure
  .input(z.object({
    token: z.string(),
    orderId: z.number(),
    isPMOrder: z.boolean().optional(),
    // Client (customer) signature block — optional so admin/artisan can add
    // just the artisan side, or vice-versa.
    clientSignatureDataUrl: z.string().optional(),
    clientRepName: z.string().optional(),
    // Artisan (technician) signature block.
    artisanSignatureDataUrl: z.string().optional(),
    artisanSignedByName: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    // Guard: at least one signature must be provided.
    if (!input.clientSignatureDataUrl && !input.artisanSignatureDataUrl) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Provide at least a client or artisan signature",
      });
    }

    // Load order (regular or property-manager)
    const isPM = !!input.isPMOrder;
    const existing = isPM
      ? await db.propertyManagerOrder.findUnique({
          where: { id: input.orderId },
          select: {
            id: true, orderNumber: true, assignedToId: true,
            signedJobCardUrl: true, clientRepSignDate: true,
            artisanSignatureUrl: true, artisanSignDate: true,
          },
        })
      : await db.order.findUnique({
          where: { id: input.orderId },
          select: {
            id: true, orderNumber: true, assignedToId: true,
            signedJobCardUrl: true, clientRepSignDate: true,
            artisanSignatureUrl: true, artisanSignDate: true,
            crew: { where: { leftAt: null }, select: { userId: true } },
          },
        });

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
    }

    // Basic access control: admins-tier + the artisan assigned to the job (or
    // an active crew member on regular orders) can sign.
    const adminRoles = ["SENIOR_ADMIN", "JUNIOR_ADMIN", "ADMIN", "MANAGER", "TECHNICAL_MANAGER"];
    const isAdminTier = adminRoles.includes(user.role);
    const isAssigned = existing.assignedToId === user.id;
    const isCrew = !isPM && Array.isArray((existing as any).crew) && (existing as any).crew.some((c: any) => c.userId === user.id);
    if (!isAdminTier && !isAssigned && !isCrew) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You don't have permission to sign this job card",
      });
    }

    const updates: any = {};

    // ---- Client signature ---------------------------------------------------
    if (input.clientSignatureDataUrl) {
      if (existing.signedJobCardUrl && existing.clientRepSignDate) {
        // Already signed — don't overwrite silently.
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Client has already signed this job card",
        });
      }
      if (!input.clientRepName || !input.clientRepName.trim()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Client representative name is required with a client signature",
        });
      }
      const url = await uploadSignature(input.clientSignatureDataUrl, existing.orderNumber, "client");
      updates.signedJobCardUrl = url;
      updates.clientRepName = input.clientRepName.trim();
      updates.clientRepSignDate = new Date();
      updates.clientUnavailableToSign = false;
      // If a pending remote signature token existed, invalidate it.
      updates.signatureRequestToken = null;
    }

    // ---- Artisan signature (regular Order + PropertyManagerOrder) ----------
    if (input.artisanSignatureDataUrl) {
      if ((existing as any).artisanSignatureUrl && (existing as any).artisanSignDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Artisan has already signed this job card",
        });
      }
      const url = await uploadSignature(input.artisanSignatureDataUrl, existing.orderNumber, "artisan");
      updates.artisanSignatureUrl = url;
      updates.artisanSignedByName =
        (input.artisanSignedByName && input.artisanSignedByName.trim()) ||
        `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
        user.email;
      updates.artisanSignDate = new Date();
    }

    if (Object.keys(updates).length === 0) {
      // Nothing was applied (e.g. artisan sig sent for a PM order).
      return { success: true, applied: [] as string[], orderNumber: existing.orderNumber };
    }

    if (isPM) {
      await db.propertyManagerOrder.update({ where: { id: existing.id }, data: updates });
    } else {
      await db.order.update({ where: { id: existing.id }, data: updates });
    }

          if (!isPM) {
        void pushJobCardIfLinked(input.orderId).catch((e) => console.error("[myBuildings] auto job-card push failed:", e?.message ?? e));
      }
      return {
      success: true,
      orderNumber: existing.orderNumber,
      applied: Object.keys(updates),
    };
  });
