import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Search,
  CheckCircle2,
  ShieldCheck,
  Plus,
  Edit,
  Trash2,
  TrendingUp,
  AlertTriangle,
  Activity,
  BookOpen,
  Wand2,
  Loader2,
  Sparkles,
  RefreshCcw,
  Tag,
} from "lucide-react";

export const Route = createFileRoute("/admin/pricing-library/")({
  component: PricingLibraryPage,
});

const CURATE_ROLES = new Set([
  "SENIOR_ADMIN",
  "TECHNICAL_MANAGER",
  "MANAGER",
  "ADMIN",
]);

function PricingLibraryPage() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const canCurate = CURATE_ROLES.has(user?.role ?? "");

  const [tab, setTab] = useState<"library" | "anomalies">("library");
  const [query, setQuery] = useState("");
  const [verified, setVerified] = useState<"ALL" | "VERIFIED" | "UNVERIFIED">("ALL");
  const [source, setSource] = useState<"ALL" | "MANUAL" | "LEARNED_FROM_QUOTE" | "LEARNED_FROM_INVOICE">(
    "ALL"
  );
  const [sort, setSort] = useState<"recent" | "popular" | "alpha">("popular");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const libraryQuery = useQuery(
    trpc.getPricingLibrary.queryOptions(
      {
        token: token!,
        query,
        verified,
        source,
        sort,
        page,
        pageSize: 25,
      },
      { enabled: !!token }
    )
  );

  const anomaliesQuery = useQuery(
    trpc.getPricingAnomalies.queryOptions({ token: token!, days: 60 }, { enabled: !!token && tab === "anomalies" })
  );

  const verifyMutation = useMutation(
    trpc.verifyPricingCatalogItem.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.getPricingLibrary.queryKey() });
        toast.success("Updated");
      },
      onError: (e) => toast.error(e.message),
    })
  );

  const deleteMutation = useMutation(
    trpc.deletePricingCatalogItem.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.getPricingLibrary.queryKey() });
        toast.success("Removed");
      },
      onError: (e) => toast.error(e.message),
    })
  );

  const upsertMutation = useMutation(
    trpc.upsertPricingCatalogItem.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.getPricingLibrary.queryKey() });
        toast.success("Saved");
        setEditing(null);
        setShowCreate(false);
      },
      onError: (e) => toast.error(e.message),
    })
  );

  const backfillMutation = useMutation(
    trpc.backfillPricingCatalog.mutationOptions({
      onSuccess: (data) => {
        toast.success(
          `Backfill done. ${data.processedQuotes} quotes • ${data.totalCreated} new • ${data.totalUpdated} updated`
        );
        queryClient.invalidateQueries({ queryKey: trpc.getPricingLibrary.queryKey() });
      },
      onError: (e) => toast.error(e.message),
    })
  );

  const total = libraryQuery.data?.total ?? 0;
  const items: any[] = libraryQuery.data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Link to="/admin/dashboard" className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center mb-2">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-purple-600" /> Pricing Library
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Your self-learning catalog of approved prices. The Technical Manager verifies items so
              juniors can quote at your standard.
            </p>
          </div>
          {canCurate && (
            <div className="flex gap-2">
              <button
                onClick={() => backfillMutation.mutate({ token: token!, limit: 1000 })}
                disabled={backfillMutation.isPending}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg disabled:opacity-50"
                title="Scan past approved quotations and import their line items"
              >
                {backfillMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4 mr-1" />
                )}
                Backfill from history
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg"
              >
                <Plus className="h-4 w-4 mr-1" /> New verified item
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-1 border-b border-gray-200 mb-4">
          {[
            { key: "library", label: "Library", icon: BookOpen },
            { key: "anomalies", label: "Anomalies & insights", icon: Activity },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key as any)}
                className={`px-4 py-2 text-sm font-medium border-b-2 ${
                  tab === t.key
                    ? "border-purple-600 text-purple-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon className="h-4 w-4 inline mr-1.5" /> {t.label}
              </button>
            );
          })}
        </div>

        {tab === "library" && (
          <>
            <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3 flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search description, category, tags…"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>
              <select
                value={verified}
                onChange={(e) => {
                  setVerified(e.target.value as any);
                  setPage(1);
                }}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              >
                <option value="ALL">All items</option>
                <option value="VERIFIED">Verified only</option>
                <option value="UNVERIFIED">Unverified only</option>
              </select>
              <select
                value={source}
                onChange={(e) => {
                  setSource(e.target.value as any);
                  setPage(1);
                }}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              >
                <option value="ALL">Any source</option>
                <option value="MANUAL">Manual (template)</option>
                <option value="LEARNED_FROM_QUOTE">Learned from quote</option>
                <option value="LEARNED_FROM_INVOICE">Learned from invoice</option>
              </select>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              >
                <option value="popular">Most used</option>
                <option value="recent">Recently used</option>
                <option value="alpha">A–Z</option>
              </select>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 text-xs text-gray-500 border-b bg-gray-50 flex items-center justify-between">
                <div>{total.toLocaleString()} items</div>
                <div>
                  Page {page} of {totalPages}
                </div>
              </div>
              {libraryQuery.isLoading ? (
                <div className="p-8 text-center text-gray-500">Loading…</div>
              ) : items.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No items match. Try "Backfill from history" to import past approved quotes.
                </div>
              ) : (
                <ul className="divide-y">
                  {items.map((it) => (
                    <li key={it.id} className="px-3 py-3 flex items-start gap-3 hover:bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {it.isVerified ? (
                            <ShieldCheck className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <span className="text-xs text-gray-400">unverified</span>
                          )}
                          <div className="text-sm font-medium text-gray-900 truncate">{it.name}</div>
                          {it.source !== "MANUAL" && (
                            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                              learned
                            </span>
                          )}
                          {it.category && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                              {it.category}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 truncate">{it.description}</div>
                        <div className="text-xs text-gray-600 mt-1 flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-purple-700">
                            R{Number(it.unitPrice).toLocaleString()} / {it.unitOfMeasure}
                          </span>
                          {it.avgUnitPrice && (
                            <span>
                              avg R{Number(it.avgUnitPrice).toLocaleString()} (R{Number(it.minUnitPrice || 0).toLocaleString()}–R{Number(it.maxUnitPrice || 0).toLocaleString()})
                            </span>
                          )}
                          <span className="inline-flex items-center gap-0.5">
                            <TrendingUp className="h-3 w-3" /> {it.usageCount}× used
                          </span>
                          {it.lastUsedAt && (
                            <span>last {new Date(it.lastUsedAt).toLocaleDateString()}</span>
                          )}
                          {it.defaultCost > 0 && (
                            <span>cost R{Number(it.defaultCost).toLocaleString()}</span>
                          )}
                        </div>
                        {Array.isArray(it.tags) && it.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {it.tags.map((tg: string) => (
                              <span
                                key={tg}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 inline-flex items-center"
                              >
                                <Tag className="h-2.5 w-2.5 mr-0.5" />
                                {tg}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {canCurate && (
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() =>
                              verifyMutation.mutate({
                                token: token!,
                                id: it.id,
                                isVerified: !it.isVerified,
                              })
                            }
                            className={`text-xs px-2 py-1 rounded ${
                              it.isVerified
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                : "bg-gray-100 text-gray-700 hover:bg-emerald-100"
                            }`}
                          >
                            {it.isVerified ? "Verified" : "Verify"}
                          </button>
                          <button
                            onClick={() => setEditing(it)}
                            className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
                          >
                            <Edit className="h-3 w-3 inline" /> Edit
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Remove "${it.name}" from catalog?`)) {
                                deleteMutation.mutate({ token: token!, id: it.id });
                              }
                            }}
                            className="text-xs px-2 py-1 rounded text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3 inline" /> Remove
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div className="px-3 py-2 border-t flex justify-end gap-2 bg-gray-50">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2 py-1 text-xs rounded border border-gray-300 disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2 py-1 text-xs rounded border border-gray-300 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}

        {tab === "anomalies" && (
          <AnomaliesView
            data={anomaliesQuery.data}
            loading={anomaliesQuery.isLoading}
          />
        )}
      </div>

      {(editing || showCreate) && canCurate && (
        <EditModal
          item={editing}
          onCancel={() => {
            setEditing(null);
            setShowCreate(false);
          }}
          onSave={(payload) => upsertMutation.mutate({ token: token!, ...payload })}
          isSaving={upsertMutation.isPending}
        />
      )}
    </div>
  );
}

function EditModal({
  item,
  onCancel,
  onSave,
  isSaving,
}: {
  item: any | null;
  onCancel: () => void;
  onSave: (payload: any) => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [unitPrice, setUnitPrice] = useState(item?.unitPrice ?? 0);
  const [defaultCost, setDefaultCost] = useState(item?.defaultCost ?? 0);
  const [unitOfMeasure, setUnitOfMeasure] = useState(item?.unitOfMeasure ?? "Sum");
  const [category, setCategory] = useState(item?.category ?? "");
  const [tags, setTags] = useState((item?.tags ?? []).join(", "));
  const [isVerified, setIsVerified] = useState(item?.isVerified ?? true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          {item ? "Edit catalog item" : "New verified catalog item"}
        </h2>
        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Short name (e.g. Geyser replacement 150L)"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
          />
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description as it will appear on the quote"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              value={unitPrice}
              onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
              placeholder="Selling price"
              className="px-3 py-2 text-sm border border-gray-300 rounded"
            />
            <input
              type="number"
              value={defaultCost}
              onChange={(e) => setDefaultCost(parseFloat(e.target.value) || 0)}
              placeholder="Cost to company"
              className="px-3 py-2 text-sm border border-gray-300 rounded"
            />
            <select
              value={unitOfMeasure}
              onChange={(e) => setUnitOfMeasure(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded"
            >
              <option value="Sum">Sum</option>
              <option value="m2">m²</option>
              <option value="m3">m³</option>
              <option value="Lm">Lm</option>
              <option value="Hr">Hour</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category (e.g. Plumbing)"
              className="px-3 py-2 text-sm border border-gray-300 rounded"
            />
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Tags (comma separated)"
              className="px-3 py-2 text-sm border border-gray-300 rounded"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isVerified}
              onChange={(e) => setIsVerified(e.target.checked)}
            />
            Mark as Verified (TM-approved standard)
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-2 text-sm rounded hover:bg-gray-100">
            Cancel
          </button>
          <button
            disabled={isSaving || !name.trim() || !description.trim() || unitPrice <= 0}
            onClick={() =>
              onSave({
                id: item?.id,
                name: name.trim(),
                description: description.trim(),
                unitPrice,
                defaultCost,
                unitOfMeasure,
                category: category.trim() || null,
                tags: tags
                  .split(",")
                  .map((t) => t.trim().toLowerCase())
                  .filter(Boolean),
                isVerified,
                isActive: true,
              })
            }
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AnomaliesView({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <div className="p-8 text-center text-gray-500">Analysing pricing…</div>;
  if (!data) return null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs uppercase text-gray-500">Catalog items analysed</div>
          <div className="text-2xl font-bold mt-1">{data.summary?.catalogItems ?? 0}</div>
        </div>
        <div className="bg-white border border-amber-200 rounded-lg p-4">
          <div className="text-xs uppercase text-amber-700">Price drift flagged</div>
          <div className="text-2xl font-bold mt-1 text-amber-700">
            {data.summary?.flaggedDrift ?? 0}
          </div>
          <div className="text-xs text-gray-500 mt-1">items with &gt;50% min↔max spread</div>
        </div>
        <div className="bg-white border border-red-200 rounded-lg p-4">
          <div className="text-xs uppercase text-red-700">Low-margin quotes</div>
          <div className="text-2xl font-bold mt-1 text-red-700">
            {data.summary?.flaggedLowMargin ?? 0}
          </div>
          <div className="text-xs text-gray-500 mt-1">approved with margin &lt; 15%</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 text-sm font-semibold text-amber-800 flex items-center gap-1">
          <AlertTriangle className="h-4 w-4" /> Items with the widest price spread
        </div>
        {data.drift?.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">Nothing drifting — your pricing is consistent.</div>
        ) : (
          <ul className="divide-y">
            {data.drift.map((d: any) => (
              <li key={d.id} className="px-3 py-2 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate flex items-center gap-1">
                    {d.isVerified && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                    {d.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    avg R{d.avg.toLocaleString()} • min R{d.min.toLocaleString()} • max R
                    {d.max.toLocaleString()} • {d.usageCount}× used
                  </div>
                </div>
                <div className="text-sm font-semibold text-amber-700">
                  {d.spreadPct.toFixed(0)}% spread
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-red-50 border-b border-red-100 text-sm font-semibold text-red-800 flex items-center gap-1">
          <AlertTriangle className="h-4 w-4" /> Recently approved low-margin quotes
        </div>
        {data.lowMargin?.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No low-margin approvals in the window.</div>
        ) : (
          <ul className="divide-y">
            {data.lowMargin.map((m: any) => (
              <li key={m.id} className="px-3 py-2 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {m.quoteNumber} — {m.customerName}
                  </div>
                  <div className="text-xs text-gray-500">
                    R{m.subtotal.toLocaleString()} subtotal • cost R{m.cost.toLocaleString()} •
                    by {m.createdBy} ({m.createdByRole})
                  </div>
                </div>
                <div className="text-sm font-semibold text-red-700">
                  {m.marginPct.toFixed(1)}% margin
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-gray-50 border-b text-sm font-semibold text-gray-800 flex items-center gap-1">
          <Activity className="h-4 w-4" /> People producing low-margin quotes
        </div>
        {data.offenders?.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">Everyone is quoting above the floor — well done.</div>
        ) : (
          <ul className="divide-y">
            {data.offenders.map((o: any) => (
              <li key={o.name} className="px-3 py-2 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{o.name}</div>
                  <div className="text-xs text-gray-500">{o.role}</div>
                </div>
                <div className="text-sm text-gray-700">
                  {o.below}/{o.count} below floor
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
