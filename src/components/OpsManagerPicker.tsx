// PR-8 F — Reusable dropdown for picking an Ops Manager (parallel to TmPicker).

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ClipboardCheck, AlertTriangle, Loader2 } from "lucide-react";
import { useTRPC } from "~/trpc/react";

interface Props {
  token: string;
  value: number | null;
  onChange: (id: number | null) => void;
  required?: boolean;
  autoPreselect?: boolean;
  compact?: boolean;
  label?: string;
  helpText?: string;
  allowNone?: boolean;
  disabled?: boolean;
}

export function OpsManagerPicker({
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
  const q = useQuery(trpc.getActiveOpsManagers.queryOptions({ token }));

  useEffect(() => {
    if (!autoPreselect) return;
    if (value != null) return;
    const suggested = q.data?.suggestedId;
    if (!suggested) return;
    if (q.data?.opsManagers.some((t) => t.id === suggested)) {
      onChange(suggested);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data?.suggestedId, autoPreselect]);

  const displayLabel = label ?? "Ops Manager";
  const rowSpacing = compact ? "gap-1.5" : "gap-2";
  const inputSize = compact ? "px-2 py-1.5 text-sm" : "px-3 py-2 text-sm";

  if (q.isLoading) {
    return (
      <div className={`flex items-center ${rowSpacing} text-gray-500 text-sm`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading Ops Managers…
      </div>
    );
  }

  if (q.isError) {
    return (
      <div className={`flex items-center ${rowSpacing} text-red-700 text-sm`}>
        <AlertTriangle className="w-4 h-4" />
        Failed to load Ops Manager list. Refresh and try again.
      </div>
    );
  }

  const opsManagers = q.data?.opsManagers ?? [];

  if (opsManagers.length === 0) {
    return (
      <div className={`p-3 rounded border border-amber-300 bg-amber-50 text-amber-900 text-sm flex items-start ${rowSpacing}`}>
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <div className="font-semibold">No active Ops Managers configured</div>
          <div className="text-xs mt-0.5">
            An admin must add someone to the Commission Rules tool with role "Ops Manager" before you can start a job.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${rowSpacing}`}>
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <ClipboardCheck className="w-4 h-4 text-emerald-600" />
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
        className={`w-full ${inputSize} border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100 ${
          required && value == null ? "border-amber-400" : "border-gray-300"
        }`}
      >
        <option value="">— Select Ops Manager —</option>
        {allowNone && <option value="">— No Ops Manager (unassigned) —</option>}
        {opsManagers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      {helpText && <p className="text-xs text-gray-500">{helpText}</p>}
      {required && value == null && (
        <p className="text-xs text-amber-700 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          Pick an Ops Manager so this job counts on the right statement.
        </p>
      )}
    </div>
  );
}
