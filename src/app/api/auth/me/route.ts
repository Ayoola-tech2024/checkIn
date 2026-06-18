import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-context';

// Returns the currently authenticated user from the session cookie.
// The middleware has already verified the JWT and set x-user-* headers.
export async function GET(request: Request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Not authenticated' },
      { status: 401 }
    );
  }
  return NextResponse.json({
    success: true,
    data: user,
  });
}
