import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTRPC } from "~/trpc/react";

export const Route = createFileRoute("/external/order/$token/invoice")({
  component: ExternalOrderInvoicePage,
});

function ExternalOrderInvoicePage() {
  const { token } = useParams({ from: "/external/order/$token/invoice" });
  const trpc = useTRPC();

  const [invoiceTotal, setInvoiceTotal] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);

  const infoQuery = useQuery(
    trpc.getExternalSubmissionInfo.queryOptions({ token }, { enabled: !!token })
  );

  const presignMutation = useMutation(
    trpc.getPresignedUploadUrlForSubmission.mutationOptions()
  );

  const submitMutation = useMutation(
    trpc.submitExternalOrderInvoice.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Invoice submitted (${data.invoiceNumber})`);
        infoQuery.refetch();
      },
      onError: (err) => toast.error(err.message || "Failed to submit invoice"),
    })
  );

  const handleUpload = async (file: File) => {
    try {
      setUploading(true);
      const { presignedUrl, fileUrl } = await presignMutation.mutateAsync({
        submissionToken: token,
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
      });

      const res = await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
      });

      if (!res.ok) {
        throw new Error(`Upload failed (${res.status})`);
      }

      setAttachments((prev) => [...prev, fileUrl]);
      toast.success("Invoice attachment uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const submit = () => {
    const amount = Number(invoiceTotal);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Please enter a valid invoice total");
      return;
    }
    if (!attachments.length) {
      toast.error("Please upload your invoice document");
      return;
    }

    submitMutation.mutate({
      submissionToken: token,
      invoiceTotal: amount,
      notes: notes || undefined,
      attachments,
    });
  };

  const info = infoQuery.data;

  if (infoQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-600">Loading…</div>
      </div>
    );
  }

  if (infoQuery.isError || !info || info.type !== "ORDER_INVOICE" || !info.order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-gray-200 rounded-lg p-6">
          <h1 className="text-lg font-semibold text-gray-900">Invalid link</h1>
          <p className="mt-2 text-sm text-gray-600">This invoice link is invalid or expired.</p>
        </div>
      </div>
    );
  }

  const alreadyUsed = !!info.usedAt;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h1 className="text-xl font-semibold text-gray-900">Upload Invoice</h1>
          <p className="mt-1 text-sm text-gray-600">Order {info.order.orderNumber} — {info.order.title}</p>

          {alreadyUsed ? (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              This link has already been used. Thank you.
            </div>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Invoice Total (R)</label>
                  <input
                    type="number"
                    value={invoiceTotal}
                    onChange={(e) => setInvoiceTotal(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    min={0}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Invoice Document</label>
                  <input
                    type="file"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUpload(f);
                    }}
                    disabled={uploading}
                    className="mt-1 block w-full text-sm"
                  />
                  {attachments.length > 0 && (
                    <p className="mt-2 text-xs text-gray-500">{attachments.length} attachment uploaded</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Notes (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitMutation.isPending}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitMutation.isPending ? "Submitting…" : "Submit Invoice"}
                </button>
              </div>
            </>
          )}

          <div className="mt-8 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
            <p className="text-sm text-indigo-900">
              Want to manage invoices and approvals in the portal?
              <a href="/register" className="ml-2 font-semibold underline">Register</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
