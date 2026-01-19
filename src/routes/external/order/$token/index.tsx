import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTRPC } from "~/trpc/react";

export const Route = createFileRoute("/external/order/$token/")({
  component: ExternalOrderAcceptPage,
});

function ExternalOrderAcceptPage() {
  const { token } = useParams({ from: "/external/order/$token/" });
  const trpc = useTRPC();

  const [notes, setNotes] = useState<string>("");

  const infoQuery = useQuery(
    trpc.getExternalSubmissionInfo.queryOptions({ token }, { enabled: !!token })
  );

  const acceptMutation = useMutation(
    trpc.acceptExternalOrder.mutationOptions({
      onSuccess: () => {
        toast.success("Order accepted");
        infoQuery.refetch();
      },
      onError: (err) => toast.error(err.message || "Failed to accept order"),
    })
  );

  const info = infoQuery.data;

  if (infoQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-600">Loading…</div>
      </div>
    );
  }

  if (infoQuery.isError || !info || info.type !== "ORDER_ACCEPT" || !info.order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-gray-200 rounded-lg p-6">
          <h1 className="text-lg font-semibold text-gray-900">Invalid link</h1>
          <p className="mt-2 text-sm text-gray-600">This order link is invalid or expired.</p>
        </div>
      </div>
    );
  }

  const alreadyUsed = !!info.usedAt;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h1 className="text-xl font-semibold text-gray-900">Order Acceptance</h1>
          <p className="mt-1 text-sm text-gray-600">Order {info.order.orderNumber} — {info.order.title}</p>

          <div className="mt-4 space-y-2 text-sm text-gray-700">
            <div><span className="font-medium">Property:</span> {info.order.buildingAddress}</div>
            <div>
              <span className="font-medium">Scope:</span>
              <div className="mt-1 whitespace-pre-wrap text-gray-600">{info.order.scopeOfWork}</div>
            </div>
            <div><span className="font-medium">Total:</span> R{Number(info.order.totalAmount || 0).toFixed(2)}</div>
          </div>

          {alreadyUsed ? (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              This link has already been used. Thank you.
            </div>
          ) : (
            <>
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => acceptMutation.mutate({ submissionToken: token, notes: notes || undefined })}
                  disabled={acceptMutation.isPending}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                >
                  {acceptMutation.isPending ? "Accepting…" : "Accept Order"}
                </button>
                <a
                  href={`/external/order/${token}/invoice`}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                >
                  Upload Invoice
                </a>
              </div>
            </>
          )}

          <div className="mt-8 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
            <p className="text-sm text-indigo-900">
              Prefer a full portal account to manage work orders and invoices?
              <a href="/register" className="ml-2 font-semibold underline">Register</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
