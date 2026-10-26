import { runDebtorReminderSweep } from "./debtorReminders";
import { runVatReconciliation } from "./vatReconciliation";
import { backfillPaidArtisanStatements } from "./artisanStatements";
import { runInvoicePaymentAutoMatch } from "~/server/services/bankFeed/invoicePaymentMatcher";
let financeSchedulerStarted = false;
export function startFinanceAutomationScheduler() {
  if (financeSchedulerStarted) return;
  if (process.env.FINANCE_AUTOMATIONS_ENABLED === "0") return;
  // PM2 cluster runs several workers; only the first may send client emails.
  if (process.env.NODE_APP_INSTANCE !== undefined && process.env.NODE_APP_INSTANCE !== "0") return;
  financeSchedulerStarted = true;
  let lastRunKey = "";
  let lastMatchHour = "";
  const autoMatch = async (label: string) => {
    try {
      const r = await runInvoicePaymentAutoMatch();
      if (r.allocated.length) console.log(`[finance-automation] ${label} invoice auto-match`, r.allocated.map((a) => `${a.transactionId}->${a.invoiceNumbers.join("+")}`).join(", "));
    } catch (e: any) { console.error("[finance-automation] invoice auto-match failed", e?.message ?? e); }
  };
  const tick = async () => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const dateKey = `${v.year}-${v.month}-${v.day}`;
    const hourKey = `${dateKey}T${v.hour}`;
    if (lastMatchHour !== hourKey) {
      lastMatchHour = hourKey;
      await autoMatch("hourly");
    }
    if (Number(v.hour) !== 9 || Number(v.minute) >= 15 || lastRunKey === dateKey) return;
    lastRunKey = dateKey;
    // Settle invoices from the bank feed first so paid clients are never chased.
    await autoMatch("pre-reminder");
    try { console.log("[finance-automation] debtor sweep", await runDebtorReminderSweep()); } catch (e: any) { console.error("[finance-automation] debtor sweep failed", e?.message ?? e); }
    try { const r = await runVatReconciliation("scheduler"); console.log(`[finance-automation] VAT reconciliation #${r.id}`); } catch (e: any) { console.error("[finance-automation] VAT reconciliation failed", e?.message ?? e); }
    try { console.log("[finance-automation] contractor statements", await backfillPaidArtisanStatements()); } catch (e: any) { console.error("[finance-automation] statements failed", e?.message ?? e); }
  };
  setInterval(() => { void tick(); }, 15 * 60 * 1000);
  console.log("[finance-automation] scheduled for 09:00 Africa/Johannesburg; no immediate dispatch");
}
