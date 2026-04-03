/**
 * Bank-specific email notification parsers for South African banks.
 * Each parser extracts: amount, transactionType, description, reference, balance, date
 */

export interface ParsedTransaction {
  amount: number;
  transactionType: "DEBIT" | "CREDIT";
  description: string;
  reference?: string;
  balance?: number;
  date: Date;
  accountLastFour?: string;
}

// ─── FNB ─────────────────────────────────────────────────────────────────────
// Format: "FNB: R8,041.55 paid from cheque a/c..6789 @ SAPPHIRE PROP on 31 Mar. Ref: RENT. Avail R42,350.22"
// Format: "FNB: R15,000.00 received into cheque a/c..6789 from JOHN DOE on 01 Apr. Ref: INV-0042. Avail R57,350.22"
const FNB_DEBIT = /FNB:\s*R([\d,]+\.?\d*)\s*paid\s+from\s+(?:cheque|savings|credit)\s+a\/c\.\.(\d{4})\s*@\s*(.+?)\s+on\s+(\d{1,2}\s+\w+)\.?\s*(?:Ref:\s*(.+?))?\.\s*Avail\s*R([\d,]+\.?\d*)/i;
const FNB_CREDIT = /FNB:\s*R([\d,]+\.?\d*)\s*received\s+into\s+(?:cheque|savings|credit)\s+a\/c\.\.(\d{4})\s*(?:from\s+(.+?))?\s+on\s+(\d{1,2}\s+\w+)\.?\s*(?:Ref:\s*(.+?))?\.\s*Avail\s*R([\d,]+\.?\d*)/i;
const FNB_TRANSFER = /FNB:\s*R([\d,]+\.?\d*)\s*(?:transferred|payment)\s+(?:from|to)\s+(?:cheque|savings|credit)\s+a\/c\.\.(\d{4})\s*(?:to|from)\s*(.+?)\s+on\s+(\d{1,2}\s+\w+)\.?\s*(?:Ref:\s*(.+?))?\.\s*Avail\s*R([\d,]+\.?\d*)/i;

export function parseFNB(body: string, subject: string): ParsedTransaction | null {
  const text = `${subject} ${body}`.replace(/\s+/g, " ").trim();

  let match = text.match(FNB_DEBIT);
  if (match) {
    return {
      amount: parseAmount(match[1]),
      transactionType: "DEBIT",
      description: match[3].trim(),
      accountLastFour: match[2],
      date: parseShortDate(match[4]),
      reference: match[5]?.trim(),
      balance: parseAmount(match[6]),
    };
  }

  match = text.match(FNB_CREDIT);
  if (match) {
    return {
      amount: parseAmount(match[1]),
      transactionType: "CREDIT",
      description: (match[3] || "Deposit").trim(),
      accountLastFour: match[2],
      date: parseShortDate(match[4]),
      reference: match[5]?.trim(),
      balance: parseAmount(match[6]),
    };
  }

  match = text.match(FNB_TRANSFER);
  if (match) {
    return {
      amount: parseAmount(match[1]),
      transactionType: "DEBIT",
      description: match[3].trim(),
      accountLastFour: match[2],
      date: parseShortDate(match[4]),
      reference: match[5]?.trim(),
      balance: parseAmount(match[6]),
    };
  }

  return null;
}

// ─── ABSA ────────────────────────────────────────────────────────────────────
// Format: "ABSA ALERT: debit R250.00 A/c ..4567 30/03/2026 POS PURCHASE ENGEN Bal R12,350.00"
// Format: "ABSA ALERT: credit R15,000.00 A/c ..4567 01/04/2026 EFT FROM JOHN DOE Bal R27,350.00"
const ABSA_PATTERN = /ABSA\s*ALERT:\s*(debit|credit)\s*R([\d,]+\.?\d*)\s*A\/c\s*\.\.(\d{4})\s*(\d{2}\/\d{2}\/\d{4})\s*(.+?)\s*Bal\s*R([\d,]+\.?\d*)/i;

export function parseABSA(body: string, subject: string): ParsedTransaction | null {
  const text = `${subject} ${body}`.replace(/\s+/g, " ").trim();
  const match = text.match(ABSA_PATTERN);
  if (!match) return null;

  return {
    amount: parseAmount(match[2]),
    transactionType: match[1].toLowerCase() === "debit" ? "DEBIT" : "CREDIT",
    description: match[5].trim(),
    accountLastFour: match[3],
    date: parseDDMMYYYY(match[4]),
    balance: parseAmount(match[6]),
  };
}

// ─── Standard Bank ───────────────────────────────────────────────────────────
// Format: "SB Alert: R8,041.55 was debited on 31/03/2026. Desc: SAPPHIRE PROP. Avail Bal: R42,350.22"
// Format: "SB Alert: R15,000.00 was credited on 01/04/2026. Desc: EFT FROM JOHN DOE. Avail Bal: R57,350.22"
const SB_PATTERN = /SB\s*Alert:\s*R([\d,]+\.?\d*)\s*was\s*(debited|credited)\s*on\s*(\d{2}\/\d{2}\/\d{4})\.?\s*(?:Desc:\s*(.+?))?\.\s*(?:Ref:\s*(.+?))?\s*Avail\s*Bal:\s*R([\d,]+\.?\d*)/i;

export function parseStandardBank(body: string, subject: string): ParsedTransaction | null {
  const text = `${subject} ${body}`.replace(/\s+/g, " ").trim();
  const match = text.match(SB_PATTERN);
  if (!match) return null;

  return {
    amount: parseAmount(match[1]),
    transactionType: match[2].toLowerCase() === "debited" ? "DEBIT" : "CREDIT",
    description: (match[4] || "Transaction").trim(),
    date: parseDDMMYYYY(match[3]),
    reference: match[5]?.trim(),
    balance: parseAmount(match[6]),
  };
}

// ─── Nedbank ─────────────────────────────────────────────────────────────────
// Format: "Nedbank: Acc ..1234 debit R300.00 31/03/2026 ENGEN FUEL Bal R5,200.00"
// Format: "Nedbank: Acc ..1234 credit R15,000.00 01/04/2026 EFT-JOHN DOE Bal R20,200.00"
const NEDBANK_PATTERN = /Nedbank:\s*Acc\s*\.\.(\d{4})\s*(debit|credit)\s*R([\d,]+\.?\d*)\s*(\d{2}\/\d{2}\/\d{4})\s*(.+?)\s*Bal\s*R([\d,]+\.?\d*)/i;

export function parseNedbank(body: string, subject: string): ParsedTransaction | null {
  const text = `${subject} ${body}`.replace(/\s+/g, " ").trim();
  const match = text.match(NEDBANK_PATTERN);
  if (!match) return null;

  return {
    amount: parseAmount(match[3]),
    transactionType: match[2].toLowerCase() === "debit" ? "DEBIT" : "CREDIT",
    description: match[5].trim(),
    accountLastFour: match[1],
    date: parseDDMMYYYY(match[4]),
    balance: parseAmount(match[6]),
  };
}

// ─── Capitec ─────────────────────────────────────────────────────────────────
// Format: "Capitec: R250.00 paid ENGEN 31 Mar 2026. Acc bal: R4,500.00"
// Format: "Capitec: R15,000.00 received from JOHN DOE 01 Apr 2026. Acc bal: R19,500.00"
const CAPITEC_DEBIT = /Capitec:\s*R([\d,]+\.?\d*)\s*paid\s*(.+?)\s*(\d{1,2}\s+\w+\s+\d{4})\.?\s*(?:Acc\s*bal:\s*R([\d,]+\.?\d*))?/i;
const CAPITEC_CREDIT = /Capitec:\s*R([\d,]+\.?\d*)\s*received\s*(?:from\s*)?(.+?)\s*(\d{1,2}\s+\w+\s+\d{4})\.?\s*(?:Acc\s*bal:\s*R([\d,]+\.?\d*))?/i;

export function parseCapitec(body: string, subject: string): ParsedTransaction | null {
  const text = `${subject} ${body}`.replace(/\s+/g, " ").trim();

  let match = text.match(CAPITEC_DEBIT);
  if (match) {
    return {
      amount: parseAmount(match[1]),
      transactionType: "DEBIT",
      description: match[2].trim(),
      date: parseLongDate(match[3]),
      balance: match[4] ? parseAmount(match[4]) : undefined,
    };
  }

  match = text.match(CAPITEC_CREDIT);
  if (match) {
    return {
      amount: parseAmount(match[1]),
      transactionType: "CREDIT",
      description: match[2].trim(),
      date: parseLongDate(match[3]),
      balance: match[4] ? parseAmount(match[4]) : undefined,
    };
  }

  return null;
}

// ─── Investec ────────────────────────────────────────────────────────────────
// Format: "Investec: Transaction on account ..9876: Debit R5,000.00 on 2026-03-31. SAPPHIRE PROP. Balance: R120,000.00"
const INVESTEC_PATTERN = /Investec:.*?account\s*\.\.(\d{4}):\s*(Debit|Credit)\s*R([\d,]+\.?\d*)\s*on\s*(\d{4}-\d{2}-\d{2})\.?\s*(.+?)\.\s*Balance:\s*R([\d,]+\.?\d*)/i;

export function parseInvestec(body: string, subject: string): ParsedTransaction | null {
  const text = `${subject} ${body}`.replace(/\s+/g, " ").trim();
  const match = text.match(INVESTEC_PATTERN);
  if (!match) return null;

  return {
    amount: parseAmount(match[3]),
    transactionType: match[2].toLowerCase() === "debit" ? "DEBIT" : "CREDIT",
    description: match[5].trim(),
    accountLastFour: match[1],
    date: new Date(match[4]),
    balance: parseAmount(match[6]),
  };
}

// ─── Universal Detector ─────────────────────────────────────────────────────

const BANK_SENDER_MAP: Record<string, string> = {
  "fnb.co.za": "FNB",
  "firstnationalbank.co.za": "FNB",
  "absa.co.za": "ABSA",
  "standardbank.co.za": "STANDARD_BANK",
  "nedbank.co.za": "NEDBANK",
  "capitecbank.co.za": "CAPITEC",
  "capitec.co.za": "CAPITEC",
  "investec.co.za": "INVESTEC",
  "tymebank.co.za": "TYMEBANK",
  "discovery.co.za": "DISCOVERY",
};

export function detectBank(fromEmail: string): string | null {
  const domain = fromEmail.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  for (const [pattern, bank] of Object.entries(BANK_SENDER_MAP)) {
    if (domain.includes(pattern) || domain.endsWith(pattern)) {
      return bank;
    }
  }
  return null;
}

export function parseEmailNotification(
  fromEmail: string,
  subject: string,
  body: string,
  bankHint?: string
): ParsedTransaction | null {
  const bank = bankHint || detectBank(fromEmail);

  switch (bank) {
    case "FNB":
      return parseFNB(body, subject);
    case "ABSA":
      return parseABSA(body, subject);
    case "STANDARD_BANK":
      return parseStandardBank(body, subject);
    case "NEDBANK":
      return parseNedbank(body, subject);
    case "CAPITEC":
      return parseCapitec(body, subject);
    case "INVESTEC":
      return parseInvestec(body, subject);
    default:
      // Try all parsers as fallback
      return (
        parseFNB(body, subject) ||
        parseABSA(body, subject) ||
        parseStandardBank(body, subject) ||
        parseNedbank(body, subject) ||
        parseCapitec(body, subject) ||
        parseInvestec(body, subject)
      );
  }
}

// ─── Utility Functions ───────────────────────────────────────────────────────

function parseAmount(str: string): number {
  return parseFloat(str.replace(/,/g, ""));
}

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  january: 0, february: 1, march: 2, april: 3, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

/** Parse "31 Mar" or "1 Apr" — assumes current year */
function parseShortDate(str: string): Date {
  const parts = str.trim().split(/\s+/);
  const day = parseInt(parts[0], 10);
  const monthStr = parts[1].toLowerCase();
  const month = MONTH_MAP[monthStr] ?? 0;
  const year = new Date().getFullYear();
  return new Date(year, month, day);
}

/** Parse "31 Mar 2026" */
function parseLongDate(str: string): Date {
  const parts = str.trim().split(/\s+/);
  const day = parseInt(parts[0], 10);
  const monthStr = parts[1].toLowerCase();
  const month = MONTH_MAP[monthStr] ?? 0;
  const year = parseInt(parts[2], 10);
  return new Date(year, month, day);
}

/** Parse "31/03/2026" */
function parseDDMMYYYY(str: string): Date {
  const [d, m, y] = str.split("/").map(Number);
  return new Date(y, m - 1, d);
}
