import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import toast from "react-hot-toast";
import { Users, KeyRound, RefreshCw, ShieldCheck, LogOut, Loader2, Crown, Clock } from "lucide-react";

/**
 * PR-6 — Crew panel embedded on an order detail screen.
 * Shows roster + live per-person labour cost, the join code (to LEAD/admin only),
 * SSRA acknowledgement state, and the actions available to the current user.
 */
export function CrewPanel({ orderId, compact = false }: { orderId: number; compact?: boolean }) {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const qc = useQueryClient();

  const q = useQuery({
    ...trpc.artisanGetCrew.queryOptions({ token: token!, orderId }),
    enabled: !!token && !!orderId,
    refetchInterval: 30_000,
  });

  const regen = useMutation(trpc.artisanRegenerateJoinCode.mutationOptions({
    onSuccess: () => { toast.success("New join code generated"); q.refetch(); },
    onError: (e) => toast.error(e.message),
  }));
  const ack = useMutation(trpc.artisanAckSsra.mutationOptions({
    onSuccess: () => { toast.success("SSRA acknowledged"); q.refetch(); },
    onError: (e) => toast.error(e.message),
  }));
  const leave = useMutation(trpc.artisanLeaveOrder.mutationOptions({
    onSuccess: () => { toast.success("Left the crew"); qc.invalidateQueries(); },
    onError: (e) => toast.error(e.message),
  }));

  if (q.isLoading) {
    return (
      <div className="bg-white rounded-lg shadow border p-4 flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />Loading crew…
      </div>
    );
  }
  if (q.error || !q.data) {
    return null; // Quietly hide if user can't see the crew
  }

  const data = q.data;
  const me = data.crew.find((c: any) => c.userId === user?.id);
  const isLead = me?.role === "LEAD";
  const isAdminTier = !!user && ["ADMIN", "SENIOR_ADMIN", "JUNIOR_ADMIN", "MANAGER", "TECHNICAL_MANAGER"].includes(user.role);
  const showJoinCode = !!data.joinCode && (isLead || isAdminTier);

  return (
    <div className="bg-white rounded-lg shadow border overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Users className="w-4 h-4" />Crew ({data.crew.filter((c: any) => !c.leftAt).length})</h3>
        {showJoinCode && (
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-xs text-gray-500 leading-tight">Join code</div>
              <div className="font-mono font-bold tracking-widest text-indigo-700">{data.joinCode}</div>
              {data.joinCodeExpiresAt && (
                <div className="text-[10px] text-gray-500">
                  expires {new Date(data.joinCodeExpiresAt as any).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
            {(isLead || isAdminTier) && (
              <button
                onClick={() => regen.mutate({ token: token!, orderId })}
                disabled={regen.isPending}
                className="p-1.5 text-gray-500 hover:text-indigo-700 hover:bg-indigo-50 rounded"
                title="Regenerate join code"
              >
                <RefreshCw className={`w-4 h-4 ${regen.isPending ? "animate-spin" : ""}`} />
              </button>
            )}
          </div>
        )}
        {!showJoinCode && (isLead || isAdminTier) && (
          <button
            onClick={() => regen.mutate({ token: token!, orderId })}
            disabled={regen.isPending}
            className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
          >
            {regen.isPending ? "…" : "Generate join code"}
          </button>
        )}
      </div>

      <ul className="divide-y">
        {data.crew.map((c: any) => {
          const bd = data.labourBreakdown.find((b: any) => b.userId === c.userId);
          const hours = bd ? (bd.totalMinutes / 60).toFixed(2) : "0.00";
          return (
            <li key={c.id} className={`px-4 py-3 ${c.leftAt ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {c.role === "LEAD" && <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                    <span className="truncate">{c.name}</span>
                    {c.userId === user?.id && <span className="text-xs text-indigo-600 flex-shrink-0">(you)</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-600 mt-0.5">
                    <span className={`inline-block px-1.5 py-0.5 rounded ${c.role === "LEAD" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700"}`}>{c.role}</span>
                    {c.hourlyRate ? <span>R{c.hourlyRate}/hr</span> : c.dailyRate ? <span>R{c.dailyRate}/day</span> : <span className="text-gray-400">no rate</span>}
                    {c.ssraAckedAt ? (
                      <span className="text-green-600 flex items-center gap-1"><ShieldCheck className="w-3 h-3" />SSRA acked</span>
                    ) : (
                      <span className="text-amber-600">SSRA pending</span>
                    )}
                    {c.leftAt && <span className="text-red-500">left</span>}
                    {(isLead || isAdminTier) && c.joinDistanceMeters != null && (
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${c.joinDistanceMeters > (data.geofenceMeters ?? 200) ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
                        title={c.joinLat != null && c.joinLng != null ? `${c.joinLat.toFixed(5)}, ${c.joinLng.toFixed(5)}` : undefined}
                      >
                        📍 {Math.round(c.joinDistanceMeters)}m from site
                      </span>
                    )}
                    {(isLead || isAdminTier) && c.joinDistanceMeters == null && c.joinLat == null && (
                      <span className="text-gray-400" title="No GPS captured at join">📍 no geo</span>
                    )}
                  </div>
                </div>
                {!compact && (
                  <div className="text-right text-sm flex-shrink-0">
                    <div className="flex items-center gap-1 text-gray-700 justify-end"><Clock className="w-3 h-3" />{hours}h</div>
                    <div className="font-semibold text-gray-900">R{(bd?.totalCost ?? 0).toFixed(2)}</div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between gap-3">
        <div className="text-sm">
          <span className="text-gray-500">Total labour: </span>
          <span className="font-bold text-gray-900">R{data.labourTotal.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          {me && !me.ssraAckedAt && (
            <button
              onClick={() => ack.mutate({ token: token!, orderId })}
              disabled={ack.isPending}
              className="px-3 py-1.5 text-xs font-medium bg-amber-500 text-white rounded hover:bg-amber-600 inline-flex items-center gap-1"
            >
              <ShieldCheck className="w-3 h-3" />Acknowledge SSRA
            </button>
          )}
          {me && !isLead && !me.leftAt && (
            <button
              onClick={() => {
                if (confirm("Leave this crew? You can rejoin with the code.")) {
                  leave.mutate({ token: token!, orderId });
                }
              }}
              disabled={leave.isPending}
              className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 inline-flex items-center gap-1"
            >
              <LogOut className="w-3 h-3" />Leave
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
