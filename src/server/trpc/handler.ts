import { eventHandler } from "h3";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./root";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { startEmailPoller } from "../services/bankFeed/emailPoller";
import { startOrderEmailPoller } from "../services/orderEmail/orderEmailPoller";
import { startQuoteEmailPoller } from "../services/quoteEmail/quoteEmailPoller";
import { loadPollerConfigFromDB } from "./procedures/emailAutomationSettings";

// ── Bank Feed (Finance) Email Poller Bootstrap ───────────────────────
let emailPollerStarted = false;
async function bootstrapEmailPoller() {
  if (emailPollerStarted) return;
  emailPollerStarted = true;

  try {
    // Try DB settings first, fall back to env vars
    const dbConfig = await loadPollerConfigFromDB("finance").catch(() => null);

    const config = dbConfig || (() => {
      const imapHost = process.env.FINANCE_IMAP_HOST || process.env.IMAP_HOST || "imap.gmail.com";
      const imapPort = parseInt(process.env.FINANCE_IMAP_PORT || process.env.IMAP_PORT || "993", 10);
      const imapUser = process.env.FINANCE_IMAP_USER || process.env.SMTP_USER;
      const imapPass = process.env.FINANCE_IMAP_PASSWORD || process.env.SMTP_PASSWORD;
      if (!imapUser || !imapPass) return null;
      return { host: imapHost, port: imapPort, tls: true, user: imapUser, password: imapPass };
    })();

    if (!config) {
      console.log("[Bank Feed] FINANCE_IMAP_USER/PASSWORD not configured — email poller disabled");
      emailPollerStarted = false;
      return;
    }

    startEmailPoller(config, 5 * 60 * 1000);
    console.log(`[Bank Feed] Email poller started for ${config.user} (5 min interval)`);
  } catch (err) {
    console.error("[Bank Feed] Failed to start email poller:", err);
    emailPollerStarted = false;
  }
}

// ── Order Email Poller Bootstrap ─────────────────────────────────────
let orderPollerStarted = false;
async function bootstrapOrderEmailPoller() {
  if (orderPollerStarted) return;
  orderPollerStarted = true;

  try {
    const dbConfig = await loadPollerConfigFromDB("orders").catch(() => null);

    const config = dbConfig || (() => {
      const imapHost = process.env.ORDERS_IMAP_HOST || process.env.IMAP_HOST || "imap.gmail.com";
      const imapPort = parseInt(process.env.ORDERS_IMAP_PORT || process.env.IMAP_PORT || "993", 10);
      const imapUser = process.env.ORDERS_IMAP_USER || process.env.SMTP_USER;
      const imapPass = process.env.ORDERS_IMAP_PASSWORD || process.env.SMTP_PASSWORD;
      if (!imapUser || !imapPass) return null;
      return { host: imapHost, port: imapPort, tls: true, user: imapUser, password: imapPass };
    })();

    if (!config) {
      console.log("[OrderEmail] ORDERS_IMAP_USER/PASSWORD not configured — order email poller disabled");
      orderPollerStarted = false;
      return;
    }

    startOrderEmailPoller(config, 5 * 60 * 1000);
    console.log(`[OrderEmail] Order email poller started for ${config.user} (5 min interval)`);
  } catch (err) {
    console.error("[OrderEmail] Failed to start order email poller:", err);
    orderPollerStarted = false;
  }
}

// ── Quote Email Poller Bootstrap ─────────────────────────────────────
let quotePollerStarted = false;
async function bootstrapQuoteEmailPoller() {
  if (quotePollerStarted) return;
  quotePollerStarted = true;

  try {
    const dbConfig = await loadPollerConfigFromDB("quotes").catch(() => null);

    const config = dbConfig || (() => {
      const imapHost = process.env.QUOTES_IMAP_HOST || process.env.IMAP_HOST || "imap.gmail.com";
      const imapPort = parseInt(process.env.QUOTES_IMAP_PORT || process.env.IMAP_PORT || "993", 10);
      const imapUser = process.env.QUOTES_IMAP_USER;
      const imapPass = process.env.QUOTES_IMAP_PASSWORD;
      if (!imapUser || !imapPass) return null;
      return { host: imapHost, port: imapPort, tls: true, user: imapUser, password: imapPass };
    })();

    if (!config) {
      console.log("[QuoteEmail] QUOTES_IMAP_USER/PASSWORD not configured — quote email poller disabled");
      quotePollerStarted = false;
      return;
    }

    startQuoteEmailPoller(config, 5 * 60 * 1000);
    console.log(`[QuoteEmail] Quote email poller started for ${config.user} (5 min interval)`);
  } catch (err) {
    console.error("[QuoteEmail] Failed to start quote email poller:", err);
    quotePollerStarted = false;
  }
}

const handler = eventHandler(async (event) => {
  // Start email pollers on first request (lazy init)
  bootstrapEmailPoller();
  bootstrapOrderEmailPoller();
  bootstrapQuoteEmailPoller();
  // Debug endpoint for testing Anthropic API.
  // IMPORTANT: Disabled by default and must never leak secrets in production.
  if (
    process.env.TEST_ANTHROPIC_ENABLED === "1" &&
    event.node?.req.url?.includes("/test-anthropic")
  ) {
    try {
      const model = anthropic("claude-4-5-haiku");
      const result = await generateText({
        model,
        system: "You are helpful.",
        messages: [{ role: "user", content: "Say hi." }],
      });

      return new Response(JSON.stringify({ success: true, response: result.text }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error(
        "[Test Anthropic] ERROR:",
        error instanceof Error ? error.message : String(error)
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  try {
    const nodeReq = event.node?.req;
    if (!nodeReq) {
      return new Response(JSON.stringify({ error: "Missing node request" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    const method = nodeReq.method || "GET";
    const headers = new Headers();
    
    // Copy Node.js request headers to Fetch Headers
    if (nodeReq.headers) {
      for (const [key, value] of Object.entries(nodeReq.headers)) {
        if (value != null) {
          headers.set(key, Array.isArray(value) ? value.join(",") : String(value));
        }
      }
    }

    const host = nodeReq.headers.host || "localhost";
    let pathname = nodeReq.url || "/";
    
    // Ensure the path includes /trpc prefix for tRPC routing
    if (!pathname.startsWith("/trpc")) {
      pathname = `/trpc${pathname}`;
    }
    
    const url = `http://${host}${pathname}`;
    const urlObj = new URL(url);

    // For POST/PUT/PATCH, read the body from the Node.js request stream directly
    let body: any = undefined;
    if (method !== "GET" && method !== "HEAD") {
      body = await new Promise<Buffer | undefined>((resolve) => {
        let data = Buffer.alloc(0);
        nodeReq.on("data", (chunk: Buffer) => {
          data = Buffer.concat([data, chunk]);
        });
        nodeReq.on("end", () => {
          resolve(data.length > 0 ? data : undefined);
        });
        nodeReq.on("error", () => {
          resolve(undefined);
        });
      });
    }

    const request = new Request(urlObj.toString(), {
      method,
      headers,
      body,
    });

    // Optional debug logging (OFF by default).
    // Never log query strings (tokens often travel via ?input=... or ?token=...).
    if (process.env.TRPC_DEBUG_LOG_REQUESTS === "1") {
      console.log(`[tRPC] ${method} ${urlObj.pathname}, body size: ${body?.length || 0}`);

      if (process.env.TRPC_DEBUG_LOG_BODY === "1" && body && body.length > 0) {
        try {
          const bodyStr = body.toString("utf-8");
          console.log(
            `[tRPC] Body content (first 500 chars): ${bodyStr.substring(0, 500)}`
          );
        } catch {
          console.log("[tRPC] Could not convert body to string");
        }
      }
    }

    return await fetchRequestHandler({
      endpoint: "/trpc",
      req: request,
      router: appRouter,
      createContext() {
        return {};
      },
      onError({ error, path }) {
        console.error(`[tRPC] error on path '${path}':`, error?.message || error);
      },
    });
  } catch (error) {
    console.error("[tRPC handler] fatal error:", error);
    return new Response(
      JSON.stringify({
        error: { message: "Internal server error", code: "INTERNAL_SERVER_ERROR" },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

(handler as any).__is_handler__ = true;

export default handler;
