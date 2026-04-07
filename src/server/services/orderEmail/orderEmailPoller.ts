/**
 * Order Email Poller — polls a configured IMAP inbox (or Gmail label)
 * for order-request emails, then uses AI to extract structured data
 * and creates orders in PENDING_REVIEW status.
 *
 * Modelled after the Bank Feed email poller but filters for order-type
 * emails (i.e., everything that ISN'T a bank notification).
 */

import Imap from "imap";
import { simpleParser, ParsedMail } from "mailparser";
import {
  createOrderEmailHash,
  processOrderEmail,
} from "./orderEmailParser";
import { db } from "~/server/db";

interface OrderImapConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
}

let isPolling = false;
let pollInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Known bank-notification senders to SKIP (order poller ignores these)
 */
const BANK_SENDER_PATTERNS = [
  "fnb.co.za",
  "standardbank.co.za",
  "absa.co.za",
  "nedbank.co.za",
  "capitecbank.co.za",
  "investec.co.za",
  "tyme.bank",
  "discovery.co.za",
  "africanbank.co.za",
  "noreply@",
];

/**
 * Subjects that definitely aren't order requests
 */
const IGNORE_SUBJECT_PATTERNS = [
  /^(re|fw|fwd):\s*(re|fw|fwd):/i, // deeply nested forwards
  /unsubscribe/i,
  /newsletter/i,
  /promotional/i,
  /out of office/i,
  /auto.?reply/i,
  /delivery status notification/i,
  /mailer.?daemon/i,
];

function isBankEmail(fromAddress: string): boolean {
  const lower = fromAddress.toLowerCase();
  return BANK_SENDER_PATTERNS.some((p) => lower.includes(p));
}

function isIgnoredEmail(subject: string): boolean {
  return IGNORE_SUBJECT_PATTERNS.some((p) => p.test(subject));
}

/**
 * Start the order email poller (default 5 min interval)
 */
export function startOrderEmailPoller(
  config: OrderImapConfig,
  intervalMs: number = 5 * 60 * 1000
) {
  if (pollInterval) {
    console.log("[OrderEmail] Poller already running");
    return;
  }

  console.log(`[OrderEmail] Starting email poller (every ${intervalMs / 1000}s)`);

  // Run immediately then on interval
  pollOrderEmails(config).catch((err) =>
    console.error("[OrderEmail] Initial poll error:", err)
  );

  pollInterval = setInterval(() => {
    pollOrderEmails(config).catch((err) =>
      console.error("[OrderEmail] Poll error:", err)
    );
  }, intervalMs);
}

export function stopOrderEmailPoller() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log("[OrderEmail] Poller stopped");
  }
}

/**
 * Poll for new order-request emails
 */
export async function pollOrderEmails(config: OrderImapConfig): Promise<number> {
  if (isPolling) {
    console.log("[OrderEmail] Poll already in progress, skipping");
    return 0;
  }

  isPolling = true;
  let processedCount = 0;

  try {
    const emails = await fetchUnseenEmails(config);
    console.log(`[OrderEmail] Found ${emails.length} candidate order emails`);

    for (const email of emails) {
      try {
        const fromAddress = email.from?.value?.[0]?.address || "";
        const fromName = email.from?.value?.[0]?.name || null;
        const subject = email.subject || "";
        const body = email.text || email.html?.replace(/<[^>]*>/g, " ") || "";
        const receivedAt = email.date || new Date();

        // Skip bank notifications
        if (isBankEmail(fromAddress)) continue;

        // Skip clearly non-order emails
        if (isIgnoredEmail(subject)) continue;

        // Skip emails with empty body
        if (!body || body.trim().length < 10) continue;

        // Dedup check before expensive AI call
        const hash = createOrderEmailHash(fromAddress, subject, receivedAt);
        const existing = await db.orderEmailSource.findUnique({
          where: { emailHash: hash },
        });
        if (existing) continue;

        // Process the email (AI extraction → create order)
        const result = await processOrderEmail(
          fromAddress,
          fromName,
          subject,
          body,
          receivedAt
        );

        if (result) processedCount++;
      } catch (err: any) {
        console.error(`[OrderEmail] Error processing email: ${err.message}`);
      }
    }

    console.log(`[OrderEmail] Processed ${processedCount} new order emails`);
  } catch (err: any) {
    console.error("[OrderEmail] Poll error:", err.message);
  } finally {
    isPolling = false;
  }

  return processedCount;
}

/**
 * Fetch unseen emails from the last 3 days
 */
function fetchUnseenEmails(config: OrderImapConfig): Promise<ParsedMail[]> {
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
      // Try the "Orders" label first, fallback to INBOX
      const tryBox = (boxName: string) => {
        imap.openBox(boxName, false, (err) => {
          if (err) {
            if (boxName !== "INBOX") {
              console.log(`[OrderEmail] Label "${boxName}" not found, using INBOX`);
              return tryBox("INBOX");
            }
            imap.end();
            return reject(err);
          }

          const sinceDate = new Date();
          sinceDate.setDate(sinceDate.getDate() - 3);

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

              // Limit to newest 50 emails to avoid overloading
              const toFetch = results.slice(-50);

              const fetch = imap.fetch(toFetch, { bodies: "" });

              fetch.on("message", (msg) => {
                msg.on("body", (stream) => {
                  simpleParser(stream as any, (parseErr, parsed) => {
                    if (!parseErr) {
                      emails.push(parsed);
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
      };

      // Check if we have a configured Gmail label for orders
      const label = process.env.ORDER_EMAIL_LABEL || "INBOX";
      tryBox(label);
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
