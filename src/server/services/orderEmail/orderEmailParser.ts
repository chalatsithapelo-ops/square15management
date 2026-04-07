/**
 * Order Email Parser — uses Gemini AI to extract structured order data
 * from incoming customer/property-manager emails.
 */

import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "~/server/db";
import { getCompanyDetails } from "~/server/utils/company-details";
import crypto from "crypto";

export interface ParsedOrderEmail {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  serviceType: string;
  description: string;
  urgency: "LOW" | "NORMAL" | "HIGH" | "EMERGENCY";
  notes: string | null;
  confidence: number;
}

/**
 * Generate a dedup hash from email metadata
 */
export function createOrderEmailHash(
  fromEmail: string,
  subject: string,
  receivedAt: Date
): string {
  const raw = `${fromEmail}|${subject}|${receivedAt.toISOString().split("T")[0]}`;
  return crypto.createHash("md5").update(raw).digest("hex");
}

/**
 * Use Gemini AI to extract structured order data from an email
 */
export async function extractOrderFromEmail(
  fromEmail: string,
  fromName: string | null,
  subject: string,
  body: string
): Promise<ParsedOrderEmail> {
  const prompt = `You are an AI assistant for Square 15 Management, a South African property maintenance and construction company.

Extract structured order/job request information from the following email. The email is from a customer or property manager requesting maintenance, repair, or construction work.

EMAIL DETAILS:
From: ${fromName || "Unknown"} <${fromEmail}>
Subject: ${subject}
Body:
${body.substring(0, 3000)}

INSTRUCTIONS:
1. Extract the customer name (use "From" name if not stated in body)
2. Extract the customer email (use the From email)
3. Extract the customer phone number (look for SA numbers like 0XX XXX XXXX or +27). If not found, use "Not provided"
4. Extract the property/job address. If not explicitly stated, use any location mentioned
5. Determine the service type. Common types: Plumbing, Electrical, Painting, General Maintenance, Roofing, Tiling, Carpentry, Waterproofing, Renovations, Cleaning, Landscaping, Security, HVAC, Pest Control, Building Repairs
6. Create a clear job description summarizing what needs to be done
7. Assess urgency: LOW (routine), NORMAL (standard), HIGH (causing damage/inconvenience), EMERGENCY (immediate safety/water/electrical risk)
8. Extract any special notes, access instructions, or time constraints

Respond ONLY with valid JSON in this exact format (no markdown, no backticks):
{
  "customerName": "string",
  "customerEmail": "string",
  "customerPhone": "string",
  "address": "string",
  "serviceType": "string",
  "description": "string",
  "urgency": "LOW|NORMAL|HIGH|EMERGENCY",
  "notes": "string or null",
  "confidence": 0.0 to 1.0
}

Set confidence based on how much data was clearly available:
- 0.9+ : All key fields found in the email
- 0.7-0.9 : Most fields found, some inferred
- 0.5-0.7 : Significant inference needed
- Below 0.5 : Very unclear email, minimal data`;

  try {
    const result = await generateText({
      model: google("gemini-2.0-flash"),
      prompt,
      maxTokens: 500,
    });

    // Parse the AI response
    const text = result.text.trim();
    // Strip any markdown code fences the AI might add despite instructions
    const jsonStr = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    const parsed = JSON.parse(jsonStr);

    return {
      customerName: parsed.customerName || fromName || "Unknown",
      customerEmail: parsed.customerEmail || fromEmail,
      customerPhone: parsed.customerPhone || "Not provided",
      address: parsed.address || "Address not specified",
      serviceType: parsed.serviceType || "General Maintenance",
      description: parsed.description || subject,
      urgency: ["LOW", "NORMAL", "HIGH", "EMERGENCY"].includes(parsed.urgency)
        ? parsed.urgency
        : "NORMAL",
      notes: parsed.notes || null,
      confidence: typeof parsed.confidence === "number" ? Math.min(parsed.confidence, 1) : 0.5,
    };
  } catch (err: any) {
    console.error("[OrderEmail] AI extraction failed:", err.message);
    // Fallback: use basic email metadata
    return {
      customerName: fromName || fromEmail.split("@")[0],
      customerEmail: fromEmail,
      customerPhone: "Not provided",
      address: "Address not specified — check email",
      serviceType: "General Maintenance",
      description: `${subject}\n\n${body.substring(0, 500)}`,
      urgency: "NORMAL",
      notes: "AI extraction failed — please review email manually",
      confidence: 0.2,
    };
  }
}

/**
 * Process an incoming order email: extract data, create OrderEmailSource, create Order in PENDING_REVIEW
 */
export async function processOrderEmail(
  fromEmail: string,
  fromName: string | null,
  subject: string,
  body: string,
  receivedAt: Date
): Promise<{ orderId: number; orderNumber: string } | null> {
  // 1. Dedup check
  const hash = createOrderEmailHash(fromEmail, subject, receivedAt);
  const existing = await db.orderEmailSource.findUnique({
    where: { emailHash: hash },
  });
  if (existing) {
    console.log(`[OrderEmail] Duplicate email skipped: ${subject.substring(0, 60)}`);
    return null;
  }

  // 2. AI extraction
  const extracted = await extractOrderFromEmail(fromEmail, fromName, subject, body);

  // 3. Generate order number
  const companyDetails = await getCompanyDetails();
  const prefix = companyDetails.orderPrefix;
  const allOrders = await db.order.findMany({ select: { orderNumber: true } });
  let maxNum = 0;
  const prefixPattern = new RegExp(
    `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`
  );
  for (const o of allOrders) {
    const match = o.orderNumber.match(prefixPattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  let orderNumber = `${prefix}-${String(maxNum + 1).padStart(5, "0")}`;

  // Retry loop for race conditions
  for (let attempt = 0; attempt < 10; attempt++) {
    const exists = await db.order.findUnique({ where: { orderNumber } });
    if (!exists) break;
    maxNum++;
    orderNumber = `${prefix}-${String(maxNum + 1).padStart(5, "0")}`;
  }

  // 4. Create order in PENDING_REVIEW + email source in a single transaction
  const result = await db.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNumber,
        customerName: extracted.customerName,
        customerEmail: extracted.customerEmail,
        customerPhone: extracted.customerPhone,
        address: extracted.address,
        serviceType: extracted.serviceType,
        description: extracted.description,
        status: "PENDING_REVIEW",
        notes: extracted.urgency !== "NORMAL"
          ? `[${extracted.urgency} URGENCY] ${extracted.notes || ""}`
          : extracted.notes || null,
      },
    });

    await tx.orderEmailSource.create({
      data: {
        fromEmail,
        fromName,
        subject,
        bodyPreview: body.substring(0, 2000),
        receivedAt,
        emailHash: hash,
        aiExtracted: extracted as any,
        aiConfidence: extracted.confidence,
        status: "PENDING_REVIEW",
        orderId: order.id,
      },
    });

    return { orderId: order.id, orderNumber: order.orderNumber };
  });

  console.log(
    `[OrderEmail] Created order ${result.orderNumber} from email: "${subject.substring(0, 60)}" (confidence: ${(extracted.confidence * 100).toFixed(0)}%)`
  );

  return result;
}
