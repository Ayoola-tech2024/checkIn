import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { getAuthUser } from '@/lib/auth-context';

export async function GET(request: NextRequest) {
  try {
    // AUTHORIZATION: middleware guarantees the caller is authenticated,
    // but this route sits outside the /api/admin|hod|lecturer|student/
    // role-prefix rules, so enforce the role explicitly here. Students
    // must not be able to enumerate the full student body.
    const auth = getAuthUser(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    if (auth.role === 'student') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');

    let query = db.from('students').select('*');
    if (departmentId) {
      query = query.eq('department_id', departmentId);
    }

    const { data: students, error } = await query.order('name', { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }

    // Manually join departments for students
    const studentDeptIds = (students || []).map((s: Record<string, unknown>) => s.department_id as string).filter(Boolean);
    const uniqueDeptIds = [...new Set(studentDeptIds)];
    let deptMap = new Map<string, Record<string, unknown>>();
    if (uniqueDeptIds.length > 0) {
      const { data: depts } = await db.from('departments').select('id, name, code').in('id', uniqueDeptIds);
      for (const d of depts || []) {
        deptMap.set((d as Record<string, unknown>).id as string, d as Record<string, unknown>);
      }
    }

    // Fetch school info for students
    const schoolIds = [...new Set((students || []).map((s: Record<string, unknown>) => s.school_id as string).filter(Boolean))];
    const schoolMap = new Map<string, { name: string; code: string }>();
    if (schoolIds.length > 0) {
      const { data: schoolData } = await db.from('schools').select('id, name, code').in('id', schoolIds);
      for (const s of schoolData || []) {
        schoolMap.set((s as Record<string, unknown>).id as string, { name: (s as Record<string, unknown>).name as string, code: (s as Record<string, unknown>).code as string });
      }
    }

    const data = (students || []).map((s: Record<string, unknown>) => {
      const department = deptMap.get(s.department_id as string) || null;
      const school = schoolMap.get(s.school_id as string);
      return {
        id: s.id,
        name: s.name,
        matricNumber: s.matric_number,
        departmentId: s.department_id,
        departmentName: department?.name,
        departmentCode: department?.code,
        email: s.email,
        schoolId: s.school_id,
        schoolName: school?.name,
        schoolCode: school?.code,
        level: typeof s.level === 'number' ? s.level : (typeof s.level === 'string' ? parseInt(s.level as string, 10) || 100 : 100),
        activated: s.activated,
        createdAt: s.created_at,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Get students error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
