import { useState } from "react";
import { useAuthStore } from "~/stores/auth";
import { useTRPC } from "~/trpc/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, User, UserX } from "lucide-react";

export type PortfolioScope = "MINE" | "ALL" | "UNASSIGNED";

const SENIOR_ROLES = ["SENIOR_ADMIN", "MANAGER", "ADMIN", "TECHNICAL_MANAGER"];

/**
 * Small pill toggle that lets an admin switch between viewing MINE / ALL / UNASSIGNED
 * portfolio scope. On change:
 *   • calls onChange with the new scope so callers can pass it into their tRPC list queries
 *   • persists the choice on the user (setMyPortfolioView) so it becomes the default next login
 *
 * Only rendered for admin-tier users. UNASSIGNED option only shown to seniors.
 */
export function PortfolioScopeToggle({
  scope,
  onChange,
  invalidateKeys,
  compact = false,
}: {
  scope: PortfolioScope;
  onChange: (next: PortfolioScope) => void;
  /** Optional list of tRPC query keys to invalidate after switching (e.g. list queries). */
  invalidateKeys?: unknown[][];
  compact?: boolean;
}) {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const isSenior = user ? SENIOR_ROLES.includes(user.role) : false;

  const setViewMut = useMutation(
    trpc.setMyPortfolioView.mutationOptions({
      onSuccess: () => {
        if (invalidateKeys) {
          for (const k of invalidateKeys) qc.invalidateQueries({ queryKey: k });
        }
      },
      onSettled: () => setSaving(false),
    }),
  );

  const applyScope = (next: PortfolioScope) => {
    if (next === scope) return;
    onChange(next);
    // Only persist MINE/ALL as default (UNASSIGNED is a transient view).
    if (next !== "UNASSIGNED" && token) {
      setSaving(true);
      setViewMut.mutate({ token, view: next as "MINE" | "ALL" });
    }
  };

  const pill = (val: PortfolioScope, label: string, icon: React.ReactNode) => {
    const active = scope === val;
    return (
      <button
        type="button"
        onClick={() => applyScope(val)}
        disabled={saving}
        className={
          "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors " +
          (active
            ? "bg-blue-600 text-white shadow-sm"
            : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200")
        }
      >
        {icon}
        {!compact && <span>{label}</span>}
      </button>
    );
  };

  return (
    <div className="inline-flex rounded-lg overflow-hidden border border-gray-200 shadow-sm">
      {pill("MINE", "My portfolio", <User className="h-3.5 w-3.5" />)}
      {pill("ALL", "All", <Users className="h-3.5 w-3.5" />)}
      {isSenior && pill("UNASSIGNED", "Unassigned", <UserX className="h-3.5 w-3.5" />)}
    </div>
  );
}

/**
 * Convenience hook for pages that consume the scope. Reads the user's
 * defaultPortfolioView as the initial value.
 */
export function useInitialPortfolioScope(): PortfolioScope {
  const { user } = useAuthStore();
  const dv = (user as any)?.defaultPortfolioView;
  return dv === "MINE" ? "MINE" : "ALL";
}
