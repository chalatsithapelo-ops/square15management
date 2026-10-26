// PR-8 E — Admin "Default Sales Agent" screen.
//
// Two tabs:
//   1. Clients — set an account-scoped default sales agent
//   2. Buildings — set a building-scoped default (wins over the client-scoped one)
//
// Resolution priority on order create:
//   Order.salesAgentId (explicit) → ClientBuilding.defaultSalesAgentId → Client.defaultSalesAgentId → null.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, Building2, Users2, Loader2, Search } from "lucide-react";

export const Route = createFileRoute("/admin/sales-agent-defaults/")({
  component: SalesAgentDefaultsPage,
});

type Tab = "CLIENTS" | "BUILDINGS";

function SalesAgentDefaultsPage() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const qc = useQueryClient();

  if (!token || !user) return null;

  const [tab, setTab] = useState<Tab>("CLIENTS");
  const [q, setQ] = useState("");
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);

  const salesAgents = useQuery(trpc.adminListSalesAgents.queryOptions({ token }));
  const clients = useQuery(trpc.adminListClientSalesAgentDefaults.queryOptions({ token }));
  const buildings = useQuery(trpc.adminListBuildingSalesAgentDefaults.queryOptions({ token }));

  const setClient = useMutation(
    trpc.adminSetClientDefaultSalesAgent.mutationOptions({
      onSuccess: () => {
        toast.success("Client default sales agent saved");
        qc.invalidateQueries({ queryKey: trpc.adminListClientSalesAgentDefaults.queryKey() });
        qc.invalidateQueries({ queryKey: trpc.adminListBuildingSalesAgentDefaults.queryKey() });
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const setBuilding = useMutation(
    trpc.adminSetBuildingDefaultSalesAgent.mutationOptions({
      onSuccess: () => {
        toast.success("Building default sales agent saved");
        qc.invalidateQueries({ queryKey: trpc.adminListBuildingSalesAgentDefaults.queryKey() });
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const clientRows = useMemo(() => {
    let rows = clients.data ?? [];
    const s = q.trim().toLowerCase();
    if (s) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          (r.companyName ?? "").toLowerCase().includes(s) ||
          (r.email ?? "").toLowerCase().includes(s) ||
          (r.defaultSalesAgentName ?? "").toLowerCase().includes(s),
      );
    }
    if (showOnlyMissing) rows = rows.filter((r) => !r.defaultSalesAgentId);
    return rows;
  }, [clients.data, q, showOnlyMissing]);

  const buildingRows = useMemo(() => {
    let rows = buildings.data ?? [];
    const s = q.trim().toLowerCase();
    if (s) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          r.address.toLowerCase().includes(s) ||
          r.clientName.toLowerCase().includes(s) ||
          (r.buildingDefaultSalesAgentName ?? "").toLowerCase().includes(s) ||
          (r.clientDefaultSalesAgentName ?? "").toLowerCase().includes(s),
      );
    }
    if (showOnlyMissing) {
      rows = rows.filter((r) => !r.buildingDefaultSalesAgentId && !r.clientDefaultSalesAgentId);
    }
    return rows;
  }, [buildings.data, q, showOnlyMissing]);

  const missingClientCount = (clients.data ?? []).filter((r) => !r.defaultSalesAgentId).length;
  const missingBuildingCount = (buildings.data ?? []).filter(
    (r) => !r.buildingDefaultSalesAgentId && !r.clientDefaultSalesAgentId,
  ).length;

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
          <h1 className="text-xl font-bold text-slate-900">Default Sales Agents</h1>
          <span className="text-xs text-slate-500">
            Building-level default wins over client-level; explicit order override wins over both.
          </span>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-4">
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

        {/* CLIENTS tab */}
        {tab === "CLIENTS" && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {clients.isLoading || salesAgents.isLoading ? (
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
                    <th className="text-left px-3 py-2 w-72">Default sales agent</th>
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
                        <SalesAgentSelect
                          value={c.defaultSalesAgentId}
                          agents={salesAgents.data ?? []}
                          disabled={setClient.isPending}
                          onChange={(saId) =>
                            setClient.mutate({ token, clientId: c.id, salesAgentId: saId })
                          }
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
            {buildings.isLoading || salesAgents.isLoading ? (
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
                        {b.clientDefaultSalesAgentName ?? (
                          <span className="text-slate-400 italic text-xs">— not set —</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <SalesAgentSelect
                          value={b.buildingDefaultSalesAgentId}
                          agents={salesAgents.data ?? []}
                          disabled={setBuilding.isPending}
                          placeholder={
                            b.clientDefaultSalesAgentName
                              ? `inherit "${b.clientDefaultSalesAgentName}"`
                              : "— none —"
                          }
                          onChange={(saId) =>
                            setBuilding.mutate({
                              token,
                              clientBuildingId: b.id,
                              salesAgentId: saId,
                            })
                          }
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

function SalesAgentSelect({
  value,
  agents,
  onChange,
  disabled,
  placeholder,
}: {
  value: number | null | undefined;
  agents: Array<{ id: number; name: string }>;
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
      {agents.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  );
}
