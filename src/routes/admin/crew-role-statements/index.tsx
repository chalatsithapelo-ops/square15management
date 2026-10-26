// PR-8 F/G — Admin monthly statement viewer for Sales Agent, Site Lead, Ops Manager.
// F  = live preview (read side).
// G  = generate+lock snapshot, unlock, XLSX export, past-statements list.
// Kept separate from /admin/tm-statements on purpose — TM has richer semantics
// (commission base netting, outstanding buckets, attribution badges) and we
// don't want a bug in one path to contaminate the other.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState, useMemo } from "react";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Briefcase,
  HardHat,
  ClipboardCheck,
  Loader2,
  Calendar,
  User,
  FileText,
  Lock,
  Unlock,
  Download,
  History,
} from "lucide-react";

export const Route = createFileRoute("/admin/crew-role-statements/")({
  component: CrewRoleStatementsPage,
});

type Role = "SALES_AGENT" | "SITE_LEAD" | "OPS_MANAGER";

const ROLE_META: Record<Role, { label: string; icon: any; accent: string; ring: string; badge: string }> = {
  SALES_AGENT: {
    label: "Sales Agent",
    icon: Briefcase,
    accent: "bg-indigo-600 text-white",
    ring: "ring-indigo-500",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  SITE_LEAD: {
    label: "Site Lead",
    icon: HardHat,
    accent: "bg-orange-600 text-white",
    ring: "ring-orange-500",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
  },
  OPS_MANAGER: {
    label: "Ops Manager",
    icon: ClipboardCheck,
    accent: "bg-emerald-600 text-white",
    ring: "ring-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
};

function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", minimumFractionDigits: 2 }).format(n);
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-ZA", { day: "2-digit", month: "short" });
}

function CrewRoleStatementsPage() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const qc = useQueryClient();

  const [role, setRole] = useState<Role>("SALES_AGENT");
  const [period, setPeriod] = useState<string>(currentMonth());
  const [userId, setUserId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  if (!token) return null;

  const meta = ROLE_META[role];
  const Icon = meta.icon;

  const candidates = useQuery(
    trpc.adminRoleStatementListCandidates.queryOptions({ token, role }),
  );

  // When role changes, clear the selected user so we don't accidentally show
  // a preview for someone who has no rule for the new role.
  const currentUserStillValid = useMemo(() => {
    if (!userId) return false;
    return (candidates.data ?? []).some((u: any) => u.id === userId);
  }, [candidates.data, userId]);

  const effectiveUserId = currentUserStillValid ? userId : null;

  const preview = useQuery({
    ...trpc.adminRoleStatementPreview.queryOptions({
      token,
      role,
      userId: effectiveUserId ?? 0,
      period,
    }),
    enabled: effectiveUserId != null && !!period,
  });

  // Past statements for the selected (role, user) — includes the locked
  // snapshot for the current period, if any.
  const pastStatements = useQuery({
    ...trpc.adminRoleStatementList.queryOptions({
      token,
      role,
      userId: effectiveUserId ?? undefined,
    }),
    enabled: effectiveUserId != null,
  });

  const lockedForPeriod = useMemo(() => {
    if (!pastStatements.data) return null;
    const monthIso = `${period}-01`;
    return (
      (pastStatements.data as any[]).find(
        (s) =>
          s.role === role &&
          s.userId === effectiveUserId &&
          s.periodMonth?.slice(0, 10) === monthIso &&
          s.lockedAt != null,
      ) ?? null
    );
  }, [pastStatements.data, role, effectiveUserId, period]);

  const generateAndLock = useMutation(
    trpc.adminRoleStatementGenerateAndLock.mutationOptions({
      onSuccess: (res: any) => {
        toast.success(`Locked ${res.jobCount} orders`);
        qc.invalidateQueries();
      },
      onError: (e: any) => toast.error(e?.message ?? "Failed to lock"),
    }),
  );

  const unlock = useMutation(
    trpc.adminRoleStatementUnlock.mutationOptions({
      onSuccess: (res: any) => {
        toast.success(`Unlocked (${res.unlockedOrders} orders released)`);
        qc.invalidateQueries();
      },
      onError: (e: any) => toast.error(e?.message ?? "Failed to unlock"),
    }),
  );

  async function handleExport(useLockedSnapshot: boolean) {
    if (!effectiveUserId) return;
    setExporting(true);
    try {
      const res: any = await qc.fetchQuery(
        trpc.adminRoleStatementExportXlsx.queryOptions({
          token: token!,
          role,
          userId: effectiveUserId,
          period,
          useLockedSnapshot,
        }),
      );
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: res.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Link
              to="/admin/dashboard"
              className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Icon className={`w-6 h-6 ${
                role === "SALES_AGENT" ? "text-indigo-600" :
                role === "SITE_LEAD" ? "text-orange-600" : "text-emerald-600"
              }`} />
              Crew Role Statements
            </h1>
          </div>
          <Link
            to="/admin/tm-statements"
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            TM statements →
          </Link>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Monthly payout view for the Sales Agent, Site Lead, and Ops Manager roles.
          Rows come from orders whose completion date falls in the selected month AND
          where the user is set on the order's dedicated role column.
        </p>

        {/* Role selector */}
        <div className="bg-white border rounded-lg p-4 mb-4">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ROLE_META) as Role[]).map((r) => {
              const m = ROLE_META[r];
              const RIcon = m.icon;
              const active = r === role;
              return (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition ${
                    active
                      ? `${m.accent} border-transparent`
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <RIcon className="w-4 h-4" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border rounded-lg p-4 mb-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-1">
              <User className="w-3.5 h-3.5" />
              {meta.label}
            </label>
            {candidates.isLoading ? (
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : (candidates.data ?? []).length === 0 ? (
              <div className={`text-xs p-2 border rounded ${meta.badge}`}>
                No users have an active CommissionRule with role "{role}". Add one via
                Admin → Commission Rules first.
              </div>
            ) : (
              <select
                value={effectiveUserId ?? ""}
                onChange={(e) => setUserId(e.target.value === "" ? null : Number(e.target.value))}
                className={`w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 ${meta.ring}`}
              >
                <option value="">— Select {meta.label} —</option>
                {(candidates.data ?? []).map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {u.openRateType === "PERCENT"
                      ? ` (${(u.openRateValue * 100).toFixed(0)}%)`
                      : u.openRateType === "HOURLY"
                      ? ` (R${u.openRateValue}/hr)`
                      : u.openRateType === "DAILY"
                      ? ` (R${u.openRateValue}/day)`
                      : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-1">
              <Calendar className="w-3.5 h-3.5" />
              Period (YYYY-MM)
            </label>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 ${meta.ring}`}
            />
          </div>
        </div>

        {/* Preview */}
        {!effectiveUserId ? (
          <div className="bg-white border rounded-lg p-8 text-center text-sm text-gray-500">
            Pick a {meta.label} above to see their statement.
          </div>
        ) : preview.isLoading ? (
          <div className="bg-white border rounded-lg p-8 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Building statement…
          </div>
        ) : preview.isError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            {preview.error?.message ?? "Failed to load statement."}
          </div>
        ) : preview.data ? (
          <>
            {/* Action bar (G) */}
            <div className="bg-white border rounded-lg p-3 mb-4 flex flex-wrap items-center gap-2">
              {lockedForPeriod ? (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200">
                  <Lock className="w-3 h-3" /> Locked{" "}
                  {new Date(lockedForPeriod.lockedAt).toLocaleDateString("en-ZA")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-50 text-gray-600 border border-gray-200">
                  <Unlock className="w-3 h-3" /> Live preview (not locked)
                </span>
              )}

              <div className="flex-1" />

              <button
                type="button"
                onClick={() => handleExport(false)}
                disabled={exporting}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Export live XLSX
              </button>

              {lockedForPeriod && (
                <button
                  type="button"
                  onClick={() => handleExport(true)}
                  disabled={exporting}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Export locked snapshot
                </button>
              )}

              {lockedForPeriod ? (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Unlock this statement? Orders will become editable again.")) {
                      unlock.mutate({ token: token!, statementId: lockedForPeriod.id });
                    }
                  }}
                  disabled={unlock.isPending}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  {unlock.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                  Unlock
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      confirm(
                        `Generate + lock ${meta.label} statement for ${period}? This will lock all ${
                          (preview.data as any)?.rows?.length ?? 0
                        } orders in the snapshot.`,
                      )
                    ) {
                      generateAndLock.mutate({
                        token: token!,
                        role,
                        userId: effectiveUserId!,
                        period,
                      });
                    }
                  }}
                  disabled={generateAndLock.isPending || (preview.data as any)?.rows?.length === 0}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded font-medium text-white disabled:opacity-50 ${
                    role === "SALES_AGENT"
                      ? "bg-indigo-600 hover:bg-indigo-700"
                      : role === "SITE_LEAD"
                      ? "bg-orange-600 hover:bg-orange-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {generateAndLock.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  Generate &amp; lock
                </button>
              )}
            </div>

            <PreviewCard payload={preview.data as any} meta={meta} />

            {/* Past statements */}
            {(pastStatements.data ?? []).length > 0 && (
              <div className="bg-white border rounded-lg mt-4">
                <div className="px-4 py-2 border-b flex items-center gap-2 text-sm font-medium text-gray-700">
                  <History className="w-4 h-4" />
                  Past statements for {(preview.data as any).userName}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left">Period</th>
                        <th className="px-3 py-2 text-left">Role</th>
                        <th className="px-3 py-2 text-right">Jobs</th>
                        <th className="px-3 py-2 text-right">Quoted</th>
                        <th className="px-3 py-2 text-right">Payout</th>
                        <th className="px-3 py-2 text-left">Locked</th>
                        <th className="px-3 py-2 text-left">By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(pastStatements.data as any[]).map((s) => (
                        <tr
                          key={s.id}
                          className={`hover:bg-gray-50 ${
                            s.periodMonth?.slice(0, 7) === period ? "bg-amber-50/30" : ""
                          }`}
                        >
                          <td className="px-3 py-2 font-mono text-gray-900">
                            {s.periodMonth?.slice(0, 7)}
                          </td>
                          <td className="px-3 py-2 text-gray-700">{s.role}</td>
                          <td className="px-3 py-2 text-right text-gray-900">{s.jobCount}</td>
                          <td className="px-3 py-2 text-right text-gray-900">
                            {fmtMoney(s.totalQuoted)}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-900">
                            {fmtMoney(s.totalAmount)}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {s.lockedAt ? (
                              <span className="inline-flex items-center gap-1 text-amber-800">
                                <Lock className="w-3 h-3" />
                                {new Date(s.lockedAt).toLocaleDateString("en-ZA")}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">
                            {s.lockedBy
                              ? `${s.lockedBy.firstName} ${s.lockedBy.lastName}`
                              : s.generatedBy
                              ? `${s.generatedBy.firstName} ${s.generatedBy.lastName}`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

function PreviewCard({ payload, meta }: { payload: any; meta: (typeof ROLE_META)[Role] }) {
  const { userName, periodLabel, rate, rows, totals, roleLabel } = payload;

  const rateSummary = (() => {
    const rt = rate?.openRateType ?? "PERCENT";
    const rv = rate?.openRateValue ?? 0;
    if (rt === "PERCENT") return `${(rv * 100).toFixed(1)}% of quoted`;
    if (rt === "HOURLY") return `R${rv.toFixed(2)}/hr`;
    if (rt === "DAILY") return `R${rv.toFixed(2)}/day`;
    return "No rule";
  })();

  return (
    <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
      {/* Header */}
      <div className={`px-4 py-3 border-b ${meta.badge}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="text-lg font-semibold">{userName}</div>
            <div className="text-xs opacity-80">
              {roleLabel} · {periodLabel} · Active rate: {rateSummary}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{fmtMoney(totals.totalAmount)}</div>
            <div className="text-xs opacity-80">Total payout · {totals.jobCount} jobs</div>
          </div>
        </div>
      </div>

      {/* Totals band */}
      <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-gray-200 bg-gray-50 border-b text-xs">
        <div className="p-3">
          <div className="text-gray-500">Jobs</div>
          <div className="font-semibold text-gray-900">{totals.jobCount}</div>
        </div>
        <div className="p-3">
          <div className="text-gray-500">Quoted (excl VAT)</div>
          <div className="font-semibold text-gray-900">{fmtMoney(totals.totalQuoted)}</div>
        </div>
        <div className="p-3">
          <div className="text-gray-500">Hours</div>
          <div className="font-semibold text-gray-900">{totals.totalHours.toFixed(1)}</div>
        </div>
        <div className="p-3">
          <div className="text-gray-500">Days</div>
          <div className="font-semibold text-gray-900">{totals.totalDays.toFixed(1)}</div>
        </div>
        <div className="p-3">
          <div className="text-gray-500">Payout</div>
          <div className="font-semibold text-gray-900">{fmtMoney(totals.totalAmount)}</div>
        </div>
      </div>

      {/* Rows */}
      {rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-500">
          No completed orders in this period.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Order</th>
                <th className="px-3 py-2 text-left">Customer</th>
                <th className="px-3 py-2 text-left">Completed</th>
                <th className="px-3 py-2 text-right">Quoted (excl)</th>
                <th className="px-3 py-2 text-right">Hrs / Days</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-left">Source</th>
                <th className="px-3 py-2 text-left">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r: any, i: number) => (
                <tr key={r.orderId} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-gray-900">{r.orderNumber}</td>
                  <td className="px-3 py-2 text-gray-700">{r.customerName || "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{fmtDate(r.completedAt)}</td>
                  <td className="px-3 py-2 text-right text-gray-900">{fmtMoney(r.quotedExclVat)}</td>
                  <td className="px-3 py-2 text-right text-gray-600 text-xs">
                    {r.hoursWorked ? `${r.hoursWorked.toFixed(1)} h` : "—"}
                    {r.hoursWorked && r.daysWorked ? " · " : ""}
                    {r.daysWorked ? `${r.daysWorked.toFixed(1)} d` : ""}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-gray-900">
                    {fmtMoney(r.amount)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs rounded border ${
                        r.amountSource === "MANUAL"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : r.amountSource === "RULE"
                          ? meta.badge
                          : "bg-gray-100 text-gray-500 border-gray-200"
                      }`}
                    >
                      {r.amountSource === "MANUAL"
                        ? "Manual"
                        : r.amountSource === "RULE"
                        ? `Rule · ${r.rateType}`
                        : "None"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.invoiceNumber ? (
                      <span className="inline-flex items-center gap-1 text-gray-700">
                        <FileText className="w-3 h-3" />
                        {r.invoiceNumber}
                      </span>
                    ) : (
                      <span className="text-amber-600">Not invoiced</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
