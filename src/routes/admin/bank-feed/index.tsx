import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useBankFeedStream } from "~/hooks/useBankFeedStream";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState, useMemo, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import {
  ArrowLeft, Plus, Search, Upload, RefreshCw, Check, X, Edit, Eye,
  Building2, CreditCard, TrendingUp, TrendingDown, AlertCircle,
  CheckCircle, Clock, FileText, Filter, ChevronDown, ChevronRight,
  Loader2, Trash2, AlertTriangle, Landmark, Banknote,
  ArrowUpRight, ArrowDownRight, Database, Zap, Brain,
} from "lucide-react";

export const Route = createFileRoute("/admin/bank-feed/")({
  component: BankFeedPage,
});

// ── Types ────────────────────────────────────────────────────────────────────

const BANK_OPTIONS = [
  { value: "FNB", label: "FNB (First National Bank)" },
  { value: "ABSA", label: "ABSA" },
  { value: "STANDARD_BANK", label: "Standard Bank" },
  { value: "NEDBANK", label: "Nedbank" },
  { value: "CAPITEC", label: "Capitec" },
  { value: "INVESTEC", label: "Investec" },
  { value: "TYMEBANK", label: "TymeBank" },
  { value: "DISCOVERY", label: "Discovery Bank" },
  { value: "OTHER", label: "Other" },
] as const;

const ACCOUNT_TYPE_OPTIONS = [
  { value: "CHEQUE", label: "Cheque Account" },
  { value: "SAVINGS", label: "Savings Account" },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "BUSINESS", label: "Business Account" },
  { value: "PETROL_CARD", label: "Petrol Card" },
] as const;

const EXPENSE_CATEGORIES = [
  "PETROL", "OFFICE_SUPPLIES", "RENT", "UTILITIES", "INSURANCE",
  "BANK_FEES", "SALARIES", "MARKETING", "MATERIAL_PURCHASE", "INDEPENDENT_CONTRACTOR",
  "MAINTENANCE", "TRAVEL", "PROFESSIONAL_FEES", "TELECOMMUNICATIONS",
  "SOFTWARE_SUBSCRIPTIONS", "LOAN_REPAYMENT", "VEHICLE_FINANCE", "HOME_BOND", "OTHER",
];

const REVENUE_CATEGORIES = [
  "INVOICE_PAYMENT", "RENTAL_INCOME", "CONSULTING", "INTEREST",
  "INVESTMENTS", "COMMISSION", "REFUND", "OWNER_CONTRIBUTION", "LOAN_RECEIVED",
  "INTERNAL_TRANSFER", "OTHER_REVENUE",
];

const CATEGORY_LABELS: Record<string, string> = {
  PETROL: "Petrol / Fuel", OFFICE_SUPPLIES: "Office Supplies", RENT: "Rent",
  UTILITIES: "Utilities", INSURANCE: "Insurance", BANK_FEES: "Bank Fees", SALARIES: "Salaries",
  MARKETING: "Marketing", MATERIAL_PURCHASE: "Material Purchase", INDEPENDENT_CONTRACTOR: "Independent Contractor", MAINTENANCE: "Maintenance", TRAVEL: "Travel",
  PROFESSIONAL_FEES: "Professional Fees", TELECOMMUNICATIONS: "Telecoms",
  SOFTWARE_SUBSCRIPTIONS: "Software", OTHER: "Other",
  LOAN_REPAYMENT: "Loan Repayment", VEHICLE_FINANCE: "Car Instalment", HOME_BOND: "Home Bond",
  OWNER_CONTRIBUTION: "Owner Contribution (not revenue)", LOAN_RECEIVED: "Loan Received (not revenue)",
  INTERNAL_TRANSFER: "Internal Transfer (not revenue)",
  INVOICE_PAYMENT: "Invoice Payment", RENTAL_INCOME: "Rental Income",
  CONSULTING: "Consulting", INTEREST: "Interest", INVESTMENTS: "Investments",
  COMMISSION: "Commission", REFUND: "Refund", OTHER_REVENUE: "Other Revenue",
};

const BANK_COLORS: Record<string, string> = {
  FNB: "bg-teal-100 text-teal-700",
  ABSA: "bg-red-100 text-red-700",
  STANDARD_BANK: "bg-blue-100 text-blue-700",
  NEDBANK: "bg-green-100 text-green-700",
  CAPITEC: "bg-purple-100 text-purple-700",
  INVESTEC: "bg-gray-100 text-gray-700",
  TYMEBANK: "bg-yellow-100 text-yellow-700",
  DISCOVERY: "bg-orange-100 text-orange-700",
  OTHER: "bg-gray-100 text-gray-600",
};

// ── Main Component ───────────────────────────────────────────────────────────

function BankFeedPage() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"overview" | "accounts" | "transactions" | "review" | "import">("overview");
  const [showAddAccount, setShowAddAccount] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────

  const statsQuery = useQuery({
    ...trpc.getBankFeedStats.queryOptions({ token: token! }),
    enabled: !!token,
    refetchOnWindowFocus: true,
    staleTime: 10000,
  });

  const accountsQuery = useQuery({
    ...trpc.getBankAccounts.queryOptions({ token: token! }),
    enabled: !!token,
  });

  const stats = statsQuery.data;
  const accounts = accountsQuery.data || [];

  // Live push: invalidate stats and any bank-transaction lists when new
  // transactions arrive via the SSE stream.
  useBankFeedStream({
    enabled: !!token,
    onTransaction: () => {
      queryClient.invalidateQueries({ queryKey: trpc.getBankFeedStats.queryKey() });
      queryClient.invalidateQueries({ queryKey: trpc.getBankTransactions.queryKey() });
    },
  });

  // ── Tab Content ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin/dashboard" className="p-2 hover:bg-white/50 rounded-lg transition">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Landmark className="w-6 h-6 text-blue-600" />
                Bank Feed
              </h1>
              <p className="text-sm text-gray-500">Automated bank transaction processing & reconciliation</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/bank-feed/link"
              search={{ status: undefined, reason: undefined, account: undefined }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium"
            >
              <Landmark className="w-4 h-4" /> Link Direct Feed
            </Link>
            <button
              onClick={() => setShowAddAccount(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Add Account
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Bank Accounts"
              value={stats.totalAccounts}
              icon={<Building2 className="w-5 h-5" />}
              color="blue"
            />
            <StatCard
              title="Transactions"
              value={stats.totalTransactions}
              icon={<FileText className="w-5 h-5" />}
              color="gray"
            />
            <StatCard
              title="Needs Review"
              value={stats.pendingReviewCount}
              icon={<AlertCircle className="w-5 h-5" />}
              color="amber"
              highlight={stats.pendingReviewCount > 0}
            />
            <StatCard
              title="Reconciled"
              value={stats.matchedCount}
              icon={<CheckCircle className="w-5 h-5" />}
              color="green"
            />
          </div>
        )}

        {/* Financial Summary */}
        {stats && stats.totalTransactions > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-green-100 p-5">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <ArrowDownRight className="w-4 h-4" />
                <span className="text-sm font-medium">Total Credits (Money In)</span>
              </div>
              <p className="text-2xl font-bold text-green-700">
                R{stats.totalCredits.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-red-100 p-5">
              <div className="flex items-center gap-2 text-red-600 mb-1">
                <ArrowUpRight className="w-4 h-4" />
                <span className="text-sm font-medium">Total Debits (Money Out)</span>
              </div>
              <p className="text-2xl font-bold text-red-700">
                R{stats.totalDebits.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        )}

        {/* Nedbank Live Balance & Data */}
        {token && <NedbankLiveSection accounts={accounts} token={token} />}

        {/* Tabs */}
        <div className="flex gap-1 bg-white/50 rounded-lg p-1">
          {(["overview", "accounts", "transactions", "review", "import"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition ${
                activeTab === tab
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "overview" ? "Overview" :
               tab === "accounts" ? "Accounts" :
               tab === "transactions" ? "Transactions" :
               tab === "review" ? `Review ${stats?.pendingReviewCount ? `(${stats.pendingReviewCount})` : ""}` :
               "Import CSV"}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && <OverviewTab stats={stats} accounts={accounts} onViewAll={() => setActiveTab("transactions")} />}
        {activeTab === "accounts" && (
          <AccountsTab
            accounts={accounts}
            onRefresh={() => accountsQuery.refetch()}
          />
        )}
        {activeTab === "transactions" && <TransactionsTab />}
        {activeTab === "review" && <ReviewTab />}
        {activeTab === "import" && <ImportTab accounts={accounts} />}

        {/* Add Account Modal */}
        {showAddAccount && (
          <AddAccountModal
            onClose={() => setShowAddAccount(false)}
            onSuccess={() => {
              setShowAddAccount(false);
              accountsQuery.refetch();
              statsQuery.refetch();
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ title, value, icon, color, highlight }: {
  title: string; value: number; icon: React.ReactNode; color: string; highlight?: boolean;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 border-blue-100 text-blue-600",
    green: "bg-green-50 border-green-100 text-green-600",
    amber: "bg-amber-50 border-amber-100 text-amber-600",
    gray: "bg-gray-50 border-gray-100 text-gray-600",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]} ${highlight ? "ring-2 ring-amber-300" : ""}`}>
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs font-medium uppercase">{title}</span></div>
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ stats, accounts, onViewAll }: { stats: any; accounts: any[]; onViewAll: () => void }) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const [recentPage, setRecentPage] = useState(0);
  const recentLimit = 10;

  const recentQuery = useQuery({
    ...trpc.getBankTransactions.queryOptions({ token: token!, limit: recentLimit, offset: recentPage * recentLimit }),
    enabled: !!token,
  });

  const recent = recentQuery.data?.transactions || [];
  const recentTotal = recentQuery.data?.total || 0;
  const recentPages = Math.max(1, Math.ceil(recentTotal / recentLimit));

  if (!stats || accounts.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-12 text-center">
        <Landmark className="w-12 h-12 text-blue-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Welcome to Bank Feed</h3>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          Add your bank accounts to start automatically importing and categorizing transactions.
          The system will learn your spending patterns over time.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2 text-blue-700"><Database className="w-4 h-4" /><span className="font-medium text-sm">Step 1</span></div>
            <p className="text-xs text-blue-600">Add your bank accounts (FNB, ABSA, Standard Bank, etc.)</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2 text-purple-700"><Upload className="w-4 h-4" /><span className="font-medium text-sm">Step 2</span></div>
            <p className="text-xs text-purple-600">Import CSV statements or enable automatic email feeds</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2 text-green-700"><Brain className="w-4 h-4" /><span className="font-medium text-sm">Step 3</span></div>
            <p className="text-xs text-green-600">AI categorizes and reconciles transactions automatically</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* AI Engine Status */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Zap className="w-4 h-4" /> Categorization Engine</h3>
            <p className="text-sm text-blue-100 mt-1">3-tier AI engine: Rules → Gemini AI → Human Review</p>
          </div>
          <div className="flex gap-4 text-right">
            <div><div className="text-2xl font-bold">{stats.matchedCount}</div><div className="text-xs text-blue-200">Reconciled</div></div>
            <div><div className="text-2xl font-bold">{stats.pendingReviewCount}</div><div className="text-xs text-blue-200">Categorization review</div></div>
            <div><div className="text-2xl font-bold">{stats.unmatchedCount}</div><div className="text-xs text-blue-200">Unmatched</div></div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Recent Transactions</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{recentTotal} total</span>
            <button onClick={onViewAll} className="text-xs text-blue-700 hover:underline">All transactions</button>
            <button disabled={recentPage === 0} onClick={() => setRecentPage((p) => p - 1)} className="text-xs px-2 py-1 border rounded disabled:opacity-40">Prev</button>
            <span className="text-xs text-gray-500">{recentPage + 1}/{recentPages}</span>
            <button disabled={recentPage >= recentPages - 1} onClick={() => setRecentPage((p) => p + 1)} className="text-xs px-2 py-1 border rounded disabled:opacity-40">Next</button>
          </div>
        </div>
        <div className="divide-y">
          {recent.length === 0 ? (
            <p className="p-8 text-center text-gray-400">No transactions yet. Import a CSV or enable email feeds.</p>
          ) : (
            recent.map((tx: any) => (
              <TransactionRow key={tx.id} tx={tx} compact />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Accounts Tab ─────────────────────────────────────────────────────────────

function AccountsTab({ accounts, onRefresh }: { accounts: any[]; onRefresh: () => void }) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    ...trpc.deleteBankAccount.mutationOptions(),
    onSuccess: () => {
      toast.success("Account deleted");
      onRefresh();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    ...trpc.updateBankAccount.mutationOptions(),
    onSuccess: () => {
      toast.success("Account updated");
      onRefresh();
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      {accounts.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No bank accounts added yet.</p>
        </div>
      ) : (
        accounts.map((acc: any) => (
          <div key={acc.id} className="bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${BANK_COLORS[acc.bankName] || BANK_COLORS.OTHER}`}>
                  {acc.bankName.replace("_", " ")}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">{acc.accountName}</h3>
                  <p className="text-xs text-gray-500">
                    ····{acc.accountNumber} • {acc.accountType.replace("_", " ")} • {acc._count.transactions} transactions
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={acc.feedEnabled}
                    onChange={() =>
                      updateMutation.mutate({
                        token: token!,
                        id: acc.id,
                        feedEnabled: !acc.feedEnabled,
                      })
                    }
                    className="rounded text-blue-600"
                  />
                  <span className={acc.feedEnabled ? "text-green-600" : "text-gray-400"}>
                    Email Feed
                  </span>
                </label>
                <button
                  onClick={() => {
                    if (confirm("Delete this bank account and all its transactions?")) {
                      deleteMutation.mutate({ token: token!, id: acc.id });
                    }
                  }}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {acc.feedEnabled && (
              <div className="mt-3 pt-3 border-t text-xs text-gray-500 flex items-center gap-4">
                <span>Last checked: {acc.lastFeedCheck ? new Date(acc.lastFeedCheck).toLocaleString("en-ZA") : "Never"}</span>
                {acc.notificationEmail && <span>Monitoring: {acc.notificationEmail}</span>}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ── Transactions Tab ─────────────────────────────────────────────────────────

function TransactionsTab() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const [filters, setFilters] = useState({
    transactionType: "" as "" | "DEBIT" | "CREDIT",
    reconciliationStatus: "" as "" | "UNMATCHED" | "MATCHED" | "PARTIALLY_MATCHED" | "DISPUTED" | "IGNORED",
    search: "",
  });
  const [page, setPage] = useState(0);
  const limit = 25;

  const txQuery = useQuery({
    ...trpc.getBankTransactions.queryOptions({
      token: token!,
      transactionType: filters.transactionType || undefined,
      reconciliationStatus: filters.reconciliationStatus || undefined,
      search: filters.search || undefined,
      limit,
      offset: page * limit,
    }),
    enabled: !!token,
  });

  const transactions = txQuery.data?.transactions || [];
  const total = txQuery.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const qc = useQueryClient();
  const autoMatchMut = useMutation({
    ...trpc.runInvoiceAutoMatch.mutationOptions(),
    onSuccess: (r: any) => {
      toast.success(r.allocatedCount ? `${r.allocatedCount} payment(s) matched; invoices marked paid` : "No new unique invoice matches found");
      qc.invalidateQueries({ queryKey: trpc.getBankTransactions.queryKey() });
      qc.invalidateQueries({ queryKey: trpc.getBankFeedStats.queryKey() });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const pager = (
    <div className="flex items-center gap-2">
      <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="text-xs px-3 py-1.5 border rounded disabled:opacity-40">Prev</button>
      <span className="text-xs text-gray-500">Page {page + 1} of {totalPages}</span>
      <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="text-xs px-3 py-1.5 border rounded disabled:opacity-40">Next</button>
    </div>
  );

  const filtered = transactions;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={filters.search}
            onChange={(e) => { setPage(0); setFilters({ ...filters, search: e.target.value }); }}
            className="flex-1 text-sm border-0 focus:ring-0 px-0"
          />
        </div>
        <select
          value={filters.transactionType}
          onChange={(e) => { setPage(0); setFilters({ ...filters, transactionType: e.target.value as any }); }}
          className="text-sm border rounded-lg px-3 py-1.5"
        >
          <option value="">All Types</option>
          <option value="DEBIT">Debits</option>
          <option value="CREDIT">Credits</option>
        </select>
        <select
          value={filters.reconciliationStatus}
          onChange={(e) => { setPage(0); setFilters({ ...filters, reconciliationStatus: e.target.value as any }); }}
          className="text-sm border rounded-lg px-3 py-1.5"
        >
          <option value="">All Status</option>
          <option value="UNMATCHED">Unmatched</option>
          <option value="MATCHED">Matched</option>
          <option value="DISPUTED">Disputed</option>
          <option value="IGNORED">Ignored</option>
        </select>
        <button onClick={() => txQuery.refetch()} className="p-1.5 hover:bg-gray-100 rounded-lg">
          <RefreshCw className={`w-4 h-4 text-gray-500 ${txQuery.isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Transaction List */}
      <div className="bg-white rounded-xl border">
        <div className="p-3 border-b flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm text-gray-500">{total} transactions</span>
          <button
            onClick={() => autoMatchMut.mutate({ token: token! })}
            disabled={autoMatchMut.isPending}
            className="text-xs px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            title="Match unallocated bank credits to unpaid invoices and mark them paid"
          >
            {autoMatchMut.isPending ? "Matching…" : "Auto-match invoice payments"}
          </button>
          {pager}
        </div>
        <div className="divide-y">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-gray-400">No transactions found</p>
          ) : (
            filtered.map((tx: any) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))
          )}
        </div>
        <div className="p-3 border-t flex justify-end">{pager}</div>
      </div>
    </div>
  );
}

// ── Review Tab ───────────────────────────────────────────────────────────────

function ReviewTab() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const txQuery = useQuery({
    ...trpc.getBankTransactions.queryOptions({
      token: token!,
      isConfirmed: false,
      limit: pageSize,
      offset: page * pageSize,
    }),
    enabled: !!token,
  });

  const confirmMutation = useMutation({
    ...trpc.confirmBankTransaction.mutationOptions(),
    onSuccess: () => {
      toast.success("Transaction confirmed");
      txQuery.refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const recategorizeMutation = useMutation({
    ...trpc.recategorizeBankTransaction.mutationOptions(),
    onSuccess: () => {
      toast.success("Category updated & rule created");
      queryClient.invalidateQueries({ queryKey: trpc.getBankTransactions.queryKey() });
      queryClient.invalidateQueries({ queryKey: trpc.getBankFeedStats.queryKey() });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const applyRulesMutation = useMutation({
    ...trpc.applyBankCategorizationLearning.mutationOptions(),
    onSuccess: (result) => {
      toast.success(`Saved rules checked ${result.scanned} transactions and categorized ${result.categorized}`);
      queryClient.invalidateQueries({ queryKey: trpc.getBankTransactions.queryKey() });
      queryClient.invalidateQueries({ queryKey: trpc.getBankFeedStats.queryKey() });
      setPage(0);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const categorizeMissingMutation = useMutation({
    ...trpc.categorizeMissingBankTransactions.mutationOptions(),
    onSuccess: (result) => {
      toast.success(`Categorized ${result.categorized}/${result.scanned} missing transactions; ${result.errors} errors`);
      queryClient.invalidateQueries({ queryKey: trpc.getBankTransactions.queryKey() });
      queryClient.invalidateQueries({ queryKey: trpc.getBankFeedStats.queryKey() });
      setPage(0);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const transactions = txQuery.data?.transactions || [];
  const reviewTotal = txQuery.data?.total || 0;
  const reviewPages = Math.ceil(reviewTotal / pageSize);

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
        <div>
          <h3 className="font-medium text-amber-800">Review Queue</h3>
          <p className="text-sm text-amber-600 mt-1">
            These transactions need your review. Confirm the AI category or change it — the system learns from your corrections.
          </p>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">{reviewTotal} transactions need a category or confirmation. OTHER remains in this queue until explicitly reviewed.</p>
        <div className="flex items-center gap-2">
          <button onClick={() => applyRulesMutation.mutate({ token: token! })} disabled={applyRulesMutation.isPending} className="px-3 py-2 border rounded-lg text-sm disabled:opacity-50">
            {applyRulesMutation.isPending ? "Applying…" : "Apply saved rules"}
          </button>
          <button onClick={() => categorizeMissingMutation.mutate({ token: token!, take: 100 })} disabled={categorizeMissingMutation.isPending} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
            {categorizeMissingMutation.isPending ? "Categorizing…" : "Categorize missing (up to 100)"}
          </button>
        </div>
      </div>

      {reviewPages > 1 && <div className="flex items-center justify-end gap-2">
        <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="px-2 py-1 border rounded text-xs disabled:opacity-40">Prev</button>
        <span className="text-xs text-gray-500">Page {page + 1}/{reviewPages}</span>
        <button disabled={page >= reviewPages - 1} onClick={() => setPage((p) => p + 1)} className="px-2 py-1 border rounded text-xs disabled:opacity-40">Next</button>
      </div>}

      {txQuery.isLoading ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-800">All Caught Up!</h3>
          <p className="text-gray-500 text-sm mt-1">No transactions need review right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx: any) => (
            <ReviewCard
              key={tx.id}
              tx={tx}
              onConfirm={() => confirmMutation.mutate({ token: token!, transactionId: tx.id })}
              onRecategorize={(category: string) =>
                recategorizeMutation.mutate({
                  token: token!,
                  transactionId: tx.id,
                  category,
                  createRule: true,
                })
              }
              isLoading={confirmMutation.isPending || recategorizeMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Review Card ──────────────────────────────────────────────────────────────

function ReviewCard({ tx, onConfirm, onRecategorize, isLoading }: {
  tx: any; onConfirm: () => void; onRecategorize: (cat: string) => void; isLoading: boolean;
}) {
  const [showEdit, setShowEdit] = useState(false);
  const initialCategory = tx.categorization?.category;
  const [selectedCategory, setSelectedCategory] = useState(initialCategory && !["OTHER", "OTHER_REVENUE"].includes(initialCategory) ? initialCategory : "");

  const isDebit = tx.transactionType === "DEBIT";
  const categories = isDebit ? EXPENSE_CATEGORIES : REVENUE_CATEGORIES;
  const cat = tx.categorization;

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              isDebit ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
            }`}>
              {isDebit ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {isDebit ? "Debit" : "Credit"}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${BANK_COLORS[tx.bankAccount?.bankName] || BANK_COLORS.OTHER}`}>
              {tx.bankAccount?.bankName?.replace("_", " ")}
            </span>
            <span className="text-xs text-gray-400">
              {new Date(tx.transactionDate).toLocaleDateString("en-ZA")}
            </span>
          </div>
          <p className="font-medium text-gray-800">{tx.description}</p>
          <p className={`text-lg font-bold mt-1 ${isDebit ? "text-red-600" : "text-green-600"}`}>
            {isDebit ? "-" : "+"}R{tx.amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* AI Suggestion */}
      {cat && (
        <div className="mt-3 bg-blue-50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-blue-700">
                AI Suggested: {CATEGORY_LABELS[cat.category] || cat.category}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                cat.confidence >= 80 ? "bg-green-100 text-green-700" :
                cat.confidence >= 50 ? "bg-yellow-100 text-yellow-700" :
                "bg-red-100 text-red-700"
              }`}>
                {cat.confidence}%
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                {cat.suggestedBy === "RULE" ? "Rule" : cat.suggestedBy === "AI" ? "Gemini" : "Manual"}
              </span>
            </div>
          </div>
          {cat.aiReasoning && (
            <p className="text-xs text-blue-600 mt-1">{cat.aiReasoning}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2">
        {!showEdit ? (
          <>
            {cat && !["OTHER", "OTHER_REVENUE"].includes(cat.category) && <button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" /> Confirm
            </button>}
            <button
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition"
            >
              <Edit className="w-3.5 h-3.5" /> {cat && !["OTHER", "OTHER_REVENUE"].includes(cat.category) ? "Change Category" : "Choose Category"}
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-sm border rounded-lg px-2 py-1.5 flex-1"
            >
              <option value="">Select category...</option>
              {categories.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
              ))}
            </select>
            <button
              onClick={() => {
                if (selectedCategory) {
                  onRecategorize(selectedCategory);
                  setShowEdit(false);
                }
              }}
              disabled={!selectedCategory || isLoading}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => setShowEdit(false)}
              className="p-1.5 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Import Tab ───────────────────────────────────────────────────────────────

function ImportTab({ accounts }: { accounts: any[] }) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedAccount, setSelectedAccount] = useState<number>(accounts[0]?.id || 0);
  const [csvContent, setCsvContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [importResult, setImportResult] = useState<any>(null);

  const importMutation = useMutation({
    ...trpc.importCSVStatement.mutationOptions(),
    onSuccess: (result) => {
      toast.success(`Imported ${result.new} new transactions (${result.duplicates} duplicates)`);
      setImportResult(result);
      setCsvContent("");
      setFileName("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const batchesQuery = useQuery({
    ...trpc.getImportBatches.queryOptions({ token: token!}),
    enabled: !!token,
  });

  const reconcileMutation = useMutation({
    ...trpc.reconcileBankAccountProcedure.mutationOptions(),
    onSuccess: (result) => {
      toast.success(`Reconciled: ${result.matched} matched, ${result.created} created, ${result.unmatched} unmatched`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvContent(ev.target?.result as string);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Import Form */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5 text-blue-500" /> Import Bank Statement (CSV)
        </h3>

        {accounts.length === 0 ? (
          <p className="text-gray-500 text-sm">Add a bank account first before importing statements.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Bank Account</label>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                {accounts.map((acc: any) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.accountName} ({acc.bankName.replace("_", " ")} ····{acc.accountNumber})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">CSV File</label>
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-blue-300 transition cursor-pointer"
                onClick={() => fileInputRef.current?.click()}>
                <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                {fileName ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-5 h-5 text-blue-500" />
                    <span className="font-medium text-gray-700">{fileName}</span>
                    <button onClick={(e) => { e.stopPropagation(); setCsvContent(""); setFileName(""); }} className="text-gray-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Click to select a CSV file</p>
                    <p className="text-xs text-gray-400 mt-1">Supports FNB, ABSA, Standard Bank, Nedbank, Capitec formats</p>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (!csvContent || !selectedAccount) return;
                  importMutation.mutate({ token: token!, bankAccountId: selectedAccount, csvContent });
                }}
                disabled={!csvContent || !selectedAccount || importMutation.isPending}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium"
              >
                {importMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Import & Categorize
              </button>
              <button
                onClick={() => {
                  if (!selectedAccount) return;
                  reconcileMutation.mutate({ token: token!, bankAccountId: selectedAccount });
                }}
                disabled={!selectedAccount || reconcileMutation.isPending}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm"
              >
                {reconcileMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Run Reconciliation
              </button>
            </div>

            {/* Import Result */}
            {importResult && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-800 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Import Complete
                </h4>
                <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                  <div><span className="text-gray-600">Total:</span> <strong>{importResult.total}</strong></div>
                  <div><span className="text-gray-600">New:</span> <strong className="text-green-600">{importResult.new}</strong></div>
                  <div><span className="text-gray-600">Duplicates:</span> <strong className="text-gray-400">{importResult.duplicates}</strong></div>
                </div>
                {importResult.periodStart && (
                  <p className="text-xs text-green-600 mt-2">
                    Period: {new Date(importResult.periodStart).toLocaleDateString("en-ZA")} — {new Date(importResult.periodEnd).toLocaleDateString("en-ZA")}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Import History */}
      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" /> Import History
          </h3>
        </div>
        <div className="divide-y">
          {(batchesQuery.data || []).length === 0 ? (
            <p className="p-6 text-center text-gray-400 text-sm">No imports yet</p>
          ) : (
            (batchesQuery.data || []).map((batch: any) => (
              <div key={batch.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${BANK_COLORS[batch.bankAccount?.bankName] || BANK_COLORS.OTHER}`}>
                      {batch.bankAccount?.bankName?.replace("_", " ")}
                    </span>
                    <span className="text-sm font-medium text-gray-700">{batch.bankAccount?.accountName}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      batch.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                      batch.status === "FAILED" ? "bg-red-100 text-red-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>
                      {batch.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(batch.createdAt).toLocaleString("en-ZA")} • {batch.source} • {batch.newCount} new, {batch.duplicateCount} duplicates
                  </p>
                </div>
                <span className="text-sm font-medium text-gray-600">{batch.transactionCount} txns</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Transaction Row ──────────────────────────────────────────────────────────

function TransactionRow({ tx, compact }: { tx: any; compact?: boolean }) {
  const isDebit = tx.transactionType === "DEBIT";
  const cat = tx.categorization;
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string>(cat?.category ?? "");
  const categories = isDebit ? EXPENSE_CATEGORIES : REVENUE_CATEGORIES;

  const recategorizeMut = useMutation({
    ...trpc.recategorizeBankTransaction.mutationOptions(),
    onSuccess: () => {
      toast.success("Category updated â€” rule saved");
      setEditing(false);
      qc.invalidateQueries({ queryKey: trpc.getBankTransactions.queryKey() });
      qc.invalidateQueries({ queryKey: trpc.getBankFeedStats.queryKey() });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const approveExpenseMut = useMutation({
    ...trpc.approveOperationalExpense.mutationOptions(),
    onSuccess: () => {
      toast.success("Linked expense approved; Management Accounts is updated");
      qc.invalidateQueries({ queryKey: trpc.getBankTransactions.queryKey() });
      qc.invalidateQueries({ queryKey: trpc.getBankFeedStats.queryKey() });
      qc.invalidateQueries({ queryKey: trpc.getOperationalExpenses.queryKey() });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const canApproveExpenses = user?.role === "SENIOR_ADMIN" || !!user?.role?.includes("CONTRACTOR");
  const [allocating, setAllocating] = useState(false);
  const canAllocate = !compact && !isDebit && tx.reconciliationStatus === "UNMATCHED" && !tx.linkedInvoiceId;

  return (
    <div>
    <div className={`flex items-center justify-between ${compact ? "px-4 py-3" : "px-5 py-4"} hover:bg-gray-50 transition`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isDebit ? "bg-red-50 text-red-500" : "bg-green-50 text-green-500"
        }`}>
          {isDebit ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-800 truncate">{tx.description}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-400">
              {new Date(tx.transactionDate).toLocaleDateString("en-ZA")}
            </span>
            {tx.bankAccount && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${BANK_COLORS[tx.bankAccount.bankName] || BANK_COLORS.OTHER}`}>
                {tx.bankAccount.bankName?.replace("_", " ")}
              </span>
            )}
            {editing ? (
              <span className="inline-flex items-center gap-1">
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs px-1.5 py-0.5 border border-blue-300 rounded bg-white text-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                >
                  <option value="">Select categoryâ€¦</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
                  ))}
                </select>
                <button
                  className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded disabled:opacity-50"
                  disabled={!selected || selected === cat?.category || recategorizeMut.isPending}
                  onClick={() => recategorizeMut.mutate({ token: token!, transactionId: tx.id, category: selected, createRule: true })}
                >
                  {recategorizeMut.isPending ? "â€¦" : "Save"}
                </button>
                <button
                  className="text-xs px-1.5 py-0.5 text-gray-500 hover:text-gray-700"
                  onClick={() => { setEditing(false); setSelected(cat?.category ?? ""); }}
                >
                  âœ•
                </button>
              </span>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                className={`text-xs px-1.5 py-0.5 rounded-full transition hover:ring-1 hover:ring-blue-400 cursor-pointer ${
                  cat ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-500 border border-dashed border-gray-300"
                }`}
                title="Click to change category"
              >
                {cat ? (CATEGORY_LABELS[cat.category] || cat.category) : "Uncategorized"}
              </button>
            )}
            <span className={`text-xs px-1 py-0.5 rounded ${
              tx.reconciliationStatus === "MATCHED" ? "bg-green-100 text-green-700" :
              tx.reconciliationStatus === "UNMATCHED" ? "bg-gray-100 text-gray-500" :
              "bg-yellow-100 text-yellow-700"
            }`}>
              {tx.reconciliationStatus}
            </span>
          </div>
        </div>
      </div>
      <div className="ml-3 flex flex-col items-end gap-1">
        <p className={`text-sm font-semibold ${isDebit ? "text-red-600" : "text-green-600"} whitespace-nowrap`}>
          {isDebit ? "-" : "+"}R{tx.amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
        </p>
        {!compact && tx.linkedOperationalExpense && !tx.linkedOperationalExpense.isApproved && (
          canApproveExpenses ? (
            <button
              disabled={approveExpenseMut.isPending}
              onClick={() => approveExpenseMut.mutate({ token: token!, id: tx.linkedOperationalExpense.id, isApproved: true })}
              className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 disabled:opacity-50"
              title="This approval is shared with Management Accounts; approving here removes the same expense from that pending queue."
            >
              {approveExpenseMut.isPending ? "Approving…" : "Approve linked expense"}
            </button>
          ) : <span className="text-[11px] text-amber-700">Linked expense pending approval</span>
        )}
        {!compact && tx.linkedOperationalExpense?.isApproved && <span className="text-[11px] text-green-700">Linked expense approved</span>}
        {canAllocate && (
          <button
            onClick={() => setAllocating((v) => !v)}
            className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          >
            {allocating ? "Close" : "Match to invoices"}
          </button>
        )}
      </div>
    </div>
    {allocating && canAllocate && <InvoiceAllocationPanel tx={tx} onDone={() => setAllocating(false)} />}
    </div>
  );
}

function InvoiceAllocationPanel({ tx, onDone }: { tx: any; onDone: () => void }) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [picked, setPicked] = useState<number[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const candidatesQuery = useQuery({
    ...trpc.getInvoiceAllocationCandidates.queryOptions({ token: token!, transactionId: tx.id }),
    enabled: !!token,
  });
  const data = candidatesQuery.data;
  const selected = picked ?? data?.suggestedInvoiceIds ?? [];
  const invoices = (data?.invoices ?? []).filter((inv: any) => showAll || inv.related || selected.includes(inv.id));
  const selectedTotal = (data?.invoices ?? []).filter((inv: any) => selected.includes(inv.id)).reduce((s: number, inv: any) => s + inv.outstanding, 0);
  const difference = Math.round((tx.amount - selectedTotal) * 100) / 100;
  const allocateMut = useMutation({
    ...trpc.allocateBankCreditToInvoices.mutationOptions(),
    onSuccess: (r: any) => {
      toast.success(`Marked paid: ${r.invoiceNumbers.join(", ")}`);
      qc.invalidateQueries({ queryKey: trpc.getBankTransactions.queryKey() });
      qc.invalidateQueries({ queryKey: trpc.getBankFeedStats.queryKey() });
      qc.invalidateQueries({ queryKey: trpc.getInvoices.queryKey() });
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const toggle = (id: number) => setPicked(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="mx-5 mb-4 p-4 rounded-lg border border-emerald-200 bg-emerald-50/40 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2 text-sm">
        <span>Allocate <b>R{tx.amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</b> to unpaid invoices</span>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show all unpaid invoices
        </label>
      </div>
      {candidatesQuery.isLoading ? (
        <p className="text-xs text-gray-500">Loading invoices…</p>
      ) : invoices.length === 0 ? (
        <p className="text-xs text-gray-500">No related unpaid invoices found for this payer. Tick "Show all unpaid invoices" to search every open invoice.</p>
      ) : (
        <div className="max-h-72 overflow-y-auto divide-y bg-white rounded border">
          {invoices.map((inv: any) => (
            <label key={inv.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs cursor-pointer hover:bg-gray-50">
              <span className="flex items-center gap-2 min-w-0">
                <input type="checkbox" checked={selected.includes(inv.id)} onChange={() => toggle(inv.id)} />
                <span className="font-medium">{inv.invoiceNumber}</span>
                <span className="text-gray-500 truncate">{inv.customerName}</span>
                {inv.dueDate && <span className="text-gray-400">due {new Date(inv.dueDate).toLocaleDateString("en-ZA")}</span>}
              </span>
              <span className="whitespace-nowrap">R{inv.outstanding.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</span>
            </label>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
        <span className={Math.abs(difference) <= 1 ? "text-emerald-700" : "text-amber-700"}>
          Selected R{selectedTotal.toLocaleString("en-ZA", { minimumFractionDigits: 2 })} · Difference R{difference.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
          {data?.suggestedInvoiceIds?.length ? " · suggested match pre-selected" : ""}
        </span>
        <button
          disabled={selected.length === 0 || Math.abs(difference) > 1 || allocateMut.isPending}
          onClick={() => allocateMut.mutate({ token: token!, transactionId: tx.id, invoiceIds: selected })}
          className="px-3 py-1.5 rounded bg-emerald-600 text-white disabled:opacity-50"
        >
          {allocateMut.isPending ? "Saving…" : "Mark selected invoices paid"}
        </button>
      </div>
    </div>
  );
}

// ── Add Account Modal ────────────────────────────────────────────────────────

function AddAccountModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const [form, setForm] = useState({
    accountName: "",
    bankName: "FNB" as string,
    accountNumber: "",
    branchCode: "",
    accountType: "CHEQUE" as string,
    notificationEmail: "",
    feedEnabled: false,
  });

  const createMutation = useMutation({
    ...trpc.createBankAccount.mutationOptions(),
    onSuccess: () => {
      toast.success("Bank account added");
      onSuccess();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.accountNumber.length !== 4) {
      toast.error("Enter the last 4 digits of your account number");
      return;
    }
    createMutation.mutate({
      token: token!,
      accountName: form.accountName,
      bankName: form.bankName as any,
      accountNumber: form.accountNumber,
      branchCode: form.branchCode || undefined,
      accountType: form.accountType as any,
      notificationEmail: form.notificationEmail || undefined,
      feedEnabled: form.feedEnabled,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Add Bank Account</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Account Name</label>
            <input
              type="text"
              value={form.accountName}
              onChange={(e) => setForm({ ...form, accountName: e.target.value })}
              placeholder="e.g. FNB Business Cheque"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Bank</label>
              <select
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                {BANK_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Account Type</label>
              <select
                value={form.accountType}
                onChange={(e) => setForm({ ...form, accountType: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                {ACCOUNT_TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Last 4 Digits</label>
              <input
                type="text"
                maxLength={4}
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                placeholder="1234"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Branch Code <span className="text-gray-400">(optional)</span></label>
              <input
                type="text"
                value={form.branchCode}
                onChange={(e) => setForm({ ...form, branchCode: e.target.value })}
                placeholder="250655"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">Email Feed (Automatic)</h4>
            <p className="text-xs text-blue-600 mb-3">
              Forward your bank notification emails to the system email to automatically import transactions in real-time.
            </p>
            <label className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={form.feedEnabled}
                onChange={(e) => setForm({ ...form, feedEnabled: e.target.checked })}
                className="rounded text-blue-600"
              />
              <span className="text-sm text-gray-700">Enable automatic email feed</span>
            </label>
            {form.feedEnabled && (
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Bank notification sender email</label>
                <input
                  type="email"
                  value={form.notificationEmail}
                  onChange={(e) => setForm({ ...form, notificationEmail: e.target.value })}
                  placeholder="e.g. noreply@fnb.co.za"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium flex items-center justify-center gap-2"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Bank Account
          </button>
        </form>
      </div>
    </div>
  );
}


// ── Nedbank Live Balance & Data (shown for every NEDBANK-linked account) ────

function NedbankLiveSection({ accounts, token }: { accounts: any[]; token: string }) {
  const nedbankAccts = accounts.filter(
    (a) => a.externalProvider === "NEDBANK" && a.feedEnabled && a.externalAccountId
  );
  if (nedbankAccts.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-4">
      {nedbankAccts.map((a) => (
        <NedbankAccountCard key={a.id} account={a} token={token} />
      ))}
    </div>
  );
}

function NedbankAccountCard({ account, token }: { account: any; token: string }) {
  const trpc = useTRPC();
  const q = useQuery({
    ...trpc.getNedbankAccountSummary.queryOptions({ token, bankAccountId: account.id }),
    enabled: !!token,
    refetchInterval: 60000,
    staleTime: 30000,
  });
  const data = q.data;
  const acct = data?.account as any;
  const balAmount: any = acct?.currentBalance == null ? null : Number(acct.currentBalance);
  const balIndicator: any = String(acct?.balanceIndicator ?? "Credit");
  const isOverdrawn = balIndicator.toLowerCase() === "debit" && balAmount !== null && balAmount > 0;
  const balCurrency: any = String(acct?.balanceCurrency ?? "ZAR");
  const balAsOf = acct?.balanceAsOf ? new Date(acct.balanceAsOf) : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-emerald-50 to-blue-50 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <Landmark className="w-5 h-5 text-emerald-700" />
          <div>
            <h3 className="text-sm font-semibold text-gray-800">{account.accountName}</h3>
            <p className="text-xs text-gray-500">Nedbank · Account {account.externalAccountId}</p>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          {balAsOf ? `Balance as of ${balAsOf.toLocaleString("en-ZA")}` : "Balance pending sync"}
        </div>
      </div>

      {/* Balance strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5">
        <div className={`rounded-lg p-4 ${isOverdrawn ? "bg-red-50 border border-red-100" : "bg-emerald-50 border border-emerald-100"}`}>
          <div className={`flex items-center gap-2 text-xs font-medium mb-1 ${isOverdrawn ? "text-red-700" : "text-emerald-700"}`}>
            <Banknote className="w-4 h-4" />
            {isOverdrawn ? "Balance (Overdrawn)" : "Current Balance"}
          </div>
          <p className={`text-2xl font-bold ${isOverdrawn ? "text-red-800" : "text-emerald-800"}`}>
            {balAmount === null ? "—" : `${isOverdrawn ? "-" : ""}${balCurrency} ${balAmount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`}
          </p>
          <p className="text-xs text-gray-500 mt-1">{balIndicator} indicator · {acct?.balanceType || "CurrentBalance"}</p>
        </div>
        <div className="rounded-lg p-4 bg-blue-50 border border-blue-100">
          <div className="flex items-center gap-2 text-xs font-medium mb-1 text-blue-700">
            <CreditCard className="w-4 h-4" />
            Available Balance
          </div>
          <p className="text-2xl font-bold text-blue-800">
            {acct?.availableBalance == null ? "—" : `${balCurrency} ${Number(acct?.availableBalance as any).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`}
          </p>
          <p className="text-xs text-gray-500 mt-1">Reported by Nedbank</p>
        </div>
        <div className="rounded-lg p-4 bg-gray-50 border border-gray-200">
          <div className="flex items-center gap-2 text-xs font-medium mb-1 text-gray-700">
            <Clock className="w-4 h-4" />
            Last Sync
          </div>
          <p className="text-lg font-semibold text-gray-800">
            {acct?.externalLastSyncAt ? new Date(acct.externalLastSyncAt).toLocaleString("en-ZA") : "Never"}
          </p>
          {acct?.externalLastError ? (
            <p className="text-xs text-red-600 mt-1 truncate" title={acct.externalLastError}>Error: {acct.externalLastError}</p>
          ) : (
            <p className="text-xs text-gray-500 mt-1">No errors</p>
          )}
        </div>
      </div>

      {/* Statements */}
      {data?.statements && data.statements.length > 0 && (
        <div className="px-5 pb-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-2">
            <FileText className="w-3 h-3" /> Statement History ({data.statements.length})
          </h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs text-gray-500 uppercase">
                  <th className="px-3 py-2">Period</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2 text-right">Opening</th>
                  <th className="px-3 py-2 text-right">Closing</th>
                  <th className="px-3 py-2 text-right">Movement</th>
                </tr>
              </thead>
              <tbody>
                {data.statements.map((st: any) => {
                  const opening = st.broughtForwardIndicator === "Debit" ? -(st.broughtForwardAmount || 0) : (st.broughtForwardAmount || 0);
                  const closing = st.carriedForwardIndicator === "Debit" ? -(st.carriedForwardAmount || 0) : (st.carriedForwardAmount || 0);
                  const movement = closing - opening;
                  return (
                    <tr key={st.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-gray-700">
                        {new Date(st.startDateTime).toLocaleDateString("en-ZA")}
                        {st.endDateTime ? ` → ${new Date(st.endDateTime).toLocaleDateString("en-ZA")}` : ""}
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{st.statementType || "—"}</td>
                      <td className={`px-3 py-2 text-right font-mono ${opening < 0 ? "text-red-700" : "text-gray-800"}`}>
                        R{opening.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono ${closing < 0 ? "text-red-700" : "text-gray-800"}`}>
                        R{closing.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono ${movement < 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {movement >= 0 ? "+" : ""}R{movement.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recurring debits */}
      {data?.recurringDebits && data.recurringDebits.length > 0 && (
        <div className="px-5 pb-5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-2">
            <TrendingDown className="w-3 h-3" /> Recurring Debits (detected from last 120 days)
          </h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs text-gray-500 uppercase">
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Occurrences</th>
                  <th className="px-3 py-2 text-right">Avg Amount</th>
                  <th className="px-3 py-2 text-right">Last Amount</th>
                  <th className="px-3 py-2">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {data.recurringDebits.map((r: any, i: number) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-800 truncate max-w-md" title={r.description}>{r.description}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{r.occurrences}</td>
                    <td className="px-3 py-2 text-right text-gray-700 font-mono">R{r.averageAmount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-right text-red-700 font-mono">R{r.lastAmount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{new Date(r.lastDate).toLocaleDateString("en-ZA")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {q.isLoading && (
        <div className="px-5 pb-4 text-xs text-gray-500 flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" /> Refreshing balance…
        </div>
      )}
    </div>
  );
}

