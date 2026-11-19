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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        try {
          const res = await fetch('/api/auth/me', { signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
              set({ user: json.data as AuthUser, isAuthenticated: true, validating: false });
              return true;
            }
          }
          // Server explicitly rejected the session (e.g. 401/403) — clear local state
          if (res.status === 401 || res.status === 403) {
            set({ user: null, isAuthenticated: false, validating: false });
            return false;
          }
          // Transient 5xx server error — keep cached user if available
          const cached = get();
          if (cached.user && cached.isAuthenticated) {
            set({ validating: false });
            return true;
          }
          set({ user: null, isAuthenticated: false, validating: false });
          return false;
        } catch {
          clearTimeout(timeoutId);
          // Offline or slow-network timeout — preserve persisted session so student
          // can open the dashboard and queue offline check-ins without being logged out.
          const cached = get();
          if (cached.user && cached.isAuthenticated) {
            set({ validating: false });
            return true;
          }
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
