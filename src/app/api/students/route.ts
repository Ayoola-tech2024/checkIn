import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';

export async function GET(request: NextRequest) {
  try {
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

    const data = (students || []).map((s: Record<string, unknown>) => {
      const department = deptMap.get(s.department_id as string) || null;
      return {
        id: s.id,
        name: s.name,
        matricNumber: s.matric_number,
        departmentId: s.department_id,
        departmentName: department?.name,
        departmentCode: department?.code,
        email: s.email,
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
