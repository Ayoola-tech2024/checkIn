// ============================================================
// checkIn - JWT Session Management (server-only)
// ============================================================
import { SignJWT, jwtVerify } from 'jose';

const SESSION_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'checkin-dev-secret-change-in-production-32chars!'
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
 * Sign a JWT and return the token string.
 */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .setIssuer('checkin')
    .setAudience('checkin-users')
    .sign(SESSION_SECRET);
}

/**
 * Verify a JWT token and return the payload, or null if invalid.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
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
