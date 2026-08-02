import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { getAuthUser } from '@/lib/auth-context';

export async function GET(request: NextRequest) {
  try {
    // Reference data — any authenticated user may read the semester list
    // (used by lecturer grading/export dropdowns). Middleware enforces
    // authentication; we just need to confirm a session exists.
    const auth = getAuthUser(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const { data: semesters, error } = await db
      .from('semesters')
      .select('*')
      .order('start_date', { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }

    // Map snake_case to camelCase for frontend compatibility
    const data = (semesters || []).map((s: Record<string, unknown>) => ({
      id: s.id,
      name: s.name,
      startDate: s.start_date,
      endDate: s.end_date,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Get semesters error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Creating semesters is an admin-only operation. This route sits
    // outside the /api/admin/ role-prefix rule, so enforce explicitly.
    const auth = getAuthUser(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    if (auth.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { name, startDate, endDate } = await request.json();

    if (!name || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'Name, start date, and end date are required' },
        { status: 400 }
      );
    }

    const { data: existing } = await db.from('semesters').select('id').eq('name', name);
    if (existing && existing.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Semester with this name already exists' },
        { status: 409 }
      );
    }

    const { data: semesters, error } = await db
      .from('semesters')
      .insert({
        name,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
      })
      .select();

    if (error || !semesters || semesters.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to create semester' },
        { status: 500 }
      );
    }

    const semester = semesters[0] as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      data: {
        id: semester.id,
        name: semester.name,
        startDate: semester.start_date,
        endDate: semester.end_date,
        createdAt: semester.created_at,
        updatedAt: semester.updated_at,
      },
    });
  } catch (error) {
    console.error('Create semester error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
