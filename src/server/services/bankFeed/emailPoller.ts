/**
 * IMAP Email Poller — polls a configured inbox for bank notification emails.
 * Uses the system SMTP credentials (same Gmail account) with IMAP access.
 */

import Imap from "imap";
import { simpleParser, ParsedMail } from "mailparser";
import { db } from "~/server/db";
import { parseEmailNotification, detectBank } from "./emailParsers";
import { createTransactionHash, storeTransaction } from "./transactionStore";
import { categorizeTransaction } from "./categorizationEngine";
import { bankFeedEvents } from "./eventBus";

interface ImapConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
}

let isPolling = false;
let pollInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the email poller with the given interval (default 5 minutes)
 */
export function startEmailPoller(config: ImapConfig, intervalMs: number = 5 * 60 * 1000) {
  if (pollInterval) {
    console.log("[BankFeed] Email poller already running");
    return;
  }

  console.log(`[BankFeed] Starting email poller (every ${intervalMs / 1000}s)`);

  // Run immediately, then on interval
  pollEmails(config).catch((err) =>
    console.error("[BankFeed] Initial poll error:", err)
  );

  pollInterval = setInterval(() => {
    pollEmails(config).catch((err) =>
      console.error("[BankFeed] Poll error:", err)
    );
  }, intervalMs);
}

export function stopEmailPoller() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log("[BankFeed] Email poller stopped");
  }
}

/**
 * Poll for new bank notification emails
 */
export async function pollEmails(config: ImapConfig): Promise<number> {
  if (isPolling) {
    console.log("[BankFeed] Poll already in progress, skipping");
    return 0;
  }

  isPolling = true;
  let processedCount = 0;

  try {
    // Get all active bank accounts with feed enabled
    const bankAccounts = await db.bankAccount.findMany({
      where: { feedEnabled: true, isActive: true },
    });

    if (bankAccounts.length === 0) {
      console.log("[BankFeed] No bank accounts with feed enabled");
      return 0;
    }

    // Build sender filter from known bank email domains
    const bankSenders = new Set<string>();
    for (const acc of bankAccounts) {
      if (acc.notificationEmail) {
        bankSenders.add(acc.notificationEmail.toLowerCase());
      }
    }

    // Connect to IMAP
    const emails = await fetchUnreadEmails(config, bankSenders);
    console.log(`[BankFeed] Found ${emails.length} potential bank emails`);

    for (const email of emails) {
      try {
        const result = await processEmail(email, bankAccounts);
        if (result) processedCount++;
      } catch (err: any) {
        console.error(`[BankFeed] Error processing email: ${err.message}`);
      }
    }

    // Update last feed check
    await db.bankAccount.updateMany({
      where: { feedEnabled: true, isActive: true },
      data: { lastFeedCheck: new Date() },
    });

    console.log(`[BankFeed] Processed ${processedCount} new transactions`);
  } catch (err: any) {
    console.error("[BankFeed] Poll error:", err.message);
  } finally {
    isPolling = false;
  }

  return processedCount;
}

/**
 * Fetch unread emails from the inbox matching bank senders
 */
function fetchUnreadEmails(
  config: ImapConfig,
  _bankSenders: Set<string>
): Promise<ParsedMail[]> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: config.user,
      password: config.password,
      host: config.host,
      port: config.port,
      tls: config.tls,
      tlsOptions: { rejectUnauthorized: false },
    });

    const emails: ParsedMail[] = [];

    imap.once("ready", () => {
      imap.openBox("INBOX", false, (err) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        // Search for unread emails from the last 7 days
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - 7);

        imap.search(
          ["UNSEEN", ["SINCE", sinceDate]],
          (searchErr, results) => {
            if (searchErr) {
              imap.end();
              return reject(searchErr);
            }

            if (!results || results.length === 0) {
              imap.end();
              return resolve([]);
            }

            const fetch = imap.fetch(results, { bodies: "" });

            fetch.on("message", (msg) => {
              msg.on("body", (stream) => {
                simpleParser(stream as any, (parseErr, parsed) => {
                  if (!parseErr) {
                    // Check if it's from a bank
                    const from = parsed.from?.value?.[0]?.address?.toLowerCase() || "";
                    const bank = detectBank(from);
                    if (bank) {
                      emails.push(parsed);
                    }
                  }
                });
              });
            });

            fetch.once("end", () => {
              imap.end();
            });

            fetch.once("error", (fetchErr) => {
              imap.end();
              reject(fetchErr);
            });
          }
        );
      });
    });

    imap.once("error", (err: Error) => {
      reject(err);
    });

    imap.once("end", () => {
      resolve(emails);
    });

    imap.connect();
  });
}

/**
 * Process a single email and store as a bank transaction
 */
async function processEmail(
  email: ParsedMail,
  bankAccounts: Array<{
    id: number;
    bankName: string;
    accountNumber: string;
    notificationEmail: string | null;
  }>
): Promise<boolean> {
  const fromAddress = email.from?.value?.[0]?.address || "";
  const subject = email.subject || "";
  const html = email.html as string | false | undefined;
  const htmlBody: string = typeof html === "string" ? html.replace(/<[^>]*>/g, " ") : "";
  const body = email.text || htmlBody || "";

  const bank = detectBank(fromAddress);
  if (!bank) return false;

  // Parse the notification
  const parsed = parseEmailNotification(fromAddress, subject, body, bank);
  if (!parsed) {
    console.log(`[BankFeed] Could not parse email from ${fromAddress}: ${subject.substring(0, 60)}`);
    return false;
  }

  // Match to bank account
  let matchedAccount = bankAccounts.find((acc) => {
    if (acc.bankName !== bank) return false;
    if (parsed.accountLastFour && !acc.accountNumber.endsWith(parsed.accountLastFour)) return false;
    return true;
  });

  // Fallback: match by bank name only if only one account for that bank
  if (!matchedAccount) {
    const bankAccs = bankAccounts.filter((acc) => acc.bankName === bank);
    if (bankAccs.length === 1) matchedAccount = bankAccs[0];
  }

  if (!matchedAccount) {
    console.log(`[BankFeed] No matching bank account for ${bank} ..${parsed.accountLastFour || "????"}`);
    return false;
  }

  // Generate dedup hash
  const hash = createTransactionHash(
    parsed.date,
    parsed.amount,
    parsed.description,
    parsed.balance
  );

  // Check for duplicate
  const existing = await db.bankTransaction.findUnique({
    where: { transactionHash: hash },
  });

  if (existing) {
    return false; // Already stored
  }

  // Store transaction
  const transaction = await storeTransaction({
    bankAccountId: matchedAccount.id,
    transactionDate: parsed.date,
    description: parsed.description,
    amount: parsed.amount,
    transactionType: parsed.transactionType,
    balance: parsed.balance,
    reference: parsed.reference,
    rawDescription: `${subject}\n${body.substring(0, 500)}`,
    transactionHash: hash,
    source: "EMAIL",
  });

  // Auto-categorize
  await categorizeTransaction(transaction.id, parsed.description, parsed.amount, parsed.transactionType);

  // Notify SSE subscribers (Cashbook & Bank Feed pages auto-refresh)
  bankFeedEvents.emitTransaction({
    bankAccountId: matchedAccount.id,
    transactionId: transaction.id,
    transactionDate: parsed.date.toISOString(),
    amount: parsed.amount,
    transactionType: parsed.transactionType,
    description: parsed.description,
    source: "EMAIL",
  });

  return true;
}

// ===========================================================================
// IMAP IDLE — push-mode delivery
// ===========================================================================
// Replaces the 5-minute polling cycle with a persistent IMAP connection that
// uses the IDLE extension (RFC 2177). The mail server pushes "new mail"
// notifications to us in real time, typically within 1 second of arrival.
//
// Auto-fallback: if IDLE is unsupported or the connection drops, we
// reconnect with exponential backoff (max 60s).
//
// Enabled via env BANK_FEED_IDLE=1. The handler.ts bootstrap chooses between
// `startEmailPoller` (poll) and `startEmailIdle` (push).

let idleImap: Imap | null = null;
let idleStopRequested = false;
let idleReconnectAttempt = 0;
let idleConfig: ImapConfig | null = null;

export function startEmailIdle(config: ImapConfig) {
  if (idleImap) {
    console.log("[BankFeed] IMAP IDLE already running");
    return;
  }
  idleConfig = config;
  idleStopRequested = false;
  idleReconnectAttempt = 0;
  connectIdle();
}

export function stopEmailIdle() {
  idleStopRequested = true;
  if (idleImap) {
    try {
      idleImap.end();
    } catch {
      // ignore
    }
    idleImap = null;
  }
  console.log("[BankFeed] IMAP IDLE stopped");
}

function connectIdle() {
  if (!idleConfig || idleStopRequested) return;

  const imap = new Imap({
    user: idleConfig.user,
    password: idleConfig.password,
    host: idleConfig.host,
    port: idleConfig.port,
    tls: idleConfig.tls,
    tlsOptions: { rejectUnauthorized: false },
    keepalive: { interval: 10_000, idleInterval: 300_000, forceNoop: true },
  });

  idleImap = imap;

  imap.once("ready", () => {
    idleReconnectAttempt = 0;
    imap.openBox("INBOX", false, (err) => {
      if (err) {
        console.error("[BankFeed][IDLE] openBox error:", err.message);
        try { imap.end(); } catch {}
        return;
      }
      console.log("[BankFeed][IDLE] Connected. Listening for new mail…");

      // Process any pre-existing unread bank emails on connect
      processCurrentUnread().catch((e) =>
        console.error("[BankFeed][IDLE] Initial sweep error:", e)
      );

      // The `imap` library emits 'mail' for every IDLE update.
      imap.on("mail", (numNew: number) => {
        console.log(`[BankFeed][IDLE] ${numNew} new message(s) — processing…`);
        processCurrentUnread().catch((e) =>
          console.error("[BankFeed][IDLE] Process error:", e)
        );
      });
    });
  });

  imap.once("error", (err: Error) => {
    console.error("[BankFeed][IDLE] Connection error:", err.message);
  });

  imap.once("end", () => {
    idleImap = null;
    if (idleStopRequested) return;
    // Exponential backoff: 2s, 4s, 8s, 16s, 32s, 60s (cap)
    idleReconnectAttempt += 1;
    const delay = Math.min(60_000, 2_000 * 2 ** (idleReconnectAttempt - 1));
    console.log(`[BankFeed][IDLE] Disconnected. Reconnecting in ${delay / 1000}s (attempt ${idleReconnectAttempt})`);
    setTimeout(connectIdle, delay);
  });

  imap.connect();
}

/**
 * Sweep current UNSEEN messages from the open INBOX. Reuses the same parsing
 * pipeline as the polling path to avoid divergent behaviour.
 */
async function processCurrentUnread(): Promise<void> {
  if (!idleImap) return;
  const imap = idleImap;

  const bankAccounts = await db.bankAccount.findMany({
    where: { feedEnabled: true, isActive: true },
  });
  if (bankAccounts.length === 0) return;

  await new Promise<void>((resolve) => {
    imap.search(["UNSEEN"], (searchErr, results) => {
      if (searchErr || !results || results.length === 0) {
        return resolve();
      }
      const fetch = imap.fetch(results, { bodies: "", markSeen: true });
      const pending: Promise<void>[] = [];

      fetch.on("message", (msg) => {
        msg.on("body", (stream) => {
          pending.push(
            new Promise<void>((res) => {
              simpleParser(stream as any, async (parseErr, parsed) => {
                if (!parseErr && parsed) {
                  try {
                    await processEmail(parsed, bankAccounts);
                  } catch (e: any) {
                    console.error("[BankFeed][IDLE] processEmail error:", e.message);
                  }
                }
                res();
              });
            })
          );
        });
      });

      fetch.once("end", async () => {
        await Promise.all(pending);
        await db.bankAccount.updateMany({
          where: { feedEnabled: true, isActive: true },
          data: { lastFeedCheck: new Date() },
        });
        resolve();
      });

      fetch.once("error", (e) => {
        console.error("[BankFeed][IDLE] fetch error:", e);
        resolve();
      });
    });
  });
}
