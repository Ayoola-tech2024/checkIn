// ============================================================
// checkIn - HOD Students API (View students in HOD's dept)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const level = searchParams.get('level');

    if (!departmentId) {
      return NextResponse.json({ success: false, error: 'Department ID is required' }, { status: 400 });
    }

    let query = db.from('students').select('*').eq('department_id', departmentId);

    if (level) {
      query = query.eq('level', parseInt(level, 10));
    }

    const { data: students, error } = await query.order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const formattedStudents = (students || []).map((s: Record<string, unknown>) => ({
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
