import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
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
  "SALARIES", "MARKETING", "MAINTENANCE", "TRAVEL", "PROFESSIONAL_FEES",
  "TELECOMMUNICATIONS", "SOFTWARE_SUBSCRIPTIONS", "OTHER",
];

const REVENUE_CATEGORIES = [
  "INVOICE_PAYMENT", "RENTAL_INCOME", "CONSULTING", "INTEREST",
  "INVESTMENTS", "COMMISSION", "REFUND", "OTHER_REVENUE",
];

const CATEGORY_LABELS: Record<string, string> = {
  PETROL: "Petrol / Fuel", OFFICE_SUPPLIES: "Office Supplies", RENT: "Rent",
  UTILITIES: "Utilities", INSURANCE: "Insurance", SALARIES: "Salaries",
  MARKETING: "Marketing", MAINTENANCE: "Maintenance", TRAVEL: "Travel",
  PROFESSIONAL_FEES: "Professional Fees", TELECOMMUNICATIONS: "Telecoms",
  SOFTWARE_SUBSCRIPTIONS: "Software", OTHER: "Other",
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
          <button
            onClick={() => setShowAddAccount(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add Account
          </button>
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
        {activeTab === "overview" && <OverviewTab stats={stats} accounts={accounts} />}
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

function OverviewTab({ stats, accounts }: { stats: any; accounts: any[] }) {
  const { token } = useAuthStore();
  const trpc = useTRPC();

  const recentQuery = useQuery({
    ...trpc.getBankTransactions.queryOptions({ token: token!, limit: 10 }),
    enabled: !!token,
  });

  const recent = recentQuery.data?.transactions || [];

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
            <div><div className="text-2xl font-bold">{stats.pendingReviewCount}</div><div className="text-xs text-blue-200">Pending</div></div>
            <div><div className="text-2xl font-bold">{stats.unmatchedCount}</div><div className="text-xs text-blue-200">Unmatched</div></div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Recent Transactions</h3>
          <span className="text-xs text-gray-500">{stats.totalTransactions} total</span>
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
      limit,
      offset: page * limit,
    }),
    enabled: !!token,
  });

  const transactions = txQuery.data?.transactions || [];
  const total = txQuery.data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const filtered = filters.search
    ? transactions.filter((tx: any) =>
        tx.description.toLowerCase().includes(filters.search.toLowerCase()) ||
        tx.categorization?.category?.toLowerCase().includes(filters.search.toLowerCase())
      )
    : transactions;

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
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="flex-1 text-sm border-0 focus:ring-0 px-0"
          />
        </div>
        <select
          value={filters.transactionType}
          onChange={(e) => setFilters({ ...filters, transactionType: e.target.value as any })}
          className="text-sm border rounded-lg px-3 py-1.5"
        >
          <option value="">All Types</option>
          <option value="DEBIT">Debits</option>
          <option value="CREDIT">Credits</option>
        </select>
        <select
          value={filters.reconciliationStatus}
          onChange={(e) => setFilters({ ...filters, reconciliationStatus: e.target.value as any })}
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
        <div className="p-3 border-b flex items-center justify-between">
          <span className="text-sm text-gray-500">{total} transactions</span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="text-xs px-2 py-1 border rounded disabled:opacity-40">Prev</button>
              <span className="text-xs text-gray-500">Page {page + 1}/{totalPages}</span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="text-xs px-2 py-1 border rounded disabled:opacity-40">Next</button>
            </div>
          )}
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
      </div>
    </div>
  );
}

// ── Review Tab ───────────────────────────────────────────────────────────────

function ReviewTab() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const txQuery = useQuery({
    ...trpc.getBankTransactions.queryOptions({
      token: token!,
      isConfirmed: false,
      limit: 50,
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
      txQuery.refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const transactions = txQuery.data?.transactions || [];

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
  const [selectedCategory, setSelectedCategory] = useState(tx.categorization?.category || "");

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
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" /> Confirm
            </button>
            <button
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition"
            >
              <Edit className="w-3.5 h-3.5" /> Change Category
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

  return (
    <div className={`flex items-center justify-between ${compact ? "px-4 py-3" : "px-5 py-4"} hover:bg-gray-50 transition`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isDebit ? "bg-red-50 text-red-500" : "bg-green-50 text-green-500"
        }`}>
          {isDebit ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-800 truncate">{tx.description}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-400">
              {new Date(tx.transactionDate).toLocaleDateString("en-ZA")}
            </span>
            {tx.bankAccount && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${BANK_COLORS[tx.bankAccount.bankName] || BANK_COLORS.OTHER}`}>
                {tx.bankAccount.bankName?.replace("_", " ")}
              </span>
            )}
            {cat && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
                {CATEGORY_LABELS[cat.category] || cat.category}
              </span>
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
      <p className={`text-sm font-semibold ${isDebit ? "text-red-600" : "text-green-600"} whitespace-nowrap ml-3`}>
        {isDebit ? "-" : "+"}R{tx.amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
      </p>
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
