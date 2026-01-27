import crypto from "crypto";
import { env } from "~/server/env";

export type PayfastPaymentOption =
  | "CARD"
  | "S_PAY"
  | "INSTANT_EFT"
  | "SNAPSCAN"
  | "ZAPPER"
  | "MASTERPASS"
  | "FNB_PAY";

export type PayfastCheckoutFields = Record<string, string>;

function pfEncode(value: string): string {
  // PayFast expects URL encoding similar to query-string encoding.
  // Replace %20 with '+' to match typical form encoding.
  // `encodeURIComponent` is close, but PayFast examples are typically based on PHP's `urlencode`.
  // This ensures characters like ! ' ( ) * are percent-encoded and spaces become '+'.
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, "+");
}

function buildSignature(fields: PayfastCheckoutFields, passphrase?: string): string {
  const pairs: string[] = [];

  for (const key of Object.keys(fields).sort()) {
    if (key === "signature") continue;
    const value = fields[key];
    if (value == null || value === "") continue;
    pairs.push(`${key}=${pfEncode(value)}`);
  }

  let payload = pairs.join("&");
  if (passphrase) {
    payload += `&passphrase=${pfEncode(passphrase)}`;
  }

  return crypto.createHash("md5").update(payload).digest("hex");
}

export function verifyPayfastSignature(fields: Record<string, string | undefined | null>): boolean {
  const receivedSignature = (fields.signature ?? "").toString();
  if (!receivedSignature) return false;

  const normalized: PayfastCheckoutFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value == null) continue;
    normalized[key] = String(value);
  }

  const expected = buildSignature(normalized, env.PAYFAST_PASSPHRASE);
  return expected.toLowerCase() === receivedSignature.toLowerCase();
}

export function getPayfastEndpoint(): string {
  // Sandbox uses a different host.
  return env.PAYFAST_SANDBOX ? "https://sandbox.payfast.co.za/eng/process" : "https://www.payfast.co.za/eng/process";
}

export function mapPayfastPaymentMethod(option: PayfastPaymentOption): string | undefined {
  // These values are provider-defined. If a value is not supported on your PayFast account,
  // PayFast will typically ignore it and show the normal checkout options.
  switch (option) {
    case "CARD":
      return "cc";
    case "INSTANT_EFT":
      return "eft";
    case "SNAPSCAN":
      return "snapscan";
    case "ZAPPER":
      return "zapper";
    case "MASTERPASS":
      return "masterpass";
    case "FNB_PAY":
      return "fnbpay";
    case "S_PAY":
      return "spay";
    default:
      return undefined;
  }
}

export function buildPayfastCheckout(fields: Omit<PayfastCheckoutFields, "signature">): {
  endpoint: string;
  fields: PayfastCheckoutFields;
} {
  const merchantId = env.PAYFAST_MERCHANT_ID?.trim();
  const merchantKey = env.PAYFAST_MERCHANT_KEY?.trim();

  if (!merchantId || !merchantKey) {
    throw new Error(
      "PayFast is not configured. Set PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY in .env."
    );
  }

  if (merchantKey.length !== 13) {
    throw new Error(
      "PayFast is misconfigured: PAYFAST_MERCHANT_KEY must be 13 characters (check for extra spaces / wrong value)."
    );
  }

  const fullFields: PayfastCheckoutFields = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    ...fields,
  };

  fullFields.signature = buildSignature(fullFields, env.PAYFAST_PASSPHRASE);

  return {
    endpoint: getPayfastEndpoint(),
    fields: fullFields,
  };
}
