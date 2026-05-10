/**
 * Cashbook Panel — Management Accounts > Cashbook tab.
 *
 * Read-only view of a single bank account's live transactions.
 * Per change-management plan:
 *   - Strictly per-account (selector at the top); no aggregation.
 *   - Never feeds into the existing accrual revenue / expense roll-ups.
 *   - Hidden behind CASHBOOK_ENABLED feature flag (parent gates rendering).
 *
 * "Cash vs Accrual" reminder banner is intentional staff-training UX so
 * employees understand why these numbers may differ from P&L.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { useBankFeedStream } from "~/hooks/useBankFeedStream";
import { format } from "date-fns";
import {
  Banknote,
  ArrowDownCircle,
  ArrowUpCircle,
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Info,
  ExternalLink,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

interface Props {
  startDate: string;
  endDate: string;
}

export function CashbookPanel({ startDate, endDate }: Props) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    null
  );

  const accountsQuery = useQuery({
    ...trpc.getBankAccounts.queryOptions({ token: token! }),
    enabled: !!token,
  });

  const accounts = accountsQuery.data || [];

  // Auto-select the first account when the list loads
  const effectiveAccountId =
    selectedAccountId ?? (accounts.length > 0 ? accounts[0]!.id : null);

  const summaryQuery = useQuery({
    ...trpc.getCashbookSummary.queryOptions({
      token: token!,
      bankAccountId: effectiveAccountId!,
      startDate,
      endDate,
      limit: 100,
    }),
    enabled: !!token && !!effectiveAccountId,
    refetchInterval: 5 * 60 * 1000, // 5-min safety net; primary refresh is SSE
  });

  const gapsQuery = useQuery({
    ...trpc.getReconciliationGaps.queryOptions({
      token: token!,
      bankAccountId: effectiveAccountId!,
      startDate,
      endDate,
    }),
    enabled: !!token && !!effectiveAccountId,
    refetchInterval: 5 * 60 * 1000,
  });

  // Real-time push: refresh KPIs/transactions immediately when a new bank
  // transaction lands for the selected account.
  const queryClient = useQueryClient();
  useBankFeedStream({
    bankAccountId: effectiveAccountId,
    enabled: !!token && !!effectiveAccountId,
    onTransaction: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.getCashbookSummary.queryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.getReconciliationGaps.queryKey(),
      });
    },
  });

  const summary = summaryQuery.data;
  const gaps = gapsQuery.data;

  const fmtMoney = useMemo(
    () => (val: number | null | undefined) =>
      val == null
        ? "—"
        : new Intl.NumberFormat("en-ZA", {
            style: "currency",
            currency: "ZAR",
          }).format(val),
    []
  );

  if (accountsQuery.isLoading) {
    return <div className="p-6 text-sm text-gray-500">Loading bank accounts…</div>;
  }

  if (accounts.length === 0) {
    return (
      <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <p className="font-medium mb-2">No bank accounts linked yet.</p>
        <p>
          Open the{" "}
          <Link
            to="/admin/bank-feed"
            className="underline font-medium"
          >
            Bank Feed
          </Link>{" "}
          page to add an account, then return here to see the Cashbook.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cash vs Accrual change-management banner */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          <p className="font-medium mb-1">
            Cashbook shows actual bank movements (cash basis).
          </p>
          <p className="text-amber-800">
            Your existing <strong>Revenue, Expenses and P&L tabs are
            unchanged</strong> — they remain accrual-based (invoices &amp;
            recorded expenses). Numbers here may differ if invoices are unpaid
            or bank credits are still unmatched. See the Reconciliation Gaps
            section below to investigate any differences.
          </p>
        </div>
      </div>

      {/* Account selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Banknote className="w-5 h-5 text-blue-600" />
          <label className="text-sm font-medium text-gray-700">
            Bank account:
          </label>
          <select
            value={effectiveAccountId ?? ""}
            onChange={(e) => setSelectedAccountId(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {accounts.map((a: any) => (
              <option key={a.id} value={a.id}>
                {a.accountName} — {a.bankName} ••{a.accountNumber}
              </option>
            ))}
          </select>
        </div>
        <Link
          to="/admin/bank-feed"
          className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          Manage feeds <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* KPI cards */}
      {summaryQuery.isLoading && (
        <div className="text-sm text-gray-500">Loading summary…</div>
      )}
      {summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              icon={<ArrowDownCircle className="w-5 h-5 text-green-600" />}
              label="Money in"
              value={fmtMoney(summary.kpi.moneyIn)}
              sub={`${summary.kpi.creditCount} credit${summary.kpi.creditCount === 1 ? "" : "s"}`}
              tone="green"
            />
            <KpiCard
              icon={<ArrowUpCircle className="w-5 h-5 text-red-600" />}
              label="Money out"
              value={fmtMoney(summary.kpi.moneyOut)}
              sub={`${summary.kpi.debitCount} debit${summary.kpi.debitCount === 1 ? "" : "s"}`}
              tone="red"
            />
            <KpiCard
              icon={<Activity className="w-5 h-5 text-blue-600" />}
              label="Net movement"
              value={fmtMoney(summary.kpi.net)}
              sub={`${summary.kpi.transactionCount} transactions`}
              tone={summary.kpi.net >= 0 ? "green" : "red"}
            />
            <KpiCard
              icon={<Banknote className="w-5 h-5 text-gray-700" />}
              label="Closing balance"
              value={fmtMoney(summary.kpi.closingBalance)}
              sub={
                summary.kpi.openingBalance != null
                  ? `Opening: ${fmtMoney(summary.kpi.openingBalance)}`
                  : "No opening balance recorded"
              }
              tone="gray"
            />
          </div>

          {/* Reconciliation strip */}
          <div className="grid grid-cols-3 gap-3">
            <ReconCell
              icon={<CheckCircle2 className="w-4 h-4 text-green-600" />}
              label="Auto-matched"
              value={summary.reconciliation.matched}
            />
            <ReconCell
              icon={<AlertCircle className="w-4 h-4 text-amber-600" />}
              label="Unmatched"
              value={summary.reconciliation.unmatched}
            />
            <ReconCell
              icon={<Clock className="w-4 h-4 text-blue-600" />}
              label="Pending review"
              value={summary.reconciliation.pendingReview}
            />
          </div>

          {/* Recent transactions */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-900">
                Recent transactions
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Description</th>
                    <th className="px-4 py-2 text-left">Category</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary.transactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No transactions in this period.
                      </td>
                    </tr>
                  )}
                  {summary.transactions.map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap text-gray-700">
                        {format(new Date(tx.transactionDate), "dd MMM yyyy")}
                      </td>
                      <td className="px-4 py-2 text-gray-900 max-w-xs truncate">
                        {tx.description}
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {tx.categorization?.category || "—"}
                      </td>
                      <td
                        className={`px-4 py-2 text-right font-medium whitespace-nowrap ${
                          tx.transactionType === "CREDIT"
                            ? "text-green-700"
                            : "text-red-700"
                        }`}
                      >
                        {tx.transactionType === "CREDIT" ? "+" : "−"}
                        {fmtMoney(tx.amount)}
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={tx.reconciliationStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reconciliation gaps */}
          {gaps && (gaps.paidInvoicesWithoutBankTx.length > 0 || gaps.unmatchedBankCredits.length > 0) && (
            <div className="grid md:grid-cols-2 gap-4">
              <GapList
                title="Paid invoices without bank evidence"
                description="Marked PAID but no linked bank credit. Verify or re-run reconciliation."
                items={gaps.paidInvoicesWithoutBankTx.map((i: any) => ({
                  primary: `${i.invoiceNumber} — ${i.customerName}`,
                  secondary: `${fmtMoney(i.total)} · paid ${format(new Date(i.paidDate), "dd MMM")}`,
                }))}
              />
              <GapList
                title="Bank credits without invoice match"
                description="Money received that hasn't been matched to an invoice yet."
                items={gaps.unmatchedBankCredits.map((t: any) => ({
                  primary: t.description,
                  secondary: `${fmtMoney(t.amount)} · ${format(new Date(t.transactionDate), "dd MMM")}${t.reference ? ` · Ref ${t.reference}` : ""}`,
                }))}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: "green" | "red" | "blue" | "gray";
}) {
  const toneClasses: Record<string, string> = {
    green: "border-green-200 bg-green-50",
    red: "border-red-200 bg-red-50",
    blue: "border-blue-200 bg-blue-50",
    gray: "border-gray-200 bg-white",
  };
  return (
    <div className={`p-4 border rounded-xl ${toneClasses[tone]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs uppercase tracking-wide text-gray-600 font-medium">
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{sub}</div>
    </div>
  );
}

function ReconCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center gap-2 text-sm text-gray-700">
        {icon}
        {label}
      </div>
      <div className="text-lg font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    MATCHED: { label: "Matched", cls: "bg-green-100 text-green-700" },
    UNMATCHED: { label: "Unmatched", cls: "bg-amber-100 text-amber-700" },
    PARTIALLY_MATCHED: {
      label: "Partial",
      cls: "bg-blue-100 text-blue-700",
    },
    DISPUTED: { label: "Disputed", cls: "bg-red-100 text-red-700" },
    IGNORED: { label: "Ignored", cls: "bg-gray-100 text-gray-600" },
  };
  const cfg = map[status] || { label: status, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function GapList({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: { primary: string; secondary: string }[];
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl">
      <div className="px-4 py-3 border-b border-gray-200">
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <ul className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
        {items.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-gray-400">
            None — all good.
          </li>
        )}
        {items.slice(0, 20).map((item, i) => (
          <li key={i} className="px-4 py-2">
            <div className="text-sm text-gray-900 truncate">{item.primary}</div>
            <div className="text-xs text-gray-500">{item.secondary}</div>
          </li>
        ))}
        {items.length > 20 && (
          <li className="px-4 py-2 text-xs text-gray-500 text-center">
            …and {items.length - 20} more
          </li>
        )}
      </ul>
    </div>
  );
}
