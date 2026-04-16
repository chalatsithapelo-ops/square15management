/**
 * Quote Email Parser — uses Gemini AI to extract structured quote-request data
 * from incoming customer/property-manager emails.
 */

import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "~/server/db";
import { getCompanyDetails } from "~/server/utils/company-details";
import crypto from "crypto";

export interface ParsedQuoteEmail {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  serviceType: string;
  description: string;
  items: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  urgency: "LOW" | "NORMAL" | "HIGH";
  notes: string | null;
  confidence: number;
}

/**
 * Generate a dedup hash from email metadata
 */
export function createQuoteEmailHash(
  fromEmail: string,
  subject: string,
  receivedAt: Date
): string {
  const raw = `quote|${fromEmail}|${subject}|${receivedAt.toISOString().split("T")[0]}`;
  return crypto.createHash("md5").update(raw).digest("hex");
}

/**
 * Use Gemini AI to extract structured quote-request data from an email
 */
export async function extractQuoteFromEmail(
  fromEmail: string,
  fromName: string | null,
  subject: string,
  body: string
): Promise<ParsedQuoteEmail> {
  const prompt = `You are an AI assistant for Square 15 Management, a South African property maintenance and construction company.

Extract structured quotation/quote request information from the following email. The email is from a customer or property manager requesting a price quote for maintenance, repair, or construction work.

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
6. Create a clear project description summarizing what the customer wants quoted
7. Try to extract line items if the email mentions specific items/services with quantities. If no specific items, create a single item from the description
8. Assess urgency: LOW (just getting prices), NORMAL (planning work), HIGH (urgent job needing quick quote)
9. Extract any special notes, access instructions, or time constraints

Respond ONLY with valid JSON in this exact format (no markdown, no backticks):
{
  "customerName": "string",
  "customerEmail": "string",
  "customerPhone": "string",
  "address": "string",
  "serviceType": "string",
  "description": "string",
  "items": [{"description": "string", "quantity": 1, "unitPrice": 0, "total": 0}],
  "urgency": "LOW|NORMAL|HIGH",
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
      maxTokens: 800,
    });

    const text = result.text.trim();
    const jsonStr = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    const parsed = JSON.parse(jsonStr);

    const items = Array.isArray(parsed.items) && parsed.items.length > 0
      ? parsed.items.map((item: any) => ({
          description: item.description || "Service",
          quantity: typeof item.quantity === "number" ? item.quantity : 1,
          unitPrice: typeof item.unitPrice === "number" ? item.unitPrice : 0,
          total: typeof item.total === "number" ? item.total : 0,
        }))
      : [{ description: parsed.description || subject, quantity: 1, unitPrice: 0, total: 0 }];

    return {
      customerName: parsed.customerName || fromName || "Unknown",
      customerEmail: parsed.customerEmail || fromEmail,
      customerPhone: parsed.customerPhone || "Not provided",
      address: parsed.address || "Address not specified",
      serviceType: parsed.serviceType || "General Maintenance",
      description: parsed.description || subject,
      items,
      urgency: ["LOW", "NORMAL", "HIGH"].includes(parsed.urgency)
        ? parsed.urgency
        : "NORMAL",
      notes: parsed.notes || null,
      confidence: typeof parsed.confidence === "number" ? Math.min(parsed.confidence, 1) : 0.5,
    };
  } catch (err: any) {
    console.error("[QuoteEmail] AI extraction failed:", err.message);
    return {
      customerName: fromName || fromEmail.split("@")[0],
      customerEmail: fromEmail,
      customerPhone: "Not provided",
      address: "Address not specified — check email",
      serviceType: "General Maintenance",
      description: `${subject}\n\n${body.substring(0, 500)}`,
      items: [{ description: subject || "Quote request", quantity: 1, unitPrice: 0, total: 0 }],
      urgency: "NORMAL",
      notes: "AI extraction failed — please review email manually",
      confidence: 0.2,
    };
  }
}

/**
 * Process an incoming quote-request email: extract data, create QuoteEmailSource, create Quotation in DRAFT
 */
export async function processQuoteEmail(
  fromEmail: string,
  fromName: string | null,
  subject: string,
  body: string,
  receivedAt: Date
): Promise<{ quotationId: number; quoteNumber: string } | null> {
  // 1. Dedup check
  const hash = createQuoteEmailHash(fromEmail, subject, receivedAt);
  const existing = await db.quoteEmailSource.findUnique({
    where: { emailHash: hash },
  });
  if (existing) {
    console.log(`[QuoteEmail] Duplicate email skipped: ${subject.substring(0, 60)}`);
    return null;
  }

  // 2. AI extraction
  const extracted = await extractQuoteFromEmail(fromEmail, fromName, subject, body);

  // 3. Generate quote number
  const companyDetails = await getCompanyDetails();
  const prefix = companyDetails.quotePrefix;
  const allQuotes = await db.quotation.findMany({ select: { quoteNumber: true } });
  let maxNum = 0;
  const prefixPattern = new RegExp(
    `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`
  );
  for (const q of allQuotes) {
    const match = q.quoteNumber.match(prefixPattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  let quoteNumber = `${prefix}-${String(maxNum + 1).padStart(5, "0")}`;

  // Retry loop for race conditions
  for (let attempt = 0; attempt < 10; attempt++) {
    const exists = await db.quotation.findUnique({ where: { quoteNumber } });
    if (!exists) break;
    maxNum++;
    quoteNumber = `${prefix}-${String(maxNum + 1).padStart(5, "0")}`;
  }

  // 4. Calculate totals
  const subtotal = extracted.items.reduce((sum, item) => sum + item.total, 0);

  // 5. Create quotation in DRAFT + email source in a single transaction
  const result = await db.$transaction(async (tx) => {
    const quotation = await tx.quotation.create({
      data: {
        quoteNumber,
        customerName: extracted.customerName,
        customerEmail: extracted.customerEmail,
        customerPhone: extracted.customerPhone,
        address: extracted.address,
        projectDescription: extracted.description,
        items: extracted.items,
        subtotal,
        tax: 0,
        total: subtotal,
        status: "DRAFT",
        notes: extracted.urgency !== "NORMAL"
          ? `[${extracted.urgency} URGENCY] ${extracted.notes || ""} [From email: ${fromEmail}]`
          : `${extracted.notes || ""} [From email: ${fromEmail}]`.trim(),
      },
    });

    await tx.quoteEmailSource.create({
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
        quotationId: quotation.id,
      },
    });

    return { quotationId: quotation.id, quoteNumber: quotation.quoteNumber };
  });

  console.log(
    `[QuoteEmail] Created quotation ${result.quoteNumber} from email: "${subject.substring(0, 60)}" (confidence: ${(extracted.confidence * 100).toFixed(0)}%)`
  );

  return result;
}
