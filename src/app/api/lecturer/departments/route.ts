import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { getAuthUser } from '@/lib/auth-context';

// ============================================================
// Lecturer/HOD department list endpoint.
// ----------------------------------------------------------------
// Mirrors /api/admin/departments GET but accessible to lecturer+hod.
// The lecturer portal needs this for the "Create Session" department
// multi-select. Returns departments with school info and student counts.
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
    const { data: departments, error } = await db
      .from('departments')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Lecturer departments query error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }

    // Count students per department
    const deptIds = (departments || []).map((d: Record<string, unknown>) => d.id as string);
    let studentCountMap = new Map<string, number>();
    if (deptIds.length > 0) {
      const { data: studentsData } = await db.from('students').select('id, department_id').in('department_id', deptIds);
      for (const s of studentsData || []) {
        const rec = s as Record<string, unknown>;
        const dId = rec.department_id as string;
        studentCountMap.set(dId, (studentCountMap.get(dId) || 0) + 1);
      }
    }

    // Fetch school info
    const schoolIds = [...new Set((departments || []).map((d: Record<string, unknown>) => d.school_id as string).filter(Boolean))];
    const schoolMap = new Map<string, { name: string; code: string }>();
    if (schoolIds.length > 0) {
      const { data: schoolData } = await db
        .from('schools')
        .select('id, name, code')
        .in('id', schoolIds);
      for (const s of schoolData || []) {
        const rec = s as Record<string, unknown>;
        schoolMap.set(rec.id as string, { name: rec.name as string, code: rec.code as string });
      }
    }

    const data = ((departments || []) as Record<string, unknown>[]).map((d: Record<string, unknown>) => {
      const schoolId = d.school_id as string | undefined;
      const school = schoolId ? schoolMap.get(schoolId) : undefined;
      return {
        id: d.id,
        name: d.name,
        code: d.code,
        schoolId,
        schoolName: school?.name,
        schoolCode: school?.code,
        studentCount: studentCountMap.get(d.id as string) || 0,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Lecturer get departments error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
