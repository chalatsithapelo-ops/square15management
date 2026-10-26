/**
 * CSV Statement Parsers for South African banks.
 * Each bank has a different CSV format — these parsers normalize them.
 */

import type { ParsedTransaction } from "./emailParsers";

export interface CSVParseResult {
  transactions: ParsedTransaction[];
  bank: string;
  periodStart?: Date;
  periodEnd?: Date;
  errors: string[];
}

// ─── Bank Format Detection ───────────────────────────────────────────────────

export function detectCSVBank(headers: string): string | null {
  const h = headers.toLowerCase();
  if (h.includes("fnb") || h.includes("first national")) return "FNB";
  if (h.includes("absa")) return "ABSA";
  if (h.includes("standard bank")) return "STANDARD_BANK";
  if (h.includes("nedbank")) return "NEDBANK";
  // Nedbank Business Online preamble uses "Statement Enquiry" + "Account Number/Description"
  if (h.includes("statement enquiry") && h.includes("account")) return "NEDBANK";
  if (h.includes("capitec")) return "CAPITEC";
  if (h.includes("investec")) return "INVESTEC";

  // Detect by column pattern
  if (h.includes("date") && h.includes("amount") && h.includes("balance")) {
    // Generic format — try heuristics
    if (h.includes("service fee")) return "FNB";
    if (h.includes("cheque no")) return "STANDARD_BANK";
  }

  return null;
}

// ─── Generic CSV Parser ──────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSVRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseCSVLine);
}

// ─── FNB CSV Parser ─────────────────────────────────────────────────────────
// FNB CSV: Date, Amount, Balance, Description
// Header rows vary; data starts after "Date" column header

export function parseFNBCSV(text: string): CSVParseResult {
  const rows = parseCSVRows(text);
  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];
  let headerFound = false;
  let dateIdx = -1, amountIdx = -1, balanceIdx = -1, descIdx = -1;

  for (const row of rows) {
    if (!headerFound) {
      const lower = row.map((c) => c.toLowerCase());
      dateIdx = lower.findIndex((c) => c.includes("date"));
      amountIdx = lower.findIndex((c) => c === "amount" || c.includes("amount"));
      balanceIdx = lower.findIndex((c) => c.includes("balance"));
      descIdx = lower.findIndex((c) => c.includes("description"));
      if (dateIdx >= 0 && amountIdx >= 0) {
        headerFound = true;
      }
      continue;
    }

    try {
      const dateStr = row[dateIdx];
      const amountStr = row[amountIdx];
      if (!dateStr || !amountStr) continue;

      const amount = parseFloat(amountStr.replace(/[,\s]/g, ""));
      if (isNaN(amount) || amount === 0) continue;

      transactions.push({
        amount: Math.abs(amount),
        transactionType: amount < 0 ? "DEBIT" : "CREDIT",
        description: row[descIdx] || "",
        balance: balanceIdx >= 0 ? parseFloat((row[balanceIdx] ?? "").replace(/[,\s]/g, "")) || undefined : undefined,
        date: parseFlexibleDate(dateStr),
      });
    } catch (e: any) {
      errors.push(`Row parse error: ${e.message}`);
    }
  }

  return { transactions, bank: "FNB", errors };
}

// ─── ABSA CSV Parser ────────────────────────────────────────────────────────
export function parseABSACSV(text: string): CSVParseResult {
  return parseGenericCSV(text, "ABSA");
}

// ─── Standard Bank CSV Parser ────────────────────────────────────────────────
export function parseStandardBankCSV(text: string): CSVParseResult {
  return parseGenericCSV(text, "STANDARD_BANK");
}

// ─── Nedbank CSV Parser ──────────────────────────────────────────────────────
// Nedbank Business Online exports have NO column headers — just a metadata
// preamble ("Statement Enquiry", "Account Number", "Account Description",
// "Statement Number") followed by rows of:
//   Col 0 = date (e.g. "2-Jan-26")
//   Col 1 = description
//   Col 2 = amount (signed — negative = debit)
//   Col 3 = running balance (optional / signed)
// We locate the first row where col 0 parses as a date AND col 2 parses as
// a number, then treat everything from there as data.
export function parseNedbankCSV(text: string): CSVParseResult {
  const rows = parseCSVRows(text);
  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];
  let dataStarted = false;

  for (const row of rows) {
    if (!dataStarted) {
      // Skip until we find a row that looks like: [date, description, amount, ...]
      if (row.length < 3) continue;
      const dateOK = tryParseDate(row[0]);
      const amtRaw = (row[2] ?? "").replace(/[,\s]/g, "");
      const amtOK = amtRaw.length > 0 && !isNaN(parseFloat(amtRaw));
      if (!dateOK || !amtOK) continue;
      dataStarted = true;
      // fall through to parse this same row
    }

    // Stop on empty / short rows once data has started (end-of-data marker)
    if (row.length < 3) continue;
    const dateStr = row[0];
    const dateVal = tryParseDate(dateStr);
    if (!dateVal) continue;
    const rawAmt = (row[2] ?? "").replace(/[,\s]/g, "");
    if (rawAmt.length === 0) continue;
    const amt = parseFloat(rawAmt);
    if (isNaN(amt) || amt === 0) continue;
    const balance = row.length > 3 ? parseFloat((row[3] ?? "").replace(/[,\s]/g, "")) : NaN;

    transactions.push({
      amount: Math.abs(amt),
      transactionType: amt < 0 ? "DEBIT" : "CREDIT",
      description: (row[1] ?? "").trim() || "(no description)",
      reference: undefined,
      balance: !isNaN(balance) ? balance : undefined,
      date: dateVal,
    });
  }

  const dates = transactions.map((t) => t.date.getTime()).filter((t) => !isNaN(t));

  return {
    transactions,
    bank: "NEDBANK",
    periodStart: dates.length > 0 ? new Date(Math.min(...dates)) : undefined,
    periodEnd: dates.length > 0 ? new Date(Math.max(...dates)) : undefined,
    errors,
  };
}

// Non-throwing wrapper around parseFlexibleDate — used by parseNedbankCSV to
// probe rows without exceptions on non-date cells.
function tryParseDate(s: string | undefined): Date | null {
  if (!s) return null;
  try {
    const d = parseFlexibleDate(s);
    if (isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

// ─── Capitec CSV Parser ──────────────────────────────────────────────────────
export function parseCapitecCSV(text: string): CSVParseResult {
  return parseGenericCSV(text, "CAPITEC");
}

// ─── Generic CSV Parser (handles most SA bank formats) ──────────────────────

function parseGenericCSV(text: string, bank: string): CSVParseResult {
  const rows = parseCSVRows(text);
  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];
  let headerFound = false;
  let dateIdx = -1, amountIdx = -1, debitIdx = -1, creditIdx = -1;
  let balanceIdx = -1, descIdx = -1, refIdx = -1;

  for (const row of rows) {
    if (!headerFound) {
      const lower = row.map((c) => c.toLowerCase());
      dateIdx = lower.findIndex((c) => c.includes("date"));
      amountIdx = lower.findIndex((c) => c === "amount");
      debitIdx = lower.findIndex((c) => c.includes("debit"));
      creditIdx = lower.findIndex((c) => c.includes("credit"));
      balanceIdx = lower.findIndex((c) => c.includes("balance"));
      descIdx = lower.findIndex((c) => c.includes("description") || c.includes("narrative") || c.includes("details"));
      refIdx = lower.findIndex((c) => c.includes("reference") || c.includes("ref"));

      if (dateIdx >= 0 && (amountIdx >= 0 || debitIdx >= 0 || creditIdx >= 0)) {
        headerFound = true;
      }
      continue;
    }

    try {
      const dateStr = row[dateIdx];
      if (!dateStr || dateStr.trim().length === 0) continue;

      let amount: number;
      let txType: "DEBIT" | "CREDIT";

      if (debitIdx >= 0 && creditIdx >= 0) {
        // Separate debit/credit columns
        const debitVal = parseFloat((row[debitIdx] || "").replace(/[,\s]/g, "")) || 0;
        const creditVal = parseFloat((row[creditIdx] || "").replace(/[,\s]/g, "")) || 0;
        if (debitVal > 0) {
          amount = debitVal;
          txType = "DEBIT";
        } else if (creditVal > 0) {
          amount = creditVal;
          txType = "CREDIT";
        } else {
          continue;
        }
      } else if (amountIdx >= 0) {
        const raw = parseFloat((row[amountIdx] ?? "").replace(/[,\s]/g, ""));
        if (isNaN(raw) || raw === 0) continue;
        amount = Math.abs(raw);
        txType = raw < 0 ? "DEBIT" : "CREDIT";
      } else {
        continue;
      }

      transactions.push({
        amount,
        transactionType: txType,
        description: (descIdx >= 0 ? row[descIdx] : "") || "",
        reference: refIdx >= 0 ? row[refIdx] : undefined,
        balance: balanceIdx >= 0 ? parseFloat((row[balanceIdx] || "").replace(/[,\s]/g, "")) || undefined : undefined,
        date: parseFlexibleDate(dateStr),
      });
    } catch (e: any) {
      errors.push(`Row parse error: ${e.message}`);
    }
  }

  const dates = transactions.map((t) => t.date.getTime()).filter((t) => !isNaN(t));

  return {
    transactions,
    bank,
    periodStart: dates.length > 0 ? new Date(Math.min(...dates)) : undefined,
    periodEnd: dates.length > 0 ? new Date(Math.max(...dates)) : undefined,
    errors,
  };
}

// ─── Auto-detect and parse ───────────────────────────────────────────────────

export function parseCSVStatement(text: string, bankHint?: string): CSVParseResult {
  const bank = bankHint || detectCSVBank(text.split("\n").slice(0, 5).join(" "));
  switch (bank) {
    case "FNB":
      return parseFNBCSV(text);
    case "ABSA":
      return parseABSACSV(text);
    case "STANDARD_BANK":
      return parseStandardBankCSV(text);
    case "NEDBANK":
      return parseNedbankCSV(text);
    case "CAPITEC":
      return parseCapitecCSV(text);
    default:
      // Try generic parser
      return parseGenericCSV(text, bank || "UNKNOWN");
  }
}

// ─── Date Parsing ────────────────────────────────────────────────────────────

function parseFlexibleDate(str: string): Date {
  const s = str.trim();

  // 2026-03-31 (ISO)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s);

  // 31/03/2026 (DD/MM/YYYY)
  const ddmm = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmm) return new Date(+ddmm[3]!, +ddmm[2]! - 1, +ddmm[1]!);

  // 03/31/2026 (MM/DD/YYYY) — less common in SA but handle it
  const mmdd = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mmdd && +mmdd[1]! > 12) return new Date(+mmdd[3]!, +mmdd[2]! - 1, +mmdd[1]!);

  // 31 Mar 2026
  const longDate = s.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/);
  if (longDate) {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const m = months[longDate[2]!.toLowerCase().substring(0, 3)];
    if (m !== undefined) return new Date(+longDate[3]!, m, +longDate[1]!);
  }

  // 2-Jan-26 / 02-Jan-2026 (Nedbank Business Online export)
  const dmmmY = s.match(/^(\d{1,2})[\-\/](\w{3,})[\-\/](\d{2,4})$/);
  if (dmmmY) {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const mo = months[dmmmY[2]!.toLowerCase().substring(0, 3)];
    if (mo !== undefined) {
      const day = +dmmmY[1]!;
      let year = +dmmmY[3]!;
      if (year < 100) year += 2000; // "26" → 2026
      return new Date(year, mo, day);
    }
  }

  // Fallback
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  throw new Error(`Cannot parse date: ${s}`);
}
