/**
 * Quote Email Poller — polls a configured IMAP inbox for quote-request
 * emails, then uses AI to extract structured data and creates
 * quotations in DRAFT status.
 */

import Imap from "imap";
import { simpleParser, ParsedMail } from "mailparser";
import { createQuoteEmailHash, processQuoteEmail } from "./quoteEmailParser";
import { db } from "~/server/db";

interface QuoteImapConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
}

let isPolling = false;
let pollInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Subjects to ignore
 */
const IGNORE_SUBJECT_PATTERNS = [
  /^(re|fw|fwd):\s*(re|fw|fwd):/i,
  /unsubscribe/i,
  /newsletter/i,
  /promotional/i,
  /out of office/i,
  /auto.?reply/i,
  /delivery status notification/i,
  /mailer.?daemon/i,
];

function isIgnoredEmail(subject: string): boolean {
  return IGNORE_SUBJECT_PATTERNS.some((p) => p.test(subject));
}

/**
 * Start the quote email poller
 */
export function startQuoteEmailPoller(
  config: QuoteImapConfig,
  intervalMs: number = 5 * 60 * 1000
) {
  if (pollInterval) {
    console.log("[QuoteEmail] Poller already running");
    return;
  }

  console.log(`[QuoteEmail] Starting email poller (every ${intervalMs / 1000}s)`);

  pollQuoteEmails(config).catch((err) =>
    console.error("[QuoteEmail] Initial poll error:", err)
  );

  pollInterval = setInterval(() => {
    pollQuoteEmails(config).catch((err) =>
      console.error("[QuoteEmail] Poll error:", err)
    );
  }, intervalMs);
}

export function stopQuoteEmailPoller() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log("[QuoteEmail] Poller stopped");
  }
}

/**
 * Poll for new quote-request emails
 */
export async function pollQuoteEmails(config: QuoteImapConfig): Promise<number> {
  if (isPolling) {
    console.log("[QuoteEmail] Poll already in progress, skipping");
    return 0;
  }

  isPolling = true;
  let processedCount = 0;

  try {
    const emails = await fetchUnseenEmails(config);
    console.log(`[QuoteEmail] Found ${emails.length} candidate quote emails`);

    for (const email of emails) {
      try {
        const fromAddress = email.from?.value?.[0]?.address || "";
        const fromName = email.from?.value?.[0]?.name || null;
        const subject = email.subject || "";
        const body = email.text || (email.html ? email.html.replace(/<[^>]*>/g, " ") : "") || "";
        const receivedAt = email.date || new Date();

        if (isIgnoredEmail(subject)) continue;
        if (!body || body.trim().length < 10) continue;

        // Dedup check before AI call
        const hash = createQuoteEmailHash(fromAddress, subject, receivedAt);
        const existing = await db.quoteEmailSource.findUnique({
          where: { emailHash: hash },
        });
        if (existing) continue;

        const result = await processQuoteEmail(
          fromAddress,
          fromName,
          subject,
          body,
          receivedAt
        );

        if (result) processedCount++;
      } catch (err: any) {
        console.error(`[QuoteEmail] Error processing email: ${err.message}`);
      }
    }

    console.log(`[QuoteEmail] Processed ${processedCount} new quote emails`);
  } catch (err: any) {
    console.error("[QuoteEmail] Poll error:", err.message);
  } finally {
    isPolling = false;
  }

  return processedCount;
}

/**
 * Fetch unseen emails from the last 3 days
 */
function fetchUnseenEmails(config: QuoteImapConfig): Promise<ParsedMail[]> {
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
      const label = process.env.QUOTE_EMAIL_LABEL || "INBOX";

      const tryBox = (boxName: string) => {
        imap.openBox(boxName, false, (err) => {
          if (err) {
            if (boxName !== "INBOX") {
              console.log(`[QuoteEmail] Label "${boxName}" not found, using INBOX`);
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
