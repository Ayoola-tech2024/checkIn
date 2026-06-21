// ============================================================
// checkIn - OfflineBanner component
// ============================================================
// Small amber banner shown in the student portal when the client is
// offline or has queued check-ins pending sync. Unobtrusive — hidden
// entirely when the student is online AND has nothing queued.
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { WifiOff, CloudUpload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { getPendingCheckInCount } from '@/lib/offline';

export function OfflineBanner() {
  const { isOnline } = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      const count = await getPendingCheckInCount();
      if (active) setPendingCount(count);
    };

    refresh();

    // Re-check when connectivity changes so the "N pending sync" badge
    // updates appropriately (e.g. clears after a successful replay).
    window.addEventListener('online', refresh);
    return () => {
      active = false;
      window.removeEventListener('online', refresh);
    };
  }, [isOnline]);

  // Nothing to show — online and nothing queued.
  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <Alert
      className="border-amber-300/70 bg-amber-50 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200 py-2"
    >
      <div className="flex items-center gap-2 text-sm">
        {isOnline ? (
          <CloudUpload className="h-4 w-4 shrink-0" />
        ) : (
          <WifiOff className="h-4 w-4 shrink-0" />
        )}
        <AlertDescription className="text-amber-900 dark:text-amber-200 text-xs sm:text-sm">
          {!isOnline && pendingCount === 0 && (
            <>You are offline. Check-ins will be queued and synced when you reconnect.</>
          )}
          {!isOnline && pendingCount > 0 && (
            <>
              You are offline. Check-ins will be queued and synced when you reconnect.{' '}
              <span className="font-medium">{pendingCount} check-in(s) pending sync.</span>
            </>
          )}
          {isOnline && pendingCount > 0 && (
            <>
              <span className="font-medium">{pendingCount} check-in(s) pending sync.</span>{' '}
              They will be submitted automatically.
            </>
          )}
        </AlertDescription>
      </div>
    </Alert>
  );
}
