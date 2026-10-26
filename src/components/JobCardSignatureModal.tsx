import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, PenLine, Check, User, Wrench, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useTRPC } from "~/trpc/react";
import { SignaturePad } from "~/components/SignaturePad";

interface OrderForSigning {
  id: number;
  orderNumber: string;
  serviceType?: string | null;
  description?: string | null;
  signedJobCardUrl?: string | null;
  clientRepName?: string | null;
  clientRepSignDate?: Date | string | null;
  artisanSignatureUrl?: string | null;
  artisanSignedByName?: string | null;
  artisanSignDate?: Date | string | null;
  isPMOrder?: boolean;
}

interface Props {
  token: string;
  order: OrderForSigning;
  currentUserName?: string;
  /** Show the client signature block. Default: only when not already signed. */
  allowClient?: boolean;
  /** Show the artisan signature block. Default: only when not already signed. */
  allowArtisan?: boolean;
  onClose: () => void;
}

/**
 * Dual-signature modal reused by artisan dashboard, admin operations and
 * admin invoices for the post-completion "Sign Job Card" flow. Renders a
 * client signature pad and (for regular orders) an artisan signature pad,
 * hiding either side that has already been signed. Submits both signatures
 * in a single tRPC mutation and invalidates the shared order/invoice
 * queries so all portals refresh automatically.
 */
export function JobCardSignatureModal({
  token,
  order,
  currentUserName,
  allowClient,
  allowArtisan,
  onClose,
}: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const clientAlreadySigned = !!(order.signedJobCardUrl && order.clientRepSignDate);
  const artisanAlreadySigned = !!(order.artisanSignatureUrl && order.artisanSignDate);
  const showClient = (allowClient ?? true) && !clientAlreadySigned;
  // Artisan signature is required on BOTH regular and PM orders — SA best
  // practice is that both parties acknowledge completion.
  const showArtisan = (allowArtisan ?? true) && !artisanAlreadySigned;

  const [clientSig, setClientSig] = useState<string | null>(null);
  const [clientRepName, setClientRepName] = useState("");
  const [artisanSig, setArtisanSig] = useState<string | null>(null);
  const [artisanName, setArtisanName] = useState(currentUserName || "");

  const mutation = useMutation(
    trpc.submitJobCardSignatures.mutationOptions({
      onSuccess: async (result) => {
        toast.success(`Signature${result.applied.length > 1 ? "s" : ""} saved for ${result.orderNumber}`);
        // Invalidate every surface that shows order/invoice status so all
        // three portals refresh together.
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: [["getOrders"]] as any }),
          queryClient.invalidateQueries({ queryKey: [["getInvoices"]] as any }),
          queryClient.invalidateQueries({ queryKey: [["adminListSelfInitiated"]] as any }),
        ]);
        onClose();
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to save signatures");
      },
    })
  );

  const canSubmit = useMemo(() => {
    const clientReady = showClient && !!clientSig && !!clientRepName.trim();
    const artisanReady = showArtisan && !!artisanSig && !!artisanName.trim();
    return clientReady || artisanReady;
  }, [showClient, clientSig, clientRepName, showArtisan, artisanSig, artisanName]);

  async function handleSubmit() {
    if (!canSubmit) {
      toast.error("Capture at least one signature (with name) before saving");
      return;
    }
    await mutation.mutateAsync({
      token,
      orderId: order.id,
      isPMOrder: !!order.isPMOrder,
      clientSignatureDataUrl: showClient && clientSig ? clientSig : undefined,
      clientRepName: showClient && clientSig ? clientRepName.trim() : undefined,
      artisanSignatureDataUrl: showArtisan && artisanSig ? artisanSig : undefined,
      artisanSignedByName: showArtisan && artisanSig ? artisanName.trim() : undefined,
    });
  }

  if (!showClient && !showArtisan) {
    // Nothing to do — both parties already signed.
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-semibold text-gray-900">Job card fully signed</h3>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-gray-600">
            Both the client and the artisan have already signed job card <strong>{order.orderNumber}</strong>.
          </p>
          <div className="mt-4 flex justify-end">
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full my-6">
        <div className="flex items-start justify-between p-5 border-b">
          <div>
            <div className="flex items-center gap-2">
              <PenLine className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Sign Job Card</h3>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {order.orderNumber}{order.serviceType ? ` • ${order.serviceType}` : ""}
            </p>
            {order.description && (
              <p className="text-xs text-gray-400 mt-1 line-clamp-2 max-w-xl">{order.description}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {clientAlreadySigned && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <Check className="w-4 h-4" />
              Client already signed as <strong>{order.clientRepName}</strong>
              {order.clientRepSignDate ? ` on ${new Date(order.clientRepSignDate as any).toLocaleDateString()}` : ""}.
            </div>
          )}
          {artisanAlreadySigned && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <Check className="w-4 h-4" />
              Artisan already signed as <strong>{order.artisanSignedByName}</strong>
              {order.artisanSignDate ? ` on ${new Date(order.artisanSignDate as any).toLocaleDateString()}` : ""}.
            </div>
          )}

          {showClient && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-indigo-600" />
                <h4 className="font-semibold text-sm text-gray-900">Client / Customer Signature</h4>
              </div>
              <input
                type="text"
                value={clientRepName}
                onChange={(e) => setClientRepName(e.target.value)}
                placeholder="Full name of the person signing"
                className="w-full mb-2 px-3 py-2 border rounded-lg text-sm"
              />
              <SignaturePad onChange={setClientSig} />
            </section>
          )}

          {showArtisan && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="w-4 h-4 text-amber-600" />
                <h4 className="font-semibold text-sm text-gray-900">Artisan / Technician Signature</h4>
              </div>
              <input
                type="text"
                value={artisanName}
                onChange={(e) => setArtisanName(e.target.value)}
                placeholder="Artisan full name"
                className="w-full mb-2 px-3 py-2 border rounded-lg text-sm"
              />
              <SignaturePad onChange={setArtisanSig} />
            </section>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 flex items-center justify-end gap-2 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={mutation.isPending}
            className="px-4 py-2 rounded-lg bg-white border text-sm hover:bg-gray-100 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || mutation.isPending}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}
            Save Signatures
          </button>
        </div>
      </div>
    </div>
  );
}
