// PR-8 — Admin "Default TM assignments" cleanup screen.
//
// Lists every user who can own a job and shows their current
// `defaultTechnicalManagerId`. Editing this drives:
//   • The pre-selection in <TmPicker> when the artisan starts a job.
//   • The fallback used by `createOrder`, quotation conversion and the PR-8
//     backfill when an explicit TM isn't supplied.
//
// This is INTENTIONALLY a "one big table" — the whole point is to spot rows
// missing a default (or pointing at the wrong person like the Tony→Themba
// case that started this PR) at a glance.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, UserCog, AlertTriangle, Loader2, Search } from "lucide-react";

export const Route = createFileRoute("/admin/tm-defaults/")({
  component: TmDefaultsPage,
});

function TmDefaultsPage() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const qc = useQueryClient();

  if (!token || !user) return null;

  const users = useQuery(trpc.adminListUserTmDefaults.queryOptions({ token }));
  const tms = useQuery(trpc.getActiveTechnicalManagers.queryOptions({ token }));

  const setDefault = useMutation(
    trpc.adminSetUserDefaultTechnicalManager.mutationOptions({
      onSuccess: () => {
        toast.success("Default TM saved");
        qc.invalidateQueries({ queryKey: trpc.adminListUserTmDefaults.queryKey() });
      },
      onError: (e) => toast.error(e.message),
    })
  );

  const [q, setQ] = useState("");
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  const filtered = useMemo(() => {
    const rows = users.data ?? [];
    return rows.filter((r) => {
      if (showOnlyMissing && r.defaultTechnicalManagerId) return false;
      if (roleFilter !== "ALL" && r.role !== roleFilter) return false;
      if (q) {
        const s = q.toLowerCase();
        return (
          r.name.toLowerCase().includes(s) ||
          r.email.toLowerCase().includes(s) ||
          (r.defaultTechnicalManagerName ?? "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [users.data, q, showOnlyMissing, roleFilter]);

  const roles = useMemo(() => {
    const set = new Set<string>();
    for (const r of users.data ?? []) set.add(r.role);
    return ["ALL", ...Array.from(set).sort()];
  }, [users.data]);

  const missingCount = (users.data ?? []).filter((r) => !r.defaultTechnicalManagerId).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-3 mb-4">
          <Link to="/admin/dashboard" className="text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <UserCog className="w-6 h-6 text-indigo-600" />
              Default TM Assignments
            </h1>
            <p className="text-sm text-slate-600">
              Set which Technical Manager each user reports to by default. This pre-selects the picker at start-job time and drives the historical backfill.
            </p>
          </div>
          <Link
            to="/admin/commission-rules"
            className="text-xs text-indigo-700 hover:underline"
          >
            Commission Rules →
          </Link>
        </div>

        {missingCount > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold">{missingCount}</span> user
              {missingCount === 1 ? " has" : "s have"} no default TM.
              Jobs they create/start will fall back to themselves or need the artisan
              to pick a TM manually.
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-2 top-2.5 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, current TM…"
              className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-sm border rounded-lg bg-white"
          >
            {roles.map((r) => (
              <option key={r} value={r}>{r === "ALL" ? "All roles" : r}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showOnlyMissing}
              onChange={(e) => setShowOnlyMissing(e.target.checked)}
            />
            Only show users without a default TM
          </label>
        </div>

        <div className="bg-white rounded-xl shadow overflow-hidden">
          {users.isLoading ? (
            <div className="text-center py-10 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">No users match the current filters.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-left">Current default TM</th>
                  <th className="px-3 py-2 text-left">Change</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  // Guard: don't offer to make a user their own TM — silly and
                  // creates a confusing "self-reporting" loop in reports.
                  const options = (tms.data?.tms ?? []).filter((t) => t.id !== row.id);
                  return (
                    <tr key={row.id} className="border-t hover:bg-slate-50/60">
                      <td className="px-3 py-2">
                        <div className="font-medium">{row.name}</div>
                        <div className="text-xs text-slate-500">{row.email}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">{row.role}</td>
                      <td className="px-3 py-2">
                        {row.defaultTechnicalManagerName ? (
                          <span className="text-slate-800">{row.defaultTechnicalManagerName}</span>
                        ) : (
                          <span className="text-amber-700 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> None set
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={row.defaultTechnicalManagerId ?? ""}
                          onChange={(e) => {
                            const v = e.target.value === "" ? null : Number(e.target.value);
                            setDefault.mutate({ token, userId: row.id, technicalManagerId: v });
                          }}
                          disabled={setDefault.isPending}
                          className="px-2 py-1 text-sm border rounded bg-white"
                        >
                          <option value="">— No default —</option>
                          {options.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-xs text-slate-500 mt-3">
          Tip: the dropdown only shows users with an active <strong>TM</strong> commission rule.
          To add someone to that list, use the Commission Rules screen.
        </p>
      </div>
    </div>
  );
}
