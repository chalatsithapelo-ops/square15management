import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  ArrowLeft,
  Loader2,
  Wrench,
  Users,
  Layers,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
  Save,
  Info,
  Package,
  ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/admin/quotes/studio")({
  component: QuoteStudioPage,
});

// ─────────────────────────────────────────────────────────────────────
// Types (loose — matches the tRPC output shape)
// ─────────────────────────────────────────────────────────────────────
type BOMMaterial = {
  materialId: number;
  materialName: string;
  brand?: string | null;
  category: string;
  packSize: number;
  packUnit: string;
  supplierId: number | null;
  supplierName: string | null;
  qtyPerUnitOfWork: number;
  rawQty: number;
  wastagePct: number;
  qtyWithWastage: number;
  packsNeeded: number;
  qtyPurchased: number;
  unitPricePerPack: number;
  priceFetchedAt: string | Date | null;
  priceIsStale: boolean;
  sourceUrl: string | null;
  costTotal: number;
  coverageCheck?: {
    unitsCovered: number;
    unitsRequired: number;
    ok: boolean;
    note: string;
  };
};

type BOMLabour = {
  labourRoleId: number;
  code: string;
  name: string;
  crewCount: number;
  personDays: number;
  dailyRate: number;
  overheadMultiplier: number;
  effectiveDailyRate: number;
  costTotal: number;
};

type StudioLine = {
  idx: number;
  description: string;
  originalBriefLine: string;
  matchedTaskName: string | null;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: number;
  total: number;
  cost: number;
  marginPct: number;
  unmatched: boolean;
  warnings: string[];
  bom: {
    taskId: number;
    category: string;
    materials: BOMMaterial[];
    labour: BOMLabour[];
    materialsCost: number;
    labourCost: number;
    overheadCost: number;
    costPrice: number;
    suggestedPrice: number;
    targetMarginPct: number;
  } | null;
};

type StudioResult = {
  brief: string;
  mode: string;
  lineItems: StudioLine[];
  totalCost: number;
  totalPrice: number;
  overallMarginPct: number;
  qsNotes: string;
  generatedAt: string;
  catalogSize: number;
};

// ─────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────
function money(n: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}
function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}
function round1(n: number) {
  return Math.round(n * 10) / 10;
}

const EXAMPLE_BRIEFS = [
  "Painting of office room with 2 coats Plascon white, 120 m². Please include prep and drop sheets.",
  "5 new double wall sockets and 3 light switches in reception. Include cabling and rework.",
  "Tile 22 m² kitchen floor with 400x400 ceramic tiles and replace basin mixer tap.",
  "Plaster + paint 60 m² of exterior wall (weatherguard), 2 coats.",
];

// ─────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────
function QuoteStudioPage() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const navigate = useNavigate();

  const [brief, setBrief] = useState("");
  const [mode, setMode] = useState<"PROJECT" | "LINE">("PROJECT");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [overrideMarginPct, setOverrideMarginPct] = useState<number | "">("");
  const [expandedLine, setExpandedLine] = useState<number | null>(null);
  const [result, setResult] = useState<StudioResult | null>(null);

  useEffect(() => {
    if (
      user &&
      !["ADMIN", "SENIOR_ADMIN", "JUNIOR_ADMIN", "MANAGER", "TECHNICAL_MANAGER", "ACCOUNTANT"].includes(user.role)
    ) {
      navigate({ to: "/admin/dashboard" });
    }
  }, [user, navigate]);

  const generate = useMutation(
    trpc.generateQuoteStudio.mutationOptions({
      onSuccess: (data) => {
        setResult(data as any);
        setExpandedLine(0);
        toast.success(`AI drafted ${data.lineItems.length} line items — review below.`);
      },
      onError: (err) => toast.error(err.message || "AI generation failed."),
    })
  );

  const persist = useMutation(
    trpc.persistStudioQuote.mutationOptions({
      onSuccess: (r) => {
        toast.success(`Saved as ${r.quoteNumber}`);
        navigate({ to: `/admin/quotations/${r.quotationId}` as any });
      },
      onError: (err) => toast.error(err.message || "Save failed."),
    })
  );

  const refresh = useMutation(
    trpc.refreshMaterialPrice.mutationOptions({
      onSuccess: (r) => {
        toast.success(`Refreshed: ${money(r.unitPrice)} per pack (${r.method})`);
        if (result) {
          // regenerate to pick up new prices
          generate.mutate({
            token: token!,
            brief: result.brief,
            mode: (result.mode as any) ?? "PROJECT",
            overrideMarginPct: overrideMarginPct === "" ? undefined : overrideMarginPct,
          });
        }
      },
      onError: (err) => toast.error(err.message || "Refresh failed."),
    })
  );

  const canSave = useMemo(
    () => !!result && !!customerName.trim() && result.lineItems.length > 0,
    [result, customerName]
  );

  function handleGenerate() {
    if (!token) return;
    if (brief.trim().length < 8) {
      toast.error("Brief must be at least 8 characters.");
      return;
    }
    generate.mutate({
      token,
      brief: brief.trim(),
      mode,
      address: address || undefined,
      overrideMarginPct: overrideMarginPct === "" ? undefined : overrideMarginPct,
    });
  }

  function handleSave() {
    if (!token || !result) return;
    persist.mutate({
      token,
      brief: result.brief,
      customerName: customerName.trim(),
      customerEmail: customerEmail || undefined,
      customerPhone: customerPhone || undefined,
      address: address || undefined,
      qsNotes: result.qsNotes,
      lineItems: result.lineItems.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitOfMeasure: l.unitOfMeasure,
        unitPrice: l.unitPrice,
        total: l.total,
        cost: l.cost,
        bom: l.bom
          ? {
              taskId: l.bom.taskId,
              category: l.bom.category,
              materials: l.bom.materials as any,
              labour: l.bom.labour as any,
            }
          : null,
      })),
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            to="/admin/dashboard"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Dashboard
          </Link>
          <div className="ml-2 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-fuchsia-500 to-purple-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                AI Quote &amp; Invoice Studio
              </h1>
              <p className="text-xs text-gray-500">
                Describe the job — the AI QS drafts materials, labour, coverage checks and profit.
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ─── Left: Brief + settings ─────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border p-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Mode
            </label>
            <div className="mt-1 flex gap-2">
              {(["PROJECT", "LINE"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border ${
                    mode === m
                      ? "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {m === "PROJECT" ? "Project brief" : "Single line"}
                </button>
              ))}
            </div>

            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-4 block">
              Project / line brief
            </label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={7}
              placeholder="e.g. Painting of office room with 2 coats Plascon white, 120 m². Include prep and 5 new double sockets in reception."
              className="mt-1 w-full rounded-lg border-gray-300 border p-3 text-sm focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500"
            />

            <div className="mt-2 text-xs text-gray-500">
              <div className="font-medium mb-1">Try an example:</div>
              <div className="flex flex-wrap gap-1">
                {EXAMPLE_BRIEFS.map((b, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setBrief(b)}
                    className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                  >
                    Example {i + 1}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Address (optional)
                </label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="mt-1 w-full rounded-lg border-gray-300 border p-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Margin override (0–0.9)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={0.9}
                  value={overrideMarginPct}
                  onChange={(e) =>
                    setOverrideMarginPct(
                      e.target.value === "" ? "" : parseFloat(e.target.value)
                    )
                  }
                  className="mt-1 w-full rounded-lg border-gray-300 border p-2 text-sm"
                  placeholder="Use task default"
                />
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generate.isPending || brief.trim().length < 8}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700 text-white font-medium py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {generate.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {generate.isPending ? "Drafting quote…" : "Generate quote"}
            </button>
          </div>

          {/* Customer block */}
          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Customer (for saving)</h3>
            <div className="grid grid-cols-1 gap-3">
              <input
                placeholder="Customer name *"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="rounded-lg border-gray-300 border p-2 text-sm"
              />
              <input
                placeholder="Email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="rounded-lg border-gray-300 border p-2 text-sm"
              />
              <input
                placeholder="Phone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="rounded-lg border-gray-300 border p-2 text-sm"
              />
            </div>
          </div>
        </div>

        {/* ─── Right: Results ────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">
          {!result && (
            <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-10 text-center">
              <Wrench className="h-8 w-8 mx-auto text-gray-400" />
              <p className="mt-3 text-sm text-gray-500">
                Describe the job on the left, then click <span className="font-medium">Generate quote</span> to see a QS-grade draft with materials, labour and profit breakdown.
              </p>
            </div>
          )}

          {result && (
            <>
              {/* Summary card */}
              <div className="bg-white rounded-xl border p-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 uppercase">Total quoted</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {money(result.totalPrice)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase">Total cost</div>
                    <div className="text-2xl font-semibold text-gray-700">
                      {money(result.totalCost)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase">Overall margin</div>
                    <div
                      className={`text-2xl font-semibold ${
                        result.overallMarginPct >= 0.25
                          ? "text-emerald-600"
                          : result.overallMarginPct >= 0.15
                          ? "text-amber-600"
                          : "text-red-600"
                      }`}
                    >
                      {pct(result.overallMarginPct)}
                    </div>
                  </div>
                </div>
                {result.qsNotes && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex gap-2">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">QS notes / assumptions</div>
                      <div>{result.qsNotes}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Line items */}
              <div className="bg-white rounded-xl border overflow-hidden">
                {result.lineItems.map((l) => (
                  <div key={l.idx} className="border-b last:border-b-0">
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
                      onClick={() =>
                        setExpandedLine(expandedLine === l.idx ? null : l.idx)
                      }
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {expandedLine === l.idx ? (
                          <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {l.description}
                          </div>
                          <div className="text-xs text-gray-500">
                            {l.quantity} {l.unitOfMeasure} · {money(l.unitPrice)}/{l.unitOfMeasure}
                            {l.matchedTaskName ? ` · ${l.matchedTaskName}` : " · No catalog match"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm font-semibold text-gray-900">
                            {money(l.total)}
                          </div>
                          <div
                            className={`text-xs ${
                              l.marginPct >= 0.25
                                ? "text-emerald-600"
                                : l.marginPct >= 0.15
                                ? "text-amber-600"
                                : "text-red-600"
                            }`}
                          >
                            {pct(l.marginPct)} margin
                          </div>
                        </div>
                        {l.unmatched && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                            No BOM
                          </span>
                        )}
                      </div>
                    </button>

                    {expandedLine === l.idx && (
                      <div className="px-4 pb-4 bg-gray-50 border-t">
                        {l.warnings.length > 0 && (
                          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800">
                            {l.warnings.map((w, i) => (
                              <div key={i} className="flex gap-1">
                                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                                {w}
                              </div>
                            ))}
                          </div>
                        )}
                        {l.bom ? (
                          <>
                            {/* Materials */}
                            <div className="mt-3">
                              <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                                <Package className="h-3.5 w-3.5" />
                                Materials
                              </div>
                              <div className="bg-white rounded-lg border divide-y">
                                {l.bom.materials.map((m, i) => (
                                  <div key={i} className="p-3 grid grid-cols-12 gap-2 text-xs">
                                    <div className="col-span-5">
                                      <div className="font-medium text-gray-900">
                                        {m.materialName}
                                      </div>
                                      <div className="text-gray-500">
                                        {m.brand ? `${m.brand} · ` : ""}
                                        {m.supplierName ?? "No supplier"}{" "}
                                        {m.priceIsStale && (
                                          <span className="ml-1 px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">
                                            stale price
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="col-span-2 text-gray-600">
                                      {round1(m.rawQty)} → {round1(m.qtyWithWastage)} {m.packUnit}
                                      <div className="text-[10px] text-gray-400">
                                        +{Math.round(m.wastagePct * 100)}% waste
                                      </div>
                                    </div>
                                    <div className="col-span-2 text-gray-600">
                                      {m.packsNeeded} × {m.packSize} {m.packUnit}
                                      <div className="text-[10px] text-gray-400">
                                        = {round1(m.qtyPurchased)} {m.packUnit}
                                      </div>
                                    </div>
                                    <div className="col-span-3 text-right">
                                      <div className="text-gray-500">
                                        {money(m.unitPricePerPack)} / pack
                                      </div>
                                      <div className="font-semibold text-gray-900">
                                        {money(m.costTotal)}
                                      </div>
                                      {m.sourceUrl && (
                                        <a
                                          href={m.sourceUrl}
                                          target="_blank"
                                          rel="noreferrer noopener"
                                          className="text-[10px] text-blue-600 hover:underline"
                                        >
                                          source
                                        </a>
                                      )}
                                    </div>
                                    {m.coverageCheck && (
                                      <div
                                        className={`col-span-12 text-[11px] rounded p-1.5 flex items-center gap-1 ${
                                          m.coverageCheck.ok
                                            ? "bg-emerald-50 text-emerald-700"
                                            : "bg-red-50 text-red-700"
                                        }`}
                                      >
                                        <ShieldCheck className="h-3 w-3 shrink-0" />
                                        {m.coverageCheck.note}
                                      </div>
                                    )}
                                    <div className="col-span-12 flex justify-end">
                                      <RefreshPriceInline
                                        materialId={m.materialId}
                                        supplierId={m.supplierId}
                                        currentUrl={m.sourceUrl}
                                        disabled={refresh.isPending}
                                        onRefresh={(url) =>
                                          refresh.mutate({
                                            token: token!,
                                            materialId: m.materialId,
                                            supplierId: m.supplierId ?? undefined,
                                            url,
                                          })
                                        }
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Labour */}
                            <div className="mt-4">
                              <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                                <Users className="h-3.5 w-3.5" />
                                Labour
                              </div>
                              <div className="bg-white rounded-lg border divide-y">
                                {l.bom.labour.map((lb, i) => (
                                  <div key={i} className="p-3 grid grid-cols-12 gap-2 text-xs">
                                    <div className="col-span-5 font-medium text-gray-900">
                                      {lb.name}
                                      <div className="text-[10px] text-gray-400">
                                        {lb.crewCount} × {lb.code}
                                      </div>
                                    </div>
                                    <div className="col-span-3 text-gray-600">
                                      {round1(lb.personDays)} person-days
                                    </div>
                                    <div className="col-span-4 text-right">
                                      <div className="text-gray-500">
                                        {money(lb.effectiveDailyRate)} / day
                                      </div>
                                      <div className="font-semibold text-gray-900">
                                        {money(lb.costTotal)}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Cost breakdown footer */}
                            <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
                              <div className="bg-white rounded p-2 border">
                                <div className="text-gray-500">Materials</div>
                                <div className="font-semibold">{money(l.bom.materialsCost)}</div>
                              </div>
                              <div className="bg-white rounded p-2 border">
                                <div className="text-gray-500">Labour</div>
                                <div className="font-semibold">{money(l.bom.labourCost)}</div>
                              </div>
                              <div className="bg-white rounded p-2 border">
                                <div className="text-gray-500">Overhead</div>
                                <div className="font-semibold">{money(l.bom.overheadCost)}</div>
                              </div>
                              <div className="bg-fuchsia-50 rounded p-2 border border-fuchsia-200">
                                <div className="text-fuchsia-600">Quoted</div>
                                <div className="font-semibold text-fuchsia-800">
                                  {money(l.bom.suggestedPrice)}
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="mt-3 text-xs text-gray-500 italic">
                            No BOM breakdown — the AI could not match this line to a task template. Add it manually in the Quote editor after saving.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Save bar */}
              <div className="sticky bottom-0 bg-white border rounded-xl p-3 shadow-lg flex items-center gap-3">
                <div className="flex-1 text-sm text-gray-600">
                  {canSave
                    ? "Ready to save as a draft quotation."
                    : "Enter a customer name on the left before saving."}
                </div>
                <button
                  disabled={!canSave || persist.isPending}
                  onClick={handleSave}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {persist.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save as draft quotation
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Small inline "refresh price from URL" widget
// ─────────────────────────────────────────────────────────────────────
function RefreshPriceInline(props: {
  materialId: number;
  supplierId: number | null;
  currentUrl: string | null;
  disabled?: boolean;
  onRefresh: (url: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(props.currentUrl ?? "");
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        disabled={props.disabled}
        className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline"
      >
        <RefreshCw className="h-3 w-3" />
        {props.currentUrl ? "Refresh price" : "Set supplier URL"}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1 w-full">
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://www.builders.co.za/product/..."
        className="flex-1 rounded border-gray-300 border p-1 text-[11px]"
      />
      <button
        type="button"
        disabled={props.disabled || !url.trim()}
        onClick={() => {
          if (url.trim()) props.onRefresh(url.trim());
          setEditing(false);
        }}
        className="rounded bg-blue-600 text-white text-[11px] px-2 py-1 disabled:opacity-50"
      >
        Fetch
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="rounded bg-gray-100 text-gray-700 text-[11px] px-2 py-1"
      >
        Cancel
      </button>
    </div>
  );
}
