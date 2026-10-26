import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { format } from "date-fns";

const RS = (n: number) =>
  "R" + (n ?? 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const REVENUE_LABELS: Record<string, string> = {
  INVOICE_PAYMENT: "Client invoice payments (Broll, City Property, Momentum, etc.)",
  RENTAL_INCOME: "Rental income",
  INVESTMENTS: "Investment returns",
  OTHER_REVENUE: "Other revenue",
};

const COS_LABELS: Record<string, string> = {
  MATERIAL_PURCHASE: "Material purchases (hardware, tiles, plumbing, etc.)",
  INDEPENDENT_CONTRACTOR: "Independent contractor labour (plumbers, electricians, etc.)",
  SALARIES: "Fixed employee salaries",
};

const OPEX_LABELS: Record<string, string> = {
  RENT: "Rent",
  UTILITIES: "Utilities (electricity, water)",
  TELECOMMUNICATIONS: "Telecoms (Vodacom, MTN, etc.)",
  SOFTWARE_SUBSCRIPTIONS: "Software subscriptions",
  PETROL: "Fuel / petrol",
  TRAVEL: "Travel (Uber, Bolt, car hire, parking)",
  MARKETING: "Marketing / advertising",
  OFFICE_SUPPLIES: "Office supplies",
  INSURANCE: "Insurance",
  PROFESSIONAL_FEES: "Professional fees (attorneys, accountants)",
  MAINTENANCE: "Property maintenance",
  OTHER: "Other operating expenses",
};

interface Props {
  dateRange: { start: string; end: string };
}

export default function CashBasisPLStatement({ dateRange }: Props) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const q = useQuery(
    trpc.getBankIntegratedPL.queryOptions({
      token: token!,
      start: dateRange.start,
      end: dateRange.end,
    }),
  );

  if (q.isLoading)
    return (
      <div className="rounded-xl border border-gray-200 p-8 text-center text-gray-500">
        Loading cash-basis P&L…
      </div>
    );

  if (q.error)
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
        Error: {(q.error as Error).message}
      </div>
    );

  const data = q.data!;
  const c = data.cashBasis;
  const a = data.accrualSnapshot;
  const r = data.reconciliation;

  return (
    <div className="space-y-6">
      {/* Header + explainer */}
      <div className="bg-emerald-50 border-l-4 border-emerald-500 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Wallet className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-emerald-900">Cash-basis P&L · Direct from Bank Feed</h3>
            <p className="text-sm text-emerald-800 mt-1">
              Every rand in and out categorised by the bank-feed engine. No accrual estimation, no
              double-counting between Invoice / Order / PaymentRequest tables. This is what actually
              hit your bank account between{" "}
              <b>{format(new Date(dateRange.start), "dd MMM yyyy")}</b> and{" "}
              <b>{format(new Date(dateRange.end), "dd MMM yyyy")}</b>.
            </p>
            {data.bankAccount && (
              <p className="text-xs text-emerald-700 mt-2">
                Bank current balance: <b>{RS(data.bankAccount.currentBalance ?? 0)}</b> ({data.bankAccount.name}) as of{" "}
                {data.bankAccount.asOf ? format(new Date(data.bankAccount.asOf), "dd MMM yyyy HH:mm") : "unknown"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Revenue */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-bold text-green-900">REVENUE (money received)</h3>
        </div>
        <div className="space-y-1">
          {Object.entries(c.revenueByCategory)
            .sort((a, b) => (b[1] as number) - (a[1] as number))
            .map(([cat, amt]) => (
              <div key={cat} className="flex justify-between py-1.5 text-sm">
                <span className="text-gray-700">{REVENUE_LABELS[cat] ?? cat}</span>
                <span className="font-semibold text-gray-900">{RS(amt as number)}</span>
              </div>
            ))}
          {Object.keys(c.revenueByCategory).length === 0 && (
            <div className="text-sm text-gray-500 italic">No revenue transactions in this period.</div>
          )}
          <div className="pt-2 border-t-2 border-green-300 flex justify-between items-center">
            <span className="font-bold text-green-900">Total Revenue</span>
            <span className="text-xl font-bold text-green-600">{RS(c.totalRevenue)}</span>
          </div>
        </div>
      </div>

      {/* Cost of Sales */}
      <div className="bg-orange-50 rounded-xl p-6 border border-orange-200">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="w-5 h-5 text-orange-600" />
          <h3 className="text-lg font-bold text-orange-900">COST OF SALES</h3>
        </div>
        <div className="space-y-1">
          {Object.entries(c.costOfSalesByCategory)
            .sort((a, b) => (b[1] as number) - (a[1] as number))
            .map(([cat, amt]) => (
              <div key={cat} className="flex justify-between py-1.5 text-sm">
                <span className="text-gray-700">{COS_LABELS[cat] ?? cat}</span>
                <span className="font-semibold text-gray-900">{RS(amt as number)}</span>
              </div>
            ))}
          {Object.keys(c.costOfSalesByCategory).length === 0 && (
            <div className="text-sm text-gray-500 italic">No COS transactions.</div>
          )}
          <div className="pt-2 border-t-2 border-orange-300 flex justify-between items-center">
            <span className="font-bold text-orange-900">Total Cost of Sales</span>
            <span className="text-lg font-bold text-orange-700">{RS(c.totalCostOfSales)}</span>
          </div>
        </div>
      </div>

      {/* Gross Profit */}
      <div className={`rounded-xl p-4 border-2 flex justify-between items-center ${
        c.grossProfit >= 0 ? "bg-blue-50 border-blue-300" : "bg-red-50 border-red-300"
      }`}>
        <span className={`font-bold ${c.grossProfit >= 0 ? "text-blue-900" : "text-red-900"}`}>
          GROSS PROFIT (Revenue − Cost of Sales)
        </span>
        <span className={`text-2xl font-bold ${c.grossProfit >= 0 ? "text-blue-700" : "text-red-700"}`}>
          {RS(c.grossProfit)}
        </span>
      </div>

      {/* Operating Expenses */}
      <div className="bg-red-50 rounded-xl p-6 border border-red-200">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="w-5 h-5 text-red-600" />
          <h3 className="text-lg font-bold text-red-900">OPERATING EXPENSES</h3>
        </div>
        <div className="space-y-1">
          {Object.entries(c.operatingExpensesByCategory)
            .sort((a, b) => (b[1] as number) - (a[1] as number))
            .map(([cat, amt]) => (
              <div key={cat} className="flex justify-between py-1.5 text-sm">
                <span className="text-gray-700">{OPEX_LABELS[cat] ?? cat}</span>
                <span className="font-semibold text-gray-900">{RS(amt as number)}</span>
              </div>
            ))}
          {Object.keys(c.operatingExpensesByCategory).length === 0 && (
            <div className="text-sm text-gray-500 italic">No operating expenses in this period.</div>
          )}
          <div className="pt-2 border-t-2 border-red-300 flex justify-between items-center">
            <span className="font-bold text-red-900">Total Operating Expenses</span>
            <span className="text-lg font-bold text-red-700">{RS(c.totalOperatingExpenses)}</span>
          </div>
        </div>
      </div>

      {/* Net Profit */}
      <div className={`rounded-xl p-6 border-2 flex justify-between items-center ${
        c.netProfit >= 0 ? "bg-emerald-100 border-emerald-500" : "bg-red-100 border-red-500"
      }`}>
        <div>
          <div className={`font-bold text-lg ${c.netProfit >= 0 ? "text-emerald-900" : "text-red-900"}`}>
            {c.netProfit >= 0 ? "NET PROFIT" : "NET LOSS"}
          </div>
          <div className="text-xs text-gray-600 mt-0.5">
            = Gross Profit − Operating Expenses{c.refunds !== 0 ? " + Refunds" : ""}
          </div>
        </div>
        <div className={`text-3xl font-bold ${c.netProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
          {RS(c.netProfit)}
        </div>
      </div>

      {/* Accrual snapshot */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-bold text-gray-900">Accrual snapshot (as of today)</h3>
          <span className="text-xs text-gray-500">— not part of cash P&L; shown for context</span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-green-50 rounded-lg p-3">
            <div className="font-semibold text-green-900 mb-2">Money owed to us (AR)</div>
            <div className="flex justify-between py-1">
              <span>SENT / APPROVED / OVERDUE</span>
              <span className="font-semibold">{RS(a.accountsReceivableSentApproved)}</span>
            </div>
            <div className="flex justify-between py-1 text-xs text-gray-600">
              <span>PENDING_REVIEW (provisional)</span>
              <span>{RS(a.accountsReceivablePendingReview)}</span>
            </div>
          </div>
          <div className="bg-red-50 rounded-lg p-3">
            <div className="font-semibold text-red-900 mb-2">Money we owe (AP)</div>
            <div className="flex justify-between py-1">
              <span>Wages pending + approved</span>
              <span className="font-semibold">{RS(a.accountsPayableWages)}</span>
            </div>
            <div className="flex justify-between py-1 text-xs text-gray-600">
              <span>Ops expenses accrued</span>
              <span>{RS(a.accountsPayableOps)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reconciliation panel */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          {Math.abs(r.gap) < 1 ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          )}
          <h3 className="text-lg font-bold text-gray-900">Reconciliation checkpoint</h3>
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-gray-700">Bank INVOICE_PAYMENT receipts (period)</span>
            <span className="font-semibold">{RS(r.bankInvoicePaymentReceipts)}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-gray-700">Invoices marked PAID (period)</span>
            <span className="font-semibold">{RS(r.invoicesMarkedPaidInPeriod)}</span>
          </div>
          <div className={`flex justify-between py-2 border-t border-gray-200 ${
            Math.abs(r.gap) < 1 ? "text-emerald-700" : "text-amber-700"
          }`}>
            <span className="font-bold">Gap (bank − invoices)</span>
            <span className="font-bold">{RS(r.gap)}</span>
          </div>
          {Math.abs(r.gap) > 100 && (
            <p className="text-xs text-amber-800 italic mt-2">
              A non-zero gap means bank receipts and invoice PAID markings aren't fully aligned.
              This is usually bulk lodgements from Broll / Momentum / etc. covering multiple invoices,
              or single receipts still awaiting invoice allocation. Head to Bank Feed to review.
            </p>
          )}
        </div>
        {c.uncategorisedFlowingBothWays > 0 && (
          <p className="text-xs text-amber-700 mt-3 italic">
            {RS(c.uncategorisedFlowingBothWays)} in transactions flowed through categories that
            don't roll into P&L (transfers, uncategorised). Review these on the Bank Feed page.
          </p>
        )}
      </div>
    </div>
  );
}
