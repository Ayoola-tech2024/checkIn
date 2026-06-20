// ============================================================
// checkIn - JWT Session Management (server-only)
// ============================================================
import { SignJWT, jwtVerify } from 'jose';

// SECURITY: Hard-fail at module load if SESSION_SECRET is missing or is the
// well-known dev-fallback string. A silently-degraded secret would let any
// attacker forge a valid `checkin_session` JWT for any user/role.
const DEV_FALLBACK_SECRET = 'checkin-dev-secret-change-in-production-32chars!';
const rawSessionSecret = process.env.SESSION_SECRET;
if (!rawSessionSecret || rawSessionSecret.length < 32 || rawSessionSecret === DEV_FALLBACK_SECRET) {
  // In production, this must abort startup. In dev, we still allow the
  // fallback but warn loudly so it is never deployed accidentally.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SESSION_SECRET environment variable is required in production, must be at least 32 characters, ' +
      'and must not equal the publicly-known dev fallback. Aborting startup.'
    );
  }
  console.warn(
    '[SECURITY WARNING] SESSION_SECRET is missing or weak — using publicly-known dev fallback. ' +
    'This is FORBIDDEN in production. Set a strong SESSION_SECRET env var (>=32 chars).'
  );
}
const SESSION_SECRET = new TextEncoder().encode(
  rawSessionSecret && rawSessionSecret.length >= 32 && rawSessionSecret !== DEV_FALLBACK_SECRET
    ? rawSessionSecret
    : DEV_FALLBACK_SECRET
);
const COOKIE_NAME = 'checkin_session';
const SESSION_DURATION = '7d'; // 7 days

export interface SessionPayload {
  userId: string;
  role: 'admin' | 'hod' | 'lecturer' | 'student';
  email: string;
  name: string;
}

/**
 * JTI (JWT ID) — unique per token. Used for server-side revocation: when a
 * user logs out (or an admin force-logs-out a user), we add this jti to a
 * `revoked_tokens` table. Middleware checks the denylist before accepting
 * the token.
 */
export interface VerifiableSessionPayload extends SessionPayload {
  jti: string;
}

/**
 * Generate a fresh, unique JTI. Uses crypto.randomUUID when available
 * (Node 19+, all modern browsers), falls back to a timestamp+random string.
 */
function generateJti(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Sign a JWT and return the token string. Embeds a unique `jti` claim so the
 * token can be individually revoked without affecting other valid tokens
 * for the same user (e.g. on logout).
 */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const jti = generateJti();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .setIssuer('checkin')
    .setAudience('checkin-users')
    .setJti(jti)
    .sign(SESSION_SECRET);
}

/**
 * Verify a JWT token and return the payload, or null if invalid.
 * Does NOT check the revocation denylist — callers that need to enforce
 * revocation must call `isTokenRevoked(jti)` separately.
 */
export async function verifySessionToken(token: string): Promise<VerifiableSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SESSION_SECRET, {
      issuer: 'checkin',
      audience: 'checkin-users',
    });
    return {
      userId: payload.userId as string,
      role: payload.role as SessionPayload['role'],
      email: payload.email as string,
      name: payload.name as string,
      jti: payload.jti as string,
    };
  } catch {
    return null;
  }
}

export function getSessionCookieName(): string {
  return COOKIE_NAME;
}

export function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  };
}
