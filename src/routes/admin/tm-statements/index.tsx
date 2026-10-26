import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState, useMemo, Fragment } from "react";
import toast from "react-hot-toast";
import { SignedMinioLink } from "~/components/SignedMinioUrl";
import {
  ArrowLeft,
  Download,
  Lock,
  Unlock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
  Receipt,
  ClipboardCheck,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  UserCircle2,
  Calendar,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Paperclip,
  Users,
  DollarSign,
} from "lucide-react";

export const Route = createFileRoute("/admin/tm-statements/")({
  component: TmStatementsPage,
});

const ZAR = (n: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", minimumFractionDigits: 2 }).format(n ?? 0);

// PR-7b — render one rate strategy as a human string ("35% / R130/h" or just "35%")
function formatRateOne(rateType: string, rateValue: number): string {
  switch (rateType) {
    case "PERCENT": return `${(rateValue * 100).toFixed(0)}%`;
    case "HOURLY": return `R${rateValue}/h`;
    case "DAILY": return `R${rateValue}/d`;
    case "NONE": return "—";
    default: return String(rateValue);
  }
}
function rateSummary(rule: any | null | undefined): string {
  if (!rule) return "—";
  const o = formatRateOne(rule.openRateType ?? "PERCENT", rule.openRateValue ?? rule.rate ?? 0);
  const q = formatRateOne(rule.quotedRateType ?? "PERCENT", rule.quotedRateValue ?? rule.rate ?? 0);
  return o === q ? o : `open ${o} / quoted ${q}`;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// PR-8 D — attribution badge dictionary. Colors + tooltips keyed on the badge
// bucket. Raw source string is used for the tooltip so admins can trace back
// exactly why the order landed on this TM's statement.
const ATTRIBUTION_BADGE: Record<
  string,
  { label: string; className: string; hint: string }
> = {
  EXPLICIT: {
    label: "Explicit",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300",
    hint: "Set explicitly by admin, artisan, or direct input",
  },
  DEFAULT: {
    label: "Default",
    className: "bg-sky-100 text-sky-800 border-sky-300",
    hint: "Resolved from a stored default TM (initiator / assignee / quote owner)",
  },
  LEGACY: {
    label: "Legacy",
    className: "bg-amber-100 text-amber-800 border-amber-300",
    hint: "Crew LEAD fallback, historical backfill, or unresolvable cleanup",
  },
  UNKNOWN: {
    label: "Unknown",
    className: "bg-slate-100 text-slate-600 border-slate-300",
    hint: "Pre-PR-8 data with no attribution trail",
  },
};

const RAW_SOURCE_LABEL: Record<string, string> = {
  EXPLICIT_INPUT: "explicit input at create time",
  ARTISAN_PICKED: "artisan picked on job start",
  INITIATOR_DEFAULT_TM: "initiator's default TM",
  ASSIGNEE_DEFAULT_TM: "assignee's default TM",
  QUOTE_OWNER_DEFAULT_TM: "quote owner's default TM",
  CREW_LEAD: "crew LEAD fallback",
  ADMIN_OVERRIDE: "admin override",
  BACKFILL: "PR-8 historical backfill",
  UNRESOLVABLE_CLEANUP: "unassigned-TM cleanup",
};

function AttributionBadge({
  badge,
  source,
  actorName,
  at,
}: {
  badge: string | undefined | null;
  source: string | null | undefined;
  actorName: string | null | undefined;
  at: Date | string | null | undefined;
}) {
  const meta = ATTRIBUTION_BADGE[badge ?? "UNKNOWN"] ?? ATTRIBUTION_BADGE.UNKNOWN;
  const rawLabel = source ? RAW_SOURCE_LABEL[source] ?? source : "no log entry";
  const when = at ? new Date(at).toISOString().slice(0, 10) : null;
  const tooltip = [
    meta.hint,
    `Source: ${rawLabel}`,
    actorName ? `By: ${actorName}` : null,
    when ? `On: ${when}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${meta.className}`}
      title={tooltip}
    >
      {meta.label}
    </span>
  );
}

function TmStatementsPage() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const qc = useQueryClient();

  const isTmSelfView = user?.role === "TECHNICAL_MANAGER";
  const isSeniorAdmin = user?.role === "ADMIN" || user?.role === "SENIOR_ADMIN" || user?.role === "MANAGER";

  const [selectedUserId, setSelectedUserId] = useState<number | null>(isTmSelfView ? (user?.id ?? null) : null);
  const [period, setPeriod] = useState<string>(currentMonth());
  // PR-8M — per-row audit drill-down
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<number>>(new Set());
  const toggleExpanded = (orderId: number) => {
    setExpandedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const candidatesQuery = useQuery(trpc.adminListTmCandidates.queryOptions({ token: token! }));
  const candidates = candidatesQuery.data ?? [];

  // Auto-select first candidate (or force self for TMs)
  useMemo(() => {
    if (isTmSelfView && user?.id != null && selectedUserId !== user.id) {
      setSelectedUserId(user.id);
      return;
    }
    if (!isTmSelfView && selectedUserId == null && candidates.length > 0) {
      setSelectedUserId(candidates[0].id);
    }
  }, [candidates, selectedUserId, isTmSelfView, user?.id]);

  const previewQuery = useQuery({
    ...trpc.adminTmStatementPreview.queryOptions({ token: token!, userId: selectedUserId ?? 0, period }),
    enabled: selectedUserId != null,
  });

  const statementsListQuery = useQuery({
    ...trpc.adminTmStatementList.queryOptions({ token: token!, userId: selectedUserId ?? undefined }),
    enabled: selectedUserId != null,
  });

  const generateLock = useMutation(
    trpc.adminTmStatementGenerateAndLock.mutationOptions({
      onSuccess: () => {
        toast.success("Statement locked — orders are now immutable for that month");
        qc.invalidateQueries({ queryKey: [["adminTmStatementList"]] });
        qc.invalidateQueries({ queryKey: [["adminTmStatementPreview"]] });
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const unlock = useMutation(
    trpc.adminTmStatementUnlock.mutationOptions({
      onSuccess: () => {
        toast.success("Statement unlocked");
        qc.invalidateQueries({ queryKey: [["adminTmStatementList"]] });
        qc.invalidateQueries({ queryKey: [["adminTmStatementPreview"]] });
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const exportXlsxQuery = useQuery({
    ...trpc.adminTmStatementExportXlsx.queryOptions({ token: token!, userId: selectedUserId ?? 0, period, useLockedSnapshot: false }),
    enabled: false, // triggered on demand
  });

  const handleDownload = async () => {
    const result = await exportXlsxQuery.refetch();
    const data = result.data;
    if (!data) {
      toast.error("Export failed");
      return;
    }
    const blob = new Blob([Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0))], { type: data.mimetype });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = data.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const preview = previewQuery.data;
  const lockedSnapshotsByMonth = new Map(
    (statementsListQuery.data ?? []).map((s) => [new Date(s.periodMonth).toISOString().slice(0, 7), s] as const),
  );
  const isThisMonthLocked = lockedSnapshotsByMonth.get(period)?.lockedAt != null;
  const lockedSnapshot = lockedSnapshotsByMonth.get(period);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/admin/dashboard" className="text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{isTmSelfView ? "My Commission Statement" : "Technical Manager Statements"}</h1>
            <p className="text-sm text-slate-600">{isTmSelfView ? "Your monthly commission reconciled from completed jobs." : "Per-TM monthly commission, reconciled and locked."}</p>
          </div>
          {!isTmSelfView && (
            <Link
              to="/admin/tm-statements/unassigned"
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-amber-300 bg-amber-50 text-amber-800 rounded-md hover:bg-amber-100"
              title="Orders currently missing a Technical Manager"
            >
              <AlertCircle className="w-4 h-4" />
              Unassigned TM
            </Link>
          )}
        </div>

        {/* Selector bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap items-end gap-4">
          {!isTmSelfView && (
            <div className="flex-1 min-w-[220px]">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1 block">Technical Manager</label>
              <select
                value={selectedUserId ?? ""}
                onChange={(e) => setSelectedUserId(Number(e.target.value) || null)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">— select —</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.email} · {(c.activeRate * 100).toFixed(0)}%
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1 block">Month</label>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <button
            onClick={handleDownload}
            disabled={!preview || exportXlsxQuery.isFetching}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium"
          >
            {exportXlsxQuery.isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download XLSX
          </button>

          {!isThisMonthLocked ? (
            isSeniorAdmin ? (
              <button
                onClick={() => {
                  if (!selectedUserId) return;
                  if (!confirm(`Lock ${preview?.userName ?? "this TM"}'s ${preview?.periodLabel ?? period} statement? Orders in the statement cannot be edited until you unlock.`)) return;
                  generateLock.mutate({ token: token!, userId: selectedUserId, period });
                }}
                disabled={!preview || generateLock.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium"
              >
                {generateLock.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Lock month
              </button>
            ) : null
          ) : (
            isSeniorAdmin ? (
              <button
                onClick={() => {
                  if (!lockedSnapshot) return;
                  if (!confirm("Unlock this statement? Orders will become editable again.")) return;
                  unlock.mutate({ token: token!, statementId: lockedSnapshot.id });
                }}
                disabled={unlock.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium"
              >
                {unlock.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                Unlock
              </button>
            ) : null
          )}

          <button onClick={() => previewQuery.refetch()} className="text-slate-500 hover:text-slate-700" title="Refresh">
            <RefreshCw className={`w-5 h-5 ${previewQuery.isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>

        {isThisMonthLocked && lockedSnapshot && (
          <div className="mb-4 flex items-center gap-2 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
            <Lock className="w-4 h-4" />
            Locked {new Date(lockedSnapshot.lockedAt!).toLocaleString("en-ZA")}{lockedSnapshot.lockedBy ? ` by ${lockedSnapshot.lockedBy.firstName} ${lockedSnapshot.lockedBy.lastName}` : ""}.
          </div>
        )}

        {previewQuery.isLoading && (
          <div className="bg-white rounded-xl border border-slate-200 p-10 flex items-center justify-center text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Building statement…
          </div>
        )}

        {preview && (
          <>
            {/* Totals strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <Kpi label="Jobs (this month)" value={String(preview.totals.jobCount)} />
              <Kpi label="Quoted (excl)" value={ZAR(preview.totals.totalQuoted)} />
              <Kpi label="Expenses (excl)" value={ZAR(preview.totals.totalExpenses)} accent={preview.totals.totalExpenses > 0 ? "amber" : undefined} />
              <Kpi label={`TM share — ${rateSummary(preview.rate)}`} value={ZAR(preview.totals.totalCommission)} accent={preview.totals.totalCommission >= 0 ? "emerald" : "rose"} />
            </div>

            {/* Outstanding cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
              <Outstanding label="Missing client PO" count={preview.outstanding.missingClientOrders.length} icon={<ClipboardCheck className="w-4 h-4" />} />
              <Outstanding label="Missing invoices" count={preview.outstanding.missingInvoices.length} icon={<FileText className="w-4 h-4" />} />
              <Outstanding label="Missing job cards" count={preview.outstanding.missingJobCards.length} icon={<Receipt className="w-4 h-4" />} />
              <Outstanding label="Unreconciled expenses" count={preview.outstanding.unreconciledExpenses.length} icon={<AlertTriangle className="w-4 h-4" />} accent={preview.outstanding.unreconciledExpenses.length > 0 ? "amber" : undefined} />
            </div>

            {/* PR-8 D — attribution roll-up: how each row landed on this statement */}
            {preview.rows.length > 0 && (() => {
              const counts: Record<string, number> = { EXPLICIT: 0, DEFAULT: 0, LEGACY: 0, UNKNOWN: 0 };
              for (const r of preview.rows) {
                const b = (r as any).attributionBadge ?? "UNKNOWN";
                counts[b] = (counts[b] ?? 0) + 1;
              }
              return (
                <div className="mb-4 flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-slate-500 uppercase tracking-wide">Attribution:</span>
                  {(["EXPLICIT", "DEFAULT", "LEGACY", "UNKNOWN"] as const).map((k) => (
                    <span
                      key={k}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${ATTRIBUTION_BADGE[k].className}`}
                      title={ATTRIBUTION_BADGE[k].hint}
                    >
                      <span className="font-semibold">{ATTRIBUTION_BADGE[k].label}</span>
                      <span className="tabular-nums">{counts[k]}</span>
                    </span>
                  ))}
                  {(counts.LEGACY > 0 || counts.UNKNOWN > 0) && (
                    <span className="text-amber-700 text-[11px] ml-1">
                      ← rows without a strong attribution trail; verify before locking
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Statement table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCircle2 className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-semibold text-slate-700">{preview.userName}</span>
                  <span className="text-xs text-slate-500">·</span>
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-sm text-slate-700">{preview.periodLabel}</span>
                  <span className="text-xs text-slate-500">·</span>
                  <span className="text-xs text-slate-600">Rate: {rateSummary(preview.rate)}</span>
                  {preview.rate.ruleId == null && <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">default — no rule set</span>}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="text-left px-2 py-2 w-8"></th>
                      <th className="text-left px-3 py-2">#</th>
                      <th className="text-left px-3 py-2">Order / Docs</th>
                      <th className="text-left px-3 py-2">Customer / description</th>
                      <th className="text-left px-3 py-2">Status</th>
                      <th className="text-right px-3 py-2">Quoted (excl)</th>
                      <th className="text-right px-3 py-2">Invoiced (excl)</th>
                      <th className="text-right px-3 py-2">Invoiced (incl)</th>
                      <th className="text-right px-3 py-2">Sales slice</th>
                      <th className="text-right px-3 py-2">Expenses (excl)</th>
                      <th className="text-right px-3 py-2" title="Labour cost recorded on the order (Order.labourCost). Included in Expenses.">Labour (excl)</th>
                      <th className="text-right px-3 py-2">Base</th>
                      <th className="text-right px-3 py-2">TM share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.rows.length === 0 && (
                      <tr>
                        <td colSpan={13} className="px-3 py-8 text-center text-slate-400 italic">No jobs for this TM in {preview.periodLabel}</td>
                      </tr>
                    )}
                    {preview.rows.map((r, idx) => {
                      const isExpanded = expandedOrderIds.has(r.orderId);
                      return (
                      <Fragment key={r.orderId}>
                      <tr className={r.commissionExcluded ? "bg-amber-50/40" : ""}>
                        <td className="px-2 py-2">
                          <button
                            onClick={() => toggleExpanded(r.orderId)}
                            className="text-slate-400 hover:text-slate-700 p-0.5 rounded hover:bg-slate-100"
                            title={isExpanded ? "Hide audit detail" : "Show audit detail (costs, slips, timeline)"}
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-slate-400">{idx}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Link to={"/admin/operations" as any} className="text-indigo-600 hover:underline font-medium">{r.orderNumber}</Link>
                            <AttributionBadge
                              badge={(r as any).attributionBadge}
                              source={(r as any).attributionSource}
                              actorName={(r as any).attributionActorName}
                              at={(r as any).attributionAt}
                            />
                          </div>
                          <div className="mt-1 flex flex-col gap-0.5 text-[11px]">
                            {(r as any).invoiceId != null ? (
                              <Link
                                to={"/admin/invoices" as any}
                                search={{ invoiceId: (r as any).invoiceId } as any}
                                className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
                                title="Open this invoice"
                              >
                                <Receipt className="w-3 h-3" />
                                {r.invoiceNumber ?? `INV #${(r as any).invoiceId}`}
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            ) : (
                              <span className="text-slate-400 inline-flex items-center gap-1">
                                <Receipt className="w-3 h-3" /> No invoice
                              </span>
                            )}
                            {(r as any).quotationId != null ? (
                              <Link
                                to={"/admin/quotations" as any}
                                className="inline-flex items-center gap-1 text-violet-700 hover:underline"
                                title="Open source quotation"
                              >
                                <FileText className="w-3 h-3" />
                                {(r as any).quoteNumber ?? `QUO #${(r as any).quotationId}`}
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-slate-900">{r.customerName}</div>
                          <div className="text-xs text-slate-500 truncate max-w-[420px]">{r.description}</div>
                          {r.commissionExcluded && (
                            <div className="text-[11px] text-amber-700 mt-0.5">Excluded: {r.commissionExclusionReason ?? "—"}</div>
                          )}
                          {r.salesAgentAmount > 0 && (
                            <div className="text-[11px] text-slate-500 mt-0.5">Sales agent slice: {r.salesAgentName} {ZAR(r.salesAgentAmount)}</div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <StatusPill orderStatus={r.status} invoiceStatus={r.invoiceStatus} />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{ZAR(r.quotedExclVat)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.invoicedExclVat > 0 ? ZAR(r.invoicedExclVat) : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.invoicedInclVat > 0 ? ZAR(r.invoicedInclVat) : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-500">{r.salesAgentAmount > 0 ? `-${ZAR(r.salesAgentAmount)}` : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{ZAR(r.expensesExclVat)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600" title="Labour slice within Expenses">{ZAR(r.expenseBreakdown?.labourExclVat ?? 0)}</td>
                        <td className={`px-3 py-2 text-right tabular-nums font-medium ${r.commissionBase < 0 ? "text-rose-600" : "text-slate-900"}`}>{ZAR(r.commissionBase)}</td>
                        <td className={`px-3 py-2 text-right tabular-nums font-semibold ${r.commissionAmount < 0 ? "text-rose-600" : r.commissionAmount > 0 ? "text-emerald-700" : "text-slate-400"}`}>{ZAR(r.commissionAmount)}</td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${r.orderId}-detail`} className="bg-slate-50/60">
                          <td colSpan={13} className="px-4 py-4">
                            <OrderAuditPanel orderId={r.orderId} token={token!} />
                          </td>
                        </tr>
                      )}
                      </Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 font-semibold">
                    <tr>
                      <td colSpan={5} className="px-3 py-3 text-right text-slate-600 uppercase text-xs tracking-wide">Totals</td>
                      <td className="px-3 py-3 text-right tabular-nums">{ZAR(preview.totals.totalQuoted)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{ZAR(preview.rows.reduce((s, r) => s + (r.invoicedExclVat ?? 0), 0))}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{ZAR(preview.rows.reduce((s, r) => s + (r.invoicedInclVat ?? 0), 0))}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-500">{ZAR(preview.totals.totalSalesSlice)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{ZAR(preview.totals.totalExpenses)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-600">{ZAR(preview.rows.reduce((s, r) => s + (r.expenseBreakdown?.labourExclVat ?? 0), 0))}</td>
                      <td className={`px-3 py-3 text-right tabular-nums ${preview.totals.totalBase < 0 ? "text-rose-600" : "text-slate-900"}`}>{ZAR(preview.totals.totalBase)}</td>
                      <td className={`px-3 py-3 text-right tabular-nums ${preview.totals.totalCommission < 0 ? "text-rose-600" : "text-emerald-700"}`}>{ZAR(preview.totals.totalCommission)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Outstanding details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <OutstandingList title="Missing client PO" rows={preview.outstanding.missingClientOrders.map((o) => ({ left: o.orderNumber, mid: o.customerName, right: o.completedAt ? new Date(o.completedAt).toISOString().slice(0, 10) : "" }))} empty="All client POs collected ✨" />
              <OutstandingList title="Missing invoices" rows={preview.outstanding.missingInvoices.map((o) => ({ left: o.orderNumber, mid: o.customerName, right: ZAR(o.total) }))} empty="All jobs invoiced ✨" />
              <OutstandingList title="Missing signed job cards" rows={preview.outstanding.missingJobCards.map((o) => ({ left: o.orderNumber, mid: o.customerName, right: o.completedAt ? new Date(o.completedAt).toISOString().slice(0, 10) : "" }))} empty="All job cards signed ✨" />
              <OutstandingList title="Unreconciled expenses" rows={preview.outstanding.unreconciledExpenses.map((e) => ({ left: e.orderNumber, mid: `${e.supplier ?? "—"} · ${ZAR(e.amount)}`, right: e.state }))} empty="All expenses reconciled ✨" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: "emerald" | "amber" | "rose" }) {
  const cls =
    accent === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-900" :
    accent === "amber" ? "border-amber-200 bg-amber-50 text-amber-900" :
    accent === "rose" ? "border-rose-200 bg-rose-50 text-rose-900" :
    "border-slate-200 bg-white text-slate-900";
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
    </div>
  );
}

function Outstanding({ label, count, icon, accent }: { label: string; count: number; icon: React.ReactNode; accent?: "amber" }) {
  const cls = accent === "amber" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white";
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-600">{icon}{label}</div>
      <div className="text-2xl font-bold tabular-nums mt-1">{count}</div>
    </div>
  );
}

function OutstandingList({ title, rows, empty }: { title: string; rows: Array<{ left: string; mid: string; right: string }>; empty: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">{title}</div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-slate-400 italic">{empty}</div>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm max-h-64 overflow-y-auto">
          {rows.map((r, i) => (
            <li key={i} className="px-4 py-2 flex items-center gap-3">
              <span className="font-mono text-xs text-indigo-600 w-20 shrink-0">{r.left}</span>
              <span className="flex-1 text-slate-700 truncate">{r.mid}</span>
              <span className="text-xs text-slate-500 tabular-nums">{r.right}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusPill({ orderStatus, invoiceStatus }: { orderStatus: string; invoiceStatus: string | null }) {
  // Prefer invoice status when the job is done and invoicing has begun.
  const paid = invoiceStatus === "PAID";
  const invoiced = invoiceStatus && invoiceStatus !== "DRAFT" && invoiceStatus !== "REJECTED" && invoiceStatus !== "PAID";
  const draft = invoiceStatus === "DRAFT";
  const rejected = invoiceStatus === "REJECTED";
  const orderDone = orderStatus === "COMPLETED";

  let label: string;
  let cls: string;
  if (paid) { label = "Paid"; cls = "bg-emerald-100 text-emerald-800 border-emerald-200"; }
  else if (invoiced) { label = invoiceStatus === "SENT" ? "Invoiced" : (invoiceStatus === "OVERDUE" ? "Overdue" : invoiceStatus === "PARTIAL" ? "Partial" : String(invoiceStatus).replace(/_/g, " ")); cls = invoiceStatus === "OVERDUE" ? "bg-rose-100 text-rose-800 border-rose-200" : "bg-sky-100 text-sky-800 border-sky-200"; }
  else if (rejected) { label = "Invoice rejected"; cls = "bg-rose-100 text-rose-800 border-rose-200"; }
  else if (draft) { label = "Draft invoice"; cls = "bg-slate-100 text-slate-700 border-slate-200"; }
  else if (orderDone) { label = "Completed"; cls = "bg-slate-100 text-slate-700 border-slate-200"; }
  else { label = String(orderStatus).replace(/_/g, " "); cls = "bg-amber-100 text-amber-800 border-amber-200"; }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap ${cls}`}>{label}</span>
  );
}

// PR-8M — Per-order audit drill-down panel.
// Renders when a row on the TM statement is expanded. Shows:
//  - Personnel: assigned artisan, TM, site lead, ops manager, sales agent
//  - Timeline: created / assigned-artisan / started / completed / month-locked
//  - Cost breakdown: budgets vs actuals for materials + labour + call-out
//  - Every expense slip loaded by the artisan (supplier, amount, state, receipt link)
//  - Materials line items
//  - Financial adjustments (reconciliations, credits, warranty holdbacks)
//  - Deep links to the linked quotation and invoice for edit/audit
function OrderAuditPanel({ orderId, token }: { orderId: number; token: string }) {
  const trpc = useTRPC();
  const detailQuery = useQuery(
    trpc.adminTmStatementRowDetail.queryOptions({ token, orderId }),
  );

  if (detailQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading audit detail…
      </div>
    );
  }
  if (detailQuery.error) {
    return (
      <div className="text-rose-700 text-sm py-4 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" /> {detailQuery.error.message}
      </div>
    );
  }
  const d = detailQuery.data;
  if (!d) return null;

  const fullName = (u: any) => (u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : "—");
  const fmtDate = (dt: string | Date | null | undefined) =>
    dt ? new Date(dt).toLocaleString("en-ZA", { dateStyle: "short", timeStyle: "short" }) : "—";
  const fmtDay = (dt: string | Date | null | undefined) =>
    dt ? new Date(dt).toLocaleDateString("en-ZA") : "—";

  const slipsTotalIncl = d.expenseSlips.reduce((s: number, x: any) => s + (x.amount ?? 0), 0);
  const slipsTotalExcl = d.expenseSlips.reduce(
    (s: number, x: any) => s + (x.amountExclVat ?? (x.amount ?? 0) / (1 + (x.vatRate ?? 0))),
    0,
  );
  const adjustmentsTotal = d.financialAdjustments.reduce((s: number, x: any) => s + (x.amount ?? 0), 0);

  // Labour breakdown: prefer snapshotted JSON at completion, else derive from crew rows.
  type LabourRow = { name: string; role: string; rateLabel: string; unitsLabel: string; total: number; source: string };
  const labourRows: LabourRow[] = [];
  const breakdownJson = Array.isArray(d.labourBreakdown) ? (d.labourBreakdown as any[]) : [];
  if (breakdownJson.length > 0) {
    for (const b of breakdownJson) {
      const minutes = Number(b.minutes ?? 0);
      const hourly = Number(b.hourlyRate ?? 0);
      const daily = Number(b.dailyRate ?? 0);
      const total = Number(b.total ?? 0);
      const rateLabel = hourly ? `R${hourly}/h` : daily ? `R${daily}/d` : "\u2014";
      const unitsLabel = minutes ? `${(minutes / 60).toFixed(2)} h` : "\u2014";
      labourRows.push({
        name: String(b.name ?? "\u2014"),
        role: String(b.role ?? "CREW"),
        rateLabel,
        unitsLabel,
        total,
        source: "snapshot",
      });
    }
  } else if (d.crew && d.crew.length > 0) {
    // Fallback while job still open — show crew with joined/left times.
    for (const c of d.crew) {
      const rateLabel = c.hourlyRate ? `R${c.hourlyRate}/h` : c.dailyRate ? `R${c.dailyRate}/d` : "\u2014";
      const mins = c.joinedAt
        ? ((c.leftAt ? new Date(c.leftAt).getTime() : Date.now()) - new Date(c.joinedAt).getTime()) / 60000
        : 0;
      const est = c.hourlyRate ? (mins / 60) * c.hourlyRate : c.dailyRate ? (mins / (60 * 8)) * c.dailyRate : 0;
      labourRows.push({
        name: `${c.user?.firstName ?? ""} ${c.user?.lastName ?? ""}`.trim() || "\u2014",
        role: c.role,
        rateLabel,
        unitsLabel: mins ? `${(mins / 60).toFixed(2)} h${c.leftAt ? "" : " (running)"}` : "\u2014",
        total: est,
        source: "live",
      });
    }
  }
  const labourRowsTotal = labourRows.reduce((s, r) => s + r.total, 0);

  // Management time entries (TM / SiteLead / OpsManager) not always in crew.
  const mgmtTime: Array<{ label: string; who: string; hours: number | null; days: number | null }> = [];
  if (d.technicalManager && (d.tmHoursWorked || d.tmDaysWorked)) {
    mgmtTime.push({ label: "Technical Manager", who: `${d.technicalManager.firstName ?? ""} ${d.technicalManager.lastName ?? ""}`.trim(), hours: d.tmHoursWorked, days: d.tmDaysWorked });
  }
  if (d.siteLead && (d.siteLeadHoursWorked || d.siteLeadDaysWorked)) {
    mgmtTime.push({ label: "Site Lead", who: `${d.siteLead.firstName ?? ""} ${d.siteLead.lastName ?? ""}`.trim(), hours: d.siteLeadHoursWorked, days: d.siteLeadDaysWorked });
  }
  if (d.opsManager && (d.opsManagerHoursWorked || d.opsManagerDaysWorked)) {
    mgmtTime.push({ label: "Ops Manager", who: `${d.opsManager.firstName ?? ""} ${d.opsManager.lastName ?? ""}`.trim(), hours: d.opsManagerHoursWorked, days: d.opsManagerDaysWorked });
  }

  const paymentRequestsTotal = (d.paymentRequests ?? []).reduce((s: number, x: any) => s + (x.calculatedAmount ?? 0), 0);

  // Budget vs Actual math
  const matBudget = d.totalMaterialBudget ?? 0;
  const matActual = Math.max(d.materialCost ?? 0, slipsTotalExcl); // slips excl VAT ~= what should have posted to materialCost
  const matVariance = matBudget ? matActual - matBudget : null;
  const labBudget = d.totalLabourCostBudget ?? 0;
  const labActual = Math.max(d.labourCost ?? 0, labourRowsTotal, paymentRequestsTotal);
  const labVariance = labBudget ? labActual - labBudget : null;

  const pctOfBudget = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

  return (
    <div className="space-y-4">
      {/* Header row — deep links + quick actions */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Link
          to={"/admin/operations" as any}
          className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded border border-indigo-200"
          title="Open the order in operations to edit/audit"
        >
          <ExternalLink className="w-3 h-3" /> Open order in Operations
        </Link>
        {d.invoice?.id && (
          <Link
            to={"/admin/invoices" as any}
            search={{ invoiceId: d.invoice.id } as any}
            className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded border border-emerald-200"
          >
            <Receipt className="w-3 h-3" /> Invoice {d.invoice.invoiceNumber ?? `#${d.invoice.id}`} · {d.invoice.status}
          </Link>
        )}
        {d.quotation?.id && (
          <Link
            to={"/admin/quotations" as any}
            className="inline-flex items-center gap-1 px-2 py-1 bg-violet-50 text-violet-700 hover:bg-violet-100 rounded border border-violet-200"
          >
            <FileText className="w-3 h-3" /> Quote {d.quotation.quoteNumber} · {d.quotation.status}
          </Link>
        )}
        {d.signedJobCardUrl && (
          <a
            href={d.signedJobCardUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded border border-sky-200"
          >
            <ClipboardCheck className="w-3 h-3" /> Signed job card
          </a>
        )}
        {d.clientOrderNumber && (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 text-slate-700 rounded border border-slate-200">
            Client PO: <span className="font-semibold">{d.clientOrderNumber}</span>
          </span>
        )}
        <span className="ml-auto text-slate-400">Order #{d.id} · {d.serviceType}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Personnel */}
        <div className="bg-white rounded-lg border border-slate-200 p-3">
          <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> Personnel
          </div>
          <dl className="text-xs space-y-1">
            <div className="flex justify-between gap-2"><dt className="text-slate-500">Assigned artisan</dt><dd className="text-slate-900 text-right">{fullName(d.assignedTo)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-500">Technical Manager</dt><dd className="text-slate-900 text-right">{fullName(d.technicalManager)}</dd></div>
            {d.siteLead && <div className="flex justify-between gap-2"><dt className="text-slate-500">Site Lead</dt><dd className="text-slate-900 text-right">{fullName(d.siteLead)}</dd></div>}
            {d.opsManager && <div className="flex justify-between gap-2"><dt className="text-slate-500">Ops Manager</dt><dd className="text-slate-900 text-right">{fullName(d.opsManager)}</dd></div>}
            {d.salesAgent && <div className="flex justify-between gap-2"><dt className="text-slate-500">Sales Agent</dt><dd className="text-slate-900 text-right">{fullName(d.salesAgent)}</dd></div>}
            {d.crew && d.crew.length > 0 && (
              <div className="pt-1 mt-1 border-t border-slate-100">
                <div className="text-slate-500 mb-0.5">Crew ({d.crew.length})</div>
                <ul className="space-y-0.5">
                  {d.crew.map((c: any) => (
                    <li key={c.id} className="flex justify-between gap-2">
                      <span className="text-slate-700">{fullName(c.user)}</span>
                      <span className="text-slate-500">{c.role}{c.leftAt ? " (left)" : ""}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </dl>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-lg border border-slate-200 p-3">
          <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Timeline
          </div>
          <dl className="text-xs space-y-1">
            <div className="flex justify-between gap-2"><dt className="text-slate-500">Created</dt><dd className="text-slate-900">{fmtDate(d.createdAt)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-500">Started</dt><dd className="text-slate-900">{fmtDate(d.startTime)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-500">Completed</dt><dd className="text-slate-900">{fmtDate(d.endTime)}</dd></div>
            {d.pausedAt && <div className="flex justify-between gap-2"><dt className="text-slate-500">Paused</dt><dd className="text-amber-700">{fmtDate(d.pausedAt)}</dd></div>}
            <div className="flex justify-between gap-2"><dt className="text-slate-500">Last update</dt><dd className="text-slate-900">{fmtDate(d.updatedAt)}</dd></div>
            {d.monthLockedAt && <div className="flex justify-between gap-2"><dt className="text-slate-500">Month locked</dt><dd className="text-emerald-700">{fmtDate(d.monthLockedAt)}</dd></div>}
            {d.clientRepSignDate && <div className="flex justify-between gap-2"><dt className="text-slate-500">Client rep signed</dt><dd className="text-slate-900">{fmtDay(d.clientRepSignDate)} — {d.clientRepName ?? "—"}</dd></div>}
          </dl>
        </div>

        {/* Cost breakdown */}
        <div className="bg-white rounded-lg border border-slate-200 p-3">
          <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5" /> Cost breakdown
          </div>
          <dl className="text-xs space-y-1">
            <div className="flex justify-between gap-2"><dt className="text-slate-500">Materials (Order.materialCost)</dt><dd className="tabular-nums">{ZAR(d.materialCost ?? 0)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-500">Labour (Order.labourCost)</dt><dd className="tabular-nums">{ZAR(d.labourCost ?? 0)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-500">Call-out fee</dt><dd className="tabular-nums">{ZAR(d.callOutFee ?? 0)}</dd></div>
            <div className="flex justify-between gap-2 pt-1 mt-1 border-t border-slate-100"><dt className="text-slate-500">Expense slips (incl VAT)</dt><dd className="tabular-nums">{ZAR(slipsTotalIncl)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-500">Expense slips (excl VAT)</dt><dd className="tabular-nums text-slate-600">{ZAR(slipsTotalExcl)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-500">Payment requests (labour)</dt><dd className="tabular-nums text-slate-600">{ZAR(paymentRequestsTotal)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-500">Adjustments (excl VAT)</dt><dd className={`tabular-nums ${adjustmentsTotal < 0 ? "text-emerald-700" : "text-rose-700"}`}>{ZAR(adjustmentsTotal)}</dd></div>
            {d.labourRate != null && <div className="flex justify-between gap-2 pt-1 mt-1 border-t border-slate-100"><dt className="text-slate-500">Quoted labour rate</dt><dd className="tabular-nums text-slate-500">R{d.labourRate}/h</dd></div>}
            {d.numLabourersNeeded != null && <div className="flex justify-between gap-2"><dt className="text-slate-500">Labourers needed</dt><dd className="tabular-nums text-slate-500">{d.numLabourersNeeded}</dd></div>}
          </dl>
        </div>
      </div>

      {/* Budget vs Actual — headline comparison for materials + labour */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1">
          <DollarSign className="w-3.5 h-3.5" /> Budget vs Actual
        </div>
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50/60 text-slate-500 uppercase text-[10px]">
            <tr>
              <th className="text-left px-3 py-1.5">Category</th>
              <th className="text-right px-3 py-1.5">Budget (excl VAT)</th>
              <th className="text-right px-3 py-1.5">Actual (excl VAT)</th>
              <th className="text-right px-3 py-1.5">Variance</th>
              <th className="text-right px-3 py-1.5">% of budget</th>
              <th className="text-left px-3 py-1.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="px-3 py-1.5 font-medium text-slate-800">Materials</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{d.totalMaterialBudget != null ? ZAR(d.totalMaterialBudget) : <span className="text-slate-400">—</span>}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{ZAR(matActual)}</td>
              <td className={`px-3 py-1.5 text-right tabular-nums ${matVariance == null ? "text-slate-400" : matVariance > 0 ? "text-rose-700" : "text-emerald-700"}`}>{matVariance == null ? "—" : `${matVariance > 0 ? "+" : ""}${ZAR(matVariance)}`}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{matBudget > 0 ? `${pctOfBudget(matActual, matBudget).toFixed(0)}%` : "—"}</td>
              <td className="px-3 py-1.5">
                {matBudget <= 0 ? <span className="text-slate-400">No budget set</span> : matActual > matBudget ? <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800">Over budget</span> : matActual > matBudget * 0.9 ? <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">Near limit</span> : <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">On track</span>}
              </td>
            </tr>
            <tr>
              <td className="px-3 py-1.5 font-medium text-slate-800">Labour</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{d.totalLabourCostBudget != null ? ZAR(d.totalLabourCostBudget) : <span className="text-slate-400">—</span>}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{ZAR(labActual)}</td>
              <td className={`px-3 py-1.5 text-right tabular-nums ${labVariance == null ? "text-slate-400" : labVariance > 0 ? "text-rose-700" : "text-emerald-700"}`}>{labVariance == null ? "—" : `${labVariance > 0 ? "+" : ""}${ZAR(labVariance)}`}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{labBudget > 0 ? `${pctOfBudget(labActual, labBudget).toFixed(0)}%` : "—"}</td>
              <td className="px-3 py-1.5">
                {labBudget <= 0 ? <span className="text-slate-400">No budget set</span> : labActual > labBudget ? <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800">Over budget</span> : labActual > labBudget * 0.9 ? <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">Near limit</span> : <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">On track</span>}
              </td>
            </tr>
            <tr className="bg-slate-50/40">
              <td className="px-3 py-1.5 font-semibold text-slate-900">Total</td>
              <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{ZAR(matBudget + labBudget)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{ZAR(matActual + labActual)}</td>
              <td className={`px-3 py-1.5 text-right tabular-nums font-semibold ${(matActual + labActual) - (matBudget + labBudget) > 0 ? "text-rose-700" : "text-emerald-700"}`}>{`${(matActual + labActual) - (matBudget + labBudget) > 0 ? "+" : ""}${ZAR((matActual + labActual) - (matBudget + labBudget))}`}</td>
              <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{(matBudget + labBudget) > 0 ? `${pctOfBudget(matActual + labActual, matBudget + labBudget).toFixed(0)}%` : "—"}</td>
              <td className="px-3 py-1.5"></td>
            </tr>
          </tbody>
        </table>
        <div className="px-3 py-2 text-[10px] text-slate-500 border-t border-slate-100">
          Material actual = greater of <span className="font-mono">Order.materialCost</span> and expense slips (excl VAT). Labour actual = greatest of <span className="font-mono">Order.labourCost</span>, snapshot labour breakdown, and approved payment requests.
        </div>
      </div>

      {/* Labour breakdown — who worked, at what rate, how long, how much */}
      {(labourRows.length > 0 || mgmtTime.length > 0 || (d.paymentRequests ?? []).length > 0) && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center justify-between">
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Labour breakdown</span>
            <span className="text-slate-500 normal-case">Total labour computed: <span className="font-semibold text-slate-900">{ZAR(labourRowsTotal)}</span></span>
          </div>

          {labourRows.length > 0 && (
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50/60 text-slate-500 uppercase text-[10px]">
                <tr>
                  <th className="text-left px-3 py-1.5">Crew member</th>
                  <th className="text-left px-3 py-1.5">Role</th>
                  <th className="text-left px-3 py-1.5">Rate</th>
                  <th className="text-right px-3 py-1.5">Time worked</th>
                  <th className="text-right px-3 py-1.5">Amount</th>
                  <th className="text-left px-3 py-1.5">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {labourRows.map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 text-slate-900">{r.name}</td>
                    <td className="px-3 py-1.5 text-slate-700">{r.role}</td>
                    <td className="px-3 py-1.5 text-slate-700">{r.rateLabel}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.unitsLabel}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-medium">{ZAR(r.total)}</td>
                    <td className="px-3 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${r.source === "snapshot" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{r.source === "snapshot" ? "Snapshot at completion" : "Live (job in progress)"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50/60">
                  <td colSpan={4} className="px-3 py-1.5 text-right text-slate-500 uppercase text-[10px] font-semibold">Total</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{ZAR(labourRowsTotal)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}

          {mgmtTime.length > 0 && (
            <div className="border-t border-slate-100">
              <div className="px-3 py-1.5 bg-slate-50/60 text-[10px] text-slate-500 uppercase font-semibold">Management time on job</div>
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50/40 text-slate-500 uppercase text-[10px]">
                  <tr>
                    <th className="text-left px-3 py-1.5">Role</th>
                    <th className="text-left px-3 py-1.5">Person</th>
                    <th className="text-right px-3 py-1.5">Hours</th>
                    <th className="text-right px-3 py-1.5">Days</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mgmtTime.map((m, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 text-slate-700">{m.label}</td>
                      <td className="px-3 py-1.5 text-slate-900">{m.who}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{m.hours ?? "—"}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{m.days ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(d.paymentRequests ?? []).length > 0 && (
            <div className="border-t border-slate-100">
              <div className="px-3 py-1.5 bg-slate-50/60 text-[10px] text-slate-500 uppercase font-semibold flex items-center justify-between">
                <span>Artisan payment requests referencing this order ({d.paymentRequests.length})</span>
                <span className="normal-case">Total: <span className="font-semibold text-slate-900">{ZAR(paymentRequestsTotal)}</span></span>
              </div>
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50/40 text-slate-500 uppercase text-[10px]">
                  <tr>
                    <th className="text-left px-3 py-1.5">Request #</th>
                    <th className="text-left px-3 py-1.5">Date</th>
                    <th className="text-left px-3 py-1.5">Artisan</th>
                    <th className="text-left px-3 py-1.5">Rate</th>
                    <th className="text-right px-3 py-1.5">Hours</th>
                    <th className="text-right px-3 py-1.5">Days</th>
                    <th className="text-right px-3 py-1.5">Amount</th>
                    <th className="text-left px-3 py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {d.paymentRequests.map((p: any) => (
                    <tr key={p.id}>
                      <td className="px-3 py-1.5 font-mono text-slate-700">{p.requestNumber}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{fmtDay(p.createdAt)}</td>
                      <td className="px-3 py-1.5 text-slate-900">{fullName(p.artisan)}</td>
                      <td className="px-3 py-1.5 text-slate-700">{p.hourlyRate ? `R${p.hourlyRate}/h` : p.dailyRate ? `R${p.dailyRate}/d` : "—"}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{p.hoursWorked ?? "—"}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{p.daysWorked ?? "—"}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-medium">{ZAR(p.calculatedAmount ?? 0)}</td>
                      <td className="px-3 py-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          p.status === "PAID" ? "bg-emerald-100 text-emerald-800"
                            : p.status === "APPROVED" ? "bg-sky-100 text-sky-800"
                            : p.status === "REJECTED" ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Materials */}
      {d.materials && d.materials.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wide">Materials ({d.materials.length})</div>
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50/60 text-slate-500 uppercase text-[10px]">
              <tr>
                <th className="text-left px-3 py-1.5">Name</th>
                <th className="text-left px-3 py-1.5">Supplier</th>
                <th className="text-right px-3 py-1.5">Qty</th>
                <th className="text-right px-3 py-1.5">Unit</th>
                <th className="text-right px-3 py-1.5">Total</th>
                <th className="text-left px-3 py-1.5">Supplier quote</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.materials.map((m: any) => (
                <tr key={m.id}>
                  <td className="px-3 py-1.5">
                    <div className="text-slate-900">{m.name}</div>
                    {m.description && <div className="text-slate-500 text-[11px]">{m.description}</div>}
                  </td>
                  <td className="px-3 py-1.5 text-slate-700">{m.supplier ?? "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{m.quantity}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{ZAR(m.unitPrice ?? 0)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-medium">{ZAR(m.totalCost ?? 0)}</td>
                  <td className="px-3 py-1.5">
                    {m.supplierQuotationUrl ? (
                      <SignedMinioLink url={m.supplierQuotationUrl} className="inline-flex items-center gap-1 text-indigo-600 hover:underline">
                        <Paperclip className="w-3 h-3" /> View {m.supplierQuotationAmount ? `(${ZAR(m.supplierQuotationAmount)})` : ""}
                      </SignedMinioLink>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Expense slips (loaded by artisan) */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center justify-between">
          <span>Expense slips loaded by artisan ({d.expenseSlips.length})</span>
          <span className="text-slate-500 normal-case">Total (incl VAT): <span className="font-semibold text-slate-900">{ZAR(slipsTotalIncl)}</span></span>
        </div>
        {d.expenseSlips.length === 0 ? (
          <div className="px-3 py-4 text-xs text-slate-400 italic">No expense slips submitted.</div>
        ) : (
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50/60 text-slate-500 uppercase text-[10px]">
              <tr>
                <th className="text-left px-3 py-1.5">Date</th>
                <th className="text-left px-3 py-1.5">Supplier</th>
                <th className="text-left px-3 py-1.5">Category</th>
                <th className="text-left px-3 py-1.5">Description</th>
                <th className="text-left px-3 py-1.5">Payment</th>
                <th className="text-right px-3 py-1.5">Amount (incl)</th>
                <th className="text-right px-3 py-1.5">Excl VAT</th>
                <th className="text-left px-3 py-1.5">State</th>
                <th className="text-left px-3 py-1.5">Submitted by</th>
                <th className="text-left px-3 py-1.5">Slip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.expenseSlips.map((s: any) => (
                <tr key={s.id}>
                  <td className="px-3 py-1.5 whitespace-nowrap">{fmtDay(s.purchasedAt ?? s.createdAt)}</td>
                  <td className="px-3 py-1.5">{s.supplierName ?? "—"}</td>
                  <td className="px-3 py-1.5 text-slate-600">{s.category}</td>
                  <td className="px-3 py-1.5 text-slate-700 max-w-[280px] truncate" title={s.description ?? ""}>{s.description ?? "—"}</td>
                  <td className="px-3 py-1.5 text-slate-600">{s.paymentMethod ?? "—"}{s.cardLast4 ? ` •••${s.cardLast4}` : ""}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{ZAR(s.amount ?? 0)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{s.amountExclVat != null ? ZAR(s.amountExclVat) : "—"}</td>
                  <td className="px-3 py-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      s.state === "APPROVED" || s.state === "POSTED" ? "bg-emerald-100 text-emerald-800"
                        : s.state === "DISPUTED" ? "bg-rose-100 text-rose-800"
                        : s.state === "REJECTED" ? "bg-rose-100 text-rose-800"
                        : "bg-amber-100 text-amber-800"
                    }`}>{s.state}</span>
                    {s.disputedReason && <div className="text-[10px] text-rose-700 mt-0.5">{s.disputedReason}</div>}
                  </td>
                  <td className="px-3 py-1.5 text-slate-700">{fullName(s.submittedBy)}</td>
                  <td className="px-3 py-1.5">
                    {s.url ? (
                      <SignedMinioLink url={s.url} className="inline-flex items-center gap-1 text-indigo-600 hover:underline">
                        <Paperclip className="w-3 h-3" /> View
                      </SignedMinioLink>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Financial adjustments */}
      {d.financialAdjustments && d.financialAdjustments.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wide">
            Financial adjustments ({d.financialAdjustments.length})
          </div>
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50/60 text-slate-500 uppercase text-[10px]">
              <tr>
                <th className="text-left px-3 py-1.5">Date</th>
                <th className="text-left px-3 py-1.5">Kind</th>
                <th className="text-left px-3 py-1.5">Notes</th>
                <th className="text-right px-3 py-1.5">Amount (excl)</th>
                <th className="text-left px-3 py-1.5">Created by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.financialAdjustments.map((a: any) => (
                <tr key={a.id}>
                  <td className="px-3 py-1.5 whitespace-nowrap">{fmtDay(a.createdAt)}</td>
                  <td className="px-3 py-1.5 text-slate-700">{a.kind}</td>
                  <td className="px-3 py-1.5 text-slate-600">{a.notes ?? "—"}</td>
                  <td className={`px-3 py-1.5 text-right tabular-nums ${(a.amount ?? 0) < 0 ? "text-emerald-700" : "text-rose-700"}`}>{ZAR(a.amount ?? 0)}</td>
                  <td className="px-3 py-1.5 text-slate-700">{fullName(a.createdBy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
