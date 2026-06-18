// ============================================================
// checkIn - API Authentication Middleware
// ============================================================
// Protects all /api/* routes (except /api/auth/login) with
// JWT session verification. Enforces role-based access control
// on path prefixes. Sets x-user-* headers for route handlers.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken, getSessionCookieName } from '@/lib/session';

// Role required for each API path prefix
const ROLE_RULES: { prefix: string; roles: string[] }[] = [
  { prefix: '/api/admin/', roles: ['admin'] },
  { prefix: '/api/hod/', roles: ['hod'] },
  { prefix: '/api/lecturer/', roles: ['lecturer', 'hod'] },
  { prefix: '/api/student/', roles: ['student'] },
];

// Paths that are public (no auth required)
const PUBLIC_PATHS = ['/api/auth/login'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Allow public paths (login)
  if (PUBLIC_PATHS.some((p) => pathname === p)) {
    return NextResponse.next();
  }

  // Extract and verify the session token
  const token = request.cookies.get(getSessionCookieName())?.value;

  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );
  }

  const payload = await verifySessionToken(token);

  if (!payload) {
    const response = NextResponse.json(
      { success: false, error: 'Invalid or expired session' },
      { status: 401 }
    );
    // Clear the invalid cookie
    response.cookies.delete(getSessionCookieName());
    return response;
  }

  // Enforce role-based access control on path prefixes
  for (const rule of ROLE_RULES) {
    if (pathname.startsWith(rule.prefix)) {
      if (!rule.roles.includes(payload.role)) {
        return NextResponse.json(
          { success: false, error: 'Insufficient permissions for this resource' },
          { status: 403 }
        );
      }
      break;
    }
  }

  // Forward the authenticated user info to the route handler via headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', payload.userId);
  requestHeaders.set('x-user-role', payload.role);
  requestHeaders.set('x-user-email', payload.email);
  requestHeaders.set('x-user-name', encodeURIComponent(payload.name));

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/api/:path*'],
};
