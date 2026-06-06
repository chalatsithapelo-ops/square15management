import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import toast from "react-hot-toast";
import { Copy, Sparkles, X, FileText, Loader2, Wand2 } from "lucide-react";

export interface LineItemPayload {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  unitOfMeasure: string;
}

interface Props {
  token: string;
  clientId?: number | null;
  clientBuildingId?: number | null;
  serviceType?: string;
  address?: string;
  onReplaceItems: (items: LineItemPayload[]) => void;
}

/**
 * Combined launcher button that opens either:
 *  - "Clone past quote" picker, OR
 *  - "Generate scope from brief" AI panel
 *
 * Both populate the parent's line-items state.
 */
export function QuoteScopeBuilder({
  token,
  clientId,
  clientBuildingId,
  serviceType,
  address,
  onReplaceItems,
}: Props) {
  const trpc = useTRPC();
  const [open, setOpen] = useState<null | "clone" | "ai">(null);
  const [query, setQuery] = useState("");
  const [brief, setBrief] = useState("");

  const pastQuotes = useQuery(
    trpc.listApprovedQuotationsForTemplate.queryOptions(
      { token, query, clientId: clientId ?? undefined, clientBuildingId: clientBuildingId ?? undefined, limit: 15 },
      { enabled: open === "clone" && !!token }
    )
  );

  const generateMutation = useMutation(
    trpc.generateScopeFromBrief.mutationOptions({
      onSuccess: (data) => {
        if (!data?.items?.length) {
          toast.error("AI did not return any items.");
          return;
        }
        onReplaceItems(
          data.items.map((it: any) => ({
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            total: it.total,
            unitOfMeasure: it.unitOfMeasure,
          }))
        );
        toast.success(`AI generated ${data.items.length} line items using your catalog.`);
        setOpen(null);
        setBrief("");
      },
      onError: (err) => toast.error(err.message || "AI scope generation failed."),
    })
  );

  return (
    <>
      <div className="inline-flex gap-1">
        <button
          type="button"
          onClick={() => setOpen("clone")}
          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg"
          title="Clone the line items from a past approved quote"
        >
          <Copy className="h-3.5 w-3.5 mr-1" />
          Use past quote
        </button>
        <button
          type="button"
          onClick={() => setOpen("ai")}
          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg"
          title="Describe the job — AI drafts a scope using your verified catalog"
        >
          <Sparkles className="h-3.5 w-3.5 mr-1" />
          Scope from brief
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                {open === "clone" ? (
                  <>
                    <FileText className="h-4 w-4 text-blue-600" /> Clone scope from a past quote
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 text-emerald-600" /> Generate scope from brief (AI)
                  </>
                )}
              </h3>
              <button
                onClick={() => setOpen(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {open === "clone" && (
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 border-b bg-gray-50">
                  <input
                    type="text"
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by quote number, customer, address..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Showing approved quotes
                    {clientId ? " for this client" : ""}.
                  </p>
                </div>
                <div className="divide-y">
                  {pastQuotes.isLoading && (
                    <div className="p-6 text-center text-gray-500 text-sm">Loading…</div>
                  )}
                  {pastQuotes.data?.quotes?.length === 0 && (
                    <div className="p-6 text-center text-gray-500 text-sm">No matching past quotes.</div>
                  )}
                  {(pastQuotes.data?.quotes ?? []).map((q: any) => (
                    <div key={q.id} className="p-3 hover:bg-blue-50 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">
                          {q.quoteNumber} — {q.customerName}
                        </div>
                        <div className="text-xs text-gray-500 truncate">{q.address}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {q.itemCount} items • R{Number(q.total).toLocaleString()} •{" "}
                          {new Date(q.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onReplaceItems(q.items);
                          toast.success(`Loaded ${q.items.length} items from ${q.quoteNumber}`);
                          setOpen(null);
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
                      >
                        Use scope
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {open === "ai" && (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <p className="text-sm text-gray-600">
                  Describe the job in plain language. The AI will draft a quotation scope using your
                  verified catalog and this client's past prices — so it matches your Technical
                  Manager's standard.
                </p>
                <textarea
                  rows={5}
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="e.g. Three-bedroom flat in Riverside Manor needs full electrical compliance: replace 2 distribution boards, certify 9 plug points, and supply a CoC certificate. After-hours work."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <div className="text-xs text-gray-500">
                  Tip: include the property type, number of fixtures, brand preferences, and any
                  client-specific instructions.
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(null)}
                    className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={generateMutation.isPending || brief.trim().length < 8}
                    onClick={() =>
                      generateMutation.mutate({
                        token,
                        brief: brief.trim(),
                        serviceType,
                        address,
                        clientId: clientId ?? undefined,
                        clientBuildingId: clientBuildingId ?? undefined,
                      })
                    }
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded disabled:opacity-50"
                  >
                    {generateMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" /> Generate scope
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
