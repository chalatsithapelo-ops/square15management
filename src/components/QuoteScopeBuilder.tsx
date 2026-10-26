import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import toast from "react-hot-toast";
import {
  Copy,
  Sparkles,
  X,
  FileText,
  Loader2,
  Wand2,
  ChevronDown,
  ChevronRight,
  Layers,
  AlertTriangle,
} from "lucide-react";

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

type AiMode = "FAST" | "QS";

interface StudioBOMMaterial {
  materialName: string;
  supplier?: string | null;
  packSize?: number | null;
  packsRequired?: number;
  unitCost?: number;
  totalCost?: number;
  coverageRate?: number | null;
  coverageUnit?: string | null;
  warnings?: string[];
}

interface StudioBOMLabour {
  roleName: string;
  hours?: number;
  hourlyRate?: number;
  totalCost?: number;
}

interface StudioBOM {
  taskId?: number | null;
  category?: string;
  materials?: StudioBOMMaterial[];
  labour?: StudioBOMLabour[];
  materialsCost?: number;
  labourCost?: number;
  overheadCost?: number;
  costPrice?: number;
  suggestedPrice?: number;
  targetMarginPct?: number;
}

interface StudioLineItem {
  idx: number;
  description: string;
  originalBriefLine?: string;
  matchedTaskName?: string | null;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: number;
  total: number;
  cost?: number;
  marginPct?: number;
  unmatched?: boolean;
  warnings?: string[];
  bom?: StudioBOM | null;
}

interface StudioResult {
  brief: string;
  mode: string;
  lineItems: StudioLineItem[];
  totalCost: number;
  totalPrice: number;
  overallMarginPct: number;
  qsNotes?: string;
  generatedAt: string;
  catalogSize: number;
}

const fmtR = (n: number | undefined | null) =>
  typeof n === "number" && isFinite(n) ? `R${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—";

const fmtPct = (n: number | undefined | null) =>
  typeof n === "number" && isFinite(n) ? `${(n * 100).toFixed(1)}%` : "—";

/**
 * Combined launcher button that opens either:
 *  - "Clone past quote" picker, OR
 *  - "Generate scope from brief" AI panel (with Fast / QS-grade toggle)
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
  const [aiMode, setAiMode] = useState<AiMode>("QS");
  const [studioResult, setStudioResult] = useState<StudioResult | null>(null);
  const [expandedBom, setExpandedBom] = useState<Record<number, boolean>>({});

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
        closeAll();
      },
      onError: (err) => toast.error(err.message || "AI scope generation failed."),
    })
  );

  const studioMutation = useMutation(
    trpc.generateQuoteStudio.mutationOptions({
      onSuccess: (data: any) => {
        if (!data?.lineItems?.length) {
          toast.error("AI QS did not return any items — refine the brief and retry.");
          return;
        }
        setStudioResult(data as StudioResult);
        toast.success(
          `AI QS drafted ${data.lineItems.length} lines • cost ${fmtR(data.totalCost)} • price ${fmtR(data.totalPrice)}`
        );
      },
      onError: (err) =>
        toast.error(err.message || "AI QS scope generation failed. Please refine the brief and retry."),
    })
  );

  const closeAll = () => {
    setOpen(null);
    setBrief("");
    setStudioResult(null);
    setExpandedBom({});
  };

  const acceptStudioResult = () => {
    if (!studioResult) return;
    const items: LineItemPayload[] = studioResult.lineItems.map((li) => ({
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      total: li.total,
      unitOfMeasure: li.unitOfMeasure,
    }));
    onReplaceItems(items);
    toast.success(`Inserted ${items.length} QS-grade line items with BOM into quote.`);
    closeAll();
  };

  const runGeneration = () => {
    if (brief.trim().length < 8) return;
    if (aiMode === "FAST") {
      generateMutation.mutate({
        token,
        brief: brief.trim(),
        serviceType,
        address,
        clientId: clientId ?? undefined,
        clientBuildingId: clientBuildingId ?? undefined,
      });
    } else {
      setStudioResult(null);
      setExpandedBom({});
      studioMutation.mutate({
        token,
        brief: brief.trim(),
        mode: "PROJECT",
        address,
        serviceType,
        clientId: clientId ?? undefined,
        clientBuildingId: clientBuildingId ?? undefined,
      } as any);
    }
  };

  const anyPending = generateMutation.isPending || studioMutation.isPending;

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
          title="Describe the job — AI drafts a scope (Fast or QS-grade with full BOM)"
        >
          <Sparkles className="h-3.5 w-3.5 mr-1" />
          Scope from brief
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
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
              <button onClick={closeAll} className="text-gray-400 hover:text-gray-600">
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
                          closeAll();
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
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Mode toggle */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAiMode("FAST")}
                    className={`text-left p-3 rounded-lg border-2 transition ${
                      aiMode === "FAST"
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      <div className="text-sm font-semibold text-gray-900">Fast estimate</div>
                    </div>
                    <div className="text-xs text-gray-600">
                      AI picks from your verified line-item catalog + this client's past prices. Best for
                      standard scopes.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiMode("QS")}
                    className={`text-left p-3 rounded-lg border-2 transition ${
                      aiMode === "QS"
                        ? "border-fuchsia-500 bg-fuchsia-50"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Layers className="h-4 w-4 text-fuchsia-600" />
                      <div className="text-sm font-semibold text-gray-900">QS-grade (with BOM)</div>
                    </div>
                    <div className="text-xs text-gray-600">
                      AI Quantity Surveyor: builds materials + labour bill, checks coverage (e.g. paint per
                      m²), applies margin. Slower, deeper.
                    </div>
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Describe the job</label>
                  <textarea
                    rows={4}
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    placeholder={
                      aiMode === "QS"
                        ? "e.g. Paint interior of office room, 120 m², 2 coats Plascon white. Then supply and install 5 new double wall sockets and 3 light switches in reception, include cabling."
                        : "e.g. Three-bedroom flat needs full electrical compliance: replace 2 distribution boards, certify 9 plug points, supply a CoC certificate."
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {aiMode === "QS"
                      ? "Include quantities & areas (m², units, coats) — the QS engine uses them to size materials and labour."
                      : "Include property type, number of fixtures, brand preferences, and any client-specific instructions."}
                  </p>
                </div>

                {/* Studio result preview */}
                {aiMode === "QS" && studioResult && (
                  <div className="border border-fuchsia-200 rounded-lg bg-fuchsia-50/40 p-3 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="text-fuchsia-900 font-semibold">
                        QS draft — {studioResult.lineItems.length} lines
                      </div>
                      <div className="text-gray-700">
                        Cost <span className="font-semibold">{fmtR(studioResult.totalCost)}</span> • Price{" "}
                        <span className="font-semibold">{fmtR(studioResult.totalPrice)}</span> • Margin{" "}
                        <span className="font-semibold">{fmtPct(studioResult.overallMarginPct)}</span>
                      </div>
                    </div>

                    {studioResult.qsNotes && (
                      <div className="text-xs bg-amber-50 border border-amber-200 rounded p-2 text-amber-900 flex gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                        <div>{studioResult.qsNotes}</div>
                      </div>
                    )}

                    <div className="space-y-2">
                      {studioResult.lineItems.map((li) => {
                        const expanded = !!expandedBom[li.idx];
                        return (
                          <div
                            key={li.idx}
                            className="bg-white border border-gray-200 rounded-lg overflow-hidden"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedBom((prev) => ({ ...prev, [li.idx]: !prev[li.idx] }))
                              }
                              className="w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-gray-50"
                            >
                              {expanded ? (
                                <ChevronDown className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {li.description}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {li.quantity} {li.unitOfMeasure} × {fmtR(li.unitPrice)} ={" "}
                                  <span className="font-semibold text-gray-800">{fmtR(li.total)}</span>
                                  {li.marginPct != null && (
                                    <> • margin {fmtPct(li.marginPct)}</>
                                  )}
                                  {li.unmatched && (
                                    <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                      unmatched
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>

                            {expanded && (
                              <div className="border-t bg-gray-50/60 p-3 text-xs space-y-2">
                                {li.matchedTaskName && (
                                  <div className="text-gray-600">
                                    Matched task: <span className="font-medium">{li.matchedTaskName}</span>
                                  </div>
                                )}
                                {li.warnings && li.warnings.length > 0 && (
                                  <div className="bg-amber-50 border border-amber-200 rounded p-2 text-amber-900">
                                    <div className="font-semibold mb-0.5">Warnings</div>
                                    <ul className="list-disc ml-4 space-y-0.5">
                                      {li.warnings.map((w, i) => (
                                        <li key={i}>{w}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {li.bom?.materials && li.bom.materials.length > 0 && (
                                  <div>
                                    <div className="font-semibold text-gray-800 mb-1">Materials</div>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-xs">
                                        <thead className="text-gray-500">
                                          <tr>
                                            <th className="text-left font-medium py-1 pr-2">Item</th>
                                            <th className="text-left font-medium py-1 pr-2">Supplier</th>
                                            <th className="text-right font-medium py-1 pr-2">Packs</th>
                                            <th className="text-right font-medium py-1 pr-2">Unit</th>
                                            <th className="text-right font-medium py-1">Total</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {li.bom.materials.map((m, i) => (
                                            <tr key={i} className="border-t border-gray-100">
                                              <td className="py-1 pr-2 text-gray-800">{m.materialName}</td>
                                              <td className="py-1 pr-2 text-gray-600">
                                                {m.supplier || "—"}
                                              </td>
                                              <td className="py-1 pr-2 text-right text-gray-700">
                                                {m.packsRequired ?? "—"}
                                                {m.packSize ? ` × ${m.packSize}` : ""}
                                              </td>
                                              <td className="py-1 pr-2 text-right text-gray-700">
                                                {fmtR(m.unitCost)}
                                              </td>
                                              <td className="py-1 text-right text-gray-900 font-medium">
                                                {fmtR(m.totalCost)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}

                                {li.bom?.labour && li.bom.labour.length > 0 && (
                                  <div>
                                    <div className="font-semibold text-gray-800 mb-1">Labour</div>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-xs">
                                        <thead className="text-gray-500">
                                          <tr>
                                            <th className="text-left font-medium py-1 pr-2">Role</th>
                                            <th className="text-right font-medium py-1 pr-2">Hours</th>
                                            <th className="text-right font-medium py-1 pr-2">Rate</th>
                                            <th className="text-right font-medium py-1">Total</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {li.bom.labour.map((l, i) => (
                                            <tr key={i} className="border-t border-gray-100">
                                              <td className="py-1 pr-2 text-gray-800">{l.roleName}</td>
                                              <td className="py-1 pr-2 text-right text-gray-700">
                                                {l.hours ?? "—"}
                                              </td>
                                              <td className="py-1 pr-2 text-right text-gray-700">
                                                {fmtR(l.hourlyRate)}
                                              </td>
                                              <td className="py-1 text-right text-gray-900 font-medium">
                                                {fmtR(l.totalCost)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}

                                {li.bom && (
                                  <div className="flex flex-wrap gap-3 pt-1 border-t border-gray-200 text-gray-700">
                                    <span>
                                      Materials: <b>{fmtR(li.bom.materialsCost)}</b>
                                    </span>
                                    <span>
                                      Labour: <b>{fmtR(li.bom.labourCost)}</b>
                                    </span>
                                    <span>
                                      Overhead: <b>{fmtR(li.bom.overheadCost)}</b>
                                    </span>
                                    <span>
                                      Cost: <b>{fmtR(li.bom.costPrice)}</b>
                                    </span>
                                    <span className="text-emerald-800">
                                      Sell: <b>{fmtR(li.bom.suggestedPrice)}</b>
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeAll}
                    className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                  >
                    Cancel
                  </button>
                  {aiMode === "QS" && studioResult ? (
                    <>
                      <button
                        type="button"
                        onClick={runGeneration}
                        disabled={anyPending || brief.trim().length < 8}
                        className="px-3 py-2 text-sm font-medium text-fuchsia-700 bg-fuchsia-50 hover:bg-fuchsia-100 rounded disabled:opacity-50"
                      >
                        Regenerate
                      </button>
                      <button
                        type="button"
                        onClick={acceptStudioResult}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-fuchsia-600 hover:bg-fuchsia-700 rounded"
                      >
                        <Layers className="h-4 w-4 mr-2" />
                        Insert {studioResult.lineItems.length} lines into quote
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={anyPending || brief.trim().length < 8}
                      onClick={runGeneration}
                      className={`inline-flex items-center px-4 py-2 text-sm font-medium text-white rounded disabled:opacity-50 ${
                        aiMode === "QS"
                          ? "bg-fuchsia-600 hover:bg-fuchsia-700"
                          : "bg-emerald-600 hover:bg-emerald-700"
                      }`}
                    >
                      {anyPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {aiMode === "QS" ? "Running AI QS…" : "Generating…"}
                        </>
                      ) : aiMode === "QS" ? (
                        <>
                          <Layers className="h-4 w-4 mr-2" /> Generate QS scope
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" /> Generate scope
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
