import { useEffect, useState } from "react";
import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

interface SLABadgeProps {
  slaDueAt?: string | Date | null;
  slaHours?: number | null;
  status: string;
  /** When the order is COMPLETED, freeze the timer at the completion time */
  completedAt?: string | Date | null;
}

/**
 * Live SLA countdown badge for a job order.
 * - Green when > 25% time remaining
 * - Amber when ≤ 25% remaining
 * - Red & "BREACHED" when overdue
 * - Grey "Met" when completed before due
 * - Grey "Late" when completed after due
 */
export function SLABadge({ slaDueAt, slaHours, status, completedAt }: SLABadgeProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status === "COMPLETED" || status === "CANCELLED") return;
    if (!slaDueAt) return;
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [slaDueAt, status]);

  if (!slaDueAt || !slaHours) return null;

  const dueMs = new Date(slaDueAt).getTime();
  const isFinal = status === "COMPLETED" || status === "CANCELLED";
  const refMs = isFinal && completedAt ? new Date(completedAt).getTime() : now;
  const remainingMs = dueMs - refMs;
  const totalMs = slaHours * 60 * 60 * 1000;

  const fmt = (ms: number) => {
    const abs = Math.abs(ms);
    const h = Math.floor(abs / 3_600_000);
    const m = Math.floor((abs % 3_600_000) / 60_000);
    if (h >= 24) {
      const d = Math.floor(h / 24);
      return `${d}d ${h % 24}h`;
    }
    return `${h}h ${m}m`;
  };

  if (isFinal) {
    const onTime = remainingMs >= 0;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
          onTime ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        }`}
        title={`SLA ${slaHours}h • ${onTime ? "Met" : "Missed"}`}
      >
        <CheckCircle2 className="h-3 w-3" />
        SLA {onTime ? "Met" : "Late"}
      </span>
    );
  }

  if (remainingMs < 0) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800 animate-pulse"
        title={`SLA breached by ${fmt(remainingMs)}`}
      >
        <AlertTriangle className="h-3 w-3" />
        BREACHED -{fmt(remainingMs)}
      </span>
    );
  }

  const pct = remainingMs / totalMs;
  const styles =
    pct <= 0.25
      ? "bg-amber-100 text-amber-800"
      : "bg-emerald-50 text-emerald-700";

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${styles}`}
      title={`SLA ${slaHours}h • ${fmt(remainingMs)} remaining`}
    >
      <Clock className="h-3 w-3" />
      SLA {fmt(remainingMs)}
    </span>
  );
}
