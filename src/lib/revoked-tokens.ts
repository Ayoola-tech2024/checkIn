// ============================================================
// checkIn - JWT Revocation (jti denylist)
// ============================================================
// Server-only. Maintains a denylist of revoked JWT IDs (jtis) so that a
// stolen token can be invalidated before its 7-day expiry elapses.
//
// The denylist lives in the InsForge-backed `revoked_tokens` table. Schema:
//   revoked_tokens (
//     id uuid primary key default gen_random_uuid(),
//     jti text unique not null,
//     user_id text not null,
//     revoked_at timestamptz not null default now(),
//     expires_at timestamptz not null  -- mirrors the JWT exp, for GC
//   )
//
// If the table does not exist, the helpers degrade gracefully:
//   - revokeToken: returns false (caller surfaces a soft warning)
//   - isTokenRevoked: returns false (fail-open — same behavior as before
//     this feature was added, so the app keeps working)
//
// In-memory cache: to avoid hitting the DB on every API request, we cache
// revoked jtis in a module-level Set with a 60s TTL. The cache is bounded
// to 10000 entries (LRU eviction via simple Map insertion-order).

import { db } from '@/lib/insforge';

const CACHE_TTL_MS = 60 * 1000;
const CACHE_MAX_SIZE = 10000;

const revokedCache = new Map<string, number>(); // jti -> cached-at-ms
let lastCacheRefreshMs = 0;

function pruneCache() {
  if (revokedCache.size <= CACHE_MAX_SIZE) return;
  // Map iterates in insertion order — delete the oldest 10%.
  const toDelete = Math.floor(CACHE_MAX_SIZE * 0.1);
  let i = 0;
  for (const key of revokedCache.keys()) {
    revokedCache.delete(key);
    if (++i >= toDelete) break;
  }
}

/**
 * Check whether a JTI has been revoked. Returns true if revoked, false
 * otherwise. Fails OPEN (returns false) on DB errors so the app keeps
 * working — the JWT signature/expiry checks in middleware still protect
 * against forged or expired tokens.
 */
export async function isTokenRevoked(jti: string | undefined): Promise<boolean> {
  if (!jti) return false;

  // Fast path: in-memory cache hit.
  if (revokedCache.has(jti)) {
    return true;
  }

  // Refresh the cache from the DB at most once per TTL window. This is a
  // coarse-grained refresh — we pull ALL recently-revoked jtis and merge
  // them into the cache. For systems with very large denylists this would
  // need to be replaced with a per-jti lookup, but for this app's scale
  // (single school, <10k users) the bulk refresh is fine.
  const now = Date.now();
  if (now - lastCacheRefreshMs > CACHE_TTL_MS) {
    await refreshCache();
    if (revokedCache.has(jti)) {
      return true;
    }
  }

  return false;
}

async function refreshCache(): Promise<void> {
  try {
    // Pull jtis revoked in the last 7 days (the JWT lifetime). Older rows
    // are GC'd by the `expires_at` column but we filter defensively here.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await db
      .from('revoked_tokens')
      .select('jti, revoked_at')
      .gte('revoked_at', sevenDaysAgo);

    if (error) {
      // Table likely missing — fail open, don't spam the log.
      return;
    }

    lastCacheRefreshMs = Date.now();
    for (const row of (data || []) as Record<string, unknown>[]) {
      const jti = row.jti as string;
      if (jti && !revokedCache.has(jti)) {
        revokedCache.set(jti, lastCacheRefreshMs);
      }
    }
    pruneCache();
  } catch {
    // Defensive — never let a denylist lookup break authentication.
  }
}

/**
 * Revoke a single JTI. Called on logout. Returns true on success, false if
 * the denylist table is unavailable. Either way, the in-memory cache is
 * updated so the LOCAL server instance denies the token immediately —
 * multi-instance denial requires the DB table to exist.
 */
export async function revokeToken(
  jti: string,
  userId: string,
  jwtExpiresAt: Date
): Promise<boolean> {
  if (!jti) return false;

  // Update the in-memory cache IMMEDIATELY so the local instance denies the
  // next request, regardless of whether the DB write succeeds. This matters
  // when the `revoked_tokens` table doesn't exist yet (e.g. the admin hasn't
  // provisioned it) — at least the local serverless instance will honor the
  // logout.
  revokedCache.set(jti, Date.now());
  pruneCache();

  try {
    const { error } = await db.from('revoked_tokens').insert({
      jti,
      user_id: userId,
      revoked_at: new Date().toISOString(),
      expires_at: jwtExpiresAt.toISOString(),
    });

    if (error) {
      // Likely the table doesn't exist, or a duplicate insert (idempotent
      // logout retry). The in-memory cache was already updated above, so
      // the local instance will still deny the token.
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
