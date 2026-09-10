// ============================================================
// checkIn - IndexedDB Offline Check-in Store & Resilience Engine
// ============================================================

import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface PendingCheckIn {
  id: string;
  sessionId: string;
  studentLat: number;
  studentLng: number;
  studentAccuracy: number;
  facialDescriptor: number[];
  selfieData?: string;
  timestamp: string;
  attempts: number;
  status: 'pending' | 'syncing' | 'failed';
  errorMessage?: string;
}

interface CheckInDB extends DBSchema {
  'offline-checkins': {
    key: string;
    value: PendingCheckIn;
    indexes: { 'by-status': string; 'by-session': string };
  };
}

const DB_NAME = 'checkin-offline-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<CheckInDB>> | null = null;

function getDB() {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB<CheckInDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('offline-checkins')) {
          const store = db.createObjectStore('offline-checkins', { keyPath: 'id' });
          store.createIndex('by-status', 'status');
          store.createIndex('by-session', 'sessionId');
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Save a check-in payload to IndexedDB when offline or on network timeout.
 */
export async function saveOfflineCheckIn(
  payload: Omit<PendingCheckIn, 'id' | 'timestamp' | 'attempts' | 'status'>
): Promise<PendingCheckIn> {
  const db = await getDB();
  const entry: PendingCheckIn = {
    ...payload,
    id: `checkin_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
    attempts: 0,
    status: 'pending',
  };

  if (db) {
    await db.put('offline-checkins', entry);
    console.log('[OfflineStore] Saved pending check-in payload to IndexedDB:', entry.id);
  }

  return entry;
}

/**
 * Get all pending offline check-in payloads.
 */
export async function getPendingCheckIns(): Promise<PendingCheckIn[]> {
  const db = await getDB();
  if (!db) return [];
  return db.getAllFromIndex('offline-checkins', 'by-status', 'pending');
}

/**
 * Remove a synced check-in entry from IndexedDB.
 */
export async function removeOfflineCheckIn(id: string): Promise<void> {
  const db = await getDB();
  if (db) {
    await db.delete('offline-checkins', id);
  }
}

/**
 * Automatically sync all pending check-in payloads to the server.
 */
export async function syncOfflineCheckIns(): Promise<{
  synced: number;
  failed: number;
  results: Array<{ id: string; success: boolean; message: string }>;
}> {
  const pending = await getPendingCheckIns();
  if (pending.length === 0) {
    return { synced: 0, failed: 0, results: [] };
  }

  console.log(`[OfflineStore] Attempting background sync for ${pending.length} pending check-in(s)...`);

  let syncedCount = 0;
  let failedCount = 0;
  const results: Array<{ id: string; success: boolean; message: string }> = [];

  for (const item of pending) {
    try {
      const response = await fetch('/api/student/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: item.sessionId,
          studentLat: item.studentLat,
          studentLng: item.studentLng,
          studentAccuracy: item.studentAccuracy,
          facialDescriptor: item.facialDescriptor,
          selfieData: item.selfieData,
        }),
      });

      const resData = await response.json();

      if (response.ok && resData.success) {
        await removeOfflineCheckIn(item.id);
        syncedCount++;
        results.push({ id: item.id, success: true, message: resData.data?.message || 'Synced successfully!' });
      } else {
        // If rejected due to boundary/identity, remove or mark failed so we don't loop endlessly
        if (response.status === 400 || response.status === 409 || response.status === 403) {
          await removeOfflineCheckIn(item.id);
        }
        failedCount++;
        results.push({ id: item.id, success: false, message: resData.error || 'Check-in validation failed' });
      }
    } catch (err) {
      console.error('[OfflineStore] Failed sync attempt for item:', item.id, err);
      failedCount++;
      results.push({ id: item.id, success: false, message: 'Network unavailable' });
    }
  }

  return { synced: syncedCount, failed: failedCount, results };
}
