// ============================================================
// checkIn - useOnlineStatus hook
// ============================================================
// Client hook that tracks the browser's online/offline status.
// Uses useSyncExternalStore so it is SSR-safe (server snapshot
// returns `true` to match the initial client render and avoid
// hydration mismatches) and cleans up its listeners automatically.
// ============================================================

'use client';

import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getClientSnapshot(): boolean {
  return navigator.onLine;
}

function getServerSnapshot(): boolean {
  // Optimistic default for SSR — matches the initial client render.
  return true;
}

export interface UseOnlineStatusResult {
  isOnline: boolean;
}

export function useOnlineStatus(): UseOnlineStatusResult {
  const isOnline = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot
  );
  return { isOnline };
}
