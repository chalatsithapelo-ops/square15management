// PR-8 — Admin "Unassigned TM" cleanup screen.
//
// Shows every order whose `technicalManagerId` is currently NULL and lets
// admins assign a TM one row at a time (with an optional per-order reason)
// OR bulk-apply the auto-resolver's proposals in one click.
//
// Pulls its data from `adminTmBackfillDryRun` (READ-ONLY, safe to poll) and
// writes via `adminResolveUnassignedTm` (per-row, logs
// source=UNRESOLVABLE_CLEANUP) or `adminTmBackfillApply` (bulk, logs
// source=BACKFILL). Every write goes through `logTmAssignment` so the
// attribution history is provable later.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Search,
  UserCog,
  RefreshCw,
  Filter,
} from "lucide-react";
import { TmPicker } from "~/components/TmPicker";

export const Route = createFileRoute("/admin/tm-statements/unassigned/")({
  component: UnassignedTmPage,
});

type BackfillSource = "INITIATOR_DEFAULT_TM" | "ASSIGNEE_DEFAULT_TM" | "CREW_LEAD" | "UNRESOLVABLE";

const SOURCE_META: Record<BackfillSource, { label: string; badgeClass: string }> = {
  INITIATOR_DEFAULT_TM: { label: "Initiator default", badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  ASSIGNEE_DEFAULT_TM: { label: "Assignee default", badgeClass: "bg-sky-100 text-sky-800 border-sky-200" },
  CREW_LEAD: { label: "Crew LEAD", badgeClass: "bg-amber-100 text-amber-800 border-amber-200" },
  UNRESOLVABLE: { label: "Unresolvable", badgeClass: "bg-rose-100 text-rose-800 border-rose-200" },
};

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
}

function UnassignedTmPage() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const qc = useQueryClient();

  if (!token || !user) return null;

  const [showOnly, setShowOnly] = useState<"ALL" | "RESOLVABLE" | "UNRESOLVABLE">("ALL");
  const [q, setQ] = useState("");
  const [rowOverrides, setRowOverrides] = useState<Record<number, number | null>>({});
  const [busyOrderIds, setBusyOrderIds] = useState<Set<number>>(new Set());

  // Load every NULL-TM order + its proposal. 500 rows is plenty for the
  // cleanup workflow — larger sets should use the CLI backfill script.
  const preview = useQuery(
    trpc.adminTmBackfillDryRun.queryOptions({ token, limit: 500, onlyResolvable: false }),
  );

  const resolveOne = useMutation(
    trpc.adminResolveUnassignedTm.mutationOptions({
      onSuccess: (_data, vars) => {
        toast.success(`Order assigned to TM`);
        setRowOverrides((prev) => {
          const next = { ...prev };
          delete next[vars.orderId];
          return next;
        });
        setBusyOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(vars.orderId);
          return next;
        });
        qc.invalidateQueries({ queryKey: trpc.adminTmBackfillDryRun.queryKey() });
      },
      onError: (e, vars) => {
        toast.error(e.message);
        setBusyOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(vars.orderId);
          return next;
        });
      },
    }),
  );

  const applyBulk = useMutation(
    trpc.adminTmBackfillApply.mutationOptions({
      onSuccess: (data) => {
        toast.success(`${data.updated} order(s) updated via auto-resolver`);
        qc.invalidateQueries({ queryKey: trpc.adminTmBackfillDryRun.queryKey() });
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const proposals = preview.data?.proposals ?? [];
  const summary = preview.data?.summary;
  const filtered = useMemo(() => {
    return proposals.filter((p) => {
      if (showOnly === "RESOLVABLE" && p.source === "UNRESOLVABLE") return false;
      if (showOnly === "UNRESOLVABLE" && p.source !== "UNRESOLVABLE") return false;
      if (q) {
        const s = q.toLowerCase();
        return (
          p.orderNumber.toLowerCase().includes(s) ||
          (p.customerName ?? "").toLowerCase().includes(s) ||
          (p.assignedToName ?? "").toLowerCase().includes(s) ||
          (p.proposedTmName ?? "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [proposals, showOnly, q]);

  const canBulkApply = summary && summary.bySource.INITIATOR_DEFAULT_TM +
    summary.bySource.ASSIGNEE_DEFAULT_TM +
    summary.bySource.CREW_LEAD > 0;

  const bulkExpected =
    (summary?.bySource.INITIATOR_DEFAULT_TM ?? 0) +
    (summary?.bySource.ASSIGNEE_DEFAULT_TM ?? 0) +
    (summary?.bySource.CREW_LEAD ?? 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-3 mb-4">
          <Link to="/admin/tm-statements" className="text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <UserCog className="w-6 h-6 text-indigo-600" />
              Unassigned Technical Manager
            </h1>
            <p className="text-sm text-slate-600">
              Orders that don't yet have a TM. Assign one per row, or bulk-apply the auto-resolver's proposals.
            </p>
          </div>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Total NULL-TM</div>
            <div className="text-2xl font-bold text-slate-900">{preview.data?.totalNullOrders ?? "—"}</div>
          </div>
          <div className="bg-white rounded-lg border border-emerald-200 p-3">
            <div className="text-xs uppercase tracking-wide text-emerald-700">Initiator default</div>
            <div className="text-2xl font-bold text-emerald-800">{summary?.bySource.INITIATOR_DEFAULT_TM ?? 0}</div>
          </div>
          <div className="bg-white rounded-lg border border-sky-200 p-3">
            <div className="text-xs uppercase tracking-wide text-sky-700">Assignee default</div>
            <div className="text-2xl font-bold text-sky-800">{summary?.bySource.ASSIGNEE_DEFAULT_TM ?? 0}</div>
          </div>
          <div className="bg-white rounded-lg border border-amber-200 p-3">
            <div className="text-xs uppercase tracking-wide text-amber-700">Crew LEAD</div>
            <div className="text-2xl font-bold text-amber-800">{summary?.bySource.CREW_LEAD ?? 0}</div>
          </div>
          <div className="bg-white rounded-lg border border-rose-200 p-3">
            <div className="text-xs uppercase tracking-wide text-rose-700">Unresolvable</div>
            <div className="text-2xl font-bold text-rose-800">{summary?.bySource.UNRESOLVABLE ?? 0}</div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg border border-slate-200 p-3 mb-4 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px] relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search order #, customer, artisan, TM…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={showOnly}
              onChange={(e) => setShowOnly(e.target.value as any)}
              className="border border-slate-300 rounded-md text-sm px-2 py-1.5"
            >
              <option value="ALL">All rows</option>
              <option value="RESOLVABLE">Resolvable only</option>
              <option value="UNRESOLVABLE">Unresolvable only</option>
            </select>
          </div>
          <button
            onClick={() => preview.refetch()}
            disabled={preview.isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${preview.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => {
              if (!canBulkApply) return;
              if (
                !confirm(
                  `Auto-assign ${bulkExpected} order(s) using the resolver? Every change is audit-logged and reversible.`,
                )
              )
                return;
              applyBulk.mutate({
                token,
                applyAllResolvable: true,
                expectedCount: bulkExpected,
              });
            }}
            disabled={!canBulkApply || applyBulk.isPending}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {applyBulk.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Auto-assign {bulkExpected} resolvable
          </button>
        </div>

        {/* Table */}
        {preview.isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : preview.isError ? (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-sm text-rose-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            {String(preview.error?.message ?? "Failed to load")}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <div className="text-sm text-emerald-800 font-medium">
              {proposals.length === 0
                ? "No orders are missing a Technical Manager. Nice work."
                : "No rows match the current filter."}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-600">
                    <th className="px-3 py-2">Order</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">End / Created</th>
                    <th className="px-3 py-2">Proposed source</th>
                    <th className="px-3 py-2">Proposed TM</th>
                    <th className="px-3 py-2">Assign this TM</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((p) => {
                    const meta = SOURCE_META[p.source as BackfillSource];
                    const override = rowOverrides[p.orderId];
                    const effectiveTmId = override ?? p.proposedTmId ?? null;
                    const busy = busyOrderIds.has(p.orderId);
                    return (
                      <tr key={p.orderId} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-slate-900">{p.orderNumber}</td>
                        <td className="px-3 py-2 text-slate-700">
                          <div className="max-w-[180px] truncate" title={p.customerName ?? undefined}>
                            {p.customerName ?? "—"}
                          </div>
                          {p.assignedToName && (
                            <div className="text-xs text-slate-500 truncate max-w-[180px]">
                              Artisan: {p.assignedToName}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                          {fmtDate(p.endTime)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${meta.badgeClass}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {p.proposedTmName ?? <span className="text-slate-400 italic">—</span>}
                        </td>
                        <td className="px-3 py-2 min-w-[220px]">
                          <TmPicker
                            token={token}
                            value={effectiveTmId}
                            onChange={(id) => setRowOverrides((prev) => ({ ...prev, [p.orderId]: id }))}
                            required={false}
                            autoPreselect={false}
                            compact
                            allowNone={false}
                          />
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button
                            disabled={!effectiveTmId || busy || resolveOne.isPending}
                            onClick={() => {
                              if (!effectiveTmId) return;
                              setBusyOrderIds((prev) => new Set(prev).add(p.orderId));
                              resolveOne.mutate({
                                token,
                                orderId: p.orderId,
                                technicalManagerId: effectiveTmId,
                                reason: `Cleanup via unassigned screen`,
                              });
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                            Assign
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {preview.data?.truncated && (
              <div className="px-3 py-2 text-xs text-amber-700 bg-amber-50 border-t border-amber-200">
                Preview truncated at 500 rows. Use the CLI backfill script for larger cleanups.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
