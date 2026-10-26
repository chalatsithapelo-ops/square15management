/**
 * Artisan in-field expense capture panel.
 * Allows the on-site crew member to attach a receipt photo, amount and supplier
 * to an order. State starts as SUBMITTED → admin reviews → APPROVED → POSTED.
 * Auto-approves under the user's CommissionRule.approvalThreshold (if set).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import toast from "react-hot-toast";
import { Camera, Plus, Loader2, Receipt, MapPin, CreditCard, X, AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";

const PAYMENT_METHODS = [
  { value: "TM_CARD", label: "TM card (e.g. FNB)" },
  { value: "COMPANY_CARD", label: "Company card" },
  { value: "OWN_CASH", label: "Own cash (claim later)" },
  { value: "PETTY_CASH", label: "Petty cash (Square 15)" },
  { value: "ARTISAN_CLAIM", label: "Artisan claim (reimburse)" },
] as const;

const CATEGORIES = ["MATERIALS", "TOOLS", "TRANSPORTATION", "OTHER"] as const;

const ZAR = (n: number) => new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", minimumFractionDigits: 2 }).format(n ?? 0);

interface Props {
  orderId: number;
  orderNumber: string;
}

export function ExpensesPanel({ orderId, orderNumber }: Props) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const qc = useQueryClient();

  const listQuery = useQuery(trpc.artisanListMyExpenseSlips.queryOptions({ token: token!, orderId, limit: 100 }));

  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2"><Receipt className="w-4 h-4" /> Materials & Expenses</h2>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> Add expense
        </button>
      </div>

      <p className="text-xs text-gray-500">Add receipts as you go — photo, supplier, amount. Admin approves and it flows into your TM's monthly statement.</p>

      {listQuery.isLoading ? (
        <div className="py-6 text-center text-xs text-gray-400"><Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Loading…</div>
      ) : listQuery.data?.length === 0 ? (
        <div className="py-4 text-center text-xs text-gray-400 italic">No expenses logged for this job yet.</div>
      ) : (
        <ul className="divide-y divide-gray-100 text-sm">
          {listQuery.data?.map((s: any) => (
            <ExpenseItem key={s.id} slip={s} onChanged={() => qc.invalidateQueries({ queryKey: [["artisanListMyExpenseSlips"]] })} />
          ))}
        </ul>
      )}

      {open && (
        <AddExpenseModal
          orderId={orderId}
          orderNumber={orderNumber}
          onClose={() => setOpen(false)}
          onSuccess={() => {
            setOpen(false);
            qc.invalidateQueries({ queryKey: [["artisanListMyExpenseSlips"]] });
          }}
        />
      )}
    </div>
  );
}

function ExpenseItem({ slip, onChanged }: { slip: any; onChanged: () => void }) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const del = useMutation(trpc.artisanDeleteMyExpenseSlip.mutationOptions({
    onSuccess: () => { toast.success("Deleted"); onChanged(); },
    onError: (e) => toast.error(e.message),
  }));

  const stateClass: Record<string, string> = {
    SUBMITTED: "bg-blue-100 text-blue-700",
    APPROVED: "bg-emerald-100 text-emerald-700",
    POSTED: "bg-indigo-100 text-indigo-700",
    DISPUTED: "bg-amber-100 text-amber-700",
    REJECTED: "bg-rose-100 text-rose-700",
    DRAFT: "bg-gray-100 text-gray-600",
  };

  return (
    <li className="py-2 flex items-start gap-3">
      <a href={slip.url} target="_blank" rel="noreferrer" className="shrink-0 w-12 h-12 bg-gray-100 border border-gray-200 rounded overflow-hidden flex items-center justify-center">
        {/\.(jpe?g|png|gif|webp)$/i.test(slip.url) ? (
          <img src={slip.url} className="w-full h-full object-cover" alt="receipt" />
        ) : <Receipt className="w-5 h-5 text-gray-400" />}
      </a>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold">{ZAR(slip.amount)}</span>
          <span className={`text-[10px] uppercase font-bold rounded px-1.5 py-0.5 ${stateClass[slip.state]}`}>{slip.state}</span>
          {slip.paymentMethod && <span className="text-[10px] text-gray-500">{slip.paymentMethod}{slip.cardLast4 ? ` ****${slip.cardLast4}` : ""}</span>}
        </div>
        <div className="text-xs text-gray-600">{slip.supplierName ?? "—"}{slip.description ? ` · ${slip.description}` : ""}</div>
        <div className="text-[10px] text-gray-400">{new Date(slip.purchasedAt).toLocaleDateString("en-ZA")}</div>
        {slip.disputedReason && <div className="text-[10px] text-amber-700">Disputed: {slip.disputedReason}</div>}
      </div>
      {(slip.state === "SUBMITTED" || slip.state === "DRAFT") && (
        <button onClick={() => { if (confirm("Delete this expense?")) del.mutate({ token: token!, id: slip.id }); }} className="text-rose-500 hover:text-rose-700" title="Delete">
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </li>
  );
}

function AddExpenseModal({ orderId, orderNumber, onClose, onSuccess }: { orderId: number; orderNumber: string; onClose: () => void; onSuccess: () => void }) {
  const { token } = useAuthStore();
  const trpc = useTRPC();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [category, setCategory] = useState<typeof CATEGORIES[number]>("MATERIALS");
  const [amount, setAmount] = useState("");
  const [supplier, setSupplier] = useState("");
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<typeof PAYMENT_METHODS[number]["value"]>("OWN_CASH");
  const [cardLast4, setCardLast4] = useState("");
  const [purchasedAt, setPurchasedAt] = useState<string>(new Date().toISOString().slice(0, 10));
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const presignedMut = useMutation(trpc.getPresignedUploadUrl.mutationOptions());
  const addMut = useMutation(trpc.artisanAddExpenseSlip.mutationOptions());

  const onFile = (f: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const captureGps = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation not available on this device");
      return;
    }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsBusy(false);
        toast.success("Location captured");
      },
      (err) => {
        setGpsBusy(false);
        toast.error(`Location: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const submit = async () => {
    if (!file) { toast.error("Photo of receipt required"); return; }
    const amt = parseFloat(amount);
    if (!isFinite(amt) || amt <= 0) { toast.error("Amount required"); return; }

    setSubmitting(true);
    try {
      const { presignedUrl, fileUrl } = await presignedMut.mutateAsync({
        token: token!,
        fileName: `expense-${orderId}-${Date.now()}-${file.name}`,
        fileType: file.type,
        isPublic: false,
      });
      const uploadRes = await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!uploadRes.ok) throw new Error("Upload failed");

      const result = await addMut.mutateAsync({
        token: token!,
        orderId,
        url: fileUrl,
        amount: amt,
        category,
        description: description || undefined,
        supplierName: supplier || undefined,
        paymentMethod,
        cardLast4: cardLast4 || undefined,
        purchasedAt: new Date(purchasedAt).toISOString(),
        gpsLat: gps?.lat,
        gpsLng: gps?.lng,
      });
      toast.success(result.autoApproved ? "Auto-approved ✨" : "Submitted for review");
      onSuccess();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white sm:rounded-xl rounded-t-xl shadow-2xl max-w-md w-full max-h-[95vh] overflow-y-auto">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-bold flex items-center gap-2"><Receipt className="w-4 h-4" /> Add expense</h3>
            <p className="text-xs text-gray-500">{orderNumber}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Photo */}
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Receipt photo *</label>
            {preview ? (
              <div className="relative">
                <img src={preview} className="w-full h-48 object-contain bg-gray-100 rounded-lg border" alt="preview" />
                <button onClick={() => onFile(null)} className="absolute top-2 right-2 bg-rose-600 text-white rounded-full p-1 hover:bg-rose-700"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50">
                <Camera className="w-8 h-8 text-gray-400" />
                <span className="text-sm text-gray-600">Tap to take / pick photo</span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
              </label>
            )}
          </div>

          {/* Amount + category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Amount (incl VAT) *</label>
              <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as any)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Supplier */}
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Supplier</label>
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g. Builders Warehouse" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">What did you buy?</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="optional notes" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>

          {/* Payment method */}
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1 flex items-center gap-1"><CreditCard className="w-3 h-3" /> Paid with *</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            {(paymentMethod === "TM_CARD" || paymentMethod === "COMPANY_CARD") && (
              <input value={cardLast4} onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Last 4 digits of card" maxLength={4} className="w-full mt-2 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            )}
          </div>

          {/* Purchase date */}
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Date</label>
            <input type="date" value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>

          {/* GPS */}
          <div>
            <button type="button" onClick={captureGps} disabled={gpsBusy} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-300 hover:border-indigo-400 rounded-lg">
              {gpsBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
              {gps ? `Captured (${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)})` : "Capture GPS (optional)"}
            </button>
          </div>

          {/* Submit */}
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
            <button onClick={submit} disabled={submitting} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
