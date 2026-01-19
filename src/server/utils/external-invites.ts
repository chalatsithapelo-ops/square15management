import { db } from "~/server/db";
import { getBaseUrl } from "~/server/utils/base-url";
import { ExternalTokenType, generateExternalToken } from "~/server/utils/external-submissions";

export async function createExternalSubmissionInvite(params: {
  type: ExternalTokenType;
  email: string;
  name?: string | null;
  rfqId?: number;
  orderId?: number;
  expiresInDays?: number;
}) {
  const token = generateExternalToken();
  const expiresAt = params.expiresInDays
    ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const record = await db.externalSubmissionToken.create({
    data: {
      type: params.type,
      token,
      email: params.email,
      name: params.name || null,
      rfqId: params.rfqId || null,
      orderId: params.orderId || null,
      expiresAt,
    },
  });

  const baseUrl = getBaseUrl();
  const link = (() => {
    if (params.type === "RFQ_QUOTE") return `${baseUrl}/external/rfq/${token}`;
    if (params.type === "ORDER_ACCEPT") return `${baseUrl}/external/order/${token}`;
    return `${baseUrl}/external/order/${token}/invoice`;
  })();

  return { record, link };
}
