/**
 * Nedbank mTLS transport helper.
 *
 * Since 2026-07 the Nedbank Accounts API sandbox app requires mutual TLS
 * — Nedbank emails a PKCS#12 (.pfx) client cert + passphrase and expects
 * every API call to present it at the TLS handshake.
 *
 * This module builds a Node undici Agent from that .pfx and exposes it
 * as a fetch `dispatcher`. Node 18+'s global fetch is undici under the
 * hood and accepts `{ dispatcher }` per request, so we can opt every
 * Nedbank call in without swapping HTTP libraries.
 *
 * Env:
 *   NEDBANK_CERT_PATH        Absolute path to the .pfx / .p12 file
 *   NEDBANK_CERT_PASSPHRASE  Passphrase for the .pfx (may be empty)
 *
 * When NEDBANK_CERT_PATH is unset, `getNedbankDispatcher()` returns null
 * and callers fall back to the default (plain-TLS) fetch — this keeps
 * the older non-mTLS sandbox tenants working.
 *
 * Caching: the Agent is instantiated once per (path, passphrase) pair
 * and cached for the process lifetime. A file-mtime check invalidates
 * the cache if the cert is rotated on disk without a restart.
 */

import { existsSync, readFileSync, statSync } from "fs";
import { Agent } from "undici";

let cached: {
  agent: Agent;
  path: string;
  passphraseHash: string;
  mtimeMs: number;
} | null = null;

/** Cheap non-crypto hash so we can invalidate the cache on passphrase change
 *  without keeping the plaintext passphrase in memory as a cache key. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16);
}

/**
 * Returns an undici Agent configured with the Nedbank sandbox mTLS
 * certificate, or null when no cert is configured. Lazy + cached.
 * Throws only when NEDBANK_CERT_PATH points at a missing file.
 */
export function getNedbankDispatcher(): Agent | null {
  const p = (process.env.NEDBANK_CERT_PATH || "").trim();
  if (!p) return null;

  if (!existsSync(p)) {
    throw new Error(
      `[Nedbank] mTLS cert not found at NEDBANK_CERT_PATH=${p}. ` +
        `Check the file exists and the app has read permission.`
    );
  }

  const passphrase = process.env.NEDBANK_CERT_PASSPHRASE || "";
  const passphraseHash = fnv1a(passphrase);
  const stat = statSync(p);

  if (
    cached &&
    cached.path === p &&
    cached.passphraseHash === passphraseHash &&
    cached.mtimeMs === stat.mtimeMs
  ) {
    return cached.agent;
  }

  const pfx = readFileSync(p);
  const agent = new Agent({
    connect: {
      pfx,
      passphrase: passphrase || undefined,
    },
  });

  // Best-effort dispose of the previous agent so long-running servers
  // don't leak sockets when the cert file is rotated on disk.
  if (cached) {
    cached.agent.close().catch(() => {});
  }

  cached = { agent, path: p, passphraseHash, mtimeMs: stat.mtimeMs };
  return agent;
}

/**
 * Convenience: returns an object suitable for spreading into a fetch()
 * options bag. Yields `{ dispatcher }` when mTLS is configured, else `{}`.
 * Using this at every call site keeps the fetch signature identical
 * whether or not mTLS is on.
 */
export function nedbankFetchOpts(): { dispatcher?: Agent } {
  const d = getNedbankDispatcher();
  return d ? { dispatcher: d } : {};
}
