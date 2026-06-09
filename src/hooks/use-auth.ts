// ============================================================
// checkIn - Auth State Management (Zustand)
// ============================================================

'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@/lib/types';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  login: (user: AuthUser) => void;
  logout: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
  setHydrated: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      hydrated: false,
      login: (user: AuthUser) =>
        set({ user, isAuthenticated: true }),
      logout: () =>
        set({ user: null, isAuthenticated: false }),
      updateUser: (updates: Partial<AuthUser>) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
      setHydrated: (val: boolean) => set({ hydrated: val }),
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
