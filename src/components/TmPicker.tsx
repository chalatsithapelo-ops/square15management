// PR-8 — Reusable dropdown for picking a Technical Manager.
//
// Populated from `getActiveTechnicalManagers` — i.e. every user with an active
// `CommissionRule` where `role="TM"`. Pre-selects the caller's own
// `defaultTechnicalManagerId` so the common case is a single tap.
//
// Used by:
//   • Artisan self-initiate wizard (`/artisan/jobs/start`)
//   • Artisan "Start Job" on an assigned order (`/artisan/dashboard`)
//   • Admin quotation-to-order conversion
//   • Admin "Unassigned TM" cleanup screen
//
// The picker is a controlled component — the parent owns the selected value.
// Callers should treat `value === null` as "not yet chosen" for validation.

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { UserCog, AlertTriangle, Loader2 } from "lucide-react";
import { useTRPC } from "~/trpc/react";

interface Props {
  token: string;
  value: number | null;
  onChange: (id: number | null) => void;
  /** Show a required-field asterisk. Default: true. */
  required?: boolean;
  /** Auto-select the caller's suggested TM on first load. Default: true. */
  autoPreselect?: boolean;
  /** Compact styling for embedding in mobile flows. Default: false. */
  compact?: boolean;
  label?: string;
  helpText?: string;
  /** Override the visible ID list — used by admin flows to allow "no TM". */
  allowNone?: boolean;
  disabled?: boolean;
}

export function TmPicker({
  token,
  value,
  onChange,
  required = true,
  autoPreselect = true,
  compact = false,
  label,
  helpText,
  allowNone = false,
  disabled = false,
}: Props) {
  const trpc = useTRPC();
  const q = useQuery(trpc.getActiveTechnicalManagers.queryOptions({ token }));

  // Pre-select the caller's default TM on first load — only if the parent
  // hasn't already chosen. Runs once per suggested-id.
  useEffect(() => {
    if (!autoPreselect) return;
    if (value != null) return;
    const suggested = q.data?.suggestedId;
    if (!suggested) return;
    // Confirm the suggested TM is still in the active list before pre-selecting;
    // an inactive/removed TM shouldn't be silently re-selected.
    if (q.data?.tms.some((t) => t.id === suggested)) {
      onChange(suggested);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data?.suggestedId, autoPreselect]);

  const displayLabel = label ?? "Technical Manager";
  const rowSpacing = compact ? "gap-1.5" : "gap-2";
  const inputSize = compact ? "px-2 py-1.5 text-sm" : "px-3 py-2 text-sm";

  if (q.isLoading) {
    return (
      <div className={`flex items-center ${rowSpacing} text-gray-500 text-sm`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading Technical Managers…
      </div>
    );
  }

  if (q.isError) {
    return (
      <div className={`flex items-center ${rowSpacing} text-red-700 text-sm`}>
        <AlertTriangle className="w-4 h-4" />
        Failed to load TM list. Refresh and try again.
      </div>
    );
  }

  const tms = q.data?.tms ?? [];

  // Empty list is a real state — no one has an active TM commission rule yet.
  // Surface a clear message so the admin knows to set one up, don't silently
  // block the artisan.
  if (tms.length === 0) {
    return (
      <div className={`p-3 rounded border border-amber-300 bg-amber-50 text-amber-900 text-sm flex items-start ${rowSpacing}`}>
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <div className="font-semibold">No active Technical Managers configured</div>
          <div className="text-xs mt-0.5">
            An admin must add someone to the Commission Rules tool with role "TM" before you can start a job.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${rowSpacing}`}>
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <UserCog className="w-4 h-4 text-indigo-600" />
        {displayLabel}
        {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Number(v));
        }}
        disabled={disabled}
        className={`w-full ${inputSize} border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 ${
          required && value == null ? "border-amber-400" : "border-gray-300"
        }`}
      >
        <option value="">— Select your TM —</option>
        {allowNone && <option value="">— No TM (unassigned) —</option>}
        {tms.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      {helpText && <p className="text-xs text-gray-500">{helpText}</p>}
      {required && value == null && (
        <p className="text-xs text-amber-700 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          Pick a TM so this job counts on the right statement.
        </p>
      )}
    </div>
  );
}
