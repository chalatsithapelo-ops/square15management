/**
 * AES-256-GCM encryption for bank-feed aggregator tokens at rest.
 *
 * Used to encrypt Stitch / Mono refresh + access tokens before storing on
 * BankAccount.externalRefreshToken / externalAccessToken. The key MUST be
 * 32 bytes (64 hex chars) and is read from BANK_FEED_TOKEN_ENC_KEY.
 *
 * Storage format: <iv-hex>:<ciphertext-hex>:<auth-tag-hex>
 *   - iv: 12 random bytes (96 bits, GCM-recommended)
 *   - auth tag: 16 bytes
 *
 * Generate a key: `openssl rand -hex 32`
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const KEY_LEN_BYTES = 32;

function getKey(): Buffer {
  const hex = process.env.BANK_FEED_TOKEN_ENC_KEY;
  if (!hex) {
    throw new Error(
      "BANK_FEED_TOKEN_ENC_KEY is not set. Generate one with: openssl rand -hex 32"
    );
  }
  if (hex.length !== KEY_LEN_BYTES * 2) {
    throw new Error(
      `BANK_FEED_TOKEN_ENC_KEY must be ${KEY_LEN_BYTES * 2} hex chars (got ${hex.length})`
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt a UTF-8 string. Returns a colon-delimited hex string safe for DB storage.
 * Throws if BANK_FEED_TOKEN_ENC_KEY is missing or wrong length.
 */
export function encryptToken(plain: string): string {
  if (typeof plain !== "string") {
    throw new TypeError("encryptToken: plain must be a string");
  }
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${ciphertext.toString("hex")}:${authTag.toString("hex")}`;
}

/**
 * Decrypt a string produced by `encryptToken`. Throws on tampering / wrong key.
 */
export function decryptToken(payload: string): string {
  if (typeof payload !== "string" || !payload.includes(":")) {
    throw new Error("decryptToken: invalid payload format");
  }
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("decryptToken: expected 3 colon-delimited parts");
  }
  const [ivHex, ctHex, tagHex] = parts;
  const key = getKey();
  const iv = Buffer.from(ivHex!, "hex");
  const ciphertext = Buffer.from(ctHex!, "hex");
  const authTag = Buffer.from(tagHex!, "hex");
  if (iv.length !== IV_LEN) {
    throw new Error(`decryptToken: IV length must be ${IV_LEN} bytes`);
  }
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}

/**
 * Helper: encrypt only if non-null. Returns null for null/empty input.
 */
export function encryptTokenOrNull(plain: string | null | undefined): string | null {
  if (!plain) return null;
  return encryptToken(plain);
}

/**
 * Helper: decrypt only if non-null. Returns null for null/empty input.
 */
export function decryptTokenOrNull(payload: string | null | undefined): string | null {
  if (!payload) return null;
  return decryptToken(payload);
}
