// ============================================================
// checkIn - useOnlineStatus hook
// ============================================================
// Client hook that tracks the browser's online/offline status.
// Uses useSyncExternalStore so it is SSR-safe (server snapshot
// returns `true` to match the initial client render and avoid
// hydration mismatches) and cleans up its listeners automatically.
// ============================================================

'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

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
  const navigatorOnline = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot
  );
  const [probeReachable, setProbeReachable] = useState<boolean>(true);

  useEffect(() => {
    if (navigatorOnline) {
      setProbeReachable(true);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    fetch('/api', {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(() => {
        if (!cancelled) setProbeReachable(true);
      })
      .catch(() => {
        if (!cancelled) setProbeReachable(false);
      })
      .finally(() => {
        clearTimeout(timer);
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [navigatorOnline]);

  return { isOnline: navigatorOnline || probeReachable };
}
