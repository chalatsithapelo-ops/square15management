import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  AlertTriangle,
  DollarSign,
  Clock,
  Download,
  Search,
  Loader2,
  TrendingDown,
  Building2,
  Mail,
  RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/admin/billing/unbilled-work/")({
  component: UnbilledWorkPage,
});

const ALL_BLOCKERS = [
  { id: "NO_ORDER_NUMBER", label: "No order #" },
  { id: "AWAITING_QUOTATION", label: "Awaiting quotation" },
  { id: "AWAITING_INVOICE", label: "Awaiting invoice" },
  { id: "AWAITING_SIGNATURE", label: "Awaiting signature" },
  { id: "PENDING_ADMIN_REVIEW", label: "Pending admin review" },
];

function fmtR(n: number | null | undefined): string {
  const v = typeof n === "number" ? n : 0;
  return `R ${v.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function bucketColor(b: string): string {
  switch (b) {
    case "0-7": return "bg-green-100 text-green-800";
    case "8-14": return "bg-yellow-100 text-yellow-800";
    case "15-30": return "bg-orange-100 text-orange-800";
    case "30+": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

function blockerBadge(b: string): string {
  const map: Record<string, string> = {
    NO_ORDER_NUMBER: "bg-amber-100 text-amber-800 border-amber-300",
    AWAITING_QUOTATION: "bg-purple-100 text-purple-800 border-purple-300",
    AWAITING_INVOICE: "bg-blue-100 text-blue-800 border-blue-300",
    AWAITING_SIGNATURE: "bg-pink-100 text-pink-800 border-pink-300",
    PENDING_ADMIN_REVIEW: "bg-indigo-100 text-indigo-800 border-indigo-300",
  };
  return map[b] || "bg-gray-100 text-gray-800 border-gray-300";
}

function UnbilledWorkPage() {
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const trpc = useTRPC();

  if (!token || !user) {
    navigate({ to: "/" });
    return null;
  }

  const [search, setSearch] = useState("");
  const [selectedBlockers, setSelectedBlockers] = useState<string[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string>("");
  const [selfInitiatedOnly, setSelfInitiatedOnly] = useState(false);
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [completedFrom, setCompletedFrom] = useState("");
  const [completedTo, setCompletedTo] = useState("");
  const [sortBy, setSortBy] = useState<"completedAt" | "totalCost" | "ageDays" | "orderNumber">("completedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filterArgs = useMemo(() => ({
    token,
    search: search || undefined,
    blockers: selectedBlockers.length ? selectedBlockers : undefined,
    agingBucket: (selectedBucket || undefined) as any,
    selfInitiatedOnly: selfInitiatedOnly || undefined,
    minAmount: minAmount ? parseFloat(minAmount) : undefined,
    maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
    completedFrom: completedFrom || undefined,
    completedTo: completedTo || undefined,
    sortBy,
    sortDir,
    limit: 200,
    offset: 0,
  }), [token, search, selectedBlockers, selectedBucket, selfInitiatedOnly, minAmount, maxAmount, completedFrom, completedTo, sortBy, sortDir]);

  const list = useQuery(trpc.getUnbilledWork.queryOptions(filterArgs));

  const exportMutation = useMutation(trpc.exportUnbilledWorkExcel.mutationOptions({
    onSuccess: (res) => {
      window.open(res.url, "_blank");
      toast.success(`Excel ready: ${res.fileName}`);
    },
    onError: (e) => toast.error(e.message),
  }));

  const digestMutation = useMutation(trpc.sendUnbilledWorkDigest.mutationOptions({
    onSuccess: (res: any) => {
      toast.success(`Digest sent to ${res?.recipients ?? 0} recipients (${fmtR(res?.totalAtRisk ?? 0)} at risk)`);
    },
    onError: (e) => toast.error(e.message),
  }));

  const toggleBlocker = (id: string) => {
    setSelectedBlockers((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const agg = list.data?.aggregates;
  const rows = list.data?.rows ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin/dashboard" className="text-gray-500 hover:text-gray-900">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <TrendingDown className="w-7 h-7 text-red-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Money on the Floor</h1>
              <p className="text-sm text-gray-500">Unbilled, missing-PO, and pending-review jobs</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => list.refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded border bg-white hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button
              onClick={() => digestMutation.mutate({ token })}
              disabled={digestMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded border bg-white hover:bg-gray-50"
              title="Send weekly digest now"
            >
              {digestMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Send digest
            </button>
            <button
              onClick={() => exportMutation.mutate(filterArgs as any)}
              disabled={exportMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {exportMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export Excel
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Aggregate cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <AggCard
            color="red"
            icon={<DollarSign className="w-5 h-5" />}
            label="Total at risk"
            value={fmtR(agg?.totalAtRisk ?? 0)}
          />
          <AggCard
            color="amber"
            icon={<AlertTriangle className="w-5 h-5" />}
            label="Jobs"
            value={String(list.data?.count ?? 0)}
          />
          <AggCard
            color="orange"
            icon={<Clock className="w-5 h-5" />}
            label="Avg age (days)"
            value={String(agg?.averageAgeDays ?? 0)}
            subtitle={`Oldest: ${agg?.oldestAgeDays ?? 0}d`}
          />
          <AggCard
            color="purple"
            icon={<Building2 className="w-5 h-5" />}
            label="Worst building"
            value={agg?.worstBuilding?.name ?? "—"}
            subtitle={agg?.worstBuilding ? fmtR(agg.worstBuilding.value) : ""}
          />
        </div>

        {/* Filter bar */}
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute top-2.5 left-3 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order #, client PO, building, artisan, description…"
                className="w-full pl-9 pr-3 py-2 text-sm border rounded"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Aging bucket</label>
              <select
                value={selectedBucket}
                onChange={(e) => setSelectedBucket(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded"
              >
                <option value="">All</option>
                <option value="0-7">0–7 days</option>
                <option value="8-14">8–14 days</option>
                <option value="15-30">15–30 days</option>
                <option value="30+">30+ days</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Sort by</label>
              <div className="flex gap-1">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="flex-1 px-2 py-2 text-sm border rounded"
                >
                  <option value="completedAt">Completed</option>
                  <option value="totalCost">Value</option>
                  <option value="orderNumber">Order #</option>
                </select>
                <button
                  onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                  className="px-2 py-2 text-sm border rounded bg-white hover:bg-gray-50"
                  title={sortDir === "asc" ? "Ascending" : "Descending"}
                >
                  {sortDir === "asc" ? "↑" : "↓"}
                </button>
              </div>
            </div>

            <div className="md:col-span-4 flex flex-wrap gap-2 items-center pt-2 border-t">
              <span className="text-xs text-gray-600">Blockers:</span>
              {ALL_BLOCKERS.map((b) => (
                <button
                  key={b.id}
                  onClick={() => toggleBlocker(b.id)}
                  className={`px-2 py-1 text-xs rounded border ${
                    selectedBlockers.includes(b.id)
                      ? blockerBadge(b.id)
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>

            <div className="md:col-span-4 flex flex-wrap gap-3 items-end pt-2 border-t">
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={selfInitiatedOnly}
                  onChange={(e) => setSelfInitiatedOnly(e.target.checked)}
                />
                Self-initiated only
              </label>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Min R</label>
                <input
                  type="number"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="w-24 px-2 py-1 text-sm border rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Max R</label>
                <input
                  type="number"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  className="w-24 px-2 py-1 text-sm border rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Completed from</label>
                <input
                  type="date"
                  value={completedFrom}
                  onChange={(e) => setCompletedFrom(e.target.value)}
                  className="px-2 py-1 text-sm border rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Completed to</label>
                <input
                  type="date"
                  value={completedTo}
                  onChange={(e) => setCompletedTo(e.target.value)}
                  className="px-2 py-1 text-sm border rounded"
                />
              </div>
              <button
                onClick={() => {
                  setSearch(""); setSelectedBlockers([]); setSelectedBucket(""); setSelfInitiatedOnly(false);
                  setMinAmount(""); setMaxAmount(""); setCompletedFrom(""); setCompletedTo("");
                }}
                className="text-xs text-gray-600 hover:text-gray-900 underline"
              >
                Clear filters
              </button>
            </div>
          </div>
        </div>

        {/* Data table */}
        <div className="bg-white rounded-lg shadow border overflow-hidden">
          {list.isLoading ? (
            <div className="p-10 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /> Loading…</div>
          ) : list.isError ? (
            <div className="p-10 text-center text-red-600">{(list.error as Error).message}</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-gray-500">No unbilled work found for current filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <Th>Order</Th>
                    <Th>Client</Th>
                    <Th>Building</Th>
                    <Th>Artisan</Th>
                    <Th>Completed</Th>
                    <Th>Age</Th>
                    <Th className="text-right">At risk</Th>
                    <Th>Blockers</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r: any) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-xs">
                        <div className="font-semibold">{r.orderNumber}</div>
                        {r.clientOrderNumber && (
                          <div className="text-[10px] text-gray-500">PO: {r.clientOrderNumber}</div>
                        )}
                        {r.selfInitiated && (
                          <span className="inline-block mt-0.5 px-1 py-0.5 text-[9px] bg-indigo-100 text-indigo-800 rounded">SELF-INITIATED</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div>{r.client?.name ?? "—"}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div>{r.building?.name ?? r.addressSnapshot ?? "—"}</div>
                        {r.building?.address && <div className="text-[10px] text-gray-500 truncate max-w-[200px]">{r.building.address}</div>}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.artisan ? `${r.artisan.firstName} ${r.artisan.lastName}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.completedAt ? new Date(r.completedAt).toLocaleDateString("en-ZA") : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 text-xs rounded ${bucketColor(r.agingBucket)}`}>
                          {r.ageDays ?? "—"}d
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">{fmtR(r.atRiskValue)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {r.blockers.map((b: string) => (
                            <span key={b} className={`text-[10px] px-1.5 py-0.5 rounded border ${blockerBadge(b)}`}>
                              {b.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider ${className}`}>
      {children}
    </th>
  );
}

function AggCard({ icon, label, value, subtitle, color }: {
  icon: React.ReactNode; label: string; value: string; subtitle?: string;
  color: "red" | "amber" | "orange" | "purple";
}) {
  const ring: Record<string, string> = {
    red: "border-red-200 bg-red-50 text-red-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
    purple: "border-purple-200 bg-purple-50 text-purple-700",
  };
  return (
    <div className={`p-4 rounded-lg border ${ring[color]}`}>
      <div className="flex items-center gap-2 text-sm">{icon}<span>{label}</span></div>
      <div className="mt-2 text-2xl font-bold truncate">{value}</div>
      {subtitle && <div className="text-xs opacity-80 mt-1">{subtitle}</div>}
    </div>
  );
}
