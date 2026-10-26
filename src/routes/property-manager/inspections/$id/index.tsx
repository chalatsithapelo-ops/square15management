import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState, useMemo } from "react";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  ClipboardList,
  Loader2,
  Save,
  Send,
  FileDown,
  Camera,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  GitCompare,
} from "lucide-react";

export const Route = createFileRoute("/property-manager/inspections/$id/")({
  component: InspectionDetailPage,
});

const CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "POOR", "DAMAGED", "MISSING"] as const;
const COND_COLOR: Record<string, string> = {
  EXCELLENT: "bg-green-100 text-green-800",
  GOOD: "bg-emerald-100 text-emerald-800",
  FAIR: "bg-yellow-100 text-yellow-800",
  POOR: "bg-orange-100 text-orange-800",
  DAMAGED: "bg-red-100 text-red-800",
  MISSING: "bg-red-200 text-red-900",
};

function InspectionDetailPage() {
  const { id } = Route.useParams();
  const inspId = parseInt(id, 10);
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const qc = useQueryClient();
  if (!token || !user) { navigate({ to: "/" }); return null; }

  const detail = useQuery(trpc.getInspectionDetail.queryOptions({ token, id: inspId }));
  const insp: any = detail.data;
  const [activeRoomId, setActiveRoomId] = useState<number | null>(null);

  useMemo(() => {
    if (insp && !activeRoomId && insp.rooms?.length > 0) {
      setActiveRoomId(insp.rooms[0].id);
    }
  }, [insp, activeRoomId]);

  const activeRoom = insp?.rooms?.find((r: any) => r.id === activeRoomId);

  const updateItem = useMutation(trpc.updateInspectionItem.mutationOptions({
    onSuccess: () => qc.invalidateQueries({ queryKey: trpc.getInspectionDetail.queryKey({ token, id: inspId }) }),
    onError: (e) => toast.error(e.message),
  }));
  const updateRoom = useMutation(trpc.updateInspectionRoom.mutationOptions({
    onSuccess: () => qc.invalidateQueries({ queryKey: trpc.getInspectionDetail.queryKey({ token, id: inspId }) }),
    onError: (e) => toast.error(e.message),
  }));
  const updateMeta = useMutation(trpc.updateInspectionMeta.mutationOptions({
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: trpc.getInspectionDetail.queryKey({ token, id: inspId }) });
    },
    onError: (e) => toast.error(e.message),
  }));
  const finalize = useMutation(trpc.finalizeInspection.mutationOptions({
    onSuccess: () => {
      toast.success("Finalized & sent to tenant");
      qc.invalidateQueries({ queryKey: trpc.getInspectionDetail.queryKey({ token, id: inspId }) });
    },
    onError: (e) => toast.error(e.message),
  }));
  const genPdf = useMutation(trpc.generateInspectionPdf.mutationOptions({
    onSuccess: (r: any) => {
      toast.success("PDF generated");
      if (r?.url) window.open(r.url, "_blank");
    },
    onError: (e) => toast.error(e.message),
  }));

  if (detail.isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!insp) return <div className="min-h-screen flex items-center justify-center text-gray-500">Inspection not found.</div>;

  const isLocked = insp.status === "COMPLETED" || insp.status === "TENANT_REVIEW";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/property-manager/inspections" className="text-gray-500"><ArrowLeft className="w-5 h-5" /></Link>
            <ClipboardList className="w-7 h-7 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold font-mono">{insp.inspectionNumber}</h1>
              <p className="text-xs text-gray-500">{insp.type} · {insp.building?.name}{insp.unitNumber ? ` · Unit ${insp.unitNumber}` : ""} · Tenant: {insp.tenantName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs rounded bg-gray-100">{insp.status}</span>
            {insp.type === "OUTGOING" && insp.linkedIngoingId && (
              <Link to="/property-manager/inspections/$id/compare" params={{ id: String(insp.id) }} className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded">
                <GitCompare className="w-3.5 h-3.5" /> Compare to ingoing
              </Link>
            )}
            <button
              onClick={() => genPdf.mutate({ token, id: insp.id })}
              disabled={genPdf.isPending}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded"
            >
              {genPdf.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
              PDF
            </button>
            {!isLocked && (
              <button
                onClick={() => {
                  if (!confirm("Finalize inspection and email magic link to tenant?")) return;
                  finalize.mutate({ token, id: insp.id });
                }}
                disabled={finalize.isPending}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded"
              >
                {finalize.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Finalize & send to tenant
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Sidebar: rooms */}
        <aside className="lg:col-span-3 bg-white rounded-lg border p-3">
          <div className="text-xs uppercase text-gray-500 mb-2 px-1">Rooms ({insp.rooms?.length ?? 0})</div>
          <div className="space-y-1">
            {insp.rooms?.map((r: any) => {
              const damaged = (r.items || []).filter((i: any) => i.condition === "DAMAGED" || i.condition === "MISSING").length;
              return (
                <button
                  key={r.id}
                  onClick={() => setActiveRoomId(r.id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm flex justify-between items-center ${activeRoomId === r.id ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50"}`}
                >
                  <span>{r.name}</span>
                  {damaged > 0 && <span className="text-xs bg-red-100 text-red-800 px-1.5 rounded">{damaged}</span>}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main: active room items */}
        <main className="lg:col-span-6 space-y-3">
          {activeRoom ? (
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">{activeRoom.name}</h2>
                <div className="text-xs text-gray-500">{activeRoom.items?.length ?? 0} items</div>
              </div>
              <textarea
                placeholder="Room notes…"
                defaultValue={activeRoom.notes ?? ""}
                onBlur={(e) => updateRoom.mutate({ token, roomId: activeRoom.id, notes: e.target.value })}
                disabled={isLocked}
                className="w-full px-2 py-1.5 border rounded text-sm mb-3"
                rows={2}
              />
              <div className="space-y-2">
                {activeRoom.items?.map((item: any) => (
                  <ItemRow key={item.id} item={item} disabled={isLocked} onUpdate={(payload) => updateItem.mutate({ token, itemId: item.id, ...payload })} />
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border p-6 text-center text-gray-500">Select a room from the sidebar.</div>
          )}
        </main>

        {/* Right: meta + signoff */}
        <aside className="lg:col-span-3 space-y-3">
          <div className="bg-white rounded-lg border p-3">
            <div className="text-xs uppercase text-gray-500 mb-2">Meter readings</div>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-600">Electricity</label>
                <input defaultValue={insp.electricityReading ?? ""} disabled={isLocked} onBlur={(e) => updateMeta.mutate({ token, id: insp.id, electricityReading: e.target.value })} className="w-full px-2 py-1 border rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-600">Water</label>
                <input defaultValue={insp.waterReading ?? ""} disabled={isLocked} onBlur={(e) => updateMeta.mutate({ token, id: insp.id, waterReading: e.target.value })} className="w-full px-2 py-1 border rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-600">Gas</label>
                <input defaultValue={insp.gasReading ?? ""} disabled={isLocked} onBlur={(e) => updateMeta.mutate({ token, id: insp.id, gasReading: e.target.value })} className="w-full px-2 py-1 border rounded text-sm" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-3">
            <div className="text-xs uppercase text-gray-500 mb-2">Keys handover</div>
            <input
              type="number"
              defaultValue={insp.keysHandedOver ?? 0}
              disabled={isLocked}
              onBlur={(e) => updateMeta.mutate({ token, id: insp.id, keysHandedOver: parseInt(e.target.value || "0", 10) })}
              className="w-full px-2 py-1 border rounded text-sm"
              placeholder="Number of keys"
            />
            <textarea
              defaultValue={insp.keyDetails ?? ""}
              disabled={isLocked}
              onBlur={(e) => updateMeta.mutate({ token, id: insp.id, keyDetails: e.target.value })}
              className="w-full px-2 py-1 border rounded text-sm mt-2"
              placeholder="Front door, post box, remote…"
              rows={2}
            />
          </div>

          {insp.totalDamageCost && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
              <div className="text-xs uppercase text-red-700 mb-1">Estimated damage</div>
              <div className="text-xl font-bold text-red-900">R {Number(insp.totalDamageCost).toLocaleString()}</div>
            </div>
          )}

          {insp.tenantSignedAt && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
              <div className="text-xs uppercase text-green-700 mb-1">Tenant signed</div>
              <div className="text-xs text-gray-700">{new Date(insp.tenantSignedAt).toLocaleString()}</div>
              {insp.tenantSignatureImage && <img src={insp.tenantSignatureImage} alt="signature" className="mt-2 border bg-white max-h-24" />}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function ItemRow({ item, disabled, onUpdate }: { item: any; disabled: boolean; onUpdate: (p: any) => void }) {
  return (
    <div className="border rounded p-2 bg-gray-50">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-medium">{item.name}</div>
        <div className="flex items-center gap-1">
          {CONDITIONS.map((c) => (
            <button
              key={c}
              onClick={() => onUpdate({ condition: c })}
              disabled={disabled}
              className={`px-1.5 py-0.5 text-[10px] rounded border ${item.condition === c ? COND_COLOR[c] : "bg-white text-gray-600"}`}
            >
              {c[0]}
            </button>
          ))}
        </div>
      </div>
      <input
        placeholder="Notes (e.g. scratch on top right)…"
        defaultValue={item.notes ?? ""}
        disabled={disabled}
        onBlur={(e) => onUpdate({ notes: e.target.value })}
        className="w-full px-2 py-1 border rounded text-xs"
      />
      {(item.condition === "DAMAGED" || item.condition === "MISSING") && (
        <input
          type="number"
          placeholder="Damage cost (R)"
          defaultValue={item.damageCost ?? ""}
          disabled={disabled}
          onBlur={(e) => onUpdate({ damageCost: e.target.value ? parseFloat(e.target.value) : null })}
          className="w-full mt-1 px-2 py-1 border rounded text-xs"
        />
      )}
    </div>
  );
}
