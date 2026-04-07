import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState, useMemo } from "react";
import {
  ArrowLeft,
  Users,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Search,
  Download,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Briefcase,
  Receipt,
  Hammer,
  ShieldAlert,
  ArrowUpDown,
} from "lucide-react";
import { AccessDenied } from "~/components/AccessDenied";

export const Route = createFileRoute("/admin/artisan-expenses/")({
  component: ArtisanExpensesPage,
});

function ArtisanExpensesPage() {
  const { token } = useAuthStore();
  const trpc = useTRPC();

  const [searchTerm, setSearchTerm] = useState("");
  const [expandedArtisan, setExpandedArtisan] = useState<number | null>(null);
  const [drilldownTab, setDrilldownTab] = useState<"orders" | "payments" | "slips">("orders");
  const [sortBy, setSortBy] = useState<"cost" | "name" | "orders" | "flags">("cost");
  const [periodFilter, setPeriodFilter] = useState<"all" | "current_month" | "current_quarter" | "financial_year">("all");

  // Permission check
  const userPermissionsQuery = useQuery(
    trpc.getUserPermissions.queryOptions({ token: token! })
  );
  const hasAccess =
    userPermissionsQuery.data?.permissions.includes("VIEW_PAYMENT_REQUESTS") || false;

  // Fetch artisan expense tracker data
  const trackerQuery = useQuery({
    ...trpc.getArtisanExpenseTracker.queryOptions({ token: token! }),
    enabled: !!token && hasAccess,
  });

  const data = trackerQuery.data;

  // Period filtering (client-side on payment paidDate / order createdAt)
  const periodBounds = useMemo(() => {
    const now = new Date();
    switch (periodFilter) {
      case "current_month":
        return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999) };
      case "current_quarter": {
        const fyMonth = (now.getMonth() - 2 + 12) % 12;
        const qStartFyMonth = Math.floor(fyMonth / 3) * 3;
        const qStartCalMonth = (qStartFyMonth + 2) % 12;
        const qStartYear = qStartCalMonth > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear();
        const qEndCalMonth = (qStartCalMonth + 2) % 12;
        const qEndYear = qEndCalMonth < qStartCalMonth ? qStartYear + 1 : qStartYear;
        return { start: new Date(qStartYear, qStartCalMonth, 1), end: new Date(qEndYear, qEndCalMonth + 1, 0, 23, 59, 59, 999) };
      }
      case "financial_year":
        return {
          start: now.getMonth() >= 2 ? new Date(now.getFullYear(), 2, 1) : new Date(now.getFullYear() - 1, 2, 1),
          end: now,
        };
      default:
        return null;
    }
  }, [periodFilter]);

  const isInPeriod = (date: string | Date | null | undefined) => {
    if (!periodBounds || !date) return true; // "all" = no filter
    const d = new Date(date);
    return d >= periodBounds.start && d <= periodBounds.end;
  };

  // Apply search + period filter
  const filteredArtisans = useMemo(() => {
    if (!data) return [];
    return data.artisanData
      .filter((a) => {
        const name = `${a.artisan.firstName} ${a.artisan.lastName}`.toLowerCase();
        return name.includes(searchTerm.toLowerCase());
      })
      .map((a) => {
        if (!periodBounds) return a;
        // Re-compute summary for filtered period
        const filteredOrders = a.orders.filter((o) => isInPeriod(o.createdAt));
        const filteredPayments = a.paymentRequests.filter((pr) => isInPeriod(pr.paidDate || pr.createdAt));
        const filteredSlips = a.expenseSlips.filter((es) => isInPeriod(es.createdAt));

        const totalMaterialCost = filteredOrders.reduce((s, o) => s + (o.materialCost || 0), 0);
        const totalLabourCost = filteredOrders.reduce((s, o) => s + (o.labourCost || 0), 0);
        const totalExpenseSlips = filteredSlips.reduce((s, es) => s + (es.amount || 0), 0);
        const paidPayments = filteredPayments.filter((pr) => pr.status === "PAID");
        const totalPaid = paidPayments.reduce((s, pr) => s + pr.calculatedAmount, 0);
        const totalPending = filteredPayments.filter((pr) => pr.status === "PENDING").reduce((s, pr) => s + pr.calculatedAmount, 0);
        const totalApproved = filteredPayments.filter((pr) => pr.status === "APPROVED").reduce((s, pr) => s + pr.calculatedAmount, 0);
        const totalCostToCompany = totalMaterialCost + totalLabourCost + totalPaid + totalExpenseSlips;

        return {
          ...a,
          orders: filteredOrders,
          paymentRequests: filteredPayments,
          expenseSlips: filteredSlips,
          summary: {
            ...a.summary,
            totalOrders: filteredOrders.length,
            completedOrders: filteredOrders.filter((o) => o.status === "COMPLETED").length,
            activeOrders: filteredOrders.filter((o) => o.status === "IN_PROGRESS" || o.status === "ASSIGNED").length,
            totalMaterialCost,
            totalLabourCost,
            totalExpenseSlips,
            totalPaid,
            totalPending,
            totalApproved,
            totalCostToCompany,
            avgCostPerJob: filteredOrders.length > 0 ? totalCostToCompany / filteredOrders.length : 0,
          },
        };
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "name":
            return `${a.artisan.firstName} ${a.artisan.lastName}`.localeCompare(`${b.artisan.firstName} ${b.artisan.lastName}`);
          case "orders":
            return b.summary.totalOrders - a.summary.totalOrders;
          case "flags":
            return b.flags.length - a.flags.length;
          default:
            return b.summary.totalCostToCompany - a.summary.totalCostToCompany;
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, searchTerm, sortBy, periodBounds]);

  // Period-filtered global totals
  const filteredTotals = useMemo(() => {
    return {
      totalPaid: filteredArtisans.reduce((s, a) => s + a.summary.totalPaid, 0),
      totalPending: filteredArtisans.reduce((s, a) => s + a.summary.totalPending, 0),
      totalMaterialCost: filteredArtisans.reduce((s, a) => s + a.summary.totalMaterialCost, 0),
      totalLabourCost: filteredArtisans.reduce((s, a) => s + a.summary.totalLabourCost, 0),
      totalExpenseSlips: filteredArtisans.reduce((s, a) => s + a.summary.totalExpenseSlips, 0),
      totalCostToCompany: filteredArtisans.reduce((s, a) => s + a.summary.totalCostToCompany, 0),
      totalFlagged: filteredArtisans.filter((a) => a.flags.length > 0).length,
    };
  }, [filteredArtisans]);

  const R = (v: number) => `R${v.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // CSV Export
  const handleExport = () => {
    const headers = ["Artisan", "Email", "Total Orders", "Material Costs", "Labour Costs", "Expense Slips", "Paid Payments", "Pending Payments", "Total Cost to Company", "Avg Cost/Job", "Flags"];
    const rows = filteredArtisans.map((a) => [
      `${a.artisan.firstName} ${a.artisan.lastName}`,
      a.artisan.email,
      a.summary.totalOrders,
      a.summary.totalMaterialCost.toFixed(2),
      a.summary.totalLabourCost.toFixed(2),
      a.summary.totalExpenseSlips.toFixed(2),
      a.summary.totalPaid.toFixed(2),
      a.summary.totalPending.toFixed(2),
      a.summary.totalCostToCompany.toFixed(2),
      a.summary.avgCostPerJob.toFixed(2),
      a.flags.join("; "),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `artisan-expenses-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Loading state
  if (userPermissionsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!hasAccess) {
    return <AccessDenied message="You do not have permission to access Artisan Expense Tracking." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 shadow-lg" style={{ position: "sticky", top: 0, zIndex: 50 }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/admin/dashboard" className="text-white/80 hover:text-white transition-colors">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <DollarSign className="h-6 w-6" />
                  Artisan Expense Tracker
                </h1>
                <p className="text-sm text-white/70">Track expenses, payments, and costs per artisan</p>
              </div>
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors text-sm"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-4 flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search artisans..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Time</option>
            <option value="current_month">Current Month</option>
            <option value="current_quarter">Current Quarter</option>
            <option value="financial_year">Financial Year</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="cost">Sort: Highest Cost</option>
            <option value="name">Sort: Name A-Z</option>
            <option value="orders">Sort: Most Orders</option>
            <option value="flags">Sort: Most Flags</option>
          </select>
        </div>

        {/* Global Summary Cards */}
        {trackerQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <SummaryCard icon={Users} label="Artisans" value={`${filteredArtisans.length}`} color="blue" />
              <SummaryCard icon={DollarSign} label="Total Cost" value={R(filteredTotals.totalCostToCompany)} color="red" />
              <SummaryCard icon={CheckCircle} label="Paid" value={R(filteredTotals.totalPaid)} color="green" />
              <SummaryCard icon={Clock} label="Pending" value={R(filteredTotals.totalPending)} color="yellow" />
              <SummaryCard icon={Hammer} label="Materials" value={R(filteredTotals.totalMaterialCost)} color="indigo" />
              <SummaryCard icon={Briefcase} label="Labour" value={R(filteredTotals.totalLabourCost)} color="purple" />
              {filteredTotals.totalFlagged > 0 && (
                <SummaryCard icon={ShieldAlert} label="Flagged" value={`${filteredTotals.totalFlagged}`} color="red" />
              )}
            </div>

            {/* Artisan List */}
            <div className="space-y-4">
              {filteredArtisans.length === 0 ? (
                <div className="bg-white rounded-xl shadow-md p-12 text-center text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-lg font-medium">No artisans found</p>
                  <p className="text-sm">Try adjusting the search or period filter.</p>
                </div>
              ) : (
                filteredArtisans.map((a) => (
                  <ArtisanRow
                    key={a.artisan.id}
                    data={a}
                    isExpanded={expandedArtisan === a.artisan.id}
                    onToggle={() => setExpandedArtisan(expandedArtisan === a.artisan.id ? null : a.artisan.id)}
                    drilldownTab={drilldownTab}
                    onTabChange={setDrilldownTab}
                    R={R}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Summary Card ──────────────────────────────────────────────────────
function SummaryCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    red: "bg-red-50 text-red-700 border-red-200",
    green: "bg-green-50 text-green-700 border-green-200",
    yellow: "bg-yellow-50 text-yellow-700 border-yellow-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] || colorMap.blue}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-lg font-bold truncate">{value}</p>
    </div>
  );
}

// ── Artisan Row (expandable) ─────────────────────────────────────────
function ArtisanRow({
  data,
  isExpanded,
  onToggle,
  drilldownTab,
  onTabChange,
  R,
}: {
  data: any;
  isExpanded: boolean;
  onToggle: () => void;
  drilldownTab: "orders" | "payments" | "slips";
  onTabChange: (tab: "orders" | "payments" | "slips") => void;
  R: (v: number) => string;
}) {
  const a = data.artisan;
  const s = data.summary;

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      {/* Collapsed header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {a.firstName?.[0]}{a.lastName?.[0]}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 truncate">{a.firstName} {a.lastName}</h3>
              {data.flags.length > 0 && (
                <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                  <AlertTriangle className="h-3 w-3" />
                  {data.flags.length} {data.flags.length === 1 ? "flag" : "flags"}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">{a.email} &middot; {s.totalOrders} orders &middot; {s.completedOrders} completed</p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="hidden md:flex items-center gap-6 text-sm flex-shrink-0">
          <div className="text-right">
            <p className="text-xs text-gray-500">Total Cost</p>
            <p className="font-semibold text-gray-900">{R(s.totalCostToCompany)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Paid</p>
            <p className="font-semibold text-green-600">{R(s.totalPaid)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Pending</p>
            <p className="font-semibold text-yellow-600">{R(s.totalPending)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Avg/Job</p>
            <p className="font-semibold text-gray-700">{R(s.avgCostPerJob)}</p>
          </div>
          {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
        </div>
      </button>

      {/* Expanded drill-down */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          {/* Red flags banner */}
          {data.flags.length > 0 && (
            <div className="bg-red-50 border-b border-red-100 px-5 py-3">
              <div className="flex items-start gap-2">
                <ShieldAlert className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">Red Flags Detected</p>
                  <ul className="mt-1 space-y-0.5">
                    {data.flags.map((flag: string, i: number) => (
                      <li key={i} className="text-sm text-red-600">• {flag}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Cost breakdown mini cards */}
          <div className="p-5 grid grid-cols-2 md:grid-cols-5 gap-3">
            <MiniStat label="Materials" value={R(s.totalMaterialCost)} color="text-indigo-600" />
            <MiniStat label="Labour" value={R(s.totalLabourCost)} color="text-purple-600" />
            <MiniStat label="Expense Slips" value={R(s.totalExpenseSlips)} color="text-orange-600" />
            <MiniStat label="Hours Worked" value={`${Math.round(s.totalMinutesWorked / 60)}h`} color="text-blue-600" />
            <MiniStat label="Rate" value={a.hourlyRate ? `R${a.hourlyRate}/hr` : a.dailyRate ? `R${a.dailyRate}/day` : "—"} color="text-gray-600" />
          </div>

          {/* Tabs */}
          <div className="px-5 border-b border-gray-200">
            <div className="flex gap-6">
              <TabButton active={drilldownTab === "orders"} onClick={() => onTabChange("orders")} label={`Orders (${data.orders.length})`} />
              <TabButton active={drilldownTab === "payments"} onClick={() => onTabChange("payments")} label={`Payments (${data.paymentRequests.length})`} />
              <TabButton active={drilldownTab === "slips"} onClick={() => onTabChange("slips")} label={`Expense Slips (${data.expenseSlips.length})`} />
            </div>
          </div>

          {/* Tab content */}
          <div className="p-5 max-h-96 overflow-y-auto">
            {drilldownTab === "orders" && <OrdersTable orders={data.orders} R={R} />}
            {drilldownTab === "payments" && <PaymentsTable payments={data.paymentRequests} R={R} />}
            {drilldownTab === "slips" && <SlipsTable slips={data.expenseSlips} R={R} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mini stat ─────────────────────────────────────────────────────────
function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}

// ── Tab button ────────────────────────────────────────────────────────
function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-indigo-600 text-indigo-600"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {label}
    </button>
  );
}

// ── Orders Table ──────────────────────────────────────────────────────
function OrdersTable({ orders, R }: { orders: any[]; R: (v: number) => string }) {
  if (orders.length === 0)
    return <p className="text-sm text-gray-500 text-center py-6">No orders for this period.</p>;

  const statusColor: Record<string, string> = {
    COMPLETED: "bg-green-100 text-green-700",
    IN_PROGRESS: "bg-blue-100 text-blue-700",
    ASSIGNED: "bg-yellow-100 text-yellow-700",
    PENDING: "bg-gray-100 text-gray-700",
    CANCELLED: "bg-red-100 text-red-700",
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b">
            <th className="pb-2 pr-4">Order #</th>
            <th className="pb-2 pr-4">Customer</th>
            <th className="pb-2 pr-4">Service</th>
            <th className="pb-2 pr-4">Status</th>
            <th className="pb-2 pr-4 text-right">Materials</th>
            <th className="pb-2 pr-4 text-right">Labour</th>
            <th className="pb-2 pr-4 text-right">Expense Slips</th>
            <th className="pb-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {orders.map((o: any) => (
            <tr key={o.id} className="hover:bg-gray-50 transition-colors">
              <td className="py-2 pr-4 font-medium text-indigo-600">{o.orderNumber}</td>
              <td className="py-2 pr-4 text-gray-700">{o.customerName}</td>
              <td className="py-2 pr-4 text-gray-600">{o.serviceType}</td>
              <td className="py-2 pr-4">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[o.status] || "bg-gray-100"}`}>
                  {o.status}
                </span>
              </td>
              <td className="py-2 pr-4 text-right">{R(o.materialCost || 0)}</td>
              <td className="py-2 pr-4 text-right">{R(o.labourCost || 0)}</td>
              <td className="py-2 pr-4 text-right">{R(o.expenseSlipTotal || 0)}</td>
              <td className="py-2 text-right font-medium">{R((o.materialCost || 0) + (o.labourCost || 0) + (o.expenseSlipTotal || 0))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 font-semibold text-gray-900">
            <td colSpan={4} className="py-2 pr-4">Totals</td>
            <td className="py-2 pr-4 text-right">{R(orders.reduce((s: number, o: any) => s + (o.materialCost || 0), 0))}</td>
            <td className="py-2 pr-4 text-right">{R(orders.reduce((s: number, o: any) => s + (o.labourCost || 0), 0))}</td>
            <td className="py-2 pr-4 text-right">{R(orders.reduce((s: number, o: any) => s + (o.expenseSlipTotal || 0), 0))}</td>
            <td className="py-2 text-right">{R(orders.reduce((s: number, o: any) => s + (o.materialCost || 0) + (o.labourCost || 0) + (o.expenseSlipTotal || 0), 0))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Payments Table ────────────────────────────────────────────────────
function PaymentsTable({ payments, R }: { payments: any[]; R: (v: number) => string }) {
  if (payments.length === 0)
    return <p className="text-sm text-gray-500 text-center py-6">No payment requests for this period.</p>;

  const statusColor: Record<string, string> = {
    PAID: "bg-green-100 text-green-700",
    APPROVED: "bg-blue-100 text-blue-700",
    PENDING: "bg-yellow-100 text-yellow-700",
    REJECTED: "bg-red-100 text-red-700",
  };
  const StatusIcon: Record<string, any> = {
    PAID: CheckCircle,
    APPROVED: TrendingUp,
    PENDING: Clock,
    REJECTED: XCircle,
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b">
            <th className="pb-2 pr-4">Ref #</th>
            <th className="pb-2 pr-4">Status</th>
            <th className="pb-2 pr-4">Date</th>
            <th className="pb-2 pr-4">Paid Date</th>
            <th className="pb-2 pr-4 text-right">Hours</th>
            <th className="pb-2 pr-4 text-right">Days</th>
            <th className="pb-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {payments.map((pr: any) => {
            const Icon = StatusIcon[pr.status] || Clock;
            return (
              <tr key={pr.id} className="hover:bg-gray-50 transition-colors">
                <td className="py-2 pr-4 font-medium text-indigo-600">{pr.requestNumber}</td>
                <td className="py-2 pr-4">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[pr.status] || "bg-gray-100"}`}>
                    <Icon className="h-3 w-3" />
                    {pr.status}
                  </span>
                </td>
                <td className="py-2 pr-4 text-gray-600">{new Date(pr.createdAt).toLocaleDateString("en-ZA")}</td>
                <td className="py-2 pr-4 text-gray-600">{pr.paidDate ? new Date(pr.paidDate).toLocaleDateString("en-ZA") : "—"}</td>
                <td className="py-2 pr-4 text-right">{pr.hoursWorked ?? "—"}</td>
                <td className="py-2 pr-4 text-right">{pr.daysWorked ?? "—"}</td>
                <td className="py-2 text-right font-medium">{R(pr.calculatedAmount)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 font-semibold text-gray-900">
            <td colSpan={6} className="py-2 pr-4">Total</td>
            <td className="py-2 text-right">{R(payments.reduce((s: number, pr: any) => s + pr.calculatedAmount, 0))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Expense Slips Table ───────────────────────────────────────────────
function SlipsTable({ slips, R }: { slips: any[]; R: (v: number) => string }) {
  if (slips.length === 0)
    return <p className="text-sm text-gray-500 text-center py-6">No expense slips for this period.</p>;

  const categoryColor: Record<string, string> = {
    MATERIALS: "bg-indigo-100 text-indigo-700",
    TOOLS: "bg-purple-100 text-purple-700",
    TRANSPORTATION: "bg-orange-100 text-orange-700",
    OTHER: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b">
            <th className="pb-2 pr-4">Order</th>
            <th className="pb-2 pr-4">Category</th>
            <th className="pb-2 pr-4">Description</th>
            <th className="pb-2 pr-4">Date</th>
            <th className="pb-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {slips.map((es: any, i: number) => (
            <tr key={es.id ?? i} className="hover:bg-gray-50 transition-colors">
              <td className="py-2 pr-4 font-medium text-indigo-600">{es.orderNumber || "—"}</td>
              <td className="py-2 pr-4">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryColor[es.category] || "bg-gray-100"}`}>
                  {es.category}
                </span>
              </td>
              <td className="py-2 pr-4 text-gray-600 truncate max-w-[200px]">{es.description || "—"}</td>
              <td className="py-2 pr-4 text-gray-600">{new Date(es.createdAt).toLocaleDateString("en-ZA")}</td>
              <td className="py-2 text-right font-medium">{R(es.amount || 0)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 font-semibold text-gray-900">
            <td colSpan={4} className="py-2 pr-4">Total</td>
            <td className="py-2 text-right">{R(slips.reduce((s: number, es: any) => s + (es.amount || 0), 0))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
