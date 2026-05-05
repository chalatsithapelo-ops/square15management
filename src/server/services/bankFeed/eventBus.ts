/**
 * In-process event bus for bank-feed updates.
 *
 * Used by:
 *   - emailPoller / IMAP IDLE handler — emits "transaction" on every new row.
 *   - SSE endpoint at /api/bank-feed/stream — subscribes and pushes to
 *     connected browsers.
 *
 * Single-process only. If/when we move to PM2 cluster mode with > 1 worker,
 * this needs to be replaced with Redis pub/sub. (Production is currently
 * 2-instance cluster — see notes in change-management plan.)
 */
import { EventEmitter } from "events";

export interface BankFeedTransactionEvent {
  bankAccountId: number;
  transactionId: number;
  transactionDate: string; // ISO
  amount: number;
  transactionType: "DEBIT" | "CREDIT";
  description: string;
  source: "EMAIL" | "CSV" | "API" | "MANUAL";
}

class BankFeedEventBus extends EventEmitter {
  emitTransaction(event: BankFeedTransactionEvent) {
    this.emit("transaction", event);
  }
  onTransaction(listener: (event: BankFeedTransactionEvent) => void) {
    this.on("transaction", listener);
    return () => this.off("transaction", listener);
  }
}

// Allow many SSE subscribers without warning
const bus = new BankFeedEventBus();
bus.setMaxListeners(100);

export const bankFeedEvents = bus;
