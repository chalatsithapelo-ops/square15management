import type { PrismaClient } from "@prisma/client";

export type AuditActor = {
  id: number;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

export type AuditEntityType =
  | "Quotation"
  | "Invoice"
  | "Order"
  | "PropertyManagerInvoice"
  | "PropertyManagerOrder"
  | "Statement"
  | "CreditNote"
  | "PaymentRequest"
  | "Lead"
  | "User"
  | "Project";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "STATUS_CHANGE"
  | "APPROVE"
  | "REJECT"
  | "CONVERT"
  | "ASSIGN"
  | "SEND"
  | "EXPORT"
  | "GENERATE_REPORT";

type WriteInput = {
  actor: AuditActor;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: number;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  description?: string;
  module?: string;
};

// Fields we never want in the diff (large blobs, noisy timestamps, internal ids)
const IGNORED_FIELDS = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "signatureData",
  "beforePictures",
  "afterPictures",
  "expenseSlips",
  "attachments",
  "pdfUrl",
]);

function shallowDiff(
  before?: Record<string, any> | null,
  after?: Record<string, any> | null
): Record<string, { from: any; to: any }> {
  if (!before || !after) return {};
  const changes: Record<string, { from: any; to: any }> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (IGNORED_FIELDS.has(k)) continue;
    const a = before[k];
    const b = after[k];
    // Skip objects/arrays for the diff to keep the payload small
    if (typeof a === "object" && a !== null) continue;
    if (typeof b === "object" && b !== null) continue;
    if (a !== b) changes[k] = { from: a ?? null, to: b ?? null };
  }
  return changes;
}

/**
 * Persist an audit entry. Never throws — audit logging must not break the parent mutation.
 */
export async function writeAuditLog(
  db: PrismaClient,
  input: WriteInput
): Promise<void> {
  try {
    const userName = [input.actor.firstName, input.actor.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || input.actor.email || `User #${input.actor.id}`;

    let changesJson: string | null = null;
    if (input.action === "UPDATE" && input.before && input.after) {
      const diff = shallowDiff(input.before, input.after);
      if (Object.keys(diff).length === 0) return; // nothing changed — skip
      changesJson = JSON.stringify(diff);
    } else if (input.after) {
      changesJson = JSON.stringify({ snapshot: input.after });
    } else if (input.before) {
      changesJson = JSON.stringify({ snapshot: input.before });
    }

    await db.auditLog.create({
      data: {
        userId: input.actor.id,
        userName,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        changes: changesJson,
        module: input.module ?? input.entityType.toLowerCase(),
        description: input.description ?? null,
      },
    });
  } catch (err) {
    console.error("[auditLog] Failed to write audit entry:", err);
  }
}
