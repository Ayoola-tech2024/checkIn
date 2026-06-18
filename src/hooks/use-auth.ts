// ============================================================
// checkIn - Auth State Management (Zustand)
// ============================================================
// The source of truth for authentication is the HTTP-only JWT
// cookie set by /api/auth/login and verified by middleware.
// This Zustand store mirrors the user data on the client for
// UI rendering. On page load, call validateSession() to verify
// the cookie is still valid via /api/auth/me.

'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@/lib/types';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  validating: boolean;
  login: (user: AuthUser) => void;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<AuthUser>) => void;
  setHydrated: (val: boolean) => void;
  validateSession: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      hydrated: false,
      validating: false,
      login: (user: AuthUser) =>
        set({ user, isAuthenticated: true }),
      logout: async () => {
        try {
          await fetch('/api/auth/logout', { method: 'POST' });
        } catch {
          // Even if the server call fails, clear local state
        }
        set({ user: null, isAuthenticated: false });
      },
      updateUser: (updates: Partial<AuthUser>) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
      setHydrated: (val: boolean) => set({ hydrated: val }),
      validateSession: async () => {
        set({ validating: true });
        try {
          const res = await fetch('/api/auth/me');
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
              set({ user: json.data as AuthUser, isAuthenticated: true, validating: false });
              return true;
            }
          }
          // Session invalid — clear local state
          set({ user: null, isAuthenticated: false, validating: false });
          return false;
        } catch {
          set({ user: null, isAuthenticated: false, validating: false });
          return false;
        }
      },
    }),
    {
      name: 'checkin-auth',
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHydrated(true);
        }
      },
    }
  )
);
