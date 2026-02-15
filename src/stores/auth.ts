import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type UserRole = string;

export interface AuthUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone: string | null;
  hourlyRate: number | null;
  dailyRate: number | null;
  hasPersonalEmail: boolean;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  clearAuth: () => void;
}

/**
 * Detect if running in standalone/TWA mode (installed app).
 * Uses a different localStorage key so the installed app and browser
 * maintain completely independent login sessions.
 */
function getAuthStorageKey(): string {
  if (typeof window === "undefined") return "prop-management-auth";
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;
  return isStandalone ? "prop-management-auth-app" : "prop-management-auth";
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),
    }),
    {
      name: getAuthStorageKey(),
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }

        return localStorage;
      }),
    },
  ),
);

// Alias for compatibility
export const useAuth = useAuthStore;
