import { useState, useEffect, useCallback, useMemo } from "react";

/**
 * Returns a refetchInterval that is active only when the tab is visible.
 * When the tab goes to the background, polling stops (returns `false`).
 * When the tab comes back into focus, polling resumes and an immediate
 * refetch is triggered via the invalidation callback.
 *
 * Usage:
 *   const refetchInterval = useTabFocusRefetch(30000);
 *   useQuery({ ..., refetchInterval });
 */
export function useTabFocusRefetch(
  intervalMs: number | false,
): number | false {
  const [isVisible, setIsVisible] = useState(() =>
    typeof document !== "undefined" ? !document.hidden : true
  );

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handler = () => setIsVisible(!document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  // Only poll when the tab is visible AND an interval is provided
  if (!isVisible || intervalMs === false) return false;
  return intervalMs;
}

/**
 * Drop-in replacement options for React Query.
 * Returns { refetchInterval, refetchOnWindowFocus } that automatically
 * stops polling in background tabs and refetches on tab focus.
 */
export function useSmartRefetch(intervalMs: number | false) {
  const refetchInterval = useTabFocusRefetch(intervalMs);
  return useMemo(
    () => ({
      refetchInterval,
      refetchOnWindowFocus: true,
    }),
    [refetchInterval]
  );
}

/**
 * Returns true when the current tab is visible, false when hidden.
 * Use this to gate SSE subscriptions so only the active tab holds a connection.
 */
export function useTabVisible(): boolean {
  const [isVisible, setIsVisible] = useState(() =>
    typeof document !== "undefined" ? !document.hidden : true
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handler = () => setIsVisible(!document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  return isVisible;
}
