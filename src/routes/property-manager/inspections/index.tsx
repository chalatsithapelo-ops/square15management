import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  ClipboardList,
  Plus,
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Eye,
} from "lucide-react";

export const Route = createFileRoute("/property-manager/inspections/")({
  component: InspectionsListPage,
});

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SCHEDULED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  TENANT_REVIEW: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-green-100 text-green-800",
  DISPUTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};

function InspectionsListPage() {
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const trpc = useTRPC();
  if (!token || !user) { navigate({ to: "/" }); return null; }

  const [statusFilter, setStatusFilter] = useState<any>("all");
  const [typeFilter, setTypeFilter] = useState<any>("all");

  const list = useQuery(trpc.getInspections.queryOptions({ token, status: statusFilter, type: typeFilter }));
  const rows = (list.data as any[]) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/property-manager/dashboard" className="text-gray-500"><ArrowLeft className="w-5 h-5" /></Link>
            <ClipboardList className="w-7 h-7 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold">Tenant inspections</h1>
              <p className="text-sm text-gray-500">Ingoing / outgoing inspections — court-ready</p>
            </div>
          </div>
          <Link to="/property-manager/inspections/new" className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded">
            <Plus className="w-4 h-4" /> New inspection
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-white p-3 rounded-lg shadow border flex flex-wrap gap-3 items-center">
          <span className="text-xs text-gray-600">Status:</span>
          {(["all","DRAFT","SCHEDULED","IN_PROGRESS","TENANT_REVIEW","COMPLETED","DISPUTED"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-2 py-1 text-xs rounded border ${statusFilter === s ? "bg-blue-600 text-white" : "bg-white"}`}>{s}</button>
          ))}
          <span className="text-xs text-gray-600 ml-4">Type:</span>
          {(["all","INGOING","OUTGOING"] as const).map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)} className={`px-2 py-1 text-xs rounded border ${typeFilter === t ? "bg-blue-600 text-white" : "bg-white"}`}>{t}</button>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow border overflow-hidden">
          {list.isLoading ? (
            <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : rows.length === 0 ? (
            <div className="text-center py-10 text-gray-500">No inspections found.</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs uppercase">#</th>
                  <th className="px-3 py-2 text-left text-xs uppercase">Type</th>
                  <th className="px-3 py-2 text-left text-xs uppercase">Building</th>
                  <th className="px-3 py-2 text-left text-xs uppercase">Tenant</th>
                  <th className="px-3 py-2 text-left text-xs uppercase">Status</th>
                  <th className="px-3 py-2 text-left text-xs uppercase">Scheduled</th>
                  <th className="px-3 py-2 text-left text-xs uppercase">Rooms</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((i: any) => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs">{i.inspectionNumber}</td>
                    <td className="px-3 py-2 text-xs">{i.type}</td>
                    <td className="px-3 py-2">{i.building?.name}{i.unitNumber ? ` (Unit ${i.unitNumber})` : ""}</td>
                    <td className="px-3 py-2 text-xs">{i.tenantName}<br /><span className="text-gray-500">{i.tenantEmail}</span></td>
                    <td className="px-3 py-2"><span className={`px-1.5 py-0.5 text-xs rounded ${STATUS_COLOR[i.status] ?? "bg-gray-100"}`}>{i.status}</span></td>
                    <td className="px-3 py-2 text-xs">{i.scheduledFor ? new Date(i.scheduledFor).toLocaleDateString() : "—"}</td>
                    <td className="px-3 py-2 text-xs">{i.rooms?.length ?? 0}</td>
                    <td className="px-3 py-2 text-right">
                      <Link to="/property-manager/inspections/$id" params={{ id: String(i.id) }} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        <Eye className="w-3.5 h-3.5" /> Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
