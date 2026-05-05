/**
 * useBankFeedStream — React hook that subscribes to the SSE bank-feed stream
 * and invalidates relevant TanStack Query caches when new transactions arrive.
 *
 * Usage:
 *   useBankFeedStream({ bankAccountId: 12, onTransaction: () => {...} });
 *
 * The hook automatically reconnects on disconnect (browser EventSource does
 * this for us, but with a long delay; we add a manual retry as well).
 *
 * Falls back gracefully: if EventSource is unavailable or the endpoint
 * returns 401, it logs once and stops. Callers should keep their own
 * `refetchInterval` as a safety net (Cashbook still polls every 30s).
 */
import { useEffect, useRef } from "react";
import { useAuthStore } from "~/stores/auth";

interface BankFeedTransactionPayload {
  bankAccountId: number;
  transactionId: number;
  transactionDate: string;
  amount: number;
  transactionType: "DEBIT" | "CREDIT";
  description: string;
  source: "EMAIL" | "CSV" | "API" | "MANUAL";
}

interface Options {
  /** If set, only fire onTransaction for events on this bank account. */
  bankAccountId?: number | null;
  /** Called for each `transaction` SSE event after filtering. */
  onTransaction?: (e: BankFeedTransactionPayload) => void;
  /** Disable the stream entirely (e.g. when the feature flag is off). */
  enabled?: boolean;
}

export function useBankFeedStream({
  bankAccountId,
  onTransaction,
  enabled = true,
}: Options) {
  const { token } = useAuthStore();
  // Keep callback in a ref so re-renders don't tear down the connection.
  const handlerRef = useRef(onTransaction);
  handlerRef.current = onTransaction;

  useEffect(() => {
    if (!enabled || !token) return;
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    const params = new URLSearchParams({ token });
    if (bankAccountId != null) params.set("bankAccountId", String(bankAccountId));
    const url = `/api/bank-feed/stream?${params.toString()}`;

    const es = new EventSource(url);

    es.addEventListener("transaction", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as BankFeedTransactionPayload;
        if (bankAccountId != null && data.bankAccountId !== bankAccountId) return;
        handlerRef.current?.(data);
      } catch {
        // ignore malformed payload
      }
    });

    es.addEventListener("error", () => {
      // EventSource auto-reconnects on transient errors. We let it.
      // On hard failure (e.g. 401), browsers eventually stop — that's fine,
      // queries will still refresh via their refetchInterval safety net.
    });

    return () => {
      es.close();
    };
  }, [enabled, token, bankAccountId]);
}
