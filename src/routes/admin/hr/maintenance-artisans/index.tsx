/**
 * HR view of Maintenance App artisans onboarded via the recruitment portal.
 * Read-only listing — approve/reject happens inside the Flutter admin app.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { useState } from "react";
import { ArrowLeft, Users, CheckCircle, Clock, XCircle, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/admin/hr/maintenance-artisans/")({
  component: MaintenanceArtisansPage,
});

function MaintenanceArtisansPage() {
  const trpc = useTRPC();
  const token = useAuthStore((s) => s.token);
  const [status, setStatus] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const q = useQuery({
    ...trpc.listMaintenanceAppArtisans.queryOptions({ token: token!, status }),
    enabled: !!token,
  });
  const data = q.data;
  const rows: any[] = data?.rows ?? [];
  const counts: Record<string, number> = {};
  for (const c of data?.counts ?? []) counts[c.status] = c._count._all;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/admin/hr" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to HR
        </Link>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" /> Maintenance App artisans
          </h1>
          <p className="text-sm text-gray-500">Candidates hired via the SQR15 recruitment portal, pushed to the Square 15 Maintenance App admin for final approval.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard title="Awaiting approval" value={counts["PENDING"] ?? 0} icon={<Clock className="w-4 h-4" />} color="amber" />
        <StatCard title="Approved" value={counts["APPROVED"] ?? 0} icon={<CheckCircle className="w-4 h-4" />} color="emerald" />
        <StatCard title="Rejected" value={counts["REJECTED"] ?? 0} icon={<XCircle className="w-4 h-4" />} color="red" />
      </div>

      <div className="flex items-center gap-2">
        {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${
              status === s ? "bg-emerald-600 text-white" : "bg-white border text-gray-600"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs uppercase text-gray-500">
              <th className="px-4 py-2">Candidate</th>
              <th className="px-4 py-2">Trade</th>
              <th className="px-4 py-2">City</th>
              <th className="px-4 py-2 text-right">Overall</th>
              <th className="px-4 py-2">Stage</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Pushed</th>
              <th className="px-4 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No records</td></tr>
            )}
            {rows.map((r: any) => {
              const a = r.application;
              return (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="font-medium">{a?.firstName} {a?.lastName}</div>
                    <div className="text-xs text-gray-500">{a?.email}</div>
                  </td>
                  <td className="px-4 py-2 text-gray-700">{a?.primaryTrade || "—"}</td>
                  <td className="px-4 py-2 text-gray-700">{a?.city || "—"}</td>
                  <td className="px-4 py-2 text-right font-mono">{a?.overallScore ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{a?.stageBucket}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {r.pushedAt ? new Date(r.pushedAt).toLocaleDateString("en-ZA") : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      to="/admin/recruitment/applications/$appId"
                      params={{ appId: String(a?.id) }}
                      className="text-xs text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
                    >
                      View <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {q.isLoading && <div className="text-sm text-gray-400">Loading…</div>}
      {q.isError && <div className="text-sm text-red-600">Failed to load</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "APPROVED" ? "bg-emerald-100 text-emerald-700"
    : status === "PENDING" ? "bg-amber-100 text-amber-700"
    : status === "REJECTED" ? "bg-red-100 text-red-700"
    : "bg-gray-100 text-gray-600";
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{status}</span>;
}

function StatCard({ title, value, icon, color }: { title: string; value: number; icon: React.ReactNode; color: "amber" | "emerald" | "red" }) {
  const bg = color === "amber" ? "bg-amber-50 border-amber-100" : color === "emerald" ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100";
  const text = color === "amber" ? "text-amber-700" : color === "emerald" ? "text-emerald-700" : "text-red-700";
  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <div className={`flex items-center gap-1.5 text-xs font-medium ${text}`}>
        {icon} {title}
      </div>
      <div className={`text-2xl font-bold mt-1 ${text}`}>{value}</div>
    </div>
  );
}
