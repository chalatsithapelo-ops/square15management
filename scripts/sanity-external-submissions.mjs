import dotenv from "dotenv";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import superjson from "superjson";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";

dotenv.config();

const baseUrl = process.env.SANITY_BASE_URL || "http://localhost:3000";
const trpcUrl = `${baseUrl}/trpc`;

const prisma = new PrismaClient();

function token() {
  return crypto.randomBytes(32).toString("hex");
}

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function trpcGet(path, input) {
  const serialized = superjson.serialize(input);
  const inputParam = encodeURIComponent(JSON.stringify(serialized));
  const url = `${trpcUrl}/${path}?input=${inputParam}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      // required by tRPC to negotiate JSON response
      "trpc-accept": "application/json",
    },
  });
  const payload = await res.json();

  if (!res.ok) {
    throw new Error(`tRPC GET ${path} failed: ${res.status} ${res.statusText} ${JSON.stringify(payload)}`);
  }

  // With superjson transformer, responses typically come as { result: { data: { json, meta } } }
  return payload?.result?.data?.json ?? payload?.result?.data;
}

async function main() {
  const client = createTRPCProxyClient({
    transformer: superjson,
    links: [
      httpBatchLink({ url: trpcUrl, transformer: superjson, maxURLLength: Infinity, fetch }),
    ],
  });

  const stamp = Date.now();
  const pmEmail = `pm_sanity_${stamp}@example.com`;
  const contractorEmail = `contractor_sanity_${stamp}@example.com`;

  const pm = await prisma.user.create({
    data: {
      email: pmEmail,
      password: "sanity_password_hash_placeholder",
      firstName: "Sanity",
      lastName: "PM",
      role: "PROPERTY_MANAGER",
    },
  });

  const rfq = await prisma.propertyManagerRFQ.create({
    data: {
      rfqNumber: `PMRFQ-${stamp}`,
      propertyManagerId: pm.id,
      title: "Sanity RFQ",
      description: "Sanity RFQ created by automated local test.",
      scopeOfWork: "Provide a quotation for the requested scope.",
      buildingName: "Sanity Building",
      buildingAddress: "123 Sanity Street",
      urgency: "NORMAL",
      status: "SUBMITTED",
      submittedDate: new Date(),
    },
  });

  const order = await prisma.propertyManagerOrder.create({
    data: {
      orderNumber: `PMO-${stamp}`,
      propertyManagerId: pm.id,
      title: "Sanity Order",
      description: "Sanity PM Order created by automated local test.",
      scopeOfWork: "Perform the work as described.",
      buildingName: "Sanity Building",
      buildingAddress: "123 Sanity Street",
      totalAmount: 123.45,
      status: "SUBMITTED",
      submittedDate: new Date(),
    },
  });

  const quoteToken = token();
  const acceptToken = token();
  const invoiceToken = token();

  await prisma.externalSubmissionToken.createMany({
    data: [
      {
        type: "RFQ_QUOTE",
        token: quoteToken,
        email: contractorEmail,
        rfqId: rfq.id,
        expiresAt: daysFromNow(7),
      },
      {
        type: "ORDER_ACCEPT",
        token: acceptToken,
        email: contractorEmail,
        orderId: order.id,
        expiresAt: daysFromNow(7),
      },
      {
        type: "ORDER_INVOICE",
        token: invoiceToken,
        email: contractorEmail,
        orderId: order.id,
        expiresAt: daysFromNow(7),
      },
    ],
  });

  const urls = {
    rfqQuote: `${baseUrl}/external/rfq/${quoteToken}`,
    orderAccept: `${baseUrl}/external/order/${acceptToken}`,
    orderInvoice: `${baseUrl}/external/order/${invoiceToken}/invoice`,
  };

  console.log("\nCreated sanity records:");
  console.log(JSON.stringify({ pm: { id: pm.id, email: pm.email }, rfq: { id: rfq.id, rfqNumber: rfq.rfqNumber }, order: { id: order.id, orderNumber: order.orderNumber }, urls }, null, 2));

  // 1) Verify public token context endpoints
  const rfqInfo = await trpcGet("getExternalSubmissionInfo", { token: quoteToken });
  const orderInfo = await trpcGet("getExternalSubmissionInfo", { token: acceptToken });

  console.log("\ngetExternalSubmissionInfo results:");
  console.log(JSON.stringify({ rfqType: rfqInfo.type, rfqNumber: rfqInfo.rfq?.rfqNumber, orderType: orderInfo.type, orderNumber: orderInfo.order?.orderNumber }, null, 2));

  // 2) Submit RFQ quotation (no attachments)
  const quoteResult = await client.submitExternalRFQQuotation.mutate({
    submissionToken: quoteToken,
    total: 500,
    notes: "Sanity quotation submitted via token.",
    attachments: [],
  });

  const rfqAfter = await prisma.propertyManagerRFQ.findUnique({ where: { id: rfq.id } });
  const quoteTokenAfter = await prisma.externalSubmissionToken.findUnique({ where: { token: quoteToken } });

  console.log("\nsubmitExternalRFQQuotation result:");
  console.log(JSON.stringify({ quoteResult, rfqStatusAfter: rfqAfter?.status, tokenUsedAt: quoteTokenAfter?.usedAt }, null, 2));

  // 3) Accept order
  const acceptResult = await client.acceptExternalOrder.mutate({
    submissionToken: acceptToken,
    notes: "Sanity acceptance via token.",
  });

  const orderAfterAccept = await prisma.propertyManagerOrder.findUnique({ where: { id: order.id } });
  const acceptTokenAfter = await prisma.externalSubmissionToken.findUnique({ where: { token: acceptToken } });

  console.log("\nacceptExternalOrder result:");
  console.log(JSON.stringify({ acceptedStatusAfter: orderAfterAccept?.status, acceptedDate: orderAfterAccept?.acceptedDate, tokenUsedAt: acceptTokenAfter?.usedAt }, null, 2));

  // 4) Submit invoice (requires >= 1 attachment URL)
  const invoiceResult = await client.submitExternalOrderInvoice.mutate({
    submissionToken: invoiceToken,
    invoiceTotal: 123.45,
    notes: "Sanity invoice submitted via token.",
    attachments: ["https://example.com/sanity-invoice.pdf"],
  });

  const invoiceTokenAfter = await prisma.externalSubmissionToken.findUnique({ where: { token: invoiceToken } });
  const createdInvoice = await prisma.propertyManagerInvoice.findUnique({ where: { id: invoiceResult.invoiceId } });

  console.log("\nsubmitExternalOrderInvoice result:");
  console.log(JSON.stringify({ invoiceResult, invoiceStatus: createdInvoice?.status, invoiceOrderId: createdInvoice?.orderId, tokenUsedAt: invoiceTokenAfter?.usedAt }, null, 2));

  console.log("\nSUCCESS: External submission flows completed end-to-end.");
  console.log("\nOpen these URLs in a browser to visually confirm the public pages render:");
  console.log(JSON.stringify(urls, null, 2));
}

main()
  .catch((err) => {
    console.error("\nFAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
