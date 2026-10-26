/**
 * AI Categorization Engine — 3-tier system:
 * 1. Rule-based matching (instant, user-defined patterns)
 * 2. AI classification via Gemini (for unknown transactions)
 * 3. Human review queue (low confidence results)
 *
 * Self-learning: user corrections create new rules automatically.
 */

import { db } from "~/server/db";
import { reconcileTransaction } from "./reconciliationEngine";
import { NON_REVENUE_CREDIT_CATEGORIES } from "./invoicePaymentMatcher";
import { generateText } from "~/server/services/ai/controlledGeneration";
import { google } from "@ai-sdk/google";

// Category mapping for expenses (DEBIT transactions)
const EXPENSE_CATEGORIES = [
  "PETROL", "OFFICE_SUPPLIES", "RENT", "UTILITIES", "INSURANCE",
  "SALARIES", "MARKETING", "MATERIAL_PURCHASE", "INDEPENDENT_CONTRACTOR",
  "MAINTENANCE", "TRAVEL", "BANK_FEES", "PROFESSIONAL_FEES", "TELECOMMUNICATIONS",
  "SOFTWARE_SUBSCRIPTIONS", "LOAN_REPAYMENT", "VEHICLE_FINANCE", "HOME_BOND", "OTHER",
] as const;

// Financing outflows: tracked on the bank feed but never posted as operating expenses.
export const NON_EXPENSE_DEBIT_CATEGORIES = ["LOAN_REPAYMENT", "VEHICLE_FINANCE", "HOME_BOND"];

// Revenue categories (CREDIT transactions)
const REVENUE_CATEGORIES = [
  "INVOICE_PAYMENT", "RENTAL_INCOME", "CONSULTING", "INTEREST",
  "INVESTMENTS", "COMMISSION", "REFUND", "OWNER_CONTRIBUTION", "LOAN_RECEIVED",
  "INTERNAL_TRANSFER", "OTHER_REVENUE",
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

let aiCategorizationUnavailableUntil = 0;
let aiCategorizationUnavailableReason = "";

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

  // Tier 3: high-precision local merchant rules for common bank-feed entries.
  // Keep ambiguous cash withdrawals and generic transfers for AI/human review.
  const merchantResult = classifyKnownMerchant(description, transactionType);
  if (merchantResult) {
    await saveCategorization(transactionId, merchantResult);
    return;
  }

  // Tier 4: AI classification
  const aiResult = await classifyWithAI(description, amount, transactionType);
  await saveCategorization(transactionId, aiResult);
}

/** Reapply saved user rules and high-precision merchant rules to old uncategorized or AI-OTHER rows. */
export async function applySavedRulesToExistingTransactions(bankAccountIds: number[]): Promise<{ scanned: number; categorized: number }> {
  if (bankAccountIds.length === 0) return { scanned: 0, categorized: 0 };
  const transactions = await db.bankTransaction.findMany({
    where: {
      bankAccountId: { in: bankAccountIds },
      OR: [
        { categorization: { is: null } },
        { categorization: { is: { suggestedBy: "AI", confirmedById: null, category: { in: ["OTHER", "OTHER_REVENUE"] } } } },
      ],
    },
    include: { categorization: true },
    orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
    take: 2000,
  });
  let categorized = 0;
  for (const tx of transactions) {
    const result = await matchByRules(tx.description, tx.amount, tx.transactionType as "DEBIT" | "CREDIT")
      ?? classifyKnownMerchant(tx.description, tx.transactionType as "DEBIT" | "CREDIT");
    if (!result) continue;
    await saveCategorization(tx.id, result);
    await reconcileUnmatchedCategorizedTransaction(tx.id);
    categorized++;
  }
  return { scanned: transactions.length, categorized };
}

async function reconcileUnmatchedCategorizedTransaction(transactionId: number): Promise<void> {
  const transaction = await db.bankTransaction.findUnique({
    where: { id: transactionId },
    include: { categorization: true },
  });
  if (!transaction || transaction.reconciliationStatus !== "UNMATCHED" || !transaction.categorization) return;
  await reconcileTransaction({
    id: transaction.id,
    transactionDate: transaction.transactionDate,
    description: transaction.description,
    amount: transaction.amount,
    transactionType: transaction.transactionType,
    reference: transaction.reference,
    categorization: transaction.categorization,
  });
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
    orderBy: [{ priority: "desc" }, { matchCount: "desc" }, { id: "asc" }],
  });

  const descLower = description.toLowerCase();
  const normalizedDescription = normalizeForRuleMatch(description);

  // Reconcile previous corrections for the same bank narrative before looking
  // up old, overly broad rules. This avoids stale conflicting rules from taking
  // precedence over what the user most recently corrected.
  const reusableSpecificRules = rules.filter((rule) =>
    !rule.isSystemRule &&
    rule.transactionType === transactionType &&
    !!rule.vendor &&
    hasReusableVendorIdentity(rule.vendor),
  );
  const matchingSpecificRules = reusableSpecificRules.filter((rule) => {
    const vendor = normalizeForRuleMatch(rule.vendor!);
    return normalizedDescription.includes(vendor);
  });
  if (matchingSpecificRules.length > 0) {
    const topSpecificPriority = Math.max(...matchingSpecificRules.map((rule) => rule.priority));
    const highestPriorityRules = matchingSpecificRules.filter((rule) => rule.priority === topSpecificPriority);
    const categories = [...new Set(highestPriorityRules.map((rule) => rule.category))];
    if (categories.length === 1) {
      const winner = highestPriorityRules.sort((a, b) => b.matchCount - a.matchCount || a.id - b.id)[0]!;
      await db.categorizationRule.update({ where: { id: winner.id }, data: { matchCount: { increment: 1 }, lastMatchedAt: new Date() } });
      return {
        category: winner.category,
        subcategory: winner.subcategory || undefined,
        confidence: 95,
        source: "RULE",
        reasoning: `Matched saved specific-merchant correction for "${winner.vendor}"`,
        linkedEntityType: winner.linkedEntityType || undefined,
      };
    }
    // Conflicting equally-prioritized corrections are ambiguous; never hide
    // them behind generic merchant/AI classification.
    return {
      category: transactionType === "DEBIT" ? "OTHER" : "OTHER_REVENUE",
      confidence: 20,
      source: "AI",
      reasoning: "Conflicting saved manual rules for this payee; choose the correct category in review.",
    };
  }

  for (const rule of rules) {
    // Check transaction type filter
    if (rule.transactionType && rule.transactionType !== transactionType) continue;

    // Check amount range
    if (rule.amountMin !== null && amount < rule.amountMin) continue;
    if (rule.amountMax !== null && amount > rule.amountMax) continue;

    // Compare normalized merchant identity, not the full bank narrative.
    // Bank/card suffixes and minor punctuation vary between feeds.
    const normalizedVendor = rule.vendor ? normalizeForRuleMatch(rule.vendor) : "";
    if (normalizedVendor && !hasReusableVendorIdentity(normalizedVendor)) continue;
    if (normalizedVendor && !normalizedDescription.includes(normalizedVendor)) continue;

    // A user rule with a vendor is already keyed to that normalized vendor.
    // Do not reject it because an older regex included an unstable card suffix.
    if (normalizedVendor) {
      await db.categorizationRule.update({
        where: { id: rule.id },
        data: { matchCount: { increment: 1 }, lastMatchedAt: new Date() },
      });
      return {
        category: rule.category,
        subcategory: rule.subcategory || undefined,
        confidence: 95,
        source: "RULE",
        reasoning: `Matched saved category rule for "${rule.vendor}"`,
        linkedEntityType: rule.linkedEntityType || undefined,
      };
    }

    // Check pattern (regex or keyword)
    try {
      const regex = new RegExp(rule.pattern, "i");
      if (!regex.test(description) && !regex.test(normalizedDescription)) continue;
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

function normalizeForRuleMatch(value: string): string {
  return value
    .replace(/\d{13,19}/g, " ")
    .replace(/[|*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function hasReusableVendorIdentity(value: string): boolean {
  const generic = new Set(["send", "money", "credit", "card", "material", "payment", "transfer", "cash", "atm", "fee", "debit", "bank", "purchase"]);
  const tokens = normalizeForRuleMatch(value).split(/\s+/).filter(Boolean);
  return tokens.some((token) => !generic.has(token) && (/[a-z]{4,}/i.test(token) || /^\+?\d{9,15}$/.test(token)));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function classifyKnownMerchant(
  description: string,
  transactionType: "DEBIT" | "CREDIT",
): CategorizationResult | null {
  if (transactionType !== "DEBIT") return null;
  const text = normalizeForRuleMatch(description).toUpperCase();
  const known: Array<[RegExp, string, string]> = [
    [/\b(PAYSHAP FEE|INSTANT PAYMENT FEE|SASWITCH FEE|ATM(?:\/SSD)? WITHDRAWAL FEE|NOTIFICATION FEE|DIGITAL STATEMENT FEE|MAINTENANCE FEE|CROSS BORDER FEE)\b/, "BANK_FEES", "Clearly identified bank transaction fee"],
    [/\b(GITHUB|GOOGLE CLOUD|GOOGLE WORKSPACE|RENDER\.COM|MICROSOFT 365|ADOBE|ZAPIER|ATLASSIAN)\b/, "SOFTWARE_SUBSCRIPTIONS", "Recognized software or cloud service"],
    [/\b(DL BOLT|BOLT|UBER|AVIS|TEMPEST|CAR HIRE|PARKING)\b/, "TRAVEL", "Recognized transport or travel merchant"],
    [/\b(HOTEL ON BOOKING|ACCOMMODATION|OVERNIGHT STAY)\b/, "TRAVEL", "Recognized lodging expense"],
    [/\b(ENGEN|SHELL|BP|CALTEX|SASOL|TOTAL|PUMA)\b/, "PETROL", "Recognized fuel merchant"],
    [/\b(BUILDERS WAREHOUSE|MICA|CTM|ITALTILE|CASHBUILD|TIMBER CITY|PLUMBLINK|LEROY MERLIN|H H HARDWARE|MAIN HARDWARE)\b/, "MATERIAL_PURCHASE", "Recognized hardware or building-material merchant"],
    [/\bCONTRACTOR\b/, "INDEPENDENT_CONTRACTOR", "Transaction description explicitly identifies a contractor; verify supplier status/evidence"],
    [/\bWAGES\b/, "SALARIES", "Transaction description explicitly identifies wages; verify employee/payroll classification"],
    [/\b(SAPPHIRE RENT|RENTAL PAYMENT)\b/, "RENT", "Transaction description identifies a rental payment"],
    [/\b(OUTSURANCE|OLD MUTUAL|SANLAM|DISCOVERY INSURANCE|HOLLARD)\b/, "INSURANCE", "Recognized insurance provider"],
    [/\b(DIGITALOCEAN|AFRIHOST)\b/, "SOFTWARE_SUBSCRIPTIONS", "Recognized hosting or online service"],
    [/\b(SERVICE FEE|FACILITY FEE|FTI TRANSACTION FEE|INTEREST CHARGE)\b/, "BANK_FEES", "Description identifies a bank/service financing fee"],
    [/\b(HOME ?LOAN|BOND (?:REPAYMENT|INSTAL\w*|PAYMENT)|SA HOME LOANS|OOBA)\b/, "HOME_BOND", "Description identifies a home loan / bond repayment"],
    [/\b(WESBANK|MFC|VEHICLE (?:FINANCE|INSTAL\w*)|CAR (?:FINANCE|INSTAL\w*)|VAF|TOYOTA FIN\w*|VW FIN\w*|BMW FIN\w*|MERCEDES FIN\w*)\b/, "VEHICLE_FINANCE", "Recognized vehicle finance provider"],
    [/\b(LOAN (?:REPAYMENT|INSTAL\w*|PAYMENT)|PERSONAL LOAN|BUSINESS LOAN|LULALEND|RETAIL CAPITAL|MERCHANT CAPITAL|FINCHOICE)\b/, "LOAN_REPAYMENT", "Description identifies a loan repayment"],
  ];
  for (const [pattern, category, reasoning] of known) {
    if (pattern.test(text)) return { category, confidence: 95, source: "RULE", reasoning };
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
  if (invoiceMatch && invoiceMatch[1] && transactionType === "CREDIT") {
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
  if (paymentMatch && paymentMatch[1] && transactionType === "DEBIT") {
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

    if (recentInvoices.length === 1 && recentInvoices[0]) {
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
  if (Date.now() < aiCategorizationUnavailableUntil) {
    return {
      category: transactionType === "DEBIT" ? "OTHER" : "OTHER_REVENUE",
      confidence: 20,
      source: "AI",
      reasoning: `Automatic classification paused: ${aiCategorizationUnavailableReason}. Requires manual review.`,
    };
  }
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

Business context: Square 15 is a South African MAINTENANCE + PROPERTY INVESTMENT company. Distinguish carefully:
- MATERIAL_PURCHASE: buying physical materials, parts, tools, supplies. Hardware / builders / tile / paint / plumbing / electrical STORES. Places where the company buys STUFF.
- INDEPENDENT_CONTRACTOR: paying an independent tradesperson (plumber, electrician, cleaner, gardener, painter, handyman, contractor) for LABOUR/SERVICES. Payment references often literally say "independent contractor" followed by the person's name and trade (e.g. "Indep Contractor John Plumber"). Also individual named tradespeople when no company / retailer is implied.
- MAINTENANCE: recurring building/property maintenance line-items with no specific contractor named (e.g. "PROPERTY MAINTENANCE FEE", "BODY CORP MAINTENANCE"). Use sparingly â€” prefer MATERIAL_PURCHASE or INDEPENDENT_CONTRACTOR when clear.
- PROFESSIONAL_FEES: attorneys, accountants, auditors, consultants, tax practitioners.

Common SA business patterns:
- ENGEN, SHELL, BP, CALTEX, SASOL, TOTAL, PUMA, WIERDAPARK MOT -> PETROL
- ESKOM, CITY POWER, JOBURG WATER, CITY OF, MUNICIPAL, RAND WATER -> UTILITIES
- VODACOM, MTN, TELKOM, CELL C, RAIN, AFRIHOST -> TELECOMMUNICATIONS
- GOOGLE ADS, FACEBOOK, META, LINKEDIN ADS -> MARKETING
- SARS, TAX, VAT -> PROFESSIONAL_FEES
- RENT, LEASE (paying rent for premises) -> RENT
- OUTSURANCE, OLD MUTUAL, SANLAM, DISCOVERY, MIWAY, DIAL DIRECT, HOLLARD -> INSURANCE
- SALARY, WAGES, PAYROLL, permanent-employee names -> SALARIES
- BUILDERS WAREHOUSE, MICA, CTM, ITALTILE, TILES 4 ALL, TILE AFRICA, PLUMBLINK, CASHBUILD, TIMBER CITY, CEMENT, PAINT, PLASCON, DULUX, TAP KING, LEROY MERLIN, MITEK -> MATERIAL_PURCHASE
- "Independent contractor" mentioned anywhere; individual names + trade (e.g. "John Plumber", "Sipho Electrical"); one-off labour payments to a tradesperson -> INDEPENDENT_CONTRACTOR
- BOLT, UBER, AVIS, TEMPEST, CAR HIRE, PARKING -> TRAVEL
- GITHUB, GOOGLE WORKSPACE, MICROSOFT 365, PAYFAST, ZAPIER, ADOBE, ATLASSIAN, RENDER.COM -> SOFTWARE_SUBSCRIPTIONS
- WERKSMANS, ATTORNEYS, ACCOUNTANTS, AUDITORS, LAWYERS, TAX PRACTITIONERS -> PROFESSIONAL_FEES
- Property rentals RECEIVED from tenants (CREDIT) -> RENTAL_INCOME
- Client invoice payments (INV-numbers, CITY PROPERTY, property managers paying rent collected, CREDIT) -> INVOICE_PAYMENT

Respond in this EXACT JSON format (no markdown, no extra text):
{"category": "CATEGORY_NAME", "confidence": 85, "reasoning": "Brief explanation"}`;

    const result = await generateText({
      aiFeature: "bank-categorization",
      model: google("gemini-3.6-flash"),
      prompt,
      maxTokens: 2000,
    });

    // Strip markdown code fences (```json ... ```) that reasoning models often add.
    const stripped = result.text
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    // Extract the first balanced JSON object (handles nested + multiline).
    let jsonStr: string | null = null;
    const startIdx = stripped.indexOf("{");
    if (startIdx >= 0) {
      let depth = 0;
      for (let i = startIdx; i < stripped.length; i++) {
        if (stripped[i] === "{") depth++;
        else if (stripped[i] === "}") {
          depth--;
          if (depth === 0) { jsonStr = stripped.slice(startIdx, i + 1); break; }
        }
      }
    }
    if (jsonStr) {
      const parsed = JSON.parse(jsonStr);
      const allowedCategories = transactionType === "DEBIT" ? EXPENSE_CATEGORIES : REVENUE_CATEGORIES;
      const proposedCategory = typeof parsed.category === "string" ? parsed.category.trim().toUpperCase() : "";
      const isAllowedCategory = (allowedCategories as readonly string[]).includes(proposedCategory);
      return {
        category: isAllowedCategory ? proposedCategory : transactionType === "DEBIT" ? "OTHER" : "OTHER_REVENUE",
        confidence: isAllowedCategory ? Math.min(parsed.confidence || 60, 90) : 20,
        source: "AI",
        reasoning: isAllowedCategory ? parsed.reasoning || "AI classification" : "AI returned an unsupported category; manual review required",
      };
    }
    console.warn("[BankFeed] AI returned no JSON. finishReason=" + result.finishReason + " textLen=" + result.text.length);
  } catch (err: any) {
    const reason = String(err?.message ?? "AI provider error");
    const lowerReason = reason.toLowerCase();
    if (/prepayment credits.*depleted|insufficient.*quota|billing.*disabled/.test(lowerReason)) {
      aiCategorizationUnavailableUntil = Date.now() + 6 * 60 * 60 * 1000;
      aiCategorizationUnavailableReason = "AI provider credits are unavailable";
      console.error("[BankFeed] AI categorization paused for six hours because provider credits are unavailable; transactions will remain in the manual review queue.");
    } else {
      console.error("[BankFeed] AI categorization error:", reason);
    }
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
  // OTHER is explicitly an unresolved bucket; never silently treat it as
  // reviewed/complete merely because the model returned a high confidence.
  const autoConfirm = result.confidence >= 80 && !["OTHER", "OTHER_REVENUE"].includes(result.category);

  await db.transactionCategorization.upsert({
    where: { bankTransactionId: transactionId },
    create: {
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
    update: {
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
  await syncPendingExpenseCategory(transactionId, result.category, result.source);
}

const OPERATIONAL_EXPENSE_CATEGORIES = new Set([
  "PETROL", "OFFICE_SUPPLIES", "RENT", "UTILITIES", "INSURANCE",
  "SALARIES", "MARKETING", "MAINTENANCE", "TRAVEL", "PROFESSIONAL_FEES",
  "TELECOMMUNICATIONS", "SOFTWARE_SUBSCRIPTIONS", "OTHER",
]);

async function syncPendingExpenseCategory(transactionId: number, category: string, source: CategorizationResult["source"]): Promise<void> {
  if (source === "AI") return;
  const transaction = await db.bankTransaction.findUnique({
    where: { id: transactionId },
    select: { linkedOperationalExpenseId: true, linkedAlternativeRevenueId: true },
  });
  if (!transaction) return;
  // Non-operating reclassification: discard the still-pending auto-created ledger row so it never reaches P&L.
  if (transaction.linkedOperationalExpenseId && NON_EXPENSE_DEBIT_CATEGORIES.includes(category)) {
    const pending = await db.operationalExpense.findUnique({ where: { id: transaction.linkedOperationalExpenseId }, select: { id: true, isApproved: true, description: true } });
    if (pending && !pending.isApproved && pending.description.startsWith("[Auto]")) {
      await db.bankTransaction.update({ where: { id: transactionId }, data: { linkedOperationalExpenseId: null, reconciliationStatus: "UNMATCHED", reconciledAt: null } });
      await db.operationalExpense.delete({ where: { id: pending.id } });
    }
    return;
  }
  if (transaction.linkedAlternativeRevenueId && NON_REVENUE_CREDIT_CATEGORIES.includes(category)) {
    const pending = await db.alternativeRevenue.findUnique({ where: { id: transaction.linkedAlternativeRevenueId }, select: { id: true, isApproved: true, description: true } });
    if (pending && !pending.isApproved && pending.description.startsWith("[Auto]")) {
      await db.bankTransaction.update({ where: { id: transactionId }, data: { linkedAlternativeRevenueId: null, reconciliationStatus: "UNMATCHED", reconciledAt: null } });
      await db.alternativeRevenue.delete({ where: { id: pending.id } });
    }
    return;
  }
  if (!transaction.linkedOperationalExpenseId) return;
  const expense = await db.operationalExpense.findUnique({
    where: { id: transaction.linkedOperationalExpenseId },
    select: { id: true, category: true, isApproved: true },
  });
  // Preserve approved ledger records; only keep still-pending bank-linked
  // expenses aligned with a human correction or saved deterministic rule.
  if (!expense || expense.isApproved) return;
  const mappedCategory = OPERATIONAL_EXPENSE_CATEGORIES.has(category) ? category : "OTHER";
  if (expense.category !== mappedCategory) {
    await db.operationalExpense.update({ where: { id: expense.id }, data: { category: mappedCategory as any } });
  }
}

/** Align pending finance records with human-entered or learned bank-feed categories. */
export async function synchronizePendingBankExpenseCategories(bankAccountIds: number[]): Promise<{ scanned: number; updated: number }> {
  if (!bankAccountIds.length) return { scanned: 0, updated: 0 };
  const transactions = await db.bankTransaction.findMany({
    where: {
      bankAccountId: { in: bankAccountIds },
      linkedOperationalExpenseId: { not: null },
      categorization: { is: { suggestedBy: { in: ["MANUAL", "RULE"] } } },
    },
    include: { categorization: true },
    orderBy: { id: "asc" },
    take: 5000,
  });
  let updated = 0;
  for (const transaction of transactions) {
    if (!transaction.categorization || !transaction.linkedOperationalExpenseId) continue;
    const expense = await db.operationalExpense.findUnique({
      where: { id: transaction.linkedOperationalExpenseId },
      select: { id: true, category: true, isApproved: true },
    });
    if (!expense || expense.isApproved) continue;
    const category = OPERATIONAL_EXPENSE_CATEGORIES.has(transaction.categorization.category)
      ? transaction.categorization.category
      : "OTHER";
    if (expense.category === category) continue;
    await db.operationalExpense.update({ where: { id: expense.id }, data: { category: category as any } });
    updated++;
  }
  return { scanned: transactions.length, updated };
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
  const allowedCategories: readonly string[] = transaction.transactionType === "DEBIT" ? EXPENSE_CATEGORIES : REVENUE_CATEGORIES;
  if (!allowedCategories.includes(newCategory)) throw new Error("Invalid category for this transaction type");

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
  await syncPendingExpenseCategory(transactionId, newCategory, "MANUAL");
  await reconcileUnmatchedCategorizedTransaction(transactionId);

  // Self-learning: create a rule from this correction
  if (createRule && transaction.description) {
    const vendor = (extractVendorName(transaction.description) || transaction.description.trim().slice(0, 50))!;
    const cleanDesc = escapeRegex(vendor).replace(/\s+/g, "\\s+").substring(0, 100);
    const canLearnVendorRule = hasReusableVendorIdentity(vendor);
    const existingRules = canLearnVendorRule ? await db.categorizationRule.findMany({
      where: { isActive: true, isSystemRule: false, transactionType: transaction.transactionType as any },
      select: { id: true, vendor: true },
    }) : [];
    const existingRule = existingRules.find((rule) =>
      rule.vendor && normalizeForRuleMatch(rule.vendor) === normalizeForRuleMatch(vendor),
    );

    if (existingRule && existingRule.id) {
      await db.categorizationRule.update({
        where: { id: existingRule.id },
        data: { category: newCategory, pattern: cleanDesc, priority: 100, isActive: true },
      });
    } else if (canLearnVendorRule) {
      await db.categorizationRule.create({
        data: {
          pattern: cleanDesc,
          vendor,
          category: newCategory,
          transactionType: transaction.transactionType as any,
          priority: 100,
          isSystemRule: false,
          createdById: userId,
        },
      });
    }

    // Learn from this correction retroactively for the same normalized payee.
    // Preserve every previously manual or confirmed non-OTHER categorization.
    if (canLearnVendorRule) {
      const historical = await db.bankTransaction.findMany({
        where: { transactionType: transaction.transactionType, id: { not: transaction.id } },
        include: { categorization: true },
        take: 2000,
      });
      const normalizedVendor = normalizeForRuleMatch(vendor);
      for (const candidate of historical) {
        if (!normalizeForRuleMatch(candidate.description).includes(normalizedVendor)) continue;
        const prior = candidate.categorization;
        const isReplaceable = !prior || (
          prior.suggestedBy !== "MANUAL" &&
          !prior.confirmedById &&
          (prior.suggestedBy === "RULE" || (prior.suggestedBy === "AI" && ["OTHER", "OTHER_REVENUE"].includes(prior.category)))
        );
        if (!isReplaceable) continue;
        await saveCategorization(candidate.id, {
          category: newCategory,
          confidence: 95,
          source: "RULE",
          reasoning: `Applied saved category from a prior manual correction for "${vendor}"`,
        });
      }
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
    .replace(/\d{13,19}/g, " ") // Drop card/account suffixes appended to merchant names
    .replace(/\s*R[\d,.]+.*$/, "") // Remove trailing amounts
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.length > 2 ? cleaned.substring(0, 50) : undefined;
}
