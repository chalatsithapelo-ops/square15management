import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { PhotoUpload } from "~/components/PhotoUpload";

type MaterialRow = { name: string; description: string; quantity: string; unitPrice: string; supplier: string };

const toLocalInput = (value: string | Date | null | undefined) => {
  if (!value) return "";
  const d = new Date(value);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d).replace(" ", "T");
};
const fromLocalInput = (value: string) => {
  if (!value) return null;
  const [date, time] = value.split("T");
  if (!date || !time) return null;
  return new Date(`${date}T${time}:00+02:00`).toISOString();
};

function PhotoEditor({ label, urls, onChange }: { label: string; urls: string[]; onChange: (urls: string[]) => void }) {
  const [uploaderKey, setUploaderKey] = useState(0);
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">{label} ({urls.length})</p>
      {urls.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {urls.map((url, i) => (
            <div key={`${url}-${i}`} className="relative group">
              <img src={url} alt="" className="h-20 w-full object-cover rounded-lg border" />
              <button
                type="button"
                onClick={() => { onChange(urls.filter((_, idx) => idx !== i)); setUploaderKey((k) => k + 1); }}
                className="absolute top-1 right-1 rounded-full bg-white/90 p-1 text-red-600 shadow"
                aria-label="Remove photo"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <PhotoUpload key={uploaderKey} minimumPhotos={0} title={`Add ${label.toLowerCase()}`} initialUrls={urls} onPhotosUploaded={onChange} />
    </div>
  );
}

export function JobCardEditModal({ orderId, onClose }: { orderId: number; onClose: () => void }) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const query = useQuery({ ...trpc.getJobCardForEdit.queryOptions({ token: token!, orderId }), enabled: !!token });
  const order = query.data;

  const [serviceType, setServiceType] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [clientRepName, setClientRepName] = useState("");
  const [beforePictures, setBeforePictures] = useState<string[]>([]);
  const [afterPictures, setAfterPictures] = useState<string[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);

  useEffect(() => {
    if (!order) return;
    setServiceType(order.serviceType ?? "");
    setDescription(order.description ?? "");
    setNotes(order.notes ?? "");
    setStartTime(toLocalInput(order.startTime));
    setEndTime(toLocalInput(order.endTime));
    setClientRepName(order.clientRepName ?? "");
    setBeforePictures(order.beforePictures ?? []);
    setAfterPictures(order.afterPictures ?? []);
    setMaterials(order.materials.map((m) => ({
      name: m.name, description: m.description ?? "", quantity: String(m.quantity), unitPrice: String(m.unitPrice), supplier: m.supplier ?? "",
    })));
  }, [order]);

  const saveMut = useMutation({
    ...trpc.updateJobCard.mutationOptions(),
    onSuccess: () => {
      toast.success("Job card updated");
      void qc.invalidateQueries();
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "Failed to update job card"),
  });

  const materialsValid = materials.every((m) => m.name.trim() && Number(m.quantity) > 0 && Number(m.unitPrice) >= 0);
  const materialsTotal = materials.reduce((s, m) => s + (Number(m.quantity) || 0) * (Number(m.unitPrice) || 0), 0);
  const setMaterial = (i: number, patch: Partial<MaterialRow>) => setMaterials((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const save = () => {
    if (!description.trim()) return toast.error("Work description is required");
    if (!materialsValid) return toast.error("Each material needs a name, quantity above 0 and a price");
    saveMut.mutate({
      token: token!,
      orderId,
      serviceType: serviceType.trim() || undefined,
      description: description.trim(),
      notes: notes.trim() || null,
      startTime: fromLocalInput(startTime),
      endTime: fromLocalInput(endTime),
      clientRepName: clientRepName.trim() || null,
      beforePictures,
      afterPictures,
      materials: materials.map((m) => ({
        name: m.name.trim(),
        description: m.description.trim() || null,
        quantity: Number(m.quantity),
        unitPrice: Number(m.unitPrice),
        supplier: m.supplier.trim() || null,
      })),
    });
  };

  const input = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center bg-black/50 p-2 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Edit Job Card {order ? `— ${order.orderNumber}` : ""}</h2>
            {order && <p className="text-xs text-gray-500">{order.customerName} · {order.address}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        {query.isLoading ? (
          <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
        ) : query.isError ? (
          <p className="p-6 text-sm text-red-600">{(query.error as any)?.message ?? "Could not load job card"}</p>
        ) : (
          <div className="space-y-5 px-5 py-4 max-h-[75vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="text-sm text-gray-700">Service type
                <input className={input} value={serviceType} onChange={(e) => setServiceType(e.target.value)} />
              </label>
              <label className="text-sm text-gray-700">Client representative
                <input className={input} value={clientRepName} onChange={(e) => setClientRepName(e.target.value)} />
              </label>
              <label className="text-sm text-gray-700">Start time
                <input type="datetime-local" className={input} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </label>
              <label className="text-sm text-gray-700">End time
                <input type="datetime-local" className={input} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </label>
            </div>
            <label className="block text-sm text-gray-700">Work description / scope
              <textarea rows={4} className={input} value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <label className="block text-sm text-gray-700">Notes / findings
              <textarea rows={3} className={input} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Materials used</p>
                <button type="button" onClick={() => setMaterials((r) => [...r, { name: "", description: "", quantity: "1", unitPrice: "0", supplier: "" }])} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                  <Plus className="h-4 w-4" /> Add material
                </button>
              </div>
              {materials.length === 0 ? (
                <p className="text-xs text-gray-500">No materials recorded.</p>
              ) : (
                <div className="space-y-2">
                  {materials.map((m, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input className={`${input} col-span-12 sm:col-span-4`} placeholder="Material" value={m.name} onChange={(e) => setMaterial(i, { name: e.target.value })} />
                      <input className={`${input} col-span-4 sm:col-span-2`} type="number" min="0" step="any" placeholder="Qty" value={m.quantity} onChange={(e) => setMaterial(i, { quantity: e.target.value })} />
                      <input className={`${input} col-span-4 sm:col-span-2`} type="number" min="0" step="0.01" placeholder="Unit price" value={m.unitPrice} onChange={(e) => setMaterial(i, { unitPrice: e.target.value })} />
                      <input className={`${input} col-span-3 sm:col-span-3`} placeholder="Supplier" value={m.supplier} onChange={(e) => setMaterial(i, { supplier: e.target.value })} />
                      <button type="button" onClick={() => setMaterials((r) => r.filter((_, idx) => idx !== i))} className="col-span-1 flex justify-center text-red-500 hover:text-red-700" aria-label="Remove material">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <p className="text-right text-xs text-gray-600">Materials total: R{materialsTotal.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p>
                </div>
              )}
            </div>

            <PhotoEditor label="Before photos" urls={beforePictures} onChange={setBeforePictures} />
            <PhotoEditor label="After photos" urls={afterPictures} onChange={setAfterPictures} />
          </div>
        )}

        <div className="flex justify-end gap-2 border-t px-5 py-4">
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={!order || saveMut.isPending} className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save job card
          </button>
        </div>
      </div>
    </div>
  );
}
