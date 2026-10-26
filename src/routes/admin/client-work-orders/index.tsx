import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useTRPC } from "~/trpc/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Building2, Filter, RefreshCw, ChevronRight, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/admin/client-work-orders/")({
  component: ClientWorkOrdersPage,
});

const STATUS_BADGE: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  ON_HOLD: "bg-gray-100 text-gray-700",
  CONTRACTOR_COMPLETE: "bg-teal-100 text-teal-800",
  INVOICED: "bg-purple-100 text-purple-800",
  CLOSED: "bg-emerald-100 text-emerald-800",
};

function ClientWorkOrdersPage() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  if (!token) return null;

  const listQ = useQuery(trpc.listClientWorkOrders.queryOptions({
    token,
    status: statusFilter || undefined,
    take: 300,
  }));
  const syncMut = useMutation(
    trpc.syncMyBuildingsNow.mutationOptions({
      onSuccess: (r) => {
        toast.success(`Synced ${r.fetched} — ${r.created} new, ${r.updated} updated`);
        qc.invalidateQueries({ queryKey: trpc.listClientWorkOrders.queryKey({ token, take: 300 }) });
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const rows = ((listQ.data ?? []) as any[]).filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      String(r.externalJobCode ?? "").toLowerCase().includes(s) ||
      String(r.externalSite ?? "").toLowerCase().includes(s) ||
      String(r.title ?? "").toLowerCase().includes(s) ||
      String(r.externalStatusName ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin/dashboard" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-teal-600" />
              <h1 className="text-lg font-semibold">Client Work Orders</h1>
              <span className="text-xs bg-gray-100 rounded px-2 py-0.5">{rows.length}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin/integrations/mybuildings" className="text-xs text-teal-700 hover:underline">
              Integration settings
            </Link>
            <button
              onClick={() => syncMut.mutate({ token })}
              disabled={syncMut.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {syncMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Sync now
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="bg-white rounded-xl border p-3 flex items-center gap-3 mb-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm"
          >
            <option value="">All statuses</option>
            <option value="NEW">New</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="ON_HOLD">On hold</option>
            <option value="CONTRACTOR_COMPLETE">Contractor complete</option>
            <option value="INVOICED">Invoiced</option>
            <option value="CLOSED">Closed</option>
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search job code, site, description…"
            className="flex-1 border rounded px-3 py-1.5 text-sm"
          />
        </div>

        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="text-left px-4 py-2">Job Code</th>
                <th className="text-left px-4 py-2">Site</th>
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-left px-4 py-2">Eris status</th>
                <th className="text-left px-4 py-2">Our status</th>
                <th className="text-left px-4 py-2">Assigned</th>
                <th className="text-left px-4 py-2">Invoice</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs">{r.externalJobCode}</td>
                  <td className="px-4 py-2">{r.externalSite ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-600">{r.title ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-gray-600">{r.externalStatusName ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${STATUS_BADGE[r.ourStatus] ?? "bg-gray-100 text-gray-700"}`}>
                      {r.ourStatus}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {r.assignedToUser ? `${r.assignedToUser.firstName} ${r.assignedToUser.lastName}` : <span className="text-gray-400">unassigned</span>}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {r.linkedInvoice ? (
                      <span className="text-teal-700 font-mono">{r.linkedInvoice.invoiceNumber}</span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link to={`/admin/client-work-orders/${r.id}`} className="text-teal-600 hover:text-teal-700 inline-flex items-center gap-1 text-xs">
                      Open <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !listQ.isLoading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">No client work orders yet.</td></tr>
              )}
              {listQ.isLoading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center"><Loader2 className="w-5 h-5 animate-spin text-teal-600 mx-auto" /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
