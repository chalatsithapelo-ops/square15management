import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { db } from "~/server/db";
import Imap from "imap";

// ── DB keys for the three pollers ────────────────────────────────────
const KEYS = {
  finance: {
    host: "finance_imap_host",
    port: "finance_imap_port",
    user: "finance_imap_user",
    password: "finance_imap_password",
    enabled: "finance_imap_enabled",
  },
  orders: {
    host: "orders_imap_host",
    port: "orders_imap_port",
    user: "orders_imap_user",
    password: "orders_imap_password",
    enabled: "orders_imap_enabled",
  },
  quotes: {
    host: "quotes_imap_host",
    port: "quotes_imap_port",
    user: "quotes_imap_user",
    password: "quotes_imap_password",
    enabled: "quotes_imap_enabled",
  },
} as const;

type PollerType = keyof typeof KEYS;

const ALL_KEYS = Object.values(KEYS).flatMap((k) => Object.values(k));

// ── Helpers ──────────────────────────────────────────────────────────
function toMap(rows: { key: string; value: string | null }[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const r of rows) if (r.value) map[r.key] = r.value;
  return map;
}

function pollerFromMap(map: Record<string, string>, type: PollerType) {
  const k = KEYS[type];
  return {
    host: map[k.host] || "",
    port: map[k.port] || "993",
    user: map[k.user] || "",
    password: map[k.password] || "",
    enabled: map[k.enabled] !== "false", // default true if key doesnt exist
    isConfigured: !!(map[k.user] && map[k.password]),
  };
}

/** Obfuscate password for client display */
function maskPassword(pw: string): string {
  if (!pw) return "";
  if (pw.length <= 4) return "****";
  return pw.slice(0, 2) + "*".repeat(pw.length - 4) + pw.slice(-2);
}

// ── Read all automation settings ─────────────────────────────────────
export const getEmailAutomationSettings = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const allowedRoles = ["ADMIN", "SENIOR_ADMIN", "PROPERTY_MANAGER", "CONTRACTOR"];
    if (!allowedRoles.includes(user.role)) {
      throw new Error("You do not have permission to view email automation settings");
    }

    const rows = await db.systemSettings.findMany({
      where: { key: { in: ALL_KEYS } },
    });
    const map = toMap(rows);

    return {
      finance: {
        ...pollerFromMap(map, "finance"),
        password: maskPassword(pollerFromMap(map, "finance").password),
      },
      orders: {
        ...pollerFromMap(map, "orders"),
        password: maskPassword(pollerFromMap(map, "orders").password),
      },
      quotes: {
        ...pollerFromMap(map, "quotes"),
        password: maskPassword(pollerFromMap(map, "quotes").password),
      },
    };
  });

// ── Update one poller's settings ─────────────────────────────────────
export const updateEmailAutomationSettings = baseProcedure
  .input(
    z.object({
      token: z.string(),
      poller: z.enum(["finance", "orders", "quotes"]),
      host: z.string().min(1, "IMAP host is required"),
      port: z.string().regex(/^\d+$/, "Port must be a number"),
      user: z.string().min(1, "Email address is required"),
      password: z.string().min(1, "Password is required"),
      enabled: z.boolean(),
    })
  )
  .mutation(async ({ input }) => {
    const authUser = await authenticateUser(input.token);

    const allowedRoles = ["ADMIN", "SENIOR_ADMIN", "PROPERTY_MANAGER", "CONTRACTOR"];
    if (!allowedRoles.includes(authUser.role)) {
      throw new Error("You do not have permission to update email automation settings");
    }

    const k = KEYS[input.poller];

    await Promise.all([
      db.systemSettings.upsert({
        where: { key: k.host },
        create: { key: k.host, value: input.host },
        update: { value: input.host },
      }),
      db.systemSettings.upsert({
        where: { key: k.port },
        create: { key: k.port, value: input.port },
        update: { value: input.port },
      }),
      db.systemSettings.upsert({
        where: { key: k.user },
        create: { key: k.user, value: input.user },
        update: { value: input.user },
      }),
      db.systemSettings.upsert({
        where: { key: k.password },
        create: { key: k.password, value: input.password },
        update: { value: input.password },
      }),
      db.systemSettings.upsert({
        where: { key: k.enabled },
        create: { key: k.enabled, value: String(input.enabled) },
        update: { value: String(input.enabled) },
      }),
    ]);

    return { success: true, message: `${input.poller} email settings saved` };
  });

// ── Test IMAP connection ─────────────────────────────────────────────
export const testEmailAutomationConnection = baseProcedure
  .input(
    z.object({
      token: z.string(),
      host: z.string().min(1),
      port: z.string().regex(/^\d+$/),
      user: z.string().min(1),
      password: z.string().min(1),
    })
  )
  .mutation(async ({ input }) => {
    const authUser = await authenticateUser(input.token);

    const allowedRoles = ["ADMIN", "SENIOR_ADMIN", "PROPERTY_MANAGER", "CONTRACTOR"];
    if (!allowedRoles.includes(authUser.role)) {
      throw new Error("You do not have permission to test email connections");
    }

    return new Promise<{ success: boolean; message: string; messageCount?: number }>((resolve) => {
      const imap = new Imap({
        user: input.user,
        password: input.password,
        host: input.host,
        port: parseInt(input.port, 10),
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        connTimeout: 15000,
        authTimeout: 10000,
      });

      const timeout = setTimeout(() => {
        try { imap.end(); } catch {}
        resolve({ success: false, message: "Connection timed out after 15 seconds" });
      }, 16000);

      imap.once("ready", () => {
        imap.openBox("INBOX", true, (err, box) => {
          clearTimeout(timeout);
          if (err) {
            try { imap.end(); } catch {}
            resolve({ success: false, message: `Connected but failed to open INBOX: ${err.message}` });
            return;
          }
          const count = box.messages.total;
          try { imap.end(); } catch {}
          resolve({
            success: true,
            message: `Connected successfully to ${input.host}. INBOX has ${count} message(s).`,
            messageCount: count,
          });
        });
      });

      imap.once("error", (err: Error) => {
        clearTimeout(timeout);
        let msg = err.message;
        if (msg.includes("AUTHENTICATIONFAILED") || msg.includes("Invalid credentials")) {
          msg = "Authentication failed — check email and password";
        } else if (msg.includes("ENOTFOUND") || msg.includes("getaddrinfo")) {
          msg = `Could not find host "${input.host}" — check the IMAP hostname`;
        } else if (msg.includes("ECONNREFUSED")) {
          msg = `Connection refused on ${input.host}:${input.port} — check host and port`;
        }
        resolve({ success: false, message: msg });
      });

      imap.connect();
    });
  });

// ── Restart pollers (applies DB settings without server restart) ─────
export const restartEmailPollers = baseProcedure
  .input(z.object({ token: z.string() }))
  .mutation(async ({ input }) => {
    const authUser = await authenticateUser(input.token);

    const allowedRoles = ["ADMIN", "SENIOR_ADMIN"];
    if (!allowedRoles.includes(authUser.role)) {
      throw new Error("Only admins can restart email pollers");
    }

    // Import the stop/start functions
    const { stopEmailPoller, startEmailPoller } = await import("~/server/services/bankFeed/emailPoller");
    const { stopOrderEmailPoller, startOrderEmailPoller } = await import("~/server/services/orderEmail/orderEmailPoller");
    const { stopQuoteEmailPoller, startQuoteEmailPoller } = await import("~/server/services/quoteEmail/quoteEmailPoller");

    // Read current settings from DB
    const rows = await db.systemSettings.findMany({
      where: { key: { in: ALL_KEYS } },
    });
    const map = toMap(rows);

    const results: string[] = [];

    // Stop all pollers first
    stopEmailPoller();
    stopOrderEmailPoller();
    stopQuoteEmailPoller();

    // Restart each enabled poller with DB settings
    for (const type of ["finance", "orders", "quotes"] as PollerType[]) {
      const cfg = pollerFromMap(map, type);

      if (!cfg.enabled) {
        results.push(`${type}: disabled`);
        continue;
      }
      if (!cfg.isConfigured) {
        results.push(`${type}: not configured (skipped)`);
        continue;
      }

      const imapCfg = {
        host: cfg.host,
        port: parseInt(cfg.port, 10),
        tls: true,
        user: cfg.user,
        password: cfg.password,
      };

      try {
        if (type === "finance") startEmailPoller(imapCfg, 5 * 60 * 1000);
        else if (type === "orders") startOrderEmailPoller(imapCfg, 5 * 60 * 1000);
        else startQuoteEmailPoller(imapCfg, 5 * 60 * 1000);
        results.push(`${type}: started for ${cfg.user}`);
      } catch (err: any) {
        results.push(`${type}: failed — ${err.message}`);
      }
    }

    return { success: true, results };
  });

// ── Helper to load DB settings (used by handler.ts bootstrap) ────────
export async function loadPollerConfigFromDB(type: PollerType): Promise<{
  host: string;
  port: number;
  tls: boolean;
  user: string;
  password: string;
} | null> {
  const k = KEYS[type];
  const rows = await db.systemSettings.findMany({
    where: { key: { in: Object.values(k) } },
  });
  const map = toMap(rows);
  const cfg = pollerFromMap(map, type);

  if (!cfg.enabled || !cfg.isConfigured) return null;

  return {
    host: cfg.host || "imap.gmail.com",
    port: parseInt(cfg.port, 10) || 993,
    tls: true,
    user: cfg.user,
    password: cfg.password,
  };
}
