import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { ArrowLeft, GitCompare, Loader2 } from "lucide-react";

export const Route = createFileRoute("/property-manager/inspections/$id/compare")({
  component: ComparePage,
});

function ComparePage() {
  const { id } = Route.useParams();
  const inspId = parseInt(id, 10);
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const trpc = useTRPC();
  if (!token || !user) { navigate({ to: "/" }); return null; }

  const cmp = useQuery(trpc.compareInspections.queryOptions({ token, outgoingId: inspId }));
  const data: any = cmp.data;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/property-manager/inspections/$id" params={{ id }} className="text-gray-500"><ArrowLeft className="w-5 h-5" /></Link>
          <GitCompare className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold">Outgoing vs Ingoing</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {cmp.isLoading ? (
          <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>
        ) : !data ? (
          <div className="text-center py-10 text-gray-500">No comparison available.</div>
        ) : (
          <>
            <div className="bg-white rounded-lg border p-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs text-gray-500">Ingoing</div>
                <div className="font-mono">{data.ingoing.inspectionNumber}</div>
                <div className="text-xs text-gray-600">{data.ingoing.completedAt ? new Date(data.ingoing.completedAt).toLocaleDateString() : "—"}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Outgoing</div>
                <div className="font-mono">{data.outgoing.inspectionNumber}</div>
                <div className="text-xs text-gray-600">{data.outgoing.completedAt ? new Date(data.outgoing.completedAt).toLocaleDateString() : "—"}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">Total damage</div>
                <div className="text-2xl font-bold text-red-700">R {Number(data.totalDamage ?? 0).toLocaleString()}</div>
                <div className="text-xs text-gray-600">{data.diffs?.length ?? 0} differences</div>
              </div>
            </div>

            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs uppercase">Room</th>
                    <th className="px-3 py-2 text-left text-xs uppercase">Item</th>
                    <th className="px-3 py-2 text-left text-xs uppercase">Ingoing</th>
                    <th className="px-3 py-2 text-left text-xs uppercase">Outgoing</th>
                    <th className="px-3 py-2 text-right text-xs uppercase">Damage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.diffs?.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-500">No deterioration — property returned in same condition.</td></tr>
                  ) : (
                    data.diffs.map((d: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2">{d.roomName}</td>
                        <td className="px-3 py-2">{d.itemName}</td>
                        <td className="px-3 py-2 text-xs">{d.ingoingCondition ?? "—"}</td>
                        <td className="px-3 py-2 text-xs text-red-700 font-medium">{d.outgoingCondition ?? "—"}</td>
                        <td className="px-3 py-2 text-right text-xs">{d.damageCost ? `R ${Number(d.damageCost).toLocaleString()}` : "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
