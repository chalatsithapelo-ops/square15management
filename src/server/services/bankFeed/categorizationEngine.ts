/**
 * AI Categorization Engine — 3-tier system:
 * 1. Rule-based matching (instant, user-defined patterns)
 * 2. AI classification via Gemini (for unknown transactions)
 * 3. Human review queue (low confidence results)
 *
 * Self-learning: user corrections create new rules automatically.
 */

import { db } from "~/server/db";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

// Category mapping for expenses (DEBIT transactions)
const EXPENSE_CATEGORIES = [
  "PETROL", "OFFICE_SUPPLIES", "RENT", "UTILITIES", "INSURANCE",
  "SALARIES", "MARKETING", "MAINTENANCE", "TRAVEL", "PROFESSIONAL_FEES",
  "TELECOMMUNICATIONS", "SOFTWARE_SUBSCRIPTIONS", "OTHER",
] as const;

// Revenue categories (CREDIT transactions)
const REVENUE_CATEGORIES = [
  "INVOICE_PAYMENT", "RENTAL_INCOME", "CONSULTING", "INTEREST",
  "INVESTMENTS", "COMMISSION", "REFUND", "OTHER_REVENUE",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type RevenueCategory = (typeof REVENUE_CATEGORIES)[number];

export interface CategorizationResult {
  category: string;
  subcategory?: string;
  confidence: number; // 0-100
  source: "RULE" | "AI" | "MANUAL";
  reasoning?: string;
  linkedEntityType?: string;
  linkedEntityId?: number;
}

/**
 * Categorize a transaction using the 3-tier engine.
 */
export async function categorizeTransaction(
  transactionId: number,
  description: string,
  amount: number,
  transactionType: "DEBIT" | "CREDIT"
): Promise<void> {
  // Tier 1: Rule-based matching
  const ruleResult = await matchByRules(description, amount, transactionType);
  if (ruleResult) {
    await saveCategorization(transactionId, ruleResult);
    return;
  }

  // Tier 2: Invoice/Payment reference matching
  const refResult = await matchByReference(description, amount, transactionType);
  if (refResult) {
    await saveCategorization(transactionId, refResult);
    return;
  }

  // Tier 3: AI classification
  const aiResult = await classifyWithAI(description, amount, transactionType);
  await saveCategorization(transactionId, aiResult);
}

/**
 * Tier 1: Match against user-defined and system rules.
 */
async function matchByRules(
  description: string,
  amount: number,
  transactionType: "DEBIT" | "CREDIT"
): Promise<CategorizationResult | null> {
  const rules = await db.categorizationRule.findMany({
    where: { isActive: true },
    orderBy: { priority: "desc" },
  });

  const descLower = description.toLowerCase();

  for (const rule of rules) {
    // Check transaction type filter
    if (rule.transactionType && rule.transactionType !== transactionType) continue;

    // Check amount range
    if (rule.amountMin !== null && amount < rule.amountMin) continue;
    if (rule.amountMax !== null && amount > rule.amountMax) continue;

    // Check vendor exact match
    if (rule.vendor && !descLower.includes(rule.vendor.toLowerCase())) continue;

    // Check pattern (regex or keyword)
    try {
      const regex = new RegExp(rule.pattern, "i");
      if (!regex.test(description)) continue;
    } catch {
      // If not a valid regex, try keyword match
      if (!descLower.includes(rule.pattern.toLowerCase())) continue;
    }

    // Match found!
    await db.categorizationRule.update({
      where: { id: rule.id },
      data: { matchCount: { increment: 1 }, lastMatchedAt: new Date() },
    });

    return {
      category: rule.category,
      subcategory: rule.subcategory || undefined,
      confidence: 95,
      source: "RULE",
      reasoning: `Matched rule: "${rule.pattern}"${rule.vendor ? ` (vendor: ${rule.vendor})` : ""}`,
      linkedEntityType: rule.linkedEntityType || undefined,
    };
  }

  return null;
}

/**
 * Tier 2: Match by invoice/reference number in the description.
 */
async function matchByReference(
  description: string,
  amount: number,
  transactionType: "DEBIT" | "CREDIT"
): Promise<CategorizationResult | null> {
  // Look for invoice number patterns (INV-0042, QUO-123, etc.)
  const invoiceMatch = description.match(/\b(INV[-\s]?\d+)\b/i);
  if (invoiceMatch && transactionType === "CREDIT") {
    const invoiceNumber = invoiceMatch[1].replace(/\s/g, "-").toUpperCase();
    const invoice = await db.invoice.findFirst({
      where: { invoiceNumber: { contains: invoiceNumber, mode: "insensitive" } },
    });

    if (invoice) {
      return {
        category: "INVOICE_PAYMENT",
        confidence: 98,
        source: "RULE",
        reasoning: `Matched invoice reference: ${invoice.invoiceNumber}`,
        linkedEntityType: "INVOICE",
        linkedEntityId: invoice.id,
      };
    }
  }

  // Look for payment request references
  const paymentMatch = description.match(/\b(PAY[-\s]?\d+)\b/i);
  if (paymentMatch && transactionType === "DEBIT") {
    const paymentNumber = paymentMatch[1].replace(/\s/g, "-").toUpperCase();
    const payment = await db.paymentRequest.findFirst({
      where: { requestNumber: { contains: paymentNumber, mode: "insensitive" } },
    });

    if (payment) {
      return {
        category: "SALARIES",
        confidence: 95,
        source: "RULE",
        reasoning: `Matched payment request: ${payment.requestNumber}`,
        linkedEntityType: "PAYMENT_REQUEST",
        linkedEntityId: payment.id,
      };
    }
  }

  // Try matching by exact amount for recent unpaid invoices (CREDIT only)
  if (transactionType === "CREDIT" && amount > 0) {
    const recentInvoices = await db.invoice.findMany({
      where: {
        status: { in: ["SENT", "APPROVED", "OVERDUE"] },
        total: { gte: amount - 0.01, lte: amount + 0.01 },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    if (recentInvoices.length === 1) {
      return {
        category: "INVOICE_PAYMENT",
        confidence: 85,
        source: "RULE",
        reasoning: `Exact amount match with invoice ${recentInvoices[0].invoiceNumber} (R${amount})`,
        linkedEntityType: "INVOICE",
        linkedEntityId: recentInvoices[0].id,
      };
    }
  }

  return null;
}

/**
 * Tier 3: AI classification using Gemini.
 */
async function classifyWithAI(
  description: string,
  amount: number,
  transactionType: "DEBIT" | "CREDIT"
): Promise<CategorizationResult> {
  try {
    const categories =
      transactionType === "DEBIT"
        ? EXPENSE_CATEGORIES.join(", ")
        : REVENUE_CATEGORIES.join(", ");

    const prompt = `You are a South African business financial categorization assistant for a property management and facility solutions company.

Classify this bank transaction:
- Description: "${description}"
- Amount: R${amount.toFixed(2)}
- Type: ${transactionType}

Available categories: ${categories}

Common SA business patterns:
- ENGEN, SHELL, BP, CALTEX, SASOL → PETROL
- ESKOM, CITY POWER, MUNICIPAL, WATER → UTILITIES
- VODACOM, MTN, TELKOM, CELL C → TELECOMMUNICATIONS
- GOOGLE ADS, FACEBOOK, META → MARKETING
- SARS, TAX → PROFESSIONAL_FEES
- RENT, LEASE → RENT
- INSURANCE, OLD MUTUAL, SANLAM, DISCOVERY → INSURANCE
- SALARY, WAGES, PAYROLL → SALARIES
- HARDWARE, BUILDERS, PAINT → MAINTENANCE
- For CREDIT transactions: INVOICE_PAYMENT for client payments, RENTAL_INCOME for rent received

Respond in this EXACT JSON format (no markdown, no extra text):
{"category": "CATEGORY_NAME", "confidence": 85, "reasoning": "Brief explanation"}`;

    const result = await generateText({
      model: google("gemini-2.0-flash"),
      prompt,
      maxTokens: 200,
    });

    const text = result.text.trim();
    // Extract JSON from response
    const jsonMatch = text.match(/\{[^}]+\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        category: parsed.category || "OTHER",
        confidence: Math.min(parsed.confidence || 60, 90), // Cap AI confidence at 90
        source: "AI",
        reasoning: parsed.reasoning || "AI classification",
      };
    }
  } catch (err: any) {
    console.error("[BankFeed] AI categorization error:", err.message);
  }

  // Fallback if AI fails
  return {
    category: transactionType === "DEBIT" ? "OTHER" : "OTHER_REVENUE",
    confidence: 20,
    source: "AI",
    reasoning: "AI classification failed — requires manual review",
  };
}

/**
 * Save categorization to database.
 */
async function saveCategorization(
  transactionId: number,
  result: CategorizationResult
): Promise<void> {
  const autoConfirm = result.confidence >= 80;

  await db.transactionCategorization.create({
    data: {
      bankTransactionId: transactionId,
      category: result.category,
      subcategory: result.subcategory,
      confidence: result.confidence,
      suggestedBy: result.source,
      linkedEntityType: result.linkedEntityType,
      linkedEntityId: result.linkedEntityId,
      isConfirmed: autoConfirm,
      confirmedAt: autoConfirm ? new Date() : null,
      aiReasoning: result.reasoning,
    },
  });
}

/**
 * Re-categorize a transaction (user correction).
 * Also creates a new rule to learn from the correction.
 */
export async function recategorizeTransaction(
  transactionId: number,
  newCategory: string,
  userId: number,
  notes?: string,
  createRule: boolean = true
): Promise<void> {
  // Get the transaction
  const transaction = await db.bankTransaction.findUnique({
    where: { id: transactionId },
    include: { categorization: true },
  });
  if (!transaction) throw new Error("Transaction not found");

  // Update or create categorization
  if (transaction.categorization) {
    await db.transactionCategorization.update({
      where: { id: transaction.categorization.id },
      data: {
        category: newCategory,
        confidence: 100,
        suggestedBy: "MANUAL",
        isConfirmed: true,
        confirmedById: userId,
        confirmedAt: new Date(),
        notes,
      },
    });
  } else {
    await db.transactionCategorization.create({
      data: {
        bankTransactionId: transactionId,
        category: newCategory,
        confidence: 100,
        suggestedBy: "MANUAL",
        isConfirmed: true,
        confirmedById: userId,
        confirmedAt: new Date(),
        notes,
      },
    });
  }

  // Self-learning: create a rule from this correction
  if (createRule && transaction.description) {
    // Clean description for pattern
    const cleanDesc = transaction.description
      .replace(/[0-9]+/g, "\\d+") // Replace numbers with regex digit pattern
      .replace(/\s+/g, "\\s+")    // Normalize whitespace
      .substring(0, 100);

    // Check if a similar rule already exists
    const existingRule = await db.categorizationRule.findFirst({
      where: {
        pattern: { contains: transaction.description.substring(0, 20) },
        category: newCategory,
      },
    });

    if (!existingRule) {
      await db.categorizationRule.create({
        data: {
          pattern: cleanDesc,
          vendor: extractVendorName(transaction.description),
          category: newCategory,
          transactionType: transaction.transactionType as any,
          priority: 10, // User rules get medium priority
          isSystemRule: false,
          createdById: userId,
        },
      });
    }
  }
}

/**
 * Confirm an AI categorization without changing it.
 */
export async function confirmCategorization(
  transactionId: number,
  userId: number
): Promise<void> {
  await db.transactionCategorization.updateMany({
    where: { bankTransactionId: transactionId },
    data: {
      isConfirmed: true,
      confirmedById: userId,
      confirmedAt: new Date(),
    },
  });
}

/**
 * Extract a likely vendor name from description.
 */
function extractVendorName(description: string): string | undefined {
  // Remove common prefixes/suffixes
  const cleaned = description
    .replace(/^(POS PURCHASE|EFT|DEBIT ORDER|PAYMENT|TRANSFER)\s*/i, "")
    .replace(/\s*\d{2}\/\d{2}\/\d{4}.*$/, "") // Remove trailing dates
    .replace(/\s*R[\d,.]+.*$/, "") // Remove trailing amounts
    .trim();

  return cleaned.length > 2 ? cleaned.substring(0, 50) : undefined;
}
