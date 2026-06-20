import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookieName, verifySessionToken } from '@/lib/session';
import { revokeToken } from '@/lib/revoked-tokens';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(getSessionCookieName());

  // BEST-EFFORT REVOCATION: extract the jti from the current token and add
  // it to the denylist so a stolen cookie can't be reused. If the
  // revoked_tokens table is unavailable we still delete the client cookie
  // — the token will simply expire on its 7-day schedule.
  try {
    const token = request.cookies.get(getSessionCookieName())?.value;
    if (token) {
      const payload = await verifySessionToken(token);
      if (payload?.jti) {
        // JWT exp is 7 days from issue. We mirror that as the denylist
        // row's expires_at so a GC job can purge stale entries.
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await revokeToken(payload.jti, payload.userId, expiresAt);
      }
    }
  } catch {
    // Non-fatal — the cookie is already deleted client-side.
  }

  return response;
}
