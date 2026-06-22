import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { getAuthUser } from '@/lib/auth-context';

// ============================================================
// Lecturer/HOD venue list endpoint.
// ----------------------------------------------------------------
// The lecturer portal needs to list venues when creating a session.
// The existing /api/admin/venues route is admin-only (blocked by the
// middleware ROLE_RULES for lecturers), so without this endpoint the
// "Create Session" dialog shows "No venues available" and the
// lecturer can never create a session. This GET returns the same
// shape as /api/admin/venues GET but is accessible to lecturer + hod.
// ============================================================

export async function GET(request: NextRequest) {
  const auth = getAuthUser(request);
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (auth.role !== 'lecturer' && auth.role !== 'hod') {
    return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { data: venues, error } = await db
      .from('venues')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Lecturer venues query error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }

    const data = ((venues || []) as Record<string, unknown>[]).map((v: Record<string, unknown>) => ({
      id: v.id,
      name: v.name,
      latitude: v.latitude,
      longitude: v.longitude,
      createdAt: v.created_at,
      updatedAt: v.updated_at,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Lecturer get venues error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
