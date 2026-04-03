/**
 * Bank Feed module barrel export.
 */

export { parseEmailNotification, detectBank } from "./emailParsers";
export type { ParsedTransaction } from "./emailParsers";

export { parseCSVStatement } from "./csvParsers";
export type { CSVParseResult } from "./csvParsers";

export { createTransactionHash, storeTransaction, storeBatchTransactions } from "./transactionStore";
export { categorizeTransaction, recategorizeTransaction, confirmCategorization } from "./categorizationEngine";
export { reconcileBankAccount, reconcileTransaction } from "./reconciliationEngine";
export { startEmailPoller, stopEmailPoller, pollEmails } from "./emailPoller";
