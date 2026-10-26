import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Link2, Mail, Phone, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useTRPC } from "~/trpc/react";

interface OrderForRequest {
  id: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

interface Props {
  token: string;
  order: OrderForRequest;
  onClose: () => void;
}

/**
 * Shared "Request Signature" modal — extracted from admin/operations so the
 * Quotations page (and any future surface that lists orders) can offer the
 * exact same Send-Sign-Link workflow without duplicating the logic. Keeping
 * this in a single component guarantees the two pages stay aligned.
 */
export function SendSignatureRequestModal({ token, order, onClose }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [name, setName] = useState(order.customerName || "");
  const [contact, setContact] = useState(order.customerEmail || "");
  const [method, setMethod] = useState<"email" | "whatsapp" | "link">("link");

  const mutation = useMutation(
    trpc.sendSignatureRequest.mutationOptions({
      onSuccess: async (data: any) => {
        if (data.method === "whatsapp" && data.whatsappUrl) {
          window.open(data.whatsappUrl, "_blank");
        }
        if (data.method === "link" && data.signingUrl) {
          try {
            await navigator.clipboard.writeText(data.signingUrl);
            toast.success("Signing link copied to clipboard — paste it anywhere to share");
          } catch {
            toast.success(`Link ready: ${data.signingUrl}`);
          }
        } else {
          toast.success(data.message);
        }
        // Invalidate both order and quotation lists so any surface refreshes.
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: [["getOrders"]] as any }),
          queryClient.invalidateQueries({ queryKey: [["getQuotations"]] as any }),
        ]);
        onClose();
      },
      onError: (error: any) => {
        toast.error(error?.message || "Failed to send signature request");
      },
    })
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Request Signature</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Send a signature request to the building manager / client representative for this completed job card.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Send Method</label>
            <div className="flex gap-2">
              <button
                onClick={() => setMethod("link")}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  method === "link"
                    ? "bg-amber-50 border-amber-300 text-amber-700"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
                title="Copy link to clipboard — share via any channel"
              >
                <Link2 className="h-4 w-4 inline mr-1" />Copy Link
              </button>
              <button
                onClick={() => {
                  setMethod("email");
                  setContact(order.customerEmail);
                }}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  method === "email"
                    ? "bg-blue-50 border-blue-300 text-blue-700"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Mail className="h-4 w-4 inline mr-1" />Email
              </button>
              <button
                onClick={() => {
                  setMethod("whatsapp");
                  setContact(order.customerPhone);
                }}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  method === "whatsapp"
                    ? "bg-green-50 border-green-300 text-green-700"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Phone className="h-4 w-4 inline mr-1" />WhatsApp
              </button>
            </div>
          </div>

          {method !== "link" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {method === "email" ? "Email Address" : "Phone Number"}
              </label>
              <input
                type={method === "email" ? "email" : "tel"}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          )}
          {method === "link" && (
            <p className="text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded p-2">
              We&rsquo;ll generate the signing link and copy it to your clipboard. Paste it into WhatsApp, SMS, iMessage, or hand the client a QR of it &mdash; whichever works. As soon as they sign, this page updates automatically.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!name.trim()) {
                toast.error("Please enter the recipient name");
                return;
              }
              if (method !== "link" && !contact.trim()) {
                toast.error(method === "email" ? "Please enter an email address" : "Please enter a phone number");
                return;
              }
              mutation.mutate({
                token,
                orderId: order.id,
                recipientName: name.trim(),
                recipientEmail: method === "link" ? undefined : contact.trim(),
                method,
              });
            }}
            disabled={mutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? (
              <><Loader2 className="h-4 w-4 inline mr-1 animate-spin" />Working...</>
            ) : (
              method === "email" ? "Send Email" : method === "whatsapp" ? "Open WhatsApp" : "Copy Link"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
