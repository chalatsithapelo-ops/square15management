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

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),
    }),
    {
      name: "prop-management-auth",
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
