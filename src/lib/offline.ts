// ============================================================
// checkIn - Offline Cache Layer (Store-and-Forward via IndexedDB)
// ============================================================
// Client-only. Only import this module from client components/hooks.
// Stores pending check-ins when the student is offline so they can
// be replayed automatically once connectivity is restored.
// ============================================================

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

const DB_NAME = 'checkin-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pendingCheckins';

export interface PendingCheckIn {
  id?: number;
  sessionId: string;
  studentId: string;
  studentLat: number;
  studentLng: number;
  facialDescriptor: number[];
  selfieData: string;
  capturedAt: string; // ISO timestamp
}

interface CheckInOfflineDB extends DBSchema {
  pendingCheckins: {
    key: number;
    value: PendingCheckIn;
    indexes: {
      sessionId: string;
      studentId: string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<CheckInOfflineDB> | null> | null = null;

/**
 * Lazily opens (and caches) the IndexedDB connection.
 * Returns null if IndexedDB is unavailable (SSR, private mode, etc.).
 */
function getDB(): Promise<IDBPDatabase<CheckInOfflineDB> | null> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }

  if (!dbPromise) {
    dbPromise = openDB<CheckInOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('sessionId', 'sessionId', { unique: false });
          store.createIndex('studentId', 'studentId', { unique: false });
        }
      },
    }).catch((err) => {
      console.error('[offline] Failed to open IndexedDB:', err);
      dbPromise = null;
      return null;
    });
  }

  return dbPromise;
}

/**
 * Queue a check-in payload for later submission.
 * Returns the stored record (with auto-incremented id) on success,
 * or null on failure.
 */
export async function queueCheckIn(
  payload: Omit<PendingCheckIn, 'id'>
): Promise<PendingCheckIn | null> {
  try {
    const db = await getDB();
    if (!db) return null;

    const id = await db.add(STORE_NAME, payload as PendingCheckIn);
    return { ...payload, id: id as number };
  } catch (err) {
    console.error('[offline] queueCheckIn failed:', err);
    return null;
  }
}

/**
 * Returns all pending check-ins ordered by capture time (oldest first).
 * Returns an empty array on failure.
 */
export async function getAllPendingCheckIns(): Promise<PendingCheckIn[]> {
  try {
    const db = await getDB();
    if (!db) return [];

    const all = await db.getAll(STORE_NAME);
    // Oldest first so we replay in capture order.
    return all.sort((a, b) => {
      const ta = new Date(a.capturedAt).getTime();
      const tb = new Date(b.capturedAt).getTime();
      return ta - tb;
    });
  } catch (err) {
    console.error('[offline] getAllPendingCheckIns failed:', err);
    return [];
  }
}

/**
 * Deletes a pending check-in by its auto-incremented id.
 * Returns true on success, false on failure.
 */
export async function deletePendingCheckIn(id: number): Promise<boolean> {
  try {
    const db = await getDB();
    if (!db) return false;

    await db.delete(STORE_NAME, id);
    return true;
  } catch (err) {
    console.error('[offline] deletePendingCheckIn failed:', err);
    return false;
  }
}

/**
 * Returns the number of pending check-ins currently queued.
 * Returns 0 on failure (including when IndexedDB is unavailable).
 */
export async function getPendingCheckInCount(): Promise<number> {
  try {
    const db = await getDB();
    if (!db) return 0;

    return await db.count(STORE_NAME);
  } catch (err) {
    console.error('[offline] getPendingCheckInCount failed:', err);
    return 0;
  }
}
