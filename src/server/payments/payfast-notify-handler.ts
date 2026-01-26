import { eventHandler, getMethod } from "h3";
import { db } from "~/server/db";
import { env } from "~/server/env";
import { verifyPayfastSignature } from "~/server/payments/payfast";

async function readNodeRequestBody(event: any): Promise<string> {
  const req = event?.node?.req;
  if (!req) return "";

  return await new Promise<string>((resolve, reject) => {
    let body = "";
    req.setEncoding?.("utf8");
    req.on("data", (chunk: string) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", (err: unknown) => reject(err));
  });
}

function parseRegistrationId(mPaymentId: string | undefined): number | null {
  if (!mPaymentId) return null;
  const trimmed = mPaymentId.trim();
  if (!trimmed) return null;

  // We send m_payment_id like "reg_123".
  const match = /^reg_(\d+)$/.exec(trimmed);
  if (!match) return null;

  const id = Number(match[1]);
  return Number.isFinite(id) ? id : null;
}

function parseCustomerPaymentId(mPaymentId: string | undefined): number | null {
  if (!mPaymentId) return null;
  const trimmed = mPaymentId.trim();
  if (!trimmed) return null;

  // We send m_payment_id like "custpay_123".
  const match = /^custpay_(\d+)$/.exec(trimmed);
  if (!match) return null;

  const id = Number(match[1]);
  return Number.isFinite(id) ? id : null;
}

export default eventHandler(async (event: any) => {
  try {
    const res = event.node?.res;
    if (!res) {
      return "Internal Server Error";
    }

    const method = getMethod(event);
    if (method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return "Method Not Allowed";
    }

    const rawString = await readNodeRequestBody(event);

    if (!rawString) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return "Missing body";
    }

    const params = new URLSearchParams(rawString);
    const payload: Record<string, string> = {};
    for (const [k, v] of params.entries()) {
      payload[k] = v;
    }

  // Basic config validation
    if (
      env.PAYFAST_MERCHANT_ID &&
      payload.merchant_id &&
      payload.merchant_id !== env.PAYFAST_MERCHANT_ID
    ) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return "Invalid merchant_id";
    }

  // Signature validation
    if (!verifyPayfastSignature(payload)) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return "Invalid signature";
    }

  const paymentStatus = payload.payment_status;
  const registrationId = parseRegistrationId(payload.m_payment_id);
  const customerPaymentId = parseCustomerPaymentId(payload.m_payment_id);

  // If we can't map it to any known entity, acknowledge but do nothing.
    if (!registrationId && !customerPaymentId) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return "OK";
    }

  // Mark as paid only when complete.
    if (paymentStatus === "COMPLETE") {
      const pfPaymentId = payload.pf_payment_id || payload.payment_id || null;

      if (registrationId) {
        await db.pendingRegistration.updateMany({
          where: {
            id: registrationId,
            hasPaid: false,
          },
          data: {
            hasPaid: true,
            paymentId: pfPaymentId,
          },
        });
      }

      if (customerPaymentId) {
        const payment = await db.customerPayment.findUnique({
          where: { id: customerPaymentId },
        });

        if (payment && payment.status !== "APPROVED") {
          const updated = await db.customerPayment.update({
            where: { id: customerPaymentId },
            data: {
              status: "APPROVED",
              transactionReference: pfPaymentId,
              reviewedDate: new Date(),
              approvalNotes: "Auto-approved: PayFast payment COMPLETE",
            },
          });

          if (updated.propertyManagerId) {
            await db.notification.create({
              data: {
                recipientId: updated.propertyManagerId,
                recipientRole: "PROPERTY_MANAGER",
                type: "CUSTOMER_PAYMENT_APPROVED",
                message: `A tenant payment of R${updated.amount.toFixed(2)} was received via PayFast and auto-approved.`,
                isRead: false,
                relatedEntityType: "CUSTOMER_PAYMENT",
                relatedEntityId: updated.id,
              },
            });
          }
        }
      }
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return "OK";
  } catch (error) {
    console.log("[payfast-notify] handler error", error);
    const res = event.node?.res;
    if (!res) {
      return "Internal Server Error";
    }
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    if (env.NODE_ENV === "development") {
      const message = error instanceof Error ? error.message : String(error);
      return `Internal Server Error: ${message}`;
    }
    return "Internal Server Error";
  }
});
