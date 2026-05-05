/**
 * HMAC-signed OAuth `state` parameter for Stitch link flow.
 *
 * Avoids needing Redis / DB storage for the short-lived state nonce by
 * encoding (userId, bankAccountId, expiry) and signing with the same
 * BANK_FEED_TOKEN_ENC_KEY (used as a generic server secret here).
 *
 * Format: base64url(payload).hmac-hex
 *   payload JSON: { u: userId, a: bankAccountId, e: expiryMs, n: nonce }
 *
 * Default TTL: 10 minutes.
 */

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const TTL_MS = 10 * 60 * 1000;

function getSecret(): string {
  const k = process.env.BANK_FEED_TOKEN_ENC_KEY;
  if (!k) throw new Error("[linkState] BANK_FEED_TOKEN_ENC_KEY not set");
  return k;
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createState(opts: { userId: number; bankAccountId: number }): string {
  const payload = JSON.stringify({
    u: opts.userId,
    a: opts.bankAccountId,
    e: Date.now() + TTL_MS,
    n: randomBytes(8).toString("hex"),
  });
  const enc = b64urlEncode(Buffer.from(payload, "utf8"));
  return `${enc}.${sign(enc)}`;
}

export function verifyState(state: string): { userId: number; bankAccountId: number } {
  const dot = state.lastIndexOf(".");
  if (dot < 0) throw new Error("malformed state");
  const enc = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = sign(enc);
  if (sig.length !== expected.length) throw new Error("bad signature");
  if (!timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) {
    throw new Error("bad signature");
  }
  const payload = JSON.parse(b64urlDecode(enc).toString("utf8")) as {
    u: number;
    a: number;
    e: number;
  };
  if (typeof payload.u !== "number" || typeof payload.a !== "number") {
    throw new Error("bad payload");
  }
  if (Date.now() > payload.e) throw new Error("state expired");
  return { userId: payload.u, bankAccountId: payload.a };
}
