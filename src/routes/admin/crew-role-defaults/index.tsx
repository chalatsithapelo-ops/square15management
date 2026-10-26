// PR-8 F — Admin "Default Site Lead / Ops Manager" screen.
//
// Combined page: pick a role (Site Lead or Ops Manager) then edit
// defaults across three scopes:
//   1. Users   — per-user default (drives auto-attach on self-initiated jobs)
//   2. Clients — account-scoped default
//   3. Buildings — building-scoped (wins over the client-scoped default)
//
// Resolution priority on order create for each role:
//   Order.<role>Id (explicit) →
//   User.default<Role>Id (initiator/assignee) →
//   ClientBuilding.default<Role>Id →
//   Client.default<Role>Id → null.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, Building2, Users2, Loader2, Search, HardHat, ClipboardCheck } from "lucide-react";

export const Route = createFileRoute("/admin/crew-role-defaults/")({
  component: CrewRoleDefaultsPage,
});

type Role = "SITE_LEAD" | "OPS_MANAGER";
type Tab = "USERS" | "CLIENTS" | "BUILDINGS";

function CrewRoleDefaultsPage() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const qc = useQueryClient();

  if (!token || !user) return null;

  const [role, setRole] = useState<Role>("SITE_LEAD");
  const [tab, setTab] = useState<Tab>("USERS");
  const [q, setQ] = useState("");
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);

  // Candidate lists for the <select>
  const siteLeads = useQuery(trpc.adminListSiteLeads.queryOptions({ token }));
  const opsManagers = useQuery(trpc.adminListOpsManagers.queryOptions({ token }));

  // ROLE = SITE_LEAD queries + mutations
  const usersSl = useQuery(trpc.adminListUserSiteLeadDefaults.queryOptions({ token }));
  const clientsSl = useQuery(trpc.adminListClientSiteLeadDefaults.queryOptions({ token }));
  const buildingsSl = useQuery(trpc.adminListBuildingSiteLeadDefaults.queryOptions({ token }));

  const setUserSl = useMutation(
    trpc.adminSetUserDefaultSiteLead.mutationOptions({
      onSuccess: () => {
        toast.success("User default site lead saved");
        qc.invalidateQueries({ queryKey: trpc.adminListUserSiteLeadDefaults.queryKey() });
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const setClientSl = useMutation(
    trpc.adminSetClientDefaultSiteLead.mutationOptions({
      onSuccess: () => {
        toast.success("Client default site lead saved");
        qc.invalidateQueries({ queryKey: trpc.adminListClientSiteLeadDefaults.queryKey() });
        qc.invalidateQueries({ queryKey: trpc.adminListBuildingSiteLeadDefaults.queryKey() });
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const setBuildingSl = useMutation(
    trpc.adminSetBuildingDefaultSiteLead.mutationOptions({
      onSuccess: () => {
        toast.success("Building default site lead saved");
        qc.invalidateQueries({ queryKey: trpc.adminListBuildingSiteLeadDefaults.queryKey() });
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  // ROLE = OPS_MANAGER queries + mutations
  const usersOm = useQuery(trpc.adminListUserOpsManagerDefaults.queryOptions({ token }));
  const clientsOm = useQuery(trpc.adminListClientOpsManagerDefaults.queryOptions({ token }));
  const buildingsOm = useQuery(trpc.adminListBuildingOpsManagerDefaults.queryOptions({ token }));

  const setUserOm = useMutation(
    trpc.adminSetUserDefaultOpsManager.mutationOptions({
      onSuccess: () => {
        toast.success("User default ops manager saved");
        qc.invalidateQueries({ queryKey: trpc.adminListUserOpsManagerDefaults.queryKey() });
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const setClientOm = useMutation(
    trpc.adminSetClientDefaultOpsManager.mutationOptions({
      onSuccess: () => {
        toast.success("Client default ops manager saved");
        qc.invalidateQueries({ queryKey: trpc.adminListClientOpsManagerDefaults.queryKey() });
        qc.invalidateQueries({ queryKey: trpc.adminListBuildingOpsManagerDefaults.queryKey() });
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const setBuildingOm = useMutation(
    trpc.adminSetBuildingDefaultOpsManager.mutationOptions({
      onSuccess: () => {
        toast.success("Building default ops manager saved");
        qc.invalidateQueries({ queryKey: trpc.adminListBuildingOpsManagerDefaults.queryKey() });
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const roleLabel = role === "SITE_LEAD" ? "site lead" : "ops manager";
  const candidates = role === "SITE_LEAD" ? siteLeads.data ?? [] : opsManagers.data ?? [];
  const candidatesLoading = role === "SITE_LEAD" ? siteLeads.isLoading : opsManagers.isLoading;

  // Normalize row shapes so downstream table rendering is role-agnostic.
  const userRows = useMemo(() => {
    const raw = role === "SITE_LEAD" ? usersSl.data ?? [] : usersOm.data ?? [];
    let rows = raw.map((r: any) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      defaultId: role === "SITE_LEAD" ? r.defaultSiteLeadId : r.defaultOpsManagerId,
      defaultName: role === "SITE_LEAD" ? r.defaultSiteLeadName : r.defaultOpsManagerName,
    }));
    const s = q.trim().toLowerCase();
    if (s) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          (r.email ?? "").toLowerCase().includes(s) ||
          (r.defaultName ?? "").toLowerCase().includes(s),
      );
    }
    if (showOnlyMissing) rows = rows.filter((r) => !r.defaultId);
    return rows;
  }, [role, usersSl.data, usersOm.data, q, showOnlyMissing]);

  const clientRows = useMemo(() => {
    const raw = role === "SITE_LEAD" ? clientsSl.data ?? [] : clientsOm.data ?? [];
    let rows = raw.map((r: any) => ({
      id: r.id,
      name: r.name,
      companyName: r.companyName,
      email: r.email,
      buildingCount: r.buildingCount,
      orderCount: r.orderCount,
      defaultId: role === "SITE_LEAD" ? r.defaultSiteLeadId : r.defaultOpsManagerId,
      defaultName: role === "SITE_LEAD" ? r.defaultSiteLeadName : r.defaultOpsManagerName,
    }));
    const s = q.trim().toLowerCase();
    if (s) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          (r.companyName ?? "").toLowerCase().includes(s) ||
          (r.email ?? "").toLowerCase().includes(s) ||
          (r.defaultName ?? "").toLowerCase().includes(s),
      );
    }
    if (showOnlyMissing) rows = rows.filter((r) => !r.defaultId);
    return rows;
  }, [role, clientsSl.data, clientsOm.data, q, showOnlyMissing]);

  const buildingRows = useMemo(() => {
    const raw = role === "SITE_LEAD" ? buildingsSl.data ?? [] : buildingsOm.data ?? [];
    let rows = raw.map((r: any) => ({
      id: r.id,
      name: r.name,
      address: r.address,
      clientId: r.clientId,
      clientName: r.clientName,
      buildingDefaultId:
        role === "SITE_LEAD" ? r.buildingDefaultSiteLeadId : r.buildingDefaultOpsManagerId,
      buildingDefaultName:
        role === "SITE_LEAD" ? r.buildingDefaultSiteLeadName : r.buildingDefaultOpsManagerName,
      clientDefaultId:
        role === "SITE_LEAD" ? r.clientDefaultSiteLeadId : r.clientDefaultOpsManagerId,
      clientDefaultName:
        role === "SITE_LEAD" ? r.clientDefaultSiteLeadName : r.clientDefaultOpsManagerName,
    }));
    const s = q.trim().toLowerCase();
    if (s) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          r.address.toLowerCase().includes(s) ||
          r.clientName.toLowerCase().includes(s) ||
          (r.buildingDefaultName ?? "").toLowerCase().includes(s) ||
          (r.clientDefaultName ?? "").toLowerCase().includes(s),
      );
    }
    if (showOnlyMissing) rows = rows.filter((r) => !r.buildingDefaultId && !r.clientDefaultId);
    return rows;
  }, [role, buildingsSl.data, buildingsOm.data, q, showOnlyMissing]);

  // Row-count badges
  const rawUsers = role === "SITE_LEAD" ? usersSl.data ?? [] : usersOm.data ?? [];
  const missingUserCount = rawUsers.filter(
    (r: any) => !(role === "SITE_LEAD" ? r.defaultSiteLeadId : r.defaultOpsManagerId),
  ).length;
  const rawClients = role === "SITE_LEAD" ? clientsSl.data ?? [] : clientsOm.data ?? [];
  const missingClientCount = rawClients.filter(
    (r: any) => !(role === "SITE_LEAD" ? r.defaultSiteLeadId : r.defaultOpsManagerId),
  ).length;
  const rawBuildings = role === "SITE_LEAD" ? buildingsSl.data ?? [] : buildingsOm.data ?? [];
  const missingBuildingCount = rawBuildings.filter((r: any) => {
    const bId = role === "SITE_LEAD" ? r.buildingDefaultSiteLeadId : r.buildingDefaultOpsManagerId;
    const cId = role === "SITE_LEAD" ? r.clientDefaultSiteLeadId : r.clientDefaultOpsManagerId;
    return !bId && !cId;
  }).length;

  // Callback shims to keep the JSX identical for both roles.
  const saveUser = (userId: number, id: number | null) =>
    role === "SITE_LEAD"
      ? setUserSl.mutate({ token, userId, siteLeadId: id })
      : setUserOm.mutate({ token, userId, opsManagerId: id });
  const saveClient = (clientId: number, id: number | null) =>
    role === "SITE_LEAD"
      ? setClientSl.mutate({ token, clientId, siteLeadId: id })
      : setClientOm.mutate({ token, clientId, opsManagerId: id });
  const saveBuilding = (clientBuildingId: number, id: number | null) =>
    role === "SITE_LEAD"
      ? setBuildingSl.mutate({ token, clientBuildingId, siteLeadId: id })
      : setBuildingOm.mutate({ token, clientBuildingId, opsManagerId: id });

  const savingUser = role === "SITE_LEAD" ? setUserSl.isPending : setUserOm.isPending;
  const savingClient = role === "SITE_LEAD" ? setClientSl.isPending : setClientOm.isPending;
  const savingBuilding = role === "SITE_LEAD" ? setBuildingSl.isPending : setBuildingOm.isPending;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link
            to={"/admin/tm-statements" as any}
            className="text-slate-500 hover:text-slate-700 flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back to TM statements
          </Link>
          <div className="h-4 w-px bg-slate-300" />
          <h1 className="text-xl font-bold text-slate-900">Default Site Leads / Ops Managers</h1>
          <span className="text-xs text-slate-500">
            User default → building override → client fallback. Explicit order override always wins.
          </span>
        </div>

        {/* Role selector */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setRole("SITE_LEAD")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border ${
              role === "SITE_LEAD"
                ? "bg-orange-600 text-white border-orange-600"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <HardHat className="w-4 h-4" /> Site Lead
          </button>
          <button
            onClick={() => setRole("OPS_MANAGER")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border ${
              role === "OPS_MANAGER"
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <ClipboardCheck className="w-4 h-4" /> Ops Manager
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setTab("USERS")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border ${
              tab === "USERS"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Users2 className="w-4 h-4" /> Users
            {missingUserCount > 0 && (
              <span
                className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${
                  tab === "USERS" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"
                }`}
              >
                {missingUserCount} unset
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("CLIENTS")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border ${
              tab === "CLIENTS"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Users2 className="w-4 h-4" /> Clients
            {missingClientCount > 0 && (
              <span
                className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${
                  tab === "CLIENTS" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"
                }`}
              >
                {missingClientCount} unset
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("BUILDINGS")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border ${
              tab === "BUILDINGS"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Building2 className="w-4 h-4" /> Buildings
            {missingBuildingCount > 0 && (
              <span
                className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${
                  tab === "BUILDINGS" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"
                }`}
              >
                {missingBuildingCount} orphaned
              </span>
            )}
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showOnlyMissing}
              onChange={(e) => setShowOnlyMissing(e.target.checked)}
              className="rounded border-slate-300"
            />
            Only show rows without a default
          </label>
        </div>

        {/* USERS tab */}
        {tab === "USERS" && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {(role === "SITE_LEAD" ? usersSl.isLoading : usersOm.isLoading) || candidatesLoading ? (
              <div className="p-10 flex items-center justify-center text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2">User</th>
                    <th className="text-left px-3 py-2">Role</th>
                    <th className="text-left px-3 py-2 w-72">Default {roleLabel}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {userRows.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-8 text-center text-slate-400 italic">
                        No users match your filters.
                      </td>
                    </tr>
                  )}
                  {userRows.map((u) => (
                    <tr key={u.id}>
                      <td className="px-3 py-2 text-slate-900">
                        {u.name}
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">{u.role}</td>
                      <td className="px-3 py-2">
                        <PersonSelect
                          value={u.defaultId}
                          candidates={candidates}
                          disabled={savingUser}
                          onChange={(v) => saveUser(u.id, v)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* CLIENTS tab */}
        {tab === "CLIENTS" && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {(role === "SITE_LEAD" ? clientsSl.isLoading : clientsOm.isLoading) || candidatesLoading ? (
              <div className="p-10 flex items-center justify-center text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2">Client</th>
                    <th className="text-left px-3 py-2">Company / email</th>
                    <th className="text-left px-3 py-2">Buildings</th>
                    <th className="text-left px-3 py-2">Orders</th>
                    <th className="text-left px-3 py-2 w-72">Default {roleLabel}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clientRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-slate-400 italic">
                        No clients match your filters.
                      </td>
                    </tr>
                  )}
                  {clientRows.map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2 text-slate-900">{c.name}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {c.companyName ? <span className="text-slate-900">{c.companyName}</span> : null}
                        <div className="text-xs text-slate-500">{c.email}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-500 tabular-nums">{c.buildingCount}</td>
                      <td className="px-3 py-2 text-slate-500 tabular-nums">{c.orderCount}</td>
                      <td className="px-3 py-2">
                        <PersonSelect
                          value={c.defaultId}
                          candidates={candidates}
                          disabled={savingClient}
                          onChange={(v) => saveClient(c.id, v)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* BUILDINGS tab */}
        {tab === "BUILDINGS" && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {(role === "SITE_LEAD" ? buildingsSl.isLoading : buildingsOm.isLoading) || candidatesLoading ? (
              <div className="p-10 flex items-center justify-center text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2">Client · Building</th>
                    <th className="text-left px-3 py-2">Address</th>
                    <th className="text-left px-3 py-2">Client default</th>
                    <th className="text-left px-3 py-2 w-72">Building override</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {buildingRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-slate-400 italic">
                        No buildings match your filters.
                      </td>
                    </tr>
                  )}
                  {buildingRows.map((b) => (
                    <tr key={b.id}>
                      <td className="px-3 py-2">
                        <div className="text-slate-900">{b.name}</div>
                        <div className="text-xs text-slate-500">{b.clientName}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-600 text-xs">{b.address}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {b.clientDefaultName ?? (
                          <span className="text-slate-400 italic text-xs">— not set —</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <PersonSelect
                          value={b.buildingDefaultId}
                          candidates={candidates}
                          disabled={savingBuilding}
                          placeholder={
                            b.clientDefaultName ? `inherit "${b.clientDefaultName}"` : "— none —"
                          }
                          onChange={(v) => saveBuilding(b.id, v)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PersonSelect({
  value,
  candidates,
  onChange,
  disabled,
  placeholder,
}: {
  value: number | null | undefined;
  candidates: Array<{ id: number; name: string }>;
  onChange: (id: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <select
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? null : Number(v));
      }}
      className="w-full rounded-lg border border-slate-300 text-sm px-2 py-1.5 disabled:opacity-50"
    >
      <option value="">{placeholder ?? "— none —"}</option>
      {candidates.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
