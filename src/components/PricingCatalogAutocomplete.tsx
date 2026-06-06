import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { CheckCircle2, History, TrendingUp } from "lucide-react";

export interface CatalogPickPayload {
  description: string;
  unitPrice: number;
  unitOfMeasure: string;
}

interface Props {
  token: string;
  value: string;
  onChange: (value: string) => void;
  onPick: (payload: CatalogPickPayload) => void;
  clientId?: number | null;
  clientBuildingId?: number | null;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Typeahead input wired to the Pricing Library.
 * - Live searches the catalog as the user types.
 * - Surfaces VERIFIED items first, then popular learned items, then per-client recall.
 * - Clicking a suggestion fills the description and prefills price + UoM on the parent row.
 */
export function PricingCatalogAutocomplete({
  token,
  value,
  onChange,
  onPick,
  clientId,
  clientBuildingId,
  placeholder = "Description",
  className = "",
  disabled,
}: Props) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState(value);
  const blurTimer = useRef<number | null>(null);

  // Debounce search input
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), 200);
    return () => window.clearTimeout(t);
  }, [value]);

  const enabled = !!token && open && (debounced.trim().length > 1 || !!clientId || !!clientBuildingId);

  const search = useQuery(
    trpc.searchPricingCatalog.queryOptions(
      {
        token,
        query: debounced.trim(),
        limit: 8,
        clientId: clientId ?? undefined,
        clientBuildingId: clientBuildingId ?? undefined,
      },
      { enabled, staleTime: 30_000 }
    )
  );

  const items = search.data?.items ?? [];
  const clientRecall = search.data?.clientRecall ?? [];

  const showDropdown = open && (items.length > 0 || clientRecall.length > 0);

  const handleBlur = () => {
    // Slight delay so onClick on the dropdown row can fire first.
    blurTimer.current = window.setTimeout(() => setOpen(false), 150);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className || "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary-500"}
      />
      {showDropdown && (
        <div className="absolute left-0 right-0 z-30 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-80 overflow-y-auto">
          {clientRecall.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase text-amber-700 bg-amber-50 flex items-center gap-1">
                <History className="h-3 w-3" />
                This client's recent prices
              </div>
              {clientRecall.map((m: any) => (
                <button
                  type="button"
                  key={`mem-${m.id}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (blurTimer.current) window.clearTimeout(blurTimer.current);
                    onPick({
                      description: m.description,
                      unitPrice: m.lastUnitPrice,
                      unitOfMeasure: m.unitOfMeasure,
                    });
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-amber-50 flex items-start gap-2 border-b border-gray-100"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-900 truncate">{m.description}</div>
                    <div className="text-[11px] text-gray-500">
                      last R{m.lastUnitPrice.toLocaleString()} / {m.unitOfMeasure} •
                      avg R{m.avgUnitPrice.toLocaleString()} • {m.usageCount}× used
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {items.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase text-gray-500 bg-gray-50">
                Pricing catalog
              </div>
              {items.map((it: any) => (
                <button
                  type="button"
                  key={`cat-${it.id}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (blurTimer.current) window.clearTimeout(blurTimer.current);
                    onPick({
                      description: it.description,
                      unitPrice: it.unitPrice,
                      unitOfMeasure: it.unitOfMeasure,
                    });
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-purple-50 flex items-start gap-2 border-b border-gray-100"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-900 truncate flex items-center gap-1">
                      {it.isVerified && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-label="Verified" />
                      )}
                      <span>{it.description}</span>
                    </div>
                    <div className="text-[11px] text-gray-500 flex items-center gap-2">
                      <span className="font-semibold text-purple-700">
                        R{it.unitPrice.toLocaleString()} / {it.unitOfMeasure}
                      </span>
                      {it.avgUnitPrice && (
                        <span>avg R{Number(it.avgUnitPrice).toLocaleString()}</span>
                      )}
                      {it.usageCount > 0 && (
                        <span className="inline-flex items-center gap-0.5">
                          <TrendingUp className="h-3 w-3" />
                          {it.usageCount}× used
                        </span>
                      )}
                      {it.category && (
                        <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px]">{it.category}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Small inline badge that renders deviation severity for a row. */
export function DeviationBadge({
  proposedPrice,
  reference,
  thresholdPct = 20,
}: {
  proposedPrice: number;
  reference: number | null | undefined;
  thresholdPct?: number;
}) {
  if (!reference || reference <= 0 || !proposedPrice || proposedPrice <= 0) return null;
  const ratio = (proposedPrice - reference) / reference;
  const absPct = Math.abs(ratio) * 100;
  if (absPct < thresholdPct) {
    return (
      <span
        className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700"
        title={`Within ±${thresholdPct}% of typical price R${reference.toFixed(2)}`}
      >
        in range
      </span>
    );
  }
  const above = ratio > 0;
  const severe = absPct > 40;
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded ${severe ? "bg-red-100 text-red-700" : above ? "bg-amber-100 text-amber-700" : "bg-orange-100 text-orange-700"}`}
      title={`${above ? "+" : "-"}${absPct.toFixed(0)}% vs typical R${reference.toFixed(2)}`}
    >
      {above ? "+" : "−"}{absPct.toFixed(0)}%
    </span>
  );
}
