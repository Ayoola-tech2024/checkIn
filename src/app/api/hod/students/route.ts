// ============================================================
// checkIn - HOD Students API (View students in HOD's dept)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { getAuthUser } from '@/lib/auth-context';

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Look up the HOD's department from the database using auth.userId.
    // Never trust a client-supplied departmentId.
    const { data: hodLecturers } = await db
      .from('lecturers')
      .select('hod_department_id, department_id')
      .eq('id', auth.userId);
    if (!hodLecturers || hodLecturers.length === 0) {
      return NextResponse.json({ success: false, error: 'HOD record not found' }, { status: 404 });
    }
    const hodLecturer = hodLecturers[0] as Record<string, unknown>;
    const departmentId = hodLecturer.hod_department_id || hodLecturer.department_id;
    if (!departmentId) {
      return NextResponse.json({ success: false, error: 'No department assigned to this HOD' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level');

    let query = db.from('students').select('*').eq('department_id', departmentId);

    if (level) {
      query = query.eq('level', parseInt(level, 10));
    }

    const { data: students, error } = await query.order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const formattedStudents = ((students || []) as Record<string, unknown>[]).map((s) => ({
      id: s.id,
      name: s.name,
      matricNumber: s.matric_number,
      email: s.email,
      level: typeof s.level === 'number' ? s.level : parseInt(s.level as string, 10) || 100,
      activated: s.activated ?? false,
      departmentId: s.department_id,
    }));

    // Group by level for stats
    const levelGroups: Record<number, number> = {};
    for (const s of formattedStudents) {
      const lvl = s.level;
      levelGroups[lvl] = (levelGroups[lvl] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      data: {
        students: formattedStudents,
        levelBreakdown: levelGroups,
        total: formattedStudents.length,
        activated: formattedStudents.filter(s => s.activated).length,
      },
    });
  } catch (error) {
    console.error('HOD students GET error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
