// ============================================================
// checkIn - Auth Context Helper (server-only)
// ============================================================
// Reads the authenticated user info set by middleware on the
// request headers. All route handlers should use this instead
// of trusting client-supplied IDs.

export interface AuthUser {
  userId: string;
  role: 'admin' | 'hod' | 'lecturer' | 'student';
  email: string;
  name: string;
}

/**
 * Extract the authenticated user from the request headers.
 * These headers are set by src/middleware.ts after JWT verification.
 * Returns null if not authenticated (shouldn't happen if middleware is active).
 */
export function getAuthUser(request: Request): AuthUser | null {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  const email = request.headers.get('x-user-email');
  const name = request.headers.get('x-user-name');

  if (!userId || !role) {
    return null;
  }

  return {
    userId,
    role: role as AuthUser['role'],
    email: email || '',
    name: name ? decodeURIComponent(name) : '',
  };
}

/**
 * Require authentication. Throws if not authenticated.
 */
export function requireAuth(request: Request): AuthUser {
  const user = getAuthUser(request);
  if (!user) {
    throw new AuthError('Authentication required', 401);
  }
  return user;
}

/**
 * Require a specific role. Throws if the user doesn't have it.
 */
export function requireRole(request: Request, ...roles: AuthUser['role'][]): AuthUser {
  const user = requireAuth(request);
  if (!roles.includes(user.role)) {
    throw new AuthError('Insufficient permissions', 403);
  }
  return user;
}

export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AuthError';
  }
}
