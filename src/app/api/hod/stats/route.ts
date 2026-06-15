// ============================================================
// checkIn - HOD Stats API
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');

    if (!departmentId) {
      return NextResponse.json({ success: false, error: 'Department ID is required' }, { status: 400 });
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

    // Count active sessions for courses in this department
    const { data: sessions } = await db.from('sessions').select('status');
    const activeSessions = (sessions || []).filter(s => (s as Record<string, unknown>).status === 'active').length;

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
