// ============================================================
// checkIn - HOD Stats API
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

    // Count lecturers
    const { data: lecturers } = await db.from('lecturers').select('id').eq('department_id', departmentId);
    const lecturerCount = lecturers?.length || 0;

    // Count courses by level
    const { data: courses } = await db.from('courses').select('level').eq('department_id', departmentId);
    const courseCount = courses?.length || 0;
    const coursesByLevel: Record<number, number> = {};
    for (const c of (courses || [])) {
      const lvl = typeof (c as Record<string, unknown>).level === 'number'
        ? (c as Record<string, unknown>).level as number
        : parseInt((c as Record<string, unknown>).level as string, 10) || 100;
      coursesByLevel[lvl] = (coursesByLevel[lvl] || 0) + 1;
    }

    // Count students by level
    const { data: students } = await db.from('students').select('level, activated').eq('department_id', departmentId);
    const studentCount = students?.length || 0;
    const activatedCount = (students || []).filter(s => (s as Record<string, unknown>).activated).length;
    const studentsByLevel: Record<number, number> = {};
    for (const s of (students || [])) {
      const lvl = typeof (s as Record<string, unknown>).level === 'number'
        ? (s as Record<string, unknown>).level as number
        : parseInt((s as Record<string, unknown>).level as string, 10) || 100;
      studentsByLevel[lvl] = (studentsByLevel[lvl] || 0) + 1;
    }

    // Count active sessions for courses in this department.
    // Fetch session IDs linked to this department via session_departments,
    // then count active sessions among them (avoids counting global sessions).
    const { data: sessionDeptLinks } = await db
      .from('session_departments')
      .select('session_id')
      .eq('department_id', departmentId as string);
    const sessionIds = ((sessionDeptLinks || []) as Record<string, unknown>[])
      .map((sd) => sd.session_id as string)
      .filter(Boolean);
    let activeSessions = 0;
    if (sessionIds.length > 0) {
      const { data: deptSessions } = await db.from('sessions').select('status').in('id', sessionIds);
      activeSessions = (deptSessions || []).filter(s => (s as Record<string, unknown>).status === 'active').length;
    }

    return NextResponse.json({
      success: true,
      data: {
        lecturerCount,
        courseCount,
        coursesByLevel,
        studentCount,
        activatedCount,
        studentsByLevel,
        activationRate: studentCount > 0 ? Math.round((activatedCount / studentCount) * 100) : 0,
        activeSessions,
      },
    });
  } catch (error) {
    console.error('HOD stats error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
