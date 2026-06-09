import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');

    let query = db.from('students').select('*, departments(id, name, code)');
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

    const data = (students || []).map((s: Record<string, unknown>) => {
      const department = s.departments as Record<string, unknown> | null;
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
