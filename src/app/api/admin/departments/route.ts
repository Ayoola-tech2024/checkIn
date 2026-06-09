import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';

export async function GET() {
  try {
    const { data: departments, error } = await db
      .from('departments')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }

    // Manually count students per department
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

    const data = (departments || []).map((dept: Record<string, unknown>) => ({
      id: dept.id,
      name: dept.name,
      code: dept.code,
      studentCount: studentCountMap.get(dept.id as string) || 0,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Get departments error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, code } = await request.json();

    if (!name || !code) {
      return NextResponse.json(
        { success: false, error: 'Name and code are required' },
        { status: 400 }
      );
    }

    // Check for existing department with same name or code
    const { data: existing } = await db
      .from('departments')
      .select('id')
      .or(`name.eq."${name}",code.eq."${code}"`);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Department with this name or code already exists' },
        { status: 409 }
      );
    }

    const { data: departments, error } = await db
      .from('departments')
      .insert({ name, code })
      .select();

    if (error || !departments || departments.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to create department' },
        { status: 500 }
      );
    }

    const department = departments[0] as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      data: {
        id: department.id,
        name: department.name,
        code: department.code,
        studentCount: 0,
      },
    });
  } catch (error) {
    console.error('Create department error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
