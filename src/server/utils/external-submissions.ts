import crypto from "crypto";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";

export type ExternalTokenType = "RFQ_QUOTE" | "ORDER_ACCEPT" | "ORDER_INVOICE";

export function generateExternalToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function getValidExternalTokenRecord(token: string) {
  const record = await db.externalSubmissionToken.findUnique({
    where: { token },
    include: {
      rfq: {
        include: {
          propertyManager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      },
      order: {
        include: {
          propertyManager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!record) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "This link is invalid or has expired.",
    });
  }

  if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This link has expired.",
    });
  }

  return record;
}

export function assertNotUsed(record: { usedAt: Date | null }) {
  if (record.usedAt) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This link has already been used.",
    });
  }
}
