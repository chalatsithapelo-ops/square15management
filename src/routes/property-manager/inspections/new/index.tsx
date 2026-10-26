import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";

export const Route = createFileRoute("/property-manager/inspections/new/")({
  component: NewInspectionPage,
});

function NewInspectionPage() {
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const trpc = useTRPC();
  if (!token || !user) { navigate({ to: "/" }); return null; }

  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [unitNumber, setUnitNumber] = useState("");
  const [type, setType] = useState<"INGOING" | "OUTGOING">("INGOING");
  const [tenantName, setTenantName] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [tenantIdNumber, setTenantIdNumber] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [systemTemplateKey, setSystemTemplateKey] = useState("RES_2BED");
  const [linkedIngoingId, setLinkedIngoingId] = useState("");

  // Fetch PM's buildings and inspection templates
  const buildings = useQuery({
    ...trpc.getBuildings.queryOptions({ token }),
    // fallback if PM has no buildings endpoint with that exact name; keep optional
    retry: 0,
  });
  const templates = useQuery(trpc.getInspectionTemplates.queryOptions({ token }));

  const create = useMutation(trpc.createTenantInspection.mutationOptions({
    onSuccess: (insp: any) => {
      toast.success(`Created ${insp.inspectionNumber}`);
      navigate({ to: "/property-manager/inspections/$id", params: { id: String(insp.id) } });
    },
    onError: (e) => toast.error(e.message),
  }));

  const valid = buildingId && tenantName && tenantEmail;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/property-manager/inspections" className="text-gray-500"><ArrowLeft className="w-5 h-5" /></Link>
          <Plus className="w-7 h-7 text-blue-600" />
          <h1 className="text-xl font-bold">New inspection</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="bg-white shadow border rounded-lg p-5 space-y-4">

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as any)} className="w-full px-3 py-2 border rounded">
                <option value="INGOING">INGOING (move-in)</option>
                <option value="OUTGOING">OUTGOING (move-out)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Scheduled for (optional)</label>
              <input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} className="w-full px-3 py-2 border rounded" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">Building</label>
            <select
              value={buildingId ?? ""}
              onChange={(e) => setBuildingId(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="">— select building —</option>
              {Array.isArray(buildings.data) && (buildings.data as any[]).map((b: any) => (
                <option key={b.id} value={b.id}>{b.name} — {b.address}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">Unit number (optional)</label>
            <input value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} className="w-full px-3 py-2 border rounded" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Tenant name</label>
              <input value={tenantName} onChange={(e) => setTenantName(e.target.value)} className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Tenant email</label>
              <input type="email" value={tenantEmail} onChange={(e) => setTenantEmail(e.target.value)} className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Phone</label>
              <input value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">ID number</label>
              <input value={tenantIdNumber} onChange={(e) => setTenantIdNumber(e.target.value)} className="w-full px-3 py-2 border rounded" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">Template</label>
            <select value={systemTemplateKey} onChange={(e) => setSystemTemplateKey(e.target.value)} className="w-full px-3 py-2 border rounded">
              {(templates.data as any)?.systemTemplates?.map((t: any) => (
                <option key={t.key} value={t.key}>{t.name} ({t.roomCount} rooms · {t.itemCount} items)</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Pre-fills rooms + items so you can walk through systematically.</p>
          </div>

          {type === "OUTGOING" && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">Linked INGOING inspection ID (optional)</label>
              <input value={linkedIngoingId} onChange={(e) => setLinkedIngoingId(e.target.value)} placeholder="e.g. 42" className="w-full px-3 py-2 border rounded" />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Link to="/property-manager/inspections" className="px-3 py-2 border rounded text-sm">Cancel</Link>
            <button
              onClick={() => create.mutate({
                token,
                buildingId: buildingId!,
                unitNumber: unitNumber || undefined,
                type,
                tenantName,
                tenantEmail,
                tenantPhone: tenantPhone || undefined,
                tenantIdNumber: tenantIdNumber || undefined,
                scheduledFor: scheduledFor || undefined,
                systemTemplateKey: systemTemplateKey || undefined,
                linkedIngoingId: linkedIngoingId ? parseInt(linkedIngoingId, 10) : undefined,
              })}
              disabled={!valid || create.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              {create.isPending ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
              Create inspection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
